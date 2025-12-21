import WebSocketService from '../../services/ws/WebSocketService'
import TokenManager from '../../services/TokenManager'
import apiClient from '../../services/apiClient'
import { parseScopes } from '../../utils/scopes'
import { hasPermission as hasPermUtil, hasAnyPermission as hasAnyPermUtil, isAdmin as isAdminUtil } from '../../utils/permissions'

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
    has_endpoint_signing_secret: !!data.has_endpoint_signing_secret,
    has_api_access: !!data.has_api_access,
    is_managed: !!data.is_managed,
    private: !!data.private,
    bio: typeof data.bio === 'string' ? data.bio : '',
    is_bot: !!data.is_bot,
    input_modalities: typeof data.input_modalities === 'string' ? data.input_modalities : null,
    output_modalities: typeof data.output_modalities === 'string' ? data.output_modalities : null,
    third_party_integrations: typeof data.third_party_integrations === 'string' ? data.third_party_integrations : (typeof data.foundation_provider === 'string' ? data.foundation_provider : null)
  };
}

export default {
  namespaced: true,
  
  state: {
    user: null,
    isAuthenticated: false,
    authReady: false,
    _initInFlight: null,
    managedUsers: [],
    activePrincipalUid: null,
    managerUid: null,
    managerSnapshot: null
  },
  
  mutations: {
    SET_USER(state, user) {
      state.user = user;
      state.isAuthenticated = !!user;
    },
    SET_ACTIVE_AND_MANAGER_UIDS(state, { activeUid, managerUid }) {
      state.activePrincipalUid = activeUid || null;
      state.managerUid = managerUid || null;
      // Persist per-tab for continuity across reloads
      try {
        sessionStorage.setItem('active_principal_uid', state.activePrincipalUid || '');
        sessionStorage.setItem('manager_uid', state.managerUid || '');
      } catch (_) {}
    },
    SET_MANAGED_USERS(state, users) { state.managedUsers = Array.isArray(users) ? users : []; },
    SET_AUTH_READY(state, ready) {
      state.authReady = ready;
    },
    SET_MANAGER_SNAPSHOT(state, snapshot) {
      state.managerSnapshot = snapshot || null;
      try {
        if (snapshot) {
          sessionStorage.setItem('manager_snapshot_uid', snapshot.uid || '');
          sessionStorage.setItem('manager_snapshot_display_name', snapshot.display_name || '');
          sessionStorage.setItem('manager_snapshot_user_tag', snapshot.user_tag || '');
        } else {
          sessionStorage.removeItem('manager_snapshot_uid');
          sessionStorage.removeItem('manager_snapshot_display_name');
          sessionStorage.removeItem('manager_snapshot_user_tag');
        }
      } catch (_) {}
    }
  },
  
  actions: {
    // Internal helper to consistently clear local auth state
    _clearLocalAuth({ commit }) {
      try { WebSocketService.cleanup(); } catch (e) {}
      try { TokenManager.accessToken = null; } catch (e) {}
      // refresh token is now in httpOnly cookie; nothing to clear in JS
      try { sessionStorage.removeItem('active_principal_uid'); sessionStorage.removeItem('manager_uid'); } catch (_) {}
      commit('SET_USER', null);
      commit('SET_MANAGER_SNAPSHOT', null);
      commit('SET_AUTH_READY', true);
    },
    async initAuth({ state, commit, dispatch }) {
      try {
        // Dedupe concurrent init calls (e.g., router guard + main.js during HMR)
        if (state._initInFlight) {
          return await state._initInFlight;
        }
        const initPromise = (async () => {
        try { console.log('[AUTH][initAuth] start', { path: typeof window !== 'undefined' ? window.location.pathname : undefined }); } catch (_) {}
        // Restore principal ids per-tab early for UI hints
        try {
          const ap = sessionStorage.getItem('active_principal_uid') || '';
          const mu = sessionStorage.getItem('manager_uid') || '';
          if (ap || mu) commit('SET_ACTIVE_AND_MANAGER_UIDS', { activeUid: ap || null, managerUid: mu || ap || null });
          const ms_uid = sessionStorage.getItem('manager_snapshot_uid') || '';
          const ms_dn = sessionStorage.getItem('manager_snapshot_display_name') || '';
          const ms_tag = sessionStorage.getItem('manager_snapshot_user_tag') || '';
          if (ms_uid || ms_dn || ms_tag) commit('SET_MANAGER_SNAPSHOT', { uid: ms_uid || null, display_name: ms_dn || null, user_tag: ms_tag || null });
        } catch (_) {}
        const token = TokenManager.accessToken;
        if (!token) {
          // Attempt proactive refresh using httpOnly cookie
          const corrId = `auth_init_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
          try { console.warn('[AUTH][initAuth] no access; attempting proactive refresh', { corrId }); } catch (_) {}
          const newAccess = await TokenManager.refreshAccessToken({ initiator: 'auth_init', corrId, reason: 'no_access_token' });
          if (newAccess) {
            try { console.log('[AUTH][initAuth] proactive refresh succeeded', { corrId }); } catch (_) {}
            await dispatch('validateExistingToken');
          } else {
            try { console.warn('[AUTH][initAuth] proactive refresh failed', { corrId }); } catch (_) {}
            commit('SET_USER', null);
          }
          commit('SET_AUTH_READY', true);
          return;
        }
        try { console.log('[AUTH][initAuth] access token present, validating'); } catch (_) {}
        await dispatch('validateExistingToken');
      })();
        // Record in-flight to avoid overlapping work
        state._initInFlight = initPromise;
        await initPromise;
      } catch (error) {
        console.error('Auth initialization failed:', error);
        commit('SET_USER', null);
      } finally {
        commit('SET_AUTH_READY', true);
        // Clear in-flight marker
        state._initInFlight = null;
      }
    },

    async deleteOwnAccount({ commit, dispatch }) {
      try {
        console.warn('[AUTH] Deleting own account: initiating');
        const resp = await apiClient.delete('/users/me');
        if (!resp || resp.status < 200 || resp.status >= 300) {
          const data = (resp && resp.data) || {};
          throw new Error(data.detail || 'Failed to delete account');
        }

        // Cleanup local state and tokens
        console.warn('[AUTH] Account deleted successfully; clearing local auth state and redirecting');
        await dispatch('_clearLocalAuth');

        // Redirect to history page
        if (window.location.pathname !== '/history') {
          window.location.href = '/history';
        }
        return { success: true };
      } catch (e) {
        console.error('[AUTH] Delete account failed', e);
        throw e;
      }
    },

    async validateExistingToken({ commit, dispatch }) {
      const corrId = `auth_me_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
      try {
        const token = TokenManager.accessToken;
        if (!token) { commit('SET_USER', null); commit('SET_ACTIVE_AND_MANAGER_UIDS', { activeUid: null, managerUid: null }); return; }
        // Single call; axios interceptor handles 401 -> refresh -> retry
        try { console.log('[AUTH][validateExistingToken] GET /users/me', { corrId }); } catch (_) {}
        const response = await apiClient.get('/users/me', { corrId, _initiator: 'auth_validate' });
        const userData = response && response.data ? response.data : {};
        try { console.log('[AUTH][validateExistingToken] /users/me success', { corrId, uid: userData && userData.uid }); } catch (_) {}
        commit('SET_USER', mapApiUserToAuthState(userData));
        // Derive principal ids from token claims: sub and act.sub
        try {
          const claims = TokenManager.decodeJwt(token) || {};
          const activeUid = claims && claims.sub ? claims.sub : (userData && userData.uid);
          const managerUid = (claims && claims.act && claims.act.sub) ? claims.act.sub : activeUid;
          commit('SET_ACTIVE_AND_MANAGER_UIDS', { activeUid, managerUid });
          if (activeUid && managerUid && activeUid === managerUid) {
            commit('SET_MANAGER_SNAPSHOT', { uid: userData && userData.uid, display_name: userData && userData.display_name, user_tag: userData && userData.user_tag });
          }
        } catch (_) {
          commit('SET_ACTIVE_AND_MANAGER_UIDS', { activeUid: (userData && userData.uid) || null, managerUid: (userData && userData.uid) || null });
          commit('SET_MANAGER_SNAPSHOT', { uid: userData && userData.uid, display_name: userData && userData.display_name, user_tag: userData && userData.user_tag });
        }
        // Opportunistically refresh managed users list
        try { await dispatch('fetchManagedUsers'); } catch (_) {}
        try {
          await WebSocketService.initialize();
        } catch (e) {
          console.error('[AUTH STORE] WebSocket init failed:', e);
        }
      } catch (error) {
        try { console.error('[AUTH] Token validation threw error; clearing tokens and user', { corrId, message: error && error.message, status: error && error.response && error.response.status }); } catch (_) { console.error('[AUTH] Token validation threw error; clearing tokens and user', error); }
        TokenManager.accessToken = null;
        commit('SET_USER', null);
        commit('SET_ACTIVE_AND_MANAGER_UIDS', { activeUid: null, managerUid: null });
        WebSocketService.cleanup();
      }
    },
    async switchPrincipal({ commit, dispatch }, { managedUid, requested_scopes = 'msg.read msg.write ws', aud = 'public-v1' }) {
      if (!managedUid) throw new Error('managed_uid_required');
      try {
        // Proactively rotate to ensure we use the latest manager refresh
        try { await TokenManager.refreshAccessToken({ initiator: 'auth_switchPrincipal' }); } catch (_) {}
        // Capture manager snapshot from current user before switching
        try {
          const cur = this.state.auth.user;
          if (cur) commit('SET_MANAGER_SNAPSHOT', { uid: cur.uid, display_name: cur.displayName, user_tag: cur.user_tag });
        } catch (_) {}
        // Manager refresh token sent via httpOnly cookie; backup not available in JS anymore
        WebSocketService.cleanup();
        let device_id = null;
        try { device_id = (TokenManager._ensureDeviceId && TokenManager._ensureDeviceId()) || null; } catch (_) { device_id = null; }
        const payload = { managed_uid: managedUid, requested_scopes, aud, device_id };
        const resp = await apiClient.post('/managed/auth/switch', payload, { headers: { 'Content-Type': 'application/json' }, _noRefreshRetry: true, withCredentials: true });
        const data = resp && resp.data ? resp.data : {};
        if (!data.access_token) throw new Error('switch_failed');
        TokenManager.accessToken = data.access_token;
        // Manager backup refresh is stored in httpOnly cookie by server
        try {
          const claims = TokenManager.decodeJwt(data.access_token) || {};
          const activeUid = claims && claims.sub ? claims.sub : null;
          const managerUid = (claims && claims.act && claims.act.sub) ? claims.act.sub : activeUid;
          commit('SET_ACTIVE_AND_MANAGER_UIDS', { activeUid, managerUid });
        } catch (_) {}
        // Clear message cache when switching principals to prevent stale state bleed-through
        try { await dispatch('messages/clearCache', {}, { root: true }); } catch (_) {}
        await dispatch('validateExistingToken');
        return { success: true };
      } catch (e) {
        console.error('[AUTH] switchPrincipal failed', e);
        throw e;
      }
    },
    async returnToSelf({ commit, dispatch }, { requested_scopes = 'msg.read msg.write ws', aud = 'public-v1' } = {}) {
      try {
        WebSocketService.cleanup();
        let device_id = null;
        try { device_id = (TokenManager._ensureDeviceId && TokenManager._ensureDeviceId()) || null; } catch (_) { device_id = null; }
        const payload = { requested_scopes, aud, device_id };
        const resp = await apiClient.post('/managed/auth/return_to_self', payload, { headers: { 'Content-Type': 'application/json' }, _noRefreshRetry: true, withCredentials: true });
        const data = resp && resp.data ? resp.data : {};
        if (!data.access_token) throw new Error('return_to_self_failed');
        TokenManager.accessToken = data.access_token;
        // Manager backup cookie cleared by server
        try {
          const claims = TokenManager.decodeJwt(data.access_token) || {};
          const activeUid = claims && claims.sub ? claims.sub : null;
          const managerUid = (claims && claims.act && claims.act.sub) ? claims.act.sub : activeUid;
          commit('SET_ACTIVE_AND_MANAGER_UIDS', { activeUid, managerUid });
        } catch (_) {}
        // Clear message cache when returning to self to ensure fresh view
        try { await dispatch('messages/clearCache', {}, { root: true }); } catch (_) {}
        await dispatch('validateExistingToken');
        return { success: true };
      } catch (e) {
        console.error('[AUTH] returnToSelf failed', e);
        throw e;
      }
    },
    async fetchManagedUsers({ commit }) {
      try {
        const token = TokenManager.accessToken;
        if (!token) { commit('SET_MANAGED_USERS', []); return []; }
        const resp = await apiClient.get('/managed/users', { headers: { 'Authorization': `Bearer ${token}` } });
        const users = (resp && resp.data && (resp.data.users || resp.data || [])) || [];
        commit('SET_MANAGED_USERS', users);
        return users;
      } catch (e) {
        console.error('[AUTH] fetchManagedUsers failed', e);
        commit('SET_MANAGED_USERS', []);
        return [];
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
        const response = await apiClient.get(`/users/search?query=${encodeURIComponent(query)}&limit=15`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = response && response.data ? response.data : {};
        return data.users || [];
      } catch (error) {
        console.error('Error searching users:', error);
        return [];
      }
    },

    async convertToManagedUser({ commit, dispatch }, { uid, managerUid }) {
      try {
        const token = TokenManager.accessToken;
        const response = await apiClient.post(`/managed/users/${uid}/convert-to-managed`, 
          { manager_uid: managerUid },
          { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
        if (!response || response.status < 200 || response.status >= 300) {
          const errorData = (response && response.data) || {};
          throw new Error(errorData.detail || 'Failed to convert to managed user');
        }
        // Refresh user data after conversion
        await dispatch('validateExistingToken');
        return response.data;
      } catch (error) {
        console.error('Error converting to managed user:', error);
        const errorData = error && error.response && error.response.data ? error.response.data : {};
        const detail = errorData.detail || error.message || 'Failed to convert to managed user';
        throw new Error(detail);
      }
    },


    async updateProfile({ commit }, profileData) {
      try {
        const response = await apiClient.post('/users/profile', profileData, { headers: { 'Content-Type': 'application/json' } });
        if (!response || response.status < 200 || response.status >= 300) {
          const errorData = (response && response.data) || {};
          throw new Error(errorData.detail || 'Failed to update profile');
        }
        const result = response.data;

        // Immediately refresh full user state (including contacts/notify flags) from /me
        try {
          const meResp = await apiClient.get('/users/me');
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
              bio: typeof result.profile.bio === 'string' ? result.profile.bio : '',
              is_bot: typeof result.profile.is_bot === 'boolean' ? result.profile.is_bot : !!currentUser.is_bot,
              input_modalities: typeof result.profile.input_modalities === 'string' ? result.profile.input_modalities : null,
              output_modalities: typeof result.profile.output_modalities === 'string' ? result.profile.output_modalities : null,
              third_party_integrations: typeof result.profile.third_party_integrations === 'string' ? result.profile.third_party_integrations : null,
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

    async createManagedUser({ dispatch }, { display_name, user_tag, endpoints, scopes = 'msg.read msg.write ws', private: isPrivate = false }) {
      try {
        const payload = { display_name, user_tag, scopes, private: !!isPrivate };
        if (Array.isArray(endpoints)) payload.endpoints = endpoints;
        
        // Log what we're sending
        console.log('[AUTH] createManagedUser payload:', { display_name, user_tag, scopes, private: !!isPrivate });
        const resp = await apiClient.post('/managed/users', payload, {
          headers: { 'Content-Type': 'application/json' }
        });
        if (!resp || resp.status < 200 || resp.status >= 300) {
          const data = (resp && resp.data) || {};
          throw new Error(data.detail || 'failed_to_create_managed_user');
        }
        // Refresh managed users list
        try { await dispatch('fetchManagedUsers'); } catch (_) {}
        return resp.data;
      } catch (error) {
        try {
          const status = error?.response?.status;
          const detail = error?.response?.data?.detail;
          if (status === 409 && typeof detail === 'string' && detail) {
            throw new Error(detail);
          }
          if (status && detail) {
            throw new Error(detail);
          }
        } catch (_) {}
        throw error;
      }
    },

    async fetchManagersForUser({ state }, uid) {
      try {
        const resp = await apiClient.get(`/managed/users/${uid}/managers`);
        if (!resp || resp.status < 200 || resp.status >= 300) {
          const data = (resp && resp.data) || {};
          throw new Error(data.detail || 'failed_to_fetch_managers');
        }
        return resp.data.managers || [];
      } catch (error) {
        const status = error?.response?.status;
        const detail = error?.response?.data?.detail;
        if (status && detail) {
          throw new Error(detail);
        }
        throw error;
      }
    },

    async addManagerToUser({ state }, { uid, managerUid }) {
      try {
        const payload = { manager_uid: managerUid };
        const resp = await apiClient.post(`/managed/users/${uid}/managers`, payload, {
          headers: { 'Content-Type': 'application/json' }
        });
        if (!resp || resp.status < 200 || resp.status >= 300) {
          const data = (resp && resp.data) || {};
          throw new Error(data.detail || 'failed_to_add_manager');
        }
        return resp.data;
      } catch (error) {
        const status = error?.response?.status;
        const detail = error?.response?.data?.detail;
        if (status && detail) {
          throw new Error(detail);
        }
        throw error;
      }
    },

    async removeManagerFromUser({ state }, { uid, managerUid }) {
      try {
        const resp = await apiClient.delete(`/managed/users/${uid}/managers/${managerUid}`);
        if (!resp || resp.status < 200 || resp.status >= 300) {
          const data = (resp && resp.data) || {};
          throw new Error(data.detail || 'failed_to_remove_manager');
        }
        return resp.data;
      } catch (error) {
        const status = error?.response?.status;
        const detail = error?.response?.data?.detail;
        if (status && detail) {
          throw new Error(detail);
        }
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
        
        // Redirect to the history page
        if (window.location.pathname !== '/history') {
          console.warn('[AUTH] Redirecting to /history from', window.location.pathname);
          // Use Vue router if available, otherwise fall back to hard redirect
          if (router) {
            console.info('[AUTH] Using Vue router to navigate');
            router.push('/history');
          } else {
            console.info('[AUTH] Using hard redirect');
            window.location.href = '/history';
          }
        } else {
          console.info('[AUTH] Already on /history, no redirect needed');
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
    managedUsers: state => state.managedUsers,
    activePrincipalUid: state => state.activePrincipalUid || (state.user && state.user.uid) || null,
    managerUid: state => state.managerUid || (state.user && state.user.uid) || null,
    // Scopes helpers
    scopesSet: state => parseScopes(state.user ? state.user.scopes : ''),
    hasScope: state => (name) => state.user ? hasPermUtil(state.user, name, TokenManager.accessToken) : false,
    hasAnyScope: state => (names) => state.user ? hasAnyPermUtil(state.user, names, TokenManager.accessToken) : false,

    // Common role-style flags derived from scopes
    isAdmin: (state) => isAdminUtil(state.user, TokenManager.accessToken),
    isApiAllowed: (state) => !!(state.user && state.user.has_api_access),
    // Interaction capability: can the user create/write messages
    canInteract: (state, getters) => getters.hasAnyScope(['msg.write', 'admin']),

    // Capability predicates
    canDeleteMessage: (state, getters) => (message) => {
      if (!state.user || !message) return false;
      if (getters.hasScope('admin')) return true;
      if (!getters.hasScope('msg.write')) return false;
      const currentUid = state.user.uid;
      const currentTag = state.user.user_tag || null;
      // Check if user is the author
      const isAuthorByUid = (message.content_author && message.content_author === currentUid) ||
                            (message.author && message.author.uid && message.author.uid === currentUid);
      const isAuthorByTag = currentTag && message.author_user_tag && message.author_user_tag === currentTag;
      if (isAuthorByUid || isAuthorByTag) return true;
      // Check if user is a manager of the message author
      const messageAuthorUid = message.content_author || (message.author && message.author.uid);
      if (messageAuthorUid && state.managedUsers && Array.isArray(state.managedUsers)) {
        const isManager = state.managedUsers.some(managedUser => {
          const managedUid = managedUser.uid || managedUser.id || managedUser._key;
          return managedUid === messageAuthorUid;
        });
        if (isManager) return true;
      }
      return false;
    },
    canUpdateReplyOrder: (state, getters) => (message) => {
      if (!state.user || !message) return false;
      if (!getters.hasScope('msg.write')) return false;
      const currentUid = state.user.uid;
      const currentTag = state.user.user_tag || null;
      // Check if user is the author
      const isAuthorByUid = (message.content_author && message.content_author === currentUid) ||
                            (message.author && message.author.uid && message.author.uid === currentUid);
      const isAuthorByTag = currentTag && message.author_user_tag && message.author_user_tag === currentTag;
      if (isAuthorByUid || isAuthorByTag) return true;
      // Check if user is a manager of the message author
      const messageAuthorUid = message.content_author || (message.author && message.author.uid);
      if (messageAuthorUid && state.managedUsers && Array.isArray(state.managedUsers)) {
        const isManager = state.managedUsers.some(managedUser => {
          const managedUid = managedUser.uid || managedUser.id || managedUser._key;
          return managedUid === messageAuthorUid;
        });
        if (isManager) return true;
      }
      return false;
    },
    canUpdateMessagePublicity: (state, getters) => (message) => {
      if (!state.user || !message) return false;
      if (!getters.hasScope('msg.write')) return false;
      const currentUid = state.user.uid;
      const currentTag = state.user.user_tag || null;
      // Check if user is the author
      const isAuthorByUid = (message.content_author && message.content_author === currentUid) ||
                            (message.author && message.author.uid && message.author.uid === currentUid);
      const isAuthorByTag = currentTag && message.author_user_tag && message.author_user_tag === currentTag;
      if (isAuthorByUid || isAuthorByTag) return true;
      // Check if user is a manager of the message author
      const messageAuthorUid = message.content_author || (message.author && message.author.uid);
      if (messageAuthorUid && state.managedUsers && Array.isArray(state.managedUsers)) {
        const isManager = state.managedUsers.some(managedUser => {
          const managedUid = managedUser.uid || managedUser.id || managedUser._key;
          return managedUid === messageAuthorUid;
        });
        if (isManager) return true;
      }
      return false;
    },
  }
}
