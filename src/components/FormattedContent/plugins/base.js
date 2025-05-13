/**
 * Base Formatter Plugin
 * 
 * Defines the interface that all formatter plugins should implement.
 */

/**
 * Base class for formatter plugins
 */
export class BaseFormatter {
  /**
   * Constructor for the formatter
   * 
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.name = 'base';
    this.priority = 100; // Default priority (higher numbers run later)
    this.options = options;
  }
  
  /**
   * Process content with this formatter
   * 
   * @param {string} content - The content to process
   * @param {Object} context - Processing context
   * @returns {string} - The processed content
   */
  async process(content, context) {
    // Base implementation just returns the content unchanged
    return content;
  }
  
  /**
   * Check if this formatter should process the content
   * 
   * @param {string} content - The content to check
   * @param {Object} context - Processing context
   * @returns {boolean} - Whether this formatter should process the content
   */
  shouldProcess(content, context) {
    // Base implementation always processes
    return true;
  }
}

/**
 * Create a new formatter instance
 * 
 * @param {string} name - The name of the formatter
 * @param {Object} options - Formatter options
 * @param {number} priority - Processing priority (lower runs first)
 * @param {Function} processFn - The function that processes content
 * @returns {Object} - A formatter object
 */
export function createFormatter(name, options = {}, priority = 100, processFn) {
  return {
    name,
    priority,
    options,
    process: processFn || (content => content)
  };
} 