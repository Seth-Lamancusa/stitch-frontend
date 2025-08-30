class TokenManager {
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
    const rt = this.refreshToken;
    if (!rt) return null;
    try {
      const resp = await fetch('/api/auth/sessions/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
        _skipAuth: true
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      if (data && data.access_token) {
        this.accessToken = data.access_token;
        if (data.refresh_token) this.refreshToken = data.refresh_token;
        return data.access_token;
      }
      return null;
    } catch {
      return null;
    }
  }
}

export default TokenManager;


