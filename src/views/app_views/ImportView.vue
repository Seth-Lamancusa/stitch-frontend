<template>
  <div class="import-view">
    <div class="import-header">
      <button @click="cancelImport()" class="back-button">
        &larr; Cancel
      </button>
      <h2 class="import-title">Import Conversation</h2>
    </div>

    <!-- Service selector dropdown -->
    <div class="service-selector-container">
      <label class="service-selector-label">Import from:</label>
      <select 
        v-model="activeImportTab" 
        class="service-dropdown"
      >
        <option 
          v-for="tab in importTabs" 
          :key="tab.id" 
          :value="tab.id"
        >
          {{ tab.name }}
        </option>
      </select>
    </div>

    <!-- Main content area -->
    <div class="import-content">
      <div v-if="activeImportTab === 'chatgpt'" class="import-panel">
        <h3>Import from ChatGPT</h3>
        
        <textarea 
          v-model="importText"
          class="import-textarea"
          placeholder="To import a ChatGPT conversation:

Copy your entire ChatGPT conversation (ctrl+a)
Paste it in the text area below - no formatting needed
Click &quot;Import Conversation&quot;

Notes: There is currently no easy way to copy full conversations on mobile. Please use a desktop browser to import. Import from screen recording coming soon."
          :disabled="isImporting"
        />
        
        <div v-if="parsedMessages.length > 0 || formatDetection.hint" class="import-content-container">
          <div v-if="parsedMessages.length > 0" class="import-preview">
            <div class="preview-header">
              <h4>Preview ({{ parsedMessages.length }} messages)</h4>
              <div v-if="formatDetection.hint" class="format-detection" :class="formatDetection.format">
                <span class="format-icon">{{ getFormatIcon() }}</span>
                <span class="format-hint">{{ formatDetection.hint }}</span>
              </div>
            </div>
                          <div class="preview-messages">
                <div v-for="(msg, index) in parsedMessages" :key="index" class="preview-message">
                  <span class="preview-role">{{ msg.role === 'user' ? 'You' : 'ChatGPT' }}:</span>
                  <span class="preview-content">{{ truncateContent(msg.content) }}</span>
                </div>
              </div>
          </div>
          
          <div v-else-if="formatDetection.hint" class="format-detection standalone" :class="formatDetection.format">
            <span class="format-icon">{{ getFormatIcon() }}</span>
            <span class="format-hint">{{ formatDetection.hint }}</span>
          </div>
        </div>
        
        <div v-if="importErrors.length > 0" class="import-errors">
          <p class="error-title">Please fix the following issues:</p>
          <ul>
            <li v-for="(error, index) in importErrors" :key="index">{{ error }}</li>
          </ul>
        </div>
        
        <div class="import-button-container">
          <button 
            @click="importChatGPT"
            :disabled="!canImport || isImporting"
            class="import-button"
            :class="{ 'importing': isImporting, 'disabled': !hasImportPermissions }"
          >
            <span v-if="!isImporting">Import Conversation</span>
            <span v-else>Importing...</span>
          </button>
          <p v-if="!hasImportPermissions" class="permission-message">
            {{ importPermissionMessage }}
          </p>
        </div>
      </div>

      <div v-else-if="activeImportTab === 'cursor'" class="import-panel">
        <h3>Import from Cursor</h3>
        
        <div class="import-instructions">
          <p>To import a Cursor conversation:</p>
          <ol>
            <li>Select which AI model was used in your Cursor conversation</li>
            <li>Export your Cursor chat conversation as a markdown file</li>
            <li>Select the markdown file below</li>
            <li>Click "Import Conversation"</li>
          </ol>
          <p class="import-warning">Only markdown (.md) files are supported</p>
        </div>
        
        <div class="model-selection-container">
          <label class="model-selection-label">AI Model Used:</label>
          <select 
            v-model="selectedCursorModel"
            class="model-selection-dropdown"
            :disabled="isImporting"
          >
            <option value="chatgpt">ChatGPT</option>
            <option value="claude">Claude</option>
            <option value="gemini">Gemini</option>
          </select>
        </div>
        
        <textarea 
          v-model="importText"
          class="import-textarea"
          placeholder="To import a Cursor conversation:

Select which AI model was used in your Cursor conversation
Export your Cursor chat conversation as a markdown file or copy text
Select the markdown file below or paste text
Click &quot;Import Conversation&quot;"
          :disabled="isImporting"
        />
        
        <div class="import-or-divider">
          <span>OR</span>
        </div>
        
        <div class="file-upload-container">
          <input 
            type="file" 
            ref="cursorFileInput"
            accept=".md,.markdown"
            @change="handleCursorFileUpload"
            :disabled="isImporting"
            class="file-input"
            id="cursor-file-input"
          />
          <label for="cursor-file-input" class="file-upload-label" :class="{ 'disabled': isImporting }">
            <span v-if="!cursorFileName">Choose Markdown File</span>
            <span v-else>{{ cursorFileName }}</span>
            <span class="file-icon">📁</span>
          </label>
        </div>
        
        <div v-if="parsedMessages.length > 0 || formatDetection.hint" class="import-content-container">
          <div v-if="parsedMessages.length > 0" class="import-preview">
            <div class="preview-header">
              <h4>Preview ({{ parsedMessages.length }} messages)</h4>
              <div v-if="formatDetection.hint" class="format-detection" :class="formatDetection.format">
                <span class="format-icon">{{ getFormatIcon() }}</span>
                <span class="format-hint">{{ formatDetection.hint }}</span>
              </div>
            </div>
                          <div class="preview-messages">
                <div v-for="(msg, index) in parsedMessages" :key="index" class="preview-message">
                  <span class="preview-role">{{ msg.role === 'user' ? 'You' : 'Cursor' }}:</span>
                  <span class="preview-content">{{ truncateContent(msg.content) }}</span>
                </div>
              </div>
          </div>
          
          <div v-else-if="formatDetection.hint" class="format-detection standalone" :class="formatDetection.format">
            <span class="format-icon">{{ getFormatIcon() }}</span>
            <span class="format-hint">{{ formatDetection.hint }}</span>
          </div>
        </div>
        
        <div v-if="importErrors.length > 0" class="import-errors">
          <p class="error-title">Please fix the following issues:</p>
          <ul>
            <li v-for="(error, index) in importErrors" :key="index">{{ error }}</li>
          </ul>
        </div>
        
        <div class="import-button-container">
          <button 
            @click="importCursor"
            :disabled="!canImport || isImporting"
            class="import-button"
            :class="{ 'importing': isImporting, 'disabled': !hasImportPermissions }"
          >
            <span v-if="!isImporting">Import Conversation</span>
            <span v-else>Importing...</span>
          </button>
          <p v-if="!hasImportPermissions" class="permission-message">
            {{ importPermissionMessage }}
          </p>
        </div>
      </div>

      <div v-else-if="activeImportTab === 'claude'" class="import-panel">
        <h3>Import from Claude</h3>
        
        <textarea 
          v-model="importText"
          class="import-textarea"
          placeholder="To import a Claude conversation:

Copy your entire Claude conversation
Paste it in the text area below - no formatting needed
Click &quot;Import Conversation&quot;"
          :disabled="isImporting"
        />
        
        <div v-if="parsedMessages.length > 0 || formatDetection.hint" class="import-content-container">
          <div v-if="parsedMessages.length > 0" class="import-preview">
            <div class="preview-header">
              <h4>Preview ({{ parsedMessages.length }} messages)</h4>
              <div v-if="formatDetection.hint" class="format-detection" :class="formatDetection.format">
                <span class="format-icon">{{ getFormatIcon() }}</span>
                <span class="format-hint">{{ formatDetection.hint }}</span>
              </div>
            </div>
                          <div class="preview-messages">
                <div v-for="(msg, index) in parsedMessages" :key="index" class="preview-message">
                  <span class="preview-role">{{ msg.role === 'user' ? 'You' : 'Claude' }}:</span>
                  <span class="preview-content">{{ truncateContent(msg.content) }}</span>
                </div>
              </div>
          </div>
          
          <div v-else-if="formatDetection.hint" class="format-detection standalone" :class="formatDetection.format">
            <span class="format-icon">{{ getFormatIcon() }}</span>
            <span class="format-hint">{{ formatDetection.hint }}</span>
          </div>
        </div>
        
        <div v-if="importErrors.length > 0" class="import-errors">
          <p class="error-title">Please fix the following issues:</p>
          <ul>
            <li v-for="(error, index) in importErrors" :key="index">{{ error }}</li>
          </ul>
        </div>
        
        <div class="import-button-container">
          <button 
            @click="importClaude"
            :disabled="!canImport || isImporting"
            class="import-button"
            :class="{ 'importing': isImporting, 'disabled': !hasImportPermissions }"
          >
            <span v-if="!isImporting">Import Conversation</span>
            <span v-else>Importing...</span>
          </button>
          <p v-if="!hasImportPermissions" class="permission-message">
            {{ importPermissionMessage }}
          </p>
        </div>
      </div>

      <div v-else-if="activeImportTab === 'gemini'" class="import-panel">
        <h3>Import from Gemini</h3>
        
        <textarea 
          v-model="importText"
          class="import-textarea"
          placeholder="To import a Gemini conversation:

Copy your entire Gemini conversation
Paste it in the text area below - no formatting needed
Click &quot;Import Conversation&quot;"
          :disabled="isImporting"
        />
        
        <div v-if="parsedMessages.length > 0 || formatDetection.hint" class="import-content-container">
          <div v-if="parsedMessages.length > 0" class="import-preview">
            <div class="preview-header">
              <h4>Preview ({{ parsedMessages.length }} messages)</h4>
              <div v-if="formatDetection.hint" class="format-detection" :class="formatDetection.format">
                <span class="format-icon">{{ getFormatIcon() }}</span>
                <span class="format-hint">{{ formatDetection.hint }}</span>
              </div>
            </div>
                          <div class="preview-messages">
                <div v-for="(msg, index) in parsedMessages" :key="index" class="preview-message">
                  <span class="preview-role">{{ msg.role === 'user' ? 'You' : 'Gemini' }}:</span>
                  <span class="preview-content">{{ truncateContent(msg.content) }}</span>
                </div>
              </div>
          </div>
          
          <div v-else-if="formatDetection.hint" class="format-detection standalone" :class="formatDetection.format">
            <span class="format-icon">{{ getFormatIcon() }}</span>
            <span class="format-hint">{{ formatDetection.hint }}</span>
          </div>
        </div>
        
        <div v-if="importErrors.length > 0" class="import-errors">
          <p class="error-title">Please fix the following issues:</p>
          <ul>
            <li v-for="(error, index) in importErrors" :key="index">{{ error }}</li>
          </ul>
        </div>
        
        <div class="import-button-container">
          <button 
            @click="importGemini"
            :disabled="!canImport || isImporting"
            class="import-button"
            :class="{ 'importing': isImporting, 'disabled': !hasImportPermissions }"
          >
            <span v-if="!isImporting">Import Conversation</span>
            <span v-else>Importing...</span>
          </button>
          <p v-if="!hasImportPermissions" class="permission-message">
            {{ importPermissionMessage }}
          </p>
        </div>
      </div>

      <!-- Temporarily disabled - no reliable way to distinguish messages -->
      <!-- <div v-else-if="activeImportTab === 'grok'" class="import-panel">
        <h3>Import from Grok</h3>
        
        <textarea 
          v-model="importText"
          class="import-textarea"
          placeholder="To import a Grok conversation:

Copy your entire Grok conversation
Paste it in the text area below - no formatting needed
Click &quot;Import Conversation&quot;"
          :disabled="isImporting"
        />
        
        <div v-if="parsedMessages.length > 0 || formatDetection.hint" class="import-content-container">
          <div v-if="parsedMessages.length > 0" class="import-preview">
            <div class="preview-header">
              <h4>Preview ({{ parsedMessages.length }} messages)</h4>
              <div v-if="formatDetection.hint" class="format-detection" :class="formatDetection.format">
                <span class="format-icon">{{ getFormatIcon() }}</span>
                <span class="format-hint">{{ formatDetection.hint }}</span>
              </div>
            </div>
            <div class="preview-messages">
              <div v-for="(msg, index) in parsedMessages" :key="index" class="preview-message">
                <span class="preview-role">{{ msg.role === 'user' ? 'You' : 'Grok' }}:</span>
                <span class="preview-content">{{ truncateContent(msg.content) }}</span>
              </div>
            </div>
          </div>
          
          <div v-else-if="formatDetection.hint" class="format-detection standalone" :class="formatDetection.format">
            <span class="format-icon">{{ getFormatIcon() }}</span>
            <span class="format-hint">{{ formatDetection.hint }}</span>
          </div>
        </div>
        
        <div v-if="importErrors.length > 0" class="import-errors">
          <p class="error-title">Please fix the following issues:</p>
          <ul>
            <li v-for="(error, index) in importErrors" :key="index">{{ error }}</li>
          </ul>
        </div>
        
        <div class="import-button-container">
          <button 
            @click="importGrok"
            :disabled="!canImport || isImporting"
            class="import-button"
            :class="{ 'importing': isImporting, 'disabled': !hasImportPermissions }"
          >
            <span v-if="!isImporting">Import Conversation</span>
            <span v-else>Importing...</span>
          </button>
          <p v-if="!hasImportPermissions" class="permission-message">
            {{ importPermissionMessage }}
          </p>
        </div>
      </div> -->

      <div v-else class="import-panel">
        <h3>Import from {{ getActiveTabName() }}</h3>
        <p class="under-development">This feature is under development</p>
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

    <!-- Global Notifications component -->
    <GlobalNotifications />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute } from 'vue-router';
import ImportService from '../../services/ImportService';
import GlobalNotifications from '../../components/GlobalNotifications.vue';
import { useBrowserCapabilities } from '../../composables/useBrowserCapabilities.js';

// Setup store and routing
const store = useStore();
const router = useRouter();
const route = useRoute();

// Browser capabilities detection
const { 
  capabilities, 
  isLowEnd, 
  shouldUseReducedAnimations, 
  getOptimalImageFormat,
  getRecommendedQuality 
} = useBrowserCapabilities();

// Import tabs configuration
const importTabs = [
  { id: 'chatgpt', name: 'ChatGPT' },
  { id: 'claude', name: 'Claude' },
  { id: 'gemini', name: 'Gemini' },
  { id: 'cursor', name: 'Cursor' }
  // { id: 'grok', name: 'Grok' }  // Temporarily disabled - no reliable way to distinguish messages
];

// Refs
const cursorFileInput = ref(null);

// Import-specific refs
const activeImportTab = ref('chatgpt');
const importText = ref('');
const cursorFileName = ref('');
const cursorFileContent = ref('');
const selectedCursorModel = ref('chatgpt');
const isImporting = ref(false);
const parsedMessages = ref([]);
const importErrors = ref([]);
const importSuccess = ref(false);
const loadingMessage = ref('Importing conversation...');
const loadingSubmessage = ref('This will only take a moment');
const formatDetection = ref({ format: 'unknown', confidence: 0, hint: '' });

// Computed properties from store
const user = computed(() => store.getters['auth/user']);
const canInteract = computed(() => {
  if (user.value?.status === 'admin' || user.value?.status === 'whitelisted' || user.value?.status === 'import') {
    return true;
  }
  
  if (store.getters['auth/isAdmin'] || store.getters['auth/isWhitelisted']) {
    return true;
  }
  
  return false;
});

// Computed property for import permissions
const hasImportPermissions = computed(() => {
  // First check if user is logged in
  if (!user.value) {
    return false;
  }
  
  // Check if user has import or admin status
  if (user.value.status === 'import' || user.value.status === 'admin') {
    return true;
  }
  
  return false;
});

// Computed property for import button state
const canImport = computed(() => {
  // First check import permissions
  if (!hasImportPermissions.value) {
    return false;
  }
  
  // Then check content validation
  if (activeImportTab.value === 'cursor') {
    const hasContent = cursorFileContent.value.trim().length > 0 || importText.value.trim().length > 0;
    return hasContent && 
           parsedMessages.value.length > 0 && 
           importErrors.value.length === 0;
  } else {
    return importText.value.trim().length > 0 && 
           parsedMessages.value.length > 0 && 
           importErrors.value.length === 0;
  }
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

// Function to get active tab name
const getActiveTabName = () => {
  const tab = importTabs.find(tab => tab.id === activeImportTab.value);
  return tab ? tab.name : '';
};

// Function to get format icon
const getFormatIcon = () => {
  switch (formatDetection.value.format) {
    case 'standard':
    case 'openai':
    case 'anthropic':
    case 'chatgpt-web':
    case 'explicit-markers':
    case 'cursor':
    case 'cursor-markdown':
    case 'claude':
    case 'gemini':
    case 'grok':
      return '✅';
    case 'partial':
      return '⚠️';
    case 'unstructured':
      return '❓';
    default:
      return '💬';
  }
};

// Methods
const cancelImport = () => {
  // Navigate back to the previous route or home
  router.back();
};

const truncateContent = (content) => {
  const maxLength = 100;
  const endChars = 50;
  
  if (content.length <= maxLength) return content;
  
  const start = content.substring(0, maxLength);
  const end = content.substring(content.length - endChars);
  return `${start}... ${end}`;
};

// Watch for tab changes to clear inputs
watch(activeImportTab, () => {
  importText.value = '';
  cursorFileName.value = '';
  cursorFileContent.value = '';
  parsedMessages.value = [];
  importErrors.value = [];
  formatDetection.value = { format: 'unknown', confidence: 0, hint: '' };
  if (cursorFileInput.value) {
    cursorFileInput.value.value = '';
  }
});

// Watch for changes in import text
watch(importText, (newText) => {
  if (!['chatgpt', 'claude', 'gemini', 'grok', 'cursor'].includes(activeImportTab.value)) {
    return;
  }
  
  if (newText.trim()) {
    if (activeImportTab.value === 'cursor') {
      cursorFileName.value = '';
      cursorFileContent.value = '';
      if (cursorFileInput.value) {
        cursorFileInput.value.value = '';
      }
    }
    
    formatDetection.value = ImportService.detectConversationFormat(newText, activeImportTab.value);
    
    if (activeImportTab.value === 'chatgpt') {
      parsedMessages.value = ImportService.parseChatGPTConversation(newText);
    } else if (activeImportTab.value === 'claude') {
      parsedMessages.value = ImportService.parseClaudeConversation(newText);
    } else if (activeImportTab.value === 'gemini') {
      parsedMessages.value = ImportService.parseGeminiConversation(newText);
    } else if (activeImportTab.value === 'grok') {
      parsedMessages.value = ImportService.parseGrokConversation(newText);
    } else if (activeImportTab.value === 'cursor') {
      parsedMessages.value = ImportService.parseCursorConversation(newText);
    }
    
    const validation = ImportService.validateMessages(parsedMessages.value);
    importErrors.value = validation.errors;
  } else {
    parsedMessages.value = [];
    importErrors.value = [];
    formatDetection.value = { format: 'unknown', confidence: 0, hint: '' };
  }
});

// Add these methods to the script section
const handleCursorFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) {
    cursorFileName.value = '';
    cursorFileContent.value = '';
    parsedMessages.value = [];
    importErrors.value = [];
    formatDetection.value = { format: 'unknown', confidence: 0, hint: '' };
    return;
  }
  
  importText.value = '';
  
  if (!file.name.toLowerCase().endsWith('.md') && !file.name.toLowerCase().endsWith('.markdown')) {
    importErrors.value = ['Please select a markdown (.md) file'];
    cursorFileName.value = '';
    cursorFileContent.value = '';
    parsedMessages.value = [];
    formatDetection.value = { format: 'unknown', confidence: 0, hint: 'Invalid file type' };
    return;
  }
  
  if (file.size > 10 * 1024 * 1024) {
    importErrors.value = ['File is too large (max 10MB)'];
    cursorFileName.value = '';
    cursorFileContent.value = '';
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
    
    cursorFileName.value = file.name;
    cursorFileContent.value = content;
    
    if (content.trim()) {
      formatDetection.value = ImportService.detectConversationFormat(content, activeImportTab.value);
      parsedMessages.value = ImportService.parseCursorConversation(content);
      const validation = ImportService.validateMessages(parsedMessages.value);
      importErrors.value = validation.errors;
    } else {
      parsedMessages.value = [];
      importErrors.value = ['File is empty'];
      formatDetection.value = { format: 'unknown', confidence: 0, hint: 'Empty file' };
    }
  } catch (error) {
    console.error('Error reading file:', error);
    importErrors.value = ['Failed to read file'];
    cursorFileName.value = '';
    cursorFileContent.value = '';
    parsedMessages.value = [];
    formatDetection.value = { format: 'unknown', confidence: 0, hint: 'Read error' };
  }
};

const importChatGPT = async () => {
  if (!canImport.value || isImporting.value) return;
  
  try {
    isImporting.value = true;
    importSuccess.value = false;
    
    const messageCount = parsedMessages.value.length;
    loadingMessage.value = `Importing ${messageCount} messages...`;
    
    if (capabilities.isLowBandwidth) {
      loadingSubmessage.value = 'Processing conversation (this may take longer on slow connections)';
    } else if (isLowEnd()) {
      loadingSubmessage.value = 'Processing your ChatGPT conversation (optimizing for your device)';
    } else if (messageCount > 50) {
      loadingSubmessage.value = 'Processing large conversation - this may take a moment';
    } else {
      loadingSubmessage.value = 'Processing your ChatGPT conversation';
    }
    
    const result = await ImportService.importChatGPTConversation(
      parsedMessages.value,
      null
    );
    
    if (result.success && result.thread_id) {
      importSuccess.value = true;
      loadingMessage.value = 'Import Successful!';
      loadingSubmessage.value = 'Redirecting to your imported conversation...';
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      router.push({ path: `/${result.thread_id}` });
      store.commit('ui/SET_SUCCESS', `Successfully imported ${result.message_count} messages`);
    } else {
      throw new Error('Import returned unexpected result');
    }
  } catch (error) {
    console.error('Import failed:', error);
    
    let errorMessage = 'Failed to import conversation';
    
    if (error.response?.status === 429) {
      errorMessage = error.response.data?.detail || 'You have exceeded the import rate limit. Please try again later.';
    } else if (error.response?.status === 403) {
      errorMessage = 'You do not have permission to import conversations. Only whitelisted users, admins, and import users can import.';
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

// Add these import methods to the script section
const importCursor = async () => {
  if (!canImport.value || isImporting.value) return;
  
  try {
    isImporting.value = true;
    importSuccess.value = false;
    
    loadingMessage.value = `Importing ${parsedMessages.value.length} messages...`;
    loadingSubmessage.value = 'Processing your Cursor conversation';
    
    const result = await ImportService.importCursorConversation(
      parsedMessages.value,
      null,
      selectedCursorModel.value
    );
    
    if (result.success && result.thread_id) {
      importSuccess.value = true;
      loadingMessage.value = 'Import Successful!';
      loadingSubmessage.value = 'Redirecting to your imported conversation...';
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      router.push({ path: `/${result.thread_id}` });
      store.commit('ui/SET_SUCCESS', `Successfully imported ${result.message_count} messages`);
    } else {
      throw new Error('Import returned unexpected result');
    }
  } catch (error) {
    console.error('Import failed:', error);
    handleImportError(error);
  }
};

const importClaude = async () => {
  if (!canImport.value || isImporting.value) return;
  
  try {
    isImporting.value = true;
    importSuccess.value = false;
    
    loadingMessage.value = `Importing ${parsedMessages.value.length} messages...`;
    loadingSubmessage.value = 'Processing your Claude conversation';
    
    const result = await ImportService.importClaudeConversation(
      parsedMessages.value,
      null
    );
    
    if (result.success && result.thread_id) {
      importSuccess.value = true;
      loadingMessage.value = 'Import Successful!';
      loadingSubmessage.value = 'Redirecting to your imported conversation...';
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      router.push({ path: `/${result.thread_id}` });
      store.commit('ui/SET_SUCCESS', `Successfully imported ${result.message_count} messages`);
    } else {
      throw new Error('Import returned unexpected result');
    }
  } catch (error) {
    console.error('Import failed:', error);
    handleImportError(error);
  }
};

const importGemini = async () => {
  if (!canImport.value || isImporting.value) return;
  
  try {
    isImporting.value = true;
    importSuccess.value = false;
    
    loadingMessage.value = `Importing ${parsedMessages.value.length} messages...`;
    loadingSubmessage.value = 'Processing your Gemini conversation';
    
    const result = await ImportService.importGeminiConversation(
      parsedMessages.value,
      null
    );
    
    if (result.success && result.thread_id) {
      importSuccess.value = true;
      loadingMessage.value = 'Import Successful!';
      loadingSubmessage.value = 'Redirecting to your imported conversation...';
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      router.push({ path: `/${result.thread_id}` });
      store.commit('ui/SET_SUCCESS', `Successfully imported ${result.message_count} messages`);
    } else {
      throw new Error('Import returned unexpected result');
    }
  } catch (error) {
    console.error('Import failed:', error);
    handleImportError(error);
  }
};

// Helper function to handle import errors
const handleImportError = (error) => {
  let errorMessage = 'Failed to import conversation';
  
  if (error.response?.status === 429) {
    errorMessage = error.response.data?.detail || 'You have exceeded the import rate limit. Please try again later.';
  } else if (error.response?.status === 403) {
    errorMessage = 'You do not have permission to import conversations. Only whitelisted users, admins, and import users can import.';
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
};
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
  max-height: 300px;
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

/* Responsive styles */
@media (max-width: 768px) {
  .import-content {
    padding: var(--space-md);
    max-width: 100%;
  }
  
  .service-selector-container {
    padding: var(--space-md);
  }
  
  .service-dropdown {
    max-width: 100%;
  }
  
  .import-textarea {
    min-height: 150px;
    max-height: 250px;
  }
  
  .import-button {
    width: 100%;
    margin-top: var(--space-md);
  }
  
  .preview-header {
    flex-direction: column;
    align-items: flex-start;
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
