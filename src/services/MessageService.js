import axios from 'axios';
import TokenManager from './TokenManager';

const apiBaseUrl = '/api';

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = TokenManager.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
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
    
    const headers = getAuthHeaders();
    
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
    
    // Always include content_author when provided (backend requires it)
    if (content_author) {
      messageData.content_author = content_author;
    }
    
    console.log('[MessageService] Sending API request with data:', {
      endpoint: `${apiBaseUrl}/messages`,
      messageData: {
        ...messageData,
        content: messageData.content ? `${messageData.content.substring(0, 50)}...` : null
      },
      hasHeaders: !!headers
    });
    
    try {
      // Unified endpoint returns an array; wrap single request in array
      const response = await axios.post(`${apiBaseUrl}/messages`, [messageData], { headers });
      const results = Array.isArray(response.data) ? response.data : [];
      const first = results[0] || null;
      if (!first || !first.success || !first.message) {
        const err = first?.error || 'Unknown error creating message';
        throw new Error(err);
      }
      console.log('[MessageService] API request successful:', {
        status: response.status,
        messageId: first.message.id,
        hasData: true
      });
      // Normalize to previous shape where response.data was the message
      return { data: first.message, status: response.status };
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
  
  // Add recipients to a message (or multiple messages)
  // New semantics: addToTree expands to visible tree, notifyForId toggles single-message notification
  async addRecipientsToMessage(messageIdOrIds, recipients, { addToTree = false, notifyForId = true } = {}) {
    const headers = getAuthHeaders();
    const body = Array.isArray(messageIdOrIds)
      ? { message_ids: messageIdOrIds, recipients }
      : { message_id: messageIdOrIds, recipients };
    const params = { add_to_tree: addToTree, notify_for_id: notifyForId };
    return axios.post(`${apiBaseUrl}/recipients/add`, body, { headers, params });
  },

  // Remove a recipient from a message (or multiple messages)
  async removeRecipientFromMessage(messageIdOrIds, recipientUid, propagateToDescendants = false) {
    const headers = getAuthHeaders();
    const body = Array.isArray(messageIdOrIds)
      ? { message_ids: messageIdOrIds, recipient_uid: recipientUid }
      : { message_id: messageIdOrIds, recipient_uid: recipientUid };
    const params = { propagate_to_descendants: propagateToDescendants };
    return axios.delete(`${apiBaseUrl}/recipients/remove`, { headers, params, data: body });
  },
  
  // Delete a message and optionally its descendants
  async deleteMessage(id, deleteDescendants = false) {
    const headers = getAuthHeaders();
    const params = { delete_descendants: deleteDescendants };
    return axios.delete(`${apiBaseUrl}/messages/${id}`, { headers, params });
  },
  
  // Pin a message (admin only)
  async pinMessage(id) {
    throw new Error('pinMessage is not supported by the server');
  },
  
  // Unpin a message (admin only)
  async unpinMessage(id) {
    throw new Error('unpinMessage is not supported by the server');
  },
  
  // Load messages via unified traversal endpoint
  async traverseFrom(messageId, { up_depth = 2, down_depth = 2, get_replies = true, get_children = false } = {}) {
    const headers = getAuthHeaders();
    const url = `${apiBaseUrl}/messages/traverse-from/${messageId}?up_depth=${up_depth}&down_depth=${down_depth}&get_replies=${get_replies}&get_children=${get_children}`;
    const response = await axios.get(url, { headers });
    return response;
  },
  
  // Load parent branch with specified depth (via unified traversal)
  async loadBranchUp(messageId, depth = 2, get_replies = true, get_children = true) {
    const headers = getAuthHeaders();
    const response = await this.traverseFrom(messageId, { up_depth: depth, down_depth: 0, get_replies, get_children });
    const data = response.data || {};
    const combined = [];
    if (data.origin) combined.push(data.origin);
    if (Array.isArray(data.messages)) combined.push(...data.messages);
    console.log(`[DEBUG] MessageService - loadBranchUp(${messageId}, depth=${depth}, get_replies=${get_replies}) response:`,
      combined.length > 0 ? { count: combined.length, firstMessage: combined[0] } : { count: 0 }
    );
    return { data: combined, status: response.status };
  },
  
  // Load child branch with specified depth (via unified traversal)
  async loadBranchDown(messageId, depth = 2, get_replies = true, get_children = true) {
    const headers = getAuthHeaders();
    const response = await this.traverseFrom(messageId, { up_depth: 0, down_depth: depth, get_replies, get_children });
    const data = response.data || {};
    const combined = [];
    if (data.origin) combined.push(data.origin);
    if (Array.isArray(data.messages)) combined.push(...data.messages);
    console.log(`[DEBUG] MessageService - loadBranchDown(${messageId}, depth=${depth}, get_replies=${get_replies}) response:`,
      combined.length > 0 ? { count: combined.length, firstMessage: combined[0] } : { count: 0 }
    );
    return { data: combined, status: response.status };
  },
  
  // Load messages within a radius of a target message (both parents and children) via unified traversal
  async loadMessageRadius(messageId, radius = 5, get_replies = true, get_children = true) {
    const headers = getAuthHeaders();
    const response = await this.traverseFrom(messageId, { up_depth: radius, down_depth: radius, get_replies, get_children });
    const data = response.data || {};
    const combined = [];
    if (data.origin) combined.push(data.origin);
    if (Array.isArray(data.messages)) combined.push(...data.messages);
    console.log(`[DEBUG] MessageService - loadMessageRadius(${messageId}, radius=${radius}, get_replies=${get_replies}) response:`,
      combined.length > 0 ? { count: combined.length, messageIds: combined.map(m => m.id) } : { count: 0 }
    );
    return { data: combined, status: response.status };
  },
  
  
  
  // Mark a message as read
  async markMessageAsRead(id) {
    const headers = await getAuthHeaders();
    return axios.post(`${apiBaseUrl}/users/messages/mark-read`, { message_id: id }, { headers });
  },
  
  // Mark a message as unread
  async markMessageAsUnread(id) {
    const headers = await getAuthHeaders();
    return axios.post(`${apiBaseUrl}/users/messages/${id}/mark-unread`, {}, { headers });
  },
  
  // Removed: getUnreadMessageCount (no server endpoint)

  // Removed: reformat (no server endpoint)

  // Get public messages with pagination
  async getPublicMessages(skip = 0, limit = 15) {
    const headers = await getAuthHeaders();
    return axios.get(`${apiBaseUrl}/messages/public?skip=${skip}&limit=${limit}`, { headers });
  },

  // Removed: getAllSavedMessages (use /users/saved-messages via UserService)

  // Removed: updateReadStatus (no server endpoint)

  

  // Removed: updateMessage (no server endpoint)

  // Admin update message (update content and/or author)
  async adminUpdateMessage(id, { content, content_author } = {}) {
    const headers = getAuthHeaders();
    const body = {};
    if (typeof content === 'string') body.content = content;
    if (content_author) body.content_author = content_author;
    const response = await axios.patch(`${apiBaseUrl}/messages/${id}`, body, { headers });
    // Normalize to previous shape where consumers expect a MessageResponse object
    return response.data;
  },
};
