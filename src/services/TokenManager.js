class TokenManager {
  static debug = true;
  static inFlightRefreshPromise = null;
  static lastSuccessfulRefreshAt = 0;
  static get accessToken() {
    return localStorage.getItem('auth_token');
  }

  static set accessToken(token) {
    if (!token) localStorage.removeItem('auth_token');
    else localStorage.setItem('auth_token', token);
  }

  static get refreshToken() {
    return localStorage.getItem('refresh_token');
  }

  static set refreshToken(token) {
    if (!token) localStorage.removeItem('refresh_token');
    else localStorage.setItem('refresh_token', token);
  }

  static async refreshIfNeeded() {
    // no proactive timer; we refresh on 401 instead
    return this.accessToken;
  }

  static async refreshAccessToken() {
    // Deduplicate concurrent refresh attempts: reuse a single in-flight promise
    if (this.inFlightRefreshPromise) {
      try { return await this.inFlightRefreshPromise; } catch { return null; }
    }

    const rt = this.refreshToken;
    if (!rt) {
      if (this.debug) console.warn('[TokenManager] No refresh_token present');
      return null;
    }

    this.inFlightRefreshPromise = (async () => {
      try {
        const resp = await fetch('/api/auth/sessions/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: rt }),
          _skipAuth: true
        });
        if (!resp.ok) {
          if (this.debug) console.warn('[TokenManager] Refresh failed', resp.status);
          return null;
        }
        const data = await resp.json();
        if (data && data.access_token) {
          this.accessToken = data.access_token;
          if (data.refresh_token) this.refreshToken = data.refresh_token;
          this.lastSuccessfulRefreshAt = Date.now();
          if (this.debug) console.log('[TokenManager] Refresh succeeded');
          return data.access_token;
        }
        if (this.debug) console.warn('[TokenManager] Refresh response missing access_token');
        return null;
      } catch (e) {
        if (this.debug) console.error('[TokenManager] Refresh error', e);
        return null;
      }
    })();

    try {
      return await this.inFlightRefreshPromise;
    } finally {
      this.inFlightRefreshPromise = null;
    }
  }
}

export default TokenManager;

// Optional: expose for console debugging in dev
if (typeof window !== 'undefined') {
  try { window.TokenManager = TokenManager; } catch (e) {}
}


