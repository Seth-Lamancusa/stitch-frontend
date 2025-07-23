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
      recipients // Expects array of recipient objects with {uid, visible, etc}
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
  
  // Add recipients to an existing message
  async addRecipientsToMessage(messageId, recipients, propagateToDescendants = false) {
    console.log('[MessageService] addRecipientsToMessage called with:', {
      messageId,
      recipientsCount: recipients?.length || 0
    });
    
    const headers = await getAuthHeaders();
    
    const requestData = {
      recipients
    };
    
    console.log('[MessageService] Sending add recipients request:', {
      endpoint: `${apiBaseUrl}/messages/${messageId}/recipients`,
      requestData,
      propagateToDescendants,
      hasHeaders: !!headers
    });
    
    try {
      const url = `${apiBaseUrl}/messages/${messageId}/recipients${propagateToDescendants ? '?propagate_to_descendants=true' : ''}`;
      const response = await axios.post(url, requestData, { headers });
      console.log('[MessageService] Add recipients request successful:', {
        status: response.status,
        addedCount: response.data?.added_recipients?.length || 0,
        skippedCount: response.data?.skipped_recipients?.length || 0
      });
      return response;
    } catch (error) {
      console.error('[MessageService] Add recipients request failed:', error);
      console.error('[MessageService] Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      throw error;
    }
  },
  
  // Remove a recipient from an existing message
  async removeRecipientFromMessage(messageId, recipientUid, propagateToDescendants = false) {
    console.log('[MessageService] removeRecipientFromMessage called with:', {
      messageId,
      recipientUid,
      propagateToDescendants
    });
    
    const headers = await getAuthHeaders();
    
    console.log('[MessageService] Sending remove recipient request:', {
      endpoint: `${apiBaseUrl}/messages/${messageId}/recipients/${recipientUid}`,
      propagateToDescendants,
      hasHeaders: !!headers
    });
    
    try {
      const url = `${apiBaseUrl}/messages/${messageId}/recipients/${recipientUid}${propagateToDescendants ? '?propagate_to_descendants=true' : ''}`;
      const response = await axios.delete(url, { headers });
      console.log('[MessageService] Remove recipient request successful:', {
        status: response.status,
        removed: response.data?.removed_recipient
      });
      return response;
    } catch (error) {
      console.error('[MessageService] Remove recipient request failed:', error);
      console.error('[MessageService] Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      throw error;
    }
  },
  
  // Delete a message and optionally its descendants
  async deleteMessage(id, deleteDescendants = false) {
    const headers = await getAuthHeaders();
    const params = { delete_descendants: deleteDescendants };
    return axios.delete(`${apiBaseUrl}/messages/${id}`, { headers, params });
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
  
  // Load parent branch with specified depth
  async loadBranchUp(messageId, depth = 2, get_replies = true) {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${apiBaseUrl}/messages/branch_up/${messageId}?depth=${depth}&get_replies=${get_replies}`, { headers });
    console.log(`[DEBUG] MessageService - loadBranchUp(${messageId}, depth=${depth}, get_replies=${get_replies}) response:`, 
      response.data.length > 0 ? 
      {count: response.data.length, firstMessage: response.data[0]} : 
      {count: 0});
    return response;
  },
  
  // Load child branch with specified depth
  async loadBranchDown(messageId, depth = 2, get_replies = true) {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${apiBaseUrl}/messages/branch_down/${messageId}?depth=${depth}&get_replies=${get_replies}`, { headers });
    console.log(`[DEBUG] MessageService - loadBranchDown(${messageId}, depth=${depth}, get_replies=${get_replies}) response:`, 
      response.data.length > 0 ? 
      {count: response.data.length, firstMessage: response.data[0]} : 
      {count: 0});
    return response;
  },
  
  // Load messages within a radius of a target message (both parents and children)
  async loadMessageRadius(messageId, radius = 5, get_replies = true) {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${apiBaseUrl}/messages/radius/${messageId}?radius=${radius}&get_replies=${get_replies}`, { headers });
    console.log(`[DEBUG] MessageService - loadMessageRadius(${messageId}, radius=${radius}, get_replies=${get_replies}) response:`, 
      response.data.length > 0 ? 
      {count: response.data.length, messageIds: response.data.map(m => m.id)} : 
      {count: 0});
    return response;
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
  async getPublicMessages(skip = 0, limit = 15) {
    const headers = await getAuthHeaders();
    return axios.get(`${apiBaseUrl}/messages/public?skip=${skip}&limit=${limit}`, { headers });
  },

  // Get all saved messages with pagination  
  async getAllSavedMessages(skip = 0, limit = 15) {
    const headers = await getAuthHeaders();
    return axios.get(`${apiBaseUrl}/messages/saved?skip=${skip}&limit=${limit}`, { headers });
  },

  // Update message read status
  async updateReadStatus(id, isRead) {
    const headers = await getAuthHeaders();
    return axios.patch(`${apiBaseUrl}/messages/${id}/read-status`, { is_read: isRead }, { headers });
  },

  // Get read out loud audio for a message
  async getReadOutLoudAudio(messageId) {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${apiBaseUrl}/messages/${messageId}/read_out_loud`, {
      headers,
      responseType: 'blob',
    });
    return response;
  },
};
