<template>
  <div class="thread-view">
    <!-- Thread header with navigation back and title -->
    <div class="thread-header">
      <button @click="cancelThread()" class="back-button">
        &larr; Cancel
      </button>
      <h2 class="thread-title">New Thread</h2>
    </div>
    
    <!-- Empty messages container with just a hint -->
    <div class="messages-container" ref="messageList">
      
      <!-- New tabbed import interface
      <div class="import-tabs-container">
        <div class="import-tabs-sidebar">
          <button 
            v-for="tab in importTabs" 
            :key="tab.id"
            @click="activeImportTab = tab.id"
            :class="['import-tab-button', { active: activeImportTab === tab.id }]"
          >
            {{ tab.name }}
          </button>
        </div>
        
        <div class="import-content">
          <div v-if="activeImportTab === 'chatgpt'" class="import-panel">
            <h3>Import from ChatGPT</h3>
            
            <div class="import-instructions">
              <p>To import a ChatGPT conversation:</p>
              <ol>
                <li>Copy your entire ChatGPT conversation (from web interface or mobile app)</li>
                <li>Paste it in the text area below - no formatting needed</li>
                <li>Click "Import Conversation"</li>
              </ol>
              <p class="import-warning">Paste the raw conversation without modifications</p>
            </div>
            
            <textarea 
              v-model="importText"
              class="import-textarea"
              placeholder="Paste your ChatGPT conversation here..."
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
                  <div v-for="(msg, index) in parsedMessages.slice(0, 3)" :key="index" class="preview-message">
                    <span class="preview-role">{{ msg.role === 'user' ? 'You' : 'ChatGPT' }}:</span>
                    <span class="preview-content">{{ truncateContent(msg.content) }}</span>
                  </div>
                  <div v-if="parsedMessages.length > 3" class="preview-more">
                    ... and {{ parsedMessages.length - 3 }} more messages
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
            
            <button 
              @click="importChatGPT"
              :disabled="!canImport || isImporting"
              class="import-button"
              :class="{ 'importing': isImporting }"
            >
              <span v-if="!isImporting">Import Conversation</span>
              <span v-else>Importing...</span>
            </button>
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
            
            Model Selection
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
            
            Content and preview container
            <div v-if="parsedMessages.length > 0 || formatDetection.hint" class="import-content-container">
              Preview section
              <div v-if="parsedMessages.length > 0" class="import-preview">
                <div class="preview-header">
                  <h4>Preview ({{ parsedMessages.length }} messages)</h4>
                  Format detection hint positioned next to preview title
                  <div v-if="formatDetection.hint" class="format-detection" :class="formatDetection.format">
                    <span class="format-icon">{{ getFormatIcon() }}</span>
                    <span class="format-hint">{{ formatDetection.hint }}</span>
                  </div>
                </div>
                <div class="preview-messages">
                  <div v-for="(msg, index) in parsedMessages.slice(0, 3)" :key="index" class="preview-message">
                    <span class="preview-role">{{ msg.role === 'user' ? 'You' : 'Cursor' }}:</span>
                    <span class="preview-content">{{ truncateContent(msg.content) }}</span>
                  </div>
                  <div v-if="parsedMessages.length > 3" class="preview-more">
                    ... and {{ parsedMessages.length - 3 }} more messages
                  </div>
                </div>
              </div>
              
              Format detection when no preview (standalone)
              <div v-else-if="formatDetection.hint" class="format-detection standalone" :class="formatDetection.format">
                <span class="format-icon">{{ getFormatIcon() }}</span>
                <span class="format-hint">{{ formatDetection.hint }}</span>
              </div>
            </div>
            
            Validation errors
            <div v-if="importErrors.length > 0" class="import-errors">
              <p class="error-title">Please fix the following issues:</p>
              <ul>
                <li v-for="(error, index) in importErrors" :key="index">{{ error }}</li>
              </ul>
            </div>
            
            <button 
              @click="importCursor"
              :disabled="!canImport || isImporting"
              class="import-button"
              :class="{ 'importing': isImporting }"
            >
              <span v-if="!isImporting">Import Conversation</span>
              <span v-else>Importing...</span>
            </button>
          </div>
          <div v-else-if="activeImportTab === 'claude'" class="import-panel">
            <h3>Import from Claude</h3>
            
            <div class="import-instructions">
              <p>To import a Claude conversation:</p>
              <ol>
                <li>Copy your entire Claude conversation (from web interface or mobile app)</li>
                <li>Paste it in the text area below - no formatting needed</li>
                <li>Click "Import Conversation"</li>
              </ol>
              <p class="import-warning">Paste the raw conversation without modifications</p>
            </div>
            
            <textarea 
              v-model="importText"
              class="import-textarea"
              placeholder="Paste your Claude conversation here..."
              :disabled="isImporting"
            />
            
            Content and preview container
            <div v-if="parsedMessages.length > 0 || formatDetection.hint" class="import-content-container">
              Preview section
              <div v-if="parsedMessages.length > 0" class="import-preview">
                <div class="preview-header">
                  <h4>Preview ({{ parsedMessages.length }} messages)</h4>
                  Format detection hint positioned next to preview title
                  <div v-if="formatDetection.hint" class="format-detection" :class="formatDetection.format">
                    <span class="format-icon">{{ getFormatIcon() }}</span>
                    <span class="format-hint">{{ formatDetection.hint }}</span>
                  </div>
                </div>
                <div class="preview-messages">
                  <div v-for="(msg, index) in parsedMessages.slice(0, 3)" :key="index" class="preview-message">
                    <span class="preview-role">{{ msg.role === 'user' ? 'You' : 'Claude' }}:</span>
                    <span class="preview-content">{{ truncateContent(msg.content) }}</span>
                  </div>
                  <div v-if="parsedMessages.length > 3" class="preview-more">
                    ... and {{ parsedMessages.length - 3 }} more messages
                  </div>
                </div>
              </div>
              
              Format detection when no preview (standalone)
              <div v-else-if="formatDetection.hint" class="format-detection standalone" :class="formatDetection.format">
                <span class="format-icon">{{ getFormatIcon() }}</span>
                <span class="format-hint">{{ formatDetection.hint }}</span>
              </div>
            </div>
            
            Validation errors
            <div v-if="importErrors.length > 0" class="import-errors">
              <p class="error-title">Please fix the following issues:</p>
              <ul>
                <li v-for="(error, index) in importErrors" :key="index">{{ error }}</li>
              </ul>
            </div>
            
            <button 
              @click="importClaude"
              :disabled="!canImport || isImporting"
              class="import-button"
              :class="{ 'importing': isImporting }"
            >
              <span v-if="!isImporting">Import Conversation</span>
              <span v-else>Importing...</span>
            </button>
          </div>
          <div v-else-if="activeImportTab === 'gemini'" class="import-panel">
            <h3>Import from Gemini</h3>
            
                         <div class="import-instructions">
               <p>To import a Gemini conversation:</p>
               <ol>
                 <li>Copy your entire Gemini conversation (from web interface or mobile app)</li>
                 <li>Paste it in the text area below - no formatting needed</li>
                 <li>Click "Import Conversation"</li>
               </ol>
               <p class="import-warning">Paste the raw conversation without modifications</p>
             </div>
            
            <textarea 
              v-model="importText"
              class="import-textarea"
              placeholder="Paste your Gemini conversation here..."
              :disabled="isImporting"
            />
            
            Content and preview container
            <div v-if="parsedMessages.length > 0 || formatDetection.hint" class="import-content-container">
              Preview section
              <div v-if="parsedMessages.length > 0" class="import-preview">
                <div class="preview-header">
                  <h4>Preview ({{ parsedMessages.length }} messages)</h4>
                  Format
                  <div v-if="formatDetection.hint" class="format-detection" :class="formatDetection.format">
                    <span class="format-icon">{{ getFormatIcon() }}</span>
                    <span class="format-hint">{{ formatDetection.hint }}</span>
                  </div>
                </div>
                <div class="preview-messages">
                  <div v-for="(msg, index) in parsedMessages.slice(0, 3)" :key="index" class="preview-message">
                    <span class="preview-role">{{ msg.role === 'user' ? 'You' : 'Gemini' }}:</span>
                    <span class="preview-content">{{ truncateContent(msg.content) }}</span>
                  </div>
                  <div v-if="parsedMessages.length > 3" class="preview-more">
                    ... and {{ parsedMessages.length - 3 }} more messages
                  </div>
                </div>
              </div>
              
              Format detection when no preview (standalone)
              <div v-else-if="formatDetection.hint" class="format-detection standalone" :class="formatDetection.format">
                <span class="format-icon">{{ getFormatIcon() }}</span>
                <span class="format-hint">{{ formatDetection.hint }}</span>
              </div>
            </div>
            
            Validation errors
            <div v-if="importErrors.length > 0" class="import-errors">
              <p class="error-title">Please fix the following issues:</p>
              <ul>
                <li v-for="(error, index) in importErrors" :key="index">{{ error }}</li>
              </ul>
            </div>
            
            <button 
              @click="importGemini"
              :disabled="!canImport || isImporting"
              class="import-button"
              :class="{ 'importing': isImporting }"
            >
              <span v-if="!isImporting">Import Conversation</span>
              <span v-else>Importing...</span>
            </button>
          </div>
          <div v-else-if="activeImportTab === 'grok'" class="import-panel">
            <h3>Import from Grok</h3>
            
            <div class="import-instructions">
              <p>To import a Grok conversation:</p>
              <ol>
                <li>Copy your entire Grok conversation (from web interface or mobile app)</li>
                <li>Paste it in the text area below - no formatting needed</li>
                <li>Click "Import Conversation"</li>
              </ol>
              <p class="import-warning">Paste the raw conversation without modifications</p>
            </div>
            
            <textarea 
              v-model="importText"
              class="import-textarea"
              placeholder="Paste your Grok conversation here..."
              :disabled="isImporting"
            />
            
            Content and preview container
            <div v-if="parsedMessages.length > 0 || formatDetection.hint" class="import-content-container">
              Preview section
              <div v-if="parsedMessages.length > 0" class="import-preview">
                <div class="preview-header">
                  <h4>Preview ({{ parsedMessages.length }} messages)</h4>
                  Format detection hint positioned next to preview title
                  <div v-if="formatDetection.hint" class="format-detection" :class="formatDetection.format">
                    <span class="format-icon">{{ getFormatIcon() }}</span>
                    <span class="format-hint">{{ formatDetection.hint }}</span>
                  </div>
                </div>
                <div class="preview-messages">
                  <div v-for="(msg, index) in parsedMessages.slice(0, 3)" :key="index" class="preview-message">
                    <span class="preview-role">{{ msg.role === 'user' ? 'You' : 'Grok' }}:</span>
                    <span class="preview-content">{{ truncateContent(msg.content) }}</span>
                  </div>
                  <div v-if="parsedMessages.length > 3" class="preview-more">
                    ... and {{ parsedMessages.length - 3 }} more messages
                  </div>
                </div>
              </div>
              
              Format detection when no preview (standalone)
              <div v-else-if="formatDetection.hint" class="format-detection standalone" :class="formatDetection.format">
                <span class="format-icon">{{ getFormatIcon() }}</span>
                <span class="format-hint">{{ formatDetection.hint }}</span>
              </div>
            </div>
            
            Validation errors
            <div v-if="importErrors.length > 0" class="import-errors">
              <p class="error-title">Please fix the following issues:</p>
              <ul>
                <li v-for="(error, index) in importErrors" :key="index">{{ error }}</li>
              </ul>
            </div>
            
            <button 
              @click="importGrok"
              :disabled="!canImport || isImporting"
              class="import-button"
              :class="{ 'importing': isImporting }"
            >
              <span v-if="!isImporting">Import Conversation</span>
              <span v-else>Importing...</span>
            </button>
          </div>
          <div v-else class="import-panel">
            <h3>Import from {{ getActiveTabName() }}</h3>
            <p class="under-development">This feature is under development</p>
          </div>
        </div>
      </div> -->
    </div>
    
    <!-- Reply box component -->
    <reply-box
      :is-temporary-thread="true"
      :can-interact="canInteract"
      ref="replyBox"
      @send-success="handleSendSuccess"
      @send-error="handleSendError"
    />

    <!-- Loading Overlay (for both sending and importing) -->
    <div v-if="isCreatingThread" class="loading-overlay">
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
import ReplyBox from '../../components/ReplyBox.vue';
import ImportService from '../../services/ImportService';
import GlobalNotifications from '../../components/GlobalNotifications.vue';

// Setup store and routing
const store = useStore();
const router = useRouter();
const route = useRoute();

// Refs
const messageList = ref(null);
const replyBox = ref(null);
const cursorFileInput = ref(null);

// Import tabs configuration
const importTabs = [
  { id: 'chatgpt', name: 'ChatGPT' },
  { id: 'cursor', name: 'Cursor' },
  { id: 'x', name: 'X' },
  { id: 'reddit', name: 'Reddit' },
  { id: 'claude', name: 'Claude' },
  { id: 'gemini', name: 'Gemini' },
  { id: 'grok', name: 'Grok' }
];
const activeImportTab = ref('chatgpt');

// Import-specific refs
const importText = ref('');
const cursorFileName = ref('');
const cursorFileContent = ref('');
const selectedCursorModel = ref('chatgpt');
const isImporting = ref(false);
const parsedMessages = ref([]);
const importErrors = ref([]);
const importSuccess = ref(false);
const loadingMessage = ref('Creating new thread...');
const loadingSubmessage = ref('This will only take a moment');
const formatDetection = ref({ format: 'unknown', confidence: 0, hint: '' });

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

// Computed properties from store
const user = computed(() => store.getters['auth/user']);
const canInteract = computed(() => {
  console.log("NewThreadView - checking canInteract:", 
    user.value?.status, 
    store.getters['auth/isAdmin'], 
    store.getters['auth/isWhitelisted'],
    store.getters['auth/canInteract']
  );
  
  // First priority: direct user status check
  if (user.value?.status === 'admin' || user.value?.status === 'whitelisted') {
    return true;
  }
  
  // Fallback to the store properties if status isn't available directly
  // This handles timing issues where status might not be populated yet
  if (store.getters['auth/isAdmin'] || store.getters['auth/isWhitelisted']) {
    return true;
  }
  
  return false;
});

// Add computed property for current reply visibility
const isPublic = computed(() => store.getters['navigation/replyIsPublic']);

// Add computed property for previous route
const previousRoute = computed(() => store.getters['navigation/previousRoute']);

// Update the refs
const isCreatingThread = ref(false);

// Computed property for import button state
const canImport = computed(() => {
  if (activeImportTab.value === 'cursor') {
    // For Cursor: need file content, parsed messages, and no errors
    return cursorFileContent.value.trim().length > 0 && 
           parsedMessages.value.length > 0 && 
           importErrors.value.length === 0;
  } else {
    // For ChatGPT, Claude, Gemini, Grok and others: need text input, parsed messages, and no errors
    return importText.value.trim().length > 0 && 
           parsedMessages.value.length > 0 && 
           importErrors.value.length === 0;
  }
});

// Watch for changes in import text (ChatGPT, Claude, Gemini, and Grok)
watch(importText, (newText) => {
  // Only process if we're on a text-based import tab
  if (!['chatgpt', 'claude', 'gemini', 'grok'].includes(activeImportTab.value)) {
    return;
  }
  
  if (newText.trim()) {
    // Detect format
    formatDetection.value = ImportService.detectConversationFormat(newText);
    
    // Parse the conversation based on the active tab
    if (activeImportTab.value === 'chatgpt') {
      parsedMessages.value = ImportService.parseChatGPTConversation(newText);
    } else if (activeImportTab.value === 'claude') {
      parsedMessages.value = ImportService.parseClaudeConversation(newText);
    } else if (activeImportTab.value === 'gemini') {
      parsedMessages.value = ImportService.parseGeminiConversation(newText);
    } else if (activeImportTab.value === 'grok') {
      parsedMessages.value = ImportService.parseGrokConversation(newText);
    }
    
    // Validate the parsed messages
    const validation = ImportService.validateMessages(parsedMessages.value);
    importErrors.value = validation.errors;
  } else {
    parsedMessages.value = [];
    importErrors.value = [];
    formatDetection.value = { format: 'unknown', confidence: 0, hint: '' };
  }
});

// Lifecycle hooks
onMounted(async () => {
  // Reset visibility settings for new threads
  console.log(`[NewThreadView] Resetting visibility settings for new thread`);
  
  // Set default visibility to public and clear recipients in one call
  store.dispatch('navigation/setVisibilitySettings', {
    isPublic: true,
    recipients: []
  });
  
  // Focus the reply box textarea on mount
  nextTick(() => {
    if (replyBox.value) {
      replyBox.value.focus();
    }
  });
});

onBeforeUnmount(() => {
  // No modal event listeners to clean up anymore
});

// Methods
const cancelThread = () => {
  // Get reply content
  const content = replyBox.value?.content?.trim();
  
  if (content) {
    if (!confirm("Discard this thread? Any unsent message will be lost.")) {
      return;
    }
  }
  
  // Navigate back to the previous route
  router.push(previousRoute.value);
};

const handleSendSuccess = async (newMessage) => {
  try {
    // Set loading state to show overlay
    isCreatingThread.value = true;
    loadingMessage.value = 'Creating new thread...';
    loadingSubmessage.value = 'This will only take a moment';
    
    // Redirect to the new thread
    router.replace({ path: `/${newMessage.id}` });
  } catch (error) {
    console.error('Error handling message success:', error);
    store.commit('ui/SET_ERROR', 'Failed to complete thread creation.');
  } finally {
    // This may not execute if navigation happens first
    isCreatingThread.value = false;
  }
};

const handleSendError = (error) => {
  console.error('Error sending message:', error);
  store.commit('ui/SET_ERROR', 'Failed to create thread. Please try again.');
};

// Import methods
const truncateContent = (content) => {
  const maxLength = 100;
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '...';
};

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
  
  // Check file type
  if (!file.name.toLowerCase().endsWith('.md') && !file.name.toLowerCase().endsWith('.markdown')) {
    importErrors.value = ['Please select a markdown (.md) file'];
    cursorFileName.value = '';
    cursorFileContent.value = '';
    parsedMessages.value = [];
    formatDetection.value = { format: 'unknown', confidence: 0, hint: 'Invalid file type' };
    return;
  }
  
  // Check file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    importErrors.value = ['File is too large (max 10MB)'];
    cursorFileName.value = '';
    cursorFileContent.value = '';
    parsedMessages.value = [];
    formatDetection.value = { format: 'unknown', confidence: 0, hint: 'File too large' };
    return;
  }
  
  try {
    // Read file content
    const content = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
    
    // Store file info
    cursorFileName.value = file.name;
    cursorFileContent.value = content;
    
    // Process the markdown content
    if (content.trim()) {
      // Detect format
      formatDetection.value = ImportService.detectConversationFormat(content);
      
      // Parse the conversation
      parsedMessages.value = ImportService.parseCursorConversation(content);
      
      // Validate the parsed messages
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
    isCreatingThread.value = true;
    importSuccess.value = false;
    
    // Update loading messages for import
    loadingMessage.value = `Importing ${parsedMessages.value.length} messages...`;
    loadingSubmessage.value = 'Processing your ChatGPT conversation';
    
    // Import the conversation
    const result = await ImportService.importChatGPTConversation(
      parsedMessages.value,
      null
    );
    
    if (result.success && result.thread_id) {
      // Show success animation
      importSuccess.value = true;
      loadingMessage.value = 'Import Successful!';
      loadingSubmessage.value = 'Redirecting to your imported conversation...';
      
      // Wait a moment to show the success animation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Navigate to the imported thread
      router.replace({ path: `/${result.thread_id}` });
      
      // Show success message
      store.commit('ui/SET_SUCCESS', `Successfully imported ${result.message_count} messages`);
    } else {
      throw new Error('Import returned unexpected result');
    }
  } catch (error) {
    console.error('Import failed:', error);
    
    // Show detailed error message based on error type
    let errorMessage = 'Failed to import conversation';
    
    if (error.response?.status === 429) {
      // Rate limit error
      errorMessage = error.response.data?.detail || 'You have exceeded the import rate limit. Please try again later.';
    } else if (error.response?.status === 403) {
      // Permission error
      errorMessage = 'You do not have permission to import conversations. Only whitelisted users and admins can import.';
    } else if (error.response?.status === 400) {
      // Validation error
      errorMessage = error.response.data?.detail || 'Invalid conversation format.';
    } else if (error.response?.data?.detail) {
      // Other API errors
      errorMessage = error.response.data.detail;
    } else if (error.message) {
      // JS errors
      errorMessage = error.message;
    }
    
    store.commit('ui/SET_ERROR', errorMessage);
    
    isImporting.value = false;
    isCreatingThread.value = false;
    importSuccess.value = false;
  }
};

const importCursor = async () => {
  if (!canImport.value || isImporting.value) return;
  
  try {
    isImporting.value = true;
    isCreatingThread.value = true;
    importSuccess.value = false;
    
    // Update loading messages for import
    loadingMessage.value = `Importing ${parsedMessages.value.length} messages...`;
    loadingSubmessage.value = 'Processing your Cursor conversation';
    
    // Import the conversation with the selected model
    const result = await ImportService.importCursorConversation(
      parsedMessages.value,
      null,
      selectedCursorModel.value // Pass the selected model
    );
    
    if (result.success && result.thread_id) {
      // Show success animation
      importSuccess.value = true;
      loadingMessage.value = 'Import Successful!';
      loadingSubmessage.value = 'Redirecting to your imported conversation...';
      
      // Wait a moment to show the success animation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Navigate to the imported thread
      router.replace({ path: `/${result.thread_id}` });
      
      // Show success message
      store.commit('ui/SET_SUCCESS', `Successfully imported ${result.message_count} messages`);
    } else {
      throw new Error('Import returned unexpected result');
    }
  } catch (error) {
    console.error('Import failed:', error);
    
    // Show detailed error message based on error type
    let errorMessage = 'Failed to import conversation';
    
    if (error.response?.status === 429) {
      // Rate limit error
      errorMessage = error.response.data?.detail || 'You have exceeded the import rate limit. Please try again later.';
    } else if (error.response?.status === 403) {
      // Permission error
      errorMessage = 'You do not have permission to import conversations. Only whitelisted users and admins can import.';
    } else if (error.response?.status === 400) {
      // Validation error
      errorMessage = error.response.data?.detail || 'Invalid conversation format.';
    } else if (error.response?.data?.detail) {
      // Other API errors
      errorMessage = error.response.data.detail;
    } else if (error.message) {
      // JS errors
      errorMessage = error.message;
    }
    
    store.commit('ui/SET_ERROR', errorMessage);
    
    isImporting.value = false;
    isCreatingThread.value = false;
    importSuccess.value = false;
  }
};

const importClaude = async () => {
  if (!canImport.value || isImporting.value) return;
  
  try {
    isImporting.value = true;
    isCreatingThread.value = true;
    importSuccess.value = false;
    
    // Update loading messages for import
    loadingMessage.value = `Importing ${parsedMessages.value.length} messages...`;
    loadingSubmessage.value = 'Processing your Claude conversation';
    
    // Import the conversation
    const result = await ImportService.importClaudeConversation(
      parsedMessages.value,
      null
    );
    
    if (result.success && result.thread_id) {
      // Show success animation
      importSuccess.value = true;
      loadingMessage.value = 'Import Successful!';
      loadingSubmessage.value = 'Redirecting to your imported conversation...';
      
      // Wait a moment to show the success animation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Navigate to the imported thread
      router.replace({ path: `/${result.thread_id}` });
      
      // Show success message
      store.commit('ui/SET_SUCCESS', `Successfully imported ${result.message_count} messages`);
    } else {
      throw new Error('Import returned unexpected result');
    }
  } catch (error) {
    console.error('Import failed:', error);
    
    // Show detailed error message based on error type
    let errorMessage = 'Failed to import conversation';
    
    if (error.response?.status === 429) {
      // Rate limit error
      errorMessage = error.response.data?.detail || 'You have exceeded the import rate limit. Please try again later.';
    } else if (error.response?.status === 403) {
      // Permission error
      errorMessage = 'You do not have permission to import conversations. Only whitelisted users and admins can import.';
    } else if (error.response?.status === 400) {
      // Validation error
      errorMessage = error.response.data?.detail || 'Invalid conversation format.';
    } else if (error.response?.data?.detail) {
      // Other API errors
      errorMessage = error.response.data.detail;
    } else if (error.message) {
      // JS errors
      errorMessage = error.message;
    }
    
    store.commit('ui/SET_ERROR', errorMessage);
    
    isImporting.value = false;
    isCreatingThread.value = false;
    importSuccess.value = false;
  }
};

const importGemini = async () => {
  if (!canImport.value || isImporting.value) return;
  
  try {
    isImporting.value = true;
    isCreatingThread.value = true;
    importSuccess.value = false;
    
    // Update loading messages for import
    loadingMessage.value = `Importing ${parsedMessages.value.length} messages...`;
    loadingSubmessage.value = 'Processing your Gemini conversation';
    
    // Import the conversation
    const result = await ImportService.importGeminiConversation(
      parsedMessages.value,
      null
    );
    
    if (result.success && result.thread_id) {
      // Show success animation
      importSuccess.value = true;
      loadingMessage.value = 'Import Successful!';
      loadingSubmessage.value = 'Redirecting to your imported conversation...';
      
      // Wait a moment to show the success animation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Navigate to the imported thread
      router.replace({ path: `/${result.thread_id}` });
      
      // Show success message
      store.commit('ui/SET_SUCCESS', `Successfully imported ${result.message_count} messages`);
    } else {
      throw new Error('Import returned unexpected result');
    }
  } catch (error) {
    console.error('Import failed:', error);
    
    // Show detailed error message based on error type
    let errorMessage = 'Failed to import conversation';
    
    if (error.response?.status === 429) {
      // Rate limit error
      errorMessage = error.response.data?.detail || 'You have exceeded the import rate limit. Please try again later.';
    } else if (error.response?.status === 403) {
      // Permission error
      errorMessage = 'You do not have permission to import conversations. Only whitelisted users and admins can import.';
    } else if (error.response?.status === 400) {
      // Validation error
      errorMessage = error.response.data?.detail || 'Invalid conversation format.';
    } else if (error.response?.data?.detail) {
      // Other API errors
      errorMessage = error.response.data.detail;
    } else if (error.message) {
      // JS errors
      errorMessage = error.message;
    }
    
    store.commit('ui/SET_ERROR', errorMessage);
    
    isImporting.value = false;
    isCreatingThread.value = false;
    importSuccess.value = false;
  }
};

const importGrok = async () => {
  if (!canImport.value || isImporting.value) return;
  
  try {
    isImporting.value = true;
    isCreatingThread.value = true;
    importSuccess.value = false;
    
    // Update loading messages for import
    loadingMessage.value = `Importing ${parsedMessages.value.length} messages...`;
    loadingSubmessage.value = 'Processing your Grok conversation';
    
    // Import the conversation
    const result = await ImportService.importGrokConversation(
      parsedMessages.value,
      null
    );
    
    if (result.success && result.thread_id) {
      // Show success animation
      importSuccess.value = true;
      loadingMessage.value = 'Import Successful!';
      loadingSubmessage.value = 'Redirecting to your imported conversation...';
      
      // Wait a moment to show the success animation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Navigate to the imported thread
      router.replace({ path: `/${result.thread_id}` });
      
      // Show success message
      store.commit('ui/SET_SUCCESS', `Successfully imported ${result.message_count} messages`);
    } else {
      throw new Error('Import returned unexpected result');
    }
  } catch (error) {
    console.error('Import failed:', error);
    
    // Show detailed error message based on error type
    let errorMessage = 'Failed to import conversation';
    
    if (error.response?.status === 429) {
      // Rate limit error
      errorMessage = error.response.data?.detail || 'You have exceeded the import rate limit. Please try again later.';
    } else if (error.response?.status === 403) {
      // Permission error
      errorMessage = 'You do not have permission to import conversations. Only whitelisted users and admins can import.';
    } else if (error.response?.status === 400) {
      // Validation error
      errorMessage = error.response.data?.detail || 'Invalid conversation format.';
    } else if (error.response?.data?.detail) {
      // Other API errors
      errorMessage = error.response.data.detail;
    } else if (error.message) {
      // JS errors
      errorMessage = error.message;
    }
    
    store.commit('ui/SET_ERROR', errorMessage);
    
    isImporting.value = false;
    isCreatingThread.value = false;
    importSuccess.value = false;
  }
};
</script>

<style scoped>
.thread-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.thread-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-surface);
  z-index: 5;
}

.back-button {
  padding: var(--space-xs) var(--space-sm);
  background-color: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text);
}

.thread-title {
  margin: 0;
  color: var(--color-primary);
  font-size: var(--font-size-lg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.messages-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-left: 80px;
  padding-right: 80px;
  gap: 20px; /* Consistent gap between elements */
  overflow-y: auto;
  justify-content: flex-start;
  margin-bottom: 130px;
}

.draft-hint {
  text-align: center;
  padding: 10px 0;
  margin-top: 10px;
  color: var(--color-text-secondary);
  font-style: italic;
  font-size: var(--font-size-sm);
  opacity: 0.8;
}

/* Import from ChatGPT button styles */
.import-chatgpt-btn {
  display: block;
  margin: 12px auto;
  padding: var(--space-xs) var(--space-md);
  background-color: var(--color-accent);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: background-color var(--transition-fast);
}

.chatgpt-icon {
  margin-right: 4px;
}

.import-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-top: 6px;
  margin-bottom: 0;
  font-style: italic;
}

.import-chatgpt-btn:hover {
  background-color: var(--color-accent-light);
}

/* Import modal styles - Now replaced with tabbed interface */
/* We're removing all old modal styles and keeping only the new tab styles */

/* New Import Tabs Styles */
.import-tabs-container {
  display: flex;
  margin: 30px auto;
  max-width: 800px;
  width: 90%;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  min-height: 300px;
  background-color: var(--color-surface);
}

.import-tabs-sidebar {
  display: flex;
  flex-direction: column;
  width: 180px;
  min-width: 140px;
  border-right: 1px solid var(--color-border);
  background-color: var(--color-surface-light, #f8f8f8);
}

.import-tab-button {
  padding: var(--space-md);
  text-align: left;
  background: none;
  border: none;
  border-bottom: 1px solid var(--color-border-light);
  cursor: pointer;
  font-size: var(--font-size-md);
  transition: background-color var(--transition-fast);
  color: var(--color-text);
}

.import-tab-button:hover {
  background-color: var(--color-hover-overlay);
}

.import-tab-button.active {
  background-color: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: 500;
  position: relative;
}

.import-tab-button.active::after {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: var(--color-primary);
}

.import-content {
  flex: 1;
  padding: var(--space-xl);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.import-panel {
  text-align: center;
  width: 100%;
}

.import-panel h3 {
  color: var(--color-primary);
  margin-bottom: var(--space-lg);
  font-size: var(--font-size-xl);
}

.under-development {
  color: var(--color-text-secondary);
  font-style: italic;
  font-size: var(--font-size-md);
}

/* Import UI Styles */
.import-instructions {
  margin-bottom: var(--space-lg);
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

/* Import content container - simplified since we're not doing side-by-side anymore */
.import-content-container {
  margin-bottom: var(--space-md);
}

/* Stack vertically on smaller screens */
@media (max-width: 768px) {
  .import-content-container {
    /* No special mobile styling needed anymore */
  }
}

/* Format detection styles */
.format-detection {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xxs) var(--space-xs);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
}

/* Standalone format detection (when no preview) */
.format-detection.standalone {
  margin-bottom: var(--space-md);
}

/* Preview section */
.import-preview {
  background-color: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-md);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(var(--space-xl) * 3);
  margin-bottom: var(--space-sm);
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
}

.preview-message {
  display: flex;
  gap: var(--space-xs);
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.preview-role {
  font-weight: 600;
  color: var(--color-primary);
  min-width: 60px;
  flex-shrink: 0;
  text-align: right;
}

.preview-content {
  color: var(--color-text-secondary);
  word-break: break-word;
  text-align: left;
}

.preview-more {
  font-style: italic;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin-top: var(--space-xs);
}

/* Error section */
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

/* Import button */
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

/* Loading overlay styles */
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
  width: 24px; /* Smaller for inline appearance */
  height: 24px; /* Smaller for inline appearance */
  border: 3px solid var(--color-border); /* Adjusted border width */
  border-top: 3px solid var(--color-accent); /* Adjusted border width */
  border-radius: 50%;
  animation: import-spin 1.2s linear infinite;
  margin-left: var(--space-sm); /* Adds padding between text and spinner */
}

.loading-message {
  font-size: var(--font-size-lg);
  font-weight: bold;
  margin: 0; /* Removed old margins */
  color: var(--color-text);
}

.loading-submessage {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.recipient-selector-title {
  margin: 0 0 var(--space-xs) 0;
  font-size: var(--font-size-lg);
  color: var(--color-primary);
}

.recipient-selector-desc {
  margin: 0 0 var(--space-md) 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.recipient-input-row {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-xs);
}

.recipient-input {
  flex: 1;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.add-recipient-btn {
  padding: 6px 10px;
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.recipients-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.recipient-tag {
  background-color: var(--color-primary-light);
  padding: 6px 10px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.remove-recipient-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.no-recipients {
  color: var(--color-text-secondary);
  font-style: italic;
  font-size: var(--font-size-xs);
  padding: 4px 0;
}

.recipient-selector {
  position: absolute;
  right: unset; /* Remove right positioning */
  bottom: 40px; /* Position above the button */
  left: 50%; /* Center it on its parent */
  transform: translateX(-50%); /* Center it on its parent */
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  min-width: 280px;
  z-index: 20;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.import-validation-error {
  color: var(--color-error);
  font-size: var(--font-size-xs);
  margin: var(--space-xs) 0 0 0;
  text-align: center;
  font-weight: 500;
}

.recipients-required {
  border-color: var(--color-error);
  color: var(--color-error);
}

.required-indicator {
  font-size: var(--font-size-xs);
  font-weight: bold;
  margin-left: 4px;
}

@keyframes import-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Dark theme overrides */
@media (prefers-color-scheme: dark) {
  .thread-header {
    background-color: #000000;
  }

  .draft-hint {
    color: var(--text-color-light-dark, #aaa);
  }
  
  /* Dark theme for loading overlay */
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
  
  /* Dark theme for import UI */
  .import-tabs-sidebar {
    background-color: #1a1a1a;
  }
  
  .import-tab-button {
    border-color: #333;
  }
  
  .import-tab-button:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .import-tab-button.active {
    background-color: rgba(16, 163, 127, 0.2);
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
  
  .import-errors {
    background-color: rgba(220, 38, 38, 0.1);
    border-color: #dc2626;
  }
  
  /* Ensure color variables use proper fallback values */
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

/* Success animation styles */
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

.import-textarea {
  width: 100%;
  min-height: 200px;
  max-height: 400px;
  padding: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: monospace;
  font-size: var(--font-size-sm);
  resize: none;
  background-color: var(--color-surface);
  color: var(--color-text);
  margin-bottom: var(--space-md);
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

/* File upload styles */
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

/* Model selection styles */
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
</style> 