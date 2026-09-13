/**
 * Sole source of permission string literals (mirrors app/auth/constants.py).
 * App UI must import P.* — never hard-code permission strings elsewhere.
 */

export const P = Object.freeze({
  MESSAGES_READ: 'messages.read',
  MESSAGES_WRITE: 'messages.write',
  MESSAGES_IMPORT_AUDIO: 'messages.import.audio',
  MESSAGES_IMPORT_CURSOR: 'messages.import.cursor',
  CHANNELS_CREATE: 'channels.create',
  ADMIN: 'admin',
  REALTIME_CONNECT: 'realtime.connect',
})

/** @deprecated Prefer P.*; kept for one-shot call-site migration helpers */
export const LEGACY_TO_NEW = Object.freeze({
  'msg.read': P.MESSAGES_READ,
  'msg.write': P.MESSAGES_WRITE,
  'msg.import.audio': P.MESSAGES_IMPORT_AUDIO,
  'msg.import.cursor': P.MESSAGES_IMPORT_CURSOR,
  'channel.create': P.CHANNELS_CREATE,
  admin: P.ADMIN,
  ws: P.REALTIME_CONNECT,
  [P.MESSAGES_READ]: P.MESSAGES_READ,
  [P.MESSAGES_WRITE]: P.MESSAGES_WRITE,
  [P.MESSAGES_IMPORT_AUDIO]: P.MESSAGES_IMPORT_AUDIO,
  [P.MESSAGES_IMPORT_CURSOR]: P.MESSAGES_IMPORT_CURSOR,
  [P.CHANNELS_CREATE]: P.CHANNELS_CREATE,
  [P.ADMIN]: P.ADMIN,
  [P.REALTIME_CONNECT]: P.REALTIME_CONNECT,
})

export function normalizePermission(token) {
  const raw = String(token || '').trim()
  if (!raw) return null
  return LEGACY_TO_NEW[raw] || raw
}

export function parsePermissions(value) {
  if (value == null) return []
  const parts = Array.isArray(value)
    ? value
    : String(value).split(/\s+/)
  const out = new Set()
  for (const p of parts) {
    const n = normalizePermission(p)
    if (n) out.add(n)
  }
  return Array.from(out)
}

export function formatPermissions(perms) {
  return parsePermissions(perms).sort().join(' ')
}

export const DEFAULT_MANAGED_PERMISSIONS = formatPermissions([
  P.MESSAGES_READ,
  P.MESSAGES_WRITE,
  P.REALTIME_CONNECT,
])

export const DEFAULT_API_KEY_CAP = formatPermissions([
  P.MESSAGES_READ,
  P.MESSAGES_WRITE,
])
