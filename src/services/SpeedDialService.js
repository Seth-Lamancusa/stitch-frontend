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

const SpeedDialService = {
  /**
   * Get current user's speed dial list
   * @returns {Promise<Array>} List of speed dial users
   */
  async listSpeedDialUsers() {
    try {
      const resp = await apiClient.get('/users/me/speed-dial');
      return resp.data?.users || [];
    } catch (err) {
      console.warn('[SpeedDialService] Failed to fetch speed dial:', err);
      return [];
    }
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
    return resp.data?.users || [];
  },

  /**
   * Remove a user from speed dial
   * @param {string} uid - User UID to remove
   * @returns {Promise<Array>} Updated speed dial list
   */
  async removeFromSpeedDial(uid) {
    const resp = await apiClient.delete(`/users/me/speed-dial/${uid}`);
    return resp.data?.users || [];
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
    return resp.data?.users || [];
  },

  /**
   * Update the tier of a speed dial entry
   * @param {string} uid - User UID to update
   * @param {number} tier - New tier value (1=main, 2=expanded)
   * @returns {Promise<Array>} Updated speed dial list
   */
  async updateTier(uid, tier) {
    const resp = await apiClient.patch(`/users/me/speed-dial/${uid}/tier`, { tier });
    return resp.data?.users || [];
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
  }
};

export default SpeedDialService;
