/**
 * LaTeX Formatter Plugin
 * 
 * Formats LaTeX expressions using KaTeX.
 */
import { createFormatter } from './base';

// Will need to be installed: npm install katex
let katex = null;

/**
 * Lazy load KaTeX to avoid loading it if not needed
 * 
 * @returns {Object} - The KaTeX library
 */
async function getKaTeX() {
  if (!katex) {
    try {
      // Dynamic import for KaTeX
      katex = await import('katex');
      
      // Also import the CSS - this should be included in your main CSS
      // import 'katex/dist/katex.min.css';
    } catch (error) {
      console.error('Error loading KaTeX:', error);
      
      // Return a fake KaTeX that just returns the original expression
      return {
        renderToString: (tex, options) => {
          return `<span class="katex-error">${tex}</span>`;
        }
      };
    }
  }
  
  return katex;
}

/**
 * Process the content to find and render LaTeX blocks
 * 
 * @param {string} content - The content to process
 * @returns {string} - The processed content
 */
async function processLatexBlocks(content) {
  const katex = await getKaTeX();
  
  // Find all LaTeX blocks: $$latex$$
  // Modified regex to make sure we're capturing the entire content between $$...$$ sequences
  return content.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
    try {
      // Process the content between the dollar signs
      return katex.renderToString(latex, {
        displayMode: true,
        throwOnError: false
      });
    } catch (error) {
      console.error('Error rendering LaTeX block:', error);
      return `<div class="katex-error">${latex}</div>`;
    }
  });
}

/**
 * Process the content to find and render inline LaTeX
 * 
 * @param {string} content - The content to process
 * @returns {string} - The processed content
 */
async function processInlineLatex(content) {
  const katex = await getKaTeX();
  
  // Find all inline LaTeX: $latex$
  return content.replace(/\$([^\$\n]+)\$/g, (match, latex) => {
    try {
      return katex.renderToString(latex, {
        displayMode: false,
        throwOnError: false
      });
    } catch (error) {
      console.error('Error rendering inline LaTeX:', error);
      return `<span class="katex-error">${latex}</span>`;
    }
  });
}

/**
 * The LaTeX formatter implementation
 */
export const latexFormatter = createFormatter(
  'latex',
  {}, // Default options
  60, // Higher priority than markdown
  async (content, context) => {
    if (!content) return '';
    
    try {
      // First process block LaTeX
      let processedContent = await processLatexBlocks(content);
      
      // Then process inline LaTeX
      processedContent = await processInlineLatex(processedContent);
      
      return processedContent;
    } catch (error) {
      console.error('Error processing LaTeX:', error);
      return content; // Return original content on error
    }
  }
);

// Export for registration
export default latexFormatter; 