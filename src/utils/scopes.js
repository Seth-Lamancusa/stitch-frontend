/** @deprecated Prefer `@/auth/constants` parsePermissions. */
export { parsePermissions as parseScopes, normalizePermission } from '../auth/constants.js'
import { parsePermissions } from '../auth/constants.js'

export function hasScope(scopes, name) {
  return parsePermissions(scopes).includes(name)
}

export function hasAnyScope(scopes, names) {
  const set = new Set(parsePermissions(scopes))
  return (names || []).some((n) => set.has(n))
}
