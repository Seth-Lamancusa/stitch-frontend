<template>
  <div class="reply-box-wrapper">
    <!-- Backdrop overlay -->
    <div 
      v-if="isReplying || isNewThread" 
      class="reply-backdrop"
      @click="handleBackdropClick"
      @touchstart.passive="handleBackdropTouchStart"
      @touchmove.passive="handleBackdropTouchMove"
    ></div>
    
    <!-- Bottom sheet -->
    <div 
      v-if="isReplying || isNewThread" 
      class="reply-sheet"
      :class="{ 
        'reply-sheet--raised': isKeyboardVisible,
        'reply-sheet--visible': showSheet 
      }"
      ref="replySheet"
      role="dialog"
      aria-labelledby="reply-header"
      aria-modal="true"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      <!-- Sheet handle for swipe gesture -->
      <div class="reply-sheet__handle" aria-hidden="true"></div>
      
      <!-- Header row -->
      <div class="reply-sheet__header" id="reply-header">
        <div class="reply-sheet__header-left">
          <span class="reply-sheet__title">{{ replyHeaderText }}</span>
        </div>
      </div>
      
      <!-- Controls toolbar above input -->
      <div class="reply-sheet__toolbar">
        <!-- Public/Private dropdown -->
        <div class="toolbar-control">
          <select 
            v-model="isPublic" 
            class="visibility-dropdown"
            :disabled="!canInteract"
            aria-label="Message visibility"
          >
            <option :value="true">Public</option>
            <option :value="false">Private</option>
          </select>
        </div>
        
        <!-- Recipients button -->
        <button 
          class="toolbar-control meta-pill" 
          @click="toggleRecipientSelector"
          :disabled="!canInteract"
          :aria-expanded="showRecipientSelector"
          aria-label="Manage recipients"
        >
          <span class="meta-pill__icon">👥</span>
          <span class="meta-pill__text">Recipients ({{ recipients.length }})</span>
        </button>
        
        <!-- Add bots button -->
        <button 
          class="toolbar-control meta-pill" 
          @click="toggleChatbotSelector"
          :disabled="!canInteract"
          :aria-expanded="showChatbotSelector"
          aria-label="Add chatbots"
        >
          <span class="meta-pill__icon">🤖</span>
          <span class="meta-pill__text">+ Add bots</span>
        </button>
      </div>
      
      <!-- Text area -->
      <div class="reply-sheet__textarea-container">
        <textarea 
          v-model="content" 
          :placeholder="placeholderText" 
          class="reply-sheet__textarea"
          ref="replyTextarea"
          @keydown="handleTextareaKeyDown"
          @focus="handleTextareaFocus"
          @blur="handleTextareaBlur"
          @input="autoResizeTextarea"
          :disabled="!canInteract"
          :class="{ 'disabled': !canInteract }"
          aria-label="Message content"
          rows="3"
        ></textarea>
      </div>
      
      <!-- Floating send button -->
      <button 
        class="reply-sheet__send-button"
        :class="{ 
          'reply-sheet__send-button--disabled': !canSendReply,
          'reply-sheet__send-button--loading': isSending,
          'reply-sheet__send-button--success': showSendSuccess
        }"
        @click.stop="sendReply" 
        :disabled="!canSendReply"
        :aria-label="isSending ? 'Sending message' : 'Send message'"
      >
        <span v-if="showSendSuccess" class="send-button__icon">✓</span>
        <span v-else-if="isSending" class="send-button__spinner" aria-hidden="true"></span>
        <span v-else class="send-button__text">Send</span>
      </button>
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
                <button 
                  @click="() => removeRecipient(index)" 
                  class="remove-recipient-btn"
                >×</button>
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

    <!-- Chatbots modal -->
    <div v-if="showChatbotSelector" class="modal-overlay" @click.self="showChatbotSelector = false">
      <div class="chatbot-modal">
        <div class="modal-header">
          <h3>Add Chatbots</h3>
          <button class="close-button" @click="showChatbotSelector = false">×</button>
        </div>
        
        <div class="modal-content">
          <p class="modal-description">Select chatbots to add to your conversation</p>
          
          <div class="chatbots-list">
            <div 
              v-for="chatbot in availableChatbots" 
              :key="chatbot.uid" 
              class="chatbot-item"
              @click="toggleChatbot(chatbot)"
            >
              <div class="chatbot-content">
                <div class="chatbot-info">
                  <span class="chatbot-name">{{ chatbot.display_name }}</span>
                  <span class="chatbot-tag">@{{ chatbot.user_tag }}</span>
                </div>
                <div class="chatbot-toggle">
                  <input 
                    type="checkbox" 
                    :checked="isChatbotSelected(chatbot)"
                    @click.stop="toggleChatbot(chatbot)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button @click="closeChatbotSelector" class="done-button">Done</button>
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
  isNewThread: {
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
const replySheet = ref(null);
const content = ref('');
const isSending = ref(false);

// Bottom sheet state
const showSheet = ref(false);
const isKeyboardVisible = ref(false);
const showSendSuccess = ref(false);

// Touch gesture state
const touchStartY = ref(0);
const isDragging = ref(false);
const dragDistance = ref(0);

// UI state
const showRecipientSelector = ref(false);
const newRecipient = ref('');
const isTagValid = ref(null);
const searchResults = ref([]);
const isSearching = ref(false);
const hasSearched = ref(false);
const showSearchResults = ref(false);
const recipientInput = ref(null);

// Chatbot selector state
const showChatbotSelector = ref(false);

// Hardcoded chatbot data (from backend config.py)
const availableChatbots = ref([
  {
    uid: "chatgpt-system",
    display_name: "GP",
    user_tag: "chatgpt",
    email: "chatgpt@system.ai"
  },
  {
    uid: "claude-system",
    display_name: "Claude",
    user_tag: "claude",
    email: "claude@system.ai"
  },
  {
    uid: "gemini-system",
    display_name: "Gemini",
    user_tag: "gemini",
    email: "gemini@system.ai"
  },
  {
    uid: "grok-system",
    display_name: "Grok",
    user_tag: "grok",
    email: "grok@system.ai"
  }
]);

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
  // First priority: check if we're creating a new thread
  if (props.isNewThread) {
    return "Type your message to create a new thread...";
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
  
  return "Type your message...";
});

// Generate reply header text
const replyHeaderText = computed(() => {
  if (props.isNewThread) {
    return "New Message";
  }
  
  if (props.targetId) {
    const targetMessage = store.getters['messages/getMessage'](props.targetId);
    if (targetMessage) {
      const displayName = getAuthorDisplayName(targetMessage);
      const userTag = getAuthorUserTag(targetMessage);
      
      if (userTag) {
        return `Replying to @${userTag}`;
      }
      return `Replying to ${displayName}`;
    }
  }
  
  return "Reply";
});

// Methods

const ensureReplyingActive = () => {
  if (!isReplying.value && props.targetId) {
    store.dispatch('navigation/toggleReply', true);
  }
};

// Bottom sheet methods
const showBottomSheet = () => {
  showSheet.value = true;
  
  // Focus textarea after animation
  setTimeout(() => {
    if (replyTextarea.value) {
      replyTextarea.value.focus();
    }
  }, 350);
};

const hideBottomSheet = () => {
  showSheet.value = false;
  isKeyboardVisible.value = false;
  
  // Clear replying state if not new thread
  if (!props.isNewThread) {
    setTimeout(() => {
      store.dispatch('navigation/clearReplyingTo');
    }, 300);
  }
};

// Track touch movement to distinguish between tap and scroll
let backdropTouchStartY = 0;
let touchMoveDistance = 0;

const handleBackdropTouchStart = (event) => {
  backdropTouchStartY = event.touches[0].clientY;
  touchMoveDistance = 0;
};

const handleBackdropTouchMove = (event) => {
  if (backdropTouchStartY) {
    touchMoveDistance = Math.abs(event.touches[0].clientY - backdropTouchStartY);
  }
};

const handleBackdropClick = (event) => {
  // On mobile, only close if clicking outside the reply sheet and not scrolling
  if (window.innerWidth <= 768) {
    // Check if this was a scroll gesture (moved more than 10px)
    if (touchMoveDistance > 10) {
      touchMoveDistance = 0;
      return;
    }
    
    // Check if the click is actually outside the reply sheet
    const replySheetElement = replySheet.value;
    if (replySheetElement && !replySheetElement.contains(event.target)) {
      hideBottomSheet();
    }
  } else {
    // On desktop, any backdrop click closes
    hideBottomSheet();
  }
  
  // Reset touch tracking
  touchMoveDistance = 0;
};

// Touch gesture handlers
const handleTouchStart = (event) => {
  const touch = event.touches[0];
  touchStartY.value = touch.clientY;
  isDragging.value = false;
  dragDistance.value = 0;
};

const handleTouchMove = (event) => {
  if (!isDragging.value) {
    const touch = event.touches[0];
    const deltaY = touch.clientY - touchStartY.value;
    
    // Only start dragging if moving down and near the top of the sheet
    if (deltaY > 5 && touchStartY.value < 100) {
      isDragging.value = true;
    }
  }
  
  if (isDragging.value) {
    const touch = event.touches[0];
    dragDistance.value = Math.max(0, touch.clientY - touchStartY.value);
    
    // Apply visual feedback
    if (replySheet.value) {
      replySheet.value.style.transform = `translateY(${dragDistance.value}px)`;
    }
  }
};

const handleTouchEnd = () => {
  if (isDragging.value) {
    // Reset visual transform
    if (replySheet.value) {
      replySheet.value.style.transform = '';
    }
    
    // If dragged down more than 60px, close the sheet
    if (dragDistance.value > 60) {
      hideBottomSheet();
    }
  }
  
  isDragging.value = false;
  dragDistance.value = 0;
};

// Keyboard handling
const handleTextareaFocus = () => {
  ensureReplyingActive();
  
  // Detect mobile keyboard
  if (window.innerWidth <= 768) {
    // Use a timeout to detect keyboard appearance
    setTimeout(() => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const initialHeight = window.screen.height;
      
      if (initialHeight - viewportHeight > 150) {
        isKeyboardVisible.value = true;
      }
    }, 300);
  }
};

const handleTextareaBlur = () => {
  // Reset keyboard state
  setTimeout(() => {
    isKeyboardVisible.value = false;
  }, 100);
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
  
  // Reset to auto to get the natural height, then set to scrollHeight
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(Math.max(textarea.scrollHeight, 40), 150) + 'px';
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
    
    // Show success feedback
    showSendSuccess.value = true;
    setTimeout(() => {
      showSendSuccess.value = false;
    }, 2000);
    
    // Only emit send-success for new threads
    // WebSockets will handle updates for replies to existing messages
    if (props.isNewThread) {
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
          if (!props.isNewThread) {
            console.log('[ReplyBox] Hiding reply box after successful send');
            setTimeout(() => {
              store.dispatch('navigation/clearReplyingTo');
            }, 150); // Short delay to ensure UI updates complete
          }
        }, 100);
      } else {
        // Only hide the reply box if we didn't find the parent message
        if (!props.isNewThread) {
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
      
      // Update validation state based on search results
      isTagValid.value = results && results.length > 0;
      
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
  
  // Only allow adding recipients from search results
  if (searchResults.value.length > 0) {
    selectSearchResult(searchResults.value[0]);
    return;
  }
  
  // If no search results, show that the tag is invalid
  isTagValid.value = false;
};

const removeRecipient = (index) => {
  store.dispatch('navigation/removeRecipient', index);
};

// Helper function to get the best display name for an author
const getAuthorDisplayName = (message) => {
  const currentUser = store.getters['auth/user'];
  
  // First priority: use database-provided display name
  if (message.author_display_name) {
    return message.author_display_name;
  }
  
  // Last resort: use content_author (may be a UUID now)
  return message.content_author || "Unknown User";
};

// Helper function to get author user tag
const getAuthorUserTag = (message) => {
  
  // First priority: message's author_user_tag from database
  if (message.author_user_tag) {
    // This will handle all users with proper database records
    return message.author_user_tag;
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

// Chatbot selector methods
const toggleChatbotSelector = () => {
  // If opening the selector, block immediate closing
  if (!showChatbotSelector.value) {
    canCloseReplyBox.value = false;
  }
  
  showChatbotSelector.value = !showChatbotSelector.value;
};

const closeChatbotSelector = (event) => {
  // Stop event propagation to prevent the document click event
  if (event) {
    event.stopPropagation();
  }
  
  // Close the modal
  showChatbotSelector.value = false;
  
  // Set a short timeout to prevent immediate closing of reply box
  setTimeout(() => {
    canCloseReplyBox.value = true;
  }, 100);
};

const isChatbotSelected = (chatbot) => {
  return recipients.value.some(recipient => recipient.uid === chatbot.uid);
};

const toggleChatbot = (chatbot) => {
  if (isChatbotSelected(chatbot)) {
    // Remove chatbot from recipients
    const index = recipients.value.findIndex(recipient => recipient.uid === chatbot.uid);
    if (index !== -1) {
      store.dispatch('navigation/removeRecipient', index);
    }
  } else {
    // Add chatbot to recipients
    store.dispatch('navigation/addRecipient', {
      uid: chatbot.uid,
      display_name: chatbot.display_name,
      user_tag: chatbot.user_tag,
      email: chatbot.email
    });
  }
};

// Add this method back for the recipient modal
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
  // If any selector is open or we can't close the reply box, return
  if (showRecipientSelector.value || showChatbotSelector.value || !canCloseReplyBox.value) {
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
  
  // Initialize textarea sizing
  nextTick(() => {
    autoResizeTextarea();
  });
});

// Watch for changes to canInteract
watch(() => props.canInteract, (newValue, oldValue) => {
  console.log("ReplyBox canInteract changed:", oldValue, "->", newValue);
}, { immediate: true });

// Watch content changes to ensure textarea resizes properly
watch(content, () => {
  nextTick(() => {
    autoResizeTextarea();
  });
});

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

// Watchers
watch(() => isReplying.value || props.isNewThread, (shouldShow) => {
  if (shouldShow) {
    showBottomSheet();
  } else {
    hideBottomSheet();
  }
}, { immediate: true });

// Handle viewport changes for keyboard detection
if (typeof window !== 'undefined' && window.visualViewport) {
  const handleViewportChange = () => {
    if (window.innerWidth <= 768) {
      const heightDiff = window.screen.height - window.visualViewport.height;
      isKeyboardVisible.value = heightDiff > 150;
    }
  };
  
  window.visualViewport.addEventListener('resize', handleViewportChange);
  
  // Cleanup
  onBeforeUnmount(() => {
    window.visualViewport.removeEventListener('resize', handleViewportChange);
  });
}

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
      autoResizeTextarea();
    });
  }
});
</script>

<style scoped>
/* Bottom sheet wrapper */
.reply-box-wrapper {
  display: contents;
}

/* Backdrop overlay */
.reply-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 999;
  animation: backdrop-fade-in 0.3s ease-out;
}

@keyframes backdrop-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Bottom sheet */
.reply-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-surface);
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  padding-bottom: env(safe-area-inset-bottom);
  display: flex;
  flex-direction: column;
  max-height: 50vh;
  min-height: 200px;
  transform: translateY(100%);
  transition: transform 0.3s ease-out;
}

.reply-sheet--visible {
  transform: translateY(0);
}

.reply-sheet--raised {
  transform: translateY(-8px);
}

/* Sheet handle */
.reply-sheet__handle {
  width: 40px;
  height: 4px;
  background-color: var(--color-border);
  border-radius: 2px;
  margin: 8px auto 0;
  opacity: 0.6;
  flex-shrink: 0;
}

/* Header row */
.reply-sheet__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.reply-sheet__header-left {
  flex: 1;
}

.reply-sheet__title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
}

.reply-sheet__header-right {
  flex-shrink: 0;
}



/* Controls toolbar */
.reply-sheet__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px 12px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-surface-light, var(--color-surface));
}

/* Toolbar controls */
.toolbar-control {
  flex-shrink: 0;
}

/* Visibility dropdown */
.visibility-dropdown {
  appearance: none;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 36px;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 8px center;
  background-repeat: no-repeat;
  background-size: 16px;
  padding-right: 32px;
}

.visibility-dropdown:hover:not(:disabled) {
  background-color: var(--color-hover-overlay);
  border-color: var(--color-border-hover);
}

.visibility-dropdown:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb, 79, 140, 255), 0.2);
}

.visibility-dropdown:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Uniform ghost pills for toolbar */
.meta-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 36px;
}

.meta-pill:hover:not(:disabled) {
  background-color: var(--color-hover-overlay);
  border-color: var(--color-border-hover);
}

.meta-pill:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.meta-pill__icon {
  font-size: var(--font-size-md);
  line-height: 1;
}

.meta-pill__text {
  font-weight: 500;
}

/* Textarea container */
.reply-sheet__textarea-container {
  flex: 1;
  padding: 0 16px;
  position: relative;
  min-height: 0;
}

.reply-sheet__textarea {
  width: 100%;
  min-height: 120px;
  max-height: 40vh;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background-color: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--font-size-md);
  line-height: 1.5;
  resize: none;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.reply-sheet__textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb, 79, 140, 255), 0.2);
}

.reply-sheet__textarea.disabled {
  background-color: var(--color-surface-light);
  color: var(--color-text-disabled);
  cursor: not-allowed;
}

/* Floating send button - rectangular style matching action buttons */
.reply-sheet__send-button {
  position: absolute;
  bottom: 16px;
  right: 16px;
  min-width: 60px;
  min-height: 36px;
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-xs);
  cursor: pointer;
  font-weight: 600;
  font-size: var(--font-size-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  transition: all var(--transition-fast);
  z-index: 1;
}

.reply-sheet__send-button:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  border-color: var(--color-primary-dark);
  transform: scale(1.05);
}

.reply-sheet__send-button--disabled {
  background-color: var(--color-border);
  border-color: var(--color-border);
  color: var(--color-text-secondary);
  cursor: not-allowed;
  transform: none;
  opacity: 0.6;
}

.reply-sheet__send-button--loading {
  cursor: wait;
  opacity: 0.8;
}

.reply-sheet__send-button--success {
  background-color: var(--color-success);
  border-color: var(--color-success);
  transform: scale(1.05);
}

.send-button__text {
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.send-button__icon {
  font-size: var(--font-size-lg);
  font-weight: bold;
}

.send-button__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid var(--color-text-inverse);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Mobile responsive styles */
@media (max-width: 768px) {
  /* Hide desktop reply container on mobile */
  .reply-container {
    display: none !important;
  }
  
  /* Remove background dimming on mobile - keep transparent but allow clicks outside reply sheet */
  .reply-backdrop {
    background-color: transparent;
  }
  
  .reply-sheet {
    border-radius: 0;
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
  }
  
  .reply-sheet__header {
    padding: 16px;
  }
  
  .reply-sheet__meta {
    padding: 0 16px 16px;
  }
  
  .reply-sheet__textarea-container {
    padding: 0 16px 60px; /* Extra bottom padding for send button */
  }
}

@media (max-width: 480px) {
  .reply-sheet__title {
    font-size: var(--font-size-sm);
  }
  
  .reply-sheet__toolbar {
    padding: 0 12px 8px;
    gap: 8px;
    flex-wrap: wrap;
  }
  
  .visibility-dropdown {
    font-size: var(--font-size-xs);
    padding: 6px 24px 6px 8px;
    min-height: 32px;
  }
  
  .meta-pill {
    padding: 6px 8px;
    font-size: var(--font-size-xs);
    min-height: 32px;
  }
  
  .reply-sheet__send-button {
    min-width: 56px;
    min-height: 32px;
    bottom: 12px;
    right: 12px;
    padding: 6px 10px;
    font-size: calc(var(--font-size-xs) - 1px);
  }
  
  .reply-sheet__textarea {
    min-height: 100px;
    padding: 10px;
  }
}

/* Desktop optimizations - keep mobile design but improve desktop UX */
@media (min-width: 769px) {
  .reply-sheet {
    max-width: 600px;
    left: 50%;
    transform: translateX(-50%);
    border-radius: var(--radius-md);
    max-height: 60vh;
  }
  
  .reply-sheet--visible {
    transform: translateX(-50%) translateY(0);
  }
  
  .reply-sheet--raised {
    transform: translateX(-50%) translateY(-8px);
  }
  
  /* Hide mobile touch handle on desktop */
  .reply-sheet__handle {
    display: none;
  }
}

/* Common styles */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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

/* Make scrollbar invisible until in use */
.reply-input::-webkit-scrollbar {
  width: 8px;
}

.reply-input::-webkit-scrollbar-track {
  background: transparent;
}

.reply-input::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 4px;
}

.reply-input:hover::-webkit-scrollbar-thumb {
  background: var(--color-border-dark);
}

.reply-input {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.reply-input:hover {
  scrollbar-color: var(--color-border-dark) transparent;
}

/* Chatbot modal styles */
.chatbot-modal {
  position: relative;
  max-width: 400px;
  width: 95%;
  background-color: var(--color-surface);
  padding: var(--space-lg);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  z-index: 1001;
  max-height: 80vh;
  overflow-y: auto;
}

.chatbots-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.chatbot-item {
  padding: var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
  background-color: var(--color-surface);
}

.chatbot-item:hover {
  background-color: var(--color-primary-light);
  border-color: var(--color-primary);
}

.chatbot-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chatbot-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chatbot-name {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
}

.chatbot-tag {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.chatbot-toggle {
  display: flex;
  align-items: center;
}

.chatbot-toggle input[type="checkbox"] {
  width: 16px !important;
  height: 16px !important;
  cursor: pointer;
  position: relative !important;
  appearance: none !important;
  -webkit-appearance: none !important;
  -moz-appearance: none !important;
  border: 2px solid var(--color-border) !important;
  border-radius: 3px !important;
  background-color: var(--color-surface) !important;
  transition: all 0.2s ease !important;
  margin: 0 !important;
  padding: 0 !important;
  outline: none !important;
}

.chatbot-toggle input[type="checkbox"]:checked {
  background-color: var(--color-primary) !important;
  border-color: var(--color-primary) !important;
}

.chatbot-toggle input[type="checkbox"]:checked::after {
  content: '✓' !important;
  position: absolute !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  color: black !important;
  font-size: 12px !important;
  font-weight: bold !important;
  line-height: 1 !important;
  display: block !important;
}

.chatbot-toggle input[type="checkbox"]:focus {
  outline: 2px solid var(--color-primary) !important;
  outline-offset: 2px !important;
}

/* OLD MOBILE STYLES MOVED TO DESKTOP-ONLY SECTION ABOVE */
/* These styles are now only active on desktop (min-width: 769px) to avoid conflicts with the new bottom sheet */
</style> 