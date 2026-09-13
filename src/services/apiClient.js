import axios from 'axios'
import { installSessionAuthInterceptor } from '../auth/http.js'
import authStore from '../auth/store.js'
import logger from './logger'

// Centralized Axios client for public SPA — cookie sessions only
const apiClient = axios.create({
  baseURL: '/v1',
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

installSessionAuthInterceptor(apiClient, {
  logger,
  onUnauthorized: async () => {
    try {
      // Dynamic import to avoid circular init with the Vuex store
      const store = (await import('../store')).default
      await store.dispatch('auth/forceLogoutWithMessage')
    } catch (_) {
      authStore.clearLocal()
    }
  },
})

// Back-compat export name used by main.js
export function installAxiosAuthInterceptor(axiosInstance) {
  installSessionAuthInterceptor(axiosInstance, {
    logger,
    onUnauthorized: async () => {
      try {
        const store = (await import('../store')).default
        await store.dispatch('auth/forceLogoutWithMessage')
      } catch (_) {
        authStore.clearLocal()
      }
    },
  })
}

export default apiClient
