<script setup>
import { computed, onMounted, ref, onUnmounted, nextTick, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute } from 'vue-router';
import MessageNode from './MessageNode.vue';
import DeleteConfirmModal from './modals/DeleteConfirmModal.vue';

// Props to support different modes and configurations
const props = defineProps({
  mode: {
    type: String,
    required: true,
    validator: (val) => ['inbox', 'public', 'saved', 'all', 'sent', 'incoming-links', 'outgoing-links'].includes(val)
  },
  // Custom messages to display instead of fetching from store
  customMessages: {
    type: Array,
    default: null
  },
  // Hide header controls (new message button)
  hideHeader: {
    type: Boolean,
    default: false
  },
  // Hide info box
  hideInfoBox: {
    type: Boolean,
    default: false
  },
  // Use compact message display
  compact: {
    type: Boolean,
    default: false
  },

  // Source message ID for link-based modes
  sourceMessageId: {
    type: String,
    default: null
  },
  // Enable selection mode for messages
  selectable: {
    type: Boolean,
    default: false
  },
  // Show all links
  showAllLinks: {
    type: Boolean,
    default: false
  }
});

const store = useStore();
const router = useRouter();
const route = useRoute();

// Define emits
const emit = defineEmits(['messageClicked', 'selectionChanged']);

const isAllLoaded = ref(false);
const currentSkip = ref(0);
const pageSize = ref(15);

// Local state for non-store modes (like saved mode)
const localMessages = ref([]);

// Selection state management
const selectedMessageIds = ref(new Set());

// Link deletion loading state
const deletingLinkId = ref(null);

// Request management for race condition prevention
const currentRequestId = ref(0);
const localLoadingState = ref(false);

// Store loading state - single source of truth for store-based modes only
const isLoading = computed(() => {
  // For local modes (saved, public, links), use local loading state
  if (props.mode === 'saved' || props.mode === 'public' || props.mode === 'incoming-links' || props.mode === 'outgoing-links') {
    return localLoadingState.value;
  }
  // For store modes (inbox, admin), use store loading state
  return store.getters['messages/isLoading']('fetchingMessages');
});

// Reference to the message list container for scroll detection
const messageListRef = ref(null);

// Reference to the loading indicator for intersection observer
const loadingIndicatorRef = ref(null);

// Determine active tab from route path
const activeTab = computed(() => {
  if (route.path === '/public') return 'public';
  if (route.path === '/saved') return 'saved';
  if (route.path === '/inbox') return 'inbox';
  return 'public'; // Default to public instead of inbox
});

const threads = computed(() => {
  // Use custom messages if provided
  if (props.customMessages && props.mode === 'custom') {
    return props.customMessages;
  }
  
  // Use local state for saved and link modes (to avoid polluting global store)
  if (props.mode === 'saved' || props.mode === 'public' || props.mode === 'incoming-links' || props.mode === 'outgoing-links') {
    console.log(`[MessageList] threads computed for ${props.mode}:`, {
      localMessagesLength: localMessages.value.length,
      localMessages: localMessages.value
    });
    return localMessages.value;
  }
  
  // Use store for inbox/admin modes
  const allMessages = store.getters['messages/getLoadedMessages'] || [];
  return allMessages;
});

// Loading indicator should be visible if we're loading or have more to load
const shouldShowLoadingIndicator = computed(() => {
  // For saved/inbox modes, don't show loading indicator if user is not logged in
  if ((props.mode === 'saved' || props.mode === 'inbox') && !user.value) {
    return false;
  }
  return isLoading.value || !isAllLoaded.value;
});

// Empty state only shows if we've loaded and have no messages
const shouldShowEmptyState = computed(() => {
  // For saved/inbox mode when not logged in, do not show empty state (we show login prompt)
  if ((props.mode === 'saved' || props.mode === 'inbox') && !user.value) {
    return false;
  }
  return !isLoading.value && isAllLoaded.value && threads.value.length === 0;
});

// Contextual empty state message based on mode
const emptyStateMessage = computed(() => {
  switch (props.mode) {
    case 'inbox':
      if (user.value) {
        return 'No messages in your inbox.';
      } else {
        return 'You must be logged in to view your inbox.';
      }
    case 'admin':
      return 'No messages found.';
    case 'saved':
      if (user.value) {
        return 'No saved messages found.';
      } else {
        return 'You must be logged in to view your saved messages.';
      }
    case 'incoming-links':
      return 'No incoming links found.';
    case 'outgoing-links':
      return 'No outgoing links found.';
    case 'sent':
      return 'No sent messages found.';
    case 'all':
      return 'No messages found.';
    case 'public':
      return 'No public messages found.';
    default:
      return 'No messages found.';
  }
});

// Show login message when no user is logged in (for inbox and saved)
const shouldShowLoginMessage = computed(() => {
  return (props.mode === 'inbox' || props.mode === 'saved') && !user.value;
});

// Specific login/register prompt per tab when logged out
const loginPromptMessage = computed(() => {
  if (!user.value) {
    if (props.mode === 'saved') {
      return 'Login or register to save messages.';
    }
    if (props.mode === 'inbox') {
      return 'Login or register to receive direct messages.';
    }
  }
  return '';
});

const error = computed(() => store.getters['ui/error']);
const user = computed(() => store.getters['auth/user']);
const canInteract = computed(() => store.getters['auth/canInteract']);

const firebaseReady = ref(true);
const replyCounts = ref({}); // Track reply counts by thread ID

// Add new ref for info box collapsed state
const isInfoBoxCollapsed = ref(localStorage.getItem('infoBoxCollapsed') === 'true');

// Link mode detection
const isLinkMode = computed(() => {
  return props.mode === 'incoming-links' || props.mode === 'outgoing-links';
});

const linkType = computed(() => {
  if (props.mode === 'incoming-links') return 'incoming';
  if (props.mode === 'outgoing-links') return 'outgoing';
  return null;
});

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
  // If in selectable mode, handle as selection instead of navigation
  if (props.selectable) {
    handleMessageSelection(messageId);
    return;
  }
  
  // For link modes, emit event to close modal before navigation
  // Don't set previous route for link navigation to preserve original route
  if (props.mode === 'incoming-links' || props.mode === 'outgoing-links') {
    console.log(`[MessageList] Navigation from link mode (${props.mode}) - NOT setting previous route to preserve original`);
    emit('messageClicked', messageId);
    router.push({ path: `/messages/${messageId}` });
    return;
  }
  
  // Store current route before navigation (only for non-link modes)
  console.log(`[MessageList] Navigation from mode "${props.mode}" - setting previous route to: "${route.path}"`);
  store.dispatch('navigation/setPreviousRoute', route.path);
  router.push({ path: `/messages/${messageId}` });
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
  console.log(`[MessageList] Creating new thread - setting previous route to: "${route.path}"`);
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

  // Check capability: admin or msg.write via centralized auth getter
  if (store.getters['auth/canInteract']) {
    createNewThread();
  } else {
    alert("You need write permission to create new messages");
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

// Abstract fetch function - delegates to store based on mode
const loadMessages = async () => {
  // Skip loading if already loading or all loaded
  if (isLoading.value || isAllLoaded.value) {
    console.log(`[MessageList] Skipping load - already loading: ${isLoading.value}, all loaded: ${isAllLoaded.value}`);
    return;
  }
  
  // Skip for saved/inbox modes if no user (requires authentication)
  if ((props.mode === 'saved' || props.mode === 'inbox') && !user.value) {
    console.log('[MessageList] Skipping load for', props.mode, '- no user logged in');
    return;
  }
  
  // Generate a unique request ID to prevent race conditions
  const requestId = ++currentRequestId.value;
  console.log(`[MessageList] Starting request ${requestId} for mode: ${props.mode}`, {
    skip: currentSkip.value,
    limit: pageSize.value,
    sourceMessageId: props.sourceMessageId,
    showAllLinks: props.showAllLinks
  });
  
  // Set loading state based on mode
  if (props.mode === 'saved' || props.mode === 'public' || props.mode === 'incoming-links' || props.mode === 'outgoing-links') {
    localLoadingState.value = true;
  }
  // Store modes handle their own loading state in the store
  
  try {
    let response;
    
    // Build fetch parameters based on mode
    const fetchParams = {
      skip: currentSkip.value,
      limit: pageSize.value
    };
    
    // Add mode-specific parameters
    if (props.sourceMessageId) {
      fetchParams.sourceMessageId = props.sourceMessageId;
    }
    
    // Add showAllLinks parameter for link modes
    if (props.mode === 'incoming-links' || props.mode === 'outgoing-links') {
      fetchParams.showAllLinks = props.showAllLinks;
    }
    
    // Delegate to store based on mode
    response = await store.dispatch('messages/fetchMessages', {
      mode: props.mode,
      ...fetchParams
    });
    
    // Check if this request is still current (not superseded by a newer request)
    if (requestId !== currentRequestId.value) {
      console.log(`[MessageList] Request ${requestId} superseded by ${currentRequestId.value}, ignoring response`);
      return;
    }
    
    if (response) {
      console.log(`[MessageList] Request ${requestId} response for ${props.mode}:`, {
        messageCount: response.messages?.length || 0,
        has_more: response.has_more,
        total: response.total,
        currentSkip: currentSkip.value
      });
      
      // Handle response based on mode
      if (props.mode === 'saved' || props.mode === 'public' || props.mode === 'incoming-links' || props.mode === 'outgoing-links') {
        // For saved, public, and link modes, use local state
        if (currentSkip.value === 0) {
          // First load - replace local messages
          console.log(`[MessageList] Request ${requestId} first load - replacing local messages:`, response.messages?.length || 0);
          localMessages.value = response.messages || [];
        } else {
          // Subsequent loads - append to local messages
          console.log(`[MessageList] Request ${requestId} appending to local messages:`, response.messages?.length || 0);
          localMessages.value = [...localMessages.value, ...(response.messages || [])];
        }
        console.log(`[MessageList] Request ${requestId} local messages after update: ${localMessages.value.length}`);
      }
      // Store modes (inbox/admin) are handled by the store action itself
      
      // Update pagination state
      isAllLoaded.value = !response.has_more;
      if (response.has_more && response.messages && response.messages.length > 0) {
        currentSkip.value += response.messages.length;
      }
      
      console.log(`[MessageList] Request ${requestId} complete - new state:`, {
        isAllLoaded: isAllLoaded.value,
        currentSkip: currentSkip.value,
        totalMessages: localMessages.value.length || store.getters['messages/getLoadedMessages'].length
      });
    }
  } catch (error) {
    // Check if this request is still current before handling error
    if (requestId !== currentRequestId.value) {
      console.log(`[MessageList] Request ${requestId} superseded during error, ignoring`);
      return;
    }
    console.error(`[MessageList] Request ${requestId} error loading ${props.mode} messages:`, error);
  } finally {
    // Only clear loading state if this is still the current request
    if (requestId === currentRequestId.value) {
      if (props.mode === 'saved' || props.mode === 'public' || props.mode === 'incoming-links' || props.mode === 'outgoing-links') {
        localLoadingState.value = false;
      }
      console.log(`[MessageList] Request ${requestId} loading state cleared`);
    } else {
      console.log(`[MessageList] Request ${requestId} was superseded, not clearing loading state`);
    }
  }
};

// Initialize component
onMounted(async () => {
  // Start loading based on mode
  if (props.mode === 'admin') {
    // Admin mode - load immediately (auth checked server-side)
    loadMessages();
  } else if ((props.mode === 'saved' || props.mode === 'inbox') && !user.value) {
    // Don't load saved/inbox messages for guests
    return;
  } else {
    // Load messages for all other modes
    loadMessages();
  }
});

// Watch for user changes to start loading when they log in (inbox mode only)
watch(user, (newUser, oldUser) => {
  if (props.mode === 'inbox' || props.mode === 'saved') {
    if (newUser && !oldUser) {
      // User just logged in, start loading messages
      console.log('User logged in, starting to load messages');
      loadMessages();
    } else if (!newUser && oldUser) {
      // User logged out, reset state
      console.log('User logged out, resetting message list state');
      isAllLoaded.value = false;
      currentSkip.value = 0;
    }
  }
});

// Clean up observers
onUnmounted(() => {
  // Cancel any pending requests to prevent memory leaks
  currentRequestId.value++;
  localLoadingState.value = false;
  
  // Clear any open action bars when MessageList is unmounted
  store.dispatch('navigation/closeActiveActionBar');
  
  console.log('[MessageList] Component unmounted, canceling pending requests');
});

// Add computed properties for delete confirmation modal
const showDeleteConfirm = computed(() => store.getters['ui/showDeleteConfirm']);
const messageToDelete = computed(() => store.getters['ui/messageToDelete']);
const isDeleting = ref(false);

// Add method to handle delete request from MessageNode
const handleDeleteRequest = (message) => {
  store.dispatch('ui/showDeleteConfirm', message);
};

// Add delete message functionality
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
    
    // For list view, we don't navigate away - the message will disappear from the list
    // Optionally refresh the list if needed
    if (props.mode === 'saved' || props.mode === 'public' || props.mode === 'incoming-links' || props.mode === 'outgoing-links') {
      await loadMessages();
    }
  } catch (error) {
    console.error('Error deleting message:', error);
    
    // Provide specific error message for cascade delete scenarios
    let errorMessage = 'Failed to delete message';
    
    if (error.response?.status === 404) {
      errorMessage = 'This message has already been deleted (likely when its parent was deleted)';
      // Hide confirmation modal since the message is already gone
      store.commit('ui/SET_DELETE_CONFIRM', { show: false, message: null });
      // Refresh the list to remove the deleted message
      await loadMessages();
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
  console.log(`[MessageList] Message cache length changed: ${oldLength} -> ${newLength}`);
  // If messages were cleared, reset loading states
  if (oldLength > 0 && newLength === 0) {
    console.log('[MessageList] Cache was cleared, resetting loading states');
    
    // Cancel any pending requests
    currentRequestId.value++;
    localLoadingState.value = false;
    
    isAllLoaded.value = false;
    currentSkip.value = 0;
    
    // For store-based modes (inbox, admin), trigger reload after cache clear
    if (props.mode === 'inbox' || props.mode === 'admin') {
      console.log(`[MessageList] Cache cleared for store-based mode "${props.mode}", triggering reload`);
      nextTick(() => {
        loadMessages();
      });
    }
  }
});

// Reset local state when mode or sourceMessageId changes
watch([() => props.mode, () => props.sourceMessageId, () => props.showAllLinks], () => {
  console.log(`[MessageList] Mode/source/showAllLinks changed - mode: "${props.mode}"`);
  
  // Cancel any pending requests immediately
  currentRequestId.value++;
  localLoadingState.value = false;
  
  if (props.mode === 'saved' || props.mode === 'public' || props.mode === 'incoming-links' || props.mode === 'outgoing-links') {
    console.log(`[MessageList] Local state mode "${props.mode}", resetting local state`);
    console.log(`[MessageList] Current local state:`, {
      localMessagesCount: localMessages.value.length,
      selectedMessageIds: selectedMessageIds.value.size,
      isAllLoaded: isAllLoaded.value,
      currentSkip: currentSkip.value
    });
    
    localMessages.value = [];
    selectedMessageIds.value.clear();
    isAllLoaded.value = false;
    currentSkip.value = 0;
    
    // Trigger reload
    console.log('[MessageList] Triggering message reload after local mode change');
    nextTick(() => {
      loadMessages();
    });
  } else if (props.mode === 'inbox' || props.mode === 'admin') {
    console.log(`[MessageList] Store-based mode "${props.mode}", resetting pagination state`);
    // For store-based modes, just reset pagination (messages handled by store)
    isAllLoaded.value = false;
    currentSkip.value = 0;
    selectedMessageIds.value.clear();
    
    // Only trigger reload if we don't have messages (cache might already be populated)
    const currentMessages = store.getters['messages/getLoadedMessages'] || [];
    if (currentMessages.length === 0) {
      console.log('[MessageList] No messages in store, triggering reload for store-based mode');
      nextTick(() => {
        loadMessages();
      });
    } else {
      console.log(`[MessageList] Store already has ${currentMessages.length} messages, skipping reload`);
    }
  }
}, { immediate: true });

// Handle message selection changes
const handleMessageSelection = (messageId) => {
  if (selectedMessageIds.value.has(messageId)) {
    selectedMessageIds.value.delete(messageId);
  } else {
    selectedMessageIds.value.add(messageId);
  }
  // Emit to parent for operations
  emit('selectionChanged', Array.from(selectedMessageIds.value));
};

// Add function to toggle info box
const toggleInfoBox = () => {
  isInfoBoxCollapsed.value = !isInfoBoxCollapsed.value;
  localStorage.setItem('infoBoxCollapsed', isInfoBoxCollapsed.value);
};

// Handle link deletion
const handleLinkDelete = async (linkData) => {
  try {
    console.log('[MessageList] Handling link delete:', linkData);
    
    // Set loading state for this specific message
    deletingLinkId.value = linkData.messageId;
    
    // Determine the correct messageIdFrom and messageIdTo based on link type
    let messageIdFrom, messageIdTo;
    
    if (linkData.linkType === 'incoming') {
      // For incoming links: the message in the list links TO the source message
      messageIdFrom = linkData.messageId;
      messageIdTo = linkData.sourceMessageId;
    } else if (linkData.linkType === 'outgoing') {
      // For outgoing links: the source message links TO the message in the list
      messageIdFrom = linkData.sourceMessageId;
      messageIdTo = linkData.messageId;
    } else {
      console.error('[MessageList] Invalid link type:', linkData.linkType);
      return;
    }
    
    // Call the store action to delete the link
    const success = await store.dispatch('messages/deleteLink', {
      messageIdFrom,
      messageIdTo,
      linkType: linkData.linkType,
      sourceMessageId: linkData.sourceMessageId
    });
    
    if (success) {
      console.log('[MessageList] Link deleted successfully, refreshing list');
      
      // Refresh the message list to reflect the deletion
      // Reset pagination and reload from the beginning
      isAllLoaded.value = false;
      currentSkip.value = 0;
      localMessages.value = [];
      
      // Reload the messages
      await loadMessages();
    } else {
      console.error('[MessageList] Failed to delete link');
      // Could show a toast notification here
    }
  } catch (error) {
    console.error('[MessageList] Error deleting link:', error);
    // Could show an error toast notification here
  } finally {
    // Clear loading state
    deletingLinkId.value = null;
  }
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
        localMessages.length: {{ localMessages.length }}<br>
        currentSkip: {{ currentSkip }}<br>
        activeTab: {{ activeTab }}<br>
        shouldShowEmptyState: {{ shouldShowEmptyState }}<br>
        shouldShowLoginMessage: {{ shouldShowLoginMessage }}<br>
        showDeleteConfirm: {{ showDeleteConfirm }}<br>
        messageToDelete: {{ messageToDelete }}<br>
        isDeleting: {{ isDeleting }}<br>
      </pre>
    </div> -->

    <!-- Message list header -->
    <div v-if="!hideHeader" class="message-list-header">
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

    <!-- Empty state - only shown when logged in but no messages -->
    <div v-if="shouldShowEmptyState" class="empty-state">
      <p>{{ emptyStateMessage }}</p>
    </div>

    <!-- Messages container -->
    <div class="messages-container">
      <!-- Login/register prompt for saved/inbox when logged out -->
      <div v-if="shouldShowLoginMessage" class="empty-state">
        <p>{{ loginPromptMessage }}</p>
      </div>

      <!-- Messages list - now using MessageNode component -->
      <div 
        v-for="thread in threads" 
        :key="thread.id" 
        class="message-list-item"
        :class="{ 'selectable': selectable, 'link-mode': isLinkMode }"
      >
        <!-- Link delete button - positioned outside MessageNode -->
        <button 
          v-if="isLinkMode"
          @click.stop="handleLinkDelete({
            messageId: thread.id,
            linkType: linkType,
            sourceMessageId: sourceMessageId
          })"
          class="link-delete-button"
          :class="{ 'loading': deletingLinkId === thread.id }"
          :disabled="deletingLinkId === thread.id"
          :title="deletingLinkId === thread.id ? 'Deleting...' : `Remove ${linkType} link`"
        >
          <div v-if="deletingLinkId === thread.id" class="delete-spinner"></div>
          <span v-else class="delete-icon">🗑️</span>
        </button>
        
        <MessageNode
          :message="thread"
          :displayMode="'preview'"
          :selectable="selectable"
          :selected="selectedMessageIds.has(thread.id)"
          :compact="compact"
          :is-selected="false"
          :indent-level="0"
          :loaded-replies="getReplyCount(thread)"
          :total-replies="getReplyCount(thread)"
          :can-reply="false"
          :inListView="true"
          :threadMessages="getThreadMessages(thread.id)"
          @delete="handleDeleteRequest"
          @navigate="viewMessage"
          @selectionToggled="handleMessageSelection"
        />
      </div>
      
      <!-- Loading indicator -->
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

    <!-- Delete Confirmation Modal -->
    <DeleteConfirmModal 
      :show="showDeleteConfirm"
      :message="messageToDelete"
      :is-deleting="isDeleting"
      @cancel="store.dispatch('ui/hideDeleteConfirm')"
      @confirm="deleteMessage"
    />
  </div>
</template>

<style scoped>
.message-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--space-md);
  overflow-y: auto;
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

.message-list-item.selectable {
  cursor: default;
}

.message-list-item:hover {
  opacity: 0.95;
}

/* Link mode styling - make it a horizontal row */
.message-list-item.link-mode {
  display: flex;
  align-items: stretch;
  gap: var(--space-sm);
}

.link-delete-button {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  background: #c03753;
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  align-self: flex-start;
  margin-top: 8px; /* Align with message content */
}

.link-delete-button:hover {
  background: var(--color-error);
  filter: brightness(90%);
  transform: scale(1.05);
}

.link-delete-button.loading {
  background: #c03753;
  cursor: not-allowed;
  transform: none;
}

.link-delete-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.delete-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid var(--color-text-inverse);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.link-delete-button .delete-icon {
  font-size: 14px;
  line-height: 1;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Ensure MessageNode takes remaining space in link mode */
.message-list-item.link-mode .message-node {
  flex: 1;
}

.loading-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--color-text-secondary);
  text-align: center;
  flex-direction: column;
  gap: 12px;
  height: auto;
  padding: var(--space-sm);
  min-height: 50px;
  margin-bottom: var(--space-lg);
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
  line-height: 1;
}

.new-message-btn .btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transform: translateY(-1px); /* Fine-tune vertical centering */
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

.info-header {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  margin-bottom: 8px;
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
  white-space: nowrap;
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

/* Mobile responsive styles for info box */
@media (max-width: 768px) {
  
  .toggle-button {
    font-size: calc(var(--font-size-sm) - 1px);
  }
}

@media (max-width: 480px) {

  .toggle-button {
    font-size: calc(var(--font-size-xs));
    padding: 1px 4px;
  }
  
  /* Additional mobile responsive fixes */
  .message-list-item {
    margin: 0 2px 6px 2px; /* Add horizontal margins */
  }
  
  .empty-state {
    padding: var(--space-md);
    margin: 0 4px;
  }
  
  .loading-indicator {
    padding: var(--space-sm);
    margin: 0 4px;
  }
  
  .new-message-btn {
    width: 52px;
    height: 52px;
    font-size: 44px;
    bottom: var(--space-md);
    right: var(--space-md);
  }
  
  .new-message-btn .btn-icon {
    transform: translateY(-0.5px); /* Adjust for smaller mobile button */
  }
  
  .delete-confirm-content {
    width: 96%;
    padding: var(--space-md);
    margin: 0 2%;
  }
  
  .delete-confirm-actions {
    flex-direction: column;
    gap: var(--space-xs);
  }
  
  .delete-confirm-actions .cancel-button,
  .delete-confirm-actions .delete-button {
    width: 100%;
    padding: var(--space-sm);
  }
}
</style> 