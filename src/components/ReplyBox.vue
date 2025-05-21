<template>
  <div class="reply-box-wrapper">
    <div v-if="isReplying || isTemporaryThread" class="reply-container">
      <div class="reply-form">
        <div class="reply-settings">
          <label class="visibility-toggle">
            <input 
              type="checkbox" 
              :checked="isPublic" 
              @click="toggleVisibility"
              :disabled="!canInteract"
            >
            <span>Public reply</span>
          </label>
          
          <button 
            class="recipients-toggle" 
            @click="toggleRecipientSelector"
            :disabled="!canInteract"
          >
            Recipients ({{ recipients.length }})
          </button>
        </div>
      </div>
      
      <div class="textarea-container">
        <textarea 
          v-model="content" 
          :placeholder="placeholderText" 
          class="reply-input"
          ref="replyTextarea"
          @keydown="handleTextareaKeyDown"
          @focus="ensureReplyingActive"
          @input="autoResizeTextarea"
          :disabled="!canInteract"
          :class="{ 'disabled': !canInteract }"
        ></textarea>
        
        <div class="reply-actions">
          <button 
            @click.stop="sendReply" 
            class="send-button"
            :disabled="!canSendReply"
          >
            <span v-if="!isSending">Send</span>
            <div v-else class="button-spinner"></div>
          </button>
        </div>
      </div>
    </div>

    <!-- Recipients modal moved outside the reply-container but inside the wrapper -->
    <div v-if="showRecipientSelector" class="modal-overlay" @click.self="showRecipientSelector = false">
      <div class="recipient-modal">
        <div class="modal-header">
          <h3>Recipients</h3>
          <button class="close-button" @click="showRecipientSelector = false">×</button>
        </div>
        
        <div class="modal-content">
          <p class="modal-description" v-if="!isPublic">Private replies require at least one recipient</p>
          <p class="modal-description" v-else>Recipients for public replies (optional)</p>
          
          <div class="recipient-input-container">
            <div class="input-wrapper" :class="{ 'valid': isTagValid === true, 'invalid': isTagValid === false, 'searching': isSearching }">
              <input 
                v-model="newRecipient" 
                @input="searchUsers"
                @keydown.enter.prevent="addRecipient" 
                @keydown.escape="clearSearch"
                placeholder="Search by username or tag" 
                class="recipient-input"
                ref="recipientInput"
              />
              <div v-if="isSearching" class="search-indicator" title="Searching...">
                <div class="spinner"></div>
              </div>
              <div v-else-if="isTagValid === true" class="valid-indicator" title="Valid user tag">✓</div>
              <div v-else-if="isTagValid === false" class="invalid-indicator" title="Invalid user tag">✗</div>
            </div>
            <button 
              @click="addRecipient" 
              class="add-recipient-btn"
              :disabled="!canAddRecipient"
            >Add</button>
          </div>
          
          <div class="search-results-container">
            <div v-if="showSearchResults && searchResults && searchResults.length > 0" class="search-results-list">
              <div 
                v-for="(user, index) in searchResults" 
                :key="user.uid" 
                class="search-result-item"
                @click="selectSearchResult(user)"
              >
                <div class="search-result-content">
                  <span class="search-result-name">{{ user.display_name || 'User' }}</span>
                  <span class="search-result-tag">@{{ user.user_tag }}</span>
                </div>
              </div>
            </div>

            <div v-else-if="searchResults.length === 0 && hasSearched && !isSearching" class="no-search-results">
              No users found. Try a different search term.
            </div>
          </div>
          
          <div class="recipients-hint">
            Use user tags to add recipients.
          </div>
          
          <div class="recipients-list">
            <div 
              v-if="typeof recipients === 'object' && recipients !== null"
              v-for="(recipient, index) in recipients" 
              :key="recipient.uid || index" 
              class="recipient-tag"
            >
              <div class="recipient-info">
                <span class="recipient-name">{{ recipient.display_name || recipient.user_tag }}</span>
                <span v-if="recipient.user_tag" class="recipient-tag-name">@{{ recipient.user_tag }}</span>
              </div>
              <div class="recipient-actions">
                <button @click="() => removeRecipient(index)" class="remove-recipient-btn">×</button>
              </div>
            </div>
            
            <div v-else-if="typeof recipients === 'string'" class="no-recipients">
              {{ recipients }}
            </div>
            
            <div v-else-if="recipients && recipients.length === 0" class="no-recipients">
              No recipients {{ isPublic ? '(public reply)' : '' }}
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button @click="closeRecipientSelector" class="done-button">Done</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useStore } from 'vuex';

const props = defineProps({
  targetId: {
    type: [Number, String],
    default: null
  },
  placeholder: {
    type: String,
    default: 'Type your reply...'
  },
  canInteract: {
    type: Boolean,
    default: true
  },
  isTemporaryThread: {
    type: Boolean,
    default: false
  },
  isMessageSelected: {
    type: Boolean,
    default: false
  },
  isAuthenticated: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['send', 'cancel', 'send-success', 'send-error']);

// Setup store
const store = useStore();

// Refs
const replyTextarea = ref(null);
const content = ref('');
const isSending = ref(false);

// UI state
const showRecipientSelector = ref(false);
const newRecipient = ref('');
const isTagValid = ref(null);
const searchResults = ref([]);
const isSearching = ref(false);
const hasSearched = ref(false);
const showSearchResults = ref(false);
const recipientInput = ref(null);

// Computed properties from store
const user = computed(() => store.getters['auth/user']);
const isPublic = computed({
  get: () => store.getters['navigation/replyIsPublic'],
  set: (value) => store.dispatch('navigation/updateReplyVisibility', value)
});
const recipients = computed(() => store.getters['navigation/replyRecipients']);
const isReplying = computed(() => store.getters['navigation/isReplying']);

// Check if the reply can be added
const canAddRecipient = computed(() => {
  return newRecipient.value.trim() !== '' && isTagValid.value;
});

// Centralized validation logic
const canSendReply = computed(() => {
  return props.canInteract && content.value.trim() !== '' && !isSending.value;
});

// Generate placeholder text
const placeholderText = computed(() => {
  // First priority: check if we're in a temporary thread
  if (props.isTemporaryThread) {
    return "Type your message to create a new thread (no parent message)...";
  }
  
  // Second: check if no message is selected
  if (!props.isMessageSelected) {
    return "Click 'Reply' on a message to respond";
  }
  
  // If user can't interact, show a message explaining why
  if (!props.canInteract) {
    if (!props.isAuthenticated) {
      return "You need to log in to send messages";
    }
    return "You need to be whitelisted to send messages";
  }
  
  // If we're replying to a message, show "Reply to [author]..."
  if (props.targetId) {
    // First get the message we're replying to
    const targetMessage = store.getters['messages/getMessage'](props.targetId);
    if (targetMessage) {
      // Get the most appropriate display name for the author
      const displayName = getAuthorDisplayName(targetMessage);
      const userTag = getAuthorUserTag(targetMessage);
      
      if (userTag) {
        return `Reply to ${displayName} (@${userTag})...`;
      }
      return `Reply to ${displayName}...`;
    }
  }
  
  return props.placeholder;
});

// Methods
const toggleVisibility = () => {
  // Get current state
  const currentState = store.getters['navigation/replyIsPublic'];
  // Toggle to opposite
  store.dispatch('navigation/updateReplyVisibility', !currentState);
  
  // Only sync with message being replied to if we're not in a temporary thread
  if (!props.isTemporaryThread) {
    // Force sync settings after toggle
    store.dispatch('navigation/syncReplySettings');
  }
};

const ensureReplyingActive = () => {
  if (!isReplying.value && props.targetId) {
    store.dispatch('navigation/toggleReply', true);
  }
};

const handleTextareaKeyDown = (event) => {
  if (event.key === 'Enter') {
    if (event.shiftKey) {
      return; // Allow newline
    }
    
    event.preventDefault();
    
    if (canSendReply.value) {
      sendReply();
    }
  }
};

const autoResizeTextarea = () => {
  const textarea = replyTextarea.value;
  if (!textarea) return;
  
  // If content is empty, reset to initial height
  if (!content.value.trim()) {
    textarea.style.height = '40px';
    return;
  }
  
  // Only resize if we have line breaks or content exceeds current height
  if (content.value.includes('\n')) {
    // Reset height to auto to get new scrollHeight
    textarea.style.height = 'auto';
    
    // Calculate new height (with minimum)
    const newHeight = Math.max(40, textarea.scrollHeight);
    textarea.style.height = `${newHeight}px`;
  } else if (textarea.scrollHeight > textarea.clientHeight) {
    // Content exceeds current height without line breaks
    textarea.style.height = `${textarea.scrollHeight}px`;
  } else if (textarea.style.height === '' || textarea.style.height === 'auto') {
    // Set initial height if not set
    textarea.style.height = '40px';
  }
};

const sendReply = async () => {
  if (!canSendReply.value) return;
  
  // Make sure we have a user and email
  const currentUser = store.getters['auth/user'];
  if (!currentUser || !currentUser.email) {
    store.commit('ui/SET_ERROR', 'You need to be logged in to send messages.');
    return;
  }
  
  try {
    isSending.value = true;
    console.log('[ReplyBox] Starting to send message', {
      parentId: props.targetId,
      isPrivate: !isPublic.value,
      recipientsCount: recipients.value.length
    });
    
    // Create a new message using the store action
    const newMessage = await store.dispatch('messages/sendReply', {
      parentId: props.targetId, // Will be null for new threads
      content: content.value,
      isPrivate: !isPublic.value,
      recipients: recipients.value,
      // Ensure the author is explicitly set to the user's email
      content_author: currentUser.email
    });
    
    console.log('[ReplyBox] Message sent successfully', {
      messageId: newMessage?.id,
      response: newMessage
    });
    
    // Clear the input
    content.value = '';
    
    // Resize the textarea
    autoResizeTextarea();
    
    // Only emit send-success for new threads
    // WebSockets will handle updates for replies to existing messages
    if (props.isTemporaryThread) {
      emit('send-success', newMessage);
    } else if (newMessage && props.targetId) {
      // For replies to existing messages, manually add to UI
      // This ensures the message appears immediately without waiting for WebSocket
      
      // 1. Add the message to the store if not already there
      if (!store.getters['messages/getMessage'](newMessage.id)) {
        store.commit('messages/SET_MESSAGE', newMessage);
        console.log('[ReplyBox] Added new message to store:', newMessage.id);
      }
      
      // 2. Get the parent message and add child relationship if needed
      const parentMessage = store.getters['messages/getMessage'](props.targetId);
      if (parentMessage) {
        // Check if child relationship already exists
        const childExists = parentMessage.child_ids && 
                          parentMessage.child_ids.includes(newMessage.id);
        
        if (!childExists) {
          // Add child to parent
          store.commit('messages/ADD_CHILD_TO_PARENT', {
            parentId: props.targetId,
            childId: newMessage.id
          });
          console.log('[ReplyBox] Added child relationship:', props.targetId, '->', newMessage.id);
          
          // Always set this as branch_child, regardless of whether it's the first reply
          // Set immediately without rechecking child_ids to avoid race conditions
          store.commit('messages/SET_BRANCH_CHILD', {
            messageId: props.targetId,
            childId: newMessage.id
          });
          console.log('[ReplyBox] Set as branch_child for parent:', props.targetId);
        }
        
        // 4. Force re-render the thread to show the new message
        // This uses the global event bus to trigger a re-render in ThreadView
        store.commit('messages/REFRESH_DIRECT_MESSAGES');
        
        // 5. Force reload the branch path in case it's not already updated
        // This needs to be done after a short delay to ensure store is updated
        setTimeout(() => {
          console.log('[ReplyBox] Reloading thread after sending reply');
          if (store.state.navigation && store.state.navigation.currentRoute) {
            const currentThreadId = store.state.navigation.currentRoute.params.id;
            if (currentThreadId) {
              store.dispatch('messages/prepareBranchPath', parseInt(currentThreadId, 10));
            }
          }
          
          // 6. Only hide the reply box after ensuring all UI updates are processed
          // This prevents prematurely closing the reply box before the UI updates
          if (!props.isTemporaryThread) {
            console.log('[ReplyBox] Hiding reply box after successful send');
            setTimeout(() => {
              store.dispatch('navigation/clearReplyingTo');
            }, 150); // Short delay to ensure UI updates complete
          }
        }, 100);
      } else {
        // Only hide the reply box if we didn't find the parent message
        if (!props.isTemporaryThread) {
          console.log('[ReplyBox] Hiding reply box after successful send (no parent found)');
          store.dispatch('navigation/clearReplyingTo');
        }
      }
    }
    
    return newMessage;
  } catch (error) {
    console.error('[ReplyBox] Error sending message:', error);
    console.error('[ReplyBox] Error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    store.commit('ui/SET_ERROR', 'Failed to send message. Please try again.');
    emit('send-error', error);
    throw error;
  } finally {
    isSending.value = false;
  }
};

// Debounce function for search
let searchTimeout = null;
const searchUsers = (event) => {
  clearTimeout(searchTimeout);
  const query = event.target.value.trim();
  
  // Clear previous search state
  isSearching.value = query.length >= 1;
  
  if (query.length < 1) {
    isTagValid.value = null;
    searchResults.value = [];
    showSearchResults.value = false;
    return;
  }
  
  // Set up debounce
  searchTimeout = setTimeout(async () => {
    try {
      isSearching.value = true;
      hasSearched.value = true;
      
      // Call API to search users
      const results = await store.dispatch('auth/searchUsers', query);
      
      if (!results) {
        searchResults.value = [];
        showSearchResults.value = false;
      } else if (!Array.isArray(results)) {
        searchResults.value = [];
        showSearchResults.value = false;
      } else {
        searchResults.value = results;
        
        // Only show dropdown if we have actual results
        showSearchResults.value = results.length > 0;
      }
      
      // Update validation state
      if (results && results.length > 0) {
        // Consider it valid if we have any results and query is at least 1 char
        isTagValid.value = results.length > 0 && query.length >= 1;
      } else {
        // Explicit validation if no results from search
        const isValid = await store.dispatch('auth/validateUserTag', query);
        isTagValid.value = isValid;
      }
      
      isSearching.value = false;
    } catch (error) {
      console.error('Error searching users:', error);
      isTagValid.value = false;
      searchResults.value = [];
      isSearching.value = false;
    }
  }, 300); // 300ms debounce
};

const clearSearch = () => {
  newRecipient.value = '';
  isTagValid.value = null;
  searchResults.value = [];
  isSearching.value = false;
  hasSearched.value = false;
  showSearchResults.value = false;
};

const selectSearchResult = (user) => {
  if (user && user.user_tag) {
    // Use the full user object
    isTagValid.value = true;
    
    // Add the recipient right away
    store.dispatch('navigation/addRecipient', {
      uid: user.uid,
      display_name: user.display_name,
      user_tag: user.user_tag
    });
    
    // Clear the input
    newRecipient.value = '';
  }
  
  // Clean up search state
  searchResults.value = [];
  isSearching.value = false;
  hasSearched.value = false;
  showSearchResults.value = false;
};

const addRecipient = async () => {
  const tag = newRecipient.value.trim();
  
  if (!tag) return;
  
  // If search results exist, use the first one
  if (searchResults.value.length > 0) {
    selectSearchResult(searchResults.value[0]);
    return;
  }
  
  // Otherwise validate the tag
  isSearching.value = true;
  const isValid = await store.dispatch('auth/validateUserTag', tag);
  isSearching.value = false;
  
  if (isValid) {
    // Try to get full user details
    const results = await store.dispatch('auth/searchUsers', tag);
    const matchingUser = results?.find(u => u.user_tag === tag);
    
    if (matchingUser) {
      // Use the full user object
      store.dispatch('navigation/addRecipient', {
        uid: matchingUser.uid,
        display_name: matchingUser.display_name,
        user_tag: matchingUser.user_tag
      });
    } else {
      // Fallback: Use basic object with tag
      store.dispatch('navigation/addRecipient', {
        uid: tag, // Temporary - will be resolved on server
        display_name: tag,
        user_tag: tag
      });
    }
    
    newRecipient.value = '';
    isTagValid.value = null;
    searchResults.value = [];
    showSearchResults.value = false;
  } else {
    isTagValid.value = false;
  }
};

const removeRecipient = (index) => {
  store.dispatch('navigation/removeRecipient', index);
};

const isAuthorRecipient = (recipient) => {
  // If we're replying to a message
  if (props.targetId) {
    // Get the target message
    const targetMessage = store.getters['messages/getMessage'](props.targetId);
    if (targetMessage) {
      // Special case for ChatGPT
      if ((targetMessage.content_author === 'chatgpt' || 
           targetMessage.content_author === 'chatgpt-system' ||
           targetMessage.author_email === 'chatgpt') && 
          (recipient.uid === 'chatgpt-system')) {
        return true;
      }
      
      // Check if recipient UID matches the target message's author UID
      if (recipient.uid && recipient.uid === targetMessage.content_author) {
        return true;
      }
      
      // Check if recipient tag matches the target message's author tag
      if (recipient.user_tag && targetMessage.author_user_tag && 
          recipient.user_tag === targetMessage.author_user_tag) {
        return true;
      }
      
      // For backward compatibility, check email as well
      if (recipient.user_tag && targetMessage.author_email && 
          recipient.user_tag === targetMessage.author_email) {
        return true;
      }
    }
  }
  
  return false;
};

// Helper function to get the best display name for an author
const getAuthorDisplayName = (message) => {
  const currentUser = store.getters['auth/user'];
  
  // First priority: use database-provided display name
  if (message.author_display_name) {
    return message.author_display_name;
  }
  
  // Second priority (ChatGPT special case fallback)
  // Only use hardcoded name if nothing is available from database
  if (message.content_author === 'chatgpt' || 
      message.content_author === 'chatgpt-system' || 
      message.author_email === 'chatgpt') {
    return 'ChatGPT';
  }
  
  // Third priority: if current user is the author, use display name from auth state
  if (currentUser && (
      message.content_author === currentUser.uid || 
      message.author_email === currentUser.email
    )) {
    if (currentUser.displayName) {
      return currentUser.displayName;
    }
  }
  
  // Fourth priority: legacy email display
  if (message.author_email_display) {
    return message.author_email_display;
  }
  
  // Fifth priority: use user tag if no display name is available
  if (message.author_user_tag) {
    return message.author_user_tag;
  }
  
  // For backward compatibility, if the content_author looks like an email
  if (typeof message.content_author === 'string' && message.content_author.includes('@')) {
    return message.content_author;
  }
  
  // Last resort: use content_author (may be a UUID now)
  return message.content_author || "Unknown User";
};

// Helper function to get author user tag
const getAuthorUserTag = (message) => {
  const currentUser = store.getters['auth/user'];
  
  // First priority: message's author_user_tag from database
  if (message.author_user_tag) {
    // This will handle ChatGPT and all users with proper database records
    return message.author_user_tag;
  }
  
  // Second priority: ChatGPT special case fallback
  // Skip returning any tag for ChatGPT if no tag in database
  if (message.content_author === 'chatgpt' || 
      message.content_author === 'chatgpt-system' || 
      message.author_email === 'chatgpt') {
    return null;
  }
  
  // Third priority: current user's tag from auth state (if they're the author)
  if (currentUser && (
      message.content_author === currentUser.uid || 
      message.author_email === currentUser.email
    )) {
    if (currentUser.user_tag) {
      return currentUser.user_tag;
    }
  }
  
  // Default: no valid tag found
  return null;
};

// Add new ref to track if reply box can be closed
const canCloseReplyBox = ref(true);

// Toggle recipient selector visibility
const toggleRecipientSelector = () => {
  // If opening the selector, block immediate closing
  if (!showRecipientSelector.value) {
    canCloseReplyBox.value = false;
  }
  
  showRecipientSelector.value = !showRecipientSelector.value;
  
  // Reset input field when opening the modal
  if (showRecipientSelector.value) {
    newRecipient.value = '';
    
    // Focus the input field after DOM update
    nextTick(() => {
      if (recipientInput.value) {
        recipientInput.value.focus();
      }
    });
  }
};

// Add this new method to handle modal closing
const closeRecipientSelector = (event) => {
  // Stop event propagation to prevent the document click event
  if (event) {
    event.stopPropagation();
  }
  
  // Close the modal
  showRecipientSelector.value = false;
  
  // Set a short timeout to prevent immediate closing of reply box
  setTimeout(() => {
    canCloseReplyBox.value = true;
  }, 100);
};

// Update handleClickOutside to use canCloseReplyBox
const handleClickOutside = (event) => {
  // If the recipient selector is open or we can't close the reply box, return
  if (showRecipientSelector.value || !canCloseReplyBox.value) {
    return;
  }
  
  // If the click was not on the reply box or any of its children,
  // and not on a reply button, hide the reply box
  const replyBox = document.querySelector('.reply-container');
  const replyButtons = document.querySelectorAll('.reply-button');
  
  if (replyBox && !replyBox.contains(event.target) && 
      Array.from(replyButtons).every(btn => !btn.contains(event.target))) {
    // Cancel replying
    store.dispatch('navigation/toggleReply', false);
  }
};

// Close search results when clicking outside
onMounted(() => {
  document.addEventListener('click', handleClickOutsideSearch);
  document.addEventListener('click', handleClickOutside);
  console.log("ReplyBox mounted, canInteract:", props.canInteract);
});

// Watch for changes to canInteract
watch(() => props.canInteract, (newValue, oldValue) => {
  console.log("ReplyBox canInteract changed:", oldValue, "->", newValue);
}, { immediate: true });

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutsideSearch);
  document.removeEventListener('click', handleClickOutside);
});

const handleClickOutsideSearch = (event) => {
  const searchContainer = document.querySelector('.recipient-input-container');
  const searchResults = document.querySelector('.search-results-dropdown');
  
  if (showSearchResults.value && 
      searchContainer && 
      !searchContainer.contains(event.target) &&
      searchResults && 
      !searchResults.contains(event.target)) {
    showSearchResults.value = false;
  }
};

// Expose methods and properties that parent components might need
defineExpose({
  content,
  isSending,
  focus: () => {
    if (replyTextarea.value) {
      replyTextarea.value.focus();
    }
  },
  clear: () => {
    content.value = '';
    nextTick(() => {
      if (replyTextarea.value) {
        replyTextarea.value.style.height = '40px';
      }
    });
  }
});
</script>

<style scoped>
/* Add styles for new wrapper */
.reply-box-wrapper {
  /* This ensures the wrapper doesn't affect layout */
  display: contents;
}

.reply-container {
  position: fixed;
  bottom: 20px; /* Reduced bottom spacing */
  left: 40px;
  right: 40px;
  padding: var(--space-xs) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface);
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.reply-form {
  margin-bottom: 4px; /* Reduce margin */
}

.reply-settings {
  display: flex;
  gap: 12px;
  margin-bottom: var(--space-xs);
  align-items: center;
  position: relative;
}

.textarea-container {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: var(--space-xs);
}

.visibility-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.recipients-toggle {
  padding: 6px 12px;
  background-color: var(--color-primary-light);
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-xs);
  font-weight: 500;
  transition: background-color var(--transition-fast);
}

.recipients-toggle:hover:not(:disabled) {
  background-color: var(--color-primary-light);
  filter: brightness(95%);
}

.recipients-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Reply input styles */
.reply-input {
  flex: 1;
  min-height: 40px; /* Single line height */
  height: 40px; /* Start with single line */
  max-height: 150px; /* Maximum height before scrolling */
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md); /* Less rounded corners */
  resize: none; /* Disable manual resizing since we're doing it programmatically */
  margin-bottom: 0;
  font-family: inherit;
  font-size: var(--font-size-md); /* Better for mobile */
  background-color: var(--color-surface);
  color: var(--color-text);
  transition: all var(--transition-fast);
  overflow-y: auto; /* Show scrollbar if content exceeds max-height */
}

.reply-input:focus:not(:disabled) {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.reply-input.disabled {
  background-color: var(--color-surface);
  color: var(--color-text-disabled);
  cursor: not-allowed;
}

.reply-actions {
  display: flex;
  align-items: center;
  margin-left: var(--space-xs);
}

.send-button {
  padding: var(--space-xs) var(--space-md);
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-pill);
  cursor: pointer;
  font-weight: bold;
  min-width: 80px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-top: 2px solid var(--color-text-inverse);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000; /* Higher explicit z-index */
  backdrop-filter: blur(2px);
}

.recipient-modal {
  position: relative; /* Change from fixed to relative */
  max-width: 450px;
  width: 95%;
  background-color: var(--color-surface);
  padding: var(--space-lg);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  z-index: 1001; /* Higher than overlay */
  max-height: 80vh; /* Prevent from being too tall on smaller screens */
  overflow-y: auto; /* Allow scrolling if needed */
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.modal-content {
  flex: 1;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-lg);
}

.done-button {
  padding: var(--space-xs) var(--space-md);
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 500;
}

.close-button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.5rem;
  color: var(--color-text);
}

.modal-description {
  margin-bottom: var(--space-md);
  color: var(--color-text);
}

.recipients-hint {
  margin-top: 10px;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-style: italic;
}

.input-wrapper {
  position: relative;
}

.search-indicator {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--font-size-xs);
  z-index: 5;
  opacity: 0.7;
  background-color: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}

.search-indicator .spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(0, 0, 0, 0.05);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.valid-indicator, .invalid-indicator {
  position: absolute;
  top: 100%;
  right: 40px;
  color: var(--color-text);
  font-size: var(--font-size-xs);
}

.valid-indicator {
  color: var(--color-success);
}

.invalid-indicator {
  color: var(--color-error);
}

.recipient-selector {
  position: absolute;
  right: unset; /* Remove right positioning */
  bottom: 40px; /* Position above the button */
  left: 50%; /* Center it on its parent */
  transform: translateX(-50%); /* Center it on its parent */
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  min-width: 280px;
  z-index: 20;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.recipient-input-row {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-xs);
}

.recipient-input {
  flex: 1;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.add-recipient-btn {
  padding: 6px 10px;
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.recipients-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.recipient-tag {
  background-color: var(--color-primary-light);
  padding: 6px 10px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.recipient-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.recipient-name {
  font-weight: 500;
}

.recipient-tag-name {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.recipient-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.remove-recipient-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.no-recipients {
  color: var(--color-text-secondary);
  font-style: italic;
  font-size: var(--font-size-xs);
  padding: 4px 0;
}

.recipient-input-container {
  position: relative;
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.input-wrapper {
  position: relative;
  flex: 1;
}

.input-wrapper.valid .recipient-input {
  border-color: var(--color-success);
}

.input-wrapper.invalid .recipient-input {
  border-color: var(--color-error);
}

.recipient-input {
  width: 100%;
  padding: var(--space-xs) var(--space-md);
  padding-right: 30px; /* Space for indicators */
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
  color: var(--color-text);
  transition: border-color var(--transition-fast);
}

.search-indicator,
.valid-indicator,
.invalid-indicator {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--font-size-xs);
}

.search-indicator .spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.search-results-container {
  margin-top: 10px;
  width: 100%;
}

.search-results-list {
  width: 100%;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 10px;
}

.search-result-item {
  padding: var(--space-xs) var(--space-md);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  border-bottom: 1px solid var(--color-border-light);
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background-color: var(--color-primary-light);
}

.search-result-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.search-result-name {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
}

.search-result-tag {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.no-search-results {
  padding: var(--space-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  text-align: center;
  font-style: italic;
}

.input-wrapper.searching .recipient-input {
  padding-right: 35px; /* Extra space for the spinner */
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style> 