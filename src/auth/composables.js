import { computed } from 'vue'
import authStore from './store.js'
import { P } from './constants.js'

/**
 * Primary UI façade for auth state and session actions.
 */
export function useAuth() {
  const status = computed(() => authStore.state.status)
  const authReady = computed(() => authStore.state.authReady)
  const isAuthenticated = computed(() => authStore.state.status === 'authenticated')
  const actor = computed(() => authStore.state.actor)
  const subject = computed(() => authStore.state.subject)
  const permissions = computed(() => authStore.state.permissions)
  const delegated = computed(() => authStore.state.delegated)
  const profile = computed(() => authStore.state.profile)
  const expiresAt = computed(() => authStore.state.expiresAt)

  return {
    status,
    authReady,
    isAuthenticated,
    actor,
    subject,
    permissions,
    delegated,
    profile,
    expiresAt,
    can: authStore.can,
    canAny: authStore.canAny,
    canAll: authStore.canAll,
    login: authStore.login,
    logout: authStore.logout,
    actAs: authStore.actAs,
    actAsSelf: authStore.actAsSelf,
    restoreSession: authStore.restoreSession,
    refresh: authStore.refresh,
    P,
  }
}

/**
 * Permission helpers for templates / components.
 */
export function useCan() {
  return {
    can: authStore.can,
    canAny: authStore.canAny,
    canAll: authStore.canAll,
    isAdmin: () => authStore.can(P.ADMIN),
    P,
  }
}
