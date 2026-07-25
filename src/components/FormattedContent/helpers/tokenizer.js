/**
 * Content Tokenizer
 * 
 * Splits content into tokens that can be processed separately
 * based on their type (markdown, latex, code, etc.)
 */

// Token types
export const TOKEN_TYPES = {
  TEXT: 'text',
  CODE_BLOCK: 'code_block',
  INLINE_CODE: 'inline_code',
  LATEX_BLOCK: 'latex_block',
  LATEX_INLINE: 'latex_inline',
  MARKDOWN: 'markdown',
};

/**
 * Token class to represent a segment of content
 */
export class Token {
  constructor(type, content, meta = {}) {
    this.type = type;
    this.content = content;
    this.meta = meta;
    this.processed = false;
  }
  
  /**
   * Mark the token as processed
   */
  markProcessed() {
    this.processed = true;
  }
  
  /**
   * Check if the token should be processed by a specific formatter
   * 
   * @param {string} formatterName - The name of the formatter
   * @returns {boolean} - Whether the formatter should process this token
   */
  shouldProcessWith(formatterName) {
    if (this.processed) return false;
    
    // Allow processing based on token type
    switch (this.type) {
      case TOKEN_TYPES.CODE_BLOCK:
      case TOKEN_TYPES.INLINE_CODE:
        return formatterName === 'code';
        
      case TOKEN_TYPES.LATEX_BLOCK:
      case TOKEN_TYPES.LATEX_INLINE:
        return formatterName === 'latex';
        
      case TOKEN_TYPES.TEXT:
      case TOKEN_TYPES.MARKDOWN:
        return formatterName === 'markdown';
        
      default:
        return false;
    }
  }
}

/**
 * Tokenize content into processable chunks
 * 
 * @param {string} content - The content to tokenize
 * @returns {Token[]} - Array of tokens
 */
export function tokenize(content) {
  if (!content) return [];
  
  const tokens = [];
  let remaining = content;
  
  // Process content into tokens
  while (remaining.length > 0) {
    // Try to match code blocks first (```)
    const codeBlockMatch = remaining.match(/^```([a-z]*)\n([\s\S]*?)\n```/m);
    if (codeBlockMatch) {
      const [fullMatch, language, code] = codeBlockMatch;
      tokens.push(new Token(TOKEN_TYPES.CODE_BLOCK, code, { language }));
      remaining = remaining.slice(fullMatch.length);
      continue;
    }
    
    // Try to match inline code (`)
    const inlineCodeMatch = remaining.match(/^`([^`]+)`/);
    if (inlineCodeMatch) {
      const [fullMatch, code] = inlineCodeMatch;
      tokens.push(new Token(TOKEN_TYPES.INLINE_CODE, code));
      remaining = remaining.slice(fullMatch.length);
      continue;
    }
    
    // Try to match LaTeX block ($$)
    const latexBlockMatch = remaining.match(/^\$\$([\s\S]*?)\$\$/m);
    if (latexBlockMatch) {
      const [fullMatch, latex] = latexBlockMatch;
      tokens.push(new Token(TOKEN_TYPES.LATEX_BLOCK, latex));
      remaining = remaining.slice(fullMatch.length);
      continue;
    }
    
    // Try to match inline LaTeX ($)
    const latexInlineMatch = remaining.match(/^\$([^\$\n]+)\$/);
    if (latexInlineMatch) {
      const [fullMatch, latex] = latexInlineMatch;
      tokens.push(new Token(TOKEN_TYPES.LATEX_INLINE, latex));
      remaining = remaining.slice(fullMatch.length);
      continue;
    }
    
    // If no special token is found, take the text until the next special token
    const nextTokenIndex = findNextTokenStart(remaining);
    if (nextTokenIndex > 0) {
      tokens.push(new Token(TOKEN_TYPES.TEXT, remaining.slice(0, nextTokenIndex)));
      remaining = remaining.slice(nextTokenIndex);
    } else {
      // No more special tokens, take all remaining text
      tokens.push(new Token(TOKEN_TYPES.TEXT, remaining));
      remaining = '';
    }
  }
  
  return tokens;
}

/**
 * Find the index of the next token start in the content
 * 
 * @param {string} content - The content to search in
 * @returns {number} - The index of the next token, or -1 if none found
 */
function findNextTokenStart(content) {
  const patterns = [
    '```', '`', '$$', '$'
  ];
  
  const indices = patterns
    .map(pattern => ({ pattern, index: content.indexOf(pattern, 1) }))
    .filter(item => item.index > 0)
    .sort((a, b) => a.index - b.index);
  
  return indices.length > 0 ? indices[0].index : -1;
}

/**
 * Convert an array of tokens back to a string
 * 
 * @param {Token[]} tokens - The tokens to convert
 * @returns {string} - The resulting content
 */
export function tokensToString(tokens) {
  return tokens.map(token => {
    switch (token.type) {
      case TOKEN_TYPES.CODE_BLOCK:
        return `\`\`\`${token.meta.language || ''}\n${token.content}\n\`\`\``;
        
      case TOKEN_TYPES.INLINE_CODE:
        return `\`${token.content}\``;
        
      case TOKEN_TYPES.LATEX_BLOCK:
        return `$$${token.content}$$`;
        
      case TOKEN_TYPES.LATEX_INLINE:
        return `$${token.content}$`;
        
      default:
        return token.content;
    }
  }).join('');
} 