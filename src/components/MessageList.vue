<script setup>
import { computed, onMounted, onUnmounted, onActivated, onDeactivated, ref, nextTick, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute } from 'vue-router';
import MessagePreview from './MessagePreview.vue';
import DeleteConfirmModal from './modals/DeleteConfirmModal.vue';
import NewThreadModal from './modals/NewThreadModal.vue';
import { isCurrentUserAuthor as isMessageAuthor } from '../utils/messageCompat.js';

// Props to support different modes and configurations
const props = defineProps({
  mode: {
    type: String,
    required: true,
    validator: (val) => ['inbox', 'public', 'history', 'saved', 'timeline', 'incoming-links', 'outgoing-links', 'custom'].includes(val)
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
  // Emit click event instead of navigating
  emitOnly: {
    type: Boolean,
    default: false
  },
  // Show all links
  showAllLinks: {
    type: Boolean,
    default: false
  },
  // Search owns its pages. When set, custom mode shows Load more from hasMore.
  externalPaging: {
    type: Boolean,
    default: false
  },
  hasMore: {
    type: Boolean,
    default: false
  },
  loadingMore: {
    type: Boolean,
    default: false
  }
});

const store = useStore();
const router = useRouter();
const route = useRoute();

// Define emits
const emit = defineEmits(['messageClicked', 'selectionChanged', 'load-more']);

const isAllLoaded = ref(false);
const currentSkip = ref(0);
const pageSize = ref(15);

// Local state for non-store modes (like saved mode)
const localMessages = ref([]);
// Inbox rows only. The shared store also holds the open thread, which must not flash in this list.
const inboxMessageIds = ref([]);

// Selection state management
const selectedMessageIds = ref(new Set());

// Link deletion loading state
const deletingLinkId = ref(null);

// This list's request, not the shared store flag. That flag is global, so one
// fetch could block another list and a discarded response left Load More with no rows.
const isLoading = ref(false);
const listActive = ref(true);
let requestSerial = 0;
// keep-alive runs onActivated right after onMounted; the mount load is enough.
const skipActivateLoad = ref(false);

const isLocalMode = computed(() => ['saved', 'public', 'history', 'timeline', 'incoming-links', 'outgoing-links', 'custom'].includes(props.mode));
const requiresAuth = computed(() => ['inbox', 'saved', 'history', 'timeline'].includes(props.mode));

// Reference to the message list container for scroll detection
const messageListRef = ref(null);

// Reference to the loading indicator for intersection observer
const loadingIndicatorRef = ref(null);

// Read active tab from centralized navigation store (synced from TabViewLayout via route)
const activeTab = computed(() => store.getters['navigation/activeTab'] || 'history');

const isInboxMode = computed(() => props.mode === 'inbox');
const inboxUnreadOnly = computed(() => store.getters['navigation/inboxUnreadOnly']);
let inboxLiveTimer = null;

// NOTE: Inbox "mark all as read" was added but disabled per product decision.
// Keeping the code here commented so it can be re-enabled later.
/*
// Inbox unread state (used for "mark all as read")
const unreadMessageCount = computed(() => store.getters['messages/getUnreadMessageCount']);
const isInboxMode = computed(() => props.mode === 'inbox');

const isMarkingAllAsRead = ref(false);

const markAllAsRead = async () => {
  if (!isInboxMode.value || !user.value) return;
  if (unreadMessageCount.value <= 0) return;
  if (isMarkingAllAsRead.value) return;

  try {
    isMarkingAllAsRead.value = true;
    await store.dispatch('messages/markAllMessagesAsRead');

    // Reload inbox from scratch so thread unread badges update.
    currentSkip.value = 0;
    isAllLoaded.value = false;

    const scrollContainer = messageListRef.value?.closest('.main-content');
    if (scrollContainer) scrollContainer.scrollTop = 0;

    await loadFromStart();
  } catch (e) {
    console.error('[MessageList] markAllAsRead failed:', e);
  } finally {
    isMarkingAllAsRead.value = false;
  }
};
*/

const threads = computed(() => {
  // Use custom messages if provided
  if (props.customMessages && props.mode === 'custom') {
    return props.customMessages;
  }
  
  // Use local state for local modes (to avoid polluting global store)
  if (isLocalMode.value) {
    return localMessages.value;
  }
  
  if (props.mode === 'inbox') {
    const byId = store.state.messages.messages;
    return inboxMessageIds.value.map(id => byId[id]).filter(Boolean);
  }

  // Admin uses the shared store
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

// When global channel is selected, list is filtered to that channel (inbox, history, timeline)
const selectedChannelId = computed(() => store.getters['navigation/selectedChannelId']);
const isFilteredByChannel = computed(() => {
  if (!selectedChannelId.value) return false;
  return ['inbox', 'history', 'timeline'].includes(props.mode);
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
      return 'Public shows the root of each public thread, one row per thread. A public reply under a private message starts its own thread. Roots are ordered by when they were created, newest first.';
    case 'timeline':
      return 'Timeline shows all messages you have access to in reverse chronological order. This includes public messages, messages you authored, messages you received, and messages in channels you\'re a member of.';
    default:
      return null;
  }
});

// Contextual empty state message based on mode
const emptyStateMessage = computed(() => {
  switch (props.mode) {
    case 'inbox':
      if (user.value && inboxUnreadOnly.value) {
        return 'No unread conversations.';
      } else if (user.value) {
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
    case 'timeline':
      if (user.value) {
        return 'No messages in your timeline yet.';
      } else {
        return 'You must be logged in to view your timeline.';
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
    if (props.mode === 'timeline') {
      return 'Login or register to view your timeline.';
    }
  }
  return '';
});

const error = computed(() => store.getters['ui/error']);
const user = computed(() => store.getters['auth/user']);
const canInteract = computed(() => store.getters['auth/canInteract']);
const activePrincipalUid = computed(() => store.getters['auth/activePrincipalUid']);
// Snapshots are per principal so switching profiles cannot paint the other person's list.
const listCacheKey = computed(() => `${activePrincipalUid.value || 'anon'}:${props.mode}`);

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
  // If emitOnly is true, just emit the click event and return
  if (props.emitOnly) {
    emit('messageClicked', messageId);
    return;
  }
  
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
      tab: listCacheKey.value,
      position: scrollPos
    });
  }
  
  persistLocalListCache();
  
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
  persistLocalListCache();
  // Store current route before navigation
  store.dispatch('navigation/setPreviousRoute', route.path);
  
  // Simply navigate to the new thread route
  router.push('/new-thread');
};

// Check if user has any special scopes that require modal
const hasImportScope = computed(() => {
  return store.getters['auth/hasAnyScope'](['msg.import.cursor', 'msg.import.audio']);
});

const shouldShowModal = computed(() => hasImportScope.value);

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

  // Import needs a choice; otherwise go straight to a new thread
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

// Function to check if the author is the current user
function isCurrentUserAuthor(message) {
  return isMessageAuthor(message, user.value);
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

const getListScrollContainer = () => messageListRef.value?.closest('.main-content') || null;

const getListScrollTop = () => {
  const container = getListScrollContainer();
  if (container && container.scrollTop > 0) return container.scrollTop;
  return store.getters['navigation/getListScrollPosition'](listCacheKey.value) || 0;
};

const restoreListScroll = (position) => {
  const container = getListScrollContainer();
  if (container) container.scrollTop = position;
};

const persistLocalListCache = () => {
  if (props.mode === 'custom') return;
  let messages = null;
  if (props.mode === 'inbox') {
    const byId = store.state.messages.messages;
    messages = inboxMessageIds.value.map(id => byId[id]).filter(Boolean);
  } else if (isLocalMode.value) {
    messages = localMessages.value;
  }
  if (!messages?.length) return;
  store.dispatch('navigation/saveListCache', {
    tab: listCacheKey.value,
    messages,
    currentSkip: currentSkip.value,
    isAllLoaded: isAllLoaded.value
  });
};

const applyLastDeletedMessage = (messages) => {
  const deletedId = store.getters['navigation/lastDeletedMessageId'];
  if (!deletedId) return messages;
  store.commit('navigation/SET_LAST_DELETED_MESSAGE_ID', null);
  return (messages || []).filter(m => String(m.id) !== String(deletedId));
};

const idsPrefixEqual = (a, b) => {
  if (a.length !== b.length) return false;
  return a.every((id, i) => id === b[i]);
};

const buildFetchParams = ({ skip, limit }) => {
  const fetchParams = { skip, limit };
  if (props.sourceMessageId) {
    fetchParams.sourceMessageId = props.sourceMessageId;
  }
  if (props.mode === 'incoming-links' || props.mode === 'outgoing-links') {
    fetchParams.showAllLinks = props.showAllLinks;
  }
  return fetchParams;
};

const applyFetchedPage = (response, { replace }) => {
  const messages = response?.messages || [];
  if (isLocalMode.value) {
    if (replace || currentSkip.value === 0) {
      localMessages.value = messages;
    } else {
      localMessages.value = [...localMessages.value, ...messages];
    }
  }
  if (props.mode === 'inbox') {
    const ids = messages.map(message => message?.id).filter(Boolean);
    if (replace || currentSkip.value === 0) {
      inboxMessageIds.value = ids;
    } else {
      const seen = new Set(inboxMessageIds.value);
      inboxMessageIds.value = [...inboxMessageIds.value, ...ids.filter(id => !seen.has(id))];
    }
  }
  isAllLoaded.value = !response?.has_more;
  if (response?.has_more && messages.length > 0) {
    currentSkip.value = replace ? messages.length : currentSkip.value + messages.length;
  } else if (replace) {
    currentSkip.value = messages.length;
  }
  persistLocalListCache();
};

const rowCount = () => (
  props.mode === 'inbox' ? inboxMessageIds.value.length : localMessages.value.length
);

const clearRows = () => {
  requestSerial += 1;
  isLoading.value = false;
  isAllLoaded.value = false;
  currentSkip.value = 0;
  selectedMessageIds.value.clear();
  localMessages.value = [];
  inboxMessageIds.value = [];
};

const restoreFromListCache = () => {
  if (props.mode === 'custom') return false;
  if (!isLocalMode.value && props.mode !== 'inbox') return false;
  const cached = store.getters['navigation/getListCache'](listCacheKey.value);
  if (!cached?.messages?.length) return false;
  const messages = applyLastDeletedMessage(cached.messages);
  if (props.mode === 'inbox') {
    messages.forEach(message => {
      if (message?.id && !store.state.messages.messages[message.id]) {
        store.commit('messages/SET_MESSAGE', message);
      }
    });
    inboxMessageIds.value = messages.map(message => message.id).filter(Boolean);
  } else {
    localMessages.value = messages;
  }
  currentSkip.value = cached.currentSkip;
  isAllLoaded.value = !!cached.isAllLoaded;
  return true;
};

const removeDeletedFromLocalList = () => {
  const deletedId = store.getters['navigation/lastDeletedMessageId'];
  if (!deletedId) return;
  if (!isLocalMode.value) {
    store.commit('navigation/SET_LAST_DELETED_MESSAGE_ID', null);
    return;
  }
  const filtered = applyLastDeletedMessage(localMessages.value);
  if (filtered.length !== localMessages.value.length) {
    localMessages.value = filtered;
    persistLocalListCache();
  }
};

const prefixIds = () => {
  if (props.mode === 'inbox') {
    return inboxMessageIds.value.slice(0, pageSize.value).map((id) => String(id));
  }
  return localMessages.value.slice(0, pageSize.value).map((message) => String(message.id));
};

// First page, or the pages already on screen when we already have rows.
const loadFromStart = async ({ preserveWindow = false, allowStaleRetry = true } = {}) => {
  if (!listActive.value) return;
  if (props.mode === 'custom') {
    if (!props.externalPaging) isAllLoaded.value = true;
    return;
  }
  if (requiresAuth.value && !user.value) return;

  const keepWindow = preserveWindow && rowCount() > 0;
  const limit = keepWindow ? Math.max(pageSize.value, rowCount()) : pageSize.value;
  const previousPrefix = keepWindow ? prefixIds() : [];
  const savedScroll = keepWindow ? getListScrollTop() : 0;

  const requestId = ++requestSerial;
  isLoading.value = true;
  if (!keepWindow) {
    currentSkip.value = 0;
    isAllLoaded.value = false;
  }

  try {
    const response = await store.dispatch('messages/fetchMessages', {
      mode: props.mode,
      ...buildFetchParams({ skip: 0, limit })
    });
    if (requestId !== requestSerial || !listActive.value) return;
    if (response?.stale) {
      if (allowStaleRetry && threads.value.length === 0) {
        return loadFromStart({ preserveWindow, allowStaleRetry: false });
      }
      return;
    }
    if (!response) return;

    applyFetchedPage(response, { replace: true });

    if (!keepWindow) return;
    const nextPrefix = (response.messages || []).slice(0, pageSize.value).map((message) => String(message.id));
    await nextTick();
    if (requestId !== requestSerial) return;
    if (idsPrefixEqual(previousPrefix, nextPrefix) && savedScroll > 0) {
      restoreListScroll(savedScroll);
      setTimeout(() => restoreListScroll(savedScroll), 50);
    } else if (!idsPrefixEqual(previousPrefix, nextPrefix)) {
      restoreListScroll(0);
    }
  } catch (error) {
    console.error(`[MessageList] Error loading ${props.mode} messages:`, error);
  } finally {
    if (requestId === requestSerial) isLoading.value = false;
  }
};

const loadMore = async () => {
  if (!listActive.value || isLoading.value || isAllLoaded.value) return;
  if (props.mode === 'custom') {
    if (props.externalPaging && props.hasMore) emit('load-more');
    return;
  }
  if (requiresAuth.value && !user.value) return;

  const requestId = ++requestSerial;
  isLoading.value = true;
  try {
    const response = await store.dispatch('messages/fetchMessages', {
      mode: props.mode,
      ...buildFetchParams({ skip: currentSkip.value, limit: pageSize.value })
    });
    if (requestId !== requestSerial || !listActive.value || response?.stale || !response) return;
    applyFetchedPage(response, { replace: false });
  } catch (error) {
    console.error(`[MessageList] Error loading ${props.mode} messages:`, error);
  } finally {
    if (requestId === requestSerial) isLoading.value = false;
  }
};

const showList = () => {
  if (!listActive.value) return;
  if (props.mode === 'custom') {
    if (!props.externalPaging) {
      isAllLoaded.value = true;
      isLoading.value = false;
    }
    return;
  }
  if (requiresAuth.value && !user.value) {
    isLoading.value = false;
    return;
  }
  restoreFromListCache();
  return loadFromStart({ preserveWindow: rowCount() > 0 });
};

// Search pages from outside this list. Other custom lists are already complete.
watch(
  () => [props.externalPaging, props.hasMore, props.loadingMore],
  () => {
    if (props.mode !== 'custom' || !props.externalPaging) return;
    isAllLoaded.value = !props.hasMore;
    isLoading.value = !!props.loadingMore;
  },
  { immediate: true }
);

// Spinner on the first paint. Otherwise the button shows for a frame before the fetch starts.
if (props.mode === 'custom') {
  if (!props.externalPaging) isAllLoaded.value = true;
} else {
  isLoading.value = true;
}

onMounted(() => {
  listActive.value = true;
  skipActivateLoad.value = true;
  showList();
});

onActivated(() => {
  listActive.value = true;
  if (skipActivateLoad.value) {
    skipActivateLoad.value = false;
    return;
  }
  removeDeletedFromLocalList();
  if (props.mode === 'custom' || (requiresAuth.value && !user.value)) return;
  // Rows kept in this instance belong to this principal. Refresh them in place.
  loadFromStart({ preserveWindow: rowCount() > 0 });
});

onDeactivated(() => {
  listActive.value = false;
  persistLocalListCache();
});

watch(user, (next, prev) => {
  if (next && !prev) {
    showList();
  } else if (!next && prev) {
    clearRows();
    store.dispatch('navigation/clearListCache');
  }
});

// Profile switches usually swap in another list via its key. A list that stays
// mounted (an open modal) reloads here, after the swap, and only if it is still showing.
watch(activePrincipalUid, async (next, prev) => {
  if (!next || next === prev) return;
  await nextTick();
  if (!listActive.value) return;
  clearRows();
  loadFromStart();
});

watch(selectedChannelId, (next, prev) => {
  if (next === prev) return;
  if (!['history', 'timeline'].includes(props.mode)) return;
  clearRows();
  loadFromStart();
});

const toggleInboxUnreadOnly = async () => {
  if (!isInboxMode.value || !user.value) return;
  store.commit('navigation/SET_INBOX_UNREAD_ONLY', !inboxUnreadOnly.value);
  const scrollContainer = messageListRef.value?.closest('.main-content');
  if (scrollContainer) scrollContainer.scrollTop = 0;
  clearRows();
  await loadFromStart();
};

watch(
  () => store.getters['navigation/inboxLiveRefresh'],
  (next, prev) => {
    if (next === prev) return;
    if (props.mode !== 'inbox' || !inboxUnreadOnly.value || !listActive.value) return;
    if (inboxLiveTimer) clearTimeout(inboxLiveTimer);
    inboxLiveTimer = setTimeout(() => {
      inboxLiveTimer = null;
      loadFromStart({ preserveWindow: rowCount() > 0 });
    }, 300);
  }
);

const refreshTrigger = computed(() => store.getters['navigation/refreshTrigger']);
watch(refreshTrigger, (next) => {
  if (!next || !listActive.value) return;
  store.dispatch('navigation/clearListCache', listCacheKey.value);
  clearRows();
  loadFromStart();
});

onUnmounted(() => {
  listActive.value = false;
  persistLocalListCache();
  requestSerial += 1;
  isLoading.value = false;
  if (inboxLiveTimer) clearTimeout(inboxLiveTimer);
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
      await loadFromStart();
    }
  } catch (error) {
    console.error('Error deleting message:', error);
    
    // Provide specific error message for cascade delete scenarios
    let errorMessage = 'Failed to delete message';
    
    if (error.response?.status === 404) {
      errorMessage = 'This message has already been deleted (likely when its parent was deleted)';
      // Hide confirmation modal since the message is already gone
      store.commit('ui/SET_DELETE_CONFIRM', { show: false, message: null });
      await loadFromStart();
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

// Keep local rows in sync when a message is edited in the store.
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
  if (!listActive.value) return;
  clearRows();
  showList();
});

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
      await loadFromStart();
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

    <!-- Mode description (info box) -->
    <div v-if="modeDescription && !hideInfoBox" class="mode-description">
      <span class="info-icon">ℹ</span>
      <p>{{ modeDescription }}</p>
    </div>
    <!-- Channel filter indicator: below the info box when a channel is selected -->
    <div v-if="isFilteredByChannel && !hideInfoBox" class="channel-filter-indicator">
      Filtered by channel. Change selection on the Channels tab.
    </div>

    <div v-if="!hideHeader && isInboxMode && user" class="inbox-list-toolbar">
      <label class="unread-toggle">
        <span class="unread-toggle-label">Unread</span>
        <input
          type="checkbox"
          class="unread-toggle-input"
          :checked="inboxUnreadOnly"
          aria-label="Show only conversations with unread messages"
          @change="toggleInboxUnreadOnly"
        />
        <span class="unread-toggle-track" aria-hidden="true">
          <span class="unread-toggle-thumb"></span>
        </span>
      </label>
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
          @click="loadMore" 
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

.channel-filter-indicator {
  margin: 0 auto 0 auto;
  padding: var(--space-xs) var(--space-md);
  width: 560px;
  max-width: calc(100% - var(--space-md) * 2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-style: italic;
  text-align: center;
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

.inbox-list-toolbar {
  width: 100%;
  max-width: var(--content-max-width, 900px);
  margin-left: auto;
  margin-right: auto;
  padding-left: 2px;
  padding-right: 2px;
  box-sizing: border-box;
}

.unread-toggle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  width: 100%;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
  padding: 0 8px;
  box-sizing: border-box;
  cursor: pointer;
  user-select: none;
}

.unread-toggle-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.unread-toggle-input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
  margin: 0;
}

.unread-toggle-track {
  position: relative;
  box-sizing: border-box;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  background: var(--color-surface-light);
  border: 1px solid var(--color-border);
  transition: background-color 0.15s ease, border-color 0.15s ease;
  flex-shrink: 0;
}

.unread-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-text-secondary);
  transition: transform 0.15s ease, background-color 0.15s ease;
}

.unread-toggle-input:checked + .unread-toggle-track {
  background: var(--color-secondary);
  border-color: var(--color-secondary);
}

.unread-toggle-input:checked + .unread-toggle-track .unread-toggle-thumb {
  transform: translateX(18px);
  background: #fff;
}

.unread-toggle-input:focus-visible + .unread-toggle-track {
  outline: 2px solid var(--color-secondary);
  outline-offset: 2px;
}

.unread-toggle:has(.unread-toggle-input:checked) .unread-toggle-label {
  color: var(--color-text);
}

/*
.mark-all-read-button {
  background-color: transparent;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-fast), opacity var(--transition-fast);
  min-width: 160px;
}

.mark-all-read-button:hover:not(:disabled) {
  background-color: rgba(0, 0, 0, 0.04);
}

.mark-all-read-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
*/

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

  .unread-toggle {
    padding: 0 5px;
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

  .inbox-list-toolbar {
    margin: 0;
    padding-left: 4px;
    padding-right: 4px;
  }
  
  .channel-filter-indicator {
    width: calc(100% - var(--space-md) * 2);
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
