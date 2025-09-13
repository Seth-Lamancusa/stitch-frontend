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
        
        <!-- Graph view toggle -->
        <!-- <button @click="openGraphView" class="graph-view-button" title="Switch to graph view">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h4.5a1 1 0 0 0 .5-.5v-7a.5.5 0 0 0-.5-.5H1zm7 0a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h4.5a1 1 0 0 0 .5-.5v-7a.5.5 0 0 0-.5-.5H8zm-7 1h3v6H1V4zm7 0h3v6H8V4z"/>
            <circle cx="3" cy="6" r="1"/>
            <circle cx="10" cy="6" r="1"/>
            <circle cx="6.5" cy="8" r="1"/>
            <path d="M4 6h2.5M9 6h1.5"/>
          </svg>
          Graph View
        </button> -->
        
        <!-- Selection mode controls -->
        <div v-if="isSelectionMode" class="selection-controls">
          <span class="selection-count">{{ selectedMessageCount }} message{{ selectedMessageCount === 1 ? '' : 's' }} selected</span>
          <button @click="copySelectedMessages" class="copy-button" :disabled="selectedMessageCount === 0" :class="{ 'copied': isCopied }">
            <span class="copy-icon">{{ isCopied ? '✓' : '📝' }}</span>
            {{ isCopied ? 'Copied!' : 'Copy' }}
          </button>
          <button @click="exitSelectionMode" class="exit-selection-button" title="Exit selection mode">
            ×
          </button>
        </div>
        
        <!-- Login button -->
        <div v-else class="user-controls">
          <div class="user-info">
            <div class="username-container" @click="openProfileModal" v-if="user">
              <span class="username">{{ userDisplayName }}</span>
              <span v-if="userTag" class="user-tag">@{{ userTag }}</span>
              <span class="edit-icon" title="Edit profile">✎</span>
            </div>
            <span v-else class="username">Guest</span>

            <!-- Auth status badges -->
            <span v-if="isAdmin" class="admin-badge" title="Admin">⛊</span>
            <span v-if="!user" class="guest-badge" title="Not logged in">?</span>
          </div>
          <button v-if="user" @click="logout" class="logout-btn">Logout</button>
          <LoginButton v-else />
        </div>
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
            :selectable="true"
            :selected="isMessageSelected(message.id)"
            :is-selected="message.id === replyingToMessageId"
            :indent-level="0"
            :loaded-replies="getLoadedRepliesCount(message.id)"
            :total-replies="getTotalRepliesCount(message.id)"
            :can-reply="canInteract"
            @reply="setReplyingTo(message.id)"
            @delete="confirmDeleteMessage"
            @showLinks="handleShowLinks"
            @center="handleCenterOnMessage"
            @selectionToggled="handleMessageSelection"
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
        v-if="!isSelectionMode"
        :target-id="replyTargetId"
        :can-interact="canInteract && !!replyTargetId"
        :is-message-selected="!!replyTargetId"
        :is-authenticated="!!user"
        @open-profile="openProfileModal"
        ref="replyBox"
        class="reply-box"
        :class="{ 'reply-box-hidden': !isReplying }"
      />
    </template>
    
    <div v-else class="not-found">
      Message not found.
    </div>

    <!-- Global Notifications -->
    <GlobalNotifications />

    <!-- Delete Confirmation Modal -->
    <DeleteConfirmModal 
      :show="showDeleteConfirm"
      :message="messageToDelete"
      :is-deleting="isDeleting"
      :relation="deleteRelation"
      :disallow-confirm="false"
      :disallow-reason="centeredDeletionHint"
      @cancel="store.dispatch('ui/hideDeleteConfirm')"
      @confirm="deleteMessage"
    />

    <!-- Links Modal -->
    <LinksModal
      :is-open="showLinksModal"
      :message="linksModalMessage"
      @close="closeLinksModal"
    />

    <!-- Global Recipients Modal -->
    <RecipientsModal
      ref="recipientsModalRef"
      :is-visible="recipientsModalVisible"
      :is-public="recipientsModalIsPublic"
      :is-add-mode="recipientsModalIsAddMode"
      :existing-recipients="recipientsModalExistingRecipients"
      :message-id="recipientsModalMessageId"
      @close="closeRecipientsModal"
      @done="closeRecipientsModal"
      @add-recipients="handleAddRecipients"
      @recipient-removed="handleRecipientRemoved"
    />

    <!-- Profile Edit Modal -->
    <ProfileEditModal 
      :isOpen="isProfileModalOpen" 
      @close="closeProfileModal" 
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount, nextTick } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute } from 'vue-router';
import MessageNode from '../../components/MessageNode.vue';
import AdaptiveMarker from '../../components/AdaptiveMarker.vue';
import ReplyBox from '../../components/ReplyBox.vue';
import GlobalNotifications from '../../components/GlobalNotifications.vue';
import MessageService from '../../services/MessageService.js';
import LinksModal from '../../components/modals/LinksModal.vue';
import RecipientsModal from '../../components/modals/RecipientsModal.vue';
import DeleteConfirmModal from '../../components/modals/DeleteConfirmModal.vue';
import ProfileEditModal from '../../components/modals/ProfileEditModal.vue';
import { useAuthentication } from '../../composables/useAuthentication';
import LoginButton from '@buttons/LoginButton.vue'
import { dismissMobileKeyboard } from '../../utils/mobileKeyboard.js';

// Setup store and routing
const store = useStore();
const router = useRouter();
const route = useRoute();
const { signInWithGoogle, logout } = useAuthentication();

// Add login state
const isLoggingIn = ref(false);
const isProfileModalOpen = ref(false);

// Refs
const messageList = ref(null);
let unsubscribeMessages = null;
const isDeleting = ref(false);
const recipientsModalRef = ref(null);

// Links modal state
const showLinksModal = ref(false);
const linksModalMessage = ref(null);

// Copy button state
const isCopied = ref(false);

// Consolidated loading state - single source of truth
const isLoadingThread = ref(true); // Main loading state for all thread operations
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
const isAdmin = computed(() => store.getters['auth/isAdmin']);

// User display properties
const userDisplayName = computed(() => {
  if (!user.value) return 'Guest';
  return user.value.displayName || user.value.email || 'Unknown User';
});

const userTag = computed(() => {
  if (!user.value) return null;
  return user.value.user_tag || null;
});

const error = computed(() => store.getters['ui/error']);
const showDeleteConfirm = computed(() => store.getters['ui/showDeleteConfirm']);
const messageToDelete = computed(() => store.getters['ui/messageToDelete']);

// Navigation state from namespaced navigation module
const replyingToMessageId = computed(() => store.getters['navigation/replyingToMessageId']);
const isReplyMessageLoading = computed(() => store.getters['navigation/isReplyMessageLoading']);
const replyTargetId = computed(() => store.getters['navigation/replyTargetId']);
const isReplying = computed(() => store.getters['navigation/isReplying']);

// Compute relation of the message being deleted to the centered message in URL
const deleteRelation = computed(() => {
  const centeredId = messageId.value;
  const toDelete = messageToDelete.value;
  if (!centeredId || !toDelete) return null;

  // Find positions within current displayed branch
  const messages = displayedMessages.value || [];
  const centeredIndex = messages.findIndex(m => String(m.id) === String(centeredId));
  const deleteIndex = messages.findIndex(m => String(m.id) === String(toDelete.id));
  if (centeredIndex === -1 || deleteIndex === -1) return null;

  // Report relation of the centered message relative to the one being deleted
  if (centeredIndex < deleteIndex) return 'above';
  if (centeredIndex > deleteIndex) return 'below';
  return null; // equal means same message (UI prevents deletion)
});

// Disallow confirm if attempting to delete centered message
const isCenteredDeletion = computed(() => {
  const centeredId = messageId.value;
  const toDelete = messageToDelete.value;
  if (!centeredId || !toDelete) return false;
  return String(centeredId) === String(toDelete.id);
});

const centeredDeletionReason = computed(() => {
  return isCenteredDeletion.value
    ? 'You cannot delete the currently centered message. Center a different message first.'
    : '';
});

// New: friendly hint when deleting the centered message
const centeredDeletionHint = computed(() => {
  return isCenteredDeletion.value
    ? 'Hint: Deleting the message you are viewing will close this thread and return you to your previous view.'
    : '';
});

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

// Selection mode computed properties
const isSelectionMode = computed(() => store.getters['navigation/isSelectionMode']);
const selectedMessageIds = computed(() => store.getters['navigation/selectedMessageIds']);
const selectedMessageCount = computed(() => store.getters['navigation/selectedMessageCount']);
const isMessageSelected = computed(() => (messageId) => store.getters['navigation/isMessageSelected'](messageId));

// Recipients modal computed properties
const recipientsModalVisible = computed(() => store.getters['navigation/recipientsModalVisible']);
const recipientsModalIsPublic = computed(() => store.getters['navigation/recipientsModalIsPublic']);
const recipientsModalIsAddMode = computed(() => store.getters['navigation/recipientsModalIsAddMode']);
const recipientsModalExistingRecipients = computed(() => store.getters['navigation/recipientsModalExistingRecipients']);
const recipientsModalMessageId = computed(() => store.getters['navigation/recipientsModalMessageId']);

// In the script setup section, add refs for the adaptive markers
const topMarker = ref(null);
const bottomMarker = ref(null);

// Add this near the top of the script, with the other refs
const lastWebSocketSetupTime = ref(0);
const webSocketDebounceTime = 1000; // 1 second debounce

// In the script setup section, add a debounce timer
const websocketDebounceTimer = ref(null);
const currentSubscribedMessageId = ref(null);

// When true, a route param change should not trigger a full reload
const suppressRouteReload = ref(false);

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

// Add a new helper function to wait for content rendering
const waitForContentRendering = async () => {
  // Wait for next tick to ensure Vue updates
  await nextTick();
  
  // Find all FormattedContent components in the thread
  const formattedContents = document.querySelectorAll('.formatted-content');
  
  // If no formatted content, return immediately
  if (!formattedContents.length) return;
  
  // Wait a small amount of time for any async formatters to complete
  // This includes time for markdown, LaTeX, and code highlighting to finish
  await new Promise(resolve => setTimeout(resolve, 50));
};

const ensureCorrectScroll = async () => {
  // Mark that we've handled initial scrolling
  hasInitiallyScrolled.value = true;
  
  // Wait for formatted content to finish rendering
  await waitForContentRendering();
  
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
    
    // Show container even if we can't find the target message
    isContainerVisible.value = true;
    shouldShowMarkers.value = true;
    return;
  }
  
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
  
  
  
  // Show the container and attach markers after scroll is complete
  isContainerVisible.value = true;
  shouldShowMarkers.value = true;
};

// Simplified thread rendering function - used for incremental updates
const renderThread = async (preserveScroll = false, preserveBranchPath = true) => {
  try {
    
    
    // Guard against missing messageId
    if (!messageId.value) {
      
      return;
    }
    
    // Prepare branch paths - but only if not asked to preserve existing branch path
    if (!preserveBranchPath) {
      
      await store.dispatch('messages/prepareBranchPath', messageId.value);
    }
    
    // Get displayed messages
    const messages = displayedMessages.value;
    
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
  
  
  // Enable thread view mode for auto-marking messages as read
  store.commit('messages/SET_THREAD_VIEW_MODE', true);
  
  // Add reload detection
  window.addEventListener('beforeunload', () => {
    
  });
  
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
  
  // Add scroll event listener for reply box management
  if (messageList.value) {
    messageList.value.addEventListener('scroll', handleScroll);
  }
  
  // Note: WebSocket callback is handled globally by WebSocketService.initialize()
  // No need to register a component-specific callback here
  
  
  
  // No whitelist rejection state anymore
});

onBeforeUnmount(() => {
  // Disable thread view mode to stop auto-marking
  store.commit('messages/SET_THREAD_VIEW_MODE', false);
  
  // Clean up listeners
  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }
  
  // Clear message selection when leaving the thread view
  store.dispatch('navigation/clearReplyingTo');
  
  // Clear any open action bars when leaving the thread view
  store.dispatch('navigation/closeActiveActionBar');
  
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
  if (newId) {
    // Handle shallow updates where we only want to update the URL/scroll
    if (suppressRouteReload.value) {
      suppressRouteReload.value = false;
      // Keep existing content; do not adjust scroll on shallow URL updates
      return;
    }
    // Clear selection mode when navigating to a new thread
    if (isSelectionMode.value) {
      store.dispatch('navigation/exitSelectionMode');
    }
    
    // Reset visibility states immediately when navigating to new thread
    isContainerVisible.value = false;
    shouldShowMarkers.value = false;
    await loadInitialContent(newId);
  }
});

// Watch for branch changes (sibling navigation) - removed selection mode clearing to preserve selections
// when navigating up/down branches
watch(() => displayedMessages.value.length > 0 ? displayedMessages.value[0].id : null, (newFirstMessageId, oldFirstMessageId) => {
  
  if (newFirstMessageId && oldFirstMessageId && newFirstMessageId !== oldFirstMessageId) {
    // Branch changed (sibling navigation) - no longer clearing selection mode
    
    
    // Auto-mark newly visible branch as read after sibling navigation
    
    store.dispatch('messages/markVisibleBranchAsRead', newFirstMessageId);
  } else {
    
  }
});

// Watch for login while on this view to hydrate read state and auto-mark only unread
watch(() => store.getters['auth/user'], async (newUser, oldUser) => {
  // Detect transition from guest -> logged-in
  if (!oldUser && newUser && messageId.value) {
    try {
      

      // Reload current thread radius to hydrate user-specific fields (e.g., is_read, recipients)
      await store.dispatch('messages/loadMessageRadius', {
        messageId: messageId.value,
        radius: 5
      });

      // Re-prepare branch path in case branch_child needs adjustment
      await store.dispatch('messages/prepareBranchPath', messageId.value);

      // Re-render without changing scroll or branch path
      await nextTick();
      await renderThread(true, true);

      // Auto-mark only the unread messages in the visible branch
      store.dispatch('messages/markVisibleBranchAsRead', messageId.value);
    } catch (e) {
      console.error('[ThreadView] Error hydrating after login:', e);
    }
  }
});

// Watch for message changes to ensure reply settings are always in sync
watch(replyingToMessageId, () => {
  // Remove call to syncReplySettingsWithSelectedMessage since it's now automatic
  // Settings are synced automatically when selecting a message
}, { immediate: true });

// No whitelist rejection watcher anymore

// Navigation
const backToList = async () => {
  // Get the previous route
  const prevRoute = store.getters['navigation/previousRoute'];
  
  
  // Navigate back to the previous route - keep cache for faster return
  router.push(prevRoute || '/inbox'); // Fallback to inbox if no previous route
};

const openGraphView = () => {
  const currentMessageId = messageId.value;
  if (!currentMessageId) return;
  // Use named route with correct param name to avoid path mismatches
  router.push({ name: 'graph-view', params: { messageId: currentMessageId } });
};

// Shallowly center on a different message by updating the URL without reloading content
// Usage: centerOnMessageInUrl('newMessageId') or centerOnMessageInUrl('newMessageId', { replace: true })
const centerOnMessageInUrl = async (newMessageId, options = { replace: true }) => {
  if (!newMessageId || newMessageId === messageId.value) return;
  // Only update URL; do not trigger scroll in shallow mode per requirement
  suppressRouteReload.value = true;
  const nav = route.name
    ? { name: route.name, params: { ...route.params, id: newMessageId }, query: { ...route.query } }
    : { path: `/messages/${newMessageId}`, query: { ...route.query } };
  if (options.replace) {
    await router.replace(nav);
  } else {
    await router.push(nav);
  }
};

// Handle center event from MessageNode
const handleCenterOnMessage = async (targetId) => {
  await centerOnMessageInUrl(targetId, { replace: true });
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
    
    // Only load if required messages for radius are not already in store
    const ensureRadiusInStore = async (centerId, radius) => {
      const visited = new Set();
      const queue = [{ id: centerId, depthUp: 0, depthDown: 0 }];
      const neededIds = new Set([centerId]);
      const getMsg = (id) => store.getters['messages/getMessage'](id);
      while (queue.length) {
        const { id, depthUp, depthDown } = queue.shift();
        if (!id || visited.has(id)) continue;
        visited.add(id);
        const msg = getMsg(id);
        if (!msg) continue;
        // Upward traversal
        if (depthUp < radius && msg.parent_id) {
          neededIds.add(msg.parent_id);
          queue.push({ id: msg.parent_id, depthUp: depthUp + 1, depthDown });
        }
        // Downward traversal
        if (depthDown < radius && Array.isArray(msg.child_ids)) {
          for (const childId of msg.child_ids) {
            neededIds.add(childId);
            queue.push({ id: childId, depthUp, depthDown: depthDown + 1 });
          }
        }
      }
      // If any needed message is missing, fetch radius once
      for (const id of neededIds) {
        if (!getMsg(id)) {
          await store.dispatch('messages/loadMessageRadius', { messageId: centerId, radius });
          break;
        }
      }
    };
    await ensureRadiusInStore(targetMessageId, 5);

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
    await ensureCorrectScroll();
    
    // Auto-mark visible branch messages as read after initial load
    if (targetMessageId) {
      console.log('[ThreadView] 🔄 INITIAL LOAD triggering auto-mark for visible branch');
      store.dispatch('messages/markVisibleBranchAsRead', targetMessageId);
    }
  }
};

// Message selection and reply

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
    // Only clear replying state when branch changes if we're not loading more messages
    if (!isLoadingParents.value && !isLoadingChildren.value) {
      store.dispatch('navigation/clearReplyingTo');
    }
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
  
  // If click is not on a message node, clear both reply and selection
  if (!isMessageNode) {
    if (replyingToMessageId.value) {
      store.dispatch('navigation/clearReplyingTo');
    }
    if (isSelectionMode.value) {
      store.dispatch('navigation/exitSelectionMode');
    }
  }
};

// Selection mode methods
const handleMessageSelection = (messageId) => {
  store.dispatch('navigation/toggleMessageSelection', messageId);
};

const exitSelectionMode = () => {
  store.dispatch('navigation/exitSelectionMode');
};

const copySelectedMessages = () => {
  if (selectedMessageIds.value.length === 0) return;
  
  try {
    // Get all messages in the current branch to check for gaps
    const branchMessages = displayedMessages.value;
    
    const messagesToCopy = selectedMessageIds.value
      .map(id => store.getters['messages/getMessage'](id))
      .filter(Boolean) // Remove any null/undefined messages
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); // Sort by timestamp
    
    if (messagesToCopy.length === 0) return;
    
    // Format messages for copying with gap detection
    const formattedText = messagesToCopy.reduce((acc, message, index) => {
      // Format the current message
      const userTag = message.author_user_tag ? `(@${message.author_user_tag})` : '';
      const header = `${message.author_display_name || 'Unknown'} ${userTag}, ${new Date(message.timestamp).toLocaleString()} (stitch.fyi/messages/${message.id})`;
      const messageText = `${header}\n\n${message.content || ''}`;
      
      // If this is the first message, just add it
      if (index === 0) {
        return messageText;
      }
      
      // Find positions of current and previous messages in the branch
      const currentPos = branchMessages.findIndex(m => m.id === message.id);
      const prevPos = branchMessages.findIndex(m => m.id === messagesToCopy[index - 1].id);

      // Add separator based on whether messages are consecutive
      const separator = currentPos - prevPos > 1 ? '\n\n---\n\n...\n\n---\n\n' : '\n\n---\n\n';
      return acc + separator + messageText;
    }, '');
    
    navigator.clipboard.writeText(formattedText)
      .then(() => {
        console.log('Selected messages copied to clipboard');
        isCopied.value = true;
        setTimeout(() => {
          isCopied.value = false;
        }, 1000);
      })
      .catch(err => {
        console.error('Failed to copy selected messages: ', err);
      });
  } catch (error) {
    console.error('Error copying selected messages:', error);
  }
};

const confirmDeleteMessage = (message) => {
  dismissMobileKeyboard();
  store.dispatch('ui/showDeleteConfirm', message);
};

const handleShowLinks = (message) => {
  dismissMobileKeyboard();
  linksModalMessage.value = message;
  showLinksModal.value = true;
};

const closeLinksModal = () => {
  showLinksModal.value = false;
  linksModalMessage.value = null;
};

// Recipients modal methods
const closeRecipientsModal = () => {
  store.dispatch('navigation/hideRecipientsModal');
};

const handleAddRecipients = async (recipients, addToAncestors = true) => {
  
  
  if (!recipients || recipients.length === 0) {
    
    recipientsModalRef.value?.onAddRecipientsError(new Error('No recipients provided'));
    return;
  }

  try {
    const messageId = recipientsModalMessageId.value;
    if (!messageId) {
      console.error('[ThreadView] No message ID for adding recipients');
      recipientsModalRef.value?.onAddRecipientsError(new Error('No message ID provided'));
      return;
    }

    const response = await MessageService.addRecipientsToMessage(messageId, recipients, addToAncestors, true);

    // Refresh origin and all loaded ancestors to reflect recipient changes
    await store.dispatch('messages/refreshLoadedAncestors', {
      messageId: messageId,
      get_replies: true,
      get_children: true,
    });
    
    // Signal completion to the modal
    recipientsModalRef.value?.onAddRecipientsComplete();
    
  } catch (error) {
    console.error('[ThreadView] Error adding recipients:', error);
    // Signal error to the modal
    recipientsModalRef.value?.onAddRecipientsError(error);
  }
};

const handleRecipientRemoved = (recipientUid) => {
  
};

const deleteMessage = async (options) => {
  if (!messageToDelete.value || isDeleting.value) return;
  
  const deletedId = messageToDelete.value.id;
  const deleteDescendants = options?.deleteDescendants || false;
  
  try {
    // Set deleting state to true
    isDeleting.value = true;

    await store.dispatch('messages/deleteMessage', { messageId: deletedId, deleteDescendants });
    
    // Hide confirmation modal after successful deletion
    store.commit('ui/SET_DELETE_CONFIRM', { show: false, message: null });

    // If we deleted the currently centered message, navigate back to previous route (message list)
    if (String(deletedId) === String(messageId.value)) {
      const prevRoute = store.getters['navigation/previousRoute'];
      const fallback = '/inbox';
      router.push(prevRoute || fallback);
      return;
    }

    // Otherwise, remain in thread view
    
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
      
      
    }
    
    // Get first message before loading
    const firstMessageId = displayedMessages.value.length > 0 ? displayedMessages.value[0].id : null;
    
    // Load more messages
    const loadedMessages = await store.dispatch('messages/loadMessageBranchUp', {
      messageId: firstMessageId,
      depth: 5
    });
    
    // Re-align branch path so newly loaded parents point down to the previous root
    if (firstMessageId) {
      await store.dispatch('messages/prepareBranchPath', firstMessageId);
    }
    
    // Render thread but preserve scroll position AND branch path
    await renderThread(true, true);
    
    // Auto-mark newly visible messages as read (only new messages from parent loading)
    if (firstMessageId && displayedMessages.value.length > 0) {
      
      store.dispatch('messages/markVisibleBranchAsRead', displayedMessages.value[0].id);
    }
    
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
    
    // Auto-mark newly visible messages as read (only new messages from children loading)
    if (lastMessageId && displayedMessages.value.length > 0) {
      
      store.dispatch('messages/markVisibleBranchAsRead', displayedMessages.value[0].id);
    }
    
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

// Login handled by LoginButton component

// Profile modal methods
const openProfileModal = () => {
  if (user.value) {
    isProfileModalOpen.value = true;
  }
};

const closeProfileModal = () => {
  isProfileModalOpen.value = false;
};
</script>

<style scoped>
.thread-view {
  display: flex;
  flex-direction: column;
  height: var(--app-height, 100vh);
  width: 100%;
  position: relative;
}

.thread-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-surface);
  z-index: 5;
  position: sticky;
  top: 0;
  /* Add a subtle shadow when scrolled */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.back-button {
  padding: var(--space-xs) var(--space-sm);
  background-color: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text);
}

.graph-view-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--space-xs) var(--space-sm);
  background-color: var(--color-primary);
  color: rgb(99, 90, 90);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: background-color 0.2s ease;
}

.graph-view-button:hover {
  background-color: var(--color-primary-dark);
}

.graph-view-button svg {
  flex-shrink: 0;
}

.thread-title {
  margin: 0;
  color: var(--color-primary);
  font-size: var(--font-size-lg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Selection controls */
.selection-controls {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-left: auto;
}

.selection-count {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.copy-button {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xs);
  padding: 5px 8px;
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--color-text-secondary);
}

.copy-button:hover:not(:disabled) {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-hover);
  color: var(--color-primary);
}

.copy-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.copy-button.copied {
  background-color: var(--color-success-light);
  border-color: var(--color-success);
  color: var(--color-success);
}

.copy-icon {
  font-size: var(--font-size-sm);
  line-height: 1;
}

.exit-selection-button {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xs);
  padding: 4px 8px;
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--color-text-secondary);
  min-width: 28px;
  height: 28px;
}

.exit-selection-button:hover {
  background-color: var(--color-error);
  border-color: var(--color-error);
  color: var(--color-text-inverse);
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
  padding-bottom: calc(100px + 50vh); /* Add space at bottom for the reply box plus a screen's worth of scrollable space */
  gap: 20px; /* Consistent gap between elements */
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  justify-content: flex-start;
  scroll-behavior: auto;
}

/* Media query for mobile responsiveness - moved to consolidated section below */

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

.user-controls {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-right: var(--space-sm);
}

.username-container {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  position: relative;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-fast);
}

.username-container:hover {
  background-color: var(--color-hover-overlay);
}

.username {
  display: inline-block;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-tag {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  opacity: 0.8;
}

.edit-icon {
  font-size: 12px;
  opacity: 0.7;
  color: var(--color-text);
}

.username-container:hover .edit-icon {
  opacity: 1;
}

.logout-btn {
  background-color: transparent;
  color: var(--color-text);
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-xs);
}

.logout-btn:hover {
  background-color: var(--color-hover-overlay);
}

.login-btn {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  padding: var(--space-xs) var(--space-sm);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-xs);
  text-decoration: none;
}

.login-btn:hover {
  background-color: var(--color-primary-dark);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.whitelist-badge, .admin-badge, .non-whitelist-badge, .guest-badge {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  text-align: center;
  line-height: 18px;
  font-size: 12px;
  margin-left: var(--space-xs);
}

.whitelist-badge {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.admin-badge {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.non-whitelist-badge {
  background-color: var(--color-warning);
  color: var(--color-text-inverse);
}

.guest-badge {
  background-color: var(--color-text-secondary);
  color: var(--color-text-inverse);
}

.auth-loading-badge {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  text-align: center;
  line-height: 18px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  overflow: hidden;
  margin-left: var(--space-xs);
}

.auth-loading-spinner {
  display: block;
  width: 100%;
  height: 100%;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .messages-container {
    padding-left: 8px;
    padding-right: 8px;
    padding-bottom: calc(120px + 100vh); /* More space for the reply box on mobile plus a screen's worth of scrollable space */
  }
  
  .reply-box-container {
    padding: 0 16px; /* Reduce padding on mobile */
    bottom: 10px; /* Position slightly higher on mobile */
    z-index: 10; /* Lower than the header controls (z-index 50) */
  }
  
  /* Make the reply box take up more width on mobile */
  .reply-box {
    width: 100%;
  }
  
  .thread-header {
    padding: var(--space-xs) var(--space-sm);
  }
  
  .thread-title {
    font-size: var(--font-size-md);
  }

  .user-controls {
    gap: var(--space-xs);
    flex-shrink: 0;
  }
  
  .user-info {
    gap: 2px;
    margin-right: var(--space-xs);
    min-width: 0;
  }
  
  .username-container {
    gap: 2px;
    padding: 1px 4px;
    max-width: 100px;
    min-width: 0;
  }
  
  .username {
    max-width: 60px;
    font-size: var(--font-size-xs);
  }
  
  .user-tag {
    font-size: calc(var(--font-size-xs) - 2px);
    display: none;
  }
  
  .edit-icon {
    display: none;
  }
  
  .whitelist-badge, .admin-badge, .non-whitelist-badge, .guest-badge, .auth-loading-badge {
    width: 14px;
    height: 14px;
    line-height: 14px;
    font-size: 10px;
    margin-left: 2px;
  }
  
  .logout-btn, .login-btn {
    padding: var(--space-xs) var(--space-sm);
    font-size: calc(var(--font-size-xs) - 1px);
    white-space: nowrap;
    flex-shrink: 0;
  }
}

@media (max-width: 480px) {
  .messages-container {
    padding-left: 4px; /* Minimal padding for thread content */
    padding-right: 4px;
    padding-bottom: calc(130px + 100vh); /* Minimal padding plus a screen's worth of scrollable space */
  }
  
  .reply-box-container {
    padding: 0 8px; /* Further reduce on very narrow screens */
    bottom: 5px;
  }
  
  .thread-header {
    padding: 6px 8px; /* Minimal header padding */
  }
  
  .back-button {
    padding: 4px 8px;
    font-size: calc(var(--font-size-sm) - 1px);
  }
  
  .thread-title {
    font-size: calc(var(--font-size-md) - 1px);
  }

  .user-controls {
    gap: 4px;
    flex-shrink: 0;
  }
  
  .user-info {
    margin-right: 4px;
    min-width: 0;
  }
  
  .username-container {
    max-width: 80px;
    padding: 1px 2px;
  }
  
  .username {
    max-width: 50px;
    font-size: calc(var(--font-size-xs) - 1px);
  }
  
  .whitelist-badge, .admin-badge, .non-whitelist-badge, .guest-badge, .auth-loading-badge {
    width: 12px;
    height: 12px;
    line-height: 12px;
    font-size: 8px;
    margin-left: 1px;
  }
  
  .logout-btn, .login-btn {
    padding: 4px 6px;
    font-size: calc(var(--font-size-xs) - 2px);
    min-width: 50px;
  }
}
</style>




