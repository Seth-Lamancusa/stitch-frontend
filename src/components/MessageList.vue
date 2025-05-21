<script setup>
import { computed, onMounted, ref, onUnmounted, nextTick, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute } from 'vue-router';
import { initializeFirebase } from '../firebase';
import MessageService from '../services/MessageService';
import MessageNode from './MessageNode.vue';
import ProfileFilter from './ProfileFilter.vue';

/**
 * MessageList component displays a list of message threads based on the current route.
 * Public messages (/messages/public) - Shows pinned public messages
 * Direct messages (/messages/direct) - Shows private messages for the current user
 * Profile messages (/messages/profile) - Shows messages authored by the current user
 * Local messages (/messages/local) - Shows locally stored messages
 */

const store = useStore();
const router = useRouter();
const route = useRoute();

// Track loading states per tab - simplified
const loadingStates = ref({
  feed: {
    isLoading: false,
    isAllLoaded: false
  },
  curated: {
    isLoading: false,
    isAllLoaded: false
  },
  private: {
    isLoading: false,
    isAllLoaded: false
  },
  profile: {
    isLoading: false,
    isAllLoaded: false
  },
  local: {
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
  return ['private', 'profile'].includes(activeTab.value) && shouldShowEmptyState.value;
});

// Track cursors for each tab
const cursors = ref({
  feed: null,
  curated: null,
  private: null,
  profile: null,
  local: null
});

// Reference to the message list container for scroll detection
const messageListRef = ref(null);

// Reference to the loading indicator for intersection observer
const loadingIndicatorRef = ref(null);

// Profile filter state from store
const selectedProfileFilter = computed(() => store.getters['messages/getSelectedProfile']);

// Determine active tab from route path
const activeTab = computed(() => {
  const path = route.path;
  if (path.includes('/direct')) return 'private';
  if (path.includes('/profile')) return 'profile';
  if (path.includes('/local')) return 'local';
  if (path.includes('/curated')) return 'curated';
  if (path.includes('/feed')) return 'feed';
  return 'feed'; // Default tab
});

const messageListTitle = computed(() => {
  switch (activeTab.value) {
    case 'feed': return 'Feed Messages';
    case 'curated': return 'Curated Messages';
    case 'private': return 'Direct Messages';
    case 'profile': return 'My Messages';
    case 'local': return 'Local Messages';
    default: return 'Messages';
  }
});

const threads = computed(() => {
  const allMessages = store.getters['messages/getLoadedMessages'] || [];
  const currentUser = store.getters['auth/user'];
  const currentUid = currentUser?.uid;
  
  // Filter messages based on the for_tabs array
  let filteredMessages = allMessages.filter(msg => {
    // Check if the message belongs to the current tab
    // Either via the legacy for_tab property or the new for_tabs array
    return (msg.for_tabs && Array.isArray(msg.for_tabs) && msg.for_tabs.includes(activeTab.value)) || 
           msg.for_tab === activeTab.value;
  });
  
  // Apply profile filter if we're in the profile tab and have a selected profile
  if (activeTab.value === 'profile' && selectedProfileFilter.value) {
    filteredMessages = filteredMessages.filter(msg => {
      // Check all possible match conditions (implement OR logic)
      
      // 1. User tag match (most reliable in new data)
      if (msg.author_user_tag && selectedProfileFilter.value.user_tag && 
          msg.author_user_tag === selectedProfileFilter.value.user_tag) {
        return true;
      }
      
      // 2. UID match (content_author often contains the UID)
      if (msg.content_author && selectedProfileFilter.value.uid && 
          msg.content_author === selectedProfileFilter.value.uid) {
        return true;
      }
      
      // 3. Email matches user tag (for backward compatibility)
      if (msg.author_email && selectedProfileFilter.value.user_tag && 
          msg.author_email === selectedProfileFilter.value.user_tag) {
        return true;
      }
      
      // 4. Display name match (less reliable but can be useful)
      if (msg.author_display_name && selectedProfileFilter.value.display_name && 
          msg.author_display_name === selectedProfileFilter.value.display_name) {
        return true;
      }
      
      // No match found
      return false;
    });
  }
  
  // For curated tab, sort by curation score/ranking
  if (activeTab.value === 'curated') {
    // Sort by curation score (higher scores first), then by timestamp
    return filteredMessages.sort((a, b) => {
      const scoreA = a.curation_score || 0;
      const scoreB = b.curation_score || 0;
      
      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Higher scores first
      }
      
      // If scores are equal, sort by timestamp (newest first)
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  }
  
  // For feed tab, sort by pinned status first, then timestamp
  if (activeTab.value === 'feed') {
    return filteredMessages.sort((a, b) => {
      const aIsPinned = a.is_pinned === 1 || a.is_pinned === true;
      const bIsPinned = b.is_pinned === 1 || b.is_pinned === true;
      
      // If pinned status differs, prioritize pinned messages
      if (aIsPinned !== bIsPinned) {
        return aIsPinned ? -1 : 1;
      }
      
      // Otherwise sort by timestamp
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  }
  
  // For all other tabs, just sort by timestamp (newest first)
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
  // Check if we already have messages for this tab
  const tabMessages = store.getters['messages/getLoadedMessages'].filter(
    msg => {
      return (msg.for_tabs && Array.isArray(msg.for_tabs) && msg.for_tabs.includes(tabName)) || 
             msg.for_tab === tabName;
    }
  );
  
  return (
    // No messages for this tab
    tabMessages.length === 0 ||
    // Or special case for feed tab - always reload if no pinned messages found
    (tabName === 'feed' && !tabMessages.some(msg => msg.is_pinned))
  );
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
          if (newTab === 'feed') {
            console.log(`[Debug] Feed tab needs a full refresh to get pinned+regular messages`);  
          }
          
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
    
    // Get current cursor for this tab
    const cursor = cursors.value[tabName];
    console.log(`[Debug] Using cursor for ${tabName}:`, cursor);
    
    // Use different endpoint based on tab name
    let response;
    switch (tabName) {
      case 'feed':
        response = await store.dispatch('messages/fetchFeedMessages', { cursor });
        break;
      case 'curated':
        response = await store.dispatch('messages/fetchCuratedMessages', { cursor });
        break;
      case 'private':
        response = await store.dispatch('messages/fetchDirectMessages', { cursor });
        break;
      case 'profile':
        if (selectedProfileFilter.value) {
          // Pass user ID to ensure the API can find the right user
          response = await store.dispatch('messages/fetchUserMessages', { 
            cursor,
            userId: selectedProfileFilter.value.uid
          });
        } else if (user.value) {
          // If no filter but user is logged in, show their own messages
          response = await store.dispatch('messages/fetchUserMessages', { 
            cursor,
            userId: user.value.uid
          });
        } else {
          // Fallback: no filter, no logged in user - show general messages
          response = await store.dispatch('messages/fetchUserMessages', { cursor });
        }
        break;
      case 'local':
        // Local messages are stored client-side, no API call needed
        break;
      default:
        response = await store.dispatch('messages/fetchFeedMessages', { cursor });
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
        
        // Special case for feed tab: If this was the initial load (pinned messages)
        // and cursor is specifically "PINNED_DONE", immediately load the next batch (regular messages)
        if (isInitial && tabName === 'feed' && response.nextCursor === "PINNED_DONE" && activeTab.value === 'feed') {
          console.log('[Debug] Feed tab: Pinned messages loaded, immediately loading regular messages');
          // We need to wait a tick to avoid state conflicts
          await nextTick();
          // Set loading state to false temporarily to avoid loading conflict
          loadingStates.value[tabName].isLoading = false;
          // Load regular messages
          await loadMessages(false);
        }
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
  if (newVal !== oldVal && activeTab.value === 'private') {
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
</script>

<template>
  <div class="message-list" ref="messageListRef">
    <!-- Tab info boxes - now inside the message list so they scroll with content -->
    <div v-if="activeTab === 'feed'" class="tab-info">
      <p>All public messages in reverse chronological order.</p>
      <p>Pinned messages appear at the top.</p>
    </div>
    
    <div v-if="activeTab === 'curated'" class="tab-info">
      <p>Curated messages selected based on quality and relevance.</p>
      <p>Feature under development.</p>
    </div>
    
    <div v-if="activeTab === 'private'" class="tab-info">
      <p>Direct messages sent to you specifically.</p>
      <p>Reverse chronological order.</p>
    </div>
    
    <div v-if="activeTab === 'profile'" class="tab-info">
      <p>All messages you've created, both public and private.</p>
      <p>Listed in reverse chronological order.</p>
      <p>Filter by username or tag to view other profiles.</p>
    </div>
    
    <!-- Profile Filter Component - only shown in profile tab -->
    <ProfileFilter 
      v-if="activeTab === 'profile'"
    />
    
    <div v-if="activeTab === 'local'" class="tab-info local-message-info">
      <p>This tab will display messages saved to your local filesystem.</p>
      <p>Feature coming soon.</p>
    </div>

    <!-- Empty state - only shown when no messages and not loading -->
    <div v-if="shouldShowEmptyState" class="empty-state">
      <!-- Show login message for auth-dependent tabs -->
      <div v-if="shouldShowLoginMessage">
        <p>Please log in to view {{ activeTab === 'private' ? 'direct' : 'your' }} messages.</p>
        <p>The {{ activeTab === 'private' ? 'Direct' : 'Profile' }} tab requires authentication.</p>
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
  </div>
</template>

<style scoped>
.message-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  padding: var(--space-md);
  gap: var(--space-md);
  scroll-behavior: smooth;
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
  margin-bottom: var(--space-md);
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
</style> 