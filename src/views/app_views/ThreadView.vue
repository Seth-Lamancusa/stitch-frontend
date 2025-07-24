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
        
        <!-- Graph view toggle
        <button @click="openGraphView" class="graph-view-button" title="Switch to graph view">
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
            <span v-else-if="isWhitelisted" class="whitelist-badge" title="Whitelisted">✓</span>
            <span v-else-if="user && !isWhitelisted" class="non-whitelist-badge" title="Not whitelisted">✗</span>
            <span v-if="!user" class="guest-badge" title="Not logged in">?</span>
          </div>
          <button v-if="user" @click="logout" class="logout-btn">Logout</button>
          <button v-else @click="handleLogin" class="login-btn" :disabled="isLoggingIn">
            {{ isLoggingIn ? 'Signing in...' : 'Login' }}
          </button>
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

    <!-- Delete Confirmation Modal -->
    <DeleteConfirmModal 
      :show="showDeleteConfirm"
      :message="messageToDelete"
      :is-deleting="isDeleting"
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
import LinksModal from '../../components/LinksModal.vue';
import RecipientsModal from '../../components/RecipientsModal.vue';
import DeleteConfirmModal from '../../components/DeleteConfirmModal.vue';
import ProfileEditModal from '../../components/ProfileEditModal.vue';
import { useAuthentication } from '../../composables/useAuthentication';

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
const isAdmin = computed(() => store.getters['auth/isAdmin']);
const isWhitelisted = computed(() => store.getters['auth/isWhitelisted']);

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
};

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
  
  // Enable thread view mode for auto-marking messages as read
  store.commit('messages/SET_THREAD_VIEW_MODE', true);
  console.log('[ThreadView] 🔧 MOUNT Thread view mode enabled');
  
  // Add reload detection
  window.addEventListener('beforeunload', () => {
    console.log('[ThreadView] 🚨 PAGE RELOAD DETECTED!');
    console.trace('[ThreadView] Reload stack trace:');
  });
  
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
  
  // Note: WebSocket callback is handled globally by WebSocketService.initialize()
  // No need to register a component-specific callback here
  
  console.log(`[ThreadView] 🔧 MOUNT onMounted complete`);
  
  // Log initial rejection state
  console.log('[ThreadView] Initial rejection state on mount:', store.getters['auth/wasRejectedForWhitelist']);
});

onBeforeUnmount(() => {
  // Disable thread view mode to stop auto-marking
  store.commit('messages/SET_THREAD_VIEW_MODE', false);
  console.log('[ThreadView] 🔧 UNMOUNT Thread view mode disabled');
  
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
  console.log(`[ThreadView] 👀 WATCH messageId changed from ${oldId} to ${newId}, triggered by:`, new Error().stack);
  if (newId) {
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
  console.log('[ThreadView] 🔄 BRANCH WATCHER fired:', {
    newFirstMessageId,
    oldFirstMessageId,
    displayedMessagesLength: displayedMessages.value.length,
    hasMessages: displayedMessages.value.length > 0,
    willTriggerAutoMark: newFirstMessageId && oldFirstMessageId && newFirstMessageId !== oldFirstMessageId
  });
  
  if (newFirstMessageId && oldFirstMessageId && newFirstMessageId !== oldFirstMessageId) {
    // Branch changed (sibling navigation) - no longer clearing selection mode
    console.log('[ThreadView] ✅ Branch changed detected!', {
      from: oldFirstMessageId,
      to: newFirstMessageId,
      threadViewMode: store.getters['messages/isThreadViewMode']
    });
    
    // Auto-mark newly visible branch as read after sibling navigation
    console.log('[ThreadView] 🔄 BRANCH CHANGE triggering auto-mark for visible branch');
    store.dispatch('messages/markVisibleBranchAsRead', newFirstMessageId);
  } else {
    console.log('[ThreadView] ❌ Branch change conditions not met:', {
      hasNewId: !!newFirstMessageId,
      hasOldId: !!oldFirstMessageId,
      idsAreDifferent: newFirstMessageId !== oldFirstMessageId
    });
  }
});

// Watch for message changes to ensure reply settings are always in sync
watch(replyingToMessageId, () => {
  // Remove call to syncReplySettingsWithSelectedMessage since it's now automatic
  // Settings are synced automatically when selecting a message
}, { immediate: true });

// Watch for rejection state changes and redirect to /public
console.log('[ThreadView] Setting up rejection state watcher');
watch(() => store.getters['auth/wasRejectedForWhitelist'], (newValue, oldValue) => {
  console.log('[ThreadView] Rejection state watcher triggered - oldValue:', oldValue, 'newValue:', newValue);
  // Always redirect when rejection state is set to true
  if (newValue) {
    console.log('[ThreadView] Rejection state is true, redirecting to /public');
    console.log('[ThreadView] Current route before push:', route.path);
    router.push('/public');
    console.log('[ThreadView] router.push(/public) called');
  }
});

// Navigation
const backToList = async () => {
  // Get the previous route
  const prevRoute = store.getters['navigation/previousRoute'];
  
  console.log(`[ThreadView] Back button clicked - previous route: "${prevRoute}", using: "${prevRoute || '/inbox'}"`);
  
  // Navigate back to the previous route - keep cache for faster return
  router.push(prevRoute || '/inbox'); // Fallback to inbox if no previous route
};

const openGraphView = () => {
  const currentMessageId = messageId.value;
  if (currentMessageId) {
    router.push(`/${currentMessageId}/graph`);
  }
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
      const header = `${message.author_display_name || 'Unknown'} ${userTag}, ${new Date(message.timestamp).toLocaleString()} (stitch.fyi/${message.id})`;
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

// Recipients modal methods
const closeRecipientsModal = () => {
  store.dispatch('navigation/hideRecipientsModal');
};

const handleAddRecipients = async (recipients, propagateToDescendants = false) => {
  console.log('[ThreadView] handleAddRecipients called with', recipients, 'propagate:', propagateToDescendants);
  
  if (!recipients || recipients.length === 0) {
    console.log('[ThreadView] No recipients to add');
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

    const response = await MessageService.addRecipientsToMessage(messageId, recipients, propagateToDescendants);
    
    console.log('[ThreadView] Recipients added successfully', response.data);
    
    // Refresh the message data to get updated recipients list
    await store.dispatch('messages/loadMessageRadius', { 
      messageId: messageId, 
      radius: 1 
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
  console.log('[ThreadView] handleRecipientRemoved called with', recipientUid);
};

const deleteMessage = async (options) => {
  if (!messageToDelete.value || isDeleting.value) return;
  
  const deletedId = messageToDelete.value.id;
  const deleteDescendants = options?.deleteDescendants || false;
  
  try {
    // Set deleting state to true
    isDeleting.value = true;
    
    await store.dispatch('messages/deleteMessage', { messageId: deletedId, deleteDescendants });
    
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
    
    // Auto-mark newly visible messages as read (only new messages from parent loading)
    if (firstMessageId && displayedMessages.value.length > 0) {
      console.log('[ThreadView] 🔄 LOAD PARENTS triggering auto-mark for visible branch');
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
      console.log('[ThreadView] 🔄 LOAD CHILDREN triggering auto-mark for visible branch');
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

// Add login handler
const handleLogin = async () => {
  isLoggingIn.value = true;
  try {
    console.log('[ThreadView] Starting signInWithGoogle');
    // Clear rejection state before login attempt to ensure fresh state
    store.commit('auth/SET_REJECTED_FOR_WHITELIST', false);
    await signInWithGoogle();
    console.log('[ThreadView] signInWithGoogle completed successfully');
    
    // Wait a moment for auth state to be processed
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Check if user is still logged in and whitelisted
    const currentUser = store.getters['auth/user'];
    if (currentUser && ['admin', 'whitelisted', 'import'].includes(currentUser.status)) {
      console.log('[ThreadView] User logged in successfully, staying on page');
      // Only redirect if there was a specific redirect requested
      if (route.query.redirect) {
        router.push(route.query.redirect);
      }
      // Otherwise stay on current page
    } else {
      console.log('[ThreadView] User not whitelisted or not logged in after auth');
    }
  } catch (e) {
    console.error("Login error:", e);
    console.log('[ThreadView] About to call forceLogoutWithMessage');
    console.log('[ThreadView] Current location before forceLogoutWithMessage:', window.location.href);
    // On authentication error, set rejection state and redirect to public page
    await store.dispatch('auth/forceLogoutWithMessage', router);
    console.log('[ThreadView] forceLogoutWithMessage completed');
    console.log('[ThreadView] Current location after forceLogoutWithMessage:', window.location.href);
  } finally {
    isLoggingIn.value = false;
  }
};

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
  color: white;
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
  padding-bottom: 100px; /* Add space at bottom for the reply box */
  gap: 20px; /* Consistent gap between elements */
  height: 100%;
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
    padding-bottom: 120px; /* More space for the reply box on mobile */
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
    padding-bottom: 130px;
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