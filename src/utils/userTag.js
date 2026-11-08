export const USER_TAG_MIN = 3
export const USER_TAG_MAX = 20

const CHARSET_RE = /^[a-z0-9-]+$/
const USER_TAG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const USER_TAG_HINT = '3–20 characters: lowercase letters, numbers, and single hyphens.'

/** What we store. Does not validate. */
export function canonicalUserTag(value) {
  return (value ?? '').toString().trim().toLowerCase()
}

/** Keep the field in the allowed alphabet while the person is typing. */
export function sanitizeUserTagInput(value) {
  return canonicalUserTag(value).replace(/[^a-z0-9-]/g, '').slice(0, USER_TAG_MAX)
}

/**
 * Empty string when the tag is acceptable.
 * `required` is false for a profile field the person may leave untouched.
 */
export function userTagError(value, { required = true } = {}) {
  const tag = canonicalUserTag(value)
  if (!tag) return required ? 'Tag is required' : ''
  if (tag.length < USER_TAG_MIN) return 'Tag must be at least 3 characters long'
  if (tag.length > USER_TAG_MAX) return 'Tag must be no more than 20 characters long'
  if (!CHARSET_RE.test(tag)) return 'Tag must contain only lowercase letters, numbers, and hyphens'
  if (!USER_TAG_RE.test(tag)) return 'Tag cannot start or end with a hyphen or contain a double hyphen'
  return ''
}
