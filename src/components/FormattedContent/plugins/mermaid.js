/**
 * Mermaid Formatter Plugin
 * 
 * Renders Mermaid diagram code blocks as SVG diagrams.
 */
import { createFormatter } from './base';

// Mermaid library instance (lazy loaded)
let mermaid = null;
let mermaidInitialized = false;

// Counter for unique diagram IDs
let diagramCounter = 0;

/**
 * Lazy load Mermaid to avoid loading it if not needed
 * 
 * @returns {Object} - The Mermaid library
 */
async function getMermaid() {
  if (!mermaid) {
    try {
      console.log('[Mermaid Formatter] Loading Mermaid library...');
      
      // Dynamic import for mermaid
      const mermaidModule = await import('mermaid');
      mermaid = mermaidModule.default;
      
      console.log('[Mermaid Formatter] Mermaid module imported:', {
        hasDefault: !!mermaid,
        hasInitialize: typeof mermaid?.initialize === 'function',
        hasRender: typeof mermaid?.render === 'function'
      });
      
      // Initialize mermaid with default config
      if (!mermaidInitialized) {
        console.log('[Mermaid Formatter] Initializing Mermaid...');
        
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'strict',
          fontFamily: 'var(--font-family-base)',
          flowchart: {
            htmlLabels: true,
            curve: 'basis'
          },
          sequence: {
            diagramMarginX: 10,
            diagramMarginY: 10,
            actorMargin: 50,
            width: 150,
            height: 65,
            boxMargin: 10,
            boxTextMargin: 5,
            noteMargin: 10,
            messageMargin: 35
          },
          gantt: {
            titleTopMargin: 25,
            barHeight: 20,
            barGap: 4,
            topPadding: 50,
            leftPadding: 75,
            gridLineStartPadding: 35,
            fontSize: 11
          }
        });
        
        mermaidInitialized = true;
        console.log('[Mermaid Formatter] Mermaid initialized successfully');
      }
    } catch (error) {
      console.error('[Mermaid Formatter] Error loading Mermaid:', error);
      console.error('[Mermaid Formatter] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Return null to indicate mermaid is not available
      return null;
    }
  }
  
  return mermaid;
}

/**
 * Generate a unique ID for each diagram
 * 
 * @returns {string} - Unique diagram ID
 */
function generateDiagramId() {
  return `mermaid-diagram-${Date.now()}-${diagramCounter++}`;
}

/**
 * Render a mermaid diagram to SVG
 * 
 * @param {string} code - The mermaid diagram code
 * @param {boolean} debug - Whether to log debug information
 * @returns {string} - The rendered SVG or error HTML
 */
async function renderMermaidDiagram(code, debug = false) {
  if (debug) {
    console.log('[Mermaid Formatter] renderMermaidDiagram called with code:', code);
  }
  
  const mermaidLib = await getMermaid();
  
  if (!mermaidLib) {
    console.error('[Mermaid Formatter] Mermaid library failed to load');
    // Mermaid not available, return error placeholder
    return `<div class="mermaid-error">
      <span class="mermaid-error-icon">⚠️</span>
      <span class="mermaid-error-text">Mermaid library not available. Check console for details.</span>
      <pre class="mermaid-error-code">${escapeHtml(code)}</pre>
    </div>`;
  }
  
  if (debug) {
    console.log('[Mermaid Formatter] Mermaid library loaded successfully');
  }
  
  try {
    const diagramId = generateDiagramId();
    
    if (debug) {
      console.log('[Mermaid Formatter] Rendering diagram with ID:', diagramId);
    }
    
    // Use mermaid's render API to generate SVG
    const { svg } = await mermaidLib.render(diagramId, code);
    
    if (debug) {
      console.log('[Mermaid Formatter] Diagram rendered successfully, SVG length:', svg?.length || 0);
    }
    
    return `<div class="mermaid-diagram">${svg}</div>`;
  } catch (error) {
    console.error('[Mermaid Formatter] Error rendering Mermaid diagram:', error);
    console.error('[Mermaid Formatter] Error details:', {
      message: error.message,
      stack: error.stack,
      code: code.substring(0, 200)
    });
    
    // Return error message with the original code
    return `<div class="mermaid-error">
      <span class="mermaid-error-icon">⚠️</span>
      <span class="mermaid-error-text">Diagram syntax error: ${escapeHtml(error.message || 'Unknown error')}</span>
      <details class="mermaid-error-details">
        <summary>Show error details</summary>
        <pre class="mermaid-error-code">${escapeHtml(code)}</pre>
        <pre class="mermaid-error-stack">${escapeHtml(error.stack || 'No stack trace available')}</pre>
      </details>
    </div>`;
  }
}

/**
 * Escape HTML special characters
 * 
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Process the content to find and render mermaid code blocks
 * 
 * @param {string} content - The content to process
 * @param {Object} context - Processing context (may contain debug flag)
 * @returns {string} - The processed content
 */
async function processMermaidBlocks(content, context = {}) {
  const debug = context.options?.debugMermaid || false;
  
  if (debug) {
    console.log('[Mermaid Formatter] Processing content, length:', content.length);
  }
  
  // Find all mermaid code blocks: ```mermaid\ncode\n```
  const mermaidBlockRegex = /```mermaid\s*\n([\s\S]*?)\n```/gim;
  
  // Collect all matches first
  const matches = [];
  let match;
  while ((match = mermaidBlockRegex.exec(content)) !== null) {
    matches.push({
      fullMatch: match[0],
      code: match[1].trim(),
      index: match.index
    });
  }
  
  if (debug) {
    console.log('[Mermaid Formatter] Found', matches.length, 'mermaid code block(s)');
    matches.forEach((m, i) => {
      console.log(`[Mermaid Formatter] Block ${i + 1}:`, {
        codeLength: m.code.length,
        codePreview: m.code.substring(0, 100) + (m.code.length > 100 ? '...' : ''),
        index: m.index
      });
    });
  }
  
  // If no matches, return content unchanged
  if (matches.length === 0) {
    if (debug) {
      console.log('[Mermaid Formatter] No mermaid blocks found, returning content unchanged');
    }
    return content;
  }
  
  // Render all diagrams in parallel
  const renderedDiagrams = await Promise.all(
    matches.map(async (m, i) => {
      if (debug) {
        console.log(`[Mermaid Formatter] Rendering diagram ${i + 1}...`);
      }
      const result = await renderMermaidDiagram(m.code, debug);
      if (debug) {
        console.log(`[Mermaid Formatter] Diagram ${i + 1} rendered:`, {
          success: !result.includes('mermaid-error'),
          resultLength: result.length,
          resultPreview: result.substring(0, 150) + '...'
        });
      }
      return result;
    })
  );
  
  // Replace matches in reverse order to preserve indices
  let result = content;
  for (let i = matches.length - 1; i >= 0; i--) {
    const { fullMatch, index } = matches[i];
    result = result.slice(0, index) + renderedDiagrams[i] + result.slice(index + fullMatch.length);
  }
  
  if (debug) {
    console.log('[Mermaid Formatter] Processing complete, result length:', result.length);
  }
  
  return result;
}

/**
 * The Mermaid formatter implementation
 */
export const mermaidFormatter = createFormatter(
  'mermaid',
  {}, // Default options
  35, // Run BEFORE markdown (priority 40) to process mermaid blocks before they're converted to HTML
  async (content, context) => {
    if (!content) return '';
    
    const debug = context?.options?.debugMermaid || false;
    
    // Quick check: if no mermaid blocks, skip processing
    if (!content.includes('```mermaid')) {
      if (debug) {
        console.log('[Mermaid Formatter] No mermaid blocks detected, skipping');
      }
      return content;
    }
    
    if (debug) {
      console.log('[Mermaid Formatter] Starting processing, content preview:', content.substring(0, 200));
    }
    
    try {
      const result = await processMermaidBlocks(content, context);
      if (debug) {
        console.log('[Mermaid Formatter] Processing complete, result preview:', result.substring(0, 200));
      }
      return result;
    } catch (error) {
      console.error('[Mermaid Formatter] Error processing Mermaid diagrams:', error);
      console.error('[Mermaid Formatter] Error context:', {
        message: error.message,
        stack: error.stack,
        contentLength: content.length,
        hasMermaidBlocks: content.includes('```mermaid'),
        contentPreview: content.substring(0, 500)
      });
      return content; // Return original content on error
    }
  }
);

// Export for registration
export default mermaidFormatter;
