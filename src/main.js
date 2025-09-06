import './assets/main.css'
import './components/FormattedContent/styles.css'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import store from './store'
import TokenManager from './services/TokenManager'
import axios from 'axios'
import { installAxiosAuthInterceptor } from './services/httpClient'
import { initFormatters } from './components/FormattedContent/init'

// Minimal startup logging

// Install a global fetch wrapper to auto-refresh on 401 and retry once
function installFetchAuthInterceptor() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    // Bypass only when explicitly skipped; allow retries for all endpoints
    const url = typeof input === 'string' ? input : (input && input.url) ? input.url : '';
    if (init && init._skipAuth) return originalFetch(input, init);
    const response = await originalFetch(input, init);
    if (response && response.status !== 401) {
      return response;
    }
    if (response && response.status === 401) {
      // Avoid loops and skip for auth endpoints
      if (init && init._retry) return response;
      // If this was the refresh endpoint itself, do not attempt to refresh again
      if (url.includes('/api/auth/sessions/refresh')) return response;
      try { console.warn('[AUTH][fetch] 401 detected', { url }); } catch (_) {}
      const tokenBefore = TokenManager.accessToken;
      const newAccess = await TokenManager.refreshAccessToken();
      if (!newAccess) {
        // If another caller refreshed and rotated tokens, retry with the updated token
        const tokenAfter = TokenManager.accessToken;
        if (tokenAfter && tokenAfter !== tokenBefore) {
          try {
            const newHeaders = new Headers(init && init.headers ? init.headers : undefined);
            newHeaders.set('Authorization', `Bearer ${tokenAfter}`);
            const retryInit = { ...init, headers: newHeaders, _retry: true };
            try { console.info('[AUTH][fetch] retrying request after peer refresh', { url }); } catch (_) {}
            return await originalFetch(url || input, retryInit);
          } catch (_) {}
        }
        try {
          // Force logout if refresh truly failed and token did not change
          console.error('[AUTH][fetch] refresh failed; forcing logout', { url });
          await store.dispatch('auth/forceLogoutWithMessage');
        } catch (e) {}
        return response;
      }
      // Retry the original request with updated Authorization header
      try {
        const newHeaders = new Headers(init && init.headers ? init.headers : undefined);
        newHeaders.set('Authorization', `Bearer ${newAccess}`);
        const retryInit = { ...init, headers: newHeaders, _retry: true };
        try { console.info('[AUTH][fetch] retrying request with new token', { url }); } catch (_) {}
        return await originalFetch(url || input, retryInit);
      } catch (e) {
        return response;
      }
    }
    return response;
  };
}

// Install axios interceptor globally on the default axios instance
installAxiosAuthInterceptor(axios);

installFetchAuthInterceptor();

const app = createApp(App)
app.use(router)
app.use(store)

const initApp = async () => {
  try {
    
    // Initialize auth (handles Firebase setup internally)
    await store.dispatch('auth/initAuth');
    
    
    // Initialize formatters (for rich text)
    initFormatters();
    

    // Mount the app
    app.mount('#app');
  } catch (e) {
    console.error("Error initializing app:", e);
    // Mount anyway so user can see error state
    app.mount('#app');
  }
};

// Start initialization
initApp();
