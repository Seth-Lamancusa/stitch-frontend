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
    const response = await axios.get(`${apiBaseUrl}/messages/${id}`, { headers });
    console.log(`[DEBUG] MessageService - getMessage(${id}) response:`, response.data);
    return response;
  },
  
  // Get multiple messages by ID in a single request
  async getMessagesBatch(ids) {
    if (!ids || ids.length === 0) return { data: [] };
    
    const headers = await getAuthHeaders();
    const response = await axios.post(`${apiBaseUrl}/messages/batch`, ids, { headers });
    console.log('[DEBUG] MessageService - getMessagesBatch response:', 
      response.data.length > 0 ? 
      {count: response.data.length, firstMessage: response.data[0]} : 
      {count: 0});
    return response;
  },
  
  // Get count of replies for a message
  async getReplyCount(id) {
    const headers = await getAuthHeaders();
    return axios.get(`${apiBaseUrl}/messages/count/${id}`, { headers });
  },
  
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
  
  // Get recommended messages for feed
  async getRecommendedMessages(limit = 100) {
    // Make sure we don't exceed the server limit of 5000
    const safeLimit = Math.min(limit, 5000);
    const headers = await getAuthHeaders();
    const response = await axios.get(`${apiBaseUrl}/messages/recommended?limit=${safeLimit}`, { headers });
    console.log('[DEBUG] MessageService - getRecommendedMessages response:', 
      response.data.length > 0 ? 
      {count: response.data.length, firstMessage: response.data[0]} : 
      {count: 0});
    return response;
  },
  
  // Get public messages (for Feed tab)
  async getPublicMessages(limit = 10, cursor = null) {
    const headers = await getAuthHeaders();
    let url = `${apiBaseUrl}/tabs/feed?limit=${limit}`;
    
    // Add cursor parameter if provided
    if (cursor !== null) {
      url += `&cursor=${cursor}`;
    }
    
    const response = await axios.get(url, { headers });
    console.log('[DEBUG] MessageService - getPublicMessages response:', 
      response.data.messages?.length > 0 ? 
      {count: response.data.messages.length, firstMessage: response.data.messages[0], nextCursor: response.data.next_cursor} : 
      {count: 0, nextCursor: response.data.next_cursor});
    return response;
  },
  
  // Get curated messages (for Curated tab)
  async getCuratedMessages(limit = 10, cursor = null) {
    const headers = await getAuthHeaders();
    let url = `${apiBaseUrl}/tabs/curated?limit=${limit}`;
    
    // Add cursor parameter if provided
    if (cursor !== null) {
      url += `&cursor=${cursor}`;
    }
    
    const response = await axios.get(url, { headers });
    console.log('[DEBUG] MessageService - getCuratedMessages response:', 
      response.data.messages?.length > 0 ? 
      {count: response.data.messages.length, firstMessage: response.data.messages[0], nextCursor: response.data.next_cursor} : 
      {count: 0, nextCursor: response.data.next_cursor});
    return response;
  },
  
  // Get direct messages for current user
  async getDirectMessages(limit = 10, cursor = null) {
    const headers = await getAuthHeaders();
    let url = `${apiBaseUrl}/tabs/direct?limit=${limit}`;
    
    // Add cursor parameter if provided
    if (cursor !== null) {
      url += `&cursor=${cursor}`;
    }
    
    const response = await axios.get(url, { headers });
    console.log('[DEBUG] MessageService - getDirectMessages response:', 
      response.data.messages?.length > 0 ? 
      {count: response.data.messages.length, firstMessage: response.data.messages[0], nextCursor: response.data.next_cursor} : 
      {count: 0, nextCursor: response.data.next_cursor});
    return response;
  },
  
  // Get messages authored by the current user (for Profile tab)
  async getUserMessages(limit = 10, cursor = null, userId = null) {
    const headers = await getAuthHeaders();
    let url = `${apiBaseUrl}/tabs/by-user?limit=${limit}`;
    
    // Add cursor parameter if provided
    if (cursor !== null) {
      url += `&cursor=${cursor}`;
    }
    
    // Add userId parameter if provided
    if (userId) {
      url += `&user_id=${encodeURIComponent(userId)}`;
    }
    
    const response = await axios.get(url, { headers });
    console.log('[DEBUG] MessageService - getUserMessages response:', 
      response.data.messages?.length > 0 ? 
      {count: response.data.messages.length, firstMessage: response.data.messages[0], nextCursor: response.data.next_cursor} : 
      {count: 0, nextCursor: response.data.next_cursor});
    return response;
  },
  
  // For backward compatibility - alias to getDirectMessages
  async getPrivateMessages() {
    return this.getDirectMessages();
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
    const response = await axios.get(`${apiBaseUrl}/tabs/unread-count`, { headers });
    console.log('[DEBUG] MessageService - getUnreadMessageCount response:', response.data);
    return response;
  },

  // Reformat a message according to Stitch guidelines
  async reformatMessage(messageId) {
    const headers = await getAuthHeaders();
    return axios.post(`${apiBaseUrl}/messages/${messageId}/reformat`, {}, { headers });
  }
};
