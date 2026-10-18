// Lightweight app configuration for public SPA
// Admin origin is where the separate admin UI is hosted
// Defaults to same host with admin subdomain if not provided

const DEFAULT_ADMIN_ORIGIN = (function computeDefaultAdminOrigin() {
  try {
    const { protocol, host } = window.location;
    // If already on an admin subdomain, keep as-is
    if (host.startsWith('admin.')) return `${protocol}//${host}`;
    // Otherwise, prefix with admin. for common setups
    return `${protocol}//admin.${host}`;
  } catch {
    return 'https://admin.stitch.fyi';
  }
})();

export const ADMIN_ORIGIN =
  window.__STITCH_ADMIN_ORIGIN__ || import.meta.env.VITE_ADMIN_ORIGIN || DEFAULT_ADMIN_ORIGIN;

// Public app host. Marketing stays on https://stitch.fyi.
export const APP_ORIGIN = 'https://app.stitch.fyi';
export const APP_HOST = 'app.stitch.fyi';

export function appUrl(path = '/') {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${APP_ORIGIN}${normalized}`;
}

export function messageUrl(id) {
  return appUrl(`/messages/${id}`);
}

export default {
  ADMIN_ORIGIN,
  APP_ORIGIN,
  APP_HOST,
};


