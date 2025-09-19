/**
 * FormattedContent Initialization
 * 
 * This module initializes the FormattedContent component by registering
 * formatters and handling initial setup.
 */
import { registerFormatter } from './formatters';

// Import formatters
import htmlLinksFormatter from './plugins/html_links';
import markdownFormatter from './plugins/markdown';
import latexFormatter from './plugins/latex';
import codeFormatter from './plugins/code';
import mcpExamplesFormatter from './plugins/mcp_examples';

// Track if the system has been initialized
let isInitialized = false;

/**
 * Initialize the FormattedContent system by registering formatters
 * 
 * @param {Object} options - Initialization options
 * @returns {boolean} - Whether initialization was successful
 */
export function initFormatters(options = {}) {
  if (isInitialized) {
    // Already initialized
    return true;
  }
  
  try {
    // Register standard formatters
    registerFormatter(htmlLinksFormatter); // Run before markdown
    registerFormatter(mcpExamplesFormatter); // Detect MCP example sections early
    registerFormatter(markdownFormatter);
    registerFormatter(latexFormatter);
    registerFormatter(codeFormatter);
    
    // Register custom formatters provided in options
    if (options.formatters && Array.isArray(options.formatters)) {
      options.formatters.forEach(formatter => {
        registerFormatter(formatter);
      });
    }
    
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('Error initializing formatters:', error);
    return false;
  }
}

/**
 * Check if the formatters have been initialized
 * 
 * @returns {boolean} - Whether the formatters are initialized
 */
export function isFormatterInitialized() {
  return isInitialized;
}

/**
 * Get the combined CSS string to include for all formatters
 * 
 * @returns {string} - CSS to include for formatters
 */
export function getFormattersCss() {
  return `
    /* KaTeX CSS */
    .katex-display {
      display: block;
      margin: 1em 0;
      text-align: center;
    }
    
    .katex-error {
      color: red;
      border: 1px solid red;
      padding: 0.2em;
      margin: 0.2em;
      display: inline-block;
    }
    
    /* Code highlighting (use CSS variables and external theme) */
    .hljs {
      display: block;
      overflow-x: auto;
      padding: 0.5em;
      color: var(--color-code-text);
      background: var(--color-code-background);
    }
    
    /* Markdown customizations */
    .formatted-content h1,
    .formatted-content h2,
    .formatted-content h3,
    .formatted-content h4,
    .formatted-content h5,
    .formatted-content h6 {
      margin-top: 0.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
    }
    
    .formatted-content h1 {
      font-size: 1.5em;
    }
    
    .formatted-content h2 {
      font-size: 1.3em;
    }
    
    .formatted-content h3 {
      font-size: 1.1em;
    }
    
    .formatted-content a {
      color: var(--link-color, #2196f3);
      text-decoration: none;
    }
    
    .formatted-content a:hover {
      text-decoration: underline;
    }
    
    .formatted-content img {
      max-width: 100%;
      height: auto;
    }
    
    .formatted-content ul,
    .formatted-content ol {
      padding-left: 2em;
      margin: 0.5em 0;
    }
  `;
} 