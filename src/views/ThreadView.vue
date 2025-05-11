<template>
  <div class="thread-view">
    <!-- Loading states -->
    <div v-if="!isAuthReady" class="auth-loading">
      <p>Loading...</p>
    </div>
    
    <div v-else-if="isLoading || isInitialLoading || isLoadingFromUrl" class="loading-indicator">
      <div class="loading-spinner"></div>
      <p>Loading thread...</p>
    </div>
    
    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>
    
    <!-- Normal thread view (remove conditional for temporary threads) -->
    <template v-else-if="displayedMessages.length > 0">
      <!-- Thread header with navigation back and title -->
      <div class="thread-header">
        <button @click="backToList()" class="back-button">
          &larr; Back
        </button>
        <h2 class="thread-title">{{ rootMessage?.title || 'Untitled Thread' }}</h2>
      </div>
      
      <!-- Messages container with fixed spacing -->
      <div class="messages-container" ref="messageList" @click="handleContainerClick">
        <!-- Top of thread marker - always show -->
        <adaptive-marker
          position="top"
          :state="topMarkerState"
          class-name="thread-begin-marker"
          @load-more="loadMoreParents"
          @retry="loadMoreParents"
          ref="topMarker"
          :key="`top-marker-${displayedMessages.length > 0 ? displayedMessages[0].id : 'empty'}`"
        />
      
        <!-- Thread messages - showing single branch -->
        <template v-for="(message, index) in displayedMessages" :key="message.id">
          <!-- Skip system messages in temporary threads -->
          <message-node
            v-if="(message.id === selectedMessageId && !isSelectedMessageLoading || 
                    message.id !== selectedMessageId)"
            :message="message"
            :is-selected="message.id === selectedMessageId"
            :indent-level="0"
            :loaded-replies="getLoadedRepliesCount(message.id)"
            :total-replies="getTotalRepliesCount(message.id)"
            :can-reply="canInteract"
            @click="selectMessage(message.id)"
            @delete="confirmDeleteMessage"
          />
          
          <!-- Loading indicator for selected message -->
          <div v-if="message.id === selectedMessageId && isSelectedMessageLoading" class="message-loading">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading message...</div>
          </div>
        </template>
        
        <!-- Bottom of thread marker - always show -->
        <adaptive-marker
          position="bottom"
          :state="bottomMarkerState"
          class-name="thread-end-marker"
          @load-more="loadMoreChildren"
          @retry="loadMoreChildren"
          ref="bottomMarker"
          :key="`bottom-marker-${displayedMessages.length > 0 ? displayedMessages[displayedMessages.length - 1].id : 'empty'}`"
        />
      </div>
      
      <!-- Reply box component -->
      <reply-box 
        :target-id="replyTargetId"
        :can-interact="canInteract && !!replyTargetId"
        :is-message-selected="!!replyTargetId"
        :is-authenticated="!!user"
        ref="replyBox"
      />
    </template>
    
    <div v-else class="not-found">
      Thread not found.
    </div>

    <!-- Confirmation Modal -->
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

<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount, nextTick } from 'vue';
import { useStore } from 'vuex';
import { useRoute, useRouter } from 'vue-router';
import MessageNode from '../components/MessageNode.vue';
import AdaptiveMarker from '../components/AdaptiveMarker.vue';
import ReplyBox from '../components/ReplyBox.vue';
import MessageService from '../services/MessageService';
import WebSocketService from '../services/WebSocketService';

// Setup store and routing
const store = useStore();
const route = useRoute();
const router = useRouter();

// Refs
const messageList = ref(null);
let unsubscribeMessages = null;
const isLoadingFromUrl = ref(false); // Track if we're loading a thread from URL
const isDeleting = ref(false);

// Add component-level loading states
const isLoadingParents = ref(false);
const isLoadingChildren = ref(false);

// Message ID from route
const messageId = computed(() => {
  const id = route.params.id;
  // Convert to number (all real threads are numeric)
  return Number(id);
});

// Computed properties from namespaced store modules
const user = computed(() => store.getters['auth/user']);
const isAuthReady = computed(() => store.getters['auth/authReady']);
const canInteract = computed(() => store.getters['auth/canInteract']);
const isLoading = computed(() => store.getters['ui/isLoading']('messages'));
const error = computed(() => store.getters['ui/error']);
const showDeleteConfirm = computed(() => store.getters['ui/showDeleteConfirm']);
const messageToDelete = computed(() => store.getters['ui/messageToDelete']);

// Navigation state from namespaced navigation module
const selectedMessageId = computed(() => store.getters['navigation/selectedMessageId']);
const isSelectedMessageLoading = computed(() => store.getters['navigation/isSelectedMessageLoading']);
const replyTargetId = computed(() => store.getters['navigation/replyTargetId']);

// Message display
const displayedMessages = computed(() => {
  const msgs = store.getters['messages/getVisibleBranchMessages'](messageId.value);
  return msgs;
});
const rootMessage = computed(() => {
  if (displayedMessages.value.length === 0) return null;
  return displayedMessages.value[0];
});

// Check if we're at the top of the thread (first message has no parent)
const isTopOfThread = computed(() => {
  if (displayedMessages.value.length === 0) {
    return false;
  }
  
  const firstMessage = displayedMessages.value[0];
  return !firstMessage.parent_id;
});

// Loading state
const isInitialLoading = computed(() => {
  // Check if message ID is valid but message isn't in the store yet
  if (!messageId.value) return false;
  
  // If the message ID exists but the message isn't in the store, consider it loading
  return !store.getters['messages/getMessage'](messageId.value);
});

// In the script setup section, add refs for the adaptive markers
const topMarker = ref(null);
const bottomMarker = ref(null);

// Add this near the top of the script, with the other refs
const lastWebSocketSetupTime = ref(0);
const webSocketDebounceTime = 1000; // 1 second debounce

// In the script setup section, add computed properties for marker states
const topMarkerState = computed(() => {
  // If no messages, use end state
  if (displayedMessages.value.length === 0) return 'end';
  
  // If currently loading parents, show loading state
  if (isLoadingParents.value) return 'loading';
  
  // Get first message in the branch
  const firstMessage = displayedMessages.value[0];
  
  // If first message doesn't have a parent_id at all, we're at the top
  if (!firstMessage.parent_id) {
    console.log('[ThreadView] topMarkerState: No parent_id, showing end state');
    return 'end';
  }
  
  // Check if parent is already loaded in the store
  const parentMessage = store.getters['messages/getMessage'](firstMessage.parent_id);
  
  // Log the state for debugging
  const state = parentMessage ? 'end' : 'waiting';
  console.log(`[ThreadView] topMarkerState: Message ${firstMessage.id} has parent_id ${firstMessage.parent_id}, parent ${parentMessage ? 'found' : 'not found'} in store, showing ${state} state`);
  
  // If parent_id exists but parent message isn't in store, we need to load more (waiting state)
  return state;
});

// Add the consolidated thread rendering and subscription function
const renderThreadAndSubscribe = async () => {
  try {
    console.log(`[ThreadView] Rendering thread for messageId: ${messageId.value}`);
    
    // Guard against missing messageId
    if (!messageId.value) {
      console.log(`[ThreadView] No messageId to render`);
      return;
    }
    
    // 1. Load message data if needed
    await loadMessageIfNeeded(messageId.value);
    
    // 2. Prepare branch paths
    await store.dispatch('messages/prepareBranchPath', messageId.value);
    
    // 3. Force re-evaluation of displayedMessages (happens automatically due to computed property)
    const messages = displayedMessages.value;
    
    console.log(`[ThreadView] Thread rendered with ${messages.length} messages`);
    
    // 4. Set up WebSocket subscription only after messages are loaded
    if (messages.length > 0) {
      setupWebSocketSubscription();
    }
  } catch (error) {
    console.error(`[ThreadView] Error in renderThreadAndSubscribe:`, error);
  }
};

const bottomMarkerState = computed(() => {
  // If no messages, use end state
  if (displayedMessages.value.length === 0) return 'end';
  
  // If currently loading children, show loading state
  if (isLoadingChildren.value) return 'loading';
  
  // Get last message in the branch
  const lastMessage = displayedMessages.value[displayedMessages.value.length - 1];
  
  // If it has no children at all, we're at the bottom
  if (!lastMessage.child_ids || lastMessage.child_ids.length === 0) {
    console.log('[ThreadView] bottomMarkerState: No child_ids, showing end state');
    return 'end';
  }
  
  // Check if any child isn't loaded yet
  const unloadedChildExists = lastMessage.child_ids.some(childId => 
    !store.getters['messages/getMessage'](childId)
  );
  
  // Log the state for debugging
  const state = unloadedChildExists ? 'waiting' : 'end';
  console.log(`[ThreadView] bottomMarkerState: Message ${lastMessage.id} has ${lastMessage.child_ids.length} children, ${unloadedChildExists ? 'some not loaded' : 'all loaded'}, showing ${state} state`);
  
  // If any child_id exists but isn't in store, we need to load more (waiting state)
  return state;
});

// Update loadMessages function to use loading states
const loadMessages = async (direction) => {
  if (displayedMessages.value.length === 0) {
    return;
  }
  
  // Determine target message based on direction
  const targetId = direction === 'parents' 
    ? displayedMessages.value[0].id 
    : displayedMessages.value[displayedMessages.value.length - 1].id;
    
  const message = store.getters['messages/getMessage'](targetId);
  if (!message) {
    return;
  }
  
  // Set component-level loading state
  if (direction === 'parents') {
    isLoadingParents.value = true;
  } else {
    isLoadingChildren.value = true;
  }
  
  try {
    // For parents, we load parent branch up to specified depth
    if (direction === 'parents') {
      await store.dispatch('messages/loadMessageBranchUp', {
        messageId: targetId,
        depth: 2
      });
    }
    // For children, we load child branch with depth 2
    else if (direction === 'children') {
      await store.dispatch('messages/loadMessageBranchDown', {
        messageId: targetId,
        depth: 2
      });
    }
    
    // REMOVED: Don't prepare branch path after loading new messages
    // This allows sibling navigation to persist
  } catch (error) {
    console.error(`Error loading ${direction}:`, error);
  } finally {
    // Always reset loading state
    if (direction === 'parents') {
      isLoadingParents.value = false;
    } else {
      isLoadingChildren.value = false;
    }
  }
};

// Lifecycle hooks
onMounted(async () => {
  // Wait for auth to be ready before proceeding - auth store handles initialization
  if (!isAuthReady.value) {
    await new Promise((resolve) => {
      const unwatch = store.watch(
        () => store.getters['auth/authReady'],
        (newValue) => {
          if (newValue) {
            unwatch();
            resolve();
          }
        }
      );
    });
  }
  
  // Use consolidated function for initial render
  await renderThreadAndSubscribe();
  
  // Add keyboard navigation event listener
  document.addEventListener('keydown', handleKeyDown);
});

onBeforeUnmount(() => {
  // Clean up listeners
  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }
  
  // Explicitly disconnect WebSocket when leaving the thread view
  WebSocketService.disconnectFromThread();
  
  document.removeEventListener('keydown', handleKeyDown);
  
  // Clear message selection when leaving the thread view
  store.dispatch('navigation/selectMessage', null);
  
  // Keep message cache when leaving thread view
});

// Watch for route changes - simplify to just load message if needed
watch(messageId, async (newId) => {
  if (newId) {
    await renderThreadAndSubscribe();
  }
});

// Watch for selected message changes to ensure reply settings are always in sync
watch(selectedMessageId, () => {
  // Remove call to syncReplySettingsWithSelectedMessage since it's now automatic
  // Settings are synced automatically when selecting a message
}, { immediate: true });

// Add new watch to center the selected message when it changes
watch(selectedMessageId, (newId) => {
  // Remove automatic scrolling on selection change
  // This allows users to select messages without disrupting their scroll position
}, { immediate: true });

// Navigation
const backToList = async () => {
  // Navigate back to list view - keep cache for faster return
  router.push('/chat');
};

// Message selection and reply
const selectMessage = async (id) => {
  // If we were already selecting the same message, do nothing
  if (id === selectedMessageId.value) return;
  
  // Simply select the message in the store, no loading needed
  store.dispatch('navigation/selectMessage', id);
};

// Thread actions
const refreshThread = async () => {
  if (messageId.value) {
    await loadMessageIfNeeded(messageId.value);
  }
};

// Handle clicks on the messages container
const handleContainerClick = (event) => {
  // Check if the click is directly on the container (not on a message)
  // We need to check if the clicked element or any of its parents have the message-node class
  let target = event.target;
  let isMessageNode = false;
  
  // Walk up the DOM tree to check for message-node class
  while (target && target !== event.currentTarget) {
    if (target.classList && target.classList.contains('message-node')) {
      isMessageNode = true;
      break;
    }
    target = target.parentElement;
  }
  
  // If click is not on a message node, deselect current message
  if (!isMessageNode && selectedMessageId.value) {
    store.dispatch('navigation/selectMessage', null);
  }
};

const confirmDeleteMessage = (message) => {
  store.dispatch('ui/showDeleteConfirm', message);
};

const deleteMessage = async () => {
  if (!messageToDelete.value || isDeleting.value) return;
  
  const deletedId = messageToDelete.value.id;
  const deletedParentId = messageToDelete.value.parent_id;
  
  try {
    // Set deleting state to true
    isDeleting.value = true;
    
    await store.dispatch('messages/deleteMessage', deletedId);
    
    // Handle navigation if we're deleting the current selected message
    if (selectedMessageId.value === deletedId) {
      // If there's a parent, navigate to it
      if (deletedParentId) {
        store.dispatch('navigation/selectMessage', deletedParentId);
      } else {
        // Otherwise go back to thread list
        router.push('/chat');
      }
    }
    
    // Force an immediate UI refresh by checking displayedMessages
    await nextTick();
    if (displayedMessages.value.length === 0) {
      // If there are no more displayed messages, go back to thread list
      router.push('/chat');
    } else {
      // Refresh the thread or go back to thread list if root was deleted
      if (deletedParentId) {
        refreshThread();
      } else {
        router.push('/chat');
      }
    }
    
    // Hide confirmation modal after successful deletion
    store.commit('ui/SET_DELETE_CONFIRM', { show: false, message: null });
  } catch (error) {
    console.error('Error deleting message:', error);
    store.commit('ui/SET_ERROR', 'Failed to delete message: ' + error.message);
    refreshThread();
  } finally {
    // Reset deleting state
    isDeleting.value = false;
  }
};

// Keyboard navigation
const handleKeyDown = (event) => {
  // Remove keyboard navigation for now as we're migrating navigation system
  // Will be reimplemented after the new navigation system is in place
};

// Simplify the WebSocket subscription function
const setupWebSocketSubscription = () => {
  // Clean up any existing subscription
  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }
  
  // Only subscribe if we have messages
  if (displayedMessages.value.length === 0) {
    console.log(`[ThreadView] No messages to subscribe to`);
    WebSocketService.disconnectFromThread();
    return;
  }
  
  // Get last message in the branch
  const lastMessage = displayedMessages.value[displayedMessages.value.length - 1];
  
  console.log(`[ThreadView] Setting up WebSocket subscription for message ${lastMessage.id}`);
  
  // Create a unique view ID that includes thread ID and timestamp
  const threadViewId = `thread_${messageId.value}_${Date.now()}`;
  
  // Register for message updates
  unsubscribeMessages = WebSocketService.handleNewMessage(handleWebSocketMessage);
  
  // Connect to thread with last message as the end message
  WebSocketService.connectToThread(threadViewId, lastMessage.id)
    .catch(error => console.error('[ThreadView] WebSocket connection error:', error));
};

// Update WebSocket message handler to select messages and ensure selection before rendering
const handleWebSocketMessage = async (messageData) => {
  console.log(`[ThreadView] Received WebSocket message for new reply: ${messageData.id} to parent ${messageData.parent_id}`);
  
  // Add the new message to store
  store.commit('messages/SET_MESSAGE', messageData);
  
  // Update the parent's child_ids list to include this message
  const parentId = messageData.parent_id;
  if (parentId) {
    const parent = store.getters['messages/getMessage'](parentId);
    if (parent && !parent.child_ids.includes(messageData.id)) {
      store.commit('messages/SET_MESSAGE', {
        ...parent,
        child_ids: [...parent.child_ids, messageData.id]
      });
      
      // Set this as the branch child of its parent (moved from handleReplySent)
      store.dispatch('messages/setBranchChild', {
        messageId: parentId,
        childId: messageData.id
      });
    }
  }
  
  // Select the new message from WebSocket and wait for it to complete
  await store.dispatch('navigation/selectMessage', messageData.id);
  
  // Now that selection is complete, render the thread
  await renderThreadAndSubscribe();
};

// Update loadMessageIfNeeded function to remove temporary thread check
const loadMessageIfNeeded = async (id) => {
  // If message isn't in the store, load it from API
  if (!store.getters['messages/getMessage'](id)) {
    console.log(`[ThreadView] Message ${id} not in cache, loading from API`);
    
    try {
      // Set loading state
      isLoadingFromUrl.value = true;
      
      const response = await MessageService.getMessage(id);
      if (response.data) {
        // Add to store
        store.commit('messages/SET_MESSAGE', response.data);
        console.log(`[ThreadView] Message ${id} loaded from API and added to store`);
        
        // Prepare branch path after loading
        store.dispatch('messages/prepareBranchPath', id);
      } else {
        console.error(`[ThreadView] API returned no data for message ${id}`);
        store.commit('ui/SET_ERROR', 'Thread not found or not accessible.');
      }
    } catch (error) {
      console.error(`[ThreadView] Error loading message ${id}:`, error);
      store.commit('ui/SET_ERROR', 'Failed to load thread.');
    } finally {
      // Clear loading state
      isLoadingFromUrl.value = false;
    }
  } else {
    console.log(`[ThreadView] Message ${id} already in cache, no API call needed`);
    
    // Prepare branch path even for cached messages
    store.dispatch('messages/prepareBranchPath', id);
  }
};

// Display helpers
const getLoadedRepliesCount = (parentId) => {
  // Get the message first
  const message = store.getters['messages/getMessage'](parentId);
  
  // If the message has child_ids, use that
  if (message && message.child_ids && Array.isArray(message.child_ids)) {
    return message.child_ids.length;
  }
  
  // Fall back to old implementation
  return store.getters['messages/getChildIds'](parentId).length;
};

const getTotalRepliesCount = (parentId) => {
  // Get the message first
  const message = store.getters['messages/getMessage'](parentId);
  
  // If the message has child_ids, use that as the definitive count
  if (message && message.child_ids && Array.isArray(message.child_ids)) {
    return message.child_ids.length;
  }
  
  // Fall back to the store getter which handles both old and new cases
  return store.getters['messages/getReplyCount'](parentId);
};

// Update loadMoreParents function
const loadMoreParents = async () => {
  isLoadingParents.value = true;
  try {
    await loadMessages('parents');
    await renderThreadAndSubscribe();
  } finally {
    isLoadingParents.value = false;
  }
};

// Update loadMoreChildren function
const loadMoreChildren = async () => {
  isLoadingChildren.value = true;
  try {
    await loadMessages('children');
    await renderThreadAndSubscribe();
  } finally {
    isLoadingChildren.value = false;
  }
};

// Helper function to find the end of branch message
const findEndOfBranchMessage = () => {
  if (!displayedMessages.value || displayedMessages.value.length === 0) {
    return null;
  }
  
  // Get the last message in the displayed chain
  const lastMessage = displayedMessages.value[displayedMessages.value.length - 1];
  return lastMessage;
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
  gap: var(--spacing-md, 12px);
  padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
  border-bottom: 1px solid var(--border-color, #ddd);
  background-color: var(--surface-color, #f8f8f8);
  z-index: 5;
}

.back-button {
  padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
  background-color: transparent;
  border: 1px solid var(--border-color, #ddd);
  border-radius: var(--border-radius-sm, 4px);
  cursor: pointer;
}

.thread-title {
  margin: 0;
  color: var(--primary-color, #333);
  font-size: 1.1rem;
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

.auth-loading,
.loading-indicator,
.error-message,
.not-found {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: var(--text-color-light, #777);
  text-align: center;
}

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
  z-index: 100;
  backdrop-filter: blur(2px);
}

.delete-confirm-content {
  background-color: var(--surface-color, #f8f8f8);
  padding: 24px;
  border-radius: var(--border-radius-md, 8px);
  max-width: 400px;
  width: 90%;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border-color, #ddd);
}

.delete-confirm-content h3 {
  margin-top: 0;
  color: var(--error-color, #dc3545);
  font-size: 1.3rem;
  margin-bottom: 16px;
}

.warning {
  color: var(--error-color, #dc3545);
  font-weight: 600;
  font-size: 0.95rem;
  margin-top: 12px;
}

.delete-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.delete-confirm-actions .cancel-button {
  padding: 8px 16px;
  background-color: transparent;
  color: var(--text-color, #333);
  border: 1px solid var(--border-color, #ddd);
  border-radius: var(--border-radius-sm, 4px);
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s, border-color 0.2s;
}

.delete-confirm-actions .cancel-button:hover {
  background-color: rgba(0, 0, 0, 0.05);
  border-color: var(--border-color-dark, #ccc);
}

.delete-confirm-actions .delete-button {
  padding: 8px 16px;
  background-color: var(--error-color, #dc3545);
  color: white;
  border: none;
  border-radius: var(--border-radius-sm, 4px);
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
  min-width: 80px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-confirm-actions .delete-button:hover:not(:disabled) {
  background-color: var(--error-color-dark, #c82333);
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
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Thread markers and loading indicators */
.thread-begin-marker {
  margin-bottom: 20px;
}

.thread-end-marker {
  margin-top: 20px;
  margin-bottom: 20px;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top: 4px solid var(--primary-color, #007bff);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 10px;
  color: var(--text-color-light, #666);
  font-size: 0.9rem;
}

.parent-loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: 20px;
}

.message-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 15px 0;
  padding: 20px;
  background-color: var(--card-background, #f5f5f5);
  border-radius: 8px;
  border: 1px solid var(--border-color, #ddd);
}

/* Dark theme overrides */
@media (prefers-color-scheme: dark) {
  .thread-header {
    background-color: #000000;
  }

  /* Dark theme for delete modal */
  .delete-confirm-content {
    background-color: var(--surface-color-dark, #222);
    border-color: var(--border-color-dark, #444);
  }
  
  .delete-confirm-content p {
    color: var(--text-color-dark, #eee);
  }
  
  .delete-confirm-actions .cancel-button {
    color: var(--text-color-dark, #eee);
    border-color: var(--border-color-dark, #444);
  }
  
  .delete-confirm-actions .cancel-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
}
</style> 


