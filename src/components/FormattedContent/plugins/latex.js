/**
 * LaTeX Formatter Plugin
 * 
 * Formats LaTeX expressions using KaTeX.
 */
import { createFormatter } from './base';
import { getInlineDollarSegments, looksLikeLatexInline } from '../helpers/inlineDollarMath';

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
  
  // Process LaTeX display math blocks: $$latex$$ and \[latex\]
  let processedContent = content;
  
  // Find all LaTeX blocks: $$latex$$
  // Modified regex to make sure we're capturing the entire content between $$...$$ sequences
  processedContent = processedContent.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
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
  
  // Find all LaTeX display math blocks: \[latex\]
  processedContent = processedContent.replace(/\\\[([\s\S]*?)\\\]/g, (match, latex) => {
    try {
      // Process the content between \[ and \]
      return katex.renderToString(latex, {
        displayMode: true,
        throwOnError: false
      });
    } catch (error) {
      console.error('Error rendering LaTeX block:', error);
      return `<div class="katex-error">${latex}</div>`;
    }
  });
  
  return processedContent;
}

/**
 * Process the content to find and render inline LaTeX
 * 
 * @param {string} content - The content to process
 * @returns {string} - The processed content
 */
async function processInlineLatex(content) {
  const katex = await getKaTeX();

  // Inline `$...$` (with awareness of escaped dollars like `\\$900`).
  // We also apply a heuristic: if the inside doesn't really look like LaTeX,
  // we treat it as literal currency text and convert `$123$` -> `$123`.
  let processedContent = '';
  let cursor = 0;
  const segments = getInlineDollarSegments(content);

  for (const seg of segments) {
    processedContent += content.slice(cursor, seg.start);

    if (!looksLikeLatexInline(seg.inner)) {
      // Not LaTeX: keep the original `$...$` verbatim.
      processedContent += content.slice(seg.start, seg.end);
      cursor = seg.end;
      continue;
    }

    try {
      processedContent += katex.renderToString(seg.inner, {
        displayMode: false,
        throwOnError: false
      });
    } catch (error) {
      console.error('Error rendering inline LaTeX:', error);
      processedContent += `<span class="katex-error">${seg.inner}</span>`;
    }

    cursor = seg.end;
  }

  processedContent += content.slice(cursor);
  
  // Find all inline LaTeX: \(latex\)
  // Use non-greedy match to capture content between \( and \)
  processedContent = processedContent.replace(/\\\(([\s\S]*?)\\\)/g, (match, latex) => {
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
  
  return processedContent;
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
