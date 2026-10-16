/**
 * Axios credential wiring for cookie sessions.
 * - Always send cookies (withCredentials)
 * - Never attach Authorization Bearer in the SPA
 * - On 401: restore session once; if still unauthenticated, force local logout
 */

import authStore from './store.js'

const AUTH_INTERCEPTOR_INSTALLED = Symbol.for('stitch.sessionAuthInterceptorInstalled')

let logoutInProgress = false

function generateCorrelationId() {
  try {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  } catch (_) {
    return 'req_unknown'
  }
}

/**
 * @param {import('axios').AxiosInstance} axiosInstance
 * @param {{ onUnauthorized?: () => Promise<void>, logger?: Console }} [options]
 */
export function installSessionAuthInterceptor(axiosInstance, options = {}) {
  if (!axiosInstance?.interceptors) return
  try {
    if (axiosInstance[AUTH_INTERCEPTOR_INSTALLED]) return
    Object.defineProperty(axiosInstance, AUTH_INTERCEPTOR_INSTALLED, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    })
  } catch (_) {}

  const logger = options.logger || console

  axiosInstance.defaults.withCredentials = true

  axiosInstance.interceptors.request.use((config) => {
    try {
      config.metadata = { start: Date.now() }
    } catch (_) {}
    try {
      config.headers = config.headers || {}
      if (!config.headers['X-Correlation-Id']) {
        const corrId = config.corrId || generateCorrelationId()
        config.headers['X-Correlation-Id'] = corrId
        config.corrId = corrId
      }
      // Strip any accidental Bearer headers — browser uses cookie only.
      if (config.headers.Authorization || config.headers.authorization) {
        delete config.headers.Authorization
        delete config.headers.authorization
      }
    } catch (_) {}
    return config
  })

  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const status = error?.response?.status
      const originalRequest = error?.config || {}

      if (status !== 401 || originalRequest._retry || originalRequest._noSessionRetry) {
        return Promise.reject(error)
      }

      // Auth endpoints that already failed — don't loop
      const url = String(originalRequest.url || '')
      if (url.includes('/auth/session') || url.includes('/auth/logout') || url.includes('/auth/password/login')) {
        return Promise.reject(error)
      }

      if (logoutInProgress) return Promise.reject(error)

      originalRequest._retry = true

      try {
        const ok = await authStore.restoreSession()
        if (ok) {
          return axiosInstance.request(originalRequest)
        }
      } catch (_) {}

      if (!logoutInProgress) {
        logoutInProgress = true
        try {
          if (typeof options.onUnauthorized === 'function') {
            await options.onUnauthorized()
          } else {
            authStore.clearLocal()
          }
        } finally {
          setTimeout(() => {
            logoutInProgress = false
          }, 2000)
        }
      } else {
        try {
          logger.warn?.('[AUTH] logout already in progress')
        } catch (_) {}
      }
      return Promise.reject(error)
    }
  )
}

export default installSessionAuthInterceptor
