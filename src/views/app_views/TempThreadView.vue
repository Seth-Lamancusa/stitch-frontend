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
      <div class="draft-hint">
        <p>Type below to create thread</p>
        <button @click="showImportModal = true" class="import-chatgpt-btn">
          <span class="chatgpt-icon">🤖</span> Import from ChatGPT
        </button>
        <p class="import-hint">Paste content from ChatGPT to create a new thread</p>
      </div>
    </div>
    
    <!-- Reply box component -->
    <reply-box
      :is-temporary-thread="true"
      :can-interact="canInteract"
      ref="replyBox"
      @send-success="handleSendSuccess"
      @send-error="handleSendError"
    />

    <!-- ChatGPT Import Modal -->
    <div v-if="showImportModal" class="import-modal">
      <div class="import-modal-content">
        <h3>Import from ChatGPT</h3>
        <p class="import-instructions">Paste your ChatGPT conversation below:</p>
        
        <textarea 
          v-model="chatgptContent"
          class="import-textarea"
          placeholder="Paste your ChatGPT conversation here..."
        ></textarea>
        
        <!-- Visibility controls (similar to reply box) -->
        <div class="import-settings">
          <label class="visibility-toggle">
            <input 
              type="checkbox" 
              :checked="importIsPublic" 
              @click="importIsPublic = !importIsPublic"
            >
            <span>Public thread</span>
          </label>
          
          <button 
            class="recipients-toggle" 
            @click="toggleImportRecipientSelector"
            :class="{ 'recipients-required': !importIsPublic && importRecipients.length === 0 }"
          >
            Recipients ({{ importRecipients.length }})
            <span v-if="!importIsPublic && importRecipients.length === 0" class="required-indicator">Required</span>
          </button>
          
          <!-- Recipients selector -->
          <div v-if="showImportRecipientSelector" class="recipient-selector import-recipient-selector">
            <h3 class="recipient-selector-title">Recipients</h3>
            <p class="recipient-selector-desc" v-if="!importIsPublic">Private threads require at least one recipient</p>
            <p class="recipient-selector-desc" v-else>Recipients for public threads (optional)</p>
            
            <div class="recipient-input-row">
              <input 
                v-model="newImportRecipient" 
                @keydown.enter.prevent="addImportRecipient" 
                placeholder="Add email address" 
                class="recipient-input"
              />
              <button @click="addImportRecipient" class="add-recipient-btn">Add</button>
            </div>
            
            <div class="recipients-list">
              <div 
                v-if="typeof importRecipients === 'object' && importRecipients !== null"
                v-for="(recipient, index) in importRecipients" 
                :key="index" 
                class="recipient-tag"
              >
                {{ recipient }}
                <button @click="() => removeImportRecipient(index)" class="remove-recipient-btn">×</button>
              </div>
              
              <div v-else-if="typeof importRecipients === 'string'" class="no-recipients">
                {{ importRecipients }}
              </div>
              
              <div v-else-if="importRecipients.length === 0" class="no-recipients">
                No recipients {{ importIsPublic ? '(public thread)' : '' }}
              </div>
            </div>
          </div>
        </div>
        
        <div class="import-modal-actions">
          <button @click="showImportModal = false" class="cancel-button">
            Cancel
          </button>
          <button 
            @click="importFromChatGPT" 
            class="import-button" 
            :disabled="!chatgptContent.trim() || isImporting || !isImportValid"
          >
            {{ isImporting ? 'Importing...' : 'Import' }}
          </button>
        </div>
        
        <!-- Validation error message -->
        <p v-if="!isImportValid" class="import-validation-error">
          Private threads require at least one recipient
        </p>
      </div>
    </div>
    
    <!-- Loading Overlay (for both sending and importing) -->
    <div v-if="isCreatingThread" class="loading-overlay">
      <div class="loading-content">
        <div class="import-spinner"></div>
        <p class="loading-message">Creating new thread...</p>
        <p class="loading-submessage">This will only take a moment</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute } from 'vue-router';
import ReplyBox from '../../components/ReplyBox.vue';

// Setup store and routing
const store = useStore();
const router = useRouter();
const route = useRoute();

// Refs
const messageList = ref(null);
const replyBox = ref(null);

// ChatGPT import functionality
const showImportModal = ref(false);
const chatgptContent = ref('');
const isImporting = ref(false);

// Import modal visibility controls
const importIsPublic = ref(true); // Default to public
const importRecipients = ref([]);
const showImportRecipientSelector = ref(false);
const newImportRecipient = ref('');

// Computed properties from store
const user = computed(() => store.getters['auth/user']);
const canInteract = computed(() => {
  console.log("TempThreadView - checking canInteract:", 
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

// Computed property to check if import is valid
const isImportValid = computed(() => {
  // Public threads are always valid
  if (importIsPublic.value) return true;
  
  // Private threads need at least one recipient
  return importRecipients.value.length > 0;
});

// Update the refs
const isCreatingThread = ref(false);

// Lifecycle hooks
onMounted(async () => {
  // Reset visibility settings for new threads
  console.log(`[TempThreadView] Resetting visibility settings for new thread`);
  
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
  // Clean up import modal listeners
  document.removeEventListener('click', handleImportClickOutside);
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
    
    // Redirect to the new thread
    router.replace({ path: `/messages/${newMessage.id}` });
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

// Toggle import recipient selector
const toggleImportRecipientSelector = () => {
  showImportRecipientSelector.value = !showImportRecipientSelector.value;
  
  if (showImportRecipientSelector.value) {
    // Set up click handler to close when clicking outside
    setTimeout(() => {
      document.addEventListener('click', handleImportClickOutside);
    }, 0);
  } else {
    document.removeEventListener('click', handleImportClickOutside);
  }
};

// Handle clicks outside import recipient selector
const handleImportClickOutside = (event) => {
  const selectorElement = document.querySelector('.import-recipient-selector');
  const toggleButton = document.querySelector('.import-settings .recipients-toggle');
  
  if (selectorElement && 
      !selectorElement.contains(event.target) && 
      toggleButton && 
      !toggleButton.contains(event.target)) {
    showImportRecipientSelector.value = false;
  }
};

// Add recipient to import list
const addImportRecipient = () => {
  if (!newImportRecipient.value.trim()) return;
  
  if (!importRecipients.value.includes(newImportRecipient.value)) {
    importRecipients.value.push(newImportRecipient.value);
  }
  
  newImportRecipient.value = '';
};

// Remove recipient from import list
const removeImportRecipient = (index) => {
  importRecipients.value.splice(index, 1);
};

const importFromChatGPT = async () => {
  // Validate content and import settings
  if (!chatgptContent.value.trim()) return;
  
  // Check if valid import based on visibility and recipients
  if (!isImportValid.value) {
    // Show the recipient selector if trying to submit an invalid import
    if (!importIsPublic.value && importRecipients.value.length === 0) {
      showImportRecipientSelector.value = true;
    }
    return;
  }
  
  try {
    // Set loading state
    isCreatingThread.value = true;
    
    // Close the modal but show a loading overlay
    showImportModal.value = false;
    
    // Clean up modal event listeners when closing
    document.removeEventListener('click', handleImportClickOutside);
    
    // Import the conversation using the dedicated endpoint
    const newMessage = await store.dispatch('messages/importChatGPT', {
      content: chatgptContent.value,
      isPublic: importIsPublic.value,
      recipients: importRecipients.value
    });
    
    // Reset all import state
    chatgptContent.value = '';
    importRecipients.value = [];
    
    // Redirect to the new thread
    router.replace({ path: `/messages/${newMessage.id}` });
  } catch (error) {
    console.error('Error importing from ChatGPT:', error);
    store.commit('ui/SET_ERROR', 'Failed to import from ChatGPT');
  } finally {
    // Reset loading state
    isCreatingThread.value = false;
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

/* Import modal styles */
.import-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--z-index-modal);
  backdrop-filter: blur(2px);
}

.import-modal-content {
  background-color: var(--color-surface);
  padding: var(--space-lg);
  border-radius: var(--radius-md);
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
}

.import-modal-content h3 {
  margin-top: 0;
  color: var(--color-primary);
  font-size: var(--font-size-xl);
  margin-bottom: var(--space-md);
}

.import-instructions {
  margin-bottom: var(--space-md);
  color: var(--color-text);
}

.import-textarea {
  flex: 1;
  min-height: 200px;
  padding: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  resize: vertical;
  margin-bottom: var(--space-md);
  font-family: inherit;
  font-size: var(--font-size-sm);
  background-color: var(--color-surface);
}

/* Import settings styles */
.import-settings {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
  align-items: center;
  position: relative;
  padding: var(--space-xs);
  background-color: var(--color-surface);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.import-settings .visibility-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  white-space: nowrap;
}

.import-settings .recipients-toggle {
  padding: 4px 8px;
  background-color: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
}

.import-recipient-selector {
  position: absolute;
  height: 180px;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  z-index: 30;
  max-height: 320px;
  overflow-y: auto;
}

.import-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
}

.import-button {
  padding: var(--space-xs) var(--space-md);
  background-color: var(--color-accent);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 500;
}

.import-button:hover {
  background-color: var(--color-accent-light);
}

.import-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-button {
  padding: var(--space-xs) var(--space-md);
  background-color: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 500;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}

.cancel-button:hover {
  background-color: var(--color-hover-overlay);
  border-color: var(--color-border-dark);
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

.import-spinner {
  width: 48px;
  height: 48px;
  border: 5px solid var(--color-border);
  border-top: 5px solid var(--color-accent);
  border-radius: 50%;
  animation: import-spin 1.2s linear infinite;
  margin-bottom: var(--space-md);
}

.loading-message {
  font-size: var(--font-size-lg);
  font-weight: bold;
  margin: 0 0 var(--space-xs) 0;
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
  
  /* Dark theme for import modal */
  .import-modal-content {
    background-color: var(--surface-color-dark, #222);
    border-color: var(--border-color-dark, #444);
  }
  
  .import-instructions {
    color: var(--text-color-dark, #eee);
  }
  
  .import-textarea {
    background-color: var(--card-background-dark, #333);
    color: var(--text-color-dark, #eee);
    border-color: var(--border-color-dark, #444);
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
  
  /* Dark theme for import settings */
  .import-settings {
    background-color: var(--card-background-dark, #333);
    border-color: var(--border-color-dark, #444);
  }
  
  .import-settings .visibility-toggle {
    color: var(--text-color-dark, #eee);
  }
  
  .import-settings .recipients-toggle {
    color: var(--text-color-dark, #eee);
    border-color: var(--border-color-dark, #444);
  }
}
</style> 