import apiClient from './apiClient'
import TokenManager from './TokenManager'

const apiBaseUrl = '/api/v1'

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = TokenManager.accessToken
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default {
  // Send a message or reply
  async sendReply(parentId, content, isPrivate = false, recipients = [], content_author = null) {
    const headers = getAuthHeaders()

    const messageData = { content, public: !isPrivate, recipients }
    if (parentId) messageData.parent_id = parentId
    if (content_author) messageData.content_author = content_author

    const response = await apiClient.post(`/messages`, [messageData], { headers })
    const results = Array.isArray(response.data) ? response.data : []
    const first = results[0] || null
    if (!first || !first.success || !first.message) {
      const err = first?.error || 'Unknown error creating message'
      throw new Error(err)
    }
    return { data: first.message, status: response.status }
  },

  // Add recipients to a message (or multiple messages)
  async addRecipientsToMessage(messageIdOrIds, recipients, addToAncestors = true, notifyOfLast = true) {
    const headers = getAuthHeaders()
    const body = Array.isArray(messageIdOrIds)
      ? { message_ids: messageIdOrIds, recipients }
      : { message_id: messageIdOrIds, recipients }
    const params = { add_to_ancestors: addToAncestors, notify_of_last: notifyOfLast }
    return apiClient.post(`/recipients/add`, body, { headers, params })
  },

  // Remove a recipient from a message (or multiple messages)
  async removeRecipientFromMessage(messageIdOrIds, recipientUid, propagateToDescendants = false) {
    const headers = getAuthHeaders()
    const body = Array.isArray(messageIdOrIds)
      ? { message_ids: messageIdOrIds, recipient_uid: recipientUid }
      : { message_id: messageIdOrIds, recipient_uid: recipientUid }
    const params = { propagate_to_descendants: propagateToDescendants }
    return apiClient.delete(`/recipients/remove`, { headers, params, data: body })
  },

  // Delete a message and optionally its descendants
  async deleteMessage(id, deleteDescendants = false) {
    const headers = getAuthHeaders()
    const params = { delete_descendants: deleteDescendants }
    return apiClient.delete(`/messages/${id}`, { headers, params })
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

  // Admin update message (update content and/or author)
  async adminUpdateMessage(id, { content, content_author } = {}) {
    const headers = getAuthHeaders()
    const body = {}
    if (typeof content === 'string') body.content = content
    if (content_author) body.content_author = content_author
    const response = await apiClient.patch(`/messages/${id}`, body, { headers })
    return response.data
  },
}
