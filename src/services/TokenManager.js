class TokenManager {
  static debug = true;
  static inFlightRefreshPromise = null;
  static lastSuccessfulRefreshAt = 0;
  static lockKey = 'tm_refresh_lock';
  static resultKey = 'tm_refresh_result';
  static bundleKey = 'auth_bundle';

  static get accessToken() {
    return localStorage.getItem('auth_token');
  }

  static set accessToken(token) {
    if (!token) localStorage.removeItem('auth_token');
    else localStorage.setItem('auth_token', token);
    // Mirror into bundle for atomic reads by future code
    try {
      const bundle = this._readBundle();
      bundle.access_token = token || null;
      this._writeBundle(bundle);
    } catch (_) {}
  }

  static get refreshToken() {
    return localStorage.getItem('refresh_token');
  }

  static set refreshToken(token) {
    if (!token) localStorage.removeItem('refresh_token');
    else localStorage.setItem('refresh_token', token);
    // Mirror into bundle
    try {
      const bundle = this._readBundle();
      bundle.refresh_token = token || null;
      this._writeBundle(bundle);
    } catch (_) {}
  }

  static _readBundle() {
    try {
      const raw = localStorage.getItem(this.bundleKey);
      const parsed = raw ? JSON.parse(raw) : {};
      return typeof parsed === 'object' && parsed ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  static _writeBundle(obj) {
    try {
      localStorage.setItem(this.bundleKey, JSON.stringify(obj || {}));
    } catch (_) {}
  }

  static _genId() {
    try { return (crypto && crypto.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2); } catch (_) { return Math.random().toString(36).slice(2); }
  }

  static _now() { return Date.now(); }

  static _acquireCrossTabLock(maxHoldMs = 15000) {
    const id = this._genId();
    const now = this._now();
    const existingRaw = localStorage.getItem(this.lockKey);
    try {
      const existing = existingRaw ? JSON.parse(existingRaw) : null;
      if (existing && typeof existing.ts === 'number' && (now - existing.ts) < maxHoldMs) {
        return null; // someone else holds a fresh lock
      }
    } catch (_) {}
    const claim = JSON.stringify({ id, ts: now });
    try { localStorage.setItem(this.lockKey, claim); } catch (_) { /* ignore */ }
    // Verify we own it
    try {
      const reread = localStorage.getItem(this.lockKey);
      if (reread === claim) return { id, ts: now };
    } catch (_) {}
    return null;
  }

  static _releaseCrossTabLock(lock) {
    try {
      const current = localStorage.getItem(this.lockKey);
      if (!current) return;
      const parsed = JSON.parse(current);
      if (parsed && lock && parsed.id === lock.id) {
        localStorage.removeItem(this.lockKey);
      }
    } catch (_) {}
  }

  static async _waitForPeerRefresh(timeoutMs = 8000) {
    const start = this._now();
    const initialAccess = this.accessToken;
    return new Promise((resolve) => {
      let done = false;
      const finish = (value) => { if (!done) { done = true; cleanup(); resolve(value); } };
      const onStorage = (e) => {
        try {
          if (e && (e.key === 'auth_token' || e.key === this.resultKey || e.key === this.lockKey)) {
            const currentAccess = this.accessToken;
            if (currentAccess && currentAccess !== initialAccess) return finish(currentAccess);
            if (e.key === this.resultKey) return finish(this.accessToken || null);
            const lockRaw = localStorage.getItem(this.lockKey);
            if (!lockRaw) return finish(this.accessToken || null);
          }
        } catch (_) {}
      };
      const tick = () => {
        if (done) return;
        if ((this._now() - start) >= timeoutMs) return finish(null);
        const currentAccess = this.accessToken;
        if (currentAccess && currentAccess !== initialAccess) return finish(currentAccess);
        setTimeout(tick, 150);
      };
      const cleanup = () => {
        try { window.removeEventListener('storage', onStorage); } catch (_) {}
      };
      try { window.addEventListener('storage', onStorage); } catch (_) {}
      setTimeout(tick, 150);
    });
  }

  static _announceRefreshResult(ok) {
    try { localStorage.setItem(this.resultKey, JSON.stringify({ ok: !!ok, ts: this._now() })); } catch (_) {}
    // Best-effort nudge
    try { setTimeout(() => { try { localStorage.removeItem(this.resultKey); } catch (_) {} }, 50); } catch (_) {}
  }

  static async _applyTokensSafely(access, refresh) {
    try {
      // Write refresh first, then access; mirror into bundle
      if (typeof refresh !== 'undefined') this.refreshToken = refresh;
      if (typeof access !== 'undefined') this.accessToken = access;
      const bundle = this._readBundle();
      bundle.updated_at = this._now();
      if (typeof access !== 'undefined') bundle.access_token = access || null;
      if (typeof refresh !== 'undefined') bundle.refresh_token = refresh || null;
      this._writeBundle(bundle);
      return true;
    } catch (e) {
      try { localStorage.removeItem('auth_token'); } catch (_) {}
      try { localStorage.removeItem('refresh_token'); } catch (_) {}
      try { localStorage.removeItem(this.bundleKey); } catch (_) {}
      return false;
    }
  }

  static async refreshIfNeeded() {
    // no proactive timer; we refresh on 401 instead
    return this.accessToken;
  }

  static async refreshAccessToken() {
    // Deduplicate concurrent refresh attempts within-tab
    if (this.inFlightRefreshPromise) {
      try { return await this.inFlightRefreshPromise; } catch { return null; }
    }

    // Cross-tab lock: if another tab is refreshing, wait for it
    const lock = this._acquireCrossTabLock(15000);
    if (!lock) {
      const result = await this._waitForPeerRefresh(8000);
      return result;
    }

    this.inFlightRefreshPromise = (async () => {
      try {
        // Re-read refresh token just-in-time to avoid using a stale one
        let rt = this.refreshToken;
        if (!rt) {
          if (this.debug) console.warn('[TokenManager] No refresh_token present at send-time');
          return null;
        }

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

          // Re-read rt before each attempt in case it rotated in parallel
          const currentRt = this.refreshToken;
          if (currentRt && currentRt !== rt) {
            rt = currentRt;
          }

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
          }

          if (response && response.ok) {
            const data = await response.json().catch(() => null);
            if (data && data.access_token) {
              const ok = await this._applyTokensSafely(data.access_token, data.refresh_token);
              if (!ok) {
                if (this.debug) console.error('[TokenManager] Failed to persist tokens; aborting');
                return null;
              }
              this.lastSuccessfulRefreshAt = Date.now();
              if (this.debug) console.log('[TokenManager] Refresh succeeded');
              this._announceRefreshResult(true);
              return data.access_token;
            }
            if (this.debug) console.warn('[TokenManager] Refresh response missing access_token');
            this._announceRefreshResult(false);
            return null;
          }

          const status = response ? response.status : 'NETERR';
          const shouldRetry = status === 'NETERR' || isTransientStatus(status);
          if (!shouldRetry) {
            if (this.debug) console.warn('[TokenManager] Non-transient refresh failure; not retrying', status);
            this._announceRefreshResult(false);
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
          if (this.debug) console.log(`[TokenManager] Retry refresh in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`);
          await sleep(delay);
        }
        this._announceRefreshResult(false);
        return null;
      } catch (e) {
        if (this.debug) console.error('[TokenManager] Refresh error', e);
        this._announceRefreshResult(false);
        return null;
      } finally {
        this._releaseCrossTabLock(lock);
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


