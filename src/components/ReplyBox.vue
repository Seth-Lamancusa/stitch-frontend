<template>
  <div class="reply-box-wrapper">
    <!-- Backdrop overlay -->
    <div 
      v-if="isReplying || isNewThread" 
      class="reply-backdrop"
    ></div>
    
    <!-- Bottom sheet -->
    <div 
      v-if="isReplying || isNewThread" 
      class="reply-sheet"
      :class="{ 
        'reply-sheet--raised': isKeyboardVisible,
        'reply-sheet--visible': isReplying || isNewThread,
        'reply-sheet--closing': isReplyBoxClosing
      }"
      ref="replySheet"
      role="dialog"
      aria-labelledby="reply-header"
      aria-modal="true"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      
      <!-- Header row -->
      <div class="reply-sheet__header" id="reply-header">
        <div class="reply-sheet__header-left">
          <span class="reply-sheet__title">{{ replyHeaderText }}</span>
        </div>
        <div class="reply-sheet__header-right">
          <!-- Close button -->
          <button 
            class="reply-sheet__close-button"
            @click.stop="hideBottomSheet"
            :aria-label="'Close reply box'"
          >
            ×
          </button>
        </div>
      </div>
      
      <!-- Controls toolbar above input -->
      <div class="reply-sheet__toolbar">
        <!-- Left side controls -->
        <div class="toolbar-left">
          <!-- Public visibility globe toggle -->
          <button 
            class="toolbar-control meta-pill visibility-globe-toggle" 
            @mousedown.prevent="handleVisibilityPointerDown"
            @touchstart.stop.prevent="handleVisibilityToggle('touch')"
            @click.stop.prevent="handleVisibilityToggle('click')"
            :class="{ 'active': isPublic }"
            :disabled="!canInteract"
            :aria-pressed="isPublic"
            aria-label="Toggle public visibility"
            title="Public"
          >
            <span class="meta-pill__icon">🌐</span>
            <span class="meta-pill__text">Public</span>
          </button>
          
          <!-- Recipients button -->
          <button 
            class="toolbar-control meta-pill" 
            @click="toggleRecipientSelector"
            :disabled="!canInteract"
            :aria-expanded="showRecipientSelector"
            aria-label="Manage recipients"
          >
            <span class="meta-pill__icon">👥</span>
            <span class="meta-pill__text">Draft Recipients ({{ recipients.length }})</span>
          </button>
          
          <!-- Prompt moved to MessageNode. Keeping spacing consistent. -->
        </div>


      </div>
      
      <!-- Text area - hidden in add recipients mode -->
      <div v-if="!isAddRecipientsMode" class="reply-sheet__textarea-container">
        <div class="textarea-wrapper">
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
            rows="1"
          ></textarea>
          
          <!-- Expand/Collapse toggle arrow -->
          <button 
            v-if="hasMultipleLines"
            class="textarea-expand-toggle"
            @click.stop="toggleTextareaExpansion"
            :class="{ 'expanded': isTextareaExpanded }"
            :aria-label="isTextareaExpanded ? 'Collapse to single line' : 'Expand to full height'"
            title="Toggle textarea height"
          >
            <span class="expand-arrow">↕</span>
          </button>
        </div>
        
        <!-- Send button -->
        <button 
          class="textarea-send-button"
          :class="{ 
            'textarea-send-button--disabled': !canSendReply,
            'textarea-send-button--loading': isSending,
            'textarea-send-button--success': showSendSuccess
          }"
          @click.stop="sendReply" 
          :disabled="!canSendReply"
          :aria-label="isSending ? 'Sending message' : 'Send message'"
        >
          <span v-if="showSendSuccess" class="send-button__icon">✓</span>
          <span v-else-if="isSending" class="send-button__spinner" aria-hidden="true"></span>
          <span v-else class="send-button__arrow">→</span>
        </button>
      </div>
      
      <!-- Add recipients info - shown only in add recipients mode -->
      <div v-if="isAddRecipientsMode" class="add-recipients-info">
        <p class="add-recipients-description">
          Add new recipients to this message. Only you (the author) can see this list.
        </p>
        <div v-if="addRecipientsExisting.length > 0" class="existing-recipients">
          <h4>Current Recipients:</h4>
          <div class="existing-recipients-list">
            <span 
              v-for="recipient in addRecipientsExisting" 
              :key="recipient.uid"
              class="existing-recipient-tag"
            >
              {{ recipient.display_name || recipient.user_tag }}
            </span>
          </div>
        </div>
      </div>
      

    </div>

    <!-- Recipients modal -->
    <RecipientsModal
      :is-visible="showRecipientSelector"
      :is-public="isPublic"
      :is-add-mode="false"
      @close="closeRecipientSelector"
      @done="closeRecipientSelector"
    />
    
    <!-- Bot Prompt Modal moved to global component -->
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useStore } from 'vuex';
import RecipientsModal from './modals/RecipientsModal.vue';
import { dismissMobileKeyboard } from '../utils/mobileKeyboard.js';
import MessageService from '../services/MessageService.js';

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
const showSearchResults = ref(false);

// Bottom sheet state
const isKeyboardVisible = ref(false);
const showSendSuccess = ref(false);

// Touch gesture state
const touchStartY = ref(0);
const isDragging = ref(false);
const dragDistance = ref(0);

// UI state
const showRecipientSelector = ref(false);

// Textarea expansion state
const isTextareaExpanded = ref(false);
const hasMultipleLines = ref(false);
const userHasManuallyToggled = ref(false);

// Featured bots for prompt modal
// Prompt bot response moved to global modal; remove local states

// Add recipients mode
const isAddRecipientsMode = computed(() => store.getters['navigation/isAddRecipientsMode']);
const addRecipientsMessageId = computed(() => store.getters['navigation/addRecipientsMessageId']);
const addRecipientsExisting = computed(() => store.getters['navigation/addRecipientsExisting']);



// Computed properties from store
const user = computed(() => store.getters['auth/user']);
const isPublic = computed({
  get: () => store.getters['navigation/replyIsPublic'],
  set: (value) => store.dispatch('navigation/updateReplyVisibility', value)
});
const recipients = computed(() => store.getters['navigation/replyRecipients']);
const replyAddToAncestors = computed(() => store.getters['navigation/replyAddToAncestors']);
const isReplying = computed(() => store.getters['navigation/isReplying']);

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
    return "You need write permission to send messages";
  }
  
  return "Type your message...";
});

// Generate reply header text
const replyHeaderText = computed(() => {
  if (isAddRecipientsMode.value) {
    return "Add Recipients";
  }
  
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
//
// Keep mobile keyboard open for Public toggle and avoid double toggles
const ignoreNextClick = ref(false);

const handleVisibilityPointerDown = (event) => {
  // Prevent focus from leaving the textarea (keeps mobile keyboard open)
  event.preventDefault();
};

const handleVisibilityToggle = (source) => {
  if (!props.canInteract) return;

  if (source === 'click' && ignoreNextClick.value) {
    return;
  }

  isPublic.value = !isPublic.value;

  if (source === 'touch') {
    ignoreNextClick.value = true;
    setTimeout(() => { ignoreNextClick.value = false; }, 400);
  }

  // Maintain keyboard visibility by restoring textarea focus on mobile
  if (typeof window !== 'undefined' && window.innerWidth <= 768 && replyTextarea.value) {
    try {
      replyTextarea.value.focus({ preventScroll: true });
    } catch (e) {
      replyTextarea.value.focus();
    }
    isKeyboardVisible.value = true;
  }
};

const ensureReplyingActive = () => {
  if (!isReplying.value && props.targetId) {
    store.dispatch('navigation/toggleReply', true);
  }
};

// Bottom sheet methods
const focusTextarea = () => {
  // Focus textarea after animation
  setTimeout(() => {
    if (replyTextarea.value) {
      replyTextarea.value.focus();
    }
  }, 350);
};

const hideBottomSheet = () => {
  isKeyboardVisible.value = false;
  
  // Clear replying state if not new thread
  if (!props.isNewThread) {
    store.dispatch('navigation/clearReplyingTo');
  }
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
    const isMobile = window.innerWidth <= 768;
    // Mobile: Enter should create a newline; Shift+Enter also newline (default)
    if (isMobile) {
      return;
    }

    // Desktop behavior:
    // - Shift+Enter inserts a newline (default)
    if (event.shiftKey) {
      return;
    }

    // - Enter alone sends (when allowed), otherwise fall back to newline
    if (canSendReply.value) {
      event.preventDefault();
      sendReply();
    }
    return;
  }
};

const autoResizeTextarea = () => {
  const textarea = replyTextarea.value;
  if (!textarea) return;
  
  // Check if there's actual content
  const hasContent = content.value.trim().length > 0; 
  
  if (!hasContent) {
    // No content - reset everything
    hasMultipleLines.value = false;
    isTextareaExpanded.value = false;
    userHasManuallyToggled.value = false;
    textarea.style.height = '36px';
    textarea.style.overflowY = 'hidden';
    return;
  }
  
  // Reset height to get natural content height (no need for padding manipulation)
  textarea.style.height = 'auto';
  
  const minHeight = 36; // Single line (increased from 24px)
  const maxHeight = window.innerHeight * 0.4; // 40vh
  const naturalHeight = textarea.scrollHeight;
  
  // More precise multi-line detection - now with accurate measurements
  const hasNewlines = content.value.includes('\n');
  // With padding (4px top, 8px bottom), single line should be around 44px (4+32+8)
  const singleLineThreshold = 49; // Allow some buffer for line-height
  const heightExceedsMinimum = naturalHeight > singleLineThreshold;
  
  // Only consider it multi-line if there are actual newlines OR significant height difference
  hasMultipleLines.value = hasNewlines || heightExceedsMinimum;
  
  // Auto-expand when multi-line is detected (unless user has manually toggled)
  if (hasMultipleLines.value && !isTextareaExpanded.value && !userHasManuallyToggled.value) {
    isTextareaExpanded.value = true;
  } else if (!hasMultipleLines.value && isTextareaExpanded.value) {
    isTextareaExpanded.value = false;
    userHasManuallyToggled.value = false; // Reset manual toggle when content becomes single line
  }
  
  let newHeight;
  if (isTextareaExpanded.value) {
    // Expanded mode: use natural height up to max
    newHeight = Math.min(Math.max(naturalHeight, minHeight), maxHeight);
  } else {
    // Collapsed mode: single line only
    newHeight = minHeight;
  }
  
  textarea.style.height = `${newHeight}px`;
  
  // Show scrollbar only when content actually overflows
  if (isTextareaExpanded.value && newHeight >= maxHeight) {
    textarea.style.overflowY = 'auto';
  } else {
    textarea.style.overflowY = 'hidden';
  }
  
};

// Toggle textarea expansion
const toggleTextareaExpansion = () => {
  isTextareaExpanded.value = !isTextareaExpanded.value;
  userHasManuallyToggled.value = true;
  // Trigger resize after state change
  nextTick(() => {
    autoResizeTextarea();
  });
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
    
    // Handle add recipients mode
    if (isAddRecipientsMode.value) {
      if (!addRecipientsMessageId.value || recipients.value.length === 0) {
        throw new Error('No message or recipients to add');
      }
      await MessageService.addRecipientsToMessage(addRecipientsMessageId.value, recipients.value, true, true);
      // Refresh origin and loaded ancestors
      await store.dispatch('messages/refreshLoadedAncestors', {
        messageId: addRecipientsMessageId.value,
        get_replies: true,
        get_children: true,
      });
      // Clear the form and exit add recipients mode
      content.value = '';
      store.dispatch('navigation/clearAddRecipientsMode');
      // No need to radius reload; ancestors refresh already updated data
      // Show success message
      showSendSuccess.value = true;
      setTimeout(() => {
        showSendSuccess.value = false;
      }, 2000);
      return;
    }
    
    // DRAFT REPLY FLOW: If configured, bulk add draft recipients to ancestors of parent first (notify only for reply later)
    if (props.targetId && recipients.value.length > 0 && replyAddToAncestors.value) {
      await MessageService.addRecipientsToMessage(props.targetId, recipients.value, true, false);
      // Refresh origin and loaded ancestors (no notify path)
      await store.dispatch('messages/refreshLoadedAncestors', {
        messageId: props.targetId,
        get_replies: true,
        get_children: true,
      });
    }
    
    // Create a new message using the store action (normal notification for new reply)
    const newMessage = await store.dispatch('messages/sendReply', {
      parentId: props.targetId, // Will be null for new threads
      content: content.value,
      isPrivate: !isPublic.value,
      recipients: recipients.value,
      // Ensure the author is explicitly set to the user's UID (not email)
      content_author: currentUser.uid
    });
    
    
    // Clear the input
    content.value = '';
    
    // Reset expansion state
    isTextareaExpanded.value = false;
    hasMultipleLines.value = false;
    userHasManuallyToggled.value = false;
    
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
          
          // Always set this as branch_child, regardless of whether it's the first reply
          // Set immediately without rechecking child_ids to avoid race conditions
          store.commit('messages/SET_BRANCH_CHILD', {
            messageId: props.targetId,
            childId: newMessage.id
          });
        }
        
        // 5. Force reload the branch path in case it's not already updated
        // This needs to be done after a short delay to ensure store is updated
        setTimeout(() => {
          if (store.state.navigation && store.state.navigation.currentRoute) {
            const currentThreadId = store.state.navigation.currentRoute.params.id;
            if (currentThreadId) {
              store.dispatch('messages/prepareBranchPath', parseInt(currentThreadId, 10));
            }
          }
          
          // 6. Only hide the reply box after ensuring all UI updates are processed
          // This prevents prematurely closing the reply box before the UI updates
          if (!props.isNewThread) {
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

// Bot prompt add moved to global modal

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

// Toggle recipient selector visibility
const toggleRecipientSelector = () => {
  if (!showRecipientSelector.value) {
    // Only dismiss keyboard when opening the modal
    dismissMobileKeyboard();
  }
  showRecipientSelector.value = !showRecipientSelector.value;
};

// Close recipient selector
const closeRecipientSelector = (event) => {
  if (event) {
    event.stopPropagation();
  }
  showRecipientSelector.value = false;
};

// Bot prompt methods removed (handled by global modal)

// Handle clicks outside reply box
const handleClickOutside = (event) => {
  // Don't close if any modal is open
  if (showRecipientSelector.value || showBotModal.value) {
    return;
  }
  
  const replySheetElement = replySheet.value;
  const replyButtons = document.querySelectorAll('.reply-button, .mobile-reply-button');
  
  // Close if clicked outside reply sheet and not on a reply button
  if (replySheetElement && !replySheetElement.contains(event.target) && 
      Array.from(replyButtons).every(btn => !btn.contains(event.target))) {
    hideBottomSheet();
  }
};

// Close search results when clicking outside
onMounted(async () => {
  document.addEventListener('click', handleClickOutsideSearch);
  document.addEventListener('click', handleClickOutside);
  
  // Initialize textarea sizing
  nextTick(() => {
    autoResizeTextarea();
  });
});

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
    focusTextarea();
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
    isTextareaExpanded.value = false;
    hasMultipleLines.value = false;
    userHasManuallyToggled.value = false;
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
  background-color: transparent;
  z-index: 999;
  pointer-events: none; /* Allow clicks to pass through */
}

/* Bottom sheet */
.reply-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: -20px; /* Position slightly below the viewport */
  background-color: var(--color-surface);
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  padding-bottom: calc(env(safe-area-inset-bottom) + 20px); /* Keep safe area padding */
  display: flex;
  flex-direction: column;
  max-height: calc(50vh + 20px); /* Account for the extended bottom */
  min-height: auto; /* Let it size to content */
  height: auto; /* Auto-size to content */
  transform: translateY(100%);
  transition: transform 0.3s ease-out;
}

.reply-sheet--visible {
  transform: translateY(0);
}

.reply-sheet--raised {
  transform: translateY(-8px);
}

.reply-sheet--closing {
  animation: reply-sheet-fade-out 150ms ease forwards;
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
  padding: 8px 16px;
  border-bottom: 1px solid var(--color-border);
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  flex-shrink: 0;
  background-color: #2A2A2A;
  position: relative;
  overflow: hidden; /* Ensures any child elements don't spill outside rounded corners */
}

.reply-sheet__header-left {
  flex: 1;
}

.reply-sheet__title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
}

.reply-sheet__header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

/* Controls toolbar */
.reply-sheet__toolbar {
  display: flex;
  align-items: center;
  padding: 6px 16px 6px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border);
  background-color: #2A2A2A;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Toolbar controls */
.toolbar-control {
  flex-shrink: 0;
}

/* Visibility toggle switch */
.visibility-toggle {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--color-surface);
  min-height: 36px;
}

.visibility-toggle.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.visibility-option {
  flex: 1;
  background: transparent;
  border: none;
  padding: 8px 12px;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.visibility-option:first-child {
  border-right: 1px solid var(--color-border);
}

.visibility-option.active {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  font-weight: 600;
}

.visibility-option:disabled {
  cursor: not-allowed;
}

.visibility-toggle.disabled .visibility-option {
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

@media (hover: hover) and (pointer: fine) {
  .meta-pill:hover:not(:disabled) {
    background-color: var(--color-hover-overlay);
    border-color: var(--color-border-hover);
  }
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

/* Globe toggle styling */
.visibility-globe-toggle {
  position: relative;
}

.visibility-globe-toggle.active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.visibility-globe-toggle.active .meta-pill__icon {
  filter: none;
}
/* Stabilize active state styles and avoid sticky hover color on touch */
.visibility-globe-toggle:focus { outline: none; }
.visibility-globe-toggle:focus-visible {
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb, 79, 140, 255), 0.2);
}
@media (hover: hover) and (pointer: fine) {
  .visibility-globe-toggle.active:hover {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-text-inverse);
  }
}

/* Textarea container */
.reply-sheet__textarea-container {
  flex: none; /* Don't expand to fill space */
  padding: 8px 16px 24px 16px;
  position: relative;
  min-height: 0;
  background-color: #2A2A2A;
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

/* Textarea wrapper with toggle button */
.textarea-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  align-items: flex-end;
  margin-bottom: 10px; /* Add space at bottom without affecting textarea height */
}

.reply-sheet__textarea {
  flex: 1;
  min-height: 36px; /* Single line height (increased from 24px) */
  max-height: 40vh;
  padding: 4px 12px 8px 12px; /* Reduced top padding, kept bottom padding */
  padding-right: 36px; /* Space for toggle button on right */
  margin: 0;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background-color: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--font-size-md);
  line-height: 1.5;
  resize: none;
  transition: border-color 0.2s ease, height 0.2s ease;
  box-sizing: border-box;
  overflow-y: hidden; /* Will be controlled by autoResizeTextarea */
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

/* Textarea expand toggle button */
.textarea-expand-toggle {
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 20px;
  height: 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 10px;
  color: var(--color-text-secondary);
  transition: all 0.2s ease;
  z-index: 10;
  opacity: 0.7;
}

.textarea-expand-toggle:hover {
  background: var(--color-hover-overlay);
  border-color: var(--color-border-hover);
  opacity: 1;
  transform: scale(1.05);
}

.textarea-expand-toggle.expanded {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-text-inverse);
  opacity: 1;
}

.textarea-expand-toggle.expanded:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.expand-arrow {
  line-height: 1;
  transition: transform 0.2s ease;
}

.textarea-expand-toggle.expanded .expand-arrow {
  transform: rotate(90deg);
}

/* Textarea send button */
.textarea-send-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 40px;
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all var(--transition-fast);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}

.textarea-send-button:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
  transform: scale(1.05);
}

.textarea-send-button:active:not(:disabled) {
  transform: scale(0.95);
}

.textarea-send-button--disabled {
  background-color: var(--color-surface-light);
  color: var(--color-text-disabled);
  cursor: not-allowed;
  transform: none;
}

.textarea-send-button--disabled:hover {
  background-color: var(--color-surface-light);
  transform: none;
}

.textarea-send-button--loading {
  cursor: wait;
}

.textarea-send-button--success {
  background-color: var(--color-success);
  transform: scale(1.05);
}

.send-button__arrow {
  font-size: 18px;
  line-height: 1;
  transform: rotate(0deg);
  transition: transform var(--transition-fast);
}

.textarea-send-button:hover:not(:disabled) .send-button__arrow {
  transform: rotate(15deg);
}



/* Close button */
.reply-sheet__close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: 16px;
  font-weight: bold;
  transition: color 0.2s ease;
  padding: 0;
}

.reply-sheet__close-button:hover {
  color: var(--color-error);
}

/* Mobile responsive styles */
@media (max-width: 768px) {
  /* Hide desktop reply container on mobile */
  .reply-container {
    display: none !important;
  }
  
  /* Mobile optimizations */
  
  .reply-sheet {
    border-radius: 0;
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
    bottom: -30px; /* Position even further below on mobile */
    max-height: calc(50vh + 30px); /* Account for the extended bottom */
    min-height: auto; /* Let it size to content */
    height: auto; /* Auto-size to content */
  }
  
  .reply-sheet__header {
    padding: 8px 16px;
  }
  
  .reply-sheet__header-right {
    gap: 8px;
  }
  
  .reply-sheet__meta {
    padding: 0 16px 16px;
  }
  
  .reply-sheet__textarea-container {
    flex: none; /* Don't expand to fill space on mobile */
    padding: 8px 16px 24px 16px; /* Consistent padding on mobile */
  }
}

@media (max-width: 480px) {
  .reply-sheet__title {
    font-size: var(--font-size-sm);
  }
  
  .reply-sheet__toolbar {
    padding: 4px 12px 4px;
    gap: 8px;
    flex-wrap: wrap;
  }
  
  .visibility-toggle {
    min-height: 32px;
  }
  
  .visibility-option {
    font-size: var(--font-size-xs);
    padding: 6px 8px;
  }
  
  .meta-pill {
    padding: 6px 8px;
    font-size: var(--font-size-xs);
    min-height: 32px;
  }
  
  .textarea-send-button {
    min-width: 36px;
    height: 36px;
    font-size: 16px;
  }
  
  .reply-sheet__close-button {
    width: 28px;
    height: 28px;
    font-size: 20px;
  }
  
  .reply-sheet__textarea {
    min-height: 40px;
    padding: 10px;
  }
}

/* Desktop optimizations - keep mobile design but improve desktop UX */
@media (min-width: 769px) {
  .reply-sheet {
    width: 100%; /* Add width to ensure it doesn't get too wide */
    left: 50%;
    transform: translateX(-50%);
    border-radius: var(--radius-md);
    max-height: 60vh;
    padding: 0 60px;
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

.modal-overlay.closing {
  animation: quick-fade-out 150ms ease forwards;
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

.add-button {
  padding: 10px 20px;
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-button:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.add-button:disabled {
  background-color: var(--color-border);
  color: var(--color-text-secondary);
  cursor: not-allowed;
  transform: none;
}

.add-button.success {
  background-color: var(--color-success);
  color: rgba(255, 255, 255, 0.9);
}

/* Keep success state stable on hover */
.add-button.success:hover {
  background-color: var(--color-success);
  transform: none;
}

.modal-footer .add-button {
  margin-right: 8px;
}

.close-button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.5rem;
  color: var(--color-text);
}

.modal-description {
  margin-bottom: 0;
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

.recipient-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.visibility-toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: background-color var(--transition-fast);
}

.visibility-toggle-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.visibility-toggle-btn.invisible {
  opacity: 0.6;
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

@keyframes quick-fade-out {
  0% { opacity: 1; }
  100% { opacity: 0; }
}

@keyframes reply-sheet-fade-out {
  0% { 
    opacity: 1;
    transform: translateY(0);
  }
  100% { 
    opacity: 0;
    transform: translateY(20px);
  }
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

/* OLD MOBILE STYLES MOVED TO DESKTOP-ONLY SECTION ABOVE */
/* These styles are now only active on desktop (min-width: 769px) to avoid conflicts with the new bottom sheet */



/* Bot prompt modal styles */
.bot-prompt-modal {
  position: relative;
  max-width: 450px;
  width: 95%;
  height: 75vh;
  max-height: 75vh;
  background-color: var(--color-surface);
  padding: var(--space-lg);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  z-index: 1001;
  overflow-y: auto;
}

/* Small, subtle toggle for "Add to all ancestors" in bot modal */
.ancestors-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  margin-bottom: 6px;
  opacity: 0.8;
}

.ancestors-toggle label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.ancestors-toggle input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: var(--color-primary);
}

.ancestors-toggle span {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.bot-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: var(--space-md);
}

.bot-option-button {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: var(--font-size-md);
  width: 100%;
  text-align: left;
  margin-bottom: 6px;
}

.bot-option-button:hover:not(:disabled) {
  background-color: var(--color-hover-overlay);
  border-color: var(--color-border-hover);
}

.bot-option-button:disabled {
  opacity: 0.7;
  cursor: wait;
}

.bot-option-button.confirm-state {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.bot-option-button.confirm-state:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  border-color: var(--color-primary-dark);
}

.bot-option-button.loading {
  background-color: var(--color-surface-light);
  border-color: var(--color-border);
  color: var(--color-text-secondary);
  cursor: wait;
}

.bot-option-button.success {
  background-color: var(--color-success);
  border-color: var(--color-success);
  color: var(--color-text-inverse);
}

.bot-option-button.error {
  background-color: var(--color-error);
  border-color: var(--color-error);
  color: var(--color-text-inverse);
}

/* Advanced bots dropdown styles */
.advanced-bot-options {
  margin-top: 8px;
}

.advanced-bots-inline {
  display: inline-block;
}

.advanced-bots-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: var(--font-size-xs);
  opacity: 0.7;
}

.advanced-bots-toggle:hover {
  background-color: var(--color-hover-overlay);
  border-radius: var(--radius-sm);
  opacity: 1;
}

.advanced-bots-text {
  font-weight: 400;
}

.advanced-bots-icon {
  font-size: 9px;
  transition: transform var(--transition-fast);
}

.advanced-bots-icon.expanded {
  transform: rotate(180deg);
}

.advanced-bot-list {
  margin-top: 6px;
  padding-left: 0;
}

.advanced-bot-button {
  margin-bottom: 6px;
  opacity: 0.8;
  transform: scale(0.95);
}

.advanced-bot-button:last-child {
  margin-bottom: 0;
}

.bot-option-icon {
  font-size: var(--font-size-lg);
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
}

.bot-option-text {
  font-weight: 500;
  flex: 1;
}

.bot-loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Mobile responsive adjustments for bot modal */
@media (max-width: 768px) {
  .bot-prompt-modal {
    max-width: 95%;
    padding: var(--space-md);
  }
  
  .bot-option-button {
    padding: 10px 12px;
    font-size: var(--font-size-sm);
  }
  
  .bot-option-icon {
    font-size: var(--font-size-md);
    min-width: 18px;
  }
}

@media (max-width: 480px) {
  .bot-prompt-modal {
    padding: var(--space-sm);
  }
  
  .bot-option-button {
    padding: 8px 10px;
    gap: 8px;
  }
}
</style> 
