import apiClient from './apiClient'
import authStore from '../auth/store.js'

export default {
  async listKeys() {
    if (authStore._state.status !== 'authenticated') throw new Error('Not authenticated')
    const resp = await apiClient.get('/auth/keys')
    return resp.data?.keys || []
  },

  async revokeKey(credId) {
    if (!credId) throw new Error('Key id required')
    if (authStore._state.status !== 'authenticated') throw new Error('Not authenticated')
    const resp = await apiClient.delete(`/auth/keys/${credId}`)
    return !!resp.data?.revoked
  },

  async createKey({ label = '', scopes_cap, assurance, pop, env } = {}) {
    if (authStore._state.status !== 'authenticated') throw new Error('Not authenticated')
    const resp = await apiClient.post('/auth/keys/self', { label, scopes_cap, assurance, pop, env })
    return resp.data // { cred_id, api_key }
  }
}
