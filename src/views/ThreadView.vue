<template>
  <div class="thread-view">
    <!-- Loading states -->
    <div v-if="!isAuthReady" class="auth-loading">
      <p>Loading...</p>
    </div>
    
    <div v-else-if="isLoading || isInitialLoading" class="loading-indicator">
      <div class="loading-spinner"></div>
      <p>Loading thread...</p>
    </div>
    
    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>
    
    <!-- For temporary threads, show the TempThreadView component -->
    <temp-thread-view v-else-if="isTemporaryThread" />
    
    <template v-else-if="displayedMessages.length > 0">
      <!-- Thread header with navigation back and title -->
      <div class="thread-header">
        <button @click="backToList()" class="back-button">
          &larr; Back
        </button>
        <h2 class="thread-title">{{ rootMessage?.title || 'Untitled Thread' }}</h2>
      </div>
      
      <!-- Messages container with fixed spacing -->
      <div class="messages-container" ref="messageList">
      <!-- Top of thread marker -->
      <adaptive-marker
        v-if="displayedMessages.length > 0 && isTopOfThread"
        state="end"
        position="top"
        class-name="thread-begin-marker"
      />
      
        <!-- Loading node for earlier messages at top of thread -->
        <div v-if="canLoadMoreParents" class="parent-loading-container">
        <adaptive-marker 
          position="top"
          :state="getParentLoadingState()"
            @load-more="() => { loadMoreParents(); }"
            @retry="() => { loadMoreParents(); }"
          />
        </div>
        
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
            :parent-total-replies="message.parent_id ? getTotalRepliesCount(message.parent_id) : 0"
            :can-reply="canInteract"
            :has-prev-sibling="hasPrevSibling(message.id)"
            :has-next-sibling="hasNextSibling(message.id)"
            :is-first-sibling="isFirstSibling(message.id)"
            :is-last-loaded-sibling="isLastLoadedSibling(message.id)" 
            :is-last-sibling="isLastSibling(message.id)"
            :sibling-position="getSiblingPosition(message.id)"
            :show-sibling-nav="message.parent_id && (getTotalRepliesCount(message.parent_id) > 0)"
            @navigate="navigateSiblings(message.parent_id, $event)"
            @click="selectMessage(message.id)"
            @delete="confirmDeleteMessage"
          />
          
          <!-- Loading indicator for selected message -->
          <div v-if="message.id === selectedMessageId && isSelectedMessageLoading" class="message-loading">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading message...</div>
          </div>
          
          <!-- If this is the last message, show appropriate marker (loading/end of branch) -->
          <adaptive-marker 
            v-if="index === displayedMessages.length - 1" 
            position="bottom"
            :state="getEndMarkerState(message.id)"
            @load-more="loadMoreChildren"
            @retry="loadMoreChildren"
          />
        </template>
      </div>
      
      <!-- Reply box component -->
      <reply-box 
        :target-id="replyTargetId"
        :can-interact="canInteract"
        @send="sendReply"
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
          <button @click="store.dispatch('ui/hideDeleteConfirm')" class="cancel-button">
            Cancel
          </button>
          <button @click="deleteMessage" class="delete-button">
            Delete
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
import { getFirebaseAuth, initializeFirebase } from '../firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import MessageNode from '../components/MessageNode.vue';
import AdaptiveMarker from '../components/AdaptiveMarker.vue';
import ReplyBox from '../components/ReplyBox.vue';
import TempThreadView from '../views/TempThreadView.vue';
import MessageService from '../services/MessageService';
import WebSocketService from '../services/WebSocketService';

// Setup store and routing
const store = useStore();
const route = useRoute();
const router = useRouter();

// Refs
const messageList = ref(null);
let unsubscribeAuth = null;
let unsubscribeMessages = null;

// Message ID from route
const messageId = computed(() => {
  const id = route.params.id;
  // Check if this is a temporary thread ID (starts with 'temp-')
  if (typeof id === 'string' && id.startsWith('temp-')) {
    return id;
  }
  return Number(id);
});

// Computed properties from namespaced store modules
const user = computed(() => store.getters['auth/user']);
const isWhitelisted = computed(() => store.getters['auth/isWhitelisted']);
const canInteract = computed(() => store.getters['auth/canInteract']);
const isAuthReady = computed(() => store.getters['auth/authReady']);
const isLoading = computed(() => store.getters['ui/isLoading']('messages'));
const error = computed(() => store.getters['ui/error']);
const isTemporaryThread = computed(() => store.getters['ui/isTemporaryThread']);
const showDeleteConfirm = computed(() => store.getters['ui/showDeleteConfirm']);
const messageToDelete = computed(() => store.getters['ui/messageToDelete']);

// Navigation state from namespaced navigation module
const selectedMessageId = computed(() => store.getters['navigation/selectedMessageId']);
const isSelectedMessageLoading = computed(() => store.getters['navigation/isSelectedMessageLoading']);
const replyTargetId = computed(() => store.getters['navigation/replyTargetId']);

// Message display
const displayedMessages = computed(() => {
  const msgs = store.getters['messages/getVisibleBranchMessages'];
  console.log(`[DEBUG UI] displayedMessages computed property updated, found ${msgs.length} messages: ${msgs.map(m => m.id).join(', ')}`);
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
const canLoadMoreParents = computed(() => {
  if (displayedMessages.value.length === 0) return false;
  
  const firstMessage = displayedMessages.value[0];
  // Simple check: has parent_id and not currently loading
  return firstMessage.parent_id && !store.getters['messages/isLoading'](firstMessage.id, 'parents');
});

const canLoadMoreChildren = computed(() => {
  if (displayedMessages.value.length === 0) return false;
  
  const lastMessage = displayedMessages.value[displayedMessages.value.length - 1];
  // Has children according to backend and not currently loading
  return lastMessage.has_children && !store.getters['messages/isLoading'](lastMessage.id, 'children');
});

// Simplified marker state functions
const getParentLoadingState = () => {
  if (displayedMessages.value.length === 0) return 'loading';
  
  const firstMessage = displayedMessages.value[0];
  
  if (!firstMessage.parent_id) return 'end'; // No parent = beginning of thread
  if (store.getters['messages/isLoading'](firstMessage.id, 'parents')) return 'loading';
  
  return canLoadMoreParents.value ? 'loading' : 'end';
};

const getEndMarkerState = (messageId) => {
  // Get the message
  const message = store.getters['messages/getMessage'](messageId);
  if (!message) {
    return 'end'; // If message doesn't exist, we're at the end
  }
  
  // Check if this is the last message in our displayed chain
  const isLastDisplayed = displayedMessages.value.length > 0 && 
                         displayedMessages.value[displayedMessages.value.length - 1].id === messageId;
  if (!isLastDisplayed) {
    return 'end'; // Only show markers for the last displayed message
  }
  
  // Case 1: We're currently loading children
  const isLoading = store.getters['messages/isLoading'](messageId, 'children');
  if (isLoading) {
    return 'loading';
  }
  
  // Case 2: Check has_children flag directly from the message
  // This is the definitive source of truth from the backend
  if (message.has_children) {
    return 'loading'; // Show loading marker if has_children is true
  }
  
  // Otherwise, we're at the end of the branch
  return 'end';
};

// Add a new computed property for initial loading state
const isInitialLoading = computed(() => {
  // Check if target message is still loading
  if (!messageId.value) return false;
  return store.getters['messages/isLoading'](messageId.value, 'message');
});

// Helper function to find the end of branch message
const findEndOfBranchMessage = () => {
  if (!displayedMessages.value || displayedMessages.value.length === 0) {
    return null;
  }
  
  // Get the last message in the displayed chain
  const lastMessage = displayedMessages.value[displayedMessages.value.length - 1];
  return lastMessage;
};

// Wrapper functions for convenient calling
const loadMoreParents = async () => {
  // Get reference to the messages container
  const messagesContainer = document.querySelector('.messages-container');
  if (!messagesContainer) {
    await loadMessages('parents');
    return;
  }
  
  // Capture and cache HTML content of the first visible message to use as an anchor
  // This is more reliable than relying on element references which might change
  if (displayedMessages.value.length === 0) {
    await loadMessages('parents');
    return;
  }
  
  // Measure the current scroll position and container heights
  const scrollTop = messagesContainer.scrollTop;
  const oldScrollHeight = messagesContainer.scrollHeight;
  
  // Find a specific message element (second one if available, or first if not)
  // Using the second one gives us a better anchor point that won't be affected by the loading UI
  const messageElements = messagesContainer.querySelectorAll('.message-node');
  const anchorElement = messageElements.length > 1 ? messageElements[1] : messageElements[0];
  
  if (!anchorElement) {
    await loadMessages('parents');
    return;
  }
  
  // Save its position relative to the viewport
  const anchorTop = anchorElement.getBoundingClientRect().top;
  const anchorId = anchorElement.getAttribute('data-message-id') || 'unknown';
  
  // Load new content
  await loadMessages('parents');
  
  // Immediately adjust scroll to maintain relative position
  // This needs to happen synchronously before any browser repaints
  requestAnimationFrame(() => {
    // Get the new scroll height after content was added
    const newScrollHeight = messagesContainer.scrollHeight;
    
    // Calculate how much content was added
    const heightDifference = newScrollHeight - oldScrollHeight;
    
    // Adjust scroll position to maintain the same view
    if (heightDifference > 0) {
      messagesContainer.scrollTop = scrollTop + heightDifference;
    }
  });
};

const loadMoreChildren = () => {
  loadMessages('children');
};

// Unified loading function
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
  
  // Set loading state
  store.commit('messages/SET_LOADING_STATE', {
    id: targetId,
    type: direction,
    status: 'loading'
  }, { root: true });
  
  try {
    // For parents, we load parent branch with depth 2
    if (direction === 'parents') {
      await store.dispatch('messages/loadMessageBranchUp', {
        messageId: targetId,
        depth: 2
      });
      
      // Initialize sibling navigation for newly loaded parents
      const newParentId = store.getters['messages/getParentId'](targetId);
      if (newParentId) {
        store.dispatch('navigation/setInitialChild', newParentId);
      }
    }
    // For children, we load child branch with depth 2
    else if (direction === 'children') {
      await store.dispatch('messages/loadMessageBranchDown', {
        messageId: targetId,
        depth: 2
      });
      
      // Initialize sibling navigation for any newly loaded messages with children
      const childIds = store.getters['messages/getChildIds'](targetId);
      if (childIds && childIds.length > 0) {
        // For this message's children
        store.dispatch('navigation/setInitialChild', targetId);
        
        // Also for any of those children that have their own children
        for (const childId of childIds) {
          if (store.getters['messages/getChildIds'](childId).length > 0) {
            store.dispatch('navigation/setInitialChild', childId);
          }
        }
      }
    }
    
    // Mark as loaded 
    store.commit('messages/SET_LOADING_STATE', {
      id: targetId,
      type: direction,
      status: 'loaded'
    }, { root: true });
  } catch (error) {
    console.error(`Error loading ${direction}:`, error);
    store.commit('messages/SET_LOADING_STATE', {
      id: targetId,
      type: direction,
      status: 'error'
    }, { root: true });
  }
};

// Replace initial loadMessageChain with the new approach
const loadInitialMessage = async (id) => {
  try {
    // Use the loadInitialMessage action that loads the initial branch
    await store.dispatch('messages/loadInitialMessage', id);
    
    // Check if the first message has a parent that's not loaded
    const firstMsg = displayedMessages.value[0];
    
    // Initialize sibling navigation for all messages with parents
    // This fixes the "0 / N" issue when directly navigating to a reply
    for (const msg of displayedMessages.value) {
      if (msg.parent_id) {
        store.dispatch('navigation/setInitialChild', msg.parent_id);
      }
    }
    
    // Find end-of-branch message to ensure WebSocket subscriptions
    const endOfBranch = findEndOfBranchMessage();
    if (endOfBranch) {
      unsubscribeMessages = await store.dispatch('messages/subscribeToEndOfBranchMessages');
    }
  } catch (error) {
    console.error("Error loading initial message:", error);
    error.value = "Failed to load message. Please try again.";
  }
};

// Lifecycle hooks
onMounted(async () => {
  try {
    // Initialize Firebase for authentication
    await initializeFirebase();
    
    // Set up auth state listener and ensure authReady is set
    const auth = getFirebaseAuth();
    if (auth) {
      // Set a timeout to prevent infinite loading if auth state never resolves
      const authTimeout = setTimeout(() => {
        console.warn("Auth state didn't resolve in time, forcing auth ready state");
        store.commit('auth/SET_AUTH_READY', true);
      }, 5000);
      
      unsubscribeAuth = onAuthStateChanged(auth, (userData) => {
        if (userData) {
          store.commit('auth/SET_USER', {
            uid: userData.uid,
            email: userData.email,
            displayName: userData.displayName
          });
          
          if (userData.email) {
            // Register the user in our database
            store.dispatch('auth/registerUser', userData);
            
            store.dispatch('auth/checkWhitelistStatus', userData.email);
            store.dispatch('auth/checkAdminStatus', userData.email);
          }
        } else {
          store.commit('auth/SET_USER', null);
        }
        
        // Ensure auth is marked as ready
        store.commit('auth/SET_AUTH_READY', true);
        clearTimeout(authTimeout);
      });
    } else {
      // If no auth object, still mark auth as ready
      store.commit('auth/SET_AUTH_READY', true);
    }
    
    // Wait for auth to be ready before proceeding
    if (!store.getters['auth/authReady']) {
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
    
    // Initialize message from route
    if (messageId.value) {
      
      if (isTemporaryThread.value) {
        // Special case for temporary threads
        // Just set the message as selected, TempThreadView will handle the rest
        store.dispatch('navigation/selectMessage', messageId.value);
      } else {
        // For real threads, load from API with the new approach
        await loadInitialMessage(messageId.value);
        
        // Select the message to display it in the UI
        store.dispatch('navigation/selectMessage', messageId.value);
      }
    }
    
    // Set up WebSocket subscription for real-time updates once messages are loaded
    if (displayedMessages.value.length > 0) {
      const visibleMessageIds = displayedMessages.value.map(msg => msg.id);
      const lastMessageId = displayedMessages.value[displayedMessages.value.length - 1].id;
      
      // Set up WebSocket subscription
      unsubscribeMessages = await store.dispatch('messages/subscribeToEndOfBranchMessages');
    }
    
    // Add keyboard navigation
    document.addEventListener('keydown', handleKeyDown);
    
    // Code to center selected message after loading
    nextTick(() => {
      if (selectedMessageId.value) {
        const selectedElement = document.querySelector(`.message-node.selected`);
        if (selectedElement) {
          selectedElement.scrollIntoView({
            behavior: "auto",
            block: "center"
          });
        }
      }
    });
  } catch (error) {
    console.error('Error in ThreadView onMounted:', error);
    // Ensure auth is ready even if there's an error
    store.commit('auth/SET_AUTH_READY', true);
  }
});

onBeforeUnmount(() => {
  // Clean up listeners
  if (unsubscribeAuth) {
    unsubscribeAuth();
  }
  
  if (unsubscribeMessages) {
    unsubscribeMessages();
  }
  
  document.removeEventListener('keydown', handleKeyDown);
});

// Watch for route changes
watch(messageId, async (newId) => {
  if (newId && newId !== selectedMessageId.value) {
    // Use the same selectMessage function to ensure loading states are handled correctly
    await selectMessage(newId);
  }
});

// Watch for selected message changes to ensure reply settings are always in sync
watch(selectedMessageId, () => {
  // Remove call to syncReplySettingsWithSelectedMessage since it's now automatic
  // Settings are synced automatically when selecting a message
}, { immediate: true });

// Add a watcher to log changes in the key conditions
watch([displayedMessages, isTopOfThread, canLoadMoreParents], ([newMessages]) => {
  console.log(`[DEBUG Thread] displayedMessages updated: ${newMessages.map(m => m.id).join(', ')}`);
}, { immediate: true });

// Add new watch to center the selected message when it changes
watch(selectedMessageId, (newId) => {
  console.log(`[DEBUG Thread] selectedMessageId changed to: ${newId}`);
  if (newId) {
    nextTick(() => {
      // Find the selected message element
      const selectedElement = document.querySelector(`.message-node.selected`);
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: "auto",
          block: "center"
        });
      }
    });
  }
}, { immediate: true });

// Methods
const initAuth = async () => {
  try {
    await initializeFirebase();
    const auth = getFirebaseAuth();
    
    if (auth) {
      unsubscribeAuth = onAuthStateChanged(auth, (userData) => {
        store.commit('auth/SET_USER', {
          uid: userData.uid,
          email: userData.email,
          displayName: userData.displayName
        });
        
        if (userData.email) {
          store.dispatch('auth/checkWhitelistStatus', userData.email);
          store.dispatch('auth/checkAdminStatus', userData.email);
        }
      });
    } else {
      store.commit('auth/SET_AUTH_READY', true);
    }
  } catch (error) {
    console.error('Error initializing auth:', error);
    store.commit('auth/SET_AUTH_READY', true);
  }
};

// Message loading
const loadMoreReplies = async (parentId) => {
  const loadedCount = getLoadedRepliesCount(parentId);
  
  try {
    // Set loading state
    store.commit('messages/SET_LOADING_STATE', { 
      id: parentId, 
      type: 'children', 
      status: 'loading' 
    }, { root: true });
    
    // Get reply IDs
    const response = await MessageService.getReplyIds(parentId);
    const replyIds = response.data.reply_ids || [];
    
    // Load the messages
    if (replyIds.length > 0) {
      await store.dispatch('messages/loadMessagesIfNeeded', replyIds);
      
      // Set up relationships
      replyIds.forEach(replyId => {
        store.commit('messages/SET_RELATIONSHIP', {
          parentId: parentId,
          childId: replyId
        }, { root: true });
      });
      
      // Update reply count
      store.commit('messages/SET_REPLY_COUNT', {
      messageId: parentId,
        count: replyIds.length
      }, { root: true });
    }
    
    // Set loading state to loaded
    store.commit('messages/SET_LOADING_STATE', { 
      id: parentId, 
      type: 'children', 
      status: 'loaded' 
    }, { root: true });
  } catch (error) {
    console.error('Error loading more replies:', error);
    store.commit('messages/SET_LOADING_STATE', { 
      id: parentId, 
      type: 'children', 
      status: 'error' 
    }, { root: true });
  }
};

// Display helpers
const getMessageIndent = (id) => {
  let indent = 0;
  let currentId = id;
  
  while (true) {
    const parentId = store.getters['messages/getParentId'](currentId);
    if (!parentId) break;
    
    indent += 1;
    currentId = parentId;
  }
  
  return indent;
};

const getLoadedRepliesCount = (parentId) => {
  return store.getters['messages/getChildIds'](parentId).length;
};

const getTotalRepliesCount = (parentId) => {
  return store.getters['messages/getReplyCount'](parentId);
};

// Navigation
const backToList = () => {
  router.push('/chat');
};

// Message selection and reply
const selectMessage = async (id) => {
  // If we were already selecting the same message, do nothing
  if (id === selectedMessageId.value) return;
  
  // Simply select the message in the store, no loading needed
  store.dispatch('navigation/selectMessage', id);
};

const sendReply = async ({ content, isPublic, recipients }) => {
  if (!content.trim()) return;
  
  // Make sure we have a user and email
  if (!user.value || !user.value.email) {
    store.commit('ui/SET_ERROR', 'You need to be logged in to send messages.');
    return;
  }
  
  try {
    // For existing threads, add a reply
    const newMessage = await store.dispatch('messages/sendReply', {
      parentId: replyTargetId.value,
      content: content,
      isPrivate: !isPublic,
      recipients,
      // Ensure the author is explicitly set to the user's email
      content_author: user.value.email
    });
    
    // IMPORTANT: Immediately subscribe to the new message ID
    WebSocketService.subscribeToMessage(newMessage.id);
    
    // Select the new reply
    selectNewReply(replyTargetId.value, newMessage.id);
  } catch (error) {
    console.error('Error sending reply:', error);
    store.commit('ui/SET_ERROR', 'Failed to send message. Please try again.');
  }
};

// Thread actions
const refreshThread = async () => {
  if (messageId.value) {
    await store.dispatch('messages/loadInitialMessage', messageId.value);
  }
};

const confirmDeleteMessage = (message) => {
  store.dispatch('ui/showDeleteConfirm', message);
};

const deleteMessage = async () => {
  if (!messageToDelete.value) return;
  
  const deletedId = messageToDelete.value.id;
  const deletedParentId = messageToDelete.value.parent_id;
  
  try {
    store.commit('ui/SET_DELETE_CONFIRM', { show: false, message: null });
    
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
      return;
    }
    
    // Refresh the thread or go back to thread list if root was deleted
    if (deletedParentId) {
      refreshThread();
    } else {
      router.push('/chat');
    }
    
    // Important: Re-evaluate the end marker state for any parents
    if (displayedMessages.value.length > 0) {
      const lastMessageId = displayedMessages.value[displayedMessages.value.length - 1].id;
      const lastMessage = store.getters['messages/getMessage'](lastMessageId);
      
      // Update the has_children property if needed
      if (lastMessage && lastMessage.has_children) {
        const childIds = store.getters['messages/getChildIds'](lastMessageId);
        if (childIds.length === 0) {
          // No more children, update the flag
          store.dispatch('messages/updateMessage', {
            id: lastMessageId,
            has_children: false
          });
        }
      }
    }
  } catch (error) {
    console.error('Error deleting message:', error);
    store.commit('ui/SET_ERROR', 'Failed to delete message: ' + error.message);
    refreshThread();
  }
};

// Sibling navigation helpers
const hasPrevSibling = (id) => {
  // Get message parent
  const parentId = store.getters['messages/getParentId'](id);
  if (!parentId) return false;
  
  // Get sibling info from parent's children
  const siblingInfo = store.getters['navigation/getSiblingInfo'](parentId);
  
  // If total count is 1, there's no previous sibling regardless of position
  if (siblingInfo.totalCount <= 1) return false;
  
  // Otherwise check if position is greater than 1 (since position is 1-indexed)
  return siblingInfo.position > 1;
};

const hasNextSibling = (id) => {
  // Get message parent
  const parentId = store.getters['messages/getParentId'](id);
  if (!parentId) return false;
  
  // Get sibling info
  const siblingInfo = store.getters['navigation/getSiblingInfo'](parentId);
  
  // If total count is 1, there's no next sibling regardless of position
  if (siblingInfo.totalCount <= 1) return false;
  
  // Otherwise check if position is less than total count
  return siblingInfo.position < siblingInfo.totalCount;
};

const isFirstSibling = (id) => {
  const parentId = store.getters['messages/getParentId'](id);
  if (!parentId) return true; // Root message is first by default
  
  const siblingInfo = store.getters['navigation/getSiblingInfo'](parentId);
  return siblingInfo.isFirst;
};

const isLastSibling = (id) => {
  const parentId = store.getters['messages/getParentId'](id);
  if (!parentId) return true; // Root message is last by default
  
  // Compare with total count from server
  const siblingInfo = store.getters['navigation/getSiblingInfo'](parentId);
  return siblingInfo.isLast; // Now uses the corrected getter
};

const isLastLoadedSibling = (id) => {
  const parentId = store.getters['messages/getParentId'](id);
  if (!parentId) return true;
  
  // Compare with loaded count
  const siblingInfo = store.getters['navigation/getSiblingInfo'](parentId);
  return siblingInfo.isLastLoaded;
};

const getSiblingPosition = (id) => {
  const parentId = store.getters['messages/getParentId'](id);
  if (!parentId) return 0; // Root message
  
  const siblingInfo = store.getters['navigation/getSiblingInfo'](parentId);
  return siblingInfo.position;
};

const hasMultipleChildren = (parentId) => {
  if (!parentId) return false;
  return store.getters['messages/getChildIds'](parentId).length > 1;
};

const childCount = (parentId) => {
  return store.getters['messages/getChildIds'](parentId).length;
};

// Check if a message has any more children to load
const hasMoreChildren = (messageId) => {
  const message = store.getters['messages/getMessage'](messageId);
  if (!message) return false;
  
  // Simply check if the message has children according to backend
  return message.has_children;
};

// Navigation methods
const navigateSiblings = async (parentId, direction) => {
  // Set loading state for this operation
  store.commit('messages/SET_LOADING_STATE', { 
    id: parentId, 
    type: 'children', 
    status: 'loading' 
  }, { root: true });
  
  try {
    // First, get the reply IDs
    const response = await MessageService.getReplyIds(parentId);
    const replyIds = response.data.reply_ids || [];
    
    // Then load all those messages
    if (replyIds.length > 0) {
      await store.dispatch('messages/loadMessagesIfNeeded', replyIds);
      
      // Set up relationships with parent
      replyIds.forEach(replyId => {
        store.commit('messages/SET_RELATIONSHIP', {
          parentId: parentId,
          childId: replyId
        }, { root: true });
      });
      
      // Set reply count
      store.commit('messages/SET_REPLY_COUNT', {
        messageId: parentId,
        count: replyIds.length
      }, { root: true });
      
      // Make sure navigation state is properly initialized 
      // This ensures we have proper sibling positions
      store.dispatch('navigation/setInitialChild', parentId);
    }
    
    // Then navigate to the appropriate sibling
    store.dispatch('navigation/navigateToSibling', { parentId, direction });
    
    // Set loading state back to loaded
    store.commit('messages/SET_LOADING_STATE', { 
      id: parentId, 
      type: 'children', 
      status: 'loaded' 
    }, { root: true });
  } catch (error) {
    console.error('Error navigating siblings:', error);
    store.commit('messages/SET_LOADING_STATE', { 
      id: parentId, 
      type: 'children', 
      status: 'error' 
    }, { root: true });
  }
};

// After sending a reply, set it as the current child
const selectNewReply = (parentId, newReplyId) => {
  store.commit('navigation/SET_CURRENT_CHILD', { 
    parentId, 
    childId: newReplyId 
  });
  store.dispatch('navigation/selectMessage', newReplyId);
};

// Keyboard navigation
const handleKeyDown = (event) => {
  if (!displayedMessages.value.length) return;
  
  // Only handle if not in a text input
  if (event.target.tagName === 'TEXTAREA' || 
      event.target.tagName === 'INPUT') {
    return;
  }
  
  if (event.key === 'ArrowLeft') {
    navigateSiblings('prev');
    event.preventDefault();
  } else if (event.key === 'ArrowRight') {
    navigateSiblings('next');
    event.preventDefault();
  }
};

// In the script setup section, add this watch for visible messages
watch(displayedMessages, async (newMessages) => {
  // If we have messages loaded, ensure we're subscribed to them for real-time updates
  if (newMessages.length > 0) {
    // Get the visible message IDs
    const visibleMessageIds = newMessages.map(msg => msg.id);
    
    // Get the last message ID (for special handling in WebSocket service)
    const lastMessageId = newMessages[newMessages.length - 1].id;
    
    // Update WebSocket service with new visible messages
    WebSocketService.updateVisibleMessages(visibleMessageIds, lastMessageId);
  }
}, { deep: true });

// Add a watch for any changes to store relationships
watch(() => store.state.messages.relationships, (newVal, oldVal) => {
  console.log(`[DEBUG UI] Relationships changed in store`);
  
  // Force a re-evaluation of displayed messages
  const currentMessages = displayedMessages.value;
  const visibleIds = currentMessages.map(m => m.id);
  
  console.log(`[DEBUG UI] Current visible message IDs: ${visibleIds.join(', ')}`);
  
  // Check relationship data to detect new messages
  const allRelationships = { ...newVal.parents };
  
  // Look for any children of our visible messages that aren't in the display list
  for (const parentId of visibleIds) {
    const childIds = store.getters['messages/getChildIds'](parentId) || [];
    if (childIds.length > 0) {
      console.log(`[DEBUG UI] Message ${parentId} has children: ${childIds.join(', ')}`);
      
      // Check if any children are not in visible IDs
      const newChildren = childIds.filter(id => !visibleIds.includes(id));
      if (newChildren.length > 0) {
        console.log(`[DEBUG UI] New children detected: ${newChildren.join(', ')}`);
      }
    }
  }
}, { deep: true });

// Add a watch for any direct message changes  
watch(() => store.state.messages.messages, (newVal, oldVal) => {
  console.log(`[DEBUG UI] Messages object changed in store`);
  
  // Check for new messages
  const currentKeys = Object.keys(newVal).map(Number);
  const oldKeys = Object.keys(oldVal).map(Number);
  
  // Find keys that exist in new but not in old
  const addedKeys = currentKeys.filter(key => !oldKeys.includes(key));
  if (addedKeys.length > 0) {
    console.log(`[DEBUG UI] New messages added to store: ${addedKeys.join(', ')}`);
  }
}, { deep: true });
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
}

.delete-confirm-actions .delete-button:hover {
  background-color: var(--error-color-dark, #c82333);
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
