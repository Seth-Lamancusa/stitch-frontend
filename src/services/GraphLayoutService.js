import { calculateLayout, optimizeLayout, calculateBounds } from '../utils/graph/layoutAlgorithms.js';
import { debounce } from 'lodash-es';

/**
 * Service for managing graph layout calculations and caching
 * Provides optimized layout computation with memoization and Web Worker support
 */
class GraphLayoutService {
  constructor() {
    this.layoutCache = new Map();
    this.boundsCache = new Map();
    this.isCalculating = false;
    
    // Debounced layout calculation to prevent excessive computation
    this.debouncedCalculate = debounce(this.calculateLayoutInternal.bind(this), 100);
  }

  /**
   * Calculate layout for messages with caching
   * @param {Array} messages - Array of message objects
   * @param {Object} options - Layout options
   * @returns {Promise<Object>} Layout result with positions and bounds
   */
  async calculateLayoutForMessages(messages, options = {}) {
    const cacheKey = this.generateCacheKey(messages, options);
    
    // Return cached result if available
    if (this.layoutCache.has(cacheKey)) {
      return this.layoutCache.get(cacheKey);
    }
    
    // Calculate new layout (avoid debounced return value ambiguity with async)
    return this.calculateLayoutInternal(messages, options, cacheKey);
  }

  /**
   * Internal layout calculation method
   * @param {Array} messages - Message array
   * @param {Object} options - Layout options
   * @param {string} cacheKey - Cache key for memoization
   * @returns {Promise<Object>} Layout result
   */
  async calculateLayoutInternal(messages, options, cacheKey) {
    if (this.isCalculating) {
      // Wait for current calculation to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      return this.calculateLayoutInternal(messages, options, cacheKey);
    }

    this.isCalculating = true;

    try {
      // Validate messages structure
      const validatedMessages = this.validateAndCleanMessages(messages);
      
      // Calculate positions
      const positions = calculateLayout(validatedMessages, options);
      
      // Optimize layout (Phase 1: basic optimization)
      const optimizedPositions = optimizeLayout(positions, validatedMessages);
      
      // Calculate bounds
      const bounds = calculateBounds(optimizedPositions);
      
      const result = {
        positions: optimizedPositions,
        bounds,
        messageCount: validatedMessages.length,
        timestamp: Date.now()
      };
      
      // Cache the result
      this.layoutCache.set(cacheKey, result);
      
      // Cleanup old cache entries if needed
      this.cleanupCache();
      
      return result;
    } finally {
      this.isCalculating = false;
    }
  }

  /**
   * Validate and clean message data for layout
   * @param {Array} messages - Raw message array
   * @returns {Array} Validated message array
   */
  validateAndCleanMessages(messages) {
    if (!Array.isArray(messages)) {
      console.warn('[GraphLayoutService] Messages is not an array:', messages);
      return [];
    }

    return messages
      .filter(msg => {
        // Basic validation
        if (!msg || !msg.id || !msg.timestamp) {
          console.warn('[GraphLayoutService] Invalid message:', msg);
          return false;
        }
        return true;
      })
      .map(msg => ({
        id: msg.id,
        parent_id: msg.parent_id || null,
        timestamp: msg.timestamp,
        content: msg.content || '',
        author: msg.author || {},
        public: msg.public,
        recipients: msg.recipients || [],
        read_status: msg.read_status || {},
        // Include other necessary fields for rendering
        unread_count_in_thread: msg.unread_count_in_thread || 0
      }));
  }

  /**
   * Generate cache key for memoization
   * @param {Array} messages - Message array
   * @param {Object} options - Layout options
   * @returns {string} Cache key
   */
  generateCacheKey(messages, options) {
    // Create a hash-like key based on message IDs and layout options
    const messageIds = messages.map(m => m.id).sort().join(',');
    const optionsKey = JSON.stringify(options);
    return `${messageIds}:${optionsKey}`;
  }

  /**
   * Cleanup old cache entries to prevent memory leaks
   */
  cleanupCache() {
    const maxCacheSize = 50;
    const maxAge = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    if (this.layoutCache.size > maxCacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.layoutCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.layoutCache.size - maxCacheSize);
      toRemove.forEach(([key]) => this.layoutCache.delete(key));
    }

    // Remove old entries
    for (const [key, value] of this.layoutCache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.layoutCache.delete(key);
      }
    }
  }

  /**
   * Clear all cached layouts
   */
  clearCache() {
    this.layoutCache.clear();
    this.boundsCache.clear();
  }

  /**
   * Get cached layout if available
   * @param {Array} messages - Message array
   * @param {Object} options - Layout options
   * @returns {Object|null} Cached layout or null
   */
  getCachedLayout(messages, options) {
    const cacheKey = this.generateCacheKey(messages, options);
    return this.layoutCache.get(cacheKey) || null;
  }

  /**
   * Check if layout calculation is in progress
   * @returns {boolean} True if calculating
   */
  isLayoutCalculating() {
    return this.isCalculating;
  }

  /**
   * Calculate viewport bounds for fitting content
   * @param {Map} positions - Node positions
   * @param {number} padding - Padding around content
   * @returns {Object} Viewport bounds
   */
  calculateViewportBounds(positions, padding = 50) {
    if (!positions || positions.size === 0) {
      return { x: 0, y: 0, width: 800, height: 600 };
    }

    const bounds = calculateBounds(positions);
    return {
      x: bounds.minX - padding,
      y: bounds.minY - padding,
      width: bounds.width + (padding * 2),
      height: bounds.height + (padding * 2)
    };
  }

  /**
   * Update layout incrementally when new messages arrive
   * @param {Object} currentLayout - Current layout result
   * @param {Array} newMessages - New messages to add
   * @param {Object} options - Layout options
   * @returns {Promise<Object>} Updated layout
   */
  async updateLayoutIncremental(currentLayout, newMessages, options = {}) {
    // For Phase 1, recalculate entire layout
    // Future optimization: implement true incremental updates
    const allMessages = [
      ...this.extractMessagesFromLayout(currentLayout),
      ...newMessages
    ];
    
    return this.calculateLayoutForMessages(allMessages, options);
  }

  /**
   * Extract message array from layout result
   * @param {Object} layout - Layout result
   * @returns {Array} Message array
   */
  extractMessagesFromLayout(layout) {
    if (!layout || !layout.positions) {
      return [];
    }
    
    return Array.from(layout.positions.values())
      .map(pos => pos.message)
      .filter(Boolean);
  }
}

// Export singleton instance
export default new GraphLayoutService(); 