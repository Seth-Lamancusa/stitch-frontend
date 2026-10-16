// Compatibility layer for message object transition
// Migrating from flat fields (author_display_name) to nested object (author.display_name)

/**
 * Accessor for author display name that handles both formats
 * @param {Object} message - The message object
 * @returns {string} The display name
 */
export function getAuthorDisplayName(message) {
  if (!message) return 'Unknown';
  
  // New nested format
  if (message.author?.display_name) {
    return message.author.display_name;
  }
  
  // Fallback to legacy fields
  return message.author_display_name || 'Unknown';
}

/**
 * Accessor for author user tag that handles both formats
 * @param {Object} message - The message object
 * @returns {string|null} The user tag or null
 */
export function getAuthorUserTag(message) {
  if (!message) return null;
  
  // New nested format
  if (message.author?.user_tag) {
    return message.author.user_tag;
  }
  
  // Fallback to legacy fields
  return message.author_user_tag || null;
}

/**
 * Accessor for author UID that handles both formats
 * @param {Object} message - The message object
 * @returns {string|null} The UID or null
 */
export function getAuthorUid(message) {
  if (!message) return null;
  
  // New nested format
  if (message.author?.uid) {
    return message.author.uid;
  }
  
  // Fallback to legacy fields
  return message.content_author || null;
}

/**
 * Check if author is a bot
 * @param {Object} message - The message object
 * @returns {boolean} True if bot
 */
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

/**
 * Normalize a message object to have a consistent shape for UI components
 * This is useful when components expect one format but might receive mixed data
 * @param {Object} message - The raw message object
 * @returns {Object} Normalized message with helpers attached
 */
export function normalizeMessage(message) {
  if (!message) return null;
  
  return {
    ...message,
    // Add computed accessors (note: this creates a new object, not reactive by default in Vue 2/3 unless wrapped)
    get authorDisplayName() { return getAuthorDisplayName(message); },
    get authorUserTag() { return getAuthorUserTag(message); },
    get authorUid() { return getAuthorUid(message); },
    get isAuthorBot() { return isAuthorBot(message); }
  };
}

