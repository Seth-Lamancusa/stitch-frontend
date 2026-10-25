/** Ephemeral typing cues. Entries expire when they are not refreshed. */

export const TYPING_TTL_MS = 8000

function cueName(author) {
  const tag = String(author?.user_tag || '').replace(/^@/, '').trim()
  if (tag) return `@${tag}`
  const displayName = String(author?.display_name || '').trim()
  return displayName
}

export function authorsAt(entries, targetMessageId) {
  if (!targetMessageId || !entries) return []
  const authors = []
  for (const entry of Object.values(entries)) {
    if (entry?.targetMessageId === targetMessageId && entry.author) {
      authors.push(entry.author)
    }
  }
  authors.sort((a, b) => cueName(a).localeCompare(cueName(b)))
  return authors
}

export function typingLabel(authors) {
  const names = (authors || []).map(cueName).filter(Boolean)
  if (names.length === 0) return ''
  if (names.length === 1) return `${names[0]} is typing`
  if (names.length === 2) return `${names[0]}, ${names[1]} are typing`
  return `${names[0]} +${names.length - 1} are typing`
}

export function sweepEntries(entries, now, ttl = TYPING_TTL_MS) {
  const next = {}
  for (const [key, entry] of Object.entries(entries || {})) {
    if (entry && now - entry.at < ttl) next[key] = entry
  }
  return next
}

export function cueKey(authorUid, targetMessageId) {
  return `${authorUid}\0${targetMessageId}`
}
