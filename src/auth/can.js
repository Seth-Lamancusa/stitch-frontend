/**
 * UX-only capability checks. Backend require() remains authoritative.
 */

import { normalizePermission } from './constants.js'
import authStore from './store.js'

export function can(permission, permissions = null) {
  const name = normalizePermission(permission)
  if (!name) return false
  if (Array.isArray(permissions)) {
    return permissions.map(normalizePermission).includes(name)
  }
  return authStore.can(name)
}

export function canAny(permissionNames, permissions = null) {
  if (!Array.isArray(permissionNames) || permissionNames.length === 0) return false
  return permissionNames.some((p) => can(p, permissions))
}

export function canAll(permissionNames, permissions = null) {
  if (!Array.isArray(permissionNames) || permissionNames.length === 0) return false
  return permissionNames.every((p) => can(p, permissions))
}

export function isAdmin(permissions = null) {
  return can('admin', permissions)
}
