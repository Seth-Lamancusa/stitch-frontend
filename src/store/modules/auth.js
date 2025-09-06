import WebSocketService from '../../services/ws/WebSocketService'
import TokenManager from '../../services/TokenManager'
import { parseScopes, hasScope as hasScopeUtil, hasAnyScope as hasAnyScopeUtil } from '../../utils/scopes'

// ------------------------------------------------------------
// Auth store
// ------------------------------------------------------------

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
    async initAuth({ commit, dispatch }) {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          // Attempt proactive refresh if a refresh token exists
          const refresh = localStorage.getItem('refresh_token');
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

    async deleteOwnAccount({ commit }) {
      try {
        console.warn('[AUTH] Deleting own account: initiating');
        const token = localStorage.getItem('auth_token');
        if (!token) throw new Error('Not authenticated');

        const resp = await fetch('/api/users/me', {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.detail || 'Failed to delete account');
        }

        // Cleanup local state and tokens
        console.warn('[AUTH] Account deleted successfully; clearing local auth state and redirecting');
        WebSocketService.cleanup();
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        commit('SET_USER', null);
        commit('SET_AUTH_READY', true);

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
        const token = localStorage.getItem('auth_token');
        if (!token) {
          commit('SET_USER', null);
          return;
        }
        const response = await fetch('/api/users/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
          console.warn('[AUTH] /users/me returned non-OK; clearing tokens and user');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          commit('SET_USER', null);
          WebSocketService.cleanup();
          return;
        }
        const userData = await response.json();
        const contacts = Array.isArray(userData.contacts) ? userData.contacts : [];
        const primaryEmail = contacts.find(c => c.type === 'email');
        const primaryEmailValue = primaryEmail && typeof primaryEmail.value === 'string' && primaryEmail.value.trim() ? primaryEmail.value : null;
        const isEmailVerified = !!(primaryEmail && primaryEmail.verified);
        const primaryPhone = contacts.find(c => c.type === 'phone');
        const primaryPhoneValue = primaryPhone && typeof primaryPhone.value === 'string' && primaryPhone.value.trim() ? primaryPhone.value : null;
        const isPhoneVerified = !!(primaryPhone && primaryPhone.verified);
        commit('SET_USER', {
          uid: userData.uid,
          displayName: userData.display_name,
          user_tag: userData.user_tag || '',
          scopes: userData.scopes || '',
          contact: null,
          contacts,
          // Convenience mirrors for easy access in UI
          phone_number: primaryPhoneValue,
          email: primaryEmailValue,
          is_email_verified: isEmailVerified,
          is_phone_verified: isPhoneVerified,
          has_endpoint_signing_secret: !!userData.has_endpoint_signing_secret
        });
        try {
          await WebSocketService.initialize();
        } catch (e) {
          console.error('[AUTH STORE] WebSocket init failed:', e);
        }
      } catch (error) {
        console.error('[AUTH] Token validation threw error; clearing tokens and user', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        commit('SET_USER', null);
        WebSocketService.cleanup();
      }
    },

    async signOut({ commit }) {
      try {
        // Clean up WebSocket connection before signing out
        console.info('[AUTH] Programmatic sign out initiated');
        WebSocketService.cleanup();
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        commit('SET_USER', null);
      } catch (error) {
        console.error('[AUTH] Error during sign out', error);
      }
    },

    async searchUsers({ }, query) {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`/api/users/search?query=${encodeURIComponent(query)}&limit=15`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Search failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.users || [];
      } catch (error) {
        console.error('Error searching users:', error);
        return [];
      }
    },


    async updateProfile({ commit }, profileData) {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch('/api/users/profile', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(profileData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to update profile');
        }

        const result = await response.json();

        // Immediately refresh full user state (including contacts/notify flags) from /me
        try {
          const meResp = await fetch('/api/users/me', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (meResp.ok) {
            const userData = await meResp.json();
            const contacts = Array.isArray(userData.contacts) ? userData.contacts : [];
            const primaryEmail = contacts.find(c => c.type === 'email');
            const primaryEmailValue = primaryEmail && typeof primaryEmail.value === 'string' && primaryEmail.value.trim() ? primaryEmail.value : null;
            const isEmailVerified = !!(primaryEmail && primaryEmail.verified);
            const primaryPhone = contacts.find(c => c.type === 'phone');
            const primaryPhoneValue = primaryPhone && typeof primaryPhone.value === 'string' && primaryPhone.value.trim() ? primaryPhone.value : null;
            const isPhoneVerified = !!(primaryPhone && primaryPhone.verified);
            commit('SET_USER', {
              uid: userData.uid,
              displayName: userData.display_name,
              user_tag: userData.user_tag || '',
              scopes: userData.scopes || '',
              contact: null,
              contacts,
              // Convenience mirrors for easy access in UI
              phone_number: primaryPhoneValue,
              email: primaryEmailValue,
              is_email_verified: isEmailVerified,
              is_phone_verified: isPhoneVerified,
              has_endpoint_signing_secret: !!userData.has_endpoint_signing_secret
            });
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
        console.error('Error updating profile:', error);
        throw error;
      }
    },

    async forceLogoutWithMessage({ commit }, router = null) {
      try {
        console.warn('[AUTH] Force logout due to unauthorized/refresh-fail', {
          routerAvailable: !!router,
          path: typeof window !== 'undefined' ? window.location.pathname : undefined
        });
        
        // Clear user state
        commit('SET_USER', null);
        commit('SET_AUTH_READY', true);
        
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        
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
        commit('SET_USER', null);
        commit('SET_AUTH_READY', true);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
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
