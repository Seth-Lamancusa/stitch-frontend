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

// Track loading states per tab - simplified
const loadingStates = ref({
  cloud: {
    isLoading: false,
    isAllLoaded: false
  },
  ground: {
    isLoading: false,
    isAllLoaded: false
  }
});

// Simple convenience getters
const isLoading = computed(() => loadingStates.value[activeTab.value].isLoading);
const isAllMessagesLoaded = computed(() => loadingStates.value[activeTab.value].isAllLoaded);

// Show empty state when no messages and not currently loading
const shouldShowEmptyState = computed(() => {
  return !isLoading.value && threads.value.length === 0;
});

// Show login message for auth-dependent tabs when user is not logged in
const shouldShowLoginMessage = computed(() => {
  if (user.value) return false;
  // Currently no auth-dependent tabs, but keeping the structure
  return false && shouldShowEmptyState.value;
});

// Track cursors for each tab
const cursors = ref({
  cloud: null,
  ground: null
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

const messageListTitle = computed(() => {
  switch (activeTab.value) {
    case 'cloud': return 'Cloud Messages';
    case 'ground': return 'Ground Messages';
    default: return 'Messages';
  }
});

const threads = computed(() => {
  const allMessages = store.getters['messages/getLoadedMessages'] || [];
  const selectedProfile = store.getters['messages/getSelectedProfile'];
  const visibilityFilter = store.getters['messages/getVisibilityFilter'];
  
  // For ground tab, show no messages for now
  if (activeTab.value === 'ground') {
    return [];
  }
  
  // Filter messages based on selected profile and visibility
  let filteredMessages = allMessages.filter(message => {
    // Exclude pinned messages (shown separately)
    const isPinned = message.is_pinned === 1 || message.is_pinned === true;
    if (isPinned) return false;
    
    // Apply profile filter if selected
    if (selectedProfile) {
      const isMatchingAuthor = 
        message.author_user_tag === selectedProfile.user_tag ||
        message.author_email === selectedProfile.email ||
        message.content_author === selectedProfile.uid;
      if (!isMatchingAuthor) return false;
    }
    
    // Apply visibility filter based on public boolean
    const isPublic = message.public === true || message.public === 1;
    if (visibilityFilter === 'public') {
      return isPublic;
    } else if (visibilityFilter === 'not-public') {
      return !isPublic;
    }
    
    return true;
  });
  
  // Sort all messages by timestamp (newest first)
  return filteredMessages.sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
});

// For completeness, still include the global loading state
const globalLoadingState = computed(() => {
  return store.getters['ui/isLoading']('threads');
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

// Get author user tag
function getAuthorUserTag(message) {
  return message.author_user_tag || null;
}

// Get message title with fallback if both title and description are null/empty
function getMessageTitle(message) {
  if ((!message.title || message.title.trim() === '') && 
      (!message.description || message.description.trim() === '')) {
    return `Message from ${getAuthorDisplay(message)}`;
  }
  return message.title || 'Untitled Message';
}

// Get message description with fallback to content preview if both title and description are null/empty
function getMessageDescription(message) {
  if ((!message.title || message.title.trim() === '') && 
      (!message.description || message.description.trim() === '')) {
    // Get first 200 characters of content
    const contentPreview = message.content || '';
    return contentPreview.length > 200 ? 
      contentPreview.substring(0, 200) + '...' : 
      contentPreview;
  }
  return message.description || 'No description';
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

// Add a new function to check if we need to load messages for a tab
const shouldLoadMessagesForTab = (tabName) => {
  // For ground tab, never load messages (showing empty for now)
  if (tabName === 'ground') {
    return false;
  }
  
  // For cloud tab, check if we already have messages
  const allMessages = store.getters['messages/getLoadedMessages'];
  return allMessages.length === 0;
};

// Watch for tab changes to reset and reload
onMounted(async () => {
  try {
    // Initialize Firebase first
    await initializeFirebase();
    firebaseReady.value = true;
  } catch (error) {
    console.error("Firebase initialization failed in MessageList:", error);
  }

  // Keep track of the current active tab
  let previousTab = activeTab.value;
  
  // Check if we need to load messages or can use the cache
  const currentTab = activeTab.value;
  const needsLoading = shouldLoadMessagesForTab(currentTab);
  
  console.log(`[Debug] Initial mount for ${currentTab} tab, needs loading: ${needsLoading}`);
  
  if (needsLoading) {
    // Initial load for the first tab if needed
    await loadMessages(true);
  } else {
    // Use cached data
    console.log(`[Debug] Using cached data for ${currentTab} tab`);
    // Update loading state manually since we're not calling loadMessages()
    loadingStates.value[currentTab].isLoading = false;
    loadingStates.value[currentTab].isAllLoaded = false; // Be optimistic - allow more messages to be loaded
  }
  
  // Set up intersection observer for infinite loading
  setupInfiniteLoading();
  
  router.afterEach((to, from) => {
    // Only process if the path actually changed
    if (to.path !== from.path) {
      const newTab = activeTab.value;
      console.log(`[Debug] Tab navigation from ${previousTab} to ${newTab}`);
      
      // Only reload if we're switching to a different tab
      if (newTab !== previousTab) {
        // Check if we need to load messages or can use the cache
        const needsLoading = shouldLoadMessagesForTab(newTab);
        
        // Always start with a clean loading state for the new tab
        if (needsLoading) {
          console.log(`[Debug] Reloading ${newTab} tab data...`);
          
          // Reset the loading state for the new tab BEFORE loading
          loadingStates.value[newTab].isLoading = true;
          loadingStates.value[newTab].isAllLoaded = false;
          
          // Load new tab data - we're not in the previous tab anymore
          const currentTabName = newTab; // Capture current tab name in closure
          setTimeout(() => {
            // Make sure we're still on this tab when the timeout fires
            if (activeTab.value === currentTabName) {
              loadMessagesForTab(currentTabName, true);
            }
          }, 0);
        } else {
          console.log(`[Debug] Using cached data for ${newTab} tab - found cached messages`);
          // Update loading state manually since we're not calling loadMessages()
          loadingStates.value[newTab].isLoading = false;
          loadingStates.value[newTab].isAllLoaded = false; // Be optimistic - allow more messages to be loaded
        }
        
        // Update the previous tab reference
        previousTab = newTab;
      }
    }
  });
});

// Modified loadMessages function to use the tab-specific version
const loadMessages = async (isInitial = true) => {
  const tabName = activeTab.value;
  
  // Don't reload if we're already loading or all messages are loaded and it's not initial
  if (loadingStates.value[tabName].isLoading || 
      (!isInitial && loadingStates.value[tabName].isAllLoaded)) {
    return;
  }
  
  // Set loading state
  loadingStates.value[tabName].isLoading = true;
  
  // Call the tab-specific loading function
  return loadMessagesForTab(tabName, isInitial);
};

// New function to load messages for a specific tab
const loadMessagesForTab = async (tabName, isInitial = true) => {
  if (isInitial) {
    // Reset cursor when doing an initial load
    cursors.value[tabName] = null;
    // Also reset allLoaded state
    loadingStates.value[tabName].isAllLoaded = false;
  }
  
  try {
    console.log(`[Debug] ${isInitial ? 'Loading' : 'Loading more'} messages for specific tab:`, tabName);
    
    // For ground tab, don't load anything for now
    if (tabName === 'ground') {
      loadingStates.value[tabName].isAllLoaded = true;
      return;
    }
    
    // Get current cursor for this tab
    const cursor = cursors.value[tabName];
    console.log(`[Debug] Using cursor for ${tabName}:`, cursor);
    
    // For cloud tab, use chronological messages endpoint
    let response;
    if (tabName === 'cloud') {
      response = await store.dispatch('messages/fetchChronologicalMessages', { cursor });
    }
    
    // Detailed logging of the response
    if (response) {
      console.log(`[Debug] Response details for ${tabName}:`, {
        messagesCount: response.messages ? response.messages.length : 0,
        exhausted: response.exhausted,
        nextCursor: response.nextCursor
      });
    }
    
    // Check if there are no more messages to load
    if (response) {
      if (response.exhausted) {
        loadingStates.value[tabName].isAllLoaded = true;
        console.log(`[Debug] All messages loaded for ${tabName} tab - exhausted flag is TRUE`);
      }
      
      // Update cursor for next request
      if (response.nextCursor !== undefined && response.nextCursor !== null) {
        cursors.value[tabName] = response.nextCursor;
        console.log(`[Debug] Updated cursor for ${tabName} to: ${response.nextCursor}`);
      }
    }
  } catch (error) {
    console.error(`Error ${isInitial ? 'loading' : 'loading more'} messages for ${tabName}:`, error);
  } finally {
    // Make sure we only update the UI state if this is still the active tab
    if (activeTab.value === tabName) {
      // Update loading state
      loadingStates.value[tabName].isLoading = false;
      
      console.log(`[Debug] Finished ${isInitial ? 'loading' : 'loading more'} messages for ${tabName}`);
    } else {
      console.log(`[Debug] Tab changed from ${tabName} to ${activeTab.value} before loading completed - not updating UI state`);
    }
  }
};

// Set up intersection observer for infinite loading
const setupInfiniteLoading = () => {
  if (!loadingIndicatorRef.value) return;
  
  const options = {
    root: null, // Use the viewport
    rootMargin: '0px',
    threshold: 0.1 // Trigger when at least 10% visible
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !loadingStates.value[activeTab.value].isAllLoaded) {
        console.log('[Debug] Loading indicator visible, loading more messages');
        loadMessages(false);
      }
    });
  }, options);
  
  observer.observe(loadingIndicatorRef.value);
  
  return () => {
    if (loadingIndicatorRef.value) {
      observer.unobserve(loadingIndicatorRef.value);
    }
  };
};

// Clean up observers
onUnmounted(() => {
  if (loadingIndicatorRef.value) {
    const observer = setupInfiniteLoading();
    if (observer) observer();
  }
});

// Add watcher for directMessagesLastUpdated to refresh message display
watch(() => store.state.messages.directMessagesLastUpdated, (newVal, oldVal) => {
  if (newVal !== oldVal && activeTab.value === 'cloud') {
    console.log('[MessageList] Detected direct messages update trigger, refreshing view');
    // No need to fetch from server as the WebSocket has already added the message to the store
    // Just force a re-computation of the threads computed property
    // This is a trick to force Vue to re-evaluate the computed property
    nextTick(() => {
      store.commit('ui/SET_LOADING', { key: 'directMessagesRefresh', isLoading: true });
      setTimeout(() => {
        store.commit('ui/SET_LOADING', { key: 'directMessagesRefresh', isLoading: false });
      }, 50);
    });
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
</script>

<template>
  <div class="message-list" ref="messageListRef">
    <!-- Tab info boxes - only for ground tab now -->
    <div v-if="activeTab === 'ground'" class="tab-info">
      <p>Local messages stored on your device.</p>
      <p>Feature under development.</p>
    </div>

    <!-- Empty state - only shown when no messages and not loading -->
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
      
      <!-- Unified loading indicator - show when loading or will trigger loading -->
      <div 
        v-if="!isAllMessagesLoaded" 
        ref="loadingIndicatorRef"
        class="loading-indicator" 
        :class="{ 'full-height': threads.length === 0, 'loading': isLoading }"
      >
        <div class="loading-spinner" v-if="isLoading"></div>
        <p v-if="isLoading">{{ threads.length === 0 ? 'Loading messages...' : 'Loading more messages...' }}</p>
        <p v-else class="load-more-hint">Scroll for more messages</p>
      </div>
      
      <!-- End of results message when all messages are loaded -->
      <div v-if="!isLoading && isAllMessagesLoaded && threads.length > 0" class="end-of-results">
        <p>No more messages to load</p>
      </div>
    </div>
    
    <div class="message-list-header">
      <button 
        class="new-message-btn"
        :class="{ 'disabled': !canInteract }"
        @click="handleNewThreadClick"
      >
        <span class="btn-icon">+</span>
      </button>
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
</style> 