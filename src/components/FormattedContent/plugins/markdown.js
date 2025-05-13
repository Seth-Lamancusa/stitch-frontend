/**
 * Markdown Formatter Plugin
 * 
 * Formats content with markdown-it.
 */
import { createFormatter } from './base';
import { protectCodeBlocks, protectInlineCode, protectLatexBlocks, protectInlineLatex, restoreProtectedContent } from '../helpers/protection';

// Will need to be installed: npm install markdown-it
let markdownIt = null;

/**
 * Lazy load markdown-it to avoid loading it if not needed
 * 
 * @returns {Object} - The markdown-it instance
 */
async function getMarkdownIt() {
  if (!markdownIt) {
    try {
      // Dynamic import for markdown-it
      const md = await import('markdown-it');
      markdownIt = md.default({
        html: false,
        breaks: true,
        linkify: true,
        typographer: true
      });
    } catch (error) {
      console.error('Error loading markdown-it:', error);
      
      // Return a fake markdown-it that just escapes HTML
      return {
        render: (content) => {
          return content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        }
      };
    }
  }
  
  return markdownIt;
}

/**
 * The markdown formatter implementation
 */
export const markdownFormatter = createFormatter(
  'markdown',
  {}, // Default options
  40, // Medium priority
  async (content, context) => {
    if (!content) return '';
    
    try {
      // First, protect code blocks and LaTeX expressions
      // so markdown doesn't process them
      let processedContent = content;
      processedContent = protectCodeBlocks(processedContent, context);
      processedContent = protectInlineCode(processedContent, context);
      processedContent = protectLatexBlocks(processedContent, context);
      processedContent = protectInlineLatex(processedContent, context);
      
      // Process the content with markdown-it
      const md = await getMarkdownIt();
      processedContent = md.render(processedContent);
      
      // Restore protected content
      processedContent = restoreProtectedContent(processedContent, context);
      
      return processedContent;
    } catch (error) {
      console.error('Error processing markdown:', error);
      return content; // Return original content on error
    }
  }
);

// Export for registration
export default markdownFormatter; 