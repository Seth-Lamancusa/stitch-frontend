import { ref } from 'vue'
import { useStore } from 'vuex'
import axios from 'axios'
import authStore from '../auth/store.js'
import { authClient } from '../auth/client.js'

/**
 * Composable for authentication operations (login/register/password/contacts).
 * Session credential is cookie-only; never touch tokens in JS.
 */
export function useAuthentication() {
  const error = ref(null)
  const store = useStore()

  const logout = async () => {
    try {
      console.info('[AUTH] Manual logout requested')
      await store.dispatch('auth/signOut')
    } catch (e) {
      error.value = e.message
    }
  }

  const signInWithPassword = async (identifier, password) => {
    try {
      error.value = null
      await authStore.login(identifier, password)
      await store.dispatch('auth/validateExistingToken')
    } catch (e) {
      const status = e?.response?.status
      const info = e?.response?.data || {}
      if (e?.message === 'session_cookie_missing') {
        const friendly = 'Login succeeded but session cookie was not set (check HTTPS / COOKIE_INSECURE_LOCAL)'
        error.value = friendly
        throw new Error(friendly)
      }
      if (status === 409 && info?.detail === 'multiple_accounts_for_email') {
        const friendly = 'multiple_accounts_for_email'
        error.value = friendly
        throw new Error(friendly)
      }
      if (status === 401 && info?.detail === 'invalid_credentials') {
        const friendly = 'Invalid tag/email/phone or password'
        error.value = friendly
        throw new Error(friendly)
      }
      const fallback = info?.detail || e?.message || 'Login failed'
      error.value = fallback
      throw new Error(fallback)
    }
  }

  const registerWithPassword = async ({
    email,
    password,
    user_tag,
    display_name,
    phone,
    endpoint,
    notify,
  }) => {
    error.value = null
    try {
      await axios.post(
        '/v1/users/register',
        {
          email,
          password,
          user_tag,
          display_name,
          phone,
          endpoint,
          notify,
          device_id: authClient.deviceId(),
        },
        { withCredentials: true }
      )
      // Cookie set by register; load session + profile
      await authStore.restoreSession()
      await store.dispatch('auth/validateExistingToken')
    } catch (e) {
      const status = e?.response?.status
      const info = e?.response?.data || {}
      if (status === 409) {
        const detail = info?.detail
        if (detail === 'user_tag_conflict' || detail === 'user_tag_in_use') {
          throw new Error('user_tag_in_use')
        }
        if (detail === 'email_conflict') throw new Error('email_conflict')
        if (detail === 'phone_conflict') throw new Error('phone_conflict')
      }
      throw new Error(info.detail || e.message || 'Registration failed')
    }
  }

  const changePassword = async ({ current_password, new_password }) => {
    error.value = null
    try {
      await axios.post(
        '/v1/auth/password/change',
        { current_password, new_password },
        { withCredentials: true }
      )
      await authStore.restoreSession()
      await store.dispatch('auth/validateExistingToken')
    } catch (e) {
      const status = e?.response?.status
      const info = e?.response?.data || {}
      if (status === 401 && info?.detail === 'invalid_current_password') {
        const friendly = 'Invalid current password'
        error.value = friendly
        throw new Error(friendly)
      }
      if (status === 400 && info?.detail === 'weak_password') {
        const friendly = 'Password must be 8+ characters with a letter and number'
        error.value = friendly
        throw new Error(friendly)
      }
      const fallback = info?.detail || e?.message || 'Change password failed'
      error.value = fallback
      throw new Error(fallback)
    }
  }

  const requestPasswordResetCode = async (email, user_tag) => {
    error.value = null
    try {
      const resp = await axios.post('/v1/auth/password/reset/request', { email, user_tag })
      return resp?.data || {}
    } catch (e) {
      if (e?.response?.status === 409) throw new Error('multiple_accounts_for_email')
      const info = e?.response?.data || {}
      throw new Error(info.detail || 'Failed to request reset code')
    }
  }

  const resetPasswordWithCode = async ({ email, user_tag, code, new_password }) => {
    error.value = null
    try {
      await axios.post(
        '/v1/auth/password/reset',
        { email, user_tag, code, new_password },
        { withCredentials: true }
      )
    } catch (e) {
      if (e?.response?.status === 409) throw new Error('multiple_accounts_for_email')
      const info = e?.response?.data || {}
      throw new Error(info.detail || 'Password reset failed')
    }
    await authStore.restoreSession()
    await store.dispatch('auth/validateExistingToken')
  }

  const requestEmailVerification = async (email) => {
    const resp = await axios.post(
      '/v1/auth/contacts/email/request',
      { email },
      { withCredentials: true }
    )
    return resp?.data || {}
  }

  const verifyEmailWithCode = async ({ email, code }) => {
    const resp = await axios.post(
      '/v1/auth/contacts/email/verify',
      { email, code },
      { withCredentials: true }
    )
    const result = resp?.data || {}
    // Email verify may grant write — refresh session permissions
    await authStore.refresh().catch(() => authStore.restoreSession())
    await store.dispatch('auth/validateExistingToken')
    return result
  }

  const requestPhoneVerification = async (phone) => {
    const resp = await axios.post(
      '/v1/auth/contacts/phone/request',
      { phone },
      { withCredentials: true }
    )
    return resp?.data || {}
  }

  const verifyPhoneWithCode = async ({ phone, code }) => {
    const resp = await axios.post(
      '/v1/auth/contacts/phone/verify',
      { phone, code },
      { withCredentials: true }
    )
    const result = resp?.data || {}
    await store.dispatch('auth/validateExistingToken')
    return result
  }

  const requestEndpointVerification = async (endpointUrl) => {
    const resp = await axios.post(
      '/v1/auth/contacts/endpoint/request',
      { endpoint: endpointUrl },
      { withCredentials: true }
    )
    return resp?.data || {}
  }

  const verifyEndpointWithChallenge = async ({ endpoint }) => {
    const resp = await axios.post(
      '/v1/auth/contacts/endpoint/verify',
      { endpoint },
      { withCredentials: true }
    )
    const result = resp?.data || {}
    await store.dispatch('auth/validateExistingToken')
    return result
  }

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
    logout,
  }
}
