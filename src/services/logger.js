// Lightweight logger with levels and env gating
const isDev = typeof import.meta !== 'undefined' ? (import.meta.env?.DEV ?? true) : true;

function format(msg, meta) {
  try {
    if (!meta) return [msg];
    const safeMeta = typeof meta === 'object' ? meta : { meta };
    return [msg, safeMeta];
  } catch (_) {
    return [msg, meta];
  }
}

const logger = {
  info(msg, meta) { if (isDev) console.log('[app]', ...format(msg, meta)); },
  warn(msg, meta) { console.warn('[app]', ...format(msg, meta)); },
  error(msg, meta) { console.error('[app]', ...format(msg, meta)); },
};

export default logger;


