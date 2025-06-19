<script setup>
import { computed, onMounted, ref, onUnmounted, nextTick, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute } from 'vue-router';
import { initializeFirebase } from '../firebase';
import MessageNode from './MessageNode.vue';
import MessageService from '../services/MessageService';

const store = useStore();
const router = useRouter();
const route = useRoute();

const isAllLoaded = ref(false);
const currentPage = ref(1);

// Store loading state - single source of truth
const isLoading = computed(() => {
  return store.getters['messages/isLoading']('fetchingMessages');
});

// Reference to the message list container for scroll detection
const messageListRef = ref(null);

// Reference to the loading indicator for intersection observer
const loadingIndicatorRef = ref(null);

// Determine active tab from route path - SIMPLIFIED since we only have inbox now
const activeTab = computed(() => {
  return 'inbox'; // Always inbox now
});

const threads = computed(() => {
  const allMessages = store.getters['messages/getLoadedMessages'] || [];
  
  return allMessages;
});

// Loading indicator should be visible if we're loading or have more to load
const shouldShowLoadingIndicator = computed(() => {
  return isLoading.value || !isAllLoaded.value;
});

// Empty state only shows if we've loaded and have no messages
const shouldShowEmptyState = computed(() => {
  return !isLoading.value && isAllLoaded.value && threads.value.length === 0;
});

// Show login message when no user is logged in
const shouldShowLoginMessage = computed(() => {
  return !user.value;
});

const error = computed(() => store.getters['ui/error']);
const user = computed(() => store.getters['auth/user']);
const isWhitelisted = computed(() => store.getters['auth/isWhitelisted']);
const canInteract = computed(() => store.getters['auth/canInteract']);

const firebaseReady = ref(false);
const replyCounts = ref({}); // Track reply counts by thread ID

// Add new ref for info box collapsed state
const isInfoBoxCollapsed = ref(localStorage.getItem('infoBoxCollapsed') === 'true');

// Get display version of author for a message
function getAuthorDisplay(message) {
  return message.author_display_name || '';
}

// Get reply count from child_ids
function getReplyCount(message) {
  // Use child_ids array if available
  if (message.child_ids && Array.isArray(message.child_ids)) {
    return message.child_ids.length;
  }
  // Fall back to existing counts if available
  return replyCounts.value[message.id] || 0;
}

// Navigate to thread view when a thread is clicked
const viewMessage = (messageId) => {
  // Store current route before navigation
  store.dispatch('navigation/setPreviousRoute', route.path);
  
  router.push({ path: `/${messageId}` });
};

// Handle message deletion requests
const confirmDeleteMessage = (message) => {
  // If a message is deleted from the list view, use the UI store to handle confirmation
  store.dispatch('ui/showDeleteConfirm', message);
  // The actual deletion is handled by the UI store and messages module
};

// Create a new message thread
const createNewThread = () => {
  // Store current route before navigation
  store.dispatch('navigation/setPreviousRoute', route.path);
  
  // Simply navigate to the new thread route
  router.push('/new-thread');
  console.log('Navigating to new thread route');
};

// Handle the new message button click
const handleNewThreadClick = (event) => {
  // First check if user is logged in
  if (!user.value) {
    alert("Please log in to create new messages");
    return;
  }

  // Check user status directly
  if (user.value.status === 'admin' || user.value.status === 'whitelisted') {
    createNewThread();
  } else {
    alert("You need to be whitelisted to create new messages");
  }
};

// Function to check if the author is the current user
function isCurrentUserAuthor(message) {
  if (!user.value) return false;
  
  // First check by author_user_tag if available
  if (message.author_user_tag && user.value.user_tag === message.author_user_tag) {
    return true;
  }
  
  // Then check by email
  if (message.author_email && user.value.email === message.author_email) {
    return true;
  }
  
  // Finally check content_author for older messages
  if (message.content_author === user.value.uid) {
    return true;
  }
  
  return false;
}

// Get all messages in a thread (for unread count calculation)
function getThreadMessages(threadId) {
  // Get all loaded messages
  const allMessages = store.getters['messages/getLoadedMessages'];
  
  // Find thread root in case threadId is not the actual root
  let rootId = threadId;
  let currentMessage = allMessages.find(m => m.id === threadId);
  
  // Traverse up to find the root if needed
  while (currentMessage && currentMessage.parent_id) {
    const parent = allMessages.find(m => m.id === currentMessage.parent_id);
    if (parent) {
      rootId = parent.id;
      currentMessage = parent;
    } else {
      break;
    }
  }
  
  // Find all messages in this thread (having rootId as ancestor)
  const threadMessages = allMessages.filter(message => {
    // Include the root itself
    if (message.id === rootId) return true;
    
    // Check if this message has rootId as an ancestor
    let parent = message;
    while (parent && parent.parent_id) {
      if (parent.parent_id === rootId) return true;
      
      // Move up to the parent
      parent = allMessages.find(m => m.id === parent.parent_id);
      if (!parent) break;
    }
    
    return false;
  });
  
  return threadMessages;
}

// Simple load messages function
const loadMessages = async () => {
  // Stop if no user, already loading, or all done
  if (!user.value || isLoading.value || isAllLoaded.value) {
    return;
  }
  
  try {
    const response = await store.dispatch('messages/fetchUserMessages', {
      page: currentPage.value
    });
    
    if (response) {
      // Update states based on response
      isAllLoaded.value = response.exhausted || false;
      // Only increment page if we got results and there are more
      if (!response.exhausted && response.messages.length > 0) {
        currentPage.value += 1;
      }
    }
  } catch (error) {
    console.error('Error loading messages:', error);
  }
};

// Initialize component
onMounted(async () => {
  try {
    await initializeFirebase();
    firebaseReady.value = true;
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }

  // Only start loading if user is authenticated
  if (user.value) {
    loadMessages();
  }
});

// Watch for user changes to start loading when they log in
watch(user, (newUser, oldUser) => {
  if (newUser && !oldUser) {
    // User just logged in, start loading messages
    console.log('User logged in, starting to load messages');
    loadMessages();
  } else if (!newUser && oldUser) {
    // User logged out, reset state
    console.log('User logged out, resetting message list state');
    isAllLoaded.value = false;
    currentPage.value = 1;
  }
});

// Clean up observers
onUnmounted(() => {
  // No cleanup needed
});

// Add computed properties for delete confirmation modal
const showDeleteConfirm = computed(() => store.getters['ui/showDeleteConfirm']);
const messageToDelete = computed(() => store.getters['ui/messageToDelete']);
const isDeleting = ref(false);

// Add delete message functionality
const deleteMessage = async () => {
  if (!messageToDelete.value || isDeleting.value) return;
  
  const deletedId = messageToDelete.value.id;
  
  try {
    // Set deleting state to true
    isDeleting.value = true;
    
    await store.dispatch('messages/deleteMessage', deletedId);
    
    // Hide confirmation modal after successful deletion
    store.commit('ui/SET_DELETE_CONFIRM', { show: false, message: null });
    
    // No need to navigate - the message will disappear from the list
  } catch (error) {
    console.error('Error deleting message:', error);
    
    // Provide specific error message for cascade delete scenarios
    let errorMessage = 'Failed to delete message';
    
    if (error.response?.status === 404) {
      errorMessage = 'This message has already been deleted (likely when its parent was deleted)';
      // Hide confirmation modal since the message is already gone
      store.commit('ui/SET_DELETE_CONFIRM', { show: false, message: null });
    } else if (error.response?.status === 403) {
      errorMessage = 'You do not have permission to delete this message';
    } else if (error.message) {
      errorMessage = 'Failed to delete message: ' + error.message;
    }
    
    store.commit('ui/SET_ERROR', errorMessage);
  } finally {
    // Reset deleting state
    isDeleting.value = false;
  }
};

// Reset state when cache is cleared
watch(() => store.getters['messages/getLoadedMessages'].length, (newLength, oldLength) => {
  // If messages were cleared, reset loading states
  if (oldLength > 0 && newLength === 0) {
    isAllLoaded.value = false;
    currentPage.value = 1;
  }
});

// Add function to toggle info box
const toggleInfoBox = () => {
  isInfoBoxCollapsed.value = !isInfoBoxCollapsed.value;
  localStorage.setItem('infoBoxCollapsed', isInfoBoxCollapsed.value);
};
</script>

<template>
  <div class="message-list" ref="messageListRef">
    <!-- Debug Panel
    <div class="debug-panel" style="background: #f0f0f0; padding: 10px; margin: 10px; border: 1px solid #ccc; font-family: monospace;">
      <h4>Debug Info:</h4>
      <pre>
        isLoading: {{ isLoading }}<br>
        isAllLoaded: {{ isAllLoaded }}<br>
        shouldShowLoadingIndicator: {{ shouldShowLoadingIndicator }}<br>
        threads.length: {{ threads.length }}<br>
        currentPage: {{ currentPage }}<br>
        activeTab: {{ activeTab }}<br>
        shouldShowEmptyState: {{ shouldShowEmptyState }}<br>
        shouldShowLoginMessage: {{ shouldShowLoginMessage }}<br>
        showDeleteConfirm: {{ showDeleteConfirm }}<br>
        messageToDelete: {{ messageToDelete }}<br>
        isDeleting: {{ isDeleting }}<br>
      </pre>
    </div> -->

    <!-- Message list header -->
    <div class="message-list-header">
      <div class="header-controls">
        <button 
          class="new-message-btn"
          :class="{ 'disabled': !canInteract }"
          @click="handleNewThreadClick"
        >
          <span class="btn-icon">+</span>
        </button>
      </div>
    </div>

    <!-- Login message for guests -->
    <div v-if="shouldShowLoginMessage" class="login-message">
      <div class="login-content">
        <h3>Welcome to Stitch</h3>
        <p>Log in to view and participate in conversations, <router-link to="/requests">join the waitlist</router-link>, or navigate to a public message by url.</p>
      </div>
    </div>

    <!-- Empty state - only shown when logged in but no messages -->
    <div v-else-if="shouldShowEmptyState" class="empty-state">
      <p>No messages found.</p>
      <p class="empty-subtitle">Start a conversation by creating a new message!</p>
    </div>
    
    <div v-if="user" class="info-box" :class="{ 'collapsed': isInfoBoxCollapsed }">
      <div class="info-header">
        <button class="toggle-button" @click.stop="toggleInfoBox">
          {{ isInfoBoxCollapsed ? 'Show Info' : 'Hide Info' }}
          <span class="toggle-icon">{{ isInfoBoxCollapsed ? '▼' : '▲' }}</span>
        </button>
      </div>
      <div class="info-content" :class="{ 'hidden': isInfoBoxCollapsed }">
        <p class="info-text">Welcome to Stitch! Messages may be public or private, and may have any number of direct recipients, even if public. Below is the last in each thread in which you are author or direct recipient.</p>
        <p class="info-text">There are three badge types: orange, blue, and green. Orange indicates direct recipients for messages you sent. Blue indicates the number of other direct recipients for messages you received, along with a manual read/unread indicator. Green badges indicate "public".</p>
        <p class="info-text">You may click on a message to view it in full, along with its ancestors, descendants, and retroactively linked messages (coming soon).</p>
      </div>
    </div>

    <!-- Messages container -->
    <div class="messages-container">
      <!-- Messages list - now using MessageNode component -->
      <div 
        v-for="thread in threads" 
        :key="thread.id" 
        class="message-list-item"
        @click="viewMessage(thread.id)"
      >
        <MessageNode
          :message="thread"
          :is-selected="false"
          :indent-level="0"
          :loaded-replies="getReplyCount(thread)"
          :total-replies="getReplyCount(thread)"
          :can-reply="false"
          :inListView="true"
          :threadMessages="getThreadMessages(thread.id)"
          @delete="confirmDeleteMessage"
        />
      </div>
      
      <!-- Loading indicator - only show for authenticated users -->
      <div 
        v-if="shouldShowLoadingIndicator && user" 
        ref="loadingIndicatorRef"
        class="loading-indicator" 
        :class="{ 'full-height': threads.length === 0, 'loading': isLoading }"
      >
        <div class="loading-spinner" v-if="isLoading"></div>
        <p v-if="isLoading">{{ 
          threads.length === 0 ? 'Loading messages...' : 'Loading more messages...' 
        }}</p>
        <button 
          v-else 
          @click="loadMessages" 
          class="load-more-button"
          :disabled="isLoading"
        >
          Load More Messages
        </button>
      </div>
      
      <!-- End of results message when all messages are loaded -->
      <div v-if="!isLoading && isAllLoaded && threads.length > 0" class="end-of-results">
        <p>No more messages to load</p>
      </div>
    </div>

    <!-- Add the Confirmation Modal -->
    <div v-if="showDeleteConfirm" class="delete-confirm-modal">
      <div class="delete-confirm-content">
        <h3>Confirm Deletion</h3>
        <p>Are you sure you want to delete this message and all its replies?</p>
        <p class="warning">This action cannot be undone.</p>
        <div class="delete-confirm-actions">
          <button @click="store.dispatch('ui/hideDeleteConfirm')" class="cancel-button" :disabled="isDeleting">
            Cancel
          </button>
          <button @click="deleteMessage" class="delete-button" :disabled="isDeleting">
            <span v-if="!isDeleting">Delete</span>
            <div v-else class="button-spinner"></div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--space-md);
  overflow-y: auto;
  height: 100%;
}

.login-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: var(--space-xl);
  text-align: center;
}

.login-content {
  max-width: 400px;
  padding: var(--space-xl);
  background-color: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.login-content h3 {
  margin: 0 0 var(--space-md) 0;
  color: var(--color-text);
  font-size: var(--font-size-xl);
  font-weight: 600;
}

.login-content p {
  margin: 0 0 var(--space-sm) 0;
  color: var(--color-text);
  font-size: var(--font-size-base);
  line-height: 1.5;
}

.login-subtitle {
  color: var(--color-text-secondary) !important;
  font-size: var(--font-size-sm) !important;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: var(--space-xl);
  text-align: center;
  color: var(--color-text-secondary);
}

.empty-subtitle {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin-top: var(--space-sm);
}

.section-title {
  font-size: var(--font-size-lg);
  margin-bottom: var(--space-sm);
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.messages-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.message-list-item {
  width: 100%;
  cursor: pointer;
  position: relative;
  transition: transform var(--transition-fast), opacity var(--transition-fast);
}

.message-list-item:hover {
  opacity: 0.95;
}

.loading-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--color-text-secondary);
  text-align: center;
  flex-direction: column;
  gap: 12px;
  margin-top: var(--space-sm);
  height: auto;
  padding: var(--space-sm);
  min-height: 50px;
}

.loading-indicator.full-height {
  height: 160px;
}

.loading-indicator.loading {
  opacity: 1;
}

.loading-indicator:not(.loading) {
  opacity: 0.5;
}

.load-more-hint {
  font-size: var(--font-size-xs);
  font-style: italic;
}

.error-message {
  color: var(--color-error);
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  text-align: center;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: var(--color-text-secondary);
  text-align: center;
  flex-direction: column;
  gap: 16px;
}

.end-of-results {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--space-md);
  color: var(--color-text-secondary);
  text-align: center;
  font-size: var(--font-size-sm);
  opacity: 0.7;
}

.loading-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border);
  border-top: 3px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.new-message-btn {
  position: fixed;
  bottom: var(--space-xl);
  right: var(--space-xl);
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: 50%;
  width: 60px;
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: background-color var(--transition-normal);
  z-index: 10;
  font-size: 52px;
}

.new-message-btn:hover {
  background-color: var(--color-primary-dark);
}

.new-message-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: all;
}

.unread-indicator {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: var(--color-error, #ff3860);
  margin-right: 5px;
  vertical-align: middle;
}

/* Add the modal styles */
.delete-confirm-modal {
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

.delete-confirm-content {
  background-color: var(--color-surface);
  padding: 24px;
  border-radius: var(--radius-md);
  max-width: 400px;
  width: 90%;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--color-border);
}

.delete-confirm-content h3 {
  margin-top: 0;
  color: var(--color-error);
  font-size: var(--font-size-xl);
  margin-bottom: 16px;
}

.warning {
  color: var(--color-error);
  font-weight: 600;
  font-size: var(--font-size-sm);
  margin-top: 12px;
}

.delete-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.delete-confirm-actions .cancel-button {
  padding: var(--space-xs) var(--space-md);
  background-color: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 500;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}

.delete-confirm-actions .cancel-button:hover {
  background-color: var(--color-hover-overlay);
  border-color: var(--color-border-dark);
}

.delete-confirm-actions .delete-button {
  padding: var(--space-xs) var(--space-md);
  background-color: var(--color-error);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 500;
  transition: background-color var(--transition-fast);
  min-width: 80px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-confirm-actions .delete-button:hover:not(:disabled) {
  background-color: var(--color-error);
  filter: brightness(90%);
}

.delete-confirm-actions .delete-button:disabled,
.delete-confirm-actions .cancel-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.button-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid var(--color-text-inverse);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.message-list-header {
  margin: 0px;
  padding: 0px;
}

.load-more-button {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-lg);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-fast), opacity var(--transition-fast);
  min-width: 140px;
}

.load-more-button:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
}

.load-more-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.info-box {
  background: var(--color-surface-light, #222);
  border: 1px solid var(--color-border, #333);
  margin: 20px auto;
  margin-top: 32px;
  padding: 12px 16px;
  width: 70%;
  border-radius: var(--radius-md, 8px);
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

.info-box.collapsed {
  padding: 4px 16px;
  margin: 8px auto;
  margin-top: 16px;
}

.info-header {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  margin-bottom: 8px;
}

.info-box.collapsed .info-header {
  margin-bottom: 0;
}

.toggle-button {
  background: transparent;
  border: none;
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  font-size: var(--font-size-sm);
  border-radius: var(--radius-sm);
  transition: background-color 0.2s ease;
  opacity: 0.7;
}

.toggle-button:hover {
  background-color: var(--color-hover-overlay);
  opacity: 1;
}

.toggle-icon {
  font-size: 8px;
  line-height: 1;
}

.info-content {
  max-height: 1000px;
  opacity: 1;
  transition: all 0.3s ease;
  overflow: hidden;
}

.info-content.hidden {
  max-height: 0;
  opacity: 0;
  margin: 0;
  padding: 0;
}

.info-text {
  margin: 0 0 12px 0;
  color: var(--color-text, #fff);
  font-size: var(--font-size-base, 14px);
  line-height: 1.5;
}

.info-text:last-child {
  margin-bottom: 0;
}
</style> 