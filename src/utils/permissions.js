/** @deprecated Prefer `@/auth/can` and `@/auth/constants`. Thin re-export for legacy imports. */
export { can as hasPermission, canAny as hasAnyPermission, isAdmin } from '../auth/can.js'
export { parsePermissions as parseScopes, normalizePermission } from '../auth/constants.js'

/** @deprecated Authorization is session-only. Prefer `@/auth/can`. */
export function getEffectivePermissions(_user, _accessToken) {
  return new Set()
}

export function parseJwtPayload() {
  return null
}
