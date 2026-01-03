/**
 * Code Formatter Plugin
 * 
 * Formats code blocks using highlight.js.
 */
import { createFormatter } from './base';

// Will need to be installed: npm install highlight.js
let hljs = null;

/**
 * Lazy load highlight.js to avoid loading it if not needed
 * 
 * @returns {Object} - The highlight.js library
 */
async function getHighlightJs() {
  if (!hljs) {
    try {
      // Dynamic import for highlight.js
      const highlight = await import('highlight.js');
      hljs = highlight.default;
      
      // Also import the CSS - this should be included in your main CSS
      // import 'highlight.js/styles/github.css';
    } catch (error) {
      console.error('Error loading highlight.js:', error);
      
      // Return a fake highlighter that just returns the original code
      return {
        highlight: (language, code) => {
          return { value: code };
        },
        highlightAuto: (code) => {
          return { value: code };
        }
      };
    }
  }
  
  return hljs;
}

/**
 * Process the content to find and format code blocks
 * 
 * @param {string} content - The content to process
 * @returns {string} - The processed content
 */
async function processCodeBlocks(content) {
  const highlightJs = await getHighlightJs();
  
  // Find all code blocks: ```language\ncode\n```
  return content.replace(/```([^\n]*)\n([\s\S]*?)\n```/gm, (match, language, code) => {
    try {
      let highlighted;
      
      if (language && language.trim()) {
        // Use specified language
        highlighted = highlightJs.highlight(code, { language }).value;
      } else {
        // Auto-detect language
        highlighted = highlightJs.highlightAuto(code).value;
      }
      
      // Return formatted code
      return `<pre><code class="hljs language-${language || 'text'}">${highlighted}</code></pre>`;
    } catch (error) {
      console.error('Error highlighting code block:', error);
      return `<pre><code>${code}</code></pre>`;
    }
  });
}

/**
 * Process the content to find and format inline code
 * 
 * @param {string} content - The content to process
 * @returns {string} - The processed content
 */
function processInlineCode(content) {
  // Find all inline code: `code`
  return content.replace(/`([^`]+)`/g, (match, code) => {
    return `<code class="inline-code">${code}</code>`;
  });
}

/**
 * The code formatter implementation
 */
export const codeFormatter = createFormatter(
  'code',
  {}, // Default options
  50, // Medium-high priority
  async (content, context) => {
    if (!content) return '';
    
    try {
      // First process code blocks
      let processedContent = await processCodeBlocks(content);
      
      // Then process inline code
      processedContent = processInlineCode(processedContent);
      
      return processedContent;
    } catch (error) {
      console.error('Error processing code:', error);
      return content; // Return original content on error
    }
  }
);

// Export for registration
export default codeFormatter; 