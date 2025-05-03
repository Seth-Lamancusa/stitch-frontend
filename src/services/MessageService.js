import axios from 'axios';
import { getFirebaseAuth } from '../firebase.js';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

// Helper function to get auth headers
const getAuthHeaders = async () => {
  const auth = getFirebaseAuth();
  if (!auth || !auth.currentUser) {
    return {};
  }
  
  try {
    const token = await auth.currentUser.getIdToken();
    return {
      Authorization: `Bearer ${token}`
    };
  } catch (error) {
    console.error('Error getting auth token:', error);
    return {};
  }
};

export default {
  // Fetch a single message
  async getMessage(id) {
    const headers = await getAuthHeaders();
    return axios.get(`${apiBaseUrl}/messages/${id}`, { headers });
  },
  
  // Get multiple messages by ID in a single request
  async getMessagesBatch(ids) {
    if (!ids || ids.length === 0) return { data: [] };
    
    const headers = await getAuthHeaders();
    return axios.post(`${apiBaseUrl}/messages/batch`, ids, { headers });
  },
  
  // Get all reply IDs for a message
  async getReplyIds(id) {
    const headers = await getAuthHeaders();
    return axios.get(`${apiBaseUrl}/messages/${id}/reply_ids`, { headers });
  },
  
  // Get all replies for a message without pagination
  async getAllReplies(id) {
    const headers = await getAuthHeaders();
    return axios.get(`${apiBaseUrl}/messages/replies/${id}`, { headers });
  },
  
  // Get count of replies for a message
  async getReplyCount(id) {
    const headers = await getAuthHeaders();
    return axios.get(`${apiBaseUrl}/messages/count/${id}`, { headers });
  },
  
  // Send a message or reply
  async sendReply(parentId, content, isPrivate = false, recipients = [], content_author = null) {
    const headers = await getAuthHeaders();
    const auth = getFirebaseAuth();
    
    // Unified endpoint for both root messages and replies
    const messageData = {
      content,
      public: !isPrivate,
      recipients
    };
    
    // Only include parent_id if this is a reply
    if (parentId) {
      messageData.parent_id = parentId;
    }
    
    // Include content_author if provided (should now be a UUID)
    // Note: The backend will use the authenticated user's UID by default
    if (content_author && content_author !== 'chatgpt') {
      // For users, we'll let the backend handle it based on the auth token
      if (content_author === 'chatgpt') {
        messageData.content_author = content_author;
      }
      // Otherwise, we don't include content_author, as the backend will use the authenticated user's UID
    } else if (content_author === 'chatgpt') {
      // Handle the special ChatGPT case
      messageData.content_author = 'chatgpt';
    }
    
    return axios.post(`${apiBaseUrl}/messages`, messageData, { headers });
  },
  
  // Get recommended messages for feed
  async getRecommendedMessages(limit = 100) {
    // Make sure we don't exceed the server limit of 5000
    const safeLimit = Math.min(limit, 5000);
    const headers = await getAuthHeaders();
    const response = await axios.get(`${apiBaseUrl}/messages/recommended?limit=${safeLimit}`, { headers });
    return response;
  },
  
  // Get private messages for current user
  async getPrivateMessages(limit = 10) {
    const headers = await getAuthHeaders();
    return axios.get(`${apiBaseUrl}/messages/private?limit=${limit}`, { headers });
  },
  
  // Delete a message and all its descendants
  async deleteMessage(id) {
    const headers = await getAuthHeaders();
    return axios.delete(`${apiBaseUrl}/messages/${id}`, { headers });
  },
  
  // Import a ChatGPT conversation
  async importChatGPT(content, isPublic = true, recipients = []) {
    const headers = await getAuthHeaders();
    
    const importData = {
      content,
      public: isPublic,
      recipients
    };
    
    return axios.post(`${apiBaseUrl}/messages/import-chatgpt`, importData, { headers });
  },
  
  // Pin a message (admin only)
  async pinMessage(id) {
    const headers = await getAuthHeaders();
    return axios.post(`${apiBaseUrl}/messages/${id}/pin`, {}, { headers });
  },
  
  // Unpin a message (admin only)
  async unpinMessage(id) {
    const headers = await getAuthHeaders();
    return axios.post(`${apiBaseUrl}/messages/${id}/unpin`, {}, { headers });
  },
  
  // Get all pinned messages
  async getPinnedMessages(limit = 10) {
    const headers = await getAuthHeaders();
    return axios.get(`${apiBaseUrl}/messages/pinned?limit=${limit}`, { headers });
  },
  
  // Update message details (title, description)
  async updateMessageDetails(messageId, details) {
    const headers = await getAuthHeaders();
    return axios.patch(`${apiBaseUrl}/messages/${messageId}`, details, { headers });
  }
};
