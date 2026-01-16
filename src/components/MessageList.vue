<script setup>
import { computed, onMounted, ref, onUnmounted, nextTick, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute } from 'vue-router';
import MessagePreview from './MessagePreview.vue';
import DeleteConfirmModal from './modals/DeleteConfirmModal.vue';
import NewThreadModal from './modals/NewThreadModal.vue';
import { onActivated } from 'vue';

// Props to support different modes and configurations
const props = defineProps({
  mode: {
    type: String,
    required: true,
    validator: (val) => ['inbox', 'public', 'history', 'saved', 'incoming-links', 'outgoing-links', 'custom'].includes(val)
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
const emit = defineEmits(['messageClicked', 'selectionChanged', 'createChannel']);

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

// Track if we've restored from cache (to prevent immediate watch from clearing it)
const restoredFromCache = ref(false);

// Mode classification helpers
const isLocalMode = computed(() => ['saved', 'public', 'history', 'incoming-links', 'outgoing-links', 'custom'].includes(props.mode));
const isStoreMode = computed(() => ['inbox', 'admin'].includes(props.mode));
const requiresAuth = computed(() => ['inbox', 'saved', 'history'].includes(props.mode));

// Store loading state - single source of truth for store-based modes only
const isLoading = computed(() => {
  return isLocalMode.value
    ? localLoadingState.value
    : store.getters['messages/isLoading']('fetchingMessages');
});

// Reference to the message list container for scroll detection
const messageListRef = ref(null);

// Reference to the loading indicator for intersection observer
const loadingIndicatorRef = ref(null);

// Read active tab from centralized navigation store (synced from TabViewLayout via route)
const activeTab = computed(() => store.getters['navigation/activeTab'] || 'history');

const threads = computed(() => {
  // Use custom messages if provided
  if (props.customMessages && props.mode === 'custom') {
    return props.customMessages;
  }
  
  // Use local state for local modes (to avoid polluting global store)
  if (isLocalMode.value) {
    return localMessages.value;
  }
  
  // Use store for inbox/admin modes
  const allMessages = store.getters['messages/getLoadedMessages'] || [];
  return allMessages;
});

// Loading indicator should be visible if we're loading or have more to load
const shouldShowLoadingIndicator = computed(() => {
  if (requiresAuth.value && !user.value) return false;
  return isLoading.value || !isAllLoaded.value;
});

// Empty state only shows if we've loaded and have no messages
const shouldShowEmptyState = computed(() => {
  if (requiresAuth.value && !user.value) return false;
  return !isLoading.value && isAllLoaded.value && threads.value.length === 0;
});

// Get description text for current mode
const modeDescription = computed(() => {
  switch (props.mode) {
    case 'search':
      return 'Search results show messages visible to you that match your search criteria (tags and content). Results include both public messages and private messages you have access to.';
    case 'history':
      return 'History shows the root message of each thread where you have sent at least one message, in any branch. Threads are sorted by your most recent activity, so the threads you\'ve participated in recently appear first.';
    case 'saved':
      return 'Saved messages are messages you\'ve bookmarked for easy access later. Use the bookmark button on any message to save it here.';
    case 'inbox':
      return 'Your inbox shows the latest message from each conversation thread where you are involved—either as a recipient or as the author. This gives you a quick overview of all your active conversations.';
    case 'public':
      return 'Public messages are visible to everyone. This view shows the most recent message (leaf node) from each public thread, giving you a snapshot of public conversations happening across the platform.';
    default:
      return null;
  }
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
    case 'history':
      if (user.value) {
        return 'No history yet. Create your first message to get started.';
      } else {
        return 'You must be logged in to view your history.';
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
    case 'public':
      return 'No public messages found.';
    default:
      return 'No messages found.';
  }
});

// Show login message when no user is logged in (for inbox and saved)
const shouldShowLoginMessage = computed(() => requiresAuth.value && !user.value);

// Specific login/register prompt per tab when logged out
const loginPromptMessage = computed(() => {
  if (!user.value) {
    if (props.mode === 'saved') {
      return 'Login or register to save messages.';
    }
    if (props.mode === 'inbox') {
      return 'Login or register to receive direct messages.';
    }
    if (props.mode === 'history') {
      return 'Login or register to view your message history.';
    }
  }
  return '';
});

const error = computed(() => store.getters['ui/error']);
const user = computed(() => store.getters['auth/user']);
const canInteract = computed(() => store.getters['auth/canInteract']);
const activePrincipalUid = computed(() => store.getters['auth/activePrincipalUid']);

const firebaseReady = ref(true);
const replyCounts = ref({}); // Track reply counts by thread ID

// Add new ref for info box collapsed state
const isInfoBoxCollapsed = ref(localStorage.getItem('infoBoxCollapsed') === 'true');

// New Thread Modal State
const showNewThreadModal = ref(false);

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
  if (message.author?.display_name) return message.author.display_name;
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
    emit('messageClicked', messageId);
    router.push({ path: `/messages/${messageId}` });
    return;
  }
  
  // Save scroll position before navigation (for restoring when coming back)
  // Note: The actual scroll container is .main-content (parent), not .message-list
  const scrollContainer = messageListRef.value?.closest('.main-content');
  if (scrollContainer) {
    const scrollPos = scrollContainer.scrollTop;
    console.log(`[MessageList] Saving scroll position: ${scrollPos} for tab "${props.mode}"`);
    store.dispatch('navigation/saveListScrollPosition', {
      tab: props.mode,
      position: scrollPos
    });
  }
  
  // Save list cache for local modes (so we don't have to refetch)
  if (isLocalMode.value && localMessages.value.length > 0) {
    console.log(`[MessageList] Saving cache for "${props.mode}" - ${localMessages.value.length} messages, skip: ${currentSkip.value}`);
    store.dispatch('navigation/saveListCache', {
      tab: props.mode,
      messages: localMessages.value,
      currentSkip: currentSkip.value,
      isAllLoaded: isAllLoaded.value
    });
  } else {
    console.log(`[MessageList] NOT saving cache - isLocalMode: ${isLocalMode.value}, messages: ${localMessages.value.length}`);
  }
  
  // Store current route before navigation (only for non-link modes)
  // Use fullPath to include query params (e.g., channelId for channels tab)
  const previousRoute = route.query && Object.keys(route.query).length > 0 
    ? `${route.path}?${new URLSearchParams(route.query).toString()}`
    : route.path;
  store.dispatch('navigation/setPreviousRoute', previousRoute);
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
  store.dispatch('navigation/setPreviousRoute', route.path);
  
  // Simply navigate to the new thread route
  router.push('/new-thread');
};

// Check if user has any special scopes that require modal
const hasImportScope = computed(() => {
  return store.getters['auth/hasAnyScope'](['msg.import.cursor', 'msg.import.audio']);
});

const hasChannelCreateScope = computed(() => {
  return store.getters['auth/hasScope']('channel.create');
});

const shouldShowModal = computed(() => {
  return hasImportScope.value || hasChannelCreateScope.value;
});

// Handle the create button click
const handleCreateClick = (event) => {
  // First check if user is logged in
  if (!user.value) {
    store.commit('ui/SET_ERROR', { code: 'auth_required', message: 'Please log in to create new messages' });
    return;
  }

  // Check capability: msg.write via centralized auth getter
  if (!store.getters['auth/canInteract']) {
    store.commit('ui/SET_ERROR', { code: 'permission_required', message: 'You need write permission to create new messages' });
    return;
  }

  // If user has import or channel.create scopes, show modal
  // Otherwise go straight to new thread
  if (shouldShowModal.value) {
    showNewThreadModal.value = true;
  } else {
    createNewThread();
  }
};

const handleNewThreadConfirm = () => {
  showNewThreadModal.value = false;
  createNewThread();
};

const handleImportConfirm = () => {
  showNewThreadModal.value = false;
  store.dispatch('navigation/setPreviousRoute', route.path);
  router.push('/import');
};

const handleCreateChannelConfirm = () => {
  showNewThreadModal.value = false;
  // Emit event to parent (ChannelsView will handle this)
  emit('createChannel');
};

// Function to check if the author is the current user
function isCurrentUserAuthor(message) {
  if (!user.value) return false;
  
  // First check by nested author object (preferred)
  if (message.author?.uid && user.value.uid === message.author.uid) return true;
  if (message.author?.user_tag && user.value.user_tag === message.author.user_tag) return true;
  
  // Fallback: check by author_user_tag if available
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
    return;
  }
  
  // Skip for auth-required modes if no user
  if (requiresAuth.value && !user.value) return;
  
  // Generate a unique request ID to prevent race conditions
  const requestId = ++currentRequestId.value;
  
  
  // Set loading state based on mode
  if (isLocalMode.value) localLoadingState.value = true;
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

    if (response) {
      
      
      // Handle response based on mode
      if (isLocalMode.value) {
        // For saved, public, and link modes, use local state
        if (currentSkip.value === 0) {
          // First load - replace local messages
          localMessages.value = response.messages || [];
        } else {
          // Subsequent loads - append to local messages          
          localMessages.value = [...localMessages.value, ...(response.messages || [])];
        }
      }
      // Store modes (inbox/admin) are handled by the store action itself
      
      // Update pagination state
      isAllLoaded.value = !response.has_more;
      if (response.has_more && response.messages && response.messages.length > 0) {
        currentSkip.value += response.messages.length;
      }
      
      
    }
  } catch (error) {
    
    console.error(`[MessageList] Error loading ${props.mode} messages:`, error);
  } finally {
    // Only clear loading state if this is still the current request
    if (requestId === currentRequestId.value) {
      if (isLocalMode.value) localLoadingState.value = false;
    }
  }
};

// Initialize component
onMounted(async () => {
  console.log(`[MessageList] onMounted - mode: "${props.mode}", isLocalMode: ${isLocalMode.value}`);
  
  // For local modes, try to restore from cache first
  if (isLocalMode.value) {
    const cached = store.getters['navigation/getListCache'](props.mode);
    console.log(`[MessageList] Cache check for "${props.mode}":`, cached ? `${cached.messages?.length} messages` : 'no cache');
    
    if (cached && cached.messages && cached.messages.length > 0) {
      console.log(`[MessageList] Restoring from cache - ${cached.messages.length} messages, skip: ${cached.currentSkip}, allLoaded: ${cached.isAllLoaded}`);
      // Mark that we're restoring from cache (to prevent watch from clearing)
      restoredFromCache.value = true;
      
      // Restore from cache
      localMessages.value = cached.messages;
      currentSkip.value = cached.currentSkip;
      isAllLoaded.value = cached.isAllLoaded;
      
      // Restore scroll position after DOM has fully rendered
      // Use double nextTick + small delay to ensure layout is complete
      // Note: The actual scroll container is .main-content (parent), not .message-list
      nextTick(() => {
        nextTick(() => {
          setTimeout(() => {
            const scrollContainer = messageListRef.value?.closest('.main-content');
            const savedScrollPosition = store.getters['navigation/getListScrollPosition'](props.mode);
            console.log(`[MessageList] Restoring scroll position: ${savedScrollPosition}, container scrollHeight: ${scrollContainer?.scrollHeight}`);
            if (savedScrollPosition > 0 && scrollContainer) {
              scrollContainer.scrollTop = savedScrollPosition;
              console.log(`[MessageList] Scroll applied, actual scrollTop: ${scrollContainer.scrollTop}`);
            }
          }, 50); // Small delay to ensure layout is complete
        });
      });
      return; // Skip fetching since we restored from cache
    }
  }
  
  console.log(`[MessageList] No cache found, loading messages...`);
  // Start loading based on mode
  if (props.mode === 'admin') {
    loadMessages();
  } else if (requiresAuth.value && !user.value) {
    return;
  } else {
    loadMessages();
  }
});

// Add: auto-load when component is re-activated via keep-alive (e.g., switching tabs)
onActivated(() => {
  try {
    const hasUser = !!user.value;
    const needsAuth = requiresAuth.value;
    const anyMessages = (store.getters['messages/getLoadedMessages'] || []).length > 0;
    if (isStoreMode.value && !isLoading.value && !anyMessages && (!needsAuth || hasUser)) {
      nextTick(() => {
        loadMessages();
      });
    }
    
    // Restore scroll position when returning to the list
    // Note: The actual scroll container is .main-content (parent), not .message-list
    const savedScrollPosition = store.getters['navigation/getListScrollPosition'](props.mode);
    if (savedScrollPosition > 0 && messageListRef.value) {
      nextTick(() => {
        const scrollContainer = messageListRef.value?.closest('.main-content');
        if (scrollContainer) {
          scrollContainer.scrollTop = savedScrollPosition;
        }
      });
    }
  } catch (e) {
    // no-op
  }
});

// Watch for user changes to start loading when they log in (inbox mode only)
watch(user, (newUser, oldUser) => {
  if (requiresAuth.value) {
    if (newUser && !oldUser) {
      loadMessages();
    } else if (!newUser && oldUser) {
      // User logged out - clear cache and reset state
      isAllLoaded.value = false;
      currentSkip.value = 0;
      store.dispatch('navigation/clearListCache');
    }
  }
});

// Reload when active principal changes (manager ↔ managed or between manageds)
watch(activePrincipalUid, async (newUid, oldUid) => {
  try {
    if (newUid === oldUid) return;
    // Cancel in-flight and reset local state
    currentRequestId.value++;
    localLoadingState.value = false;
    selectedMessageIds.value.clear();
    isAllLoaded.value = false;
    currentSkip.value = 0;
    if (isLocalMode.value) {
      localMessages.value = [];
    }
    // Clear navigation cache since we're switching principals
    store.dispatch('navigation/clearListCache');
    // Trigger fresh load respecting mode/auth
    await nextTick();
    loadMessages();
  } catch (e) {
    // no-op
  }
});

// Watch for refresh trigger from navigation store
const refreshTrigger = computed(() => store.getters['navigation/refreshTrigger']);
watch(refreshTrigger, async (newTrigger) => {
  if (newTrigger > 0) {
    console.log('[MessageList] Refresh triggered, reloading messages...');
    // Cancel any in-flight requests
    currentRequestId.value++;
    localLoadingState.value = false;
    selectedMessageIds.value.clear();
    isAllLoaded.value = false;
    currentSkip.value = 0;
    
    // Clear cache for current mode
    store.dispatch('navigation/clearListCache', props.mode);
    
    // Clear messages store cache if in store mode
    if (isStoreMode.value) {
      await store.dispatch('messages/clearCache');
    } else if (isLocalMode.value) {
      localMessages.value = [];
    }
    
    // Trigger fresh load
    await nextTick();
    loadMessages();
  }
});

// Clean up observers
onUnmounted(() => {
  // Cancel any pending requests to prevent memory leaks
  currentRequestId.value++;
  localLoadingState.value = false;
  
  // Clear any open action bars when MessageList is unmounted
  store.dispatch('navigation/closeActiveActionBar');
});

// Add computed properties for delete confirmation modal
const showDeleteConfirm = computed(() => store.getters['ui/showDeleteConfirm']);
const messageToDelete = computed(() => store.getters['ui/messageToDelete']);
const isDeleting = ref(false);

// Add method to handle delete request from MessagePreview
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
// Watch for store message updates and sync to localMessages (for tags, recipients, etc.)
watch(
  () => store.state.messages.messages,
  (newMessages) => {
    // Only sync for local modes (store modes use getLoadedMessages which auto-updates)
    if (!isLocalMode.value || localMessages.value.length === 0) return;
    
    // Update any messages in localMessages that changed in the store
    localMessages.value = localMessages.value.map(localMsg => {
      const storeMsg = newMessages[localMsg.id];
      // If message exists in store and has different data, use store version
      if (storeMsg && storeMsg.id === localMsg.id) {
        return storeMsg;
      }
      return localMsg;
    });
  },
  { deep: true }
);

watch([() => props.mode, () => props.sourceMessageId, () => props.showAllLinks], () => {
  console.log(`[MessageList] Mode/source/showAllLinks changed - mode: "${props.mode}"`);
  
  // Check if we have a cache for this mode - if so, don't reset, let onMounted restore it
  const hasCache = store.getters['navigation/getListCache'](props.mode);
  console.log(`[MessageList] Cache check in watch for "${props.mode}":`, hasCache ? `found ${hasCache.messages?.length} messages` : 'no cache');
  if (hasCache && hasCache.messages && hasCache.messages.length > 0) {
    console.log(`[MessageList] Watch triggered but cache exists for "${props.mode}" - skipping reset`);
    restoredFromCache.value = true; // Set flag so we don't reset
    return;
  }
  
  // Skip reset if we just restored from cache (prevents immediate: true from clearing cache)
  if (restoredFromCache.value) {
    console.log(`[MessageList] Watch triggered but skipping reset - restored from cache flag set`);
    restoredFromCache.value = false; // Reset flag so future mode changes still work
    return;
  }
  
  console.log(`[MessageList] Watch triggered - will reset state for mode: "${props.mode}"`);
  
  // Cancel any pending requests immediately
  currentRequestId.value++;
  localLoadingState.value = false;
  
  if (isLocalMode.value) {
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
  } else if (isStoreMode.value) {
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
        <!-- Create button is now global in TabViewLayout -->
      </div>
    </div>

    <!-- Mode description -->
    <div v-if="modeDescription && !hideInfoBox" class="mode-description">
      <span class="info-icon">ℹ</span>
      <p>{{ modeDescription }}</p>
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

      <!-- Messages list - now using MessagePreview component -->
      <div 
        v-for="thread in threads" 
        :key="thread.id" 
        class="message-list-item"
        :class="{ 'selectable': selectable, 'link-mode': isLinkMode }"
      >
        <!-- Link delete button - positioned outside MessagePreview -->
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
        
        <MessagePreview
          :message="thread"
          :displayMode="'preview'"
          :selectable="selectable"
          :selected="selectedMessageIds.has(thread.id)"
          :compact="compact"
          :currentTab="activeTab"
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

    <!-- Create Options Modal -->
    <NewThreadModal
      :show="showNewThreadModal"
      @close="showNewThreadModal = false"
      @new-thread="handleNewThreadConfirm"
      @import="handleImportConfirm"
      @create-channel="handleCreateChannelConfirm"
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
  overflow-x: hidden; /* Prevent horizontal overflow */
  width: 100%; /* Ensure it respects parent width */
  max-width: 100vw; /* Never exceed viewport width */
  box-sizing: border-box; /* Include padding in width calculation */
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
  width: 50%;
  margin: 0 auto;
  align-self: center;
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
  gap: var(--space-sm); /* Reduced from space-md for tighter spacing in list view */
  /* Center items horizontally so previews are centered within the layout */
  align-items: center;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: hidden; /* Prevent horizontal scroll */
}

.message-list-item {
  width: 100%;
  /* Constrain preview width and center it */
  max-width: var(--content-max-width, 900px);
  margin-left: auto;
  margin-right: auto;
  /* Symmetric horizontal padding to prevent right-edge clipping */
  padding-left: 2px;
  padding-right: 2px;
  cursor: pointer;
  position: relative;
  transition: transform var(--transition-fast), opacity var(--transition-fast);
  box-sizing: border-box; /* Include padding in width calculation */
  overflow-x: hidden; /* Prevent content from overflowing */
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

/* Ensure MessagePreview takes remaining space in link mode */
.message-list-item.link-mode .message-preview {
  flex: 1;
}

/* Ensure MessagePreview spans full width of the centered container */
.message-list-item .message-preview {
  width: 100%;
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

.mode-description {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  width: 50%;
  padding: var(--space-md);
  margin: 0 auto var(--space-md) auto;
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
}

.mode-description .info-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: var(--color-surface-light);
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  font-weight: 600;
  font-style: normal;
  margin-top: 2px;
}

.mode-description p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.5;
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
  align-self: center;
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
    margin: 0; /* No margins - gap property on parent controls spacing */
    padding-left: 4px;
    padding-right: 4px;
  }
  
  .mode-description {
    width: calc(100% - var(--space-md) * 2);
    margin: 0 auto var(--space-md) auto;
    padding: var(--space-sm);
  }
  
  .empty-state {
    padding: var(--space-md);
    margin: 0;
    width: 100%;
    box-sizing: border-box;
  }
  
  .loading-indicator {
    padding: var(--space-sm);
    margin: 0;
    width: 100%;
    box-sizing: border-box;
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