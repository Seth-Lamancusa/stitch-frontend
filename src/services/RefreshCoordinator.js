import TokenManager from './TokenManager'

// Centralized coordinator for access token refresh across the SPA
// Provides single in-tab in-flight promise, optional cross-tab BroadcastChannel
// and a brief failure cooldown to avoid loops.
const CHANNEL_NAME = 'auth-refresh';

const RefreshCoordinator = {
  inFlightPromise: null,
  lastFailureAt: 0,
  failureCooldownMs: 5000,
  bc: null,
  bcSupported: typeof window !== 'undefined' && 'BroadcastChannel' in window,
  state: 'idle', // idle | refreshing | cooldown

  ensureChannel() {
    if (this.bcSupported && !this.bc) {
      try {
        this.bc = new BroadcastChannel(CHANNEL_NAME);
        this.bc.onmessage = (ev) => {
          const data = ev && ev.data ? ev.data : {};
          if (!data || typeof data !== 'object') return;
          if (data.type === 'refresh_start') {
            try { console.warn('[RefreshCoordinator] peer started refresh', { corrId: data.corrId, initiator: data.initiator }); } catch (_) {}
          }
          if (data.type === 'refresh_done') {
            try { console.warn('[RefreshCoordinator] peer finished refresh', { corrId: data.corrId, ok: !!data.ok }); } catch (_) {}
          }
        };
      } catch (_) {}
    }
  },

  broadcast(type, payload = {}) {
    try {
      this.ensureChannel();
      if (this.bc) this.bc.postMessage({ type, ...payload });
    } catch (_) {}
  },

  isCooldownActive() {
    if (!this.lastFailureAt) return false;
    return (Date.now() - this.lastFailureAt) < this.failureCooldownMs;
  },

  async getFreshAccessToken(options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    const initiator = opts.initiator || 'unknown';
    const corrId = opts.corrId || (`rc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`);
    const reason = opts.reason;
    try { console.warn('[RefreshCoordinator] request', { initiator, corrId, reason }); } catch (_) {}

    if (this.inFlightPromise) {
      try { console.warn('[RefreshCoordinator] reuse in-flight', { initiator, corrId }); } catch (_) {}
      try { return await this.inFlightPromise; } catch { return null; }
    }

    if (this.isCooldownActive()) {
      try { console.warn('[RefreshCoordinator] failure cooldown active; skipping refresh', { initiator, corrId }); } catch (_) {}
      this.state = 'cooldown';
      return null;
    }

    this.inFlightPromise = (async () => {
      try {
        this.state = 'refreshing';
        this.broadcast('refresh_start', { initiator, corrId });
        const token = await TokenManager.refreshAccessToken({ initiator: `rc:${initiator}`, corrId, reason });
        if (!token) {
          this.lastFailureAt = Date.now();
          this.broadcast('refresh_done', { initiator, corrId, ok: false });
          return null;
        }
        this.broadcast('refresh_done', { initiator, corrId, ok: true });
        return token;
      } finally {
        if (this.isCooldownActive()) this.state = 'cooldown'; else this.state = 'idle';
        this.inFlightPromise = null;
      }
    })();

    try {
      return await this.inFlightPromise;
    } catch (_) {
      return null;
    }
  },

  getStatus() {
    return {
      inFlight: !!this.inFlightPromise,
      cooldownActive: this.isCooldownActive(),
      lastFailureAt: this.lastFailureAt,
    };
  }
};

export default RefreshCoordinator;


