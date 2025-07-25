<template>
  <div class="import-view">
    <div class="import-header">
      <button @click="cancelImport()" class="back-button">
        &larr; Cancel
      </button>
      <h2 class="import-title">Import Conversation</h2>
    </div>

    <!-- Main content area -->
    <div class="import-content">
      <div class="import-panel">
        <h3>Import AI Conversation</h3>
        
        <!-- Bot Selection -->
        <div class="bot-selection-container">
          <label class="bot-selection-label">Select AI Assistant:</label>
      <select 
            v-model="selectedBot" 
            class="bot-selection-dropdown"
            :disabled="isImporting"
      >
            <option value="">Choose an AI assistant...</option>
        <option 
              v-for="bot in availableBots" 
              :key="bot.uid" 
              :value="bot"
            >
              {{ bot.display_name }}
        </option>
      </select>
          <p v-if="!selectedBot" class="bot-selection-hint">
            Select the AI assistant that was used in your conversation
          </p>
    </div>

        <!-- Input Method Selection -->
        <div class="input-method-container">
          <div class="input-method-tabs">
          <button 
              @click="inputMethod = 'text'" 
              :class="{ active: inputMethod === 'text' }"
              class="input-method-tab"
            >
              Paste Text
          </button>
            <button 
              @click="inputMethod = 'file'" 
              :class="{ active: inputMethod === 'file' }"
              class="input-method-tab"
            >
              Upload File
            </button>
        </div>
        
          <!-- Text Input -->
          <div v-if="inputMethod === 'text'" class="text-input-container">
        <textarea 
          v-model="importText"
          class="import-textarea"
              placeholder="Paste your conversation here...

Supported formats:
• ChatGPT conversations (copy from web interface)
• Claude conversations (copy from web interface)  
• Gemini conversations (copy from web interface)
• Cursor markdown exports (.md files)
• Plain text conversations

The format will be auto-detected once you paste your conversation."
          :disabled="isImporting"
        />
        </div>
        
          <!-- File Upload -->
          <div v-if="inputMethod === 'file'" class="file-upload-container">
          <input 
            type="file" 
              ref="fileInput"
              accept=".md,.txt,.markdown"
              @change="handleFileUpload"
            :disabled="isImporting"
            class="file-input"
              id="file-input"
            />
            <label for="file-input" class="file-upload-label" :class="{ 'disabled': isImporting }">
              <span v-if="!uploadedFileName">Choose File (.md, .txt, .markdown)</span>
              <span v-else>{{ uploadedFileName }}</span>
            <span class="file-icon">📁</span>
          </label>
            <p class="file-upload-hint">
              Upload markdown files from Cursor or plain text conversation files
            </p>
              </div>
          </div>
          
        <!-- Conversation Settings -->
        <div v-if="parsedMessages.length > 0" class="conversation-settings">
          <h4>Conversation Settings</h4>
          
          <!-- Public/Private Toggle -->
          <div class="setting-group">
            <label class="setting-label">Visibility:</label>
            <div class="visibility-toggle">
              <button 
                @click="isPublic = !isPublic"
                class="visibility-toggle-button"
                :class="{ 'public': isPublic, 'private': !isPublic }"
                :disabled="isImporting"
              >
                <span class="toggle-slider"></span>
                <span class="toggle-label">{{ isPublic ? 'Public' : 'Private' }}</span>
              </button>
            </div>
          </div>

          <!-- Recipients -->
          <div class="setting-group">
            <label class="setting-label">Recipients:</label>
          <button 
              class="recipients-button" 
              @click="showRecipientSelector = true"
              :disabled="isImporting"
            >
              👥 Add Recipients ({{ recipients.length }})
          </button>
            <p class="setting-hint">
              Add users who should have access to this imported conversation
          </p>
        </div>
      </div>

        <!-- Format Detection & Preview -->
        <div v-if="parsedMessages.length > 0" class="import-content-container">
          <div class="import-preview">
            <div class="preview-header">
              <h4>Preview ({{ parsedMessages.length }} messages)</h4>
              <div v-if="formatDetection.hint" class="format-detection" :class="formatDetection.format">
                <span class="format-icon">{{ getFormatIcon() }}</span>
                <span class="format-hint">{{ formatDetection.hint }}</span>
              </div>
            </div>
            <div class="preview-messages">
              <div v-for="(msg, index) in parsedMessages" :key="index" class="preview-message">
                <span class="preview-role">{{ msg.role === 'user' ? 'You' : selectedBot?.display_name || 'AI' }}:</span>
                <span class="preview-content">{{ truncateContent(msg.content) }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Import Errors -->
        <div v-if="importErrors.length > 0" class="import-errors">
          <p class="error-title">Please fix the following issues:</p>
          <ul>
            <li v-for="(error, index) in importErrors" :key="index">{{ error }}</li>
          </ul>
        </div>
        
        <!-- Import Button -->
        <div class="import-button-container">
          <button 
            @click="importConversation"
            :disabled="!canImport || isImporting"
            class="import-button"
            :class="{ 'importing': isImporting, 'disabled': !hasImportPermissions }"
          >
            <span v-if="!isImporting">Import {{ parsedMessages.length }} Messages</span>
            <span v-else>Importing...</span>
          </button>
          <p v-if="!hasImportPermissions" class="permission-message">
            {{ importPermissionMessage }}
          </p>
        </div>
      </div>
    </div>
    
    <!-- Loading Overlay -->
    <div v-if="isImporting" class="loading-overlay">
      <div class="loading-content">
        <div v-if="importSuccess" class="success-animation">
          <svg class="checkmark" viewBox="0 0 52 52">
            <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
            <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
          <p class="success-message">Import Successful!</p>
          <p class="success-submessage">Redirecting to your imported conversation...</p>
        </div>
        <div v-else>
          <div class="loading-main-line">
            <p class="loading-message">{{ loadingMessage }}</p>
            <div class="import-spinner"></div>
          </div>
          <p class="loading-submessage">{{ loadingSubmessage }}</p>
        </div>
      </div>
    </div>

    <!-- Recipients Modal -->
    <RecipientsModal
      :is-visible="showRecipientSelector"
      :is-public="isPublic"
      :is-add-mode="false"
      @close="closeRecipientSelector"
      @done="closeRecipientSelector"
    />

    <!-- Global Notifications component -->
    <GlobalNotifications />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import ImportService from '../../services/ImportService';
import RecipientsModal from '../../components/RecipientsModal.vue';
import GlobalNotifications from '../../components/GlobalNotifications.vue';
import { useBrowserCapabilities } from '../../composables/useBrowserCapabilities.js';

// Setup store and routing
const store = useStore();
const router = useRouter();

// Browser capabilities detection
const { 
  capabilities, 
  isLowEnd, 
  shouldUseReducedAnimations, 
  getOptimalImageFormat,
  getRecommendedQuality 
} = useBrowserCapabilities();

// Refs
const fileInput = ref(null);

// UI State
const inputMethod = ref('text');
const importText = ref('');
const uploadedFileName = ref('');
const selectedBot = ref('');
const isPublic = ref(true);
const recipients = ref([]);
const showRecipientSelector = ref(false);

// Import State
const isImporting = ref(false);
const parsedMessages = ref([]);
const importErrors = ref([]);
const importSuccess = ref(false);
const loadingMessage = ref('Importing conversation...');
const loadingSubmessage = ref('This will only take a moment');
const formatDetection = ref({ format: 'unknown', confidence: 0, hint: '' });

// Computed properties from store
const user = computed(() => store.getters['auth/user']);
const availableBots = computed(() => store.getters['bots/bots']);

// Computed property for import permissions
const hasImportPermissions = computed(() => {
  if (!user.value) return false;
  return user.value.status === 'import' || user.value.status === 'admin';
});

// Computed property for import button state
const canImport = computed(() => {
  return hasImportPermissions.value && 
         selectedBot.value && 
           parsedMessages.value.length > 0 && 
         parsedMessages.value.length <= 30 &&
           importErrors.value.length === 0;
});

// Computed property for permission error message
const importPermissionMessage = computed(() => {
  if (!user.value) {
    return 'You need to log in with import permissions to use this feature';
  } else if (user.value.status === 'whitelisted') {
    return 'You need import permissions to use this feature';
  } else {
    return 'Import permissions required';
  }
});

// Methods
const cancelImport = () => {
  router.back();
};

const truncateContent = (content) => {
  // Clean up content first - remove extra whitespace and normalize line breaks
  const cleanContent = content.replace(/\s+/g, ' ').trim();
  
  // If content is short enough, return as-is
  if (cleanContent.length <= 120) return cleanContent;
  
  // Split into words for better truncation
  const words = cleanContent.split(' ');
  
  // If we have few words, just truncate by character
  if (words.length <= 8) {
    return cleanContent.substring(0, 100) + '...';
  }
  
  // Take first 6 words and last 4 words
  const firstWords = words.slice(0, 6).join(' ');
  const lastWords = words.slice(-4).join(' ');
  
  // Make sure we're not showing too much
  const maxFirstLength = 60;
  const maxLastLength = 40;
  
  const truncatedFirst = firstWords.length > maxFirstLength 
    ? firstWords.substring(0, maxFirstLength).trim() 
    : firstWords;
    
  const truncatedLast = lastWords.length > maxLastLength 
    ? lastWords.substring(-maxLastLength).trim() 
    : lastWords;
  
  return `${truncatedFirst}...${truncatedLast}`;
};

const getFormatIcon = () => {
  switch (formatDetection.value.format) {
    case 'cursor-markdown':
      return '✅';
    case 'chatgpt':
    case 'claude':
    case 'gemini':
      return '✅';
    case 'detected':
      return '✅';
    case 'no-bot-selected':
      return '⚠️';
    case 'generic':
      return '⚠️';
    case 'unknown':
      return '❓';
    default:
      return '💬';
  }
};

// Auto-detection and parsing logic
const parseConversation = (text) => {
  if (!text.trim()) {
    return { format: 'unknown', messages: [], hint: 'No text provided' };
  }

  if (!selectedBot.value) {
    return { 
      format: 'no-bot-selected', 
      messages: [], 
      hint: 'Please select an AI assistant first, then upload your conversation file.' 
    };
  }

  // Use the consolidated parsing method
  const botName = selectedBot.value.display_name || '';
  const messages = ImportService.parseConversation(text, botName);
  
  if (messages.length > 0) {
    return { 
      format: 'detected', 
      messages, 
      hint: `Conversation format detected (${messages.length} messages)` 
    };
  }

  return { 
    format: 'unknown', 
    messages: [], 
    hint: 'No conversation format detected. Please check your input.' 
  };
};

// File upload handler
const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) {
    uploadedFileName.value = '';
    importText.value = '';
    parsedMessages.value = [];
    importErrors.value = [];
    formatDetection.value = { format: 'unknown', confidence: 0, hint: '' };
    return;
  }
  
  // Clear text input when file is uploaded
  importText.value = '';
  
  // Validate file type
  const validExtensions = ['.md', '.txt', '.markdown'];
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  
  if (!validExtensions.includes(fileExtension)) {
    importErrors.value = ['Please select a .md, .txt, or .markdown file'];
    uploadedFileName.value = '';
    parsedMessages.value = [];
    formatDetection.value = { format: 'unknown', confidence: 0, hint: 'Invalid file type' };
    return;
  }
  
  // Validate file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    importErrors.value = ['File is too large (max 10MB)'];
    uploadedFileName.value = '';
    parsedMessages.value = [];
    formatDetection.value = { format: 'unknown', confidence: 0, hint: 'File too large' };
    return;
  }
  
  try {
    const content = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
    
    uploadedFileName.value = file.name;
    
    // Parse the file content
    const result = parseConversation(content);
    formatDetection.value = result;
    parsedMessages.value = result.messages;
    
    // Handle specific error cases
    if (result.format === 'no-bot-selected') {
      importErrors.value = ['Please select an AI assistant from the dropdown above before uploading your conversation file.'];
      return;
    }
    
    // Validate messages
    const validation = ImportService.validateMessages(result.messages);
    importErrors.value = validation.errors;
    
  } catch (error) {
    console.error('[DEBUG ImportView] Error reading file:', error);
    importErrors.value = ['Failed to read file'];
    uploadedFileName.value = '';
    parsedMessages.value = [];
    formatDetection.value = { format: 'unknown', confidence: 0, hint: 'Read error' };
  }
};

// Recipients modal handlers
const closeRecipientSelector = () => {
  showRecipientSelector.value = false;
};

// Main import function
const importConversation = async () => {
  if (!canImport.value || isImporting.value) return;
  
  try {
    isImporting.value = true;
    importSuccess.value = false;
    
    const messageCount = parsedMessages.value.length;
    loadingMessage.value = `Importing ${messageCount} messages...`;
    
    if (capabilities.isLowBandwidth) {
      loadingSubmessage.value = 'Processing conversation (this may take longer on slow connections)';
    } else if (isLowEnd()) {
      loadingSubmessage.value = 'Processing your conversation (optimizing for your device)';
    } else if (messageCount > 20) {
      loadingSubmessage.value = 'Processing large conversation - this may take a moment';
    } else {
      loadingSubmessage.value = `Processing your ${selectedBot.value.display_name} conversation`;
    }
    
    // Use the unified import method
    const result = await ImportService.importConversation(
      parsedMessages.value,
      selectedBot.value,
      recipients.value,
      isPublic.value
    );
    
    if (result.success && result.thread_id) {
      importSuccess.value = true;
      loadingMessage.value = 'Import Successful!';
      loadingSubmessage.value = 'Redirecting to your imported conversation...';
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      router.push({ path: `/${result.thread_id}` });
      
      // Show appropriate success message
      if (result.partial_success) {
        store.commit('ui/SET_WARNING', 
          `Imported ${result.message_count} of ${result.total_requested} messages. Some messages failed to import.`
        );
      } else {
        store.commit('ui/SET_SUCCESS', 
          `Successfully imported ${result.message_count} messages`
        );
      }
    } else {
      throw new Error('Import returned unexpected result');
    }
  } catch (error) {
    console.error('Import failed:', error);
    
    let errorMessage = 'Failed to import conversation';
    
    if (error.response?.status === 429) {
      errorMessage = error.response.data?.detail || 'You have exceeded the import rate limit. Please try again later.';
    } else if (error.response?.status === 403) {
      errorMessage = 'You do not have permission to import conversations. Only users with import permissions can import.';
    } else if (error.response?.status === 400) {
      errorMessage = error.response.data?.detail || 'Invalid conversation format.';
    } else if (error.response?.data?.detail) {
      errorMessage = error.response.data.detail;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    store.commit('ui/SET_ERROR', errorMessage);
    
    isImporting.value = false;
    importSuccess.value = false;
  }
};

// Watch for input changes
watch([importText, selectedBot], () => {
  if (importText.value.trim() && selectedBot.value) {
    // Clear file upload when typing
    if (uploadedFileName.value) {
      uploadedFileName.value = '';
      if (fileInput.value) {
        fileInput.value.value = '';
      }
    }
    
    const result = parseConversation(importText.value);
    formatDetection.value = result;
    parsedMessages.value = result.messages;
    
    const validation = ImportService.validateMessages(result.messages);
    importErrors.value = validation.errors;
  } else {
    parsedMessages.value = [];
    importErrors.value = [];
    formatDetection.value = { format: 'unknown', confidence: 0, hint: '' };
  }
});

// Watch for input method changes
watch(inputMethod, () => {
  // Clear data when switching input methods
  importText.value = '';
  uploadedFileName.value = '';
  parsedMessages.value = [];
  importErrors.value = [];
  formatDetection.value = { format: 'unknown', confidence: 0, hint: '' };
  if (fileInput.value) {
    fileInput.value.value = '';
  }
});

// Load bots on mount
onMounted(async () => {
  try {
    await store.dispatch('bots/fetchBots');
  } catch (error) {
    console.error('Failed to load bots:', error);
  }
});

// Connect recipients to store
watch(() => store.getters['navigation/replyRecipients'], (newRecipients) => {
  recipients.value = newRecipients;
}, { immediate: true });
</script>

<style scoped>
.import-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: relative;
  overflow-y: auto;
}

.import-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-sm);
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-surface);
  z-index: 5;
  position: sticky;
  top: 0;
}

.back-button {
  padding: var(--space-xs) var(--space-sm);
  background-color: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text);
  transition: background-color var(--transition-fast);
}

.back-button:hover {
  background-color: var(--color-hover-overlay);
}

.import-title {
  margin: 0;
  color: var(--color-primary);
  font-size: var(--font-size-lg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.service-selector-container {
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-surface-light);
}

.service-selector-label {
  display: block;
  margin-bottom: var(--space-xs);
  font-weight: 600;
  color: var(--color-text);
  font-size: var(--font-size-md);
}

.service-dropdown {
  width: 100%;
  max-width: 300px;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: border-color var(--transition-fast);
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
  background-position: right var(--space-sm) center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-right: calc(var(--space-xl) + var(--space-sm));
}

.service-dropdown:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
}

.service-dropdown:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: var(--color-border-light);
}

.import-content {
  flex: 1;
  padding: var(--space-lg);
  min-height: 0;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.import-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.import-panel h3 {
  color: var(--color-primary);
  margin: 0 0 var(--space-sm) 0;
  font-size: var(--font-size-xl);
  text-align: center;
}

.under-development {
  color: var(--color-text-secondary);
  font-style: italic;
  font-size: var(--font-size-md);
  text-align: center;
  padding: var(--space-xl);
}

.import-instructions {
  margin-bottom: var(--space-md);
  text-align: left;
}

.import-instructions ol {
  margin: var(--space-sm) 0;
  padding-left: var(--space-lg);
}

.import-instructions li {
  margin: var(--space-xs) 0;
  color: var(--color-text);
}

.import-warning {
  font-size: var(--font-size-sm);
  color: var(--color-warning);
  font-weight: 500;
  margin-top: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  background-color: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: var(--radius-xs);
  text-align: center;
}

.import-content-container {
  margin-bottom: var(--space-md);
}

.import-textarea {
  width: 100%;
  height: 250px;
  padding: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: monospace;
  font-size: var(--font-size-md);
  resize: vertical;
  background-color: var(--color-surface);
  color: var(--color-text);
  transition: border-color var(--transition-fast);
}

.import-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
}

.import-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.import-or-divider {
  display: flex;
  align-items: center;
  margin: var(--space-md) 0;
  text-align: center;
}

.import-or-divider::before,
.import-or-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.import-or-divider span {
  padding: 0 var(--space-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  background-color: var(--color-surface);
}

.file-upload-container {
  margin-bottom: var(--space-md);
  position: relative;
}

.file-input {
  display: none;
}

.file-upload-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-light);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: var(--font-size-md);
  color: var(--color-text);
  min-height: 60px;
}

.file-upload-label:hover:not(.disabled) {
  border-color: var(--color-primary);
  background-color: rgba(var(--color-primary-rgb), 0.05);
}

.file-upload-label.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.file-icon {
  font-size: var(--font-size-xl);
  opacity: 0.7;
}

.model-selection-container {
  margin-bottom: var(--space-md);
  padding: var(--space-sm);
  background-color: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.model-selection-label {
  display: block;
  margin-bottom: var(--space-xs);
  font-weight: 600;
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.model-selection-dropdown {
  width: 100%;
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: border-color var(--transition-fast);
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
  background-position: right var(--space-sm) center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-right: calc(var(--space-xl) + var(--space-sm));
}

.model-selection-dropdown:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
}

.model-selection-dropdown:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: var(--color-border-light);
}

.import-preview {
  background-color: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-md);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.import-preview h4 {
  margin: 0;
  color: var(--color-primary);
  font-size: var(--font-size-md);
}

.preview-messages {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  max-height: 400px;
  overflow-y: auto;
  padding-right: var(--space-sm);
}

.preview-messages::-webkit-scrollbar {
  width: 8px;
}

.preview-messages::-webkit-scrollbar-track {
  background: var(--color-surface-light);
  border-radius: var(--radius-sm);
}

.preview-messages::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: var(--radius-sm);
}

.preview-messages::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-dark);
}

.preview-message {
  display: flex;
  gap: var(--space-xs);
  font-size: var(--font-size-sm);
  line-height: 1.4;
  padding: var(--space-xs);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
}

.preview-message:nth-child(even) {
  background-color: var(--color-surface-light);
}

.preview-role {
  font-weight: 600;
  color: var(--color-primary);
  min-width: 80px;
  flex-shrink: 0;
  text-align: right;
}

.preview-content {
  color: var(--color-text-secondary);
  word-break: break-word;
  text-align: left;
  flex: 1;
}

.import-errors {
  background-color: rgba(220, 38, 38, 0.1);
  border: 1px solid var(--color-error);
  border-radius: var(--radius-sm);
  padding: var(--space-md);
  margin-bottom: var(--space-md);
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
  20%, 40%, 60%, 80% { transform: translateX(2px); }
}

.error-title {
  margin: 0 0 var(--space-xs) 0;
  color: var(--color-error);
  font-weight: 600;
  font-size: var(--font-size-sm);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.error-title::before {
  content: "⚠️";
  font-size: var(--font-size-lg);
}

.import-errors ul {
  margin: 0;
  padding-left: var(--space-lg);
}

.import-errors li {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  margin: var(--space-xs) 0;
  line-height: 1.4;
}

.import-button {
  padding: var(--space-sm) var(--space-lg);
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-width: 160px;
}

.import-button:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.import-button:disabled {
  background-color: var(--color-border);
  color: var(--color-text-secondary);
  cursor: not-allowed;
  transform: none;
}

.import-button.importing {
  background-color: var(--color-accent);
  cursor: wait;
}

.import-button.disabled {
  background-color: var(--color-border);
  color: var(--color-text-secondary);
}

.import-button-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  align-items: center;
  margin-top: var(--space-md);
  margin-bottom: 50px;
}

.permission-message {
  text-align: center;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  margin: 0;
  padding: var(--space-xs) var(--space-sm);
  background-color: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  max-width: 300px;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--z-index-modal);
  backdrop-filter: blur(3px);
}

.loading-content {
  background-color: var(--color-surface);
  padding: var(--space-xl);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 400px;
  width: 90%;
  text-align: center;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.loading-main-line {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-xs);
  width: 100%;
}

.import-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border);
  border-top: 3px solid var(--color-accent);
  border-radius: 50%;
  animation: import-spin 1.2s linear infinite;
  margin-left: var(--space-sm);
}

.loading-message {
  font-size: var(--font-size-lg);
  font-weight: bold;
  margin: 0;
  color: var(--color-text);
}

.loading-submessage {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.success-animation {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.checkmark {
  width: 80px;
  height: 80px;
}

.checkmark-circle {
  stroke-dasharray: 166;
  stroke-dashoffset: 166;
  stroke-width: 2;
  stroke-miterlimit: 10;
  stroke: #10a37f;
  fill: none;
  animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
}

.checkmark-check {
  transform-origin: 50% 50%;
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  stroke: #10a37f;
  stroke-width: 3;
  animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
}

@keyframes stroke {
  100% {
    stroke-dashoffset: 0;
  }
}

@keyframes import-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.success-message {
  font-size: var(--font-size-xl);
  font-weight: bold;
  color: #10a37f;
  margin: 0;
}

.success-submessage {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.format-detection {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xxs) var(--space-xs);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
}

.format-detection.standalone {
  margin-bottom: var(--space-md);
}

.format-detection.standard,
.format-detection.openai,
.format-detection.anthropic,
.format-detection.chatgpt-web,
.format-detection.explicit-markers {
  background-color: rgba(16, 163, 127, 0.1);
  border: 1px solid rgba(16, 163, 127, 0.3);
  color: #10a37f;
}

.format-detection.partial {
  background-color: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  color: var(--color-warning);
}

.format-detection.unstructured,
.format-detection.unknown {
  background-color: rgba(108, 117, 125, 0.1);
  border: 1px solid rgba(108, 117, 125, 0.3);
  color: var(--color-text-secondary);
}

.format-icon {
  font-size: var(--font-size-lg);
}

.format-hint {
  flex: 1;
}

/* Bot Selection */
.bot-selection-container {
  margin-bottom: var(--space-lg);
  padding: var(--space-md);
  background-color: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.bot-selection-label {
  display: block;
  margin-bottom: var(--space-xs);
  font-weight: 600;
  color: var(--color-text);
  font-size: var(--font-size-md);
}

.bot-selection-dropdown {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: border-color var(--transition-fast);
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
  background-position: right var(--space-sm) center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-right: calc(var(--space-xl) + var(--space-sm));
}

.bot-selection-dropdown:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
}

.bot-selection-dropdown:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: var(--color-border-light);
}

.bot-selection-hint {
  margin-top: var(--space-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-style: italic;
}

/* Input Method Tabs */
.input-method-container {
  margin-bottom: var(--space-lg);
}

.input-method-tabs {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: var(--space-md);
  background-color: var(--color-surface);
}

.input-method-tab {
  flex: 1;
  padding: var(--space-sm) var(--space-md);
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
    font-size: var(--font-size-md);
  font-weight: 500;
  position: relative;
}

.input-method-tab:not(:last-child) {
  border-right: 1px solid var(--color-border);
}

.input-method-tab.active {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  font-weight: 600;
}

.input-method-tab:hover:not(.active) {
  background-color: var(--color-hover-overlay);
  color: var(--color-text);
}

/* Text Input Container */
.text-input-container {
  width: 100%;
}

/* File Upload Container */
.file-upload-container {
  width: 100%;
}

.file-upload-hint {
  margin-top: var(--space-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-align: center;
  font-style: italic;
}

/* Conversation Settings */
.conversation-settings {
  margin-bottom: var(--space-lg);
  padding: var(--space-md);
  background-color: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.conversation-settings h4 {
  margin: 0 0 var(--space-md) 0;
  color: var(--color-primary);
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.setting-group {
  margin-bottom: var(--space-md);
}

.setting-group:last-child {
  margin-bottom: 0;
}

.setting-label {
  display: block;
  margin-bottom: var(--space-xs);
  font-weight: 600;
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.setting-hint {
  margin-top: var(--space-xs);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-style: italic;
}

/* Visibility Toggle */
.visibility-toggle {
  display: flex;
  align-items: center;
}

.visibility-toggle-button {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: transparent;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-weight: 500;
  min-width: 120px;
  justify-content: center;
}

.visibility-toggle-button:hover:not(:disabled) {
  background-color: var(--color-hover-overlay);
  border-color: var(--color-border-hover);
}

.visibility-toggle-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.visibility-toggle-button.public {
  background-color: rgba(16, 163, 127, 0.1);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.visibility-toggle-button.private {
  background-color: rgba(108, 117, 125, 0.1);
  border-color: var(--color-border);
  color: var(--color-text-secondary);
}

.toggle-slider {
  position: relative;
  width: 20px;
  height: 12px;
  background-color: var(--color-border);
  border-radius: 6px;
  transition: all var(--transition-fast);
}

.toggle-slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 8px;
  height: 8px;
  background-color: var(--color-surface);
  border-radius: 50%;
  transition: all var(--transition-fast);
}

.visibility-toggle-button.public .toggle-slider {
  background-color: var(--color-primary);
}

.visibility-toggle-button.public .toggle-slider::before {
  transform: translateX(8px);
}

.toggle-label {
  font-weight: 600;
}

/* Recipients Button */
.recipients-button {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-weight: 500;
}

.recipients-button:hover:not(:disabled) {
  background-color: var(--color-hover-overlay);
  border-color: var(--color-border-hover);
}

.recipients-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}



/* Updated Import Button */
.import-button-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  align-items: center;
  margin-top: var(--space-lg);
  margin-bottom: 50px;
}

.import-button {
  padding: var(--space-md) var(--space-xl);
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
    font-size: var(--font-size-lg);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-width: 200px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.import-button:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.import-button:disabled {
  background-color: var(--color-border);
  color: var(--color-text-secondary);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.import-button.importing {
  background-color: var(--color-accent);
  cursor: wait;
}

.import-button.disabled {
  background-color: var(--color-border);
  color: var(--color-text-secondary);
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .input-method-tabs {
    flex-direction: column;
  }
  
  .input-method-tab:not(:last-child) {
    border-right: none;
    border-bottom: 1px solid var(--color-border);
  }
  
  .bot-selection-dropdown {
    font-size: var(--font-size-sm);
    padding: var(--space-xs) var(--space-sm);
    padding-right: calc(var(--space-lg) + var(--space-sm));
  }
  
  .conversation-settings {
    padding: var(--space-sm);
  }
  
  .import-button {
    width: 100%;
    font-size: var(--font-size-md);
    padding: var(--space-sm) var(--space-lg);
  }
}

@media (max-width: 480px) {
  .bot-selection-container {
    padding: var(--space-sm);
  }
  
  .conversation-settings {
    padding: var(--space-xs);
  }
  
  .setting-group {
    margin-bottom: var(--space-sm);
  }
  
  .recipients-button {
    width: 100%;
    justify-content: center;
    padding: var(--space-sm);
  }
  
  .import-button {
    font-size: var(--font-size-sm);
    padding: var(--space-xs) var(--space-md);
  }
}

/* Dark theme */
@media (prefers-color-scheme: dark) {
  .import-header {
    background-color: #000000;
  }
  
  .service-selector-container {
    background-color: #1a1a1a;
  }
  
  .loading-content {
    background-color: var(--surface-color-dark, #222);
    border: 1px solid var(--border-color-dark, #444);
  }
  
  .loading-message {
    color: var(--text-color-dark, #eee);
  }
  
  .loading-submessage {
    color: var(--text-color-light-dark, #aaa);
  }
  
  .import-spinner {
    border-color: rgba(255, 255, 255, 0.1);
    border-top-color: #10a37f;
  }
  
  .import-textarea {
    background-color: #1a1a1a;
    border-color: #333;
    color: #eee;
  }
  
  .import-textarea:focus {
    border-color: #10a37f;
    box-shadow: 0 0 0 2px rgba(16, 163, 127, 0.2);
  }
  
  .import-preview {
    background-color: #1a1a1a;
    border-color: #333;
  }
  
  .model-selection-container {
    background-color: #1a1a1a;
    border-color: #333;
  }
  
  .import-errors {
    background-color: rgba(220, 38, 38, 0.1);
    border-color: #dc2626;
  }
  
  .import-button:not(:disabled) {
    background-color: #10a37f;
  }
  
  .import-button:hover:not(:disabled) {
    background-color: #0e906e;
  }
  
  .import-button:disabled {
    background-color: #333;
    color: #666;
  }
}
</style>
