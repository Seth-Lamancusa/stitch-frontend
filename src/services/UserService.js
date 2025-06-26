import axios from 'axios';
import { getFirebaseToken } from '../firebase.js';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default {
  
  /**
   * Search for users by tag or display name
   * @param {String} query - Search query
   * @param {Number} limit - Maximum number of results to return
   * @returns {Promise<Array>} - Array of matching users
   */
  async searchUsers(query, limit = 10) {
    try {
      console.log('[Service] Searching users with query:', query, 'limit:', limit);
      const token = await getFirebaseToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      console.log('[Service] Making API request to:', '/users/search');
      const response = await apiClient.get('/users/search', {
        params: { query, limit },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('[Service] API response:', response.data);
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
   * Validate if a user tag exists
   * @param {String} tag - The user tag to validate
   * @returns {Promise<Boolean>} - Whether the tag exists
   */
  async validateUserTag(tag) {
    try {
      const token = await getFirebaseToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await apiClient.get('/users/validate-tag', {
        params: { tag },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data.exists;
    } catch (error) {
      console.error('Error validating user tag:', error);
      return false;
    }
  },

  /**
   * Get messages for the current user with skip-based pagination
   * @param {Number} limit - Number of messages to return
   * @param {Number} skip - Number of messages to skip (for pagination)
   * @returns {Promise<Object>} - Response with messages and pagination info
   */
  async fetchUserMessages(limit = 20, skip = 0) {
    try {
      const token = await getFirebaseToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Build query parameters with skip-based pagination
      const params = { limit, skip };
      
      const response = await apiClient.get('/users/messages', {
        params,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('[DEBUG] UserService - fetchUserMessages response:', {
        messagesCount: response.data?.messages?.length || 0,
        exhausted: response.data?.exhausted,
        page: response.data?.page,
        skip,
        limit
      });
      
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
   * @param {Number} limit - Number of results to return
   * @param {Boolean} showAllLinks - Whether to show all links or just user's links
   * @returns {Promise<Object>} - Response with incoming links
   */
  async getUserIncomingLinks(messageId, skip = 0, limit = 20, showAllLinks = false) {
    try {
      const token = await getFirebaseToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await apiClient.get(`/users/messages/${messageId}/user-incoming-links`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
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
   * @param {Number} limit - Number of results to return
   * @param {Boolean} showAllLinks - Whether to show all links or just user's links
   * @returns {Promise<Object>} - Response with outgoing links
   */
  async getUserOutgoingLinks(messageId, skip = 0, limit = 20, showAllLinks = false) {
    try {
      const token = await getFirebaseToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await apiClient.get(`/users/messages/${messageId}/user-outgoing-links`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
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
   * @param {Number} limit - Number of messages to return
   * @returns {Promise<Object>} - Response with saved messages
   */
  async getSavedMessages(skip = 0, limit = 20) {
    try {
      const token = await getFirebaseToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await apiClient.get('/users/saved-messages', {
        params: { skip, limit },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('[DEBUG] UserService - getSavedMessages response:', {
        fullResponse: response.data,
        messagesCount: response.data?.messages?.length || 0,
        exhausted: response.data?.exhausted,
        skip,
        limit
      });
      
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
        const token = await getFirebaseToken();
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        const response = await apiClient.get('/users/unread-count', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('[DEBUG] UserService - getUnreadMessageCount response:', response.data);
        return response;
      } catch (error) {
        console.error('Error getting unread message count:', error);
        throw error;
      }
    },

    /**
     * Mark a message as read for the current user
     * @param {String} messageId - The message ID to mark as read
     * @returns {Promise<Object>} - Response with success status
     */
    async markMessageAsRead(messageId) {
      try {
        console.log('[UserService] Marking message as read:', messageId);
        const token = await getFirebaseToken();
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        const response = await apiClient.post(`/users/messages/${messageId}/mark-read`, {}, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('[UserService] Mark as read response:', response.data);
        return response;
      } catch (error) {
        console.error('Error marking message as read:', error);
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
        console.log('[UserService] Marking message as unread:', messageId);
        const token = await getFirebaseToken();
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        const response = await apiClient.post(`/users/messages/${messageId}/mark-unread`, {}, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('[UserService] Mark as unread response:', response.data);
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
        console.log('[UserService] Saving message:', messageId);
        const token = await getFirebaseToken();
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        const response = await apiClient.post(`/users/messages/${messageId}/save`, {}, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('[UserService] Save message response:', response.data);
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
        console.log('[UserService] Unsaving message:', messageId);
        const token = await getFirebaseToken();
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        const response = await apiClient.delete(`/users/messages/${messageId}/save`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('[UserService] Unsave message response:', response.data);
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
        const token = await getFirebaseToken();
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        const response = await apiClient.get('/users/saved-count', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('[DEBUG] UserService - getSavedMessagesCount response:', response.data);
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
        const token = await getFirebaseToken();
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        const response = await apiClient.delete(`/users/messages/${messageIdFrom}/links/${messageIdTo}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
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
        const token = await getFirebaseToken();
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        const response = await apiClient.post(`/users/messages/${messageIdFrom}/links/${messageIdTo}`, {}, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
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
        console.log('[UserService] Submitting waitlist application:', applicationData);
        
        const response = await apiClient.post('/users/waitlist', applicationData);
        
        console.log('[UserService] Waitlist application response:', response.data);
        return response.data;
      } catch (error) {
        console.error('[UserService] Error submitting waitlist application:', error);
        console.error('[UserService] Error details:', error.response?.data || error.message);
        throw error;
      }
    }
}; 