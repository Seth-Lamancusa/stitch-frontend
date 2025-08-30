import axios from 'axios';
import TokenManager from './TokenManager';
import { installAxiosAuthInterceptor } from './httpClient';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});

installAxiosAuthInterceptor(apiClient);

export default {
  async listKeys() {
    const token = TokenManager.accessToken;
    if (!token) throw new Error('No authentication token available');
    const resp = await apiClient.get('/auth/keys', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return resp.data?.keys || [];
  },

  async revokeKey(credId) {
    if (!credId) throw new Error('Key id required');
    const token = TokenManager.accessToken;
    if (!token) throw new Error('No authentication token available');
    const resp = await apiClient.delete(`/auth/keys/${credId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return !!resp.data?.revoked;
  },

  async createKey({ label = '', scopes_cap, assurance, pop, env } = {}) {
    const token = TokenManager.accessToken;
    if (!token) throw new Error('No authentication token available');
    const resp = await apiClient.post('/auth/keys/self', { label, scopes_cap, assurance, pop, env }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return resp.data; // { cred_id, api_key }
  }
};


