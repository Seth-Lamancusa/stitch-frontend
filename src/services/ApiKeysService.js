import apiClient from './apiClient'
import TokenManager from './TokenManager'

export default {
  async listKeys() {
    const token = TokenManager.accessToken
    if (!token) throw new Error('No authentication token available')
    const resp = await apiClient.get('/auth/keys', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    return resp.data?.keys || []
  },

  async revokeKey(credId) {
    if (!credId) throw new Error('Key id required')
    const token = TokenManager.accessToken
    if (!token) throw new Error('No authentication token available')
    const resp = await apiClient.delete(`/auth/keys/${credId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    return !!resp.data?.revoked
  },

  async createKey({ label = '', scopes_cap, assurance, pop, env, expires_at } = {}) {
    const token = TokenManager.accessToken
    if (!token) throw new Error('No authentication token available')
    const body = { label, scopes_cap, assurance, pop, env }
    if (expires_at) body.expires_at = expires_at
    const resp = await apiClient.post('/auth/keys/self', body, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    return resp.data // { cred_id, api_key, expires_at }
  }
}


