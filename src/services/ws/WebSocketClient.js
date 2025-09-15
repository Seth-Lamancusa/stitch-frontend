// Minimal WebSocket client with event emitter and ping/pong heartbeat

const DEFAULT_PING_INTERVAL_MS = 30000;
const DEFAULT_PING_TIMEOUT_MS = 60000;

class EventEmitter {
  constructor() { this._listeners = {}; }
  on(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = new Set();
    this._listeners[event].add(handler);
    return () => this.off(event, handler);
  }
  off(event, handler) {
    if (this._listeners[event]) this._listeners[event].delete(handler);
  }
  emit(event, ...args) {
    if (!this._listeners[event]) return;
    for (const handler of Array.from(this._listeners[event])) {
      try { handler(...args); } catch (_) {}
    }
  }
}

export default class WebSocketClient {
  constructor(config = {}) {
    this.buildUrl = config.buildUrl; // (token) => string
    this.logger = config.logger || console;
    this.pingIntervalMs = config.pingIntervalMs || DEFAULT_PING_INTERVAL_MS;
    this.pingTimeoutMs = config.pingTimeoutMs || DEFAULT_PING_TIMEOUT_MS;

    this.socket = null;
    this._emitter = new EventEmitter();
    this._pingTimer = null;
    this._lastPongAt = null;
    this._token = null;
  }

  on(event, handler) { return this._emitter.on(event, handler); }
  off(event, handler) { return this._emitter.off(event, handler); }

  get isOpen() {
    return !!this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  status() {
    return {
      isOpen: this.isOpen,
      readyState: this.socket ? this.socket.readyState : undefined,
      lastPongAt: this._lastPongAt,
      hasSocket: !!this.socket,
    };
  }

  async connect(token) {
    this._token = token;
    const url = this._safeBuildUrl(token);
    if (!url) throw new Error('WebSocketClient: failed to build URL');

    if (this.socket) {
      try { this.socket.close(1000, 'Reconnecting'); } catch (_) {}
      this._cleanup();
    }

    return new Promise((resolve, reject) => {
      try {
        const socket = new WebSocket(url);
        this.socket = socket;

        socket.onopen = () => {
          // Client-side heartbeat disabled when pingIntervalMs <= 0; rely on server pings
          if (this.pingIntervalMs > 0) {
            this._startHeartbeat();
          }
          this._emitter.emit('open');
          resolve();
        };

        socket.onmessage = (event) => {
          try {
            if (event.data === 'pong') {
              this._lastPongAt = Date.now();
              return;
            }
            if (event.data === 'ping') {
              try { socket.send('pong'); } catch (_) {}
              this._lastPongAt = Date.now();
              return;
            }
            const parsed = JSON.parse(event.data);
            this._emitter.emit('json', parsed);
          } catch (e) {
            this._emitter.emit('error', e);
          }
        };

        socket.onerror = (err) => {
          this._emitter.emit('error', err);
        };

        socket.onclose = (evt) => {
          this._stopHeartbeat();
          this._emitter.emit('close', evt);
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  send(data) {
    if (!this.isOpen) throw new Error('WebSocketClient: socket not open');
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    this.socket.send(payload);
  }

  disconnect(code = 1000, reason = 'Client disconnect') {
    try { if (this.socket) this.socket.close(code, reason); } catch (_) {}
    this._cleanup();
  }

  _cleanup() {
    this._stopHeartbeat();
    this.socket = null;
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this._lastPongAt = Date.now();
    try {
      this._pingTimer = setInterval(() => {
        try {
          if (this.isOpen) {
            this.socket.send('ping');
            if (this._lastPongAt && (Date.now() - this._lastPongAt) > this.pingTimeoutMs * 2) {
              try { this.socket.close(4000, 'Ping timeout'); } catch (_) {}
            }
          }
        } catch (_) {}
      }, Math.max(15000, Math.floor(this.pingIntervalMs)));
    } catch (_) {}
  }

  _stopHeartbeat() {
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  }

  _safeBuildUrl(token) {
    try {
      if (typeof this.buildUrl === 'function') return this.buildUrl(token);
      const isSecure = window.location.protocol === 'https:';
      const proto = isSecure ? 'wss:' : 'ws:';
      const host = window.location.host;
      return `${proto}//${host}/ws/v1?access_token=${encodeURIComponent(token)}`;
    } catch (e) {
      this.logger?.error?.('WebSocketClient: buildUrl failed', e);
      return null;
    }
  }
}


