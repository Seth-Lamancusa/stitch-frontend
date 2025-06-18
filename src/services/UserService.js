import axios from 'axios';
import { getFirebaseToken } from '../firebase.js';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
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
   * Get messages for the current user with page-based pagination
   * @param {Number} limit - Number of messages to return
   * @param {Number} page - Page number (1-based)
   * @returns {Promise<Object>} - Response with messages and pagination info
   */
  async fetchUserMessages(limit = 10, page = 1) {
    try {
      const token = await getFirebaseToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Build query parameters
      const params = { limit, page };
      
      const response = await apiClient.get('/users/messages', {
        params,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('[DEBUG] UserService - fetchUserMessages response:', {
        messagesCount: response.data?.messages?.length || 0,
        exhausted: response.data?.exhausted,
        page: response.data?.page
      });
      
      return response;
    } catch (error) {
      console.error('Error fetching user messages:', error);
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
    }
}; 