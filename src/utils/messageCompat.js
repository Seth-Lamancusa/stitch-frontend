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

/**
 * Readable text for a message `content` value.
 * Normal messages are already strings. Function messages are one dictionary.
 * @param {*} content
 * @returns {string}
 */
export function contentText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'object') {
    const name = content.name;
    const parameters = content.parameters;
    if (typeof name === 'string' && Array.isArray(parameters)) {
      const args = parameters.map((param) => JSON.stringify(param)).join(', ');
      return `${name}(${args})`;
    }
    if (Object.prototype.hasOwnProperty.call(content, 'output')) {
      const output = content.output;
      if (typeof output === 'string') return output;
      try {
        return JSON.stringify(output);
      } catch {
        return String(output);
      }
    }
    try {
      return JSON.stringify(content);
    } catch {
      return String(content);
    }
  }
  return String(content);
}

export function isCurrentUserAuthor(message, user) {
  if (!message || !user) return false;
  const uid = getAuthorUid(message);
  const tag = getAuthorUserTag(message);
  if (uid && user.uid && uid === user.uid) return true;
  if (tag && user.user_tag && tag.toLowerCase() === String(user.user_tag).toLowerCase()) return true;
  return false;
}
