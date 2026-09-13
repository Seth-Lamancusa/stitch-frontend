/** @deprecated Prefer `@/auth/can` and `@/auth/constants`. Thin re-export for legacy imports. */
export { can as hasPermission, canAny as hasAnyPermission, isAdmin } from '../auth/can.js'
export { parsePermissions as parseScopes, normalizePermission } from '../auth/constants.js'

export function getEffectivePermissions(user, _accessToken) {
  if (Array.isArray(user?.permissions) && user.permissions.length) {
    return new Set(user.permissions)
  }
  if (typeof user?.scopes === 'string') {
    return new Set(user.scopes.split(/\s+/).filter(Boolean))
  }
  return new Set()
}

export function parseJwtPayload() {
  return null
}
