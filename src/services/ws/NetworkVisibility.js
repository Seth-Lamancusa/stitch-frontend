// NetworkVisibility: emits callbacks for online/offline and visibility changes

export default class NetworkVisibility {
  constructor(options = {}) {
    this.onOnline = typeof options.onOnline === 'function' ? options.onOnline : () => {};
    this.onOffline = typeof options.onOffline === 'function' ? options.onOffline : () => {};
    this.onVisible = typeof options.onVisible === 'function' ? options.onVisible : () => {};
    this.onHidden = typeof options.onHidden === 'function' ? options.onHidden : () => {};
    this._online = typeof navigator !== 'undefined' ? !!navigator.onLine : true;
    this._boundOnline = this._handleOnline.bind(this);
    this._boundOffline = this._handleOffline.bind(this);
    this._boundVisibility = this._handleVisibility.bind(this);
    this._active = false;
  }

  start() {
    if (this._active) return;
    try {
      window.addEventListener('online', this._boundOnline);
      window.addEventListener('offline', this._boundOffline);
      document.addEventListener('visibilitychange', this._boundVisibility);
    } catch (_) {}
    this._active = true;
  }

  stop() {
    if (!this._active) return;
    try {
      window.removeEventListener('online', this._boundOnline);
      window.removeEventListener('offline', this._boundOffline);
      document.removeEventListener('visibilitychange', this._boundVisibility);
    } catch (_) {}
    this._active = false;
  }

  _handleOnline() {
    this._online = true;
    try { this.onOnline(); } catch (_) {}
  }

  _handleOffline() {
    this._online = false;
    try { this.onOffline(); } catch (_) {}
  }

  _handleVisibility() {
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    try { hidden ? this.onHidden() : this.onVisible(); } catch (_) {}
  }
}


