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
      
      <!-- New tabbed import interface -->
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
          <div class="import-panel">
            <h3>Import from {{ getActiveTabName() }}</h3>
            <p class="under-development">This feature is under development</p>
          </div>
        </div>
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

// Import tabs configuration
const importTabs = [
  { id: 'chatgpt', name: 'ChatGPT' },
  { id: 'x', name: 'X' },
  { id: 'reddit', name: 'Reddit' },
  { id: 'claude', name: 'Claude' },
  { id: 'gemini', name: 'Gemini' },
  { id: 'grok', name: 'Grok' }
];
const activeImportTab = ref('chatgpt');

// Function to get active tab name
const getActiveTabName = () => {
  const tab = importTabs.find(tab => tab.id === activeImportTab.value);
  return tab ? tab.name : '';
};

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
  height: 300px;
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
}
</style> 