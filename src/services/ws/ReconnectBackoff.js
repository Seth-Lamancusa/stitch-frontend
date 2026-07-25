export default class ReconnectBackoff {
  constructor(options = {}) {
    this.initialMs = options.initialMs ?? 1000;
    this.maxMs = options.maxMs ?? 30000;
    this.jitterMs = options.jitterMs ?? 500;
    this.maxAttempts = options.maxAttempts ?? 5;
    this.attempt = 0;
    this.currentBase = this.initialMs;
  }

  reset() {
    this.attempt = 0;
    this.currentBase = this.initialMs;
  }

  nextDelay() {
    if (this.attempt >= this.maxAttempts) return null;
    this.attempt += 1;
    this.currentBase = Math.min(this.attempt === 1 ? this.initialMs : this.currentBase * 2, this.maxMs);
    const jitter = Math.floor(Math.random() * Math.min(this.jitterMs, Math.floor(this.currentBase / 2)));
    return this.currentBase + jitter;
  }
}


