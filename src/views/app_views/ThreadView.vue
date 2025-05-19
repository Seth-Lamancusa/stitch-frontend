<template>
  <div class="thread-view" :class="{'positioning': isPositioning}">
    <!-- Loading states -->
    <div v-if="!isAuthReady" class="auth-loading">
      <p>Loading...</p>
    </div>
    
    <div v-else-if="isLoading || isInitialLoading || isLoadingFromUrl || isInitialContentLoading" class="loading-indicator">
      <div class="loading-spinner"></div>
      <p>{{ isInitialContentLoading ? 'Loading thread content...' : 'Loading thread...' }}</p>
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
        
        <!-- Dedicated scroll anchor at top of messages -->
        <div ref="scrollAnchor" class="scroll-anchor"></div>
      
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
import MessageNode from '../../components/MessageNode.vue';
import AdaptiveMarker from '../../components/AdaptiveMarker.vue';
import ReplyBox from '../../components/ReplyBox.vue';
import MessageService from '../../services/MessageService';
import WebSocketService from '../../services/WebSocketService';

// Setup store and routing
const store = useStore();
const route = useRoute();
const router = useRouter();

// Refs
const messageList = ref(null);
let unsubscribeMessages = null;
const isLoadingFromUrl = ref(false); // Track if we're loading a thread from URL
const isDeleting = ref(false);

// Add new loading state for initial content loading
const isInitialContentLoading = ref(false);

// Scroll anchor ref
const scrollAnchor = ref(null);
const hasInitiallyScrolled = ref(false);
const isPositioning = ref(false);

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

// In the script setup section, add a debounce timer
const websocketDebounceTimer = ref(null);
const currentSubscribedMessageId = ref(null);

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

// Update the consolidated thread rendering function to mark messages as read
const renderThread = async (preserveScroll = false) => {
  try {
    console.log(`[ThreadView] Rendering thread for messageId: ${messageId.value} (preserveScroll: ${preserveScroll})`);
    
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
    
    // 4. Mark visible messages as read
    if (messages.length > 0) {
      await markMessagesAsRead(messages);
    }
    
    // 5. Scroll to center the message ID from the URL if messages exist and not preserving scroll
    if (messages.length > 0 && !preserveScroll) {
      scrollToMessageId(messageId.value);
    }
  } catch (error) {
    console.error(`[ThreadView] Error in renderThread:`, error);
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
        depth: 5
      });
    }
    // For children, we load child branch with depth 2
    else if (direction === 'children') {
      await store.dispatch('messages/loadMessageBranchDown', {
        messageId: targetId,
        depth: 5
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
  
  // Use loadInitialContent for initial thread loading
  if (messageId.value) {
    await loadInitialContent(messageId.value);
    
    // After initial content is loaded and rendered, ensure correct scroll position
    ensureCorrectScroll();
  }
  
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
  
  // Clean up any pending timer
  if (websocketDebounceTimer.value) {
    clearTimeout(websocketDebounceTimer.value);
    websocketDebounceTimer.value = null;
  }
});

// Watch for route changes - use loadInitialContent for new thread IDs
watch(messageId, async (newId) => {
  if (newId) {
    await loadInitialContent(newId);
  }
});

// Watch for selected message changes to ensure reply settings are always in sync
watch(selectedMessageId, () => {
  // Remove call to syncReplySettingsWithSelectedMessage since it's now automatic
  // Settings are synced automatically when selecting a message
}, { immediate: true });

// Add new watch to center the selected message when it changes
watch(selectedMessageId, (newId) => {
  if (newId && hasInitiallyScrolled.value) {
    // If we've already loaded the initial content, ensure correct scroll position
    // When user selects a different message
    nextTick(() => {
      ensureCorrectScroll();
    });
  }
}, { immediate: true });

// Navigation
const backToList = async () => {
  // Get the previous route
  const prevRoute = store.getters['navigation/previousRoute'];
  
  // Navigate back to the previous route - keep cache for faster return
  router.push(prevRoute || '/feed'); // Fallback to feed if no previous route
};

// Update the loadInitialContent function to mark messages as read after loading

const loadInitialContent = async (targetMessageId) => {
  if (!targetMessageId) {
    console.error('[ThreadView] Cannot load initial content: No target message ID provided');
    return;
  }
  
  try {
    // Set loading state
    isInitialContentLoading.value = true;
    hasInitiallyScrolled.value = false;
    isPositioning.value = true; // Hide content during initial rendering
    
    console.log(`[ThreadView] Loading initial content for message ID: ${targetMessageId}`);
    
    // 1. First load the target message if needed
    await loadMessageIfNeeded(targetMessageId);
    
    // 2. Get the message from the store
    const targetMessage = store.getters['messages/getMessage'](targetMessageId);
    if (!targetMessage) {
      console.error(`[ThreadView] Target message ${targetMessageId} not found after loading`);
      isInitialContentLoading.value = false;
      isPositioning.value = false; // Show content in case of error
      return;
    }
    
    // 3. Check if we need to load parent messages
    const needParents = !targetMessage.parent_id || await checkNeedMoreParents(targetMessage);
    
    // 4. Check if we need to load child messages
    const needChildren = !targetMessage.child_ids || targetMessage.child_ids.length === 0 || await checkNeedMoreChildren(targetMessage);
    
    // 5. Load messages in parallel, but only if needed
    const loadingPromises = [];
    const loadedMessages = [];
    
    if (needParents) {
      console.log(`[ThreadView] Loading parent messages for ${targetMessageId}`);
      const parentMessages = await store.dispatch('messages/loadMessageBranchUp', {
        messageId: targetMessageId,
        depth: 5
      });
      
      if (parentMessages && parentMessages.length > 0) {
        loadedMessages.push(...parentMessages);
      }
    } else {
      console.log(`[ThreadView] Sufficient parent messages already in cache for ${targetMessageId}`);
    }
    
    if (needChildren) {
      console.log(`[ThreadView] Loading child messages for ${targetMessageId}`);
      const childMessages = await store.dispatch('messages/loadMessageBranchDown', {
        messageId: targetMessageId,
        depth: 5
      });
      
      if (childMessages && childMessages.length > 0) {
        loadedMessages.push(...childMessages);
      }
    } else {
      console.log(`[ThreadView] Sufficient child messages already in cache for ${targetMessageId}`);
    }
    
    // 6. Mark loaded messages as read
    if (loadedMessages.length > 0) {
      await markMessagesAsRead(loadedMessages);
    }
    
    // 7. Prepare branch path for rendering
    await store.dispatch('messages/prepareBranchPath', targetMessageId);
    
    // 8. Select the target message before rendering
    // This ensures the scroll anchor will be positioned correctly on initial render
    store.dispatch('navigation/selectMessage', targetMessageId);
    
    // 9. Render the thread
    await renderThread();
  } catch (error) {
    console.error('[ThreadView] Error loading initial content:', error);
  } finally {
    isInitialContentLoading.value = false;
  }
};

// Helper function to check if we need to load more parent messages
const checkNeedMoreParents = async (message) => {
  if (!message.parent_id) return false;
  
  // Check if parent message is in the store
  const parentMessage = store.getters['messages/getMessage'](message.parent_id);
  if (!parentMessage) return true;
  
  // Count how many ancestor messages we have in the cache
  let ancestorCount = 1; // Start with 1 for the direct parent
  let currentAncestor = parentMessage;
  
  while (currentAncestor.parent_id) {
    const nextAncestor = store.getters['messages/getMessage'](currentAncestor.parent_id);
    if (!nextAncestor) break;
    
    ancestorCount++;
    if (ancestorCount >= 5) break; // We have enough ancestors
    
    currentAncestor = nextAncestor;
  }
  
  // Need to load more if we have fewer than 5 ancestors (unless we're at the root)
  return ancestorCount < 5 && currentAncestor.parent_id;
};

// Helper function to check if we need to load more child messages
const checkNeedMoreChildren = async (message) => {
  if (!message.child_ids || message.child_ids.length === 0) return true;
  
  // Start with the branch child or the first child
  const branchChildId = message.branch_child || message.child_ids[0];
  const branchChild = store.getters['messages/getMessage'](branchChildId);
  if (!branchChild) return true;
  
  // Count how many descendant messages we have in the cache
  let descendantCount = 1; // Start with 1 for the direct child
  let currentDescendant = branchChild;
  
  while (currentDescendant.child_ids && currentDescendant.child_ids.length > 0) {
    const branchDescendantId = currentDescendant.branch_child || currentDescendant.child_ids[0];
    const nextDescendant = store.getters['messages/getMessage'](branchDescendantId);
    if (!nextDescendant) break;
    
    descendantCount++;
    if (descendantCount >= 5) break; // We have enough descendants
    
    currentDescendant = nextDescendant;
  }
  
  // Need to load more if we have fewer than 5 descendants (unless we're at a leaf)
  return descendantCount < 5 && currentDescendant.child_ids && currentDescendant.child_ids.length > 0;
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
        router.push('/messages');
      }
    }
    
    // Force an immediate UI refresh by checking displayedMessages
    await nextTick();
    if (displayedMessages.value.length === 0) {
      // If there are no more displayed messages, go back to thread list
      router.push('/messages');
    } else {
      // Refresh the thread or go back to thread list if root was deleted
      if (deletedParentId) {
        refreshThread();
      } else {
        router.push('/messages');
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

// Simplify the WebSocket subscription function with debouncing
const setupWebSocketSubscription = () => {
  // Clear any pending subscription setup
  if (websocketDebounceTimer.value) {
    clearTimeout(websocketDebounceTimer.value);
    websocketDebounceTimer.value = null;
  }
  
  // Debounce the setup
  websocketDebounceTimer.value = setTimeout(() => {
    // If we're already subscribed to this message, don't reconnect
    if (currentSubscribedMessageId.value === selectedMessageId.value) {
      console.log(`[ThreadView] Already subscribed to message ${selectedMessageId.value}`);
      return;
    }
    
    // Clean up any existing subscription
    if (unsubscribeMessages) {
      unsubscribeMessages();
      unsubscribeMessages = null;
    }
    
    // Disconnect any existing WebSocket
    WebSocketService.disconnectFromThread();
    
    // Only subscribe if a message is selected
    if (!selectedMessageId.value) {
      console.log(`[ThreadView] No selected message to subscribe to`);
      currentSubscribedMessageId.value = null;
      return;
    }
    
    console.log(`[ThreadView] Setting up WebSocket subscription for selected message ${selectedMessageId.value}`);
    
    // Create a unique view ID based on the thread and message (without timestamp)
    const threadViewId = `thread_${messageId.value}_msg_${selectedMessageId.value}`;
    
    // Register for message updates
    unsubscribeMessages = WebSocketService.handleNewMessage(handleWebSocketMessage);
    
    // Connect to thread with selected message as the subscription point
    WebSocketService.connectToThread(threadViewId, selectedMessageId.value)
      .then(() => {
        // Update current subscribed message ID on successful connection
        currentSubscribedMessageId.value = selectedMessageId.value;
      })
      .catch(error => {
        console.error('[ThreadView] WebSocket connection error:', error);
        currentSubscribedMessageId.value = null;
      });
  }, 300); // 300ms debounce
};

// Update WebSocket message handler to mark new incoming messages as read
const handleWebSocketMessage = async (messageData) => {
  console.log(`[WEBSOCKET] 📨 RECEIVED NEW MESSAGE: ID=${messageData.id}, PARENT=${messageData.parent_id}`);
  console.log(`[WEBSOCKET] MESSAGE CONTENT: "${messageData.content.substring(0, 50)}${messageData.content.length > 50 ? '...' : ''}"`);
  console.log(`[WEBSOCKET] FROM: ${messageData.author_display_name || messageData.author_user_tag || messageData.content_author}`);
  
  // Add the new message to store
  store.commit('messages/SET_MESSAGE', messageData);
  
  // Update the parent's child_ids using the dedicated mutation
  const parentId = messageData.parent_id;
  if (parentId) {
    // Use the new mutation instead of directly modifying the parent
    store.commit('messages/ADD_CHILD_TO_PARENT', {
      parentId,
      childId: messageData.id
    });
    
    // Set this as the branch child of its parent
    store.dispatch('messages/setBranchChild', {
      messageId: parentId,
      childId: messageData.id
    });
  }
  
  // Mark the new message as read if the current user is a recipient
  await markMessagesAsRead([messageData]);
  
  // Select the new message from WebSocket and wait for it to complete
  await store.dispatch('navigation/selectMessage', messageData.id);
  
  // Now that selection is complete, render the thread but preserve scroll position
  await renderThread(true);
  
  // If this is a response to the currently selected message, scroll to the new message
  // otherwise keep the current scroll position
  if (selectedMessageId.value === parentId) {
    nextTick(() => {
      const messageElement = document.querySelector(`[data-message-id="${messageData.id}"]`);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }
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

// Update loadMoreParents function to maintain scroll position relative to existing content
const loadMoreParents = async () => {
  isLoadingParents.value = true;
  try {
    // We need to find a reference message that's currently visible
    // to maintain its position after new content is loaded
    const messageNodes = document.querySelectorAll('.message-node');
    let referenceMessage = null;
    let referenceMessageRect = null;
    
    // Find the first message that's at least partially visible in the viewport
    if (messageNodes.length > 0) {
      const containerRect = messageList.value.getBoundingClientRect();
      
      for (const node of messageNodes) {
        const nodeRect = node.getBoundingClientRect();
        // Check if the node is at least partially visible in the container
        if (nodeRect.bottom > containerRect.top && nodeRect.top < containerRect.bottom) {
          referenceMessage = node;
          referenceMessageRect = nodeRect;
          // Store distance from top of viewport
          referenceMessage.dataset.distanceFromTop = nodeRect.top - containerRect.top;
          break;
        }
      }
      
      console.log(`[ThreadView] Found reference message: ${referenceMessage?.getAttribute('data-message-id')}`);
    }
    
    // Get first message before loading
    const firstMessageId = displayedMessages.value.length > 0 ? displayedMessages.value[0].id : null;
    
    // Load more messages
    const loadedMessages = await store.dispatch('messages/loadMessageBranchUp', {
      messageId: firstMessageId,
      depth: 5
    });
    
    // Mark loaded messages as read
    if (loadedMessages && loadedMessages.length > 0) {
      await markMessagesAsRead(loadedMessages);
    }
    
    // Render thread but preserve scroll position
    await renderThread(true);
    
    // After rendering, if we had a reference message, restore its relative position
    if (messageList.value && referenceMessage) {
      // Wait for DOM to settle
      await nextTick();
      
      // Find the same message element after re-rendering
      const messageId = referenceMessage.getAttribute('data-message-id');
      const newReferenceMessage = document.querySelector(`.message-node[data-message-id="${messageId}"]`);
      
      if (newReferenceMessage) {
        const containerRect = messageList.value.getBoundingClientRect();
        const newNodeRect = newReferenceMessage.getBoundingClientRect();
        const distanceFromTop = parseFloat(referenceMessage.dataset.distanceFromTop);
        
        // Calculate the new scroll position to maintain the same relative position
        const currentDistance = newNodeRect.top - containerRect.top;
        const adjustment = currentDistance - distanceFromTop;
        
        if (Math.abs(adjustment) > 5) { // Only adjust if difference is significant
          console.log(`[ThreadView] Adjusting scroll by ${adjustment}px to maintain position`);
          messageList.value.scrollTop += adjustment;
        }
      }
    }
  } finally {
    isLoadingParents.value = false;
  }
};

// Update loadMoreChildren function to mark messages as read
const loadMoreChildren = async () => {
  isLoadingChildren.value = true;
  try {
    // Capture current scroll position
    const scrollPosition = messageList.value ? messageList.value.scrollTop : 0;
    
    // Get last message before loading
    const lastMessageId = displayedMessages.value.length > 0 
      ? displayedMessages.value[displayedMessages.value.length - 1].id 
      : null;
    
    // Load more messages
    const loadedMessages = await store.dispatch('messages/loadMessageBranchDown', {
      messageId: lastMessageId,
      depth: 5
    });
    
    // Mark loaded messages as read
    if (loadedMessages && loadedMessages.length > 0) {
      await markMessagesAsRead(loadedMessages);
    }
    
    // Render thread but preserve scroll position
    await renderThread(true);
    
    // After rendering, restore scroll position - no adjustment needed for bottom loading
    if (messageList.value) {
      messageList.value.scrollTop = scrollPosition;
    }
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

// Add a watcher for selectedMessageId to update WebSocket subscription
watch(selectedMessageId, (newId, oldId) => {
  // Only update subscription if the ID actually changed
  if (newId !== oldId) {
    console.log(`[ThreadView] Selected message changed from ${oldId} to ${newId}, updating WebSocket subscription`);
    setupWebSocketSubscription();
  }
});

// Simplify the scrollToMessageId function to use the new approach
const scrollToMessageId = (targetMessageId) => {
  // Just mark that we've set up scrolling for this message
  hasInitiallyScrolled.value = true;
  
  // We'll defer to ensureCorrectScroll to handle the actual positioning
  ensureCorrectScroll();
};

// Add a new function to ensure the scroll position is correct after mounting
const ensureCorrectScroll = () => {
  // First attempt - check initial container state
  console.log('[ThreadView] INITIAL check of container dimensions:');
  if (messageList.value) {
    console.log({
      scrollHeight: messageList.value.scrollHeight,
      clientHeight: messageList.value.clientHeight,
      maxScroll: messageList.value.scrollHeight - messageList.value.clientHeight,
      childCount: messageList.value.children.length,
      childHeights: Array.from(messageList.value.children).map(child => ({
        tagName: child.tagName,
        height: child.offsetHeight,
        className: child.className
      }))
    });
  }
  
  // Add a small delay to make sure DOM is fully updated
  setTimeout(() => {
    nextTick(() => {
      // Make sure we have a message list and a selected message
      if (!messageList.value || !selectedMessageId.value) return;
      
      console.log('[ThreadView] Setting scroll position for message ID:', selectedMessageId.value);
      console.log('[ThreadView] Current scrollTop before adjustment:', messageList.value.scrollTop);
      
      // Check container dimensions again - they may have changed
      console.log('[ThreadView] Container dimensions BEFORE adjustment:');
      console.log({
        scrollHeight: messageList.value.scrollHeight,
        clientHeight: messageList.value.clientHeight,
        maxScroll: messageList.value.scrollHeight - messageList.value.clientHeight,
        currentScroll: messageList.value.scrollTop,
        style: window.getComputedStyle(messageList.value),
        overflowY: window.getComputedStyle(messageList.value).overflowY
      });
      
      // Find the selected message element
      const messageElement = document.querySelector(`[data-message-id="${selectedMessageId.value}"]`);
      if (!messageElement) {
        console.log(`[ThreadView] Could not find element with data-message-id="${selectedMessageId.value}"`);
        return;
      }
      
      // Log all messages to see if they are properly rendered
      const allMessages = document.querySelectorAll('.message-node');
      console.log(`[ThreadView] Found ${allMessages.length} total message nodes`);
      console.log('[ThreadView] All messages:', Array.from(allMessages).map((msg, i) => {
        const id = msg.getAttribute('data-message-id');
        return {
          index: i,
          id,
          isTarget: id == selectedMessageId.value,
          top: msg.getBoundingClientRect().top,
          offsetTop: msg.offsetTop
        };
      }));
      
      // Log detailed information about the elements and their positions
      const containerRect = messageList.value.getBoundingClientRect();
      const messageRect = messageElement.getBoundingClientRect();
      
      console.log('[ThreadView] Container dimensions:', {
        top: containerRect.top,
        height: containerRect.height,
        bottom: containerRect.bottom,
        scrollHeight: messageList.value.scrollHeight,
        clientHeight: messageList.value.clientHeight
      });
      
      console.log('[ThreadView] Message dimensions:', {
        top: messageRect.top,
        height: messageRect.height,
        bottom: messageRect.bottom,
        offsetTop: messageElement.offsetTop,
        offsetParent: messageElement.offsetParent ? messageElement.offsetParent.tagName : 'none'
      });
      
      // Calculate the relative top position of the message within the container
      const relativeTop = messageRect.top - containerRect.top + messageList.value.scrollTop;
      
      // Try an alternative calculation that might scroll further down
      const alternateTop = messageElement.offsetTop;
      
      console.log('[ThreadView] Calculated positions:', {
        relativeTop,
        alternateTop,
        difference: alternateTop - relativeTop
      });
      
      // Try scrolling to max first to force container to update its scrollHeight
      const maxScroll = messageList.value.scrollHeight - messageList.value.clientHeight;
      console.log(`[ThreadView] Max possible scroll: ${maxScroll}px`);
      messageList.value.scrollTop = maxScroll;
      
      // Check if scrollHeight updated after scrolling to max
      console.log('[ThreadView] Container dimensions AFTER scrolling to max:');
      console.log({
        scrollHeight: messageList.value.scrollHeight,
        clientHeight: messageList.value.clientHeight,
        maxScroll: messageList.value.scrollHeight - messageList.value.clientHeight,
        currentScroll: messageList.value.scrollTop
      });
      
      // Force browser to recalculate layout
      void messageList.value.offsetHeight;
      
      // Now try scrolling to our target
      const adjustedPosition = alternateTop - 70; // Adjust 20px up to show a bit more context
      console.log(`[ThreadView] Attempting to scroll to ${adjustedPosition}px (adjusted 20px up from ${alternateTop}px)`);
      messageList.value.scrollTop = adjustedPosition;
      
      // After setting, check what the actual scrollTop became
      // Sometimes browsers limit scroll positions
      console.log('[ThreadView] Final scrollTop after adjustment:', messageList.value.scrollTop);
      
      // Now that positioning is complete, show the content
      isPositioning.value = false;
    });
  }, 200); // Small delay to ensure DOM is fully rendered
};

// New helper function to mark messages as read
const markMessagesAsRead = async (messages) => {
  if (!messages || messages.length === 0 || !store.getters['auth/user']) {
    return; // No messages to mark or user not logged in
  }
  
  // Filter messages that are unread and the user is a recipient
  const messagesToMark = messages.filter(message => {
    // Check if message is unread
    const isUnread = message.is_read === false;
    
    // Check if current user is a recipient
    let isRecipient = false;
    const currentUser = store.getters['auth/user'];
    
    if (message.recipients && Array.isArray(message.recipients)) {
      isRecipient = message.recipients.some(recipient => {
        // Check by UID
        if (recipient.uid && currentUser.uid && recipient.uid === currentUser.uid) {
          return true;
        }
        
        // Check by user_tag
        if (recipient.user_tag && currentUser.user_tag && recipient.user_tag === currentUser.user_tag) {
          return true;
        }
        
        // Check by email for backward compatibility
        if (recipient.user_tag && currentUser.email && recipient.user_tag === currentUser.email) {
          return true;
        }
        
        return false;
      });
    }
    
    return isUnread && isRecipient;
  });
  
  // Mark each message as read
  for (const message of messagesToMark) {
    console.log(`[ThreadView] Marking message ${message.id} as read`);
    await store.dispatch('messages/markMessageAsRead', message.id);
  }
  
  if (messagesToMark.length > 0) {
    console.log(`[ThreadView] Marked ${messagesToMark.length} message(s) as read`);
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

/* Add positioning class to hide content until scroll position is set */
.thread-view.positioning .messages-container {
  visibility: hidden;
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

/* Styles for the scroll anchor - make it invisible */
.scroll-anchor {
  display: none;
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
  scroll-behavior: auto;
}

.auth-loading,
.loading-indicator,
.error-message,
.not-found {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: var(--color-text-secondary);
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
  border: 4px solid var(--color-border);
  border-top: 4px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 10px;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
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
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}
</style> 


