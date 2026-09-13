/**
 * Reactive AuthState. Permissions here are UX hints only.
 */

import { reactive, readonly } from 'vue'
import authClient, { anonymousState } from './client.js'
import { normalizePermission, parsePermissions } from './constants.js'

const state = reactive({
  status: 'bootstrapping', // bootstrapping | anonymous | authenticated | refreshing
  sessionId: null,
  expiresAt: null,
  actor: null,
  subject: null,
  permissions: [],
  delegated: false,
  /** Full subject profile from GET /users/me (not auth; convenience for UI) */
  profile: null,
  authReady: false,
})

let _initInFlight = null

function applySession(session) {
  if (!session || session.status === 'anonymous') {
    Object.assign(state, {
      ...anonymousState(),
      profile: null,
      authReady: true,
    })
    return
  }
  state.status = 'authenticated'
  state.sessionId = session.sessionId
  state.expiresAt = session.expiresAt
  state.actor = session.actor
  state.subject = session.subject
  state.permissions = Array.isArray(session.permissions) ? [...session.permissions] : []
  state.delegated = !!session.delegated
  state.authReady = true
}

function can(permission) {
  const name = normalizePermission(permission)
  if (!name) return false
  return state.permissions.includes(name)
}

function canAny(permissions) {
  if (!Array.isArray(permissions) || permissions.length === 0) return false
  return permissions.some((p) => can(p))
}

function canAll(permissions) {
  if (!Array.isArray(permissions) || permissions.length === 0) return false
  return permissions.every((p) => can(p))
}

async function restoreSession() {
  state.status = state.authReady ? 'refreshing' : 'bootstrapping'
  try {
    const session = await authClient.restoreSession()
    applySession(session)
    return state.status === 'authenticated'
  } catch (e) {
    applySession(anonymousState())
    throw e
  }
}

async function init() {
  if (_initInFlight) return _initInFlight
  _initInFlight = (async () => {
    // One-time wipe of legacy JWT access tokens from web storage
    try {
      sessionStorage.removeItem('auth_token')
      localStorage.removeItem('auth_token')
      sessionStorage.removeItem('manager_refresh_backup')
      sessionStorage.removeItem('active_principal_uid')
      sessionStorage.removeItem('manager_uid')
      sessionStorage.removeItem('manager_snapshot_uid')
      sessionStorage.removeItem('manager_snapshot_display_name')
      sessionStorage.removeItem('manager_snapshot_user_tag')
    } catch (_) {}
    try {
      await restoreSession()
    } catch (_) {
      applySession(anonymousState())
    } finally {
      state.authReady = true
      _initInFlight = null
    }
  })()
  return _initInFlight
}

async function login(identifier, password) {
  const session = await authClient.login(identifier, password)
  applySession(session)
  return session
}

async function logout() {
  const session = await authClient.logout()
  applySession(session)
  return session
}

async function actAs(subjectId) {
  const session = await authClient.actAs(subjectId)
  applySession(session)
  return session
}

async function actAsSelf() {
  const session = await authClient.actAsSelf()
  applySession(session)
  return session
}

async function refresh() {
  state.status = 'refreshing'
  const session = await authClient.refresh()
  applySession(session)
  return session
}

function setProfile(profile) {
  state.profile = profile || null
}

function clearLocal() {
  applySession(anonymousState())
}

/** Sync permissions from a profile payload that includes permissions[] / scopes */
function syncPermissionsFromProfile(profile) {
  if (!profile) return
  const fromPermissions = parsePermissions(profile.permissions)
  if (fromPermissions.length) {
    state.permissions = fromPermissions
    return
  }
  const fromScopes = parsePermissions(profile.scopes)
  if (fromScopes.length) {
    state.permissions = fromScopes
  }
}

export const authStore = {
  state: readonly(state),
  /** Mutable view for internal modules that need to patch (prefer methods). */
  _state: state,
  can,
  canAny,
  canAll,
  init,
  restoreSession,
  login,
  logout,
  actAs,
  actAsSelf,
  refresh,
  setProfile,
  clearLocal,
  syncPermissionsFromProfile,
  applySession,
}

export default authStore
