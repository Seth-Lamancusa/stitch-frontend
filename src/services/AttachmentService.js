// Attachment upload service
import apiClient from './apiClient'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/x-python',
  'text/x-python-script',
  'text/x-script.python',
  'application/x-python-code',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/flac',
  'audio/x-flac',
  'audio/aac',
  'audio/mp4',
  'audio/webm',
  'audio/m4a',
  'audio/x-m4a'
]

const getAuthHeaders = () => ({})

// Validate file before upload
const validateFile = (file) => {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds 100MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`)
  }
  
  // Check file type
  const fileType = file.type.toLowerCase()
  const ext = (file.name || '').toLowerCase().split('.').pop()
  const isValidType =
    ALLOWED_TYPES.some(type => fileType === type) ||
    // Some browsers report empty/generic MIME types for code files; fall back to extension.
    ext === 'py' ||
                       fileType.startsWith('image/') ||
                       fileType.startsWith('audio/')
  
  if (!isValidType) {
    throw new Error(`File type not supported. Please upload a PDF, text file (.txt/.py), image, or audio file`)
  }
  
  return true
}

export default {
  async uploadFile(file, { onUploadProgress } = {}) {
    // Validate file before upload
    validateFile(file)
    
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const response = await apiClient.post('/files/upload', formData, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'multipart/form-data'
        },
        ...(typeof onUploadProgress === 'function'
          ? {
              onUploadProgress: (evt) => {
                const total = evt?.total
                const loaded = evt?.loaded
                const progress =
                  typeof total === 'number' && total > 0
                    ? Math.round((loaded / total) * 100)
                    : null

                onUploadProgress({ loaded, total, progress })
              }
            }
          : {})
      })
      
      return response.data
    } catch (error) {
      // Provide user-friendly error messages
      if (error.response) {
        const status = error.response.status
        const message = error.response.data?.detail || error.response.data?.error || error.message
        
        if (status === 400) {
          throw new Error(`Invalid file: ${message}`)
        } else if (status === 401) {
          throw new Error('Authentication required. Please log in again.')
        } else if (status === 403) {
          throw new Error('You do not have permission to upload files.')
        } else if (status === 413) {
          throw new Error('File is too large. Maximum size is 100MB.')
        } else {
          throw new Error(`Upload failed: ${message || 'Unknown error'}`)
        }
      } else if (error.request) {
        throw new Error('Network error. Please check your connection and try again.')
      } else {
        throw error
      }
    }
  }
}


