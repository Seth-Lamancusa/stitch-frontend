/**
 * Markdown Formatter Plugin
 * 
 * Formats content with markdown-it.
 */
import { createFormatter } from './base';
import { protectLatexBlocks, protectInlineLatex, protectMermaidBlocks, protectMermaidHtml, restoreProtectedContent } from '../helpers/protection';

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
      // First, protect special content blocks so markdown doesn't process them
      // Protect rendered mermaid HTML first (from mermaid formatter that ran earlier)
      // Then protect any remaining raw mermaid blocks
      // LaTeX expressions need protection
      let processedContent = content;
      
      const debug = context?.options?.debugMermaid || false;
      if (debug) {
        const mermaidHtmlMatches = (processedContent.match(/<div\s+class=["']mermaid-diagram["'][^>]*>/gi) || []).length;
        console.log('[Markdown Formatter] Found', mermaidHtmlMatches, 'rendered mermaid HTML block(s) to protect');
      }
      
      processedContent = protectMermaidHtml(processedContent, context); // Protect rendered HTML
      processedContent = protectMermaidBlocks(processedContent, context); // Protect any remaining raw blocks
      processedContent = protectLatexBlocks(processedContent, context);
      processedContent = protectInlineLatex(processedContent, context);
      
      // Process the content with markdown-it
      const md = await getMarkdownIt();
      processedContent = md.render(processedContent);
      
      if (debug) {
        console.log('[Markdown Formatter] After markdown processing, protected zones count:', context.protectedZones?.size || 0);
      }
      
      // Add target="_blank" to all links so they open in new tabs
      processedContent = processedContent.replace(/<a\s+([^>]*?)>/gi, (match, attrs) => {
        // Check if target is already set
        if (/target\s*=/i.test(attrs)) {
          // Replace existing target with _blank
          return `<a ${attrs.replace(/target\s*=\s*["'][^"']*["']/gi, 'target="_blank"')}>`;
        } else {
          // Add target="_blank" and rel for security
          return `<a ${attrs} target="_blank" rel="noopener noreferrer">`;
        }
      });
      
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