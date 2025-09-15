import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';
import TokenManager from '../services/TokenManager';
import axios from 'axios';

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
      console.info('[AUTH] Manual logout requested');
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
      const resp = await axios.post('/api/v1/auth/password/login', { identifier, password });
      const data = resp && resp.data ? resp.data : {};
      const token = data.access_token;
      if (!token) throw new Error('Missing access token');
      TokenManager.accessToken = token;
      if (data.refresh_token) TokenManager.refreshToken = data.refresh_token;
      await store.dispatch('auth/validateExistingToken');
    } catch (e) {
      const status = e?.response?.status;
      const info = e?.response?.data || {};
      if (status === 409 && info?.detail === 'multiple_accounts_for_email') {
        // Surface a code the UI already knows how to render nicely
        const friendly = 'multiple_accounts_for_email';
        error.value = friendly;
        throw new Error(friendly);
      }
      if (status === 401 && info?.detail === 'invalid_credentials') {
        const friendly = 'Invalid tag/email/phone or password';
        error.value = friendly;
        throw new Error(friendly);
      }
      const fallback = info?.detail || e?.message || 'Login failed';
      error.value = fallback;
      throw new Error(fallback);
    }
  };

  const registerWithPassword = async ({ email, password, user_tag, display_name, phone, endpoint, notify }) => {
    error.value = null;
    try {
      const resp = await axios.post('/api/v1/auth/register', { email, password, user_tag, display_name, phone, endpoint, notify });
      const data = resp && resp.data ? resp.data : {};
      const token = data.access_token;
      if (!token) throw new Error('Missing access token');
      TokenManager.accessToken = token;
      if (data.refresh_token) TokenManager.refreshToken = data.refresh_token;
      await store.dispatch('auth/validateExistingToken');
    } catch (e) {
      if (e?.response?.status === 409) {
        // Backend returns 409 when user_tag is already taken
        throw new Error('user_tag_in_use');
      }
      const info = e?.response?.data || {};
      throw new Error(info.detail || e.message || 'Registration failed');
    }
  };

  const changePassword = async ({ current_password, new_password }) => {
    error.value = null;
    try {
      const resp = await axios.post('/api/v1/auth/password/change', { current_password, new_password }, {
        headers: {
          'Authorization': `Bearer ${TokenManager.accessToken}`
        }
      });
      const data = resp && resp.data ? resp.data : {};
      const token = data.access_token;
      if (!token) throw new Error('Missing access token');
      TokenManager.accessToken = token;
      if (data.refresh_token) TokenManager.refreshToken = data.refresh_token;
      await store.dispatch('auth/validateExistingToken');
    } catch (e) {
      const status = e?.response?.status;
      const info = e?.response?.data || {};
      if (status === 401 && info?.detail === 'invalid_current_password') {
        const friendly = 'Invalid current password';
        error.value = friendly;
        throw new Error(friendly);
      }
      if (status === 400 && info?.detail === 'weak_password') {
        const friendly = 'Password must be 8+ characters with a letter and number';
        error.value = friendly;
        throw new Error(friendly);
      }
      const fallback = info?.detail || e?.message || 'Change password failed';
      error.value = fallback;
      throw new Error(fallback);
    }
  };

  // Password reset: request and apply with code (email-only)
  const requestPasswordResetCode = async (email, user_tag) => {
    error.value = null;
    try {
      const resp = await axios.post('/api/v1/auth/password/reset/request', { email, user_tag });
      return resp && resp.data ? resp.data : {};
    } catch (e) {
      if (e?.response?.status === 409) throw new Error('multiple_accounts_for_email');
      const info = e?.response?.data || {};
      throw new Error(info.detail || 'Failed to request reset code');
    }
  };

  const resetPasswordWithCode = async ({ email, user_tag, code, new_password }) => {
    error.value = null;
    let resp;
    try {
      resp = await axios.post('/api/v1/auth/password/reset', { email, user_tag, code, new_password });
    } catch (e) {
      if (e?.response?.status === 409) throw new Error('multiple_accounts_for_email');
      const info = e?.response?.data || {};
      throw new Error(info.detail || 'Password reset failed');
    }
    const data = resp && resp.data ? resp.data : {};
    const token = data.access_token;
    if (!token) throw new Error('Missing access token');
    TokenManager.accessToken = token;
    if (data.refresh_token) TokenManager.refreshToken = data.refresh_token;
    await store.dispatch('auth/validateExistingToken');
  };

  // Contact verification: email and phone
  const requestEmailVerification = async (email) => {
    const token = TokenManager.accessToken;
    const resp = await axios.post('/api/v1/auth/contacts/email/request', { email }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return resp && resp.data ? resp.data : {};
  };

  const verifyEmailWithCode = async ({ email, code }) => {
    const token = TokenManager.accessToken;
    const resp = await axios.post('/api/v1/auth/contacts/email/verify', { email, code }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = resp && resp.data ? resp.data : {};
    // Email verification may add msg.write to user scopes; refresh access token to pick up new scopes
    await TokenManager.refreshAccessToken();
    await store.dispatch('auth/validateExistingToken');
    return result;
  };

  const requestPhoneVerification = async (phone) => {
    const token = TokenManager.accessToken;
    const resp = await axios.post('/api/v1/auth/contacts/phone/request', { phone }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return resp && resp.data ? resp.data : {};
  };

  const verifyPhoneWithCode = async ({ phone, code }) => {
    const token = TokenManager.accessToken;
    const resp = await axios.post('/api/v1/auth/contacts/phone/verify', { phone, code }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = resp && resp.data ? resp.data : {};
    await store.dispatch('auth/validateExistingToken');
    return result;
  };

  // Endpoint verification (request + verify)
  const requestEndpointVerification = async (endpointUrl) => {
    const token = TokenManager.accessToken;
    const resp = await axios.post('/api/v1/auth/contacts/endpoint/request', { endpoint: endpointUrl }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return resp && resp.data ? resp.data : {};
  };

  const verifyEndpointWithChallenge = async ({ endpoint }) => {
    const token = TokenManager.accessToken;
    const resp = await axios.post('/api/v1/auth/contacts/endpoint/verify', { endpoint }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = resp && resp.data ? resp.data : {};
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