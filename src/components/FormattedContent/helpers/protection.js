/**
 * Protection Helper
 * 
 * Provides utilities for protecting certain content from being processed
 * by other formatters, particularly for code blocks and LaTeX.
 */

/**
 * Generate a unique placeholder for protected content
 * 
 * @param {string} type - The type of content being protected
 * @returns {string} - A unique placeholder string
 */
export function generatePlaceholder(type) {
  const uniqueId = Math.random().toString(36).substring(2, 10);
  return `STITCH_PROTECTED_${type.toUpperCase()}_${uniqueId}`;
}

/**
 * Protect code blocks from further processing
 * 
 * @param {string} content - The content to process
 * @param {Object} context - The processing context
 * @returns {string} - The content with code blocks replaced by placeholders
 */
export function protectCodeBlocks(content, context) {
  const { protectedZones } = context;
  
  // Match code blocks with language specification: ```language\ncode\n```
  // Relaxed regex to allow any characters in language string (except newline)
  const codeBlockRegex = /```([^\n]*)\n([\s\S]*?)\n```/gm;
  
  // Replace code blocks with placeholders
  return content.replace(codeBlockRegex, (match, language, code) => {
    const placeholder = generatePlaceholder('code_block');
    
    // Store full match with the placeholder
    protectedZones.set(placeholder, {
      type: 'code_block',
      original: match,
      language,
      content: code
    });
    
    return placeholder;
  });
}

/**
 * Protect inline code from further processing
 * 
 * @param {string} content - The content to process
 * @param {Object} context - The processing context
 * @returns {string} - The content with inline code replaced by placeholders
 */
export function protectInlineCode(content, context) {
  const { protectedZones } = context;
  
  // Match inline code: `code`
  const inlineCodeRegex = /`([^`]+)`/g;
  
  // Replace inline code with placeholders
  return content.replace(inlineCodeRegex, (match, code) => {
    const placeholder = generatePlaceholder('inline_code');
    
    // Store full match with the placeholder
    protectedZones.set(placeholder, {
      type: 'inline_code',
      original: match,
      content: code
    });
    
    return placeholder;
  });
}

/**
 * Protect LaTeX blocks from further processing
 * 
 * @param {string} content - The content to process
 * @param {Object} context - The processing context
 * @returns {string} - The content with LaTeX blocks replaced by placeholders
 */
export function protectLatexBlocks(content, context) {
  const { protectedZones } = context;
  
  let processedContent = content;
  
  // Match LaTeX blocks: $$latex$$
  // Ensure we're using the global and multiline flags for consistent matching
  const latexBlockRegex = /\$\$([\s\S]*?)\$\$/gm;
  
  // Replace LaTeX blocks with placeholders
  processedContent = processedContent.replace(latexBlockRegex, (match, latex) => {
    const placeholder = generatePlaceholder('latex_block');
    
    // Store the entire original match
    protectedZones.set(placeholder, {
      type: 'latex_block',
      original: match,
      content: latex
    });
    
    return placeholder;
  });
  
  // Match LaTeX display math blocks: \[latex\]
  const latexDisplayRegex = /\\\[([\s\S]*?)\\\]/gm;
  
  // Replace LaTeX display math blocks with placeholders
  processedContent = processedContent.replace(latexDisplayRegex, (match, latex) => {
    const placeholder = generatePlaceholder('latex_block');
    
    // Store the entire original match
    protectedZones.set(placeholder, {
      type: 'latex_block',
      original: match,
      content: latex
    });
    
    return placeholder;
  });
  
  return processedContent;
}

/**
 * Protect inline LaTeX from further processing
 * 
 * @param {string} content - The content to process
 * @param {Object} context - The processing context
 * @returns {string} - The content with inline LaTeX replaced by placeholders
 */
export function protectInlineLatex(content, context) {
  const { protectedZones } = context;
  
  let processedContent = content;
  
  // Match inline LaTeX: $latex$
  const inlineLatexRegex = /\$([^\$\n]+)\$/g;
  
  // Replace inline LaTeX with placeholders
  processedContent = processedContent.replace(inlineLatexRegex, (match, latex) => {
    const placeholder = generatePlaceholder('latex_inline');
    
    // Store full match with the placeholder
    protectedZones.set(placeholder, {
      type: 'latex_inline',
      original: match,
      content: latex
    });
    
    return placeholder;
  });
  
  // Match inline LaTeX: \(latex\)
  // Use non-greedy match to capture content between \( and \)
  const inlineLatexParenRegex = /\\\(([\s\S]*?)\\\)/g;
  
  // Replace inline LaTeX with placeholders
  processedContent = processedContent.replace(inlineLatexParenRegex, (match, latex) => {
    const placeholder = generatePlaceholder('latex_inline');
    
    // Store full match with the placeholder
    protectedZones.set(placeholder, {
      type: 'latex_inline',
      original: match,
      content: latex
    });
    
    return placeholder;
  });
  
  return processedContent;
}

/**
 * Restore all protected content
 * 
 * @param {string} content - The content with placeholders
 * @param {Object} context - The processing context
 * @returns {string} - The content with original protected content restored
 */
export function restoreProtectedContent(content, context) {
  const { protectedZones } = context;
  
  let result = content;
  
  // Replace placeholders with original content
  for (const [placeholder, data] of protectedZones.entries()) {
    // Check if we have an object with 'original' property or just a string
    const originalContent = typeof data === 'object' && data.original 
      ? data.original 
      : (typeof data === 'string' ? data : placeholder);
    
    // Use a literal string replacement to avoid regex issues with special characters
    result = result.split(placeholder).join(originalContent);
  }
  
  return result;
} 