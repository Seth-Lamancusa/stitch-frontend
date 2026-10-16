/**
 * Nested `author` accessors for message objects.
 * Write path still sends `content_author` on create/reply/import.
 */

export function getAuthorDisplayName(message) {
  if (!message) return 'Unknown';
  return message.author?.display_name || 'Unknown';
}

export function getAuthorUserTag(message) {
  if (!message) return null;
  return message.author?.user_tag || null;
}

export function getAuthorUid(message) {
  if (!message) return null;
  return message.author?.uid || null;
}

export function isAuthorBot(message) {
  if (!message) return false;
  return !!message.author?.is_bot;
}

export function isCurrentUserAuthor(message, user) {
  if (!message || !user) return false;
  const uid = getAuthorUid(message);
  const tag = getAuthorUserTag(message);
  if (uid && user.uid && uid === user.uid) return true;
  if (tag && user.user_tag && tag.toLowerCase() === String(user.user_tag).toLowerCase()) return true;
  return false;
}
