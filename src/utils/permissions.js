// Permission helpers with fallback to legacy space-delimited scopes
// - Prefer JWT permissions[] when available (decoded from access token)
// - Fallback to user.scopes string (space-delimited)

function base64UrlDecode(str) {
  try {
    const pad = str.length % 4 === 2 ? '==' : str.length % 4 === 3 ? '=' : '';
    const s = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const decoded = atob(s);
    try {
      // Handle UTF-8
      return decodeURIComponent(
        decoded
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    } catch (_) {
      return decoded;
    }
  } catch (_) {
    return '';
  }
}

export function parseJwtPayload(accessToken) {
  if (!accessToken || typeof accessToken !== 'string') return null;
  const parts = accessToken.split('.');
  if (parts.length < 2) return null;
  try {
    const json = base64UrlDecode(parts[1]);
    const payload = JSON.parse(json);
    return payload && typeof payload === 'object' ? payload : null;
  } catch (_) {
    return null;
  }
}

export function parseScopes(scopes) {
  const raw = typeof scopes === 'string' ? scopes : (scopes || '');
  return new Set(raw.split(' ').map(s => s.trim()).filter(Boolean));
}

export function getEffectivePermissions(user, accessToken) {
  // Prefer permissions[] from JWT when present
  const payload = parseJwtPayload(accessToken);
  const fromJwt = Array.isArray(payload && payload.permissions)
    ? new Set(payload.permissions.map(p => String(p).trim()).filter(Boolean))
    : null;
  if (fromJwt && fromJwt.size > 0) return fromJwt;
  // Fallback to scopes string on user
  const userScopes = user && typeof user.scopes === 'string' ? user.scopes : '';
  return parseScopes(userScopes);
}

export function hasPermission(user, permissionName, accessToken) {
  if (!permissionName) return false;
  const set = getEffectivePermissions(user, accessToken);
  return set.has(permissionName);
}

export function hasAnyPermission(user, permissionNames, accessToken) {
  if (!Array.isArray(permissionNames) || permissionNames.length === 0) return false;
  const set = getEffectivePermissions(user, accessToken);
  return permissionNames.some(p => set.has(p));
}

export function isAdmin(user, accessToken) {
  return hasPermission(user, 'admin', accessToken);
}


