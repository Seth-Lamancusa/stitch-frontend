import apiClient from './apiClient';

export default {
  
  /**
   * Update user profile
   * @param {Object} profileData - Profile data to update
   * @param {String} profileData.display_name - Display name
   * @param {String} profileData.user_tag - User tag
   * @param {String} profileData.phone_number - Phone number
   * @returns {Promise<Object>} - Response with updated profile
   */
  async updateProfile(profileData) {
    try {
      const response = await apiClient.post('/users/profile', profileData);
      
      return response.data;
    } catch (error) {
      console.error('[UserService] Error updating profile:', error);
      console.error('[UserService] Error details:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Search for users by tag or display name
   * @param {String} query - Search query
   * @param {Number} limit - Maximum number of results to return
   * @returns {Promise<Array>} - Array of matching users
   */
  async searchUsers(query, limit = 15) {
    try {
      const response = await apiClient.get('/users/search', { params: { query, limit } });
      
      if (!response.data.users) {
        console.error('[Service] Missing users array in response:', response.data);
        return [];
      }
      
      return response.data.users;
    } catch (error) {
      console.error('[Service] Error searching users:', error);
      console.error('[Service] Error details:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Fetch a single user profile by exact user_tag (case-insensitive).
   * Used for bot profile lookups to avoid fuzzy search.
   */
  async getUserByTag(userTag) {
    try {
      const response = await apiClient.get(`/users/by-tag/${encodeURIComponent(userTag)}`);
      return response.data;
    } catch (error) {
      // Bot tags may not exist (or may be private). Treat as not found.
      if (error?.response?.status === 404) return null;
      console.error('[UserService] Error getting user by tag:', error);
      throw error;
    }
  },


  /**
   * Get messages for the current user with skip-based pagination.
   * @param {Number} limit - Number of messages to return (defaults to 15 on backend)
   * @param {Number} skip - Number of messages to skip (for pagination)
   * @param {String} [channelId] - Optional channel ID to filter to that channel (user must be a member)
   * @param {Boolean} [unreadOnly] - When true, return only threads that have unread messages
   * @returns {Promise<Object>} - Response with messages and pagination info
   */
  async fetchUserMessages(limit = 15, skip = 0, channelId = null, unreadOnly = false) {
    try {
      const params = { limit, skip };
      if (channelId) params.channel_id = channelId;
      if (unreadOnly) params.unread_only = true;
      const response = await apiClient.get('/messages/inbox', { params });
      
      
      
      return response;
    } catch (error) {
      console.error('Error fetching user messages:', error);
      throw error;
    }
  },

  /**
   * Get incoming links for a message
   * @param {String} messageId - The message ID
   * @param {Number} skip - Number of results to skip
   * @param {Number} limit - Number of results to return (defaults to 15 on backend)
   * @param {Boolean} showAllLinks - Whether to show all links or just user's links
   * @returns {Promise<Object>} - Response with incoming links
   */
  async getUserIncomingLinks(messageId, skip = 0, limit = 15, showAllLinks = false) {
    try {
      // Get token if user is authenticated, but don't require it
      const response = await apiClient.get(`/links/messages/${messageId}/incoming`, {
        params: {
          skip,
          limit,
          show_all_links: showAllLinks
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting user incoming links:', error);
      throw error;
    }
  },

  /**
   * Get outgoing links for a message
   * @param {String} messageId - The message ID
   * @param {Number} skip - Number of results to skip
   * @param {Number} limit - Number of results to return (defaults to 15 on backend)
   * @param {Boolean} showAllLinks - Whether to show all links or just user's links
   * @returns {Promise<Object>} - Response with outgoing links
   */
  async getUserOutgoingLinks(messageId, skip = 0, limit = 15, showAllLinks = false) {
    try {
      // Get token if user is authenticated, but don't require it
      const response = await apiClient.get(`/links/messages/${messageId}/outgoing`, {
        params: {
          skip,
          limit,
          show_all_links: showAllLinks
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting user outgoing links:', error);
      throw error;
    }
  },

  /**
   * Get saved messages for the current user
   * @param {Number} skip - Number of messages to skip
   * @param {Number} limit - Number of messages to return (defaults to 15 on backend)
   * @returns {Promise<Object>} - Response with saved messages
   */
  async getSavedMessages(skip = 0, limit = 15) {
    try {
      const response = await apiClient.get('/users/saved-messages', { params: { skip, limit } });
      
      
      
      // Return the response as-is since backend already returns the correct format
      return response.data;
    } catch (error) {
      console.error('Error fetching saved messages:', error);
      throw error;
    }
  },

    /**
     * Get the count of unread messages for the current user
     * @returns {Promise<Object>} - Response with unread count
     */
    async getUnreadMessageCount() {
      try {
        const response = await apiClient.get('/users/unread-total');
        
        return response;
      } catch (error) {
        console.error('Error getting unread message count:', error);
        throw error;
      }
    },

    async getThreadUnreadCounts(messageIds) {
      const response = await apiClient.post('/users/thread-unread-counts', {
        message_ids: messageIds,
      });
      return response;
    },

    /**
     * Mark a message as read for the current user
     * @param {String} messageId - The message ID to mark as read
     * @returns {Promise<Object>} - Response with success status
     */
    async markMessageAsRead(messageId) {
      try {
        
        // Use consolidated endpoint that accepts single id or list
        console.log('[UserService] markMessageAsRead -> POST /users/messages/mark-read', { message_id: messageId });
        const response = await apiClient.post('/users/messages/mark-read', { message_id: messageId });
        console.log('[UserService] markMessageAsRead response', { status: response?.status, data: response?.data });
        return response;
      } catch (error) {
        console.error('Error marking message as read:', error);
        throw error;
      }
    },

    /**
     * Mark all messages as read for the current user.
     */
    async markAllMessagesAsRead() {
      try {
        const response = await apiClient.post('/users/messages/mark-all-read', {});
        return response;
      } catch (error) {
        console.error('Error marking all messages as read:', error);
        throw error;
      }
    },

    /**
     * Mark multiple messages as read for the current user
     * @param {Array<String>} messageIds - Array of message IDs to mark as read
     * @returns {Promise<Object>} - Response with success status and counts
     */
    async batchMarkAsRead(messageIds) {
      try {
        
        // Use consolidated endpoint that accepts list in message_ids field
        console.log('[UserService] batchMarkAsRead -> POST /users/messages/mark-read', { message_ids: messageIds });
        const response = await apiClient.post('/users/messages/mark-read', { message_ids: messageIds });
        console.log('[UserService] batchMarkAsRead response', { status: response?.status, data: response?.data });
        return response;
      } catch (error) {
        console.error('Error batch marking messages as read:', error);
        throw error;
      }
    },

    /**
     * Mark a message as unread for the current user
     * @param {String} messageId - The message ID to mark as unread
     * @returns {Promise<Object>} - Response with success status
     */
    async markMessageAsUnread(messageId) {
      try {
        
        console.log('[UserService] markMessageAsUnread -> POST /users/messages/:id/mark-unread', { message_id: messageId });
        const response = await apiClient.post(`/users/messages/${messageId}/mark-unread`, {});
        console.log('[UserService] markMessageAsUnread response', { status: response?.status, data: response?.data });
        return response;
      } catch (error) {
        console.error('Error marking message as unread:', error);
        throw error;
      }
    },

    /**
     * Save a message (bookmark it) for the current user
     * @param {String} messageId - The message ID to save
     * @returns {Promise<Object>} - Response with success status
     */
    async saveMessage(messageId) {
      try {
        
        const response = await apiClient.post(`/users/messages/${messageId}/save`, {});
        
        return response;
      } catch (error) {
        console.error('Error saving message:', error);
        throw error;
      }
    },

    /**
     * Unsave a message (remove bookmark) for the current user
     * @param {String} messageId - The message ID to unsave
     * @returns {Promise<Object>} - Response with success status
     */
    async unsaveMessage(messageId) {
      try {
        
        const response = await apiClient.delete(`/users/messages/${messageId}/save`);
        
        return response;
      } catch (error) {
        console.error('Error unsaving message:', error);
        throw error;
      }
    },

    /**
     * Get the count of saved messages for the current user
     * @returns {Promise<Object>} - Response with count
     */
    async getSavedMessagesCount() {
      try {
        const response = await apiClient.get('/users/saved-count');
        
        
        return response;
      } catch (error) {
        console.error('Error getting saved messages count:', error);
        throw error;
      }
    },

    /**
     * Delete a link between two messages
     * @param {String} messageIdFrom - The source message ID
     * @param {String} messageIdTo - The target message ID
     * @returns {Promise<Boolean>} - Success status
     */
    async deleteLink(messageIdFrom, messageIdTo) {
      try {
        const response = await apiClient.delete(`/links/messages/${messageIdFrom}/${messageIdTo}`);
        
        return response.data?.success || false;
      } catch (error) {
        console.error('Error deleting link:', error);
        throw error;
      }
    },

    /**
     * Create a link between two messages
     * @param {String} messageIdFrom - The source message ID
     * @param {String} messageIdTo - The target message ID
     * @returns {Promise<Boolean>} - Success status
     */
    async createLink(messageIdFrom, messageIdTo) {
      try {
        const response = await apiClient.post(`/links/messages/${messageIdFrom}/${messageIdTo}`, {});
        
        return response.data?.success || false;
      } catch (error) {
        console.error('Error creating link:', error);
        throw error;
      }
    },

    /**
     * Submit a waitlist application
     * @param {Object} applicationData - The application data
     * @returns {Promise<Object>} - Response with success status and application ID
     */
    async submitWaitlistApplication(applicationData) {
      try {
        
        
        const response = await apiClient.post('/users/waitlist', applicationData);
        
        return response.data;
      } catch (error) {
        console.error('[UserService] Error submitting waitlist application:', error);
        console.error('[UserService] Error details:', error.response?.data || error.message);
        throw error;
      }
    },

    // Public SPA must not expose admin deleteUser
}; 
