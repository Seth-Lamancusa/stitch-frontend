/**
 * Formatter Registry for FormattedContent
 * 
 * This module manages the registration and application of formatters
 * for processing content in a specific sequence.
 */

// The registry of formatters
const formatters = [];

/**
 * Register a formatter with the system
 * 
 * @param {Object} formatter - The formatter to register
 * @param {string} formatter.name - Unique name for the formatter
 * @param {Function} formatter.process - Function that processes content
 * @param {number} formatter.priority - Priority (lower numbers run first)
 */
export function registerFormatter(formatter) {
  if (!formatter || !formatter.name || typeof formatter.process !== 'function') {
    console.error('Invalid formatter:', formatter);
    return;
  }
  
  // Check for duplicate formatters
  const existingIndex = formatters.findIndex(f => f.name === formatter.name);
  if (existingIndex >= 0) {
    // Replace existing formatter
    formatters[existingIndex] = formatter;
    return;
  }
  
  // Add new formatter
  formatters.push(formatter);
  
  // Sort formatters by priority
  formatters.sort((a, b) => (a.priority || 100) - (b.priority || 100));
}

/**
 * Apply all registered formatters to content in sequence
 * 
 * @param {string} content - The content to format
 * @param {Object} options - Optional configuration for formatters
 * @returns {string} - The formatted content
 */
export async function applyFormatters(content, options = {}) {
  if (!content) return '';
  
  // Track which zones of content are "protected" from further processing
  const protectedZones = new Map();
  let processedContent = content;
  let processingContext = {
    protectedZones,
    options
  };
  
  // Apply each formatter in sequence
  for (const formatter of formatters) {
    try {
      processedContent = await formatter.process(processedContent, processingContext);
    } catch (error) {
      console.error(`Error in formatter ${formatter.name}:`, error);
    }
  }
  
  return processedContent;
}

/**
 * Get all registered formatters
 * 
 * @returns {Array} - The list of registered formatters
 */
export function getFormatters() {
  return [...formatters];
}

/**
 * Clear all registered formatters
 */
export function clearFormatters() {
  formatters.length = 0;
}

/**
 * Helper function to protect content from further processing
 * 
 * @param {string} content - The content to process
 * @param {RegExp} pattern - The pattern to match protected zones
 * @param {Function} replace - Function to generate placeholder
 * @param {Object} context - Processing context with protectedZones
 * @returns {string} - Content with protected zones replaced by placeholders
 */
export function protectContent(content, pattern, replace, context) {
  const { protectedZones } = context;
  
  return content.replace(pattern, (...args) => {
    const originalContent = args[0];
    const placeholder = replace(...args);
    
    // Store the original content with its placeholder
    protectedZones.set(placeholder, originalContent);
    
    return placeholder;
  });
}

/**
 * Helper function to restore protected content
 * 
 * @param {string} content - The content with placeholders
 * @param {Object} context - Processing context with protectedZones
 * @returns {string} - Content with placeholders replaced by original content
 */
export function restoreProtectedContent(content, context) {
  const { protectedZones } = context;
  
  let result = content;
  for (const [placeholder, originalContent] of protectedZones.entries()) {
    result = result.replace(new RegExp(placeholder, 'g'), originalContent);
  }
  
  return result;
} 