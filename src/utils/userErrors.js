import { normalizeError } from './error.js'

/**
 * The two user-facing error paths.
 *
 * persistent: a bar across the bottom of the screen. It stays until the
 * user dismisses it. Use this when the failure leaves the screen empty or
 * the user would miss it if it vanished.
 *
 * otherwise: the existing toast, which dismisses itself. Use this when the
 * screen is still usable and the failure is about one action.
 *
 * Errors that belong inside a form (registration, login) stay in that form
 * and should not come through here.
 */
export function reportError(store, error, options = {}) {
  const normalized = normalizeError(error, options.fallback || 'Something went wrong')
  if (options.message) normalized.message = options.message
  if (options.code) normalized.code = options.code
  const commitOptions = options.root ? { root: true } : undefined
  if (options.persistent) {
    store.commit('ui/SET_PERSISTENT_ERROR', normalized, commitOptions)
  } else {
    store.commit('ui/SET_ERROR', normalized, commitOptions)
  }
  return normalized
}

export function dismissPersistentError(store) {
  store.commit('ui/CLEAR_PERSISTENT_ERROR')
}
