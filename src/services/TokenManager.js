class TokenManager {
  static debug = true;
  static inFlightRefreshPromise = null;
  static lastSuccessfulRefreshAt = 0;
  static lastRefreshFailedAt = 0;  // Track when refresh last failed to prevent cascade retries
  static refreshFailureCooldownMs = 5000;  // 5 second cooldown after a failure before allowing another refresh
  static deviceKey = 'device_id';
  static backupManagerRefreshKey = 'manager_refresh_backup';

  // Cross-tab synchronization via BroadcastChannel
  static _syncChannel = null;
  static _tabId = null;
  static _crossTabRefreshPromise = null;  // Promise that resolves when another tab completes refresh
  static _crossTabRefreshResolver = null; // Resolver for the above promise
  static _crossTabTimeoutMs = 8000;  // Max time to wait for another tab's refresh
  static _syncInitialized = false;

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

  // ==================== Cross-Tab Sync ====================
  
  /**
   * Initialize BroadcastChannel for cross-tab token synchronization.
   * Called once when module loads. Gracefully degrades if BroadcastChannel unavailable.
   */
  static _initCrossTabSync() {
    if (this._syncInitialized) return;
    this._syncInitialized = true;
    
    // Generate unique tab ID
    this._tabId = this._genId();
    
    // Check if BroadcastChannel is available
    if (typeof BroadcastChannel === 'undefined') {
      if (this.debug) console.log('[TokenManager] BroadcastChannel not available, cross-tab sync disabled');
      return;
    }
    
    try {
      this._syncChannel = new BroadcastChannel('stitch_token_sync');
      this._syncChannel.onmessage = (event) => this._handleSyncMessage(event.data);
      this._syncChannel.onmessageerror = () => {
        if (this.debug) console.warn('[TokenManager] BroadcastChannel message error');
      };
      
      if (this.debug) console.log('[TokenManager] Cross-tab sync initialized', { tabId: this._tabId.slice(0, 8) });
      
      // Clean up on page unload
      window.addEventListener('beforeunload', () => {
        this._broadcastMessage({ type: 'tab_closing', tabId: this._tabId });
      });
      
      // When tab becomes visible, sync access token from other tabs
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this._onTabVisible();
        }
      });
    } catch (e) {
      if (this.debug) console.warn('[TokenManager] Failed to initialize BroadcastChannel', e);
      this._syncChannel = null;
    }
  }
  
  /**
   * Handle incoming cross-tab messages.
   */
  static _handleSyncMessage(data) {
    if (!data || data.tabId === this._tabId) return; // Ignore own messages
    
    switch (data.type) {
      case 'refresh_started':
        // Another tab started refreshing - set up a promise to wait for result
        if (!this._crossTabRefreshPromise) {
          if (this.debug) console.log('[TokenManager] Another tab started refresh', { fromTab: data.tabId?.slice(0, 8) });
          this._setupCrossTabWait(data.tabId);
        }
        break;
        
      case 'refresh_completed':
        // Another tab completed refresh - apply the token and resolve any waiting promise
        if (this.debug) console.log('[TokenManager] Received token from another tab', { fromTab: data.tabId?.slice(0, 8) });
        if (data.accessToken) {
          this._applySyncedToken(data.accessToken, data.timestamp);
        }
        this._resolveCrossTabWait(data.accessToken);
        break;
        
      case 'refresh_failed':
        // Another tab's refresh failed - resolve with null so we can try ourselves
        if (this.debug) console.log('[TokenManager] Another tab refresh failed', { fromTab: data.tabId?.slice(0, 8) });
        this._resolveCrossTabWait(null);
        break;
        
      case 'tab_closing':
        // Tab that was refreshing is closing - resolve with null so we can continue
        if (this._crossTabRefreshPromise) {
          if (this.debug) console.log('[TokenManager] Refreshing tab closed', { fromTab: data.tabId?.slice(0, 8) });
          this._resolveCrossTabWait(null);
        }
        break;
        
      case 'token_request':
        // Another tab is asking for the current token (e.g., when becoming visible)
        if (this.accessToken && this.lastSuccessfulRefreshAt > 0) {
          this._broadcastMessage({
            type: 'token_response',
            accessToken: this.accessToken,
            timestamp: this.lastSuccessfulRefreshAt,
            tabId: this._tabId,
            requestId: data.requestId
          });
        }
        break;
        
      case 'token_response':
        // Response to our token request - apply if newer
        if (data.accessToken && data.requestId === this._pendingTokenRequestId) {
          this._applySyncedToken(data.accessToken, data.timestamp);
        }
        break;
    }
  }
  
  /**
   * Set up a promise that waits for another tab's refresh to complete.
   */
  static _setupCrossTabWait(sourceTabId) {
    if (this._crossTabRefreshPromise) return; // Already waiting
    
    this._crossTabRefreshPromise = new Promise((resolve) => {
      this._crossTabRefreshResolver = resolve;
      
      // Timeout: don't wait forever in case the other tab dies
      setTimeout(() => {
        if (this._crossTabRefreshResolver === resolve) {
          if (this.debug) console.log('[TokenManager] Cross-tab wait timeout');
          this._resolveCrossTabWait(null);
        }
      }, this._crossTabTimeoutMs);
    });
  }
  
  /**
   * Resolve the cross-tab wait promise.
   */
  static _resolveCrossTabWait(token) {
    if (this._crossTabRefreshResolver) {
      this._crossTabRefreshResolver(token);
      this._crossTabRefreshResolver = null;
      this._crossTabRefreshPromise = null;
    }
  }
  
  /**
   * Apply a token received from another tab.
   */
  static _applySyncedToken(accessToken, timestamp) {
    // Only apply if it's newer than what we have
    if (timestamp && timestamp > this.lastSuccessfulRefreshAt) {
      this.accessToken = accessToken;
      this.lastSuccessfulRefreshAt = timestamp;
      this.lastRefreshFailedAt = 0; // Clear failure state since we got a good token
      if (this.debug) console.log('[TokenManager] Applied synced token', { age: Date.now() - timestamp });
    }
  }
  
  /**
   * Broadcast a message to other tabs.
   */
  static _broadcastMessage(data) {
    if (!this._syncChannel) return;
    try {
      this._syncChannel.postMessage({ ...data, tabId: this._tabId, timestamp: Date.now() });
    } catch (e) {
      if (this.debug) console.warn('[TokenManager] Failed to broadcast message', e);
    }
  }
  
  /**
   * Called when tab becomes visible. Proactively validate token and sync with other tabs.
   * This is the key fix for stale tokens after tab suspension/restoration.
   */
  static _pendingTokenRequestId = null;
  static _visibilityValidationInProgress = false;
  static _lastVisibilityValidation = 0;
  static _visibilityValidationCooldownMs = 2000; // Don't validate more than once per 2 seconds
  
  static async _onTabVisible() {
    // Skip if validation is already in progress
    if (this._visibilityValidationInProgress) {
      if (this.debug) console.log('[TokenManager] Visibility validation already in progress, skipping');
      return;
    }
    
    // Skip if we just validated recently (prevent rapid re-validation)
    const now = Date.now();
    if ((now - this._lastVisibilityValidation) < this._visibilityValidationCooldownMs) {
      if (this.debug) console.log('[TokenManager] Visibility validation cooldown, skipping');
      return;
    }
    
    this._visibilityValidationInProgress = true;
    this._lastVisibilityValidation = now;
    
    try {
      if (this.debug) console.log('[TokenManager] Tab became visible, proactively validating token');
      
      // First, request token from other tabs (they may have refreshed while we were hidden)
      if (this._syncChannel) {
        this._pendingTokenRequestId = this._genId();
        this._broadcastMessage({
          type: 'token_request',
          requestId: this._pendingTokenRequestId,
          tabId: this._tabId
        });
        
        // Wait briefly for responses from other tabs
        await new Promise(resolve => setTimeout(resolve, 200));
        this._pendingTokenRequestId = null;
      }
      
      // Now validate/refresh our token if needed
      // This uses the coordinated refresh mechanism to prevent races
      const token = this.accessToken;
      
      // Check if we have a token and if it's expired or near expiry
      if (!token || this.isTokenExpiredOrNearExpiry(token, 60)) {
        // Use a longer buffer (60s) on visibility change since we don't know
        // how long the tab was hidden and want to be proactive
        if (this.debug) {
          const remaining = token ? this.getTokenExpirySeconds(token) : 0;
          console.log('[TokenManager] Token needs refresh on visibility change', { remaining });
        }
        
        const newToken = await this.getValidToken({ 
          initiator: 'visibility_change',
          bufferSeconds: 60 
        });
        
        if (newToken) {
          if (this.debug) console.log('[TokenManager] Token refreshed successfully on visibility change');
        } else {
          if (this.debug) console.warn('[TokenManager] Token refresh failed on visibility change');
        }
      } else {
        if (this.debug) {
          const remaining = this.getTokenExpirySeconds(token);
          console.log('[TokenManager] Token still valid on visibility change', { remaining });
        }
      }
    } catch (e) {
      if (this.debug) console.error('[TokenManager] Error during visibility validation', e);
    } finally {
      this._visibilityValidationInProgress = false;
    }
  }
  
  // ==================== Token Validation ====================
  
  /**
   * Check if a token is expired or near expiry.
   * @param {string} token - JWT token to check
   * @param {number} bufferSeconds - Seconds before actual expiry to consider it "near expiry"
   * @returns {boolean} true if token is missing, invalid, expired, or within buffer of expiry
   */
  static isTokenExpiredOrNearExpiry(token, bufferSeconds = 30) {
    if (!token) return true;
    
    try {
      const decoded = this.decodeJwt(token);
      if (!decoded || !decoded.exp) return true;
      
      const nowSeconds = Math.floor(Date.now() / 1000);
      const expiresAt = decoded.exp;
      
      // Token is expired or will expire within buffer
      return expiresAt <= (nowSeconds + bufferSeconds);
    } catch (e) {
      if (this.debug) console.warn('[TokenManager] Error decoding token for expiry check', e);
      return true; // Treat invalid tokens as expired
    }
  }
  
  /**
   * Get remaining seconds until token expires.
   * @param {string} token - JWT token to check
   * @returns {number} Seconds until expiry, or 0 if expired/invalid
   */
  static getTokenExpirySeconds(token) {
    if (!token) return 0;
    
    try {
      const decoded = this.decodeJwt(token);
      if (!decoded || !decoded.exp) return 0;
      
      const nowSeconds = Math.floor(Date.now() / 1000);
      const remaining = decoded.exp - nowSeconds;
      return Math.max(0, remaining);
    } catch (e) {
      return 0;
    }
  }
  
  /**
   * Get a valid (non-expired) access token, refreshing if necessary.
   * This method is race-condition-proof and coordinates with other tabs.
   * 
   * @param {Object} options - Options for the refresh
   * @param {string} options.initiator - Who is requesting the token
   * @param {number} options.bufferSeconds - Seconds buffer before expiry to trigger refresh (default: 30)
   * @returns {Promise<string|null>} Valid access token or null if refresh fails
   */
  static async getValidToken({ initiator = 'getValidToken', bufferSeconds = 30 } = {}) {
    const token = this.accessToken;
    
    // If token is valid and not near expiry, return it immediately
    if (token && !this.isTokenExpiredOrNearExpiry(token, bufferSeconds)) {
      if (this.debug) {
        const remaining = this.getTokenExpirySeconds(token);
        console.log('[TokenManager] Token is valid', { remaining, initiator });
      }
      return token;
    }
    
    // Token is missing, expired, or near expiry - need to refresh
    if (this.debug) {
      const remaining = token ? this.getTokenExpirySeconds(token) : 0;
      console.log('[TokenManager] Token needs refresh', { remaining, initiator });
    }
    
    // Use the coordinated refresh mechanism
    const newToken = await this.refreshAccessToken({ initiator, reason: 'token_expired_or_near_expiry' });
    return newToken;
  }

  // ==================== Token Management ====================

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

    // Deduplicate concurrent refresh attempts within this tab
    if (this.inFlightRefreshPromise) {
      if (this.debug) console.log('[TokenManager] reusing in-flight refresh');
      try { return await this.inFlightRefreshPromise; } catch { return null; }
    }
    
    // Check if another tab is already refreshing - wait for their result
    if (this._crossTabRefreshPromise) {
      if (this.debug) console.log('[TokenManager] waiting for cross-tab refresh');
      try {
        const crossTabResult = await this._crossTabRefreshPromise;
        if (crossTabResult) {
          if (this.debug) console.log('[TokenManager] using cross-tab refresh result');
          return crossTabResult;
        }
        // Cross-tab refresh failed or timed out - continue with our own refresh
        if (this.debug) console.log('[TokenManager] cross-tab refresh failed, proceeding with own refresh');
      } catch {
        // Ignore errors, proceed with our own refresh
      }
    }

    // Broadcast that we're starting a refresh (so other tabs can wait)
    this._broadcastMessage({ type: 'refresh_started', tabId: this._tabId });

    this.inFlightRefreshPromise = (async () => {
      try {
        if (this.debug) console.log('[TokenManager] refresh started', { initiator, device: device_id.slice(0,8), tabId: this._tabId?.slice(0,8) });

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
              
              // Broadcast new token to other tabs
              this._broadcastMessage({
                type: 'refresh_completed',
                accessToken: data.access_token,
                tabId: this._tabId
              });
              
              return data.access_token;
            }
            return null;
          }

          const status = response?.status || 'NETERR';
          if (!isTransient(status) && status !== 'NETERR') {
            if (this.debug) console.warn('[TokenManager] refresh failed', { status, attempt });
            // Broadcast failure so other tabs can try
            this._broadcastMessage({ type: 'refresh_failed', tabId: this._tabId });
            return null;
          }

          if (attempt < maxAttempts) {
            const delay = Math.min(4000, 500 * Math.pow(2, attempt - 1));
            await sleep(delay);
          }
        }
        if (this.debug) console.warn('[TokenManager] refresh exhausted retries');
        // Broadcast failure so other tabs can try
        this._broadcastMessage({ type: 'refresh_failed', tabId: this._tabId });
        return null;
      } catch (e) {
        if (this.debug) console.error('[TokenManager] refresh error', e.message);
        // Broadcast failure so other tabs can try
        this._broadcastMessage({ type: 'refresh_failed', tabId: this._tabId });
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

// Initialize cross-tab sync when module loads
if (typeof window !== 'undefined') {
  TokenManager._initCrossTabSync();
  
  // Expose for console debugging
  try { window.TokenManager = TokenManager; } catch (e) {}
}

export default TokenManager;
