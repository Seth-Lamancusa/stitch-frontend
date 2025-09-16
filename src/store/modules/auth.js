import WebSocketService from '../../services/ws/WebSocketService'
import TokenManager from '../../services/TokenManager'
import axios from 'axios'
import { parseScopes, hasScope as hasScopeUtil, hasAnyScope as hasAnyScopeUtil } from '../../utils/scopes'

// ------------------------------------------------------------
// Auth store
// ------------------------------------------------------------

// Helper: normalize API user to auth state shape
function mapApiUserToAuthState(userData) {
  const data = userData || {};
  const contacts = Array.isArray(data.contacts) ? data.contacts : [];
  const primaryEmail = contacts.find(c => c.type === 'email');
  const primaryEmailValue = primaryEmail && typeof primaryEmail.value === 'string' && primaryEmail.value.trim() ? primaryEmail.value : null;
  const isEmailVerified = !!(primaryEmail && primaryEmail.verified);
  const primaryPhone = contacts.find(c => c.type === 'phone');
  const primaryPhoneValue = primaryPhone && typeof primaryPhone.value === 'string' && primaryPhone.value.trim() ? primaryPhone.value : null;
  const isPhoneVerified = !!(primaryPhone && primaryPhone.verified);
  return {
    uid: data.uid,
    displayName: data.display_name,
    user_tag: data.user_tag || '',
    scopes: data.scopes || '',
    contact: null,
    contacts,
    // Convenience mirrors for easy access in UI
    phone_number: primaryPhoneValue,
    email: primaryEmailValue,
    is_email_verified: isEmailVerified,
    is_phone_verified: isPhoneVerified,
    has_endpoint_signing_secret: !!data.has_endpoint_signing_secret
  };
}

export default {
  namespaced: true,
  
  state: {
    user: null,
    isAuthenticated: false,
    authReady: false
  },
  
  mutations: {
    SET_USER(state, user) {
      state.user = user;
      state.isAuthenticated = !!user;
    },
    SET_AUTH_READY(state, ready) {
      state.authReady = ready;
    }
  },
  
  actions: {
    // Internal helper to consistently clear local auth state
    _clearLocalAuth({ commit }) {
      try { WebSocketService.cleanup(); } catch (e) {}
      try { TokenManager.accessToken = null; } catch (e) {}
      try { TokenManager.refreshToken = null; } catch (e) {}
      commit('SET_USER', null);
      commit('SET_AUTH_READY', true);
    },
    async initAuth({ commit, dispatch }) {
      try {
        const token = TokenManager.accessToken;
        if (!token) {
          // Attempt proactive refresh if a refresh token exists
          const refresh = TokenManager.refreshToken;
          if (refresh) {
            const newAccess = await TokenManager.refreshAccessToken();
            if (newAccess) {
              await dispatch('validateExistingToken');
            } else {
              commit('SET_USER', null);
            }
          } else {
            commit('SET_USER', null);
          }
          commit('SET_AUTH_READY', true);
          return;
        }
        await dispatch('validateExistingToken');
      } catch (error) {
        console.error('Auth initialization failed:', error);
        commit('SET_USER', null);
      } finally {
        commit('SET_AUTH_READY', true);
      }
    },

    async deleteOwnAccount({ commit, dispatch }) {
      try {
        console.warn('[AUTH] Deleting own account: initiating');
        const token = TokenManager.accessToken;
        if (!token) throw new Error('Not authenticated');

        const resp = await axios.delete('/api/v1/users/me', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!resp || resp.status < 200 || resp.status >= 300) {
          const data = (resp && resp.data) || {};
          throw new Error(data.detail || 'Failed to delete account');
        }

        // Cleanup local state and tokens
        console.warn('[AUTH] Account deleted successfully; clearing local auth state and redirecting');
        await dispatch('_clearLocalAuth');

        // Redirect to public page
        if (window.location.pathname !== '/public') {
          window.location.href = '/public';
        }
        return { success: true };
      } catch (e) {
        console.error('[AUTH] Delete account failed', e);
        throw e;
      }
    },

    async validateExistingToken({ commit }) {
      try {
        const token = TokenManager.accessToken;
        if (!token) {
          commit('SET_USER', null);
          return;
        }
        // Single call; axios interceptor handles 401 -> refresh -> retry
        const response = await axios.get('/api/v1/users/me', { headers: { 'Authorization': `Bearer ${token}` } });
        const userData = response && response.data ? response.data : {};
        commit('SET_USER', mapApiUserToAuthState(userData));
        try {
          await WebSocketService.initialize();
        } catch (e) {
          console.error('[AUTH STORE] WebSocket init failed:', e);
        }
      } catch (error) {
        console.error('[AUTH] Token validation threw error; clearing tokens and user', error);
        TokenManager.accessToken = null;
        TokenManager.refreshToken = null;
        commit('SET_USER', null);
        WebSocketService.cleanup();
      }
    },

    async signOut({ commit, dispatch }) {
      try {
        // Clean up WebSocket connection before signing out
        console.info('[AUTH] Programmatic sign out initiated');
        await dispatch('_clearLocalAuth');
      } catch (error) {
        console.error('[AUTH] Error during sign out', error);
      }
    },

    async searchUsers({ }, query) {
      try {
        const token = TokenManager.accessToken;
        const response = await axios.get(`/api/users/search?query=${encodeURIComponent(query)}&limit=15`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = response && response.data ? response.data : {};
        return data.users || [];
      } catch (error) {
        console.error('Error searching users:', error);
        return [];
      }
    },


    async updateProfile({ commit }, profileData) {
      try {
        const token = TokenManager.accessToken;
        const response = await axios.post('/api/v1/users/profile', profileData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (!response || response.status < 200 || response.status >= 300) {
          const errorData = (response && response.data) || {};
          throw new Error(errorData.detail || 'Failed to update profile');
        }
        const result = response.data;

        // Immediately refresh full user state (including contacts/notify flags) from /me
        try {
          const meResp = await axios.get('/api/v1/users/me', { headers: { 'Authorization': `Bearer ${token}` } });
          if (meResp && meResp.status >= 200 && meResp.status < 300) {
            const userData = meResp.data;
            commit('SET_USER', mapApiUserToAuthState(userData));
          }
        } catch (e) {
          // Fallback: maintain previous behavior if /me fails
          const currentUser = this.state.auth.user;
          if (currentUser && result.profile) {
            commit('SET_USER', {
              ...currentUser,
              displayName: result.profile.display_name,
              user_tag: result.profile.user_tag,
              phone_number: result.profile.phone_number ?? null,
              email: result.profile.email ?? null,
              contact: null
            });
          }
        }

        return result;
      } catch (error) {
        // Normalize known backend conflicts to short codes for UI catch blocks
        try {
          const status = error?.response?.status;
          const detail = error?.response?.data?.detail;
          if (status === 409 && typeof detail === 'string' && detail) {
            // Pass through standard codes
            if (['user_tag_conflict','email_conflict','phone_conflict','multiple_endpoints_not_allowed','managed_contacts_endpoints_only'].includes(detail)) {
              throw new Error(detail);
            }
          }
          if (status && detail) {
            throw new Error(detail);
          }
        } catch (_) {
          // fall through to generic handling
        }
        console.error('Error updating profile:', error);
        throw error;
      }
    },

    async forceLogoutWithMessage({ commit, dispatch }, router = null) {
      try {
        console.warn('[AUTH] Force logout due to unauthorized/refresh-fail', {
          routerAvailable: !!router,
          path: typeof window !== 'undefined' ? window.location.pathname : undefined
        });
        
        // Clear user state
        await dispatch('_clearLocalAuth');
        
        // Redirect to the public page
        if (window.location.pathname !== '/public') {
          console.warn('[AUTH] Redirecting to /public from', window.location.pathname);
          // Use Vue router if available, otherwise fall back to hard redirect
          if (router) {
            console.info('[AUTH] Using Vue router to navigate');
            router.push('/public');
          } else {
            console.info('[AUTH] Using hard redirect');
            window.location.href = '/public';
          }
        } else {
          console.info('[AUTH] Already on /public, no redirect needed');
        }
      } catch (error) {
        console.error('[AUTH] Error during force logout', error);
        // Even if logout fails, clear local state
        await dispatch('_clearLocalAuth');
      }
    }
  },
  
  getters: {
    user: state => state.user,
    isAuthenticated: state => state.isAuthenticated,
    authReady: state => state.authReady,
    // Scopes helpers
    scopesSet: state => parseScopes(state.user ? state.user.scopes : ''),
    hasScope: state => (name) => state.user ? hasScopeUtil(state.user.scopes, name) : false,
    hasAnyScope: state => (names) => state.user ? hasAnyScopeUtil(state.user.scopes, names) : false,

    // Common role-style flags derived from scopes
    isAdmin: (state, getters) => getters.hasScope('admin'),
    // Interaction capability: can the user create/write messages
    canInteract: (state, getters) => getters.hasAnyScope(['msg.write', 'admin']),

    // Capability predicates
    canDeleteMessage: (state, getters) => (message) => {
      if (!state.user || !message) return false;
      if (getters.hasScope('admin')) return true;
      if (!getters.hasScope('msg.write')) return false;
      const currentUid = state.user.uid;
      const currentTag = state.user.user_tag || null;
      const isAuthorByUid = (message.content_author && message.content_author === currentUid) ||
                            (message.author && message.author.uid && message.author.uid === currentUid);
      const isAuthorByTag = currentTag && message.author_user_tag && message.author_user_tag === currentTag;
      return !!(isAuthorByUid || isAuthorByTag);
    },
  }
}
