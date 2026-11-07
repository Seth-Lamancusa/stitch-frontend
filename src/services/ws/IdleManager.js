// IdleManager: listens for user activity and triggers onTimeout after inactivity

export default class IdleManager {
  constructor(options = {}) {
    this.timeoutMs = options.timeoutMs || 3 * 60 * 1000;
    this.onTimeout = typeof options.onTimeout === 'function' ? options.onTimeout : () => {};
    this.onActivity = typeof options.onActivity === 'function' ? options.onActivity : () => {};
    this.events = options.events || ['mousemove', 'pointermove', 'touchstart', 'touchmove', 'keydown', 'scroll', 'wheel'];
    this._timer = null;
    this._lastActivityAt = Date.now();
    this._handler = this._handleActivity.bind(this);
    this._active = false;
    this._paused = false;
  }

  start() {
    if (this._active) return;
    try {
      this.events.forEach(evt => window.addEventListener(evt, this._handler, { passive: true }));
    } catch (_) {}
    this._active = true;
    this._paused = false;
    this._lastActivityAt = Date.now();
    this._armTimer();
  }

  stop() {
    if (!this._active) return;
    try {
      this.events.forEach(evt => window.removeEventListener(evt, this._handler));
    } catch (_) {}
    this._active = false;
    this._paused = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }

  pause() {
    this._paused = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }

  resume() {
    if (!this._paused) return;
    this._paused = false;
    if (!this._active) return;
    this._lastActivityAt = Date.now();
    this._armTimer();
  }

  reset() {
    this._lastActivityAt = Date.now();
    if (this._paused) return;
    this._armTimer();
  }

  _handleActivity() {
    this._lastActivityAt = Date.now();
    try { this.onActivity(); } catch (_) {}
    if (this._paused) return;
    this._armTimer();
  }

  _armTimer() {
    if (this._paused) return;
    if (this._timer) clearTimeout(this._timer);
    const generationStartedAt = this._lastActivityAt;
    this._timer = setTimeout(() => {
      // double-check to reduce false positives from throttling
      const since = Date.now() - this._lastActivityAt;
      if (generationStartedAt !== this._lastActivityAt) return;
      if (since < this.timeoutMs - 250) { this._armTimer(); return; }
      try { this.onTimeout(); } catch (_) {}
    }, this.timeoutMs);
  }
}


