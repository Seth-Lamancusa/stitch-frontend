/**
 * Nested `author` accessors for message objects.
 * Write path still sends `content_author` on create/reply/import.
 */

import { invocationPreview } from './functionMessage.js';

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
    if (typeof name === 'string' && (Array.isArray(parameters) || (parameters && typeof parameters === 'object'))) {
      return invocationPreview(name, parameters);
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

export function isCurrentUserIdentity(uid, userTag, user) {
  if (!user) return false;
  if (uid && user.uid && uid === user.uid) return true;
  const tag = userTag == null ? '' : String(userTag).trim();
  const mine = user.user_tag == null ? '' : String(user.user_tag).trim();
  if (tag && mine && tag.toLowerCase() === mine.toLowerCase()) return true;
  return false;
}

export function isCurrentUserAuthor(message, user) {
  if (!message || !user) return false;
  return isCurrentUserIdentity(getAuthorUid(message), getAuthorUserTag(message), user);
}
