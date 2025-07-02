import axios from 'axios';
import { getFirebaseToken } from '../firebase.js';

const API_BASE_URL = '/api';

class AdminService {
  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/admin`,
      timeout: 30000,
    });

    // Add auth token to requests
    this.client.interceptors.request.use(async (config) => {
      try {
        const token = await getFirebaseToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.error('Error getting Firebase token:', error);
      }
      return config;
    });

    // Handle auth errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized - could redirect to login
          console.error('Admin API: Unauthorized access');
        } else if (error.response?.status === 403) {
          console.error('Admin API: Access forbidden - admin privileges required');
        }
        throw error;
      }
    );
  }

  // User management methods
  async getUsers(params = {}) {
    try {
      // Set default limit if not provided
      const defaultParams = { limit: 15, skip: 0, ...params };
      const response = await this.client.get('/users', { params: defaultParams });
      return {
        users: response.data.users,
        total: response.data.total,
        has_more: response.data.has_more,
        success: true
      };
    } catch (error) {
      console.error('Error fetching users:', error);
      return {
        users: [],
        total: 0,
        has_more: false,
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  }

  async createUser(userData) {
    try {
      const response = await this.client.post('/users', userData);
      return {
        success: true,
        user: response.data.user,
        message: response.data.message || 'User created successfully'
      };
    } catch (error) {
      console.error('Error creating user:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to create user'
      };
    }
  }

  async getStats() {
    try {
      const response = await this.client.get('/stats');
      return {
        stats: response.data,
        success: true
      };
    } catch (error) {
      console.error('Error fetching stats:', error);
      return {
        stats: null,
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  }

  async getMetrics() {
    try {
      const response = await this.client.get('/metrics');
      return {
        metrics: response.data,
        success: true
      };
    } catch (error) {
      console.error('Error fetching metrics:', error);
      return {
        metrics: null,
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  }

  async resetMetrics() {
    try {
      const response = await this.client.post('/metrics/reset');
      return {
        success: true,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error resetting metrics:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  }

  // Note: Toggle methods removed - not implemented in simplified admin endpoints

  // Message management methods
  async getMessages(params = {}) {
    try {
      // Set default limit if not provided
      const defaultParams = { limit: 15, skip: 0, ...params };
      const response = await this.client.get('/messages', { params: defaultParams });
      return {
        messages: response.data.messages,
        total: response.data.total,
        has_more: response.data.has_more,
        success: true
      };
    } catch (error) {
      console.error('Error fetching messages:', error);
      return {
        messages: [],
        total: 0,
        has_more: false,
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  }



  // Note: Delete and toggle methods removed - not implemented in simplified admin endpoints

  // Search methods
  async searchUsers(query) {
    return this.getUsers({ search: query });
  }

  async searchMessages(query) {
    return this.getMessages({ search: query });
  }

  // Note: Bulk operations and advanced analytics removed for simplified implementation

  // Note: Export functionality and health check removed for simplified implementation
}

export default new AdminService(); 