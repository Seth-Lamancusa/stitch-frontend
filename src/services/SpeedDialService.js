/**
 * Speed Dial Service
 * 
 * Manages user's speed dial (quick-access contacts) via backend API.
 * Replaces the old hardcoded FeaturedBotsService.
 * 
 * Response shape per user: 
 *   { uid, display_name, user_tag, position, tier, added_at }
 * 
 * Tier 1 = main (shown directly)
 * Tier 2 = expanded (shown in "More" dropdown)
 */
import apiClient from './apiClient.js';

// Cache for speed dial - refreshed on mutations
let cachedSpeedDial = null;
let fetchPromise = null;

const SpeedDialService = {
  /**
   * Get current user's speed dial list
   * @returns {Promise<Array>} List of speed dial users
   */
  async listSpeedDialUsers() {
    // Return cached if available
    if (cachedSpeedDial !== null) {
      return cachedSpeedDial;
    }

    // If fetch is in progress, wait for it
    if (fetchPromise !== null) {
      return fetchPromise;
    }

    // Fetch from API
    fetchPromise = (async () => {
      try {
        const resp = await apiClient.get('/users/me/speed-dial');
        cachedSpeedDial = resp.data?.users || [];
        return cachedSpeedDial;
      } catch (err) {
        console.warn('[SpeedDialService] Failed to fetch speed dial:', err);
        cachedSpeedDial = [];
        return [];
      } finally {
        fetchPromise = null;
      }
    })();

    return fetchPromise;
  },

  /**
   * Add a user to speed dial
   * @param {string} uid - User UID to add
   * @param {number} [position] - Optional position (defaults to end)
   * @param {number} [tier=1] - Tier level (1=main, 2=expanded)
   * @returns {Promise<Array>} Updated speed dial list
   */
  async addToSpeedDial(uid, position = null, tier = 1) {
    const payload = { uid, tier };
    if (position !== null) {
      payload.position = position;
    }
    
    const resp = await apiClient.post('/users/me/speed-dial', payload);
    cachedSpeedDial = resp.data?.users || [];
    return cachedSpeedDial;
  },

  /**
   * Remove a user from speed dial
   * @param {string} uid - User UID to remove
   * @returns {Promise<Array>} Updated speed dial list
   */
  async removeFromSpeedDial(uid) {
    const resp = await apiClient.delete(`/users/me/speed-dial/${uid}`);
    cachedSpeedDial = resp.data?.users || [];
    return cachedSpeedDial;
  },

  /**
   * Check if a user is in speed dial
   * @param {string} uid - User UID to check
   * @returns {Promise<boolean>} True if user is in speed dial
   */
  async isInSpeedDial(uid) {
    try {
      const resp = await apiClient.get(`/users/me/speed-dial/check/${uid}`);
      return resp.data?.in_speed_dial === true;
    } catch (_err) {
      return false;
    }
  },

  /**
   * Reorder speed dial entries
   * @param {Array<string>} uids - Ordered list of all UIDs
   * @returns {Promise<Array>} Updated speed dial list
   */
  async reorderSpeedDial(uids) {
    const resp = await apiClient.put('/users/me/speed-dial/reorder', { uids });
    cachedSpeedDial = resp.data?.users || [];
    return cachedSpeedDial;
  },

  /**
   * Update the tier of a speed dial entry
   * @param {string} uid - User UID to update
   * @param {number} tier - New tier value (1=main, 2=expanded)
   * @returns {Promise<Array>} Updated speed dial list
   */
  async updateTier(uid, tier) {
    const resp = await apiClient.patch(`/users/me/speed-dial/${uid}/tier`, { tier });
    cachedSpeedDial = resp.data?.users || [];
    return cachedSpeedDial;
  },

  /**
   * Clear the local cache (forces next call to fetch from API)
   */
  clearCache() {
    cachedSpeedDial = null;
    fetchPromise = null;
  },

  /**
   * Get main tier speed dial users (tier 1)
   * @returns {Promise<Array>} List of main tier users
   */
  async getMainTierUsers() {
    const users = await this.listSpeedDialUsers();
    return users.filter(u => u.tier === 1);
  },

  /**
   * Get expanded tier speed dial users (tier 2)
   * @returns {Promise<Array>} List of expanded tier users
   */
  async getExpandedTierUsers() {
    const users = await this.listSpeedDialUsers();
    return users.filter(u => u.tier === 2);
  },

  // ---- Backward compatibility aliases ----
  // These provide drop-in replacement for FeaturedBotsService

  /**
   * @deprecated Use listSpeedDialUsers() instead
   * Alias for backward compatibility with FeaturedBotsService
   */
  async listFeaturedBots() {
    const users = await this.listSpeedDialUsers();
    // Map to old format with 'advanced' field
    return users.map(u => ({
      ...u,
      advanced: u.tier === 2
    }));
  }
};

export default SpeedDialService;
