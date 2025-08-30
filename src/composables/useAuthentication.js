import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';
import TokenManager from '../services/TokenManager';

/**
 * Composable for managing authentication state and operations
 * 
 * Provides:
 * - Google sign-in functionality
 * - Logout functionality
 * - Authentication error tracking
 * - Automatic navigation after auth state changes
 * 
 * @returns {Object} Auth methods and state
 */
export function useAuthentication() {
  const error = ref(null);
  const router = useRouter();
  const store = useStore();

  /**
   * Signs out the current user
   * On success, clears store and redirects to public page
   */
  const logout = async () => {
    try {
      TokenManager.accessToken = null;
      TokenManager.refreshToken = null;
      store.commit('auth/SET_USER', null);
      window.location.href = '/public';
    } catch (e) {
      error.value = e.message;
    }
  };

  const signInWithPassword = async (identifier, password) => {
    try {
      error.value = null;
      const resp = await fetch('/api/auth/password/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      if (!resp.ok) {
        const info = await resp.json().catch(() => ({}));
        throw new Error(info.detail || 'Invalid credentials');
      }
      const data = await resp.json();
      const token = data.access_token;
      if (!token) throw new Error('Missing access token');
      TokenManager.accessToken = token;
      if (data.refresh_token) TokenManager.refreshToken = data.refresh_token;
      await store.dispatch('auth/validateExistingToken');
    } catch (e) {
      error.value = e.message;
      throw e;
    }
  };

  const registerWithPassword = async ({ email, password, user_tag, display_name, phone, endpoint, notify }) => {
    error.value = null;
    const resp = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, user_tag, display_name, phone, endpoint, notify })
    });
    if (!resp.ok) {
      const info = await resp.json().catch(() => ({}));
      throw new Error(info.detail || 'Registration failed');
    }
    const data = await resp.json();
    const token = data.access_token;
    if (!token) throw new Error('Missing access token');
    TokenManager.accessToken = token;
    if (data.refresh_token) TokenManager.refreshToken = data.refresh_token;
    await store.dispatch('auth/validateExistingToken');
  };

  const changePassword = async ({ current_password, new_password }) => {
    error.value = null;
    const resp = await fetch('/api/auth/password/change', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TokenManager.accessToken}`
      },
      body: JSON.stringify({ current_password, new_password })
    });
    if (!resp.ok) {
      const info = await resp.json().catch(() => ({}));
      throw new Error(info.detail || 'Password change failed');
    }
    const data = await resp.json();
    const token = data.access_token;
    if (!token) throw new Error('Missing access token');
    TokenManager.accessToken = token;
    if (data.refresh_token) TokenManager.refreshToken = data.refresh_token;
    await store.dispatch('auth/validateExistingToken');
  };

  // Password reset: request and apply with code (email-only)
  const requestPasswordResetCode = async (email, user_tag) => {
    error.value = null;
    const resp = await fetch('/api/auth/password/reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, user_tag })
    });
    if (!resp.ok) {
      // Surface 409 specifically for multiple accounts
      if (resp.status === 409) {
        throw new Error('multiple_accounts_for_email');
      }
      const info = await resp.json().catch(() => ({}));
      throw new Error(info.detail || 'Failed to request reset code');
    }
    return await resp.json();
  };

  const resetPasswordWithCode = async ({ email, user_tag, code, new_password }) => {
    error.value = null;
    const resp = await fetch('/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, user_tag, code, new_password })
    });
    if (!resp.ok) {
      if (resp.status === 409) {
        throw new Error('multiple_accounts_for_email');
      }
      const info = await resp.json().catch(() => ({}));
      throw new Error(info.detail || 'Password reset failed');
    }
    const data = await resp.json();
    const token = data.access_token;
    if (!token) throw new Error('Missing access token');
    TokenManager.accessToken = token;
    if (data.refresh_token) TokenManager.refreshToken = data.refresh_token;
    await store.dispatch('auth/validateExistingToken');
  };

  // Contact verification: email and phone
  const requestEmailVerification = async (email) => {
    const token = localStorage.getItem('auth_token');
    const resp = await fetch('/api/auth/contacts/email/request', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });
    if (!resp.ok) {
      const info = await resp.json().catch(() => ({}));
      throw new Error(info.detail || 'Failed to request email verification');
    }
    return await resp.json();
  };

  const verifyEmailWithCode = async ({ email, code }) => {
    const token = localStorage.getItem('auth_token');
    const resp = await fetch('/api/auth/contacts/email/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, code })
    });
    if (!resp.ok) {
      const info = await resp.json().catch(() => ({}));
      throw new Error(info.detail || 'Failed to verify email');
    }
    const result = await resp.json();
    // Email verification may add msg.write to user scopes; refresh access token to pick up new scopes
    await TokenManager.refreshAccessToken();
    await store.dispatch('auth/validateExistingToken');
    return result;
  };

  const requestPhoneVerification = async (phone) => {
    const token = localStorage.getItem('auth_token');
    const resp = await fetch('/api/auth/contacts/phone/request', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phone })
    });
    if (!resp.ok) {
      const info = await resp.json().catch(() => ({}));
      throw new Error(info.detail || 'Failed to request phone verification');
    }
    return await resp.json();
  };

  const verifyPhoneWithCode = async ({ phone, code }) => {
    const token = localStorage.getItem('auth_token');
    const resp = await fetch('/api/auth/contacts/phone/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phone, code })
    });
    if (!resp.ok) {
      const info = await resp.json().catch(() => ({}));
      throw new Error(info.detail || 'Failed to verify phone');
    }
    const result = await resp.json();
    await store.dispatch('auth/validateExistingToken');
    return result;
  };

  // Endpoint verification (request + verify)
  const requestEndpointVerification = async (endpointUrl) => {
    const token = localStorage.getItem('auth_token');
    const resp = await fetch('/api/auth/contacts/endpoint/request', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ endpoint: endpointUrl })
    });
    if (!resp.ok) {
      const info = await resp.json().catch(() => ({}));
      throw new Error(info.detail || 'Failed to request endpoint verification');
    }
    return await resp.json();
  };

  const verifyEndpointWithChallenge = async ({ endpoint }) => {
    const token = localStorage.getItem('auth_token');
    const resp = await fetch('/api/auth/contacts/endpoint/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ endpoint })
    });
    if (!resp.ok) {
      const info = await resp.json().catch(() => ({}));
      throw new Error(info.detail || 'Failed to verify endpoint');
    }
    const result = await resp.json();
    await store.dispatch('auth/validateExistingToken');
    return result;
  };

  return {
    error,
    signInWithPassword,
    registerWithPassword,
    changePassword,
    requestPasswordResetCode,
    resetPasswordWithCode,
    requestEmailVerification,
    verifyEmailWithCode,
    requestPhoneVerification,
    verifyPhoneWithCode,
    requestEndpointVerification,
    verifyEndpointWithChallenge,
    logout
  };
} 