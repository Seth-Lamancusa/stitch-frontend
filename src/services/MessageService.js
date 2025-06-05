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
  
  // Get chronological messages (for cloud tab main list)
  async getChronologicalMessages(limit = 10, cursor = null, filters = {}) {
    try {
      console.log('[MessageService] getChronologicalMessages called with:', {
        limit,
        cursor,
        filters: {
          ...filters,
          authorsCount: filters.authors?.length || 0,
          recipientsCount: filters.recipients?.length || 0
        }
      });
      
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (cursor) params.append('cursor', cursor);
      if (limit) params.append('limit', limit);
      
      // Add filter parameters - multiple authors support
      if (filters.authors && filters.authors.length > 0) {
        filters.authors.forEach(author => {
          // Extract UID from author (handle both object and string formats)
          const uid = typeof author === 'object' && author.uid ? author.uid : author;
          params.append('author_uid', uid);
        });
      }
      
      // Handle three-state public filter: 'public', 'private', 'all'
      if (filters.isPublic === 'public') {
        params.append('public', 'true');
      } else if (filters.isPublic === 'private') {
        params.append('public', 'false');
      }
      // If 'all', don't add public parameter to get both public and private messages
      
      if (filters.recipients && filters.recipients.length > 0) {
        filters.recipients.forEach(recipient => {
          // Extract UID from recipient (handle both object and string formats)
          const uid = typeof recipient === 'object' && recipient.uid ? recipient.uid : recipient;
          params.append('recipients', uid);
        });
      }
      
      // Add date filtering support
      if (filters.dateRange) {
        if (filters.dateRange.start) {
          params.append('date_start', filters.dateRange.start);
        }
        if (filters.dateRange.end) {
          params.append('date_end', filters.dateRange.end);
        }
      }

      // Add sort order parameter (simplified)
      if (filters.sortOrder) {
        params.append('sort_order', filters.sortOrder);
      }

      const finalUrl = `${apiBaseUrl}/messages/chronological?${params.toString()}`;
      console.log('[MessageService] Making API request to:', finalUrl);
      console.log('[MessageService] Request params string:', params.toString());
      
      const response = await axios.get(finalUrl, { headers });
      
      console.log('[MessageService] API response received:', {
        status: response.status,
        dataType: typeof response.data,
        messagesCount: response.data?.messages?.length || 0,
        exhausted: response.data?.exhausted,
        nextCursor: response.data?.next_cursor
      });
      
      return response.data;
    } catch (error) {
      console.error('[MessageService] Error fetching chronological messages:', {
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
  }
};
