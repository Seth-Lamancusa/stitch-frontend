import apiClient from './apiClient'

// Cookie session — apiClient sends credentials; no Bearer header.
const getAuthHeaders = () => ({})

export default {
  /**
   * Get all channels the user is a member of
   * @returns {Promise} - Promise resolving to channel list
   */
  async getUserChannels() {
    const headers = getAuthHeaders()
    const url = `/channels`
    
    try {
      const response = await apiClient.get(url, { headers })
      // Backend returns List[ChannelOutput] directly (array), not wrapped in an object
      const channels = Array.isArray(response.data) ? response.data : []
      return channels
    } catch (error) {
      console.error('[ChannelsService] Error fetching user channels:', error)
      throw error
    }
  },

  /**
   * Get messages in a specific channel
   * @param {string} channelId - The channel ID
   * @param {number} skip - Number of records to skip for pagination
   * @param {number} limit - Number of records to return
   * @returns {Promise} - Promise resolving to messages response
   */
  async getChannelMessages(channelId, skip = 0, limit = 15) {
    const headers = getAuthHeaders()
    const params = new URLSearchParams()
    params.set('skip', String(skip))
    params.set('limit', String(limit))
    const url = `/channels/${channelId}/messages?${params.toString()}`
    
    try {
      const response = await apiClient.get(url, { headers })
      return {
        messages: response.data.messages || [],
        has_more: response.data.has_more || false,
        total: response.data.total || 0
      }
    } catch (error) {
      console.error('[ChannelsService] Error fetching channel messages:', error)
      throw error
    }
  },

  /**
   * Get a specific channel by ID
   * @param {string} channelId - The channel ID
   * @returns {Promise} - Promise resolving to channel details
   */
  async getChannel(channelId) {
    const headers = getAuthHeaders()
    const url = `/channels/${channelId}`
    
    try {
      const response = await apiClient.get(url, { headers })
      return response.data
    } catch (error) {
      console.error('[ChannelsService] Error fetching channel:', error)
      throw error
    }
  },

  /**
   * Create a new channel
   * @param {Object} channelData - Channel creation data
   * @param {string} channelData.display_name - Channel display name
   * @param {string} channelData.description - Channel description
   * @returns {Promise} - Promise resolving to created channel
   */
  async createChannel({ display_name, description }) {
    const headers = getAuthHeaders()
    const url = `/channels`
    
    try {
      const response = await apiClient.post(url, { display_name, description }, { headers })
      return response.data
    } catch (error) {
      console.error('[ChannelsService] Error creating channel:', error)
      throw error
    }
  },

  /**
   * Update channel metadata (admin only)
   * @param {string} channelId - The channel ID
   * @param {Object} updates - Updates to apply
   * @param {string} updates.display_name - New display name
   * @param {string} updates.description - New description
   * @returns {Promise} - Promise resolving to updated channel
   */
  async updateChannel(channelId, updates) {
    const headers = getAuthHeaders()
    const url = `/channels/${channelId}`
    
    try {
      const response = await apiClient.patch(url, updates, { headers })
      return response.data
    } catch (error) {
      console.error('[ChannelsService] Error updating channel:', error)
      throw error
    }
  },

  /**
   * Delete a channel (admin only)
   * @param {string} channelId - The channel ID
   * @returns {Promise}
   */
  async deleteChannel(channelId) {
    const headers = getAuthHeaders()
    const url = `/channels/${channelId}`
    
    try {
      const response = await apiClient.delete(url, { headers })
      return response.data
    } catch (error) {
      console.error('[ChannelsService] Error deleting channel:', error)
      throw error
    }
  },

  /**
   * Get channel members.
   * Backend returns the member list directly (JSON array), not wrapped in { members }.
   * @param {string} channelId - The channel ID
   * @returns {Promise<Array>} - Promise resolving to list of member objects (uid, display_name, user_tag, is_admin, joined_at, etc.)
   */
  async getChannelMembers(channelId) {
    const headers = getAuthHeaders()
    const url = `/channels/${channelId}/members`
    
    try {
      const response = await apiClient.get(url, { headers })
      return Array.isArray(response.data) ? response.data : []
    } catch (error) {
      console.error('[ChannelsService] Error fetching channel members:', error)
      throw error
    }
  },

  /**
   * Add members to a channel (admin only)
   * @param {string} channelId - The channel ID
   * @param {Array<string>} userIds - User IDs to add
   * @returns {Promise}
   */
  async addChannelMembers(channelId, userIds) {
    const headers = getAuthHeaders()
    const url = `/channels/${channelId}/members`
    
    try {
      const response = await apiClient.post(url, { user_ids: userIds }, { headers })
      return response.data
    } catch (error) {
      console.error('[ChannelsService] Error adding channel members:', error)
      throw error
    }
  },

  /**
   * Remove a member from a channel (admin only or self)
   * @param {string} channelId - The channel ID
   * @param {string} userId - User ID to remove
   * @returns {Promise}
   */
  async removeChannelMember(channelId, userId) {
    const headers = getAuthHeaders()
    const url = `/channels/${channelId}/members/${userId}`
    
    try {
      const response = await apiClient.delete(url, { headers })
      return response.data
    } catch (error) {
      console.error('[ChannelsService] Error removing channel member:', error)
      throw error
    }
  },

  /**
   * Update message channel associations
   * @param {string} messageId - The message ID
   * @param {Array<string>} channelIds - Channel IDs to associate with the message
   * @returns {Promise} - Promise resolving to updated message
   */
  async updateMessageChannels(messageId, channelIds) {
    const headers = getAuthHeaders()
    const url = `/messages/${messageId}/channels`
    
    try {
      const response = await apiClient.patch(url, { channel_ids: channelIds }, { headers })
      return response.data
    } catch (error) {
      console.error('[ChannelsService] Error updating message channels:', error)
      throw error
    }
  },

  /**
   * Batch add messages to channels
   * @param {Array<string>} messageIds - Message IDs to update
   * @param {Array<string>} channelIds - Channel IDs to add
   * @returns {Promise} - Promise resolving to batch result
   */
  async batchAddMessagesToChannels(messageIds, channelIds) {
    const headers = getAuthHeaders()
    const url = `/channels/batch/add`
    
    try {
      const response = await apiClient.post(url, { message_ids: messageIds, channel_ids: channelIds }, { headers })
      return response.data
    } catch (error) {
      console.error('[ChannelsService] Error batch adding messages to channels:', error)
      throw error
    }
  }
}

