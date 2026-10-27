import WebSocketService from '../../services/ws/WebSocketService'
import apiClient from '../../services/apiClient'
import authStore from '../../auth/store.js'
import { P, DEFAULT_MANAGED_PERMISSIONS, parsePermissions } from '../../auth/constants.js'
import { can as canPerm, canAny as canAnyPerm, isAdmin as isAdminPerm } from '../../auth/can.js'
import { resolveMessageFont } from '../../config/fonts.js'
import { getAuthorUid, isCurrentUserAuthor } from '../../utils/messageCompat.js'

/**
 * Helper: normalize API user (/users/me) to the profile shape used by UI.
 */
function mapApiUserToAuthState(userData) {
  const data = userData || {}
  const contacts = Array.isArray(data.contacts) ? data.contacts : []
  const primaryEmail = contacts.find((c) => c.type === 'email')
  const primaryEmailValue =
    primaryEmail && typeof primaryEmail.value === 'string' && primaryEmail.value.trim()
      ? primaryEmail.value
      : null
  const isEmailVerified = !!(primaryEmail && primaryEmail.verified)
  const primaryPhone = contacts.find((c) => c.type === 'phone')
  const primaryPhoneValue =
    primaryPhone && typeof primaryPhone.value === 'string' && primaryPhone.value.trim()
      ? primaryPhone.value
      : null
  const isPhoneVerified = !!(primaryPhone && primaryPhone.verified)
  return {
    uid: data.uid,
    displayName: data.display_name,
    user_tag: data.user_tag || '',
    contact: null,
    contacts,
    phone_number: primaryPhoneValue,
    email: primaryEmailValue,
    is_email_verified: isEmailVerified,
    is_phone_verified: isPhoneVerified,
    has_endpoint_signing_secret: !!data.has_endpoint_signing_secret,
    has_api_access: !!data.has_api_access,
    is_platform_tester: !!(data.is_platform_tester ?? data.is_tester),
    is_managed: !!data.is_managed,
    private: !!data.private,
    bio: typeof data.bio === 'string' ? data.bio : '',
    font: resolveMessageFont(data.font) ? String(data.font).trim() : null,
    is_bot: !!data.is_bot,
    input_modalities: typeof data.input_modalities === 'string' ? data.input_modalities : null,
    output_modalities: typeof data.output_modalities === 'string' ? data.output_modalities : null,
    available_versions: Array.isArray(data.available_versions) ? data.available_versions : null,
    third_party_integrations:
      typeof data.third_party_integrations === 'string'
        ? data.third_party_integrations
        : typeof data.foundation_provider === 'string'
          ? data.foundation_provider
          : null,
    functions: Array.isArray(data.functions)
      ? data.functions.filter((name) => typeof name === 'string' && name && !/\s/.test(name))
      : [],
    icon: typeof data.icon === 'string' && data.icon.trim() ? data.icon.trim() : null,
    context_origin_id:
      typeof data.context_origin_id === 'string' && data.context_origin_id.trim()
        ? data.context_origin_id.trim()
        : null,
  }
}

function toManagerSnapshot(u) {
  if (!u) return null
  const uid = u.uid || u.id || u._key || null
  if (!uid) return null
  return {
    uid,
    display_name: u.display_name || u.displayName || null,
    user_tag: u.user_tag || u.userTag || '',
  }
}

function snapshotUid(snapshot) {
  return (snapshot && (snapshot.uid || snapshot.id || snapshot._key)) || null
}

function vuexPermissionsFromAuthStore() {
  return parsePermissions(authStore._state.permissions || [])
}

export default {
  namespaced: true,

  state: {
    user: null,
    isAuthenticated: false,
    authReady: false,
    _initInFlight: null,
    managedUsers: [],
    // Mirrored from authStore so Vuex getters invalidate on login (not only on refresh)
    permissions: [],
    activePrincipalUid: null,
    managerUid: null,
    managerSnapshot: null,
    // Bumped on logout so keep-alive message lists cannot restore a previous session
    sessionEpoch: 0,
  },

  mutations: {
    SET_USER(state, user) {
      state.user = user
      state.isAuthenticated = !!user
    },
    SET_AUTH_READY(state, ready) {
      state.authReady = ready
    },
    SET_PERMISSIONS(state, permissions) {
      state.permissions = parsePermissions(permissions)
    },
    SET_MANAGED_USERS(state, users) {
      state.managedUsers = Array.isArray(users) ? users : []
    },
    SET_SESSION_UIDS(state, { activeUid, managerUid, managerSnapshot }) {
      state.activePrincipalUid = activeUid || null
      state.managerUid = managerUid || null
      if (managerSnapshot !== undefined) {
        state.managerSnapshot = managerSnapshot || null
      }
    },
    BUMP_SESSION_EPOCH(state) {
      state.sessionEpoch += 1
    },
    SET_MANAGER_SNAPSHOT(state, snapshot) {
      state.managerSnapshot = snapshot || null
    },
  },

  actions: {
    _syncFromAuthStore({ commit, state }) {
      const s = authStore._state
      const subjectId = s.subject?.id || null
      const actorId = s.actor?.id || null
      commit('SET_SESSION_UIDS', {
        activeUid: subjectId,
        managerUid: actorId || subjectId,
        managerSnapshot:
          actorId && subjectId && actorId !== subjectId
            ? state.managerSnapshot || {
                uid: actorId,
                display_name: s.actor?.displayName || null,
                user_tag: s.actor?.userTag || null,
              }
            : s.actor
              ? {
                  uid: actorId,
                  display_name: s.actor.displayName || null,
                  user_tag: s.actor.userTag || null,
                }
              : state.managerSnapshot,
      })
      if (s.status !== 'authenticated') {
        commit('SET_USER', null)
        commit('SET_PERMISSIONS', [])
      } else {
        commit('SET_PERMISSIONS', vuexPermissionsFromAuthStore())
      }
      commit('SET_AUTH_READY', !!s.authReady)
    },

    async _clearLocalAuth({ commit, dispatch }) {
      try {
        WebSocketService.cleanup()
      } catch (_) {}
      authStore.clearLocal()
      commit('SET_USER', null)
      commit('SET_PERMISSIONS', [])
      commit('SET_MANAGER_SNAPSHOT', null)
      commit('SET_SESSION_UIDS', { activeUid: null, managerUid: null, managerSnapshot: null })
      commit('BUMP_SESSION_EPOCH')
      commit('SET_AUTH_READY', true)
      try {
        dispatch('messages/clearCache', {}, { root: true })
      } catch (_) {}
      try {
        dispatch('navigation/clearAllListStateForLogout', null, { root: true })
      } catch (_) {}
      try {
        dispatch('speedDial/clearSpeedDial', null, { root: true })
      } catch (_) {}
    },

    async initAuth({ state, commit, dispatch }) {
      try {
        if (state._initInFlight) return await state._initInFlight
        const initPromise = (async () => {
          await authStore.init()
          await dispatch('_syncFromAuthStore')
          if (authStore._state.status === 'authenticated') {
            await dispatch('validateExistingToken')
          } else {
            commit('SET_USER', null)
            commit('SET_PERMISSIONS', [])
            commit('SET_AUTH_READY', true)
          }
        })()
        state._initInFlight = initPromise
        await initPromise
      } catch (error) {
        console.error('Auth initialization failed:', error)
        commit('SET_USER', null)
        commit('SET_PERMISSIONS', [])
      } finally {
        commit('SET_AUTH_READY', true)
        state._initInFlight = null
      }
    },

    async deleteOwnAccount({ dispatch }) {
      const resp = await apiClient.delete('/users/me')
      if (!resp || resp.status < 200 || resp.status >= 300) {
        const data = (resp && resp.data) || {}
        throw new Error(data.detail || 'Failed to delete account')
      }
      await dispatch('_clearLocalAuth')
      return { success: true }
    },

    /**
     * Load subject profile via /users/me and sync actor/subject from /auth/session.
     * Name retained for call-site compatibility.
     */
    async validateExistingToken({ commit, dispatch }) {
      try {
        // Ensure session metadata is current
        const ok = await authStore.restoreSession()
        await dispatch('_syncFromAuthStore')
        if (!ok) {
          commit('SET_USER', null)
          commit('SET_PERMISSIONS', [])
          return
        }

        const response = await apiClient.get('/users/me', { _initiator: 'auth_validate' })
        const userData = response?.data || {}
        const profile = mapApiUserToAuthState(userData)
        authStore.setProfile(profile)
        commit('SET_PERMISSIONS', vuexPermissionsFromAuthStore())
        commit('SET_USER', profile)

        const s = authStore._state
        const subjectId = s.subject?.id || profile.uid
        const actorId = s.actor?.id || subjectId
        let managerSnapshot = null
        if (actorId && subjectId && actorId === subjectId) {
          managerSnapshot = {
            uid: profile.uid,
            display_name: profile.displayName,
            user_tag: profile.user_tag,
          }
        } else if (s.actor) {
          managerSnapshot = {
            uid: actorId,
            display_name: s.actor.displayName,
            user_tag: s.actor.userTag,
          }
        }
        commit('SET_SESSION_UIDS', {
          activeUid: subjectId,
          managerUid: actorId,
          managerSnapshot,
        })
        if (managerSnapshot) commit('SET_MANAGER_SNAPSHOT', managerSnapshot)

        try {
          dispatch('speedDial/fetchSpeedDial', null, { root: true })
        } catch (_) {}
        try {
          await dispatch('fetchManagedUsers')
        } catch (_) {}
        try {
          await WebSocketService.initialize()
        } catch (e) {
          console.error('[AUTH STORE] WebSocket init failed:', e)
        }
      } catch (error) {
        console.error('[AUTH] Session validation failed; clearing local auth', error)
        await dispatch('_clearLocalAuth')
      }
    },

    async switchPrincipal({ commit, dispatch }, { managedUid }) {
      if (!managedUid) throw new Error('managed_uid_required')
      try {
        const cur = this.state.auth.user
        if (cur) {
          commit('SET_MANAGER_SNAPSHOT', {
            uid: cur.uid,
            display_name: cur.displayName,
            user_tag: cur.user_tag,
          })
        }
        WebSocketService.cleanup()
        await authStore.actAs(managedUid)
        await dispatch('_syncFromAuthStore')
        try {
          await dispatch('messages/clearCache', {}, { root: true })
        } catch (_) {}
        await dispatch('validateExistingToken')
        return { success: true }
      } catch (e) {
        console.error('[AUTH] switchPrincipal failed', e)
        throw e
      }
    },

    async returnToSelf({ dispatch }) {
      try {
        WebSocketService.cleanup()
        await authStore.actAsSelf()
        await dispatch('_syncFromAuthStore')
        try {
          await dispatch('messages/clearCache', {}, { root: true })
        } catch (_) {}
        await dispatch('validateExistingToken')
        return { success: true }
      } catch (e) {
        console.error('[AUTH] returnToSelf failed', e)
        throw e
      }
    },

    async fetchManagedUsers({ commit }) {
      try {
        if (authStore._state.status !== 'authenticated') {
          commit('SET_MANAGED_USERS', [])
          return []
        }
        const resp = await apiClient.get('/managed/users')
        const users = (resp?.data && (resp.data.users || resp.data || [])) || []
        commit('SET_MANAGED_USERS', users)
        return users
      } catch (e) {
        console.error('[AUTH] fetchManagedUsers failed', e)
        commit('SET_MANAGED_USERS', [])
        return []
      }
    },

    async signOut({ dispatch }) {
      try {
        await authStore.logout()
        await dispatch('_clearLocalAuth')
      } catch (error) {
        console.error('[AUTH] Error during sign out', error)
        await dispatch('_clearLocalAuth')
      }
    },

    async searchUsers(_, query) {
      try {
        const response = await apiClient.get(
          `/users/search?query=${encodeURIComponent(query)}&limit=15`
        )
        return response?.data?.users || []
      } catch (error) {
        console.error('Error searching users:', error)
        return []
      }
    },

    async convertToManagedUser({ dispatch }, { uid, managerUid }) {
      const response = await apiClient.post(
        `/managed/users/${uid}/convert-to-managed`,
        { manager_uid: managerUid },
        { headers: { 'Content-Type': 'application/json' } }
      )
      if (!response || response.status < 200 || response.status >= 300) {
        const errorData = (response && response.data) || {}
        throw new Error(errorData.detail || 'Failed to convert to managed user')
      }
      await dispatch('validateExistingToken')
      return response.data
    },

    async updateProfile({ commit }, profileData) {
      try {
        const response = await apiClient.post('/users/profile', profileData, {
          headers: { 'Content-Type': 'application/json' },
        })
        if (!response || response.status < 200 || response.status >= 300) {
          const errorData = (response && response.data) || {}
          throw new Error(errorData.detail || 'Failed to update profile')
        }
        const result = response.data

        try {
          const meResp = await apiClient.get('/users/me')
          if (meResp && meResp.status >= 200 && meResp.status < 300) {
            const profile = mapApiUserToAuthState(meResp.data)
            authStore.setProfile(profile)
            commit('SET_USER', profile)
          }
        } catch (_) {
          const currentUser = this.state.auth.user
          if (currentUser && result.profile) {
            commit('SET_USER', {
              ...currentUser,
              displayName: result.profile.display_name,
              user_tag: result.profile.user_tag,
              phone_number: result.profile.phone_number ?? null,
              email: result.profile.email ?? null,
              bio: typeof result.profile.bio === 'string' ? result.profile.bio : '',
              font: resolveMessageFont(result.profile.font)
                ? String(result.profile.font).trim()
                : null,
              is_bot:
                typeof result.profile.is_bot === 'boolean'
                  ? result.profile.is_bot
                  : !!currentUser.is_bot,
              input_modalities:
                typeof result.profile.input_modalities === 'string'
                  ? result.profile.input_modalities
                  : null,
              output_modalities:
                typeof result.profile.output_modalities === 'string'
                  ? result.profile.output_modalities
                  : null,
              available_versions: Array.isArray(result.profile.available_versions)
                ? result.profile.available_versions
                : null,
              third_party_integrations:
                typeof result.profile.third_party_integrations === 'string'
                  ? result.profile.third_party_integrations
                  : null,
              functions: Array.isArray(result.profile.functions)
                ? result.profile.functions.filter(
                    (name) => typeof name === 'string' && name && !/\s/.test(name)
                  )
                : [],
              icon:
                typeof result.profile.icon === 'string' && result.profile.icon.trim()
                  ? result.profile.icon.trim()
                  : null,
              context_origin_id:
                typeof result.profile.context_origin_id === 'string' &&
                result.profile.context_origin_id.trim()
                  ? result.profile.context_origin_id.trim()
                  : null,
              contact: null,
            })
          }
        }

        return result
      } catch (error) {
        try {
          const status = error?.response?.status
          const detail = error?.response?.data?.detail
          if (
            status === 409 &&
            typeof detail === 'string' &&
            [
              'user_tag_conflict',
              'email_conflict',
              'phone_conflict',
              'multiple_endpoints_not_allowed',
              'managed_contacts_endpoints_only',
            ].includes(detail)
          ) {
            throw new Error(detail)
          }
          if (status && detail) throw new Error(detail)
        } catch (inner) {
          if (inner !== error) throw inner
        }
        console.error('Error updating profile:', error)
        throw error
      }
    },

    async createManagedUser(
      { dispatch },
      {
        display_name,
        user_tag,
        endpoints,
        scopes = DEFAULT_MANAGED_PERMISSIONS,
        private: isPrivate = false,
        is_bot = false,
      }
    ) {
      try {
        const payload = {
          display_name,
          user_tag,
          scopes,
          private: !!isPrivate,
          is_bot: !!is_bot,
        }
        if (Array.isArray(endpoints)) payload.endpoints = endpoints
        const resp = await apiClient.post('/managed/users', payload, {
          headers: { 'Content-Type': 'application/json' },
        })
        if (!resp || resp.status < 200 || resp.status >= 300) {
          const data = (resp && resp.data) || {}
          throw new Error(data.detail || 'failed_to_create_managed_user')
        }
        try {
          await dispatch('fetchManagedUsers')
        } catch (_) {}
        return resp.data
      } catch (error) {
        const status = error?.response?.status
        const detail = error?.response?.data?.detail
        if (status && detail) throw new Error(detail)
        throw error
      }
    },

    async ensureManagerSnapshot({ state, commit, dispatch }, { managerUid, managedUid } = {}) {
      const manager = managerUid || state.managerUid
      if (!manager) return null
      const existing = state.managerSnapshot
      const existingUid = snapshotUid(existing)
      if (existingUid === manager && (existing.display_name || existing.user_tag)) {
        return existing
      }
      if (existingUid && existingUid !== manager) {
        commit('SET_MANAGER_SNAPSHOT', null)
      }
      const subject = managedUid || (state.user && state.user.uid)
      if (!subject) return state.managerSnapshot
      try {
        const managers = await dispatch('fetchManagersForUser', subject)
        const found = (managers || []).find((m) => (m && (m.uid || m.id || m._key)) === manager)
        const snap = toManagerSnapshot(found)
        if (snap) {
          commit('SET_MANAGER_SNAPSHOT', snap)
          return snap
        }
      } catch (e) {
        console.warn('[AUTH] ensureManagerSnapshot failed', e)
      }
      return state.managerSnapshot
    },

    async fetchManagersForUser(_, uid) {
      const resp = await apiClient.get(`/managed/users/${uid}/managers`)
      if (!resp || resp.status < 200 || resp.status >= 300) {
        const data = (resp && resp.data) || {}
        throw new Error(data.detail || 'failed_to_fetch_managers')
      }
      return resp.data.managers || []
    },

    async addManagerToUser(_, { uid, managerUid }) {
      const resp = await apiClient.post(
        `/managed/users/${uid}/managers`,
        { manager_uid: managerUid },
        { headers: { 'Content-Type': 'application/json' } }
      )
      if (!resp || resp.status < 200 || resp.status >= 300) {
        const data = (resp && resp.data) || {}
        throw new Error(data.detail || 'failed_to_add_manager')
      }
      return resp.data
    },

    async removeManagerFromUser(_, { uid, managerUid }) {
      const resp = await apiClient.delete(`/managed/users/${uid}/managers/${managerUid}`)
      if (!resp || resp.status < 200 || resp.status >= 300) {
        const data = (resp && resp.data) || {}
        throw new Error(data.detail || 'failed_to_remove_manager')
      }
      return resp.data
    },

    async forceLogoutWithMessage({ dispatch }) {
      try {
        console.warn('[AUTH] Force logout due to unauthorized session')
        try {
          await authStore.logout()
        } catch (_) {}
        await dispatch('_clearLocalAuth')
      } catch (error) {
        console.error('[AUTH] Error during force logout', error)
        await dispatch('_clearLocalAuth')
      }
    },
  },

  getters: {
    user: (state) => state.user,
    isAuthenticated: (state) => state.isAuthenticated,
    authReady: (state) => state.authReady,
    sessionEpoch: (state) => state.sessionEpoch,
    managedUsers: (state) => state.managedUsers,
    activePrincipalUid: (state) =>
      state.activePrincipalUid || (state.user && state.user.uid) || null,
    managerUid: (state) => state.managerUid || (state.user && state.user.uid) || null,
    managerSnapshot: (state, getters) => {
      const snap = state.managerSnapshot
      const manager = getters.managerUid
      if (!snap || !manager || snapshotUid(snap) !== manager) return null
      return snap
    },
    scopesSet: (state) => new Set(parsePermissions(state.permissions)),
    hasScope: (state) => {
      const perms = state.permissions
      return (name) => canPerm(name, perms)
    },
    hasAnyScope: (state) => {
      const perms = state.permissions
      return (names) => canAnyPerm(names, perms)
    },
    isAdmin: (state) => isAdminPerm(state.permissions),
    isApiAllowed: (state) => !!(state.user && state.user.has_api_access),
    canInteract: (state) => canPerm(P.MESSAGES_WRITE, state.permissions),

    canDeleteMessage: (state, getters) => (message) => {
      if (!state.user || !message) return false
      if (getters.hasScope(P.ADMIN)) return true
      if (!getters.hasScope(P.MESSAGES_WRITE)) return false
      if (isCurrentUserAuthor(message, state.user)) return true
      const messageAuthorUid = getAuthorUid(message)
      if (messageAuthorUid && state.managedUsers && Array.isArray(state.managedUsers)) {
        const isManager = state.managedUsers.some((managedUser) => {
          const managedUid = managedUser.uid || managedUser.id || managedUser._key
          return managedUid === messageAuthorUid
        })
        if (isManager) return true
      }
      return false
    },
    canUpdateReplyOrder: (state, getters) => (message) => {
      if (!state.user || !message) return false
      if (!getters.hasScope(P.MESSAGES_WRITE)) return false
      if (isCurrentUserAuthor(message, state.user)) return true
      const messageAuthorUid = getAuthorUid(message)
      if (messageAuthorUid && state.managedUsers && Array.isArray(state.managedUsers)) {
        const isManager = state.managedUsers.some((managedUser) => {
          const managedUid = managedUser.uid || managedUser.id || managedUser._key
          return managedUid === messageAuthorUid
        })
        if (isManager) return true
      }
      return false
    },
    canUpdateMessagePublicity: (state, getters) => (message) => {
      if (!state.user || !message) return false
      if (!getters.hasScope(P.MESSAGES_WRITE)) return false
      if (isCurrentUserAuthor(message, state.user)) return true
      const messageAuthorUid = getAuthorUid(message)
      if (messageAuthorUid && state.managedUsers && Array.isArray(state.managedUsers)) {
        const isManager = state.managedUsers.some((managedUser) => {
          const managedUid = managedUser.uid || managedUser.id || managedUser._key
          return managedUid === messageAuthorUid
        })
        if (isManager) return true
      }
      return false
    },
  },
}
