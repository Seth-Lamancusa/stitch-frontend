import { computed } from 'vue'
import { useStore } from 'vuex'

// Centralized permissions composable built on top of auth store getters
// Usage:
// const { can, canAny, isAdmin, user, authReady } = usePermissions()
export function usePermissions() {
  const store = useStore()

  const user = computed(() => store.getters['auth/user'])
  const authReady = computed(() => store.getters['auth/authReady'])
  const isAdmin = computed(() => store.getters['auth/isAdmin'])

  const can = (scopeName) => {
    if (!scopeName) return false
    return store.getters['auth/hasScope'](scopeName)
  }

  const canAny = (scopeNames) => {
    if (!Array.isArray(scopeNames) || scopeNames.length === 0) return false
    return store.getters['auth/hasAnyScope'](scopeNames)
  }

  return {
    user,
    authReady,
    isAdmin,
    can,
    canAny,
  }
}


