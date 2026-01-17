import apiClient from './apiClient'
import TokenManager from './TokenManager'

const apiBaseUrl = '/v1'

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = TokenManager.accessToken
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default {
  // Send a message or reply (supports optional tags)
  // recipients can be:
  //   - String: "alice" or "@alice" or "uid:abc123" (defaults to notify=true, public=true)
  //   - Object: {user_tag: "alice", public: true, notify: false} for per-recipient control
  async sendReply(parentId, content, isPrivate = false, recipients = [], content_author = null, tags = null, files = null, subject = null, channel_ids = null) {
    const headers = getAuthHeaders()

    const messageData = { content, public: !isPrivate, recipients }
    if (subject) messageData.subject = subject
    if (parentId) messageData.parent_id = parentId
    if (content_author) messageData.content_author = content_author
    if (Array.isArray(tags)) messageData.tags = tags
    if (Array.isArray(files)) messageData.files = files
    if (Array.isArray(channel_ids)) messageData.channel_ids = channel_ids

    try {
      // Debug logging for outgoing payload
      // Note: avoid logging full content to keep logs concise
      console.log('[MessageService] sendReply payload', {
        parent_id: messageData.parent_id || null,
        subject: subject || null,
        content_length: content ? content.length : 0,
        recipients_count: Array.isArray(recipients) ? recipients.length : 0,
        content_author: content_author || null,
        is_private: !!isPrivate,
        tags_count: Array.isArray(tags) ? tags.length : 0,
      })

      const response = await apiClient.post(`/messages`, [messageData], { headers })
      const results = Array.isArray(response.data) ? response.data : []
      const first = results[0] || null

      console.log('[MessageService] sendReply response', {
        status: response?.status,
        success: first?.success ?? null,
        created_id: first?.message?.id ?? null,
        created_parent_id: first?.message?.parent_id ?? null,
        error: first?.error || null,
      })

      if (!first || !first.success || !first.message) {
        const err = first?.error || 'Unknown error creating message'
        throw new Error(err)
      }
      return { data: first.message, status: response.status }
    } catch (e) {
      console.error('[MessageService] sendReply error', e)
      throw e
    }
  },

  // Update message tags (full replace)
  async updateTags(id, tags) {
    const headers = getAuthHeaders()
    return apiClient.patch(`/messages/${id}/tags`, { tags: Array.isArray(tags) ? tags : [] }, { headers })
  },

  // Update message reply_order (custom ordering of replies)
  async updateReplyOrder(id, replyOrder) {
    const headers = getAuthHeaders()
    // replyOrder can be null to clear ordering, or an array of reply IDs
    return apiClient.patch(`/messages/${id}/reply_order`, { reply_order: replyOrder }, { headers })
  },

  // Unified search: content (q) and tags
  async search({ q = null, tags = [], match = 'any', skip = 0, limit = 15 } = {}) {
    const headers = getAuthHeaders()
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (Array.isArray(tags) && tags.length > 0) params.set('tags', tags.join(','))
    if (match) params.set('match', match)
    params.set('skip', String(skip))
    params.set('limit', String(limit))
    const url = `/messages/search?${params.toString()}`
    return apiClient.get(url, { headers })
  },

  // Add recipients to a message (or multiple messages)
  // recipients can be:
  //   - String: "alice" or "@alice" or "uid:abc123" (defaults to notify=true, public=true)
  //   - Object: {user_tag: "alice", public: true, notify: false} for per-recipient control
  // propagationStrategy: "NONE" (default), "ANCESTORS", or "TREE"
  async addRecipientsToMessage(messageIdOrIds, recipients, addToAncestors = true, addToFullTree = false) {
    const headers = getAuthHeaders()
    
    // Determine propagation strategy from parameters
    let propagationStrategy = "NONE"
    if (addToFullTree) {
      propagationStrategy = "TREE"
    } else if (addToAncestors) {
      propagationStrategy = "ANCESTORS"
    }
    
    const body = Array.isArray(messageIdOrIds)
      ? { 
          message_ids: messageIdOrIds, 
          recipients,
          ...(propagationStrategy !== "NONE" && { propagation: { strategy: propagationStrategy } })
        }
      : { 
          message_id: messageIdOrIds, 
          recipients,
          ...(propagationStrategy !== "NONE" && { propagation: { strategy: propagationStrategy } })
        }
    
    return apiClient.post(`/recipients/add`, body, { headers })
  },

  // Remove a recipient from a message (or multiple messages)
  async removeRecipientFromMessage(messageIdOrIds, recipientUid, propagateToDescendants = false) {
    const headers = getAuthHeaders()
    const body = Array.isArray(messageIdOrIds)
      ? { message_ids: messageIdOrIds, recipient_uid: recipientUid, propagate_to_descendants: propagateToDescendants }
      : { message_id: messageIdOrIds, recipient_uid: recipientUid, propagate_to_descendants: propagateToDescendants }
    return apiClient.delete(`/recipients/remove`, { headers, data: body })
  },

  // Delete a message and optionally its descendants
  async deleteMessage(id, deleteDescendants = false) {
    console.log(`[MessageService.deleteMessage] id=${id}, deleteDescendants=${deleteDescendants}, type=${typeof deleteDescendants}`)
    const headers = getAuthHeaders()
    const params = { delete_descendants: deleteDescendants }
    console.log(`[MessageService.deleteMessage] params=`, params)
    return apiClient.delete(`/messages/${id}`, { headers, params })
  },

  // Set message public flag
  async setPublic(id, isPublic) {
    const headers = getAuthHeaders()
    return apiClient.patch(`/messages/${id}/public`, { public: !!isPublic }, { headers })
  },

  // Load messages via unified traversal endpoint
  async traverseFrom(messageId, { up_depth = 2, down_depth = 2, get_replies = true, get_children = false } = {}) {
    const headers = getAuthHeaders()
    const url = `/messages/traverse-from/${messageId}?up_depth=${up_depth}&down_depth=${down_depth}&get_replies=${get_replies}&get_children=${get_children}`
    const response = await apiClient.get(url, { headers })
    return response
  },

  // Load parent branch with specified depth (via unified traversal)
  async loadBranchUp(messageId, depth = 2, get_replies = true, get_children = true) {
    const headers = getAuthHeaders()
    const response = await this.traverseFrom(messageId, { up_depth: depth, down_depth: 0, get_replies, get_children })
    const data = response.data || {}
    const combined = []
    if (data.origin) combined.push(data.origin)
    if (Array.isArray(data.messages)) combined.push(...data.messages)
    return { data: combined, status: response.status }
  },

  // Load child branch with specified depth (via unified traversal)
  async loadBranchDown(messageId, depth = 2, get_replies = true, get_children = true) {
    const headers = getAuthHeaders()
    const response = await this.traverseFrom(messageId, { up_depth: 0, down_depth: depth, get_replies, get_children })
    const data = response.data || {}
    const combined = []
    if (data.origin) combined.push(data.origin)
    if (Array.isArray(data.messages)) combined.push(...data.messages)
    return { data: combined, status: response.status }
  },

  // Load messages within a radius of a target message
  async loadMessageRadius(messageId, radius = 5, get_replies = true, get_children = true) {
    const headers = getAuthHeaders()
    const response = await this.traverseFrom(messageId, { up_depth: radius, down_depth: radius, get_replies, get_children })
    const data = response.data || {}
    const combined = []
    if (data.origin) combined.push(data.origin)
    if (Array.isArray(data.messages)) combined.push(...data.messages)
    return { data: combined, status: response.status }
  },

  // Mark a message as read
  async markMessageAsRead(id) {
    const headers = await getAuthHeaders()
    return apiClient.post(`/users/messages/mark-read`, { message_id: id }, { headers })
  },

  // Mark a message as unread
  async markMessageAsUnread(id) {
    const headers = await getAuthHeaders()
    return apiClient.post(`/users/messages/${id}/mark-unread`, {}, { headers })
  },

  // Get public messages with pagination
  async getPublicMessages(skip = 0, limit = 15) {
    const headers = await getAuthHeaders()
    return apiClient.get(`/messages/public?skip=${skip}&limit=${limit}`, { headers })
  },

  // Get user history root messages (auth required)
  async getUserHistory(skip = 0, limit = 6) {
    const headers = await getAuthHeaders()
    return apiClient.get(`/messages/history?skip=${skip}&limit=${limit}`, { headers })
  },

  // Get all tags for the current user
  async getAllTags() {
    const headers = getAuthHeaders()
    return apiClient.get(`/messages/tags`, { headers })
  },

  
}
