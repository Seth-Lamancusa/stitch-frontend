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
   * Register a new user or update existing user in the backend database
   * @param {Object} userData - User data from Firebase
   * @returns {Promise<Object>} - The created/updated user
   */
  async registerUser(userData) {
    console.log('Registering user in database:', userData.email);
    
    try {
      // Get Firebase token
      const token = await getFirebaseToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Call the user registration endpoint with properly named fields
      const response = await apiClient.post('/user/register', {
        uid: userData.uid,
        email: userData.email,
        display_name: userData.displayName
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('User registration response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error registering user:', error);
      throw error;
    }
  },
  
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
      
      console.log('[Service] Making API request to:', '/user/search');
      const response = await apiClient.get('/user/search', {
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
      
      const response = await apiClient.get('/user/validate-tag', {
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
  }
}; 