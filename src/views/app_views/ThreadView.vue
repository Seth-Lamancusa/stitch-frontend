<template>
  <div class="thread-view">
    <!-- Loading states -->
    <div v-if="!isAuthReady" class="auth-loading">
      <p>Loading...</p>
    </div>
    
    <div v-else-if="showLoadingState" class="loading-indicator">
      <div class="loading-spinner"></div>
      <span class="loading-text">Loading thread...</span>
    </div>
    
    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>
    
    <!-- Normal thread view - show when we have messages -->
    <template v-else-if="displayedMessages.length > 0">
      <!-- Thread header with navigation back and title -->
      <div class="thread-header">
        <button @click="backToList()" class="back-button">
          &larr; Back
        </button>
        <h2 class="thread-title">{{ threadTitle }}</h2>
      </div>
      
      <!-- Messages container with fixed spacing -->
      <div 
        class="messages-container" 
        ref="messageList" 
        @click="handleContainerClick"
        :style="{ visibility: isContainerVisible ? 'visible' : 'hidden' }"
      >
        <!-- Top of thread marker - only show after scroll is complete -->
        <adaptive-marker
          v-if="shouldShowMarkers"
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
          <message-node
            v-if="(message.id === replyingToMessageId && !isReplyMessageLoading || 
                    message.id !== replyingToMessageId)"
            :message="message"
            :displayMode="'full'"
            :selectable="false"
            :selected="false"
            :is-selected="message.id === replyingToMessageId"
            :indent-level="0"
            :loaded-replies="getLoadedRepliesCount(message.id)"
            :total-replies="getTotalRepliesCount(message.id)"
            :can-reply="canInteract"
            @click="handleMessageClick(message.id)"
            @reply="setReplyingTo(message.id)"
            @delete="confirmDeleteMessage"
            @showLinks="handleShowLinks"
          />
          
          <!-- Loading indicator for message being replied to -->
          <div v-if="message.id === replyingToMessageId && isReplyMessageLoading" class="message-loading">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading message...</div>
          </div>
        </template>
        
        <!-- Bottom of thread marker - only show after scroll is complete -->
        <adaptive-marker
          v-if="shouldShowMarkers"
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
        class="reply-box"
        :class="{ 'reply-box-hidden': !isReplying }"
      />
    </template>
    
    <div v-else class="not-found">
      Thread not found.
    </div>

    <!-- Global Notifications -->
    <GlobalNotifications />

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

    <!-- Links Modal -->
    <LinksModal
      :is-open="showLinksModal"
      :message="linksModalMessage"
      @close="closeLinksModal"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount, nextTick } from 'vue';
import { useStore } from 'vuex';
import { useRoute, useRouter } from 'vue-router';
import MessageNode from '../../components/MessageNode.vue';
import AdaptiveMarker from '../../components/AdaptiveMarker.vue';
import ReplyBox from '../../components/ReplyBox.vue';
import GlobalNotifications from '../../components/GlobalNotifications.vue';
import LinksModal from '../../components/LinksModal.vue';
import MessageService from '../../services/MessageService';
import WebSocketService from '../../services/WebSocketService';

// Setup store and routing
const store = useStore();
const route = useRoute();
const router = useRouter();

// Refs
const messageList = ref(null);
let unsubscribeMessages = null;
const isDeleting = ref(false);

// Links modal state
const showLinksModal = ref(false);
const linksModalMessage = ref(null);

// Consolidated loading state - single source of truth
const isLoadingThread = ref(false); // Main loading state for all thread operations
const isLoadingParents = ref(false); // Keep for incremental parent loading
const isLoadingChildren = ref(false); // Keep for incremental child loading

// Scroll anchor ref
const scrollAnchor = ref(null);
const hasInitiallyScrolled = ref(false);

// Add new refs for controlling visibility and marker attachment
const isContainerVisible = ref(false);
const shouldShowMarkers = ref(false);

// Message ID from route
const messageId = computed(() => {
  const id = route.params.id;
  // Return the ID as-is (can be numeric or alphanumeric)
  return id;
});

// Computed properties from namespaced store modules
const user = computed(() => store.getters['auth/user']);
const isAuthReady = computed(() => store.getters['auth/authReady']);
const canInteract = computed(() => store.getters['auth/canInteract']);
const error = computed(() => store.getters['ui/error']);
const showDeleteConfirm = computed(() => store.getters['ui/showDeleteConfirm']);
const messageToDelete = computed(() => store.getters['ui/messageToDelete']);

// Navigation state from namespaced navigation module
const replyingToMessageId = computed(() => store.getters['navigation/replyingToMessageId']);
const isReplyMessageLoading = computed(() => store.getters['navigation/isReplyMessageLoading']);
const replyTargetId = computed(() => store.getters['navigation/replyTargetId']);
const isReplying = computed(() => store.getters['navigation/isReplying']);

// Message display - only show messages when not loading
const displayedMessages = computed(() => {
  // Don't show any messages while loading thread
  if (isLoadingThread.value) return [];
  
  const msgs = store.getters['messages/getVisibleBranchMessages'](messageId.value);
  return msgs;
});

const rootMessage = computed(() => {
  if (displayedMessages.value.length === 0) return null;
  return displayedMessages.value[0];
});

const threadTitle = computed(() => {
  if (!rootMessage.value?.content) {
    return 'Untitled Thread';
  }
  
  const words = rootMessage.value.content.trim().split(/\s+/);
  if (words.length <= 3) {
    return rootMessage.value.content;
  }
  
  return words.slice(0, 4).join(' ') + '...';
});

// Check if we're at the top of the thread (first message has no parent)
const isTopOfThread = computed(() => {
  if (displayedMessages.value.length === 0) {
    return false;
  }
  
  const firstMessage = displayedMessages.value[0];
  return !firstMessage.parent_id;
});

// Simplified loading state for display logic
const showLoadingState = computed(() => {
  return !isAuthReady.value || isLoadingThread.value;
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

// Add new refs for scroll monitoring
const lastScrollPosition = ref(0);
const messageBeingRepliedToRect = ref(null);

// Track if we're switching branches (for clearing reply)
const lastBranchFirstMessageId = ref(null);

// Add ref for the reply box component
const replyBox = ref(null);

// Simplified marker states
const topMarkerState = computed(() => {
  // If no messages or loading thread, use end state
  if (displayedMessages.value.length === 0 || isLoadingThread.value) return 'end';
  
  // If currently loading parents, show loading state
  if (isLoadingParents.value) return 'loading';
  
  // Get first message in the branch
  const firstMessage = displayedMessages.value[0];
  
  // If first message doesn't have a parent_id at all, we're at the top
  if (!firstMessage.parent_id) {
    return 'end';
  }
  
  // Check if parent is already loaded in the store
  const parentMessage = store.getters['messages/getMessage'](firstMessage.parent_id);
  
  // If parent_id exists but parent message isn't in store, we need to load more (waiting state)
  return parentMessage ? 'end' : 'waiting';
});

// Simplified thread rendering function - used for incremental updates
const renderThread = async (preserveScroll = false, preserveBranchPath = true) => {
  try {
    console.log(`[ThreadView] ⭐️ RENDER THREAD called for messageId: ${messageId.value} (preserveScroll: ${preserveScroll}, preserveBranchPath: ${preserveBranchPath})`);
    
    // Guard against missing messageId
    if (!messageId.value) {
      console.log(`[ThreadView] No messageId to render`);
      return;
    }
    
    // Prepare branch paths - but only if not asked to preserve existing branch path
    if (!preserveBranchPath) {
      console.log(`[ThreadView] 🛑 Calling prepareBranchPath with messageId: ${messageId.value}`);
      await store.dispatch('messages/prepareBranchPath', messageId.value);
    }
    
    // Get displayed messages
    const messages = displayedMessages.value;
    console.log(`[ThreadView] Thread rendered with ${messages.length} messages, first message: ${messages.length > 0 ? messages[0].id : 'none'}`);
    
    // For incremental updates (preserveScroll = true), ensure container remains visible
    if (preserveScroll && !isContainerVisible.value) {
      isContainerVisible.value = true;
      shouldShowMarkers.value = true;
    }
    
    // Scroll to center the message ID from the URL if messages exist and not preserving scroll
    if (messages.length > 0 && !preserveScroll) {
      await nextTick();
      ensureCorrectScroll();
    }
  } catch (error) {
    console.error(`[ThreadView] Error in renderThread:`, error);
  }
};

const bottomMarkerState = computed(() => {
  // If no messages or loading thread, use end state
  if (displayedMessages.value.length === 0 || isLoadingThread.value) return 'end';
  
  // If currently loading children, show loading state
  if (isLoadingChildren.value) return 'loading';
  
  // Get last message in the branch
  const lastMessage = displayedMessages.value[displayedMessages.value.length - 1];
  
  // If it has no children at all, we're at the bottom
  if (!lastMessage.child_ids || lastMessage.child_ids.length === 0) {
    return 'end';
  }
  
  // Check if any child isn't loaded yet
  const unloadedChildExists = lastMessage.child_ids.some(childId => 
    !store.getters['messages/getMessage'](childId)
  );
  
  // If any child_id exists but isn't in store, we need to load more (waiting state)
  return unloadedChildExists ? 'waiting' : 'end';
});

// Lifecycle hooks
onMounted(async () => {
  console.log(`[ThreadView] 🔧 MOUNT onMounted starting with messageId: ${messageId.value}`);
  
  // Wait for auth to be ready before proceeding - auth store handles initialization
  if (!isAuthReady.value) {
    console.log(`[ThreadView] 🔧 MOUNT Auth not ready, waiting...`);
    await new Promise((resolve) => {
      const unwatch = store.watch(
        () => store.getters['auth/authReady'],
        (newValue) => {
          if (newValue) {
            console.log(`[ThreadView] 🔧 MOUNT Auth ready now`);
            unwatch();
            resolve();
          }
        }
      );
    });
  }
  
  // Use loadInitialContent for initial thread loading
  if (messageId.value) {
    console.log(`[ThreadView] 🔧 MOUNT Calling loadInitialContent for messageId: ${messageId.value}`);
    await loadInitialContent(messageId.value);
    
    // After initial content is loaded and rendered, ensure correct scroll position
    console.log(`[ThreadView] 🔧 MOUNT loadInitialContent complete, ensuring correct scroll position`);
    ensureCorrectScroll();
  }
  
  // Add scroll event listener for reply box management
  if (messageList.value) {
    messageList.value.addEventListener('scroll', handleScroll);
  }
  
  console.log(`[ThreadView] 🔧 MOUNT onMounted complete`);
});

onBeforeUnmount(() => {
  // Clean up listeners
  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }
  
  // Clear message selection when leaving the thread view
  store.dispatch('navigation/clearReplyingTo');
  
  // Keep message cache when leaving thread view
  
  // Clean up any pending timer
  if (websocketDebounceTimer.value) {
    clearTimeout(websocketDebounceTimer.value);
    websocketDebounceTimer.value = null;
  }
  
  // Remove scroll event listener
  if (messageList.value) {
    messageList.value.removeEventListener('scroll', handleScroll);
  }
  
  // Clear replying message when leaving the thread view
  store.dispatch('navigation/clearReplyingTo');
});

// Watch for route changes - use loadInitialContent for new thread IDs
watch(messageId, async (newId, oldId) => {
  console.log(`[ThreadView] 👀 WATCH messageId changed from ${oldId} to ${newId}, triggered by:`, new Error().stack);
  if (newId) {
    // Reset visibility states immediately when navigating to new thread
    isContainerVisible.value = false;
    shouldShowMarkers.value = false;
    await loadInitialContent(newId);
  }
});

// Watch for message changes to ensure reply settings are always in sync
watch(replyingToMessageId, () => {
  // Remove call to syncReplySettingsWithSelectedMessage since it's now automatic
  // Settings are synced automatically when selecting a message
}, { immediate: true });

// Watch for new messages added to the store
watch(() => store.state.messages.messages, (newMessages, oldMessages) => {
  // Skip if there aren't any displayed messages or we're not on a thread
  if (!displayedMessages.value.length || !messageId.value) return;
  
  // Find keys of new messages that weren't in the old messages
  const newKeys = Object.keys(newMessages).filter(
    key => !oldMessages[key] && !isNaN(Number(key))
  );
  
  if (newKeys.length === 0) return;
  
  console.log(`[ThreadView] New messages detected, checking relevance to current thread: ${newKeys.join(', ')}`);
  
  // Check if any new message is a reply to a message in our current branch
  const branchMessageIds = displayedMessages.value.map(m => m.id);
  
  console.log(`[ThreadView] Current branch messages: ${branchMessageIds.join(', ')}`);
  
  let needsRender = false;
  let newRelevantMessage = null;
  
  for (const key of newKeys) {
    const newMessage = newMessages[key];
    
    // Log detailed information about the new message
    console.log(`[ThreadView] Examining new message ${key}:`, {
      parentId: newMessage.parent_id,
      isParentInBranch: newMessage.parent_id && branchMessageIds.includes(newMessage.parent_id)
    });
    
    // Check if the message is a reply to any message in our branch
    if (newMessage.parent_id && branchMessageIds.includes(newMessage.parent_id)) {
      console.log(`[ThreadView] New message ${key} is a reply to message ${newMessage.parent_id} in our branch`);
      
      // Always re-render if message belongs to our thread
      needsRender = true;
      newRelevantMessage = newMessage;
      break; // Found a relevant message, no need to check others
    }
  }
  
  // Re-render the thread if needed, preserving scroll position but NOT branch path
  if (needsRender && newRelevantMessage) {
    console.log(`[ThreadView] Re-rendering thread to include new message:`, {
      messageId: newRelevantMessage.id,
      parentId: newRelevantMessage.parent_id
    });
    
    // Log the branch path before rendering
    console.log(`[ThreadView] Current branch path before rendering:`, 
      store.state.messages.branchPath || 'No branch path set');
    
    // Re-render the thread with the new message, preserving scroll but NOT branch path
    // This ensures the new message is properly incorporated into the thread
    renderThread(true, false).then(() => {
      // After rendering, check if the new message is now visible
      const newDisplayedIds = displayedMessages.value.map(m => m.id);
      console.log(`[ThreadView] After rendering, displayed messages:`, newDisplayedIds);
      console.log(`[ThreadView] Is new message visible:`, 
        newDisplayedIds.includes(newRelevantMessage.id));
    });
  }
}, { deep: true });

// Navigation
const backToList = async () => {
  // Get the previous route
  const prevRoute = store.getters['navigation/previousRoute'];
  
  console.log(`[ThreadView] Back button clicked - previous route: "${prevRoute}", using: "${prevRoute || '/inbox'}"`);
  
  // Navigate back to the previous route - keep cache for faster return
  router.push(prevRoute || '/inbox'); // Fallback to inbox if no previous route
};

const loadInitialContent = async (targetMessageId) => {
  if (!targetMessageId) {
    console.error('[ThreadView] Cannot load initial content: No target message ID provided');
    return;
  }
  
  try {
    // Hide container and markers immediately at start of loading
    isContainerVisible.value = false;
    shouldShowMarkers.value = false;
    
    // Set single loading state
    isLoadingThread.value = true;
    hasInitiallyScrolled.value = false;
    
    console.log(`[ThreadView] 🔄 INITIAL LOAD starting for message ID: ${targetMessageId}`);
    
    // Load radius around the target message - this handles everything in one go
    await store.dispatch('messages/loadMessageRadius', {
      messageId: targetMessageId,
      radius: 5
    });

    // Prepare branch path for rendering
    console.log(`[ThreadView] 🔄 INITIAL LOAD calling prepareBranchPath with message ID: ${targetMessageId}`);
    await store.dispatch('messages/prepareBranchPath', targetMessageId);
    
    console.log(`[ThreadView] 🔄 INITIAL LOAD complete, will render ${store.getters['messages/getVisibleBranchMessages'](targetMessageId).length} messages`);
    
    // Wait for next tick to ensure store updates are processed
    await nextTick();
    
  } catch (error) {
    console.error('[ThreadView] Error loading initial content:', error);
    store.commit('ui/SET_ERROR', 'Failed to load thread.');
    // Show container even on error so user can see the error state
    isContainerVisible.value = true;
  } finally {
    // Clear loading state - this will trigger displayedMessages to show content
    isLoadingThread.value = false;
    
    // Handle scroll positioning after content is rendered
    await nextTick();
    ensureCorrectScroll();
  }
};

// Message selection and reply
const handleMessageClick = (id) => {
  // If clicking the same message that's already being replied to, do nothing
  if (id === replyingToMessageId.value) return;
  
  // Otherwise, set as the message being replied to
  setReplyingTo(id);
};

// Set message for replying
const setReplyingTo = async (id) => {
  // If we were already replying to the same message, do nothing
  if (id === replyingToMessageId.value && isReplying.value) return;
  
  // Set the message as the one being replied to
  await store.dispatch('navigation/setReplyingTo', id);
  
  // Focus the reply box after setting up
  nextTick(() => {
    if (replyBox.value) {
      replyBox.value.focus();
    }
    
    // Store the position of the message being replied to for scroll tracking
    // but don't scroll to it
    updateReplyingToMessagePosition();
  });
};

// Update position info for the message being replied to
const updateReplyingToMessagePosition = () => {
  if (!replyingToMessageId.value) {
    messageBeingRepliedToRect.value = null;
    return;
  }
  
  // Find the message element
  const messageElement = document.querySelector(`[data-message-id="${replyingToMessageId.value}"]`);
  if (messageElement) {
    messageBeingRepliedToRect.value = messageElement.getBoundingClientRect();
  }
};

// Add scroll tracking to hide reply box when scrolled too far
const handleScroll = () => {
  if (!messageList.value || !replyingToMessageId.value) return;
  
  // Get current scroll position
  const currentScrollPosition = messageList.value.scrollTop;
  
  // Update the position of the message being replied to
  updateReplyingToMessagePosition();
  
  // Only proceed if we have a valid message rect
  if (!messageBeingRepliedToRect.value) {
    // Store current position for next comparison
    lastScrollPosition.value = currentScrollPosition;
    return;
  }
  
  // Get viewport dimensions
  const containerRect = messageList.value.getBoundingClientRect();
  const messageRect = messageBeingRepliedToRect.value;
  
  // Calculate distance from viewport
  const distanceFromTop = messageRect.bottom - containerRect.top;
  const distanceFromBottom = containerRect.bottom - messageRect.top;
  
  // Hide reply box when message is too far away in either direction
  if (distanceFromTop < -2400 || distanceFromBottom < -600) {
    console.log('Message scrolled too far away, hiding reply box');
    store.dispatch('navigation/clearReplyingTo');
  }
  
  // Store this position for comparison
  lastScrollPosition.value = currentScrollPosition;
};

// Check if branch has changed and clear replying if so
const checkBranchChange = () => {
  if (!displayedMessages.value || displayedMessages.value.length === 0) return;
  
  const currentFirstMessageId = displayedMessages.value[0]?.id;
  
  // If first message in branch changed, we've switched branches
  if (lastBranchFirstMessageId.value && 
      currentFirstMessageId && 
      lastBranchFirstMessageId.value !== currentFirstMessageId) {
    // Clear replying state when branch changes
    store.dispatch('navigation/clearReplyingTo');
  }
  
  // Update first message ID
  lastBranchFirstMessageId.value = currentFirstMessageId;
};
  
// Watch for branch changes
watch(displayedMessages, () => {
  checkBranchChange();
}, { deep: true });

// Watch for direct message refresh trigger (for sent messages)
watch(() => store.state.messages.directMessagesLastUpdated, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    console.log(`[ThreadView] Direct messages refresh triggered, re-rendering thread`);
    renderThread(true, true);
  }
});

// Simplified scroll positioning function
const ensureCorrectScroll = () => {
  // Mark that we've handled initial scrolling
  hasInitiallyScrolled.value = true;
  
  nextTick(() => {
    // For initial load, only use the message from the URL
    const targetId = messageId.value;
    
    // Make sure we have a message list and a target message
    if (!messageList.value || !targetId) {
      // Show container even if we can't scroll
      isContainerVisible.value = true;
      shouldShowMarkers.value = true;
      return;
    }
    
    // Find the target message element
    const messageElement = document.querySelector(`[data-message-id="${targetId}"]`);
    if (!messageElement) {
      console.log(`[ThreadView] Could not find element with data-message-id="${targetId}"`);
      // Show container even if we can't find the target message
      isContainerVisible.value = true;
      shouldShowMarkers.value = true;
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
        isTarget: id == targetId,
        top: msg.getBoundingClientRect().top,
        offsetTop: msg.offsetTop
      };
    }));
    
    // Log detailed information about the elements and their positions
    const containerRect = messageList.value.getBoundingClientRect();
    const messageRect = messageElement.getBoundingClientRect();
    
    // Calculate the relative top position of the message within the container
    const relativeTop = messageRect.top - containerRect.top + messageList.value.scrollTop;
    
    // Try an alternative calculation that might scroll further down
    const alternateTop = messageElement.offsetTop;
    
    // Try scrolling to max first to force container to update its scrollHeight
    const maxScroll = messageList.value.scrollHeight - messageList.value.clientHeight;
    messageList.value.scrollTop = maxScroll;
    
    // Force browser to recalculate layout
    void messageList.value.offsetHeight;
    
    // Now try scrolling to our target
    const adjustedPosition = alternateTop - 70; // Adjust 70px up to show a bit more context
    messageList.value.scrollTop = adjustedPosition;
    
    console.log(`[ThreadView] Scroll complete, showing container and attaching markers`);
    
    // Show the container and attach markers after scroll is complete
    isContainerVisible.value = true;
    shouldShowMarkers.value = true;
  });
};

// Handle container click to clear replying if clicked outside of messages
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
  if (!isMessageNode && replyingToMessageId.value) {
    store.dispatch('navigation/clearReplyingTo');
  }
};

const confirmDeleteMessage = (message) => {
  store.dispatch('ui/showDeleteConfirm', message);
};

const handleShowLinks = (message) => {
  linksModalMessage.value = message;
  showLinksModal.value = true;
};

const closeLinksModal = () => {
  showLinksModal.value = false;
  linksModalMessage.value = null;
};

const deleteMessage = async () => {
  if (!messageToDelete.value || isDeleting.value) return;
  
  const deletedId = messageToDelete.value.id;
  
  try {
    // Set deleting state to true
    isDeleting.value = true;
    
    await store.dispatch('messages/deleteMessage', deletedId);
    
    // Get the previous route to return to
    const prevRoute = store.getters['navigation/previousRoute'];
    const defaultRoute = '/inbox'; // Default to inbox if no previous route
    
    console.log(`[ThreadView] Delete navigation - previous route: "${prevRoute}", using: "${prevRoute || defaultRoute}"`);
    
    // Always redirect out after deletion
    router.push(prevRoute || defaultRoute);
    
    // Hide confirmation modal after successful deletion
    store.commit('ui/SET_DELETE_CONFIRM', { show: false, message: null });
  } catch (error) {
    console.error('Error deleting message:', error);
    
    // Provide specific error message for cascade delete scenarios
    let errorMessage = 'Failed to delete message';
    
    if (error.response?.status === 404) {
      errorMessage = 'This message has already been deleted (likely when its parent was deleted)';
      // Hide confirmation modal and navigate away since the message is already gone
      store.commit('ui/SET_DELETE_CONFIRM', { show: false, message: null });
      
      // Navigate back since the current thread no longer exists
      const prevRoute = store.getters['navigation/previousRoute'];
      const defaultRoute = '/feed';
      
      console.log(`[ThreadView] Error navigation - previous route: "${prevRoute}", using: "${prevRoute || defaultRoute}"`);
      
      router.push(prevRoute || defaultRoute);
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
    
    // Render thread but preserve scroll position AND branch path
    await renderThread(true, true);
    
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
    await store.dispatch('messages/loadMessageBranchDown', {
      messageId: lastMessageId,
      depth: 5
    });
    
    
    // Render thread but preserve scroll position AND branch path
    await renderThread(true, true);
    
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
</script>

<style scoped>
.thread-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
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
  padding-bottom: 100px; /* Add space at bottom for the reply box */
  gap: 20px; /* Consistent gap between elements */
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  justify-content: flex-start;
  scroll-behavior: auto;
}

/* Media query for mobile responsiveness */
@media (max-width: 768px) {
  .messages-container {
    padding-left: 16px;
    padding-right: 16px;
    padding-bottom: 120px; /* More space for the reply box on mobile */
  }
  
  .thread-header {
    padding: var(--space-xs) var(--space-sm);
  }
  
  .thread-title {
    font-size: var(--font-size-md);
  }
}

.auth-loading,
.loading-indicator,
.error-message,
.not-found {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: var(--color-text-secondary);
  text-align: center;
  gap: var(--space-sm);
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

/* Update reply box styles to add animation */
.reply-box {
  transition: transform 0.3s ease-out;
  transform: translateY(0);
}

.reply-box-hidden {
  transform: translateY(100%);
}

/* Update the reply-box-container positioning to overlay on the messages */
.reply-box-container {
  position: fixed;
  bottom: 20px;
  left: 0;
  right: 0;
  z-index: 10;
  padding: 0 40px; /* Add horizontal padding to match the design */
}

@media (max-width: 768px) {
  .reply-box-container {
    padding: 0 16px; /* Reduce padding on mobile */
    bottom: 10px; /* Position slightly higher on mobile */
    z-index: 10; /* Lower than the header controls (z-index 50) */
  }
  
  /* Make the reply box take up more width on mobile */
  .reply-box {
    width: 100%;
  }
}
</style> 


