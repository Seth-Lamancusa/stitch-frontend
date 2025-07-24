/**
 * Bot Service - Manages bot information from backend
 */

import axios from 'axios';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://stitch-1076063929633.us-central1.run.app/api'
  : 'http://localhost:8081/api';

class BotService {
  constructor() {
    this.bots = [];
    this.botsById = new Map();
    this.botsByTag = new Map();
    this.isLoaded = false;
  }

  /**
   * Fetch available bots from backend
   */
  async fetchBots() {
    try {
      console.log('[BotService] Fetching bots from backend...');
      
      const response = await axios.get(`${API_BASE_URL}/bots`);
      this.bots = response.data || [];
      
      // Build lookup maps
      this.botsById.clear();
      this.botsByTag.clear();
      
      this.bots.forEach(bot => {
        if (bot.uid) {
          this.botsById.set(bot.uid, bot);
        }
        if (bot.user_tag) {
          this.botsByTag.set(bot.user_tag, bot);
        }
      });
      
      this.isLoaded = true;
      console.log(`[BotService] Successfully loaded ${this.bots.length} bots:`, 
        this.bots.map(bot => bot.display_name));
      
      return this.bots;
      
    } catch (error) {
      console.error('[BotService] Error fetching bots:', error);
      // Don't throw - allow app to continue with empty bot list
      this.bots = [];
      this.isLoaded = true;
      return [];
    }
  }

  /**
   * Get all available bots
   */
  getBots() {
    return [...this.bots];
  }

  /**
   * Get bot by UID
   */
  getBotByUid(uid) {
    return this.botsById.get(uid) || null;
  }

  /**
   * Get bot by user tag
   */
  getBotByTag(tag) {
    return this.botsByTag.get(tag) || null;
  }

  /**
   * Check if bots are loaded
   */
  isBotsLoaded() {
    return this.isLoaded;
  }

  /**
   * Get bots count
   */
  getBotsCount() {
    return this.bots.length;
  }
}

// Export singleton instance
export default new BotService(); 