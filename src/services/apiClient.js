import axios from 'axios'
import store from '../store'
import TokenManager from './TokenManager'
import logger from './logger'

// Guard symbol to avoid duplicate interceptor installation during HMR
const AUTH_INTERCEPTOR_INSTALLED = Symbol.for('stitch.authInterceptorInstalled')

// Install a 401 -> refresh token -> retry once interceptor on an axios instance.
export function installAxiosAuthInterceptor(axiosInstance) {
  if (!axiosInstance || !axiosInstance.interceptors) return;
  try {
    if (axiosInstance[AUTH_INTERCEPTOR_INSTALLED]) {
      return;
    }
    // Mark as installed to prevent stacking interceptors in dev/HMR
    Object.defineProperty(axiosInstance, AUTH_INTERCEPTOR_INSTALLED, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false
    });
  } catch (_) {}

  // Stamp start time for duration metrics
  axiosInstance.interceptors.request.use((config) => {
    try { config.metadata = { start: Date.now() }; } catch (_) {}
    // Attach Authorization header just-in-time from TokenManager unless explicitly skipped
    try {
      if (!config._skipAuth) {
        const token = TokenManager.accessToken;
        if (token) {
          config.headers = config.headers || {};
          if (!config.headers['Authorization']) {
            config.headers['Authorization'] = `Bearer ${token}`;
          }
        }
      }
    } catch (_) {}
    return config;
  });

  axiosInstance.interceptors.response.use(
    (response) => {
      try {
        const started = response?.config?.metadata?.start || Date.now();
        const durationMs = Date.now() - started;
        const method = (response?.config?.method || 'get').toUpperCase();
        const url = response?.config?.url || '';
        const status = response?.status;
        logger.info(`HTTP ${method} ${url} -> ${status} in ${durationMs}ms`);
      } catch (_) {}
      return response;
    },
    async (error) => {
      const status = error?.response?.status;
      const originalRequest = error?.config || {};

      try {
        const started = originalRequest?.metadata?.start || Date.now();
        const durationMs = Date.now() - started;
        const method = (originalRequest?.method || 'get').toUpperCase();
        const url = originalRequest?.url || '';
        logger.warn(`HTTP ${method} ${url} -> ${status || 'ERR'} in ${durationMs}ms`);
      } catch (_) {}

      // If not unauthorized, or already retried, just propagate
      if (status !== 401 || originalRequest._retry) {
        return Promise.reject(error);
      }

      // Mark to avoid infinite loops
      originalRequest._retry = true;

      // Attempt refresh
      try {
        const tokenBefore = TokenManager.accessToken;
        try { logger.warn('[AUTH][axios] 401 detected; attempting refresh', { url: originalRequest?.url }); } catch (_) {}
        const newAccess = await TokenManager.refreshAccessToken();
        if (!newAccess) {
          // If another caller refreshed and rotated tokens, retry with the updated token
          const tokenAfter = TokenManager.accessToken;
          if (tokenAfter && tokenAfter !== tokenBefore) {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers['Authorization'] = `Bearer ${tokenAfter}`;
            try { logger.info('[AUTH][axios] retrying after peer refresh', { url: originalRequest?.url }); } catch (_) {}
            return axiosInstance.request(originalRequest);
          }
          try { logger.error('[AUTH][axios] refresh failed; forcing logout', { url: originalRequest?.url }); } catch (_) {}
          await store.dispatch('auth/forceLogoutWithMessage');
          return Promise.reject(error);
        }

        // Ensure Authorization header is set with the new token
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers['Authorization'] = `Bearer ${newAccess}`;

        // Retry the original request
        try { logger.info('[AUTH][axios] retrying request with new token', { url: originalRequest?.url }); } catch (_) {}
        return axiosInstance.request(originalRequest);
      } catch (e) {
        try { logger.error('[AUTH][axios] error during refresh or retry; forcing logout', { url: originalRequest?.url, message: e?.message }); } catch (_) {}
        try { await store.dispatch('auth/forceLogoutWithMessage'); } catch {}
        return Promise.reject(error);
      }
    }
  );
}

// Centralized Axios client for public SPA
const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

installAxiosAuthInterceptor(apiClient)

export default apiClient
