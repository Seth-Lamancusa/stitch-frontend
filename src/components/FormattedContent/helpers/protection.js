/**
 * Protection Helper
 * 
 * Provides utilities for protecting certain content from being processed
 * by other formatters, particularly for code blocks and LaTeX.
 */

import { getInlineDollarSegments, looksLikeLatexInline } from './inlineDollarMath';

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

  // Protect inline `$...$` that looks like LaTeX.
  // This scanner is careful about escaped dollars inside math like `\\$900`.
  let processedContent = content;

  // Note: we avoid regex /\$([^$\n]+)\$/ because it breaks on inner `\$...`.
  const segments = getInlineDollarSegments(content);
  if (segments.length > 0) {
    let out = '';
    let cursor = 0;
    for (const seg of segments) {
      out += content.slice(cursor, seg.start);

      if (looksLikeLatexInline(seg.inner)) {
        const placeholder = generatePlaceholder('latex_inline');
        protectedZones.set(placeholder, {
          type: 'latex_inline',
          original: content.slice(seg.start, seg.end),
          content: seg.inner
        });
        out += placeholder;
      } else {
        out += content.slice(seg.start, seg.end);
      }

      cursor = seg.end;
    }
    processedContent = out + content.slice(cursor);
  }
  
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
 * Protect Mermaid code blocks from markdown processing
 * 
 * @param {string} content - The content to process
 * @param {Object} context - The processing context
 * @returns {string} - The content with mermaid blocks replaced by placeholders
 */
export function protectMermaidBlocks(content, context) {
  const { protectedZones } = context;
  
  // Match mermaid code blocks: ```mermaid\ncode\n```
  const mermaidBlockRegex = /```mermaid\s*\n([\s\S]*?)\n```/gim;
  
  // Replace mermaid blocks with placeholders
  return content.replace(mermaidBlockRegex, (match, code) => {
    const placeholder = generatePlaceholder('mermaid_block');
    
    // Store full match with the placeholder
    protectedZones.set(placeholder, {
      type: 'mermaid_block',
      original: match,
      content: code.trim()
    });
    
    return placeholder;
  });
}

/**
 * Protect already-rendered Mermaid HTML from markdown processing
 * 
 * @param {string} content - The content to process
 * @param {Object} context - The processing context
 * @returns {string} - The content with mermaid HTML replaced by placeholders
 */
export function protectMermaidHtml(content, context) {
  const { protectedZones } = context;
  
  // Match rendered mermaid HTML: <div class="mermaid-diagram">...</div>
  // Need to match from opening tag to matching closing tag, handling nested content
  // We'll use a simple approach: find opening tag, then find matching closing tag
  const openingTagRegex = /<div\s+class=["']mermaid-diagram["'][^>]*>/gi;
  
  let result = content;
  let match;
  const matches = [];
  
  // Find all opening tags and their matching closing tags
  while ((match = openingTagRegex.exec(content)) !== null) {
    const startIndex = match.index;
    const tagStart = match[0];
    
    // Find the matching closing </div> tag
    // Count nested divs to find the correct closing tag
    let depth = 1;
    let currentIndex = startIndex + tagStart.length;
    
    while (depth > 0 && currentIndex < content.length) {
      const nextOpen = content.indexOf('<div', currentIndex);
      const nextClose = content.indexOf('</div>', currentIndex);
      
      if (nextClose === -1) break; // No closing tag found
      
      if (nextOpen !== -1 && nextOpen < nextClose) {
        // Found nested div
        depth++;
        currentIndex = nextOpen + 4;
      } else {
        // Found closing div
        depth--;
        if (depth === 0) {
          // Found matching closing tag
          const endIndex = nextClose + 6; // 6 = length of '</div>'
          const fullMatch = content.substring(startIndex, endIndex);
          
          matches.push({
            fullMatch,
            startIndex,
            endIndex
          });
          break;
        }
        currentIndex = nextClose + 6;
      }
    }
  }
  
  // Replace in reverse order to preserve indices
  for (let i = matches.length - 1; i >= 0; i--) {
    const { fullMatch, startIndex, endIndex } = matches[i];
    const placeholder = generatePlaceholder('mermaid_html');
    
    // Store the rendered HTML
    protectedZones.set(placeholder, {
      type: 'mermaid_html',
      original: fullMatch,
      html: fullMatch
    });
    
    result = result.slice(0, startIndex) + placeholder + result.slice(endIndex);
  }
  
  return result;
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
