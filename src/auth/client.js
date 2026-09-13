/**
 * AuthClient — only module that talks to /v1/auth/* for session lifecycle.
 *
 * Browser credential is the HttpOnly `stitch_session` cookie.
 * Response bodies may still include `access_token` (opaque st_session_…) for
 * non-browser clients; this SPA ignores it and never stores credentials.
 */

import axios from 'axios'
import { parsePermissions } from './constants.js'

const AUTH_BASE = '/v1/auth'

function deviceId() {
  try {
    const key = 'device_id'
    let id = localStorage.getItem(key)
    if (!id) {
      id = (crypto?.randomUUID?.()) || `dev-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(key, id)
    }
    return id
  } catch (_) {
    return `dev-${Math.random().toString(36).slice(2)}`
  }
}

function mapSessionDto(data) {
  if (!data || typeof data !== 'object') return null
  const actor = data.actor || null
  const subject = data.subject || null
  const rawPermissions =
    (Array.isArray(data.permissions) && data.permissions.length)
      ? data.permissions
      : (typeof data.permissions === 'string' && data.permissions.trim()
          ? data.permissions
          : (data.scope || data.scopes || []))
  const permissions = parsePermissions(rawPermissions)
  return {
    status: 'authenticated',
    sessionId: data.session_id || null,
    expiresAt: data.expires_at || null,
    actor: actor
      ? {
          id: actor.id || actor.uid || null,
          displayName: actor.display_name ?? actor.displayName ?? null,
          userTag: actor.user_tag ?? actor.userTag ?? null,
        }
      : null,
    subject: subject
      ? {
          id: subject.id || subject.uid || null,
          displayName: subject.display_name ?? subject.displayName ?? null,
          userTag: subject.user_tag ?? subject.userTag ?? null,
        }
      : null,
    permissions,
    delegated: !!(data.delegated ?? (actor && subject && (actor.id || actor.uid) !== (subject.id || subject.uid))),
  }
}

function anonymousState() {
  return {
    status: 'anonymous',
    sessionId: null,
    expiresAt: null,
    actor: null,
    subject: null,
    permissions: [],
    delegated: false,
  }
}

class AuthClient {
  constructor() {
    this._http = axios.create({
      baseURL: AUTH_BASE,
      timeout: 15000,
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  /**
   * GET /auth/session — authoritative restore.
   * @returns {Promise<object>} AuthState
   */
  async restoreSession() {
    try {
      const resp = await this._http.get('/session')
      const mapped = mapSessionDto(resp?.data)
      return mapped || anonymousState()
    } catch (e) {
      const status = e?.response?.status
      if (status === 401 || status === 403) return anonymousState()
      throw e
    }
  }

  /**
   * POST /auth/password/login — sets cookie; then restoreSession for metadata.
   * Throws if the cookie did not stick (e.g. Secure cookie on plain HTTP without override).
   */
  async login(identifier, password) {
    await this._http.post('/password/login', {
      identifier,
      password,
      device_id: deviceId(),
    })
    // Ignore access_token in body — cookie is the browser credential.
    const session = await this.restoreSession()
    if (!session || session.status !== 'authenticated') {
      throw new Error('session_cookie_missing')
    }
    return session
  }

  async logout() {
    try {
      await this._http.post('/logout', {})
    } catch (_) {
      // Idempotent; clear local state regardless
    }
    return anonymousState()
  }

  /**
   * POST /auth/act-as/{subjectId}
   */
  async actAs(subjectId) {
    if (!subjectId) throw new Error('subject_id_required')
    await this._http.post(`/act-as/${encodeURIComponent(subjectId)}`, {
      device_id: deviceId(),
    })
    const session = await this.restoreSession()
    if (!session || session.status !== 'authenticated') {
      throw new Error('session_cookie_missing')
    }
    return session
  }

  /**
   * POST /auth/act-as/return — restore manager session from backup cookie.
   */
  async actAsSelf() {
    await this._http.post('/act-as/return', {
      device_id: deviceId(),
    })
    const session = await this.restoreSession()
    if (!session || session.status !== 'authenticated') {
      throw new Error('session_cookie_missing')
    }
    return session
  }

  /**
   * Optional session rotate/extend. Cookie-only; ignore returned token.
   */
  async refresh() {
    try {
      await this._http.post('/sessions/refresh', { device_id: deviceId() })
      return this.restoreSession()
    } catch (e) {
      const status = e?.response?.status
      if (status === 401 || status === 400) return anonymousState()
      throw e
    }
  }

  /** Stable non-secret device id for session binding. */
  deviceId() {
    return deviceId()
  }
}

export const authClient = new AuthClient()
export { mapSessionDto, anonymousState, deviceId }
export default authClient
