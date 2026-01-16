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

  // Refresh token is stored in httpOnly cookie only (no JS access needed)
  // Removed backup token storage to eliminate cross-tab token drift bugs

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

  

  static async _applyTokensSafely(access) {
    try {
      // Store access token only
      // Refresh token is managed by httpOnly cookie (set by server, not accessible to JS)
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
    let initiator = 'unknown';
    let options = {};
    try {
      if (typeof arg1 === 'string') { initiator = arg1 || 'unknown'; options = (arg2 && typeof arg2 === 'object') ? arg2 : {}; }
      else if (arg1 && typeof arg1 === 'object') { options = arg1; initiator = options.initiator || 'unknown'; }
    } catch (_) {}
    const device_id = this._ensureDeviceId();

    // Cooldown after recent failure
    const now = Date.now();
    if (this.lastRefreshFailedAt && (now - this.lastRefreshFailedAt) < this.refreshFailureCooldownMs) {
      if (this.debug) console.log('[TokenManager] refresh blocked by cooldown');
      return null;
    }

    // Deduplicate concurrent refresh attempts
    if (this.inFlightRefreshPromise) {
      if (this.debug) console.log('[TokenManager] reusing in-flight refresh');
      try { return await this.inFlightRefreshPromise; } catch { return null; }
    }

    this.inFlightRefreshPromise = (async () => {
      try {
        if (this.debug) console.log('[TokenManager] refresh started', { initiator, device: device_id.slice(0,8) });

        const maxAttempts = 3;
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        const isTransient = (s) => s === 429 || (s >= 500 && s <= 599);

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          let response = null;
          try {
            // Cookie-only refresh: httpOnly cookie is sent automatically via credentials: 'include'
            // No refresh_token in body to avoid stale token bugs from cross-tab sessionStorage drift
            const payload = { aud: 'public-v1', device_id };
            
            response = await fetch('/v1/auth/sessions/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',  // Sends httpOnly cookie automatically
              body: JSON.stringify(payload),
            });
          } catch (e) {
            if (this.debug) console.warn('[TokenManager] network error', e.message);
          }

          if (response?.ok) {
            const data = await response.json().catch(() => null);
            if (data?.access_token) {
              // Store access token only (refresh token updated in cookie by server)
              await this._applyTokensSafely(data.access_token);
              this.lastSuccessfulRefreshAt = Date.now();
              this.lastRefreshFailedAt = 0;
              if (this.debug) console.log('[TokenManager] refresh success');
              return data.access_token;
            }
            return null;
          }

          const status = response?.status || 'NETERR';
          if (!isTransient(status) && status !== 'NETERR') {
            if (this.debug) console.warn('[TokenManager] refresh failed', { status, attempt });
            return null;
          }

          if (attempt < maxAttempts) {
            const delay = Math.min(4000, 500 * Math.pow(2, attempt - 1));
            await sleep(delay);
          }
        }
        if (this.debug) console.warn('[TokenManager] refresh exhausted retries');
        this._announceRefreshResult(false);
        return null;
      } catch (e) {
        if (this.debug) console.error('[TokenManager] refresh error', e.message);
        return null;
      }
    })();

    try {
      const res = await this.inFlightRefreshPromise;
      if (!res) this.lastRefreshFailedAt = Date.now();
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


