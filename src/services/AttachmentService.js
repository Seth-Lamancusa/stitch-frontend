// Minimal attachment upload service
import apiClient from './apiClient'

const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default {
  async uploadFile(file) {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await apiClient.post('/attachments/upload', formData, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'multipart/form-data'
      }
    })
    
    return response.data
  }
}




