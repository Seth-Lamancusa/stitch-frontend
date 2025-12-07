import { createFormatter } from './base';

const TAG_TOKEN_RE = /(^|[\s([{])#([A-Za-z0-9-]{1,32})(?![A-Za-z0-9-])/gm;
const MENTION_TOKEN_RE = /(^|[\s([{])@([A-Za-z0-9-]{2,24})(?![A-Za-z0-9-])(?=[^\w@.]|$)/gm;
const SKIP_TAGS = new Set(['CODE', 'PRE', 'KBD', 'SAMP']);

const normalizeSet = (source) => {
  const set = new Set();
  if (!source) return set;
  const addValue = (value) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return;
    set.add(trimmed);
  };
  if (source instanceof Set) {
    source.forEach(addValue);
  } else if (Array.isArray(source)) {
    source.forEach(addValue);
  } else if (typeof source === 'object') {
    Object.values(source).forEach(addValue);
  }
  return set;
};

const collectMatches = (text, baseRegex, tokenPrefix, shouldHighlight, type) => {
  const matches = [];
  const regex = new RegExp(baseRegex.source, baseRegex.flags);
  let match;
  while ((match = regex.exec(text)) !== null) {
    const prefix = match[1] || '';
    const body = match[2] || '';
    const normalized = body.toLowerCase();
    if (!shouldHighlight(normalized)) continue;
    const tokenText = `${tokenPrefix}${body}`;
    const start = match.index + prefix.length;
    const end = start + tokenText.length;
    matches.push({ start, end, text: tokenText, normalized, type });
  }
  return matches;
};

const highlightTextNode = (node, sets) => {
  const text = node.nodeValue;
  if (!text || typeof text !== 'string') return;
  const tagMatches = collectMatches(
    text,
    TAG_TOKEN_RE,
    '#',
    (token) => sets.tags.has(token),
    'tag'
  );
  const mentionMatches = collectMatches(
    text,
    MENTION_TOKEN_RE,
    '@',
    (token) => sets.mentions.has(token),
    'mention'
  );
  const matches = [...tagMatches, ...mentionMatches].sort((a, b) => a.start - b.start);
  if (matches.length === 0) return;

  const doc = node.ownerDocument || (typeof window !== 'undefined' ? window.document : null);
  if (!doc) return;

  const fragment = doc.createDocumentFragment();
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue;
    if (match.start > cursor) {
      fragment.appendChild(doc.createTextNode(text.slice(cursor, match.start)));
    }
    const span = doc.createElement('span');
    span.className = match.type === 'tag'
      ? 'fc-inline-token fc-inline-token--tag'
      : 'fc-inline-token fc-inline-token--mention';
    span.textContent = match.text;
    span.setAttribute('data-token', match.normalized);
    fragment.appendChild(span);
    cursor = match.end;
  }
  if (cursor < text.length) {
    fragment.appendChild(doc.createTextNode(text.slice(cursor)));
  }
  node.replaceWith(fragment);
};

const walkNodes = (node, sets) => {
  if (!node) return;
  if (node.nodeType === Node.TEXT_NODE) {
    highlightTextNode(node, sets);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  if (SKIP_TAGS.has(node.tagName)) {
    return;
  }
  const children = Array.from(node.childNodes);
  children.forEach(child => walkNodes(child, sets));
};

const mentionsHashtagsFormatter = createFormatter(
  'mentions_hashtags',
  {},
  120,
  async (content, context = {}) => {
    if (!content) return '';
    if (typeof window === 'undefined' || !window.document) return content;

    const options = context.options || {};
    const tags = normalizeSet(options.validTags);
    const mentions = normalizeSet(options.validMentions);

    if (tags.size === 0 && mentions.size === 0) {
      return content;
    }

    const container = window.document.createElement('div');
    container.innerHTML = content;

    walkNodes(container, { tags, mentions });

    return container.innerHTML;
  }
);

export default mentionsHashtagsFormatter;

