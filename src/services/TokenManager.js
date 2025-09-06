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
        // Debug simulation knobs (set via localStorage for easy toggling from DevTools):
        // - tm_sim_latency_ms: number of ms to delay the refresh (default 0)
        // - tm_sim_network_error: '1' to throw before network call
        // - tm_sim_http_error: '1' to simulate non-OK HTTP result
        // - tm_sim_fail_rate: '0.0-1.0' probability to fail (return null)
        try {
          const latencyMs = parseInt(localStorage.getItem('tm_sim_latency_ms') || '0', 10);
          if (!isNaN(latencyMs) && latencyMs > 0) {
            if (this.debug) console.log('[TokenManager] Simulating refresh latency', latencyMs, 'ms');
            await new Promise(r => setTimeout(r, latencyMs));
          }
          if (localStorage.getItem('tm_sim_network_error') === '1') {
            if (this.debug) console.warn('[TokenManager] Simulating network error during refresh');
            throw new Error('Simulated network error');
          }
          if (localStorage.getItem('tm_sim_http_error') === '1') {
            if (this.debug) console.warn('[TokenManager] Simulating HTTP error during refresh');
            return null;
          }
          const failRateStr = localStorage.getItem('tm_sim_fail_rate');
          const failRate = failRateStr ? Math.max(0, Math.min(1, parseFloat(failRateStr))) : 0;
          if (failRate > 0 && Math.random() < failRate) {
            if (this.debug) console.warn('[TokenManager] Simulating probabilistic refresh failure', `(p=${failRate})`);
            return null;
          }
        } catch (_) {}

        // Retry policy for transient errors
        const maxAttempts = parseInt(localStorage.getItem('tm_retry_max_attempts') || '3', 10);
        const baseDelayMs = parseInt(localStorage.getItem('tm_retry_base_delay_ms') || '500', 10);
        const maxDelayMs = parseInt(localStorage.getItem('tm_retry_max_delay_ms') || '4000', 10);

        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        const isTransientStatus = (s) => s === 429 || (s >= 500 && s <= 599);

        let attempt = 0;
        while (attempt < Math.max(1, maxAttempts)) {
          attempt += 1;
          let response = null;
          try {
            response = await fetch('/api/auth/sessions/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh_token: rt }),
              _skipAuth: true
            });
          } catch (e) {
            if (this.debug) console.warn(`[TokenManager] Refresh network error (attempt ${attempt})`, e?.message || e);
            // Treat as transient; fall through to backoff unless last attempt
          }

          if (response && response.ok) {
            const data = await response.json().catch(() => null);
            if (data && data.access_token) {
              this.accessToken = data.access_token;
              if (data.refresh_token) this.refreshToken = data.refresh_token;
              this.lastSuccessfulRefreshAt = Date.now();
              if (this.debug) console.log('[TokenManager] Refresh succeeded');
              return data.access_token;
            }
            if (this.debug) console.warn('[TokenManager] Refresh response missing access_token');
            return null;
          }

          const status = response ? response.status : 'NETERR';
          const shouldRetry = status === 'NETERR' || isTransientStatus(status);
          if (!shouldRetry) {
            if (this.debug) console.warn('[TokenManager] Non-transient refresh failure; not retrying', status);
            return null;
          }

          if (attempt >= maxAttempts) {
            if (this.debug) console.warn('[TokenManager] Exhausted refresh retries');
            return null;
          }

          // Exponential backoff with jitter
          const backoff = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
          const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(backoff * 0.2)));
          const delay = backoff + jitter;
          if (this.debug) console.log(`[TokenManager] Retry refresh in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`);
          await sleep(delay);
        }
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


