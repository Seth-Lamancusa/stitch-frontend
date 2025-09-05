import store from '../store';
import TokenManager from './TokenManager';

/**
 * Install a 401 -> refresh token -> retry once interceptor on an axios instance.
 * On refresh failure, forces logout.
 */
export function installAxiosAuthInterceptor(axiosInstance) {
  if (!axiosInstance || !axiosInstance.interceptors) return;

  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const status = error?.response?.status;
      const originalRequest = error?.config || {};

      // If not unauthorized, or already retried, just propagate
      if (status !== 401 || originalRequest._retry) {
        return Promise.reject(error);
      }

      // Mark to avoid infinite loops
      originalRequest._retry = true;

      // Attempt refresh
      try {
        const tokenBefore = TokenManager.accessToken;
        const newAccess = await TokenManager.refreshAccessToken();
        if (!newAccess) {
          // If another caller refreshed and rotated tokens, retry with the updated token
          const tokenAfter = TokenManager.accessToken;
          if (tokenAfter && tokenAfter !== tokenBefore) {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers['Authorization'] = `Bearer ${tokenAfter}`;
            return axiosInstance.request(originalRequest);
          }
          await store.dispatch('auth/forceLogoutWithMessage');
          return Promise.reject(error);
        }

        // Ensure Authorization header is set with the new token
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers['Authorization'] = `Bearer ${newAccess}`;

        // Retry the original request
        return axiosInstance.request(originalRequest);
      } catch (e) {
        try { await store.dispatch('auth/forceLogoutWithMessage'); } catch {}
        return Promise.reject(error);
      }
    }
  );
}


