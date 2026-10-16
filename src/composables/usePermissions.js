import { computed } from 'vue'
import { useStore } from 'vuex'
import { P } from '../auth/constants.js'

/**
 * Centralized permissions composable (UX hints only).
 * Usage: const { can, canAny, isAdmin, user, authReady, P } = usePermissions()
 */
export function usePermissions() {
  const store = useStore()

  const user = computed(() => store.getters['auth/user'])
  const authReady = computed(() => store.getters['auth/authReady'])
  const isAdmin = computed(() => store.getters['auth/isAdmin'])

  const can = (permissionName) => {
    if (!permissionName) return false
    return store.getters['auth/hasScope'](permissionName)
  }

  const canAny = (permissionNames) => {
    if (!Array.isArray(permissionNames) || permissionNames.length === 0) return false
    return store.getters['auth/hasAnyScope'](permissionNames)
  }

  return {
    user,
    authReady,
    isAdmin,
    can,
    canAny,
    P,
  }
}
