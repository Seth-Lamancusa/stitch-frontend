<script setup>
import { computed, onMounted, ref, onUnmounted, nextTick, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute } from 'vue-router';
import { initializeFirebase } from '../firebase';
import MessageService from '../services/MessageService';
import MessageNode from './MessageNode.vue';

/**
 * MessageList component displays a list of message threads based on the current route.
 * Cloud tab (/cloud) - Shows chronological non-pinned public messages
 * Ground tab (/ground) - Shows locally stored messages (future feature)
 */

const store = useStore();
const router = useRouter();
const route = useRoute();

// Simple local state for infinite scroll - no loading state, just pagination
const isAllLoaded = ref(false);
const cursor = ref(null);

// Store loading state - single source of truth
const isLoading = computed(() => {
  return store.getters['messages/isLoading']('fetchingMessages');
});

// Reference to the message list container for scroll detection
const messageListRef = ref(null);

// Reference to the loading indicator for intersection observer
const loadingIndicatorRef = ref(null);

// Determine active tab from route path
const activeTab = computed(() => {
  const path = route.path;
  if (path.includes('/ground')) return 'ground';
  if (path.includes('/cloud')) return 'cloud';
  return 'cloud'; // Default tab
});

const threads = computed(() => {
  const allMessages = store.getters['messages/getLoadedMessages'] || [];
  
  console.log('[MessageList] threads computed - processing messages:', {
    totalLoadedMessages: allMessages.length,
    activeTab: activeTab.value
  });
  
  // For ground tab, show no messages for now
  if (activeTab.value === 'ground') {
    console.log('[MessageList] threads computed - ground tab, returning empty array');
    return [];
  }
  
  // Only apply minimal client-side filtering since backend handles most filtering
  let filteredMessages = allMessages.filter(message => {
    // Exclude pinned messages (shown separately) - this is the only client-side filter we need
    const isPinned = message.is_pinned === 1 || message.is_pinned === true;
    return !isPinned;
  });
  
  console.log('[MessageList] threads computed - after pinned filter:', {
    filteredCount: filteredMessages.length,
    pinnedFilteredOut: allMessages.length - filteredMessages.length
  });
  
  const sortedMessages = filteredMessages.sort((a, b) => {
    const dateA = new Date(a.timestamp);
    const dateB = new Date(b.timestamp);
    
    // Use store's sort order preference
    const sortOrder = store.getters['messages/getSortOrder'];
    if (sortOrder === 'newest') {
      return dateB - dateA; // Newest first
    } else {
      return dateA - dateB; // Oldest first
    }
  });
  
  console.log('[MessageList] threads computed - final result:', {
    finalCount: sortedMessages.length,
    sortOrder: store.getters['messages/getSortOrder'],
    firstMessageId: sortedMessages[0]?.id || 'none',
    lastMessageId: sortedMessages[sortedMessages.length - 1]?.id || 'none'
  });
  
  return sortedMessages;
});

// Loading indicator should be visible if:
// 1. No messages loaded yet AND not all loaded (triggers initial load)
// 2. Messages loaded but not all loaded yet (triggers infinite scroll)
// 3. Store is loading (filtering operations)
const shouldShowLoadingIndicator = computed(() => {
  const result = (!isAllLoaded.value && (threads.value.length === 0 || threads.value.length > 0)) || isLoading.value;
  console.log('[MessageList] shouldShowLoadingIndicator computed:', {
    isAllLoaded: isAllLoaded.value,
    threadsLength: threads.value.length,
    isLoading: isLoading.value,
    showing: result
  });
  return result;
});

// Empty state only shows if we've loaded and have no messages
const shouldShowEmptyState = computed(() => {
  const result = !isLoading.value && isAllLoaded.value && threads.value.length === 0;
  console.log('[MessageList] shouldShowEmptyState computed:', {
    isLoading: isLoading.value,
    isAllLoaded: isAllLoaded.value,
    threadsLength: threads.value.length,
    showing: result
  });
  return result;
});

// Show login message for auth-dependent scenarios
const shouldShowLoginMessage = computed(() => {
  if (user.value) return false;
  // Currently no auth-dependent tabs, but keeping the structure
  return false && shouldShowEmptyState.value;
});

const error = computed(() => store.getters['ui/error']);
const user = computed(() => store.getters['auth/user']);
const isWhitelisted = computed(() => store.getters['auth/isWhitelisted']);
const canInteract = computed(() => store.getters['auth/canInteract']);

const firebaseReady = ref(false);
const replyCounts = ref({}); // Track reply counts by thread ID

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
  
  router.push({ path: `/cloud/${messageId}` });
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

// Add method to identify temporary threads
const isTemporaryThread = (id) => {
  return typeof id === 'string' && id.toString().startsWith('temp-');
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

// Simple load messages function - dispatches to store
const loadMessages = async () => {
  console.log('[MessageList] loadMessages called:', {
    currentIsLoading: isLoading.value,
    currentIsAllLoaded: isAllLoaded.value,
    currentCursor: cursor.value,
    currentThreadsCount: threads.value.length
  });
  
  if (isLoading.value || isAllLoaded.value) {
    console.log('[MessageList] loadMessages early return due to:', {
      isLoading: isLoading.value,
      isAllLoaded: isAllLoaded.value
    });
    return;
  }
  
  try {
    console.log(`[MessageList] Dispatching fetchChronologicalMessages with cursor:`, cursor.value);
    
    const response = await store.dispatch('messages/fetchChronologicalMessages', {
      cursor: cursor.value
    });
    
    console.log('[MessageList] Fetch response:', {
      hasResponse: !!response,
      exhausted: response?.exhausted,
      nextCursor: response?.nextCursor,
      messagesReceived: response?.messages?.length || 0
    });
    
    if (response) {
      if (response.exhausted) {
        console.log('[MessageList] Response indicates exhausted=true, setting isAllLoaded');
        isAllLoaded.value = true;
      } else {
        console.log('[MessageList] Response indicates exhausted=false, keeping isAllLoaded=false');
        isAllLoaded.value = false;
      }
      if (response.nextCursor !== undefined && response.nextCursor !== null) {
        cursor.value = response.nextCursor;
        console.log('[MessageList] Updated cursor to:', cursor.value);
      }
    }
    
    console.log('[MessageList] Final state:', {
      isLoading: isLoading.value,
      isAllLoaded: isAllLoaded.value,
      threadsLength: threads.value.length
    });
  } catch (error) {
    console.error('[MessageList] Error loading messages:', error);
  }
};

// Set up intersection observer for automatic loading
const setupInfiniteLoading = () => {
  if (!loadingIndicatorRef.value) {
    console.log('[MessageList] setupInfiniteLoading - no loadingIndicatorRef available');
    return;
  }
  
  console.log('[MessageList] Setting up intersection observer');
  
  const options = {
    root: null, // Use the viewport
    rootMargin: '0px',
    threshold: 0.1 // Trigger when at least 10% visible
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      console.log('[MessageList] Intersection observer triggered:', {
        isIntersecting: entry.isIntersecting,
        isAllLoaded: isAllLoaded.value,
        isLoading: isLoading.value,
        willLoadMessages: entry.isIntersecting && !isAllLoaded.value && !isLoading.value
      });
      
      if (entry.isIntersecting && !isAllLoaded.value && !isLoading.value) {
        console.log('[MessageList] Loading indicator visible, loading messages');
        loadMessages();
      }
    });
  }, options);
  
  observer.observe(loadingIndicatorRef.value);
  console.log('[MessageList] Intersection observer set up and observing');
  
  return () => {
    if (loadingIndicatorRef.value) {
      console.log('[MessageList] Cleaning up intersection observer');
      observer.unobserve(loadingIndicatorRef.value);
    }
  };
};

// Initialize component
onMounted(async () => {
  try {
    // Initialize Firebase first
    await initializeFirebase();
    firebaseReady.value = true;
  } catch (error) {
    console.error("Firebase initialization failed in MessageList:", error);
  }

  // Set up intersection observer - it will automatically trigger initial load if needed
  await nextTick(); // Ensure DOM is ready
  setupInfiniteLoading();
});

// Clean up observers
onUnmounted(() => {
  if (loadingIndicatorRef.value) {
    const cleanup = setupInfiniteLoading();
    if (cleanup) cleanup();
  }
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

// Reset state when filters change (watch for directMessagesLastUpdated trigger)
watch(() => store.state.messages.directMessagesLastUpdated, (newVal, oldVal) => {
  console.log('[MessageList] directMessagesLastUpdated changed:', {
    oldVal,
    newVal,
    activeTab: activeTab.value,
    currentIsLoading: isLoading.value,
    currentIsAllLoaded: isAllLoaded.value
  });
  
  if (newVal !== oldVal && activeTab.value === 'cloud') {
    console.log('[MessageList] Triggering refresh');
    nextTick(() => {
      isLoading.value = true;
      console.log('[MessageList] Set temporary loading state');
      setTimeout(() => {
        isLoading.value = false;
        console.log('[MessageList] Cleared temporary loading state');
      }, 50);
    });
  }
});

// Watch for cache clearing and reset loading states
watch(() => store.getters['messages/getLoadedMessages'].length, (newLength, oldLength) => {
  console.log('[MessageList] Message count changed:', {
    oldLength,
    newLength,
    currentIsAllLoaded: isAllLoaded.value,
    currentCursor: cursor.value,
    currentIsLoading: isLoading.value
  });
  
  // If messages were cleared (count went from > 0 to 0), reset loading states
  if (oldLength > 0 && newLength === 0) {
    console.log('[MessageList] Messages cleared, resetting loading states');
    isAllLoaded.value = false;
    cursor.value = null;
    console.log('[MessageList] Reset states - isAllLoaded:', isAllLoaded.value, 'cursor:', cursor.value);
    // Store will handle loading state
  }
});

// Watch for loading completion to reset infinite scroll states appropriately
watch(() => isLoading.value, (newVal, oldVal) => {
  console.log('[MessageList] Loading state changed:', {
    oldVal,
    newVal,
    threadsCount: threads.value.length,
    shouldCheckStates: oldVal === true && newVal === false
  });
  
  // When loading completes, the loadMessages function will have already
  // set isAllLoaded based on the API's exhausted flag
  if (oldVal === true && newVal === false) {
    const messageCount = threads.value.length;
    console.log('[MessageList] Loading completed, checking states. Message count:', messageCount);
    
    // Don't override isAllLoaded here - let the API response determine it
    // The loadMessages function sets isAllLoaded based on response.exhausted
  }
});
</script>

<template>
  <div class="message-list" ref="messageListRef">
    <!-- Tab info boxes - only for ground tab now -->
    <div v-if="activeTab === 'ground'" class="tab-info">
      <p>Local messages stored on your device.</p>
      <p>Feature under development.</p>
    </div>

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

    <!-- Empty state - only shown when no messages and finished loading -->
    <div v-if="shouldShowEmptyState" class="empty-state">
      <!-- Show login message for auth-dependent tabs -->
      <div v-if="shouldShowLoginMessage">
        <p>Please log in to view messages.</p>
      </div>
      <!-- Default empty state -->
      <p v-else>No {{ activeTab }} messages found.</p>
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
      
      <!-- Loading indicator - visible when more content available, triggers loading automatically -->
      <div 
        v-if="shouldShowLoadingIndicator" 
        ref="loadingIndicatorRef"
        class="loading-indicator" 
        :class="{ 'full-height': threads.length === 0, 'loading': isLoading }"
      >
        <div class="loading-spinner" v-if="isLoading"></div>
        <p v-if="isLoading">{{ 
          threads.length === 0 ? 'Loading messages...' : 'Loading more messages...' 
        }}</p>
        <p v-else class="load-more-hint">Scroll for more messages</p>
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
}

.tab-info {
  max-width: 600px;
  margin: 0 auto var(--space-md) auto;
  padding: 16px 20px;
  text-align: center;
  color: var(--color-text-secondary);
  background-color: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.tab-info p {
  margin: 0 0 8px 0;
}

.tab-info p:last-child {
  margin-bottom: 0;
}

.local-message-info {
  background-color: var(--color-surface-light);
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

.message-list-header {
  display: flex;
  justify-content: flex-start;
  padding: var(--space-xxs);
  position: relative;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}
</style> 