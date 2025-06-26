import axios from 'axios';
import { getFirebaseAuth } from '../firebase.js';

const apiBaseUrl = '/api';

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
  // Fetch a single message - DEPRECATED: Use loadMessageRadius instead
  // async getMessage(id) {
  //   const headers = await getAuthHeaders();
  //   const response = await axios.get(`${apiBaseUrl}/messages/${id}`, { headers });
  //   console.log(`[DEBUG] MessageService - getMessage(${id}) response:`, response.data);
  //   return response;
  // },
  
  // Send a message or reply
  async sendReply(parentId, content, isPrivate = false, recipients = [], content_author = null) {
    console.log('[MessageService] sendReply called with:', {
      parentId,
      contentLength: content?.length || 0,
      isPrivate,
      recipients,
      content_author
    });
    
    const headers = await getAuthHeaders();
    const auth = getFirebaseAuth();
    
    // Unified endpoint for both root messages and replies
    const messageData = {
      content,
      public: !isPrivate,
      recipients // Now expects an array of UIDs
    };
    
    // Only include parent_id if this is a reply
    if (parentId) {
      messageData.parent_id = parentId;
    }
    
    // Handle special case for ChatGPT
    if (content_author === 'chatgpt') {
      messageData.content_author = 'chatgpt';
    }
    // For regular users, backend will use the authenticated user's UID from token
    
    console.log('[MessageService] Sending API request with data:', {
      endpoint: `${apiBaseUrl}/messages`,
      messageData: {
        ...messageData,
        content: messageData.content ? `${messageData.content.substring(0, 50)}...` : null
      },
      hasHeaders: !!headers
    });
    
    try {
      const response = await axios.post(`${apiBaseUrl}/messages`, messageData, { headers });
      console.log('[MessageService] API request successful:', {
        status: response.status,
        messageId: response.data?.id,
        hasData: !!response.data
      });
      return response;
    } catch (error) {
      console.error('[MessageService] API request failed:', error);
      console.error('[MessageService] Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      throw error;
    }
  },
  
  // Delete a message and all its descendants
  async deleteMessage(id) {
    const headers = await getAuthHeaders();
    return axios.delete(`${apiBaseUrl}/messages/${id}`, { headers });
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
  
  // Load parent branch with specified depth
  async loadBranchUp(messageId, depth = 2) {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${apiBaseUrl}/messages/branch_up/${messageId}?depth=${depth}`, { headers });
    console.log(`[DEBUG] MessageService - loadBranchUp(${messageId}, depth=${depth}) response:`, 
      response.data.length > 0 ? 
      {count: response.data.length, firstMessage: response.data[0]} : 
      {count: 0});
    return response;
  },
  
  // Load child branch with specified depth
  async loadBranchDown(messageId, depth = 2) {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${apiBaseUrl}/messages/branch_down/${messageId}?depth=${depth}`, { headers });
    console.log(`[DEBUG] MessageService - loadBranchDown(${messageId}, depth=${depth}) response:`, 
      response.data.length > 0 ? 
      {count: response.data.length, firstMessage: response.data[0]} : 
      {count: 0});
    return response;
  },
  
  // Load messages within a radius of a target message (both parents and children)
  async loadMessageRadius(messageId, radius = 5) {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${apiBaseUrl}/messages/radius/${messageId}?radius=${radius}`, { headers });
    console.log(`[DEBUG] MessageService - loadMessageRadius(${messageId}, radius=${radius}) response:`, 
      response.data.length > 0 ? 
      {count: response.data.length, messageIds: response.data.map(m => m.id)} : 
      {count: 0});
    return response;
  },
  
  // Update message title and description
  async updateTitleDescription(id, titleData) {
    const headers = await getAuthHeaders();
    return axios.patch(`${apiBaseUrl}/messages/${id}/title-description`, titleData, { headers });
  },
  
  // Mark a message as read
  async markMessageAsRead(id) {
    const headers = await getAuthHeaders();
    return axios.post(`${apiBaseUrl}/messages/${id}/mark-read`, {}, { headers });
  },
  
  // Mark a message as unread
  async markMessageAsUnread(id) {
    const headers = await getAuthHeaders();
    return axios.post(`${apiBaseUrl}/messages/${id}/mark-unread`, {}, { headers });
  },
  
  // Get unread message count for the current user
  async getUnreadMessageCount() {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${apiBaseUrl}/messages/unread-count`, { headers });
    console.log('[DEBUG] MessageService - getUnreadMessageCount response:', response.data);
    return response;
  },

  // Reformat a message according to Stitch guidelines
  async reformatMessage(messageId) {
    const headers = await getAuthHeaders();
    return axios.post(`${apiBaseUrl}/messages/${messageId}/reformat`, {}, { headers });
  },

  // Get public messages with pagination
  async getPublicMessages(skip = 0, limit = 20) {
    const headers = await getAuthHeaders();
    return axios.get(`${apiBaseUrl}/messages/public?skip=${skip}&limit=${limit}`, { headers });
  },

  // Get all saved messages with pagination  
  async getAllSavedMessages(skip = 0, limit = 20) {
    const headers = await getAuthHeaders();
    return axios.get(`${apiBaseUrl}/messages/saved?skip=${skip}&limit=${limit}`, { headers });
  },

};
