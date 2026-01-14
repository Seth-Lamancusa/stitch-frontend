class TokenManager {
  static debug = true;
  static inFlightRefreshPromise = null;
  static lastSuccessfulRefreshAt = 0;
  static lastRefreshFailedAt = 0;  // Track when refresh last failed to prevent cascade retries
  static refreshFailureCooldownMs = 5000;  // 5 second cooldown after a failure before allowing another refresh
  static deviceKey = 'device_id';
  static backupManagerRefreshKey = 'manager_refresh_backup';

  static _ss() {
    try { return window.sessionStorage; } catch (_) { return null; }
  }
  static _ls() {
    try { return window.localStorage; } catch (_) { return null; }
  }

  static get accessToken() {
    try { const ss = this._ss(); if (ss) return ss.getItem('auth_token'); } catch (_) {}
    return localStorage.getItem('auth_token');
  }

  static set accessToken(token) {
    try {
      const ss = this._ss();
      if (ss) {
        if (!token) ss.removeItem('auth_token'); else ss.setItem('auth_token', token);
      } else {
        if (!token) localStorage.removeItem('auth_token'); else localStorage.setItem('auth_token', token);
      }
    } catch (_) {
      if (!token) localStorage.removeItem('auth_token'); else localStorage.setItem('auth_token', token);
    }
    // Mirror into bundle for atomic reads by future code
    try {
      const bundle = this._readBundle();
      bundle.access_token = token || null;
      this._writeBundle(bundle);
    } catch (_) {}
  }

  static get refreshToken() { return null; }
  static set refreshToken(token) { /* noop: httpOnly cookie */ }

  static _readBundle() { return {}; }
  static _writeBundle(obj) { }

  static _ensureDeviceId() {
    try {
      // Persist device_id in localStorage (shared across tabs)
      const ls = this._ls();
      if (ls) {
        let id = ls.getItem(this.deviceKey);
        if (!id) {
          id = (crypto && crypto.randomUUID && crypto.randomUUID()) || (Math.random().toString(36).slice(2) + Date.now().toString(36));
          ls.setItem(this.deviceKey, id);
        }
        return id;
      }
      // Fallback to sessionStorage if localStorage unavailable
      const ss = this._ss();
      if (ss) {
        let id = ss.getItem(this.deviceKey);
        if (!id) {
          id = (crypto && crypto.randomUUID && crypto.randomUUID()) || (Math.random().toString(36).slice(2) + Date.now().toString(36));
          ss.setItem(this.deviceKey, id);
        }
        return id;
      }
      // Fallback non-persistent per page
      return (crypto && crypto.randomUUID && crypto.randomUUID()) || (Math.random().toString(36).slice(2) + Date.now().toString(36));
    } catch (_) {
      // Fallback non-persistent
      return 'dev-' + Math.random().toString(36).slice(2);
    }
  }

  static _genId() {
    try { return (crypto && crypto.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2); } catch (_) { return Math.random().toString(36).slice(2); }
  }

  static _now() { return Date.now(); }

  

  static async _applyTokensSafely(access, refresh) {
    try {
      // Refresh token is in httpOnly cookie; ignore provided value
      if (typeof access !== 'undefined') this.accessToken = access;
      return true;
    } catch (e) {
      try { const ss = this._ss(); if (ss) ss.removeItem('auth_token'); else localStorage.removeItem('auth_token'); } catch (_) {}
      return false;
    }
  }

  // Manager refresh backup (per-tab)
  static setManagerRefreshBackup(token) {
    try { const ss = this._ss(); if (ss) { if (!token) ss.removeItem(this.backupManagerRefreshKey); else ss.setItem(this.backupManagerRefreshKey, token); } } catch (_) {}
  }
  static getManagerRefreshBackup() {
    try { const ss = this._ss(); if (ss) return ss.getItem(this.backupManagerRefreshKey); } catch (_) {}
    return null;
  }

  // JWT decode helper
  static decodeJwt(token) {
    try {
      if (!token || typeof token !== 'string') return null;
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      return JSON.parse(json);
    } catch (_) { return null; }
  }

  static async refreshIfNeeded() {
    // no proactive timer; we refresh on 401 instead
    return this.accessToken;
  }

  static async refreshAccessToken(arg1 = undefined, arg2 = undefined) {
    // Accept optional initiator/options for richer logging without breaking callers
    let initiator = 'unknown';
    let options = {};
    try {
      if (typeof arg1 === 'string') { initiator = arg1 || 'unknown'; options = (arg2 && typeof arg2 === 'object') ? arg2 : {}; }
      else if (arg1 && typeof arg1 === 'object') { options = arg1; initiator = options.initiator || 'unknown'; }
    } catch (_) {}
    const corrId = (() => {
      try { return options.corrId || (`rf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`); } catch (_) { return 'rf_unknown'; }
    })();
    const reason = options.reason || undefined;
    if (this.debug) console.warn('[TokenManager]', 'refreshAccessToken:start', { initiator, corrId, reason });

    // Check if we recently failed a refresh - don't spam the backend with doomed requests
    const now = Date.now();
    if (this.lastRefreshFailedAt && (now - this.lastRefreshFailedAt) < this.refreshFailureCooldownMs) {
      if (this.debug) console.warn('[TokenManager]', 'refreshAccessToken:cooldown_active', { 
        initiator, 
        corrId, 
        timeSinceFailure: now - this.lastRefreshFailedAt,
        cooldownMs: this.refreshFailureCooldownMs
      });
      return null;
    }

    // Deduplicate concurrent refresh attempts within-tab
    if (this.inFlightRefreshPromise) {
      if (this.debug) console.warn('[TokenManager]', 'refreshAccessToken:reuse_inflight', { initiator, corrId });
      try { return await this.inFlightRefreshPromise; } catch { return null; }
    }

    this.inFlightRefreshPromise = (async () => {
      try {
        if (this.debug) console.warn('[TokenManager]', 'refreshAccessToken:started', { initiator, corrId });
        // Cookie-based refresh flow: no client-side refresh_token required

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

          // Cookie-based: nothing to re-read here

          let response = null;
          try {
            if (this.debug) console.log('[TokenManager]', 'refreshAccessToken:attempt_sending', { attempt, maxAttempts, corrId, initiator });
            response = await fetch('/v1/auth/sessions/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': corrId },
              credentials: 'include',
              body: JSON.stringify({ aud: 'public-v1', device_id: this._ensureDeviceId() }),
              _skipAuth: true
            });
            if (this.debug) console.log('[TokenManager]', 'refreshAccessToken:attempt_response', { attempt, status: response && response.status, corrId, initiator });
          } catch (e) {
            if (this.debug) console.warn('[TokenManager]', 'refreshAccessToken:network_error', { attempt, corrId, initiator, message: (e && e.message) || String(e) });
          }

          if (response && response.ok) {
            const data = await response.json().catch((err) => {
              if (this.debug) console.warn('[TokenManager]', 'refreshAccessToken:json_parse_failed', { corrId, initiator, message: err && err.message });
              return null;
            });
            if (this.debug) console.log('[TokenManager]', 'refreshAccessToken:response_keys', { keys: (data && Object.keys(data || {})) || [], corrId, initiator });
            if (data && data.access_token) {
              const ok = await this._applyTokensSafely(data.access_token, undefined);
              if (!ok) {
                if (this.debug) console.error('[TokenManager] Failed to persist tokens; aborting');
                return null;
              }
              this.lastSuccessfulRefreshAt = Date.now();
              this.lastRefreshFailedAt = 0;  // Clear failure timestamp on success
              if (this.debug) console.log('[TokenManager]', 'refreshAccessToken:success', { corrId, initiator });
              return data.access_token;
            }
            if (this.debug) console.warn('[TokenManager]', 'refreshAccessToken:missing_access_token', { corrId, initiator });
            return null;
          }

          const status = response ? response.status : 'NETERR';
          if (this.debug) console.warn('[TokenManager]', 'refreshAccessToken:non_ok_status', { status, attempt, corrId, initiator });
          const shouldRetry = status === 'NETERR' || isTransientStatus(status);
          if (!shouldRetry) {
            if (this.debug) console.warn('[TokenManager]', 'refreshAccessToken:non_transient_failure', { status, corrId, initiator });
            return null;
          }

          if (attempt >= maxAttempts) {
            if (this.debug) console.warn('[TokenManager] Exhausted refresh retries');
            this._announceRefreshResult(false);
            return null;
          }

          // Exponential backoff with jitter
          const backoff = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
          const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(backoff * 0.2)));
          const delay = backoff + jitter;
          if (this.debug) console.log('[TokenManager]', 'refreshAccessToken:retry_scheduled', { nextInMs: delay, nextAttempt: attempt + 1, maxAttempts, corrId, initiator });
          await sleep(delay);
        }
        return null;
      } catch (e) {
        if (this.debug) console.error('[TokenManager]', 'refreshAccessToken:error', { corrId, initiator, message: e && e.message });
        return null;
      } finally {
        try { if (this.debug) console.warn('[TokenManager]', 'refreshAccessToken:finished', { corrId, initiator }); } catch (_) {}
      }
    })();

    try {
      const res = await this.inFlightRefreshPromise;
      if (!res) {
        this.lastRefreshFailedAt = Date.now();  // Track failure to enable cooldown
      }
      if (this.debug) console.warn('[TokenManager]', 'refreshAccessToken:done', { corrId, initiator, ok: !!res });
      return res;
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


