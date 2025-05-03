import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default {
  /**
   * Check if a user is whitelisted
   * @param {string} email - User's email
   */
  checkWhitelistStatus(email) {
    console.log(`Checking whitelist status for email: ${email}`);
    return apiClient.get(`/user/whitelist-status?email=${encodeURIComponent(email)}`)
      .then(response => {
        console.log(`Whitelist status response:`, response.data);
        return response.data.whitelisted;
      })
      .catch(error => {
        console.error('Error checking whitelist status:', error);
        throw error;
      });
  },
  
  /**
   * Check if a user is an admin
   * @param {string} email - User's email
   */
  checkAdminStatus(email) {
    console.log(`Checking admin status for email: ${email}`);
    return apiClient.get(`/user/admin-status?email=${encodeURIComponent(email)}`)
      .then(response => {
        console.log(`Admin status response:`, response.data);
        return response.data.isAdmin;
      })
      .catch(error => {
        console.error('Error checking admin status:', error);
        throw error;
      });
  }
}; 