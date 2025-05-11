<template>
  <div 
    class="message-node" 
    :class="{ 'selected': isSelected, 'pinned': isPinned }"
  >
    <!-- Add sibling navigator if message has a parent -->
    <sibling-navigator
      v-if="message.parent_id"
      :message-id="message.id"
      :parent-id="message.parent_id"
      @navigate="handleSiblingNavigation"
    />
    
    <div class="message-content">
      <div class="message-header">
        <div class="author-section">
          <div class="author-info">
            <span class="message-author" :class="{ 'current-user-name': isCurrentUser }">{{ authorDisplayName }}</span>
            <span v-if="authorUserTag" class="author-user-tag">@{{ authorUserTag }}</span>
          </div>
          
          <!-- Public badge - shown for all public messages -->
          <span v-if="isPublic" class="visibility-indicator public">
            Public
          </span>
          
          <!-- To You badge (for recipients) -->
          <div v-if="isUserRecipient" class="recipients-dropdown-container">
            <button 
              @click.stop="toggleRecipientsDropdown('to-you')" 
              class="recipients-toggle to-you"
              ref="toYouButton"
            >
              <!-- If only the user is recipient -->
              <span v-if="recipientsExcludingUser.length === 0">
                To You
              </span>
              <!-- If there are other recipients -->
              <span v-else>
                To You and {{ recipientsExcludingUser.length }} other{{ recipientsExcludingUser.length > 1 ? 's' : '' }}
              </span>
            </button>
          </div>
          
          <!-- Recipients badge (for authors) -->
          <div v-if="isUserAuthor && hasRecipients" class="recipients-dropdown-container author-container">
            <button 
              @click.stop="toggleRecipientsDropdown('author')" 
              class="recipients-toggle author-toggle"
              ref="authorButton"
            >
              Recipients ({{ message.recipients.length }})
            </button>
          </div>
          
          <!-- Unified Recipients dropdown -->
          <div v-if="showRecipientsDropdown" class="recipients-dropdown-overlay" @click="showRecipientsDropdown = false">
            <div class="recipients-dropdown" :style="dropdownPositionStyle" @click.stop>
              <div class="dropdown-header">
                Recipients
                <button @click.stop="showRecipientsDropdown = false" class="close-dropdown">×</button>
              </div>
              <ul class="recipients-list">
                <li 
                  v-for="(recipient, index) in message.recipients" 
                  :key="recipient.uid || index" 
                  class="recipient-item"
                >
                  <span class="recipient-name">{{ recipient.display_name || recipient.user_tag }}</span>
                  <span class="recipient-tag">@{{ recipient.user_tag }}</span>
                </li>
                <li v-if="message.recipients.length === 0" class="no-recipients">
                  No specific recipients
                </li>
              </ul>
            </div>
          </div>
          
          <!-- Admin controls -->
          <div class="admin-controls" v-if="isAdmin">
            <span 
              @click.stop="openTitleDescriptionModal" 
              class="title-icon"
              title="Edit title and description"
            >T</span>
            
            <button 
              @click.stop="togglePinStatus" 
              class="pin-button"
              :class="{ 'loading': isPinning }"
              :title="isPinned ? 'Unpin this message' : 'Pin this message'"
              :disabled="isPinning"
            >
              <span v-if="isPinning" class="pin-loading-indicator"></span>
              <span v-else class="pin-icon">📌</span>
              {{ isPinned ? 'Unpin' : 'Pin' }}
            </button>
            
            <button 
              @click.stop="$emit('delete', message)" 
              class="delete-button"
              title="Admin: Delete this message and all replies"
            >
              Delete
            </button>
          </div>
          
          <!-- Non-admin author delete button -->
          <button 
            v-if="isUserAuthor && !isAdmin" 
            @click.stop="$emit('delete', message)" 
            class="delete-button"
            title="Delete this message and all replies"
          >
            Delete
          </button>
        </div>
        <span class="message-timestamp">{{ formatTimestamp(message.timestamp) }}</span>
      </div>
      
      <div class="message-body">
        {{ message.content }}
      </div>
      
      <div class="message-footer">
        <div class="message-actions">
          <div class="reply-count">
            {{ totalReplies }} {{ totalReplies === 1 ? 'reply' : 'replies' }}
          </div>
          
          <!-- Pin status indicator -->
          <div v-if="isPinned" class="pin-status-indicator">
            <span class="pin-icon">📌</span> Pinned
          </div>
        </div>
      </div>
    </div>
    
    <!-- Title/Description Edit Modal -->
    <div v-if="showTitleDescModal" class="modal-overlay" @click.stop="closeTitleDescModal">
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <h3>Edit Title & Description</h3>
          <button class="close-button" @click.stop="closeTitleDescModal">×</button>
        </div>
        
        <div class="modal-content">
          <div class="form-group">
            <label for="messageTitle">Title</label>
            <input 
              id="messageTitle" 
              v-model="editableTitle" 
              type="text" 
              placeholder="Message title"
              ref="titleInput"
            />
          </div>
          
          <div class="form-group">
            <label for="messageDescription">Description</label>
            <textarea 
              id="messageDescription" 
              v-model="editableDescription" 
              rows="3" 
              placeholder="Brief description of this message"
            ></textarea>
          </div>
          
          <div v-if="saveMessage" class="save-status" :class="{ 'error': saveError }">
            {{ saveMessage }}
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="cancel-btn" @click.stop="closeTitleDescModal">Cancel</button>
          <button 
            class="save-btn" 
            @click.stop="saveTitleAndDescription" 
            :disabled="isSaving"
          >
            {{ isSaving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import AdaptiveMarker from './AdaptiveMarker.vue';
import SiblingNavigator from './SiblingNavigator.vue';
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useStore } from 'vuex';

export default {
  name: 'MessageNode',
  
  components: {
    AdaptiveMarker,
    SiblingNavigator
  },
  
  props: {
    message: {
      type: Object,
      required: true
    },
    isSelected: {
      type: Boolean,
      default: false
    },
    indentLevel: {
      type: Number,
      default: 0
    },
    loadedReplies: {
      type: Number,
      default: 0
    },
    totalReplies: {
      type: Number,
      default: 0
    },
    canReply: {
      type: Boolean,
      default: true
    }
  },
  
  setup(props) {
    const store = useStore();
    const currentUser = computed(() => store.getters['auth/user']);
    const isAdmin = computed(() => store.getters['auth/isAdmin']);
    const showRecipientsDropdown = ref(false);
    const lastClickedBadge = ref(null);
    const toYouButton = ref(null);
    const authorButton = ref(null);
    const dropdownPositionStyle = ref({});
    
    // Title/Description Modal
    const showTitleDescModal = ref(false);
    const editableTitle = ref('');
    const editableDescription = ref('');
    const isSaving = ref(false);
    const saveMessage = ref('');
    const saveError = ref(false);
    const titleInput = ref(null);
    
    const openTitleDescriptionModal = () => {
      editableTitle.value = props.message.title || '';
      editableDescription.value = props.message.description || '';
      showTitleDescModal.value = true;
      
      // Clear any previous status message
      saveMessage.value = '';
      saveError.value = false;
      
      // Focus the title input after the modal is shown
      nextTick(() => {
        if (titleInput.value) {
          titleInput.value.focus();
        }
      });
    };
    
    const closeTitleDescModal = () => {
      showTitleDescModal.value = false;
      // Clear any status message
      saveMessage.value = '';
      saveError.value = false;
    };
    
    const saveTitleAndDescription = async () => {
      // For now just close the modal, since updateMessage action was removed
      isSaving.value = true;
      
      try {
        // Create update data object with only the fields that should be sent
        const updateData = {};
        
        // Always send both fields, with null for empty strings
        // This explicitly indicates we want to clear the field if it's empty
        updateData.title = editableTitle.value.trim() || null;
        updateData.description = editableDescription.value.trim() || null;
        
        // Call the store action to update title and description
        const success = await store.dispatch('messages/updateTitleDescription', {
          messageId: props.message.id,
          ...updateData
        });
        
        if (success) {
          closeTitleDescModal();
          saveMessage.value = 'Title and description saved successfully!';
        } else {
          // Handle error - could add error state here if needed
          console.error('Failed to save title and description');
          saveError.value = true;
          saveMessage.value = 'Failed to save title and description. Please try again later.';
        }
      } catch (error) {
        console.error('Error saving title and description:', error);
        saveError.value = true;
        saveMessage.value = 'An error occurred while saving title and description. Please try again later.';
      } finally {
        isSaving.value = false;
      }
    };
    
    const isPublic = computed(() => {
      const publicValue = props.message.public;
      const result = publicValue === 1 || publicValue === true;
      return result;
    });
    
    const isUserRecipient = computed(() => {
      if (!currentUser.value) return false;
      
      // Check if the current user is in the recipients list
      return props.message.recipients.some(recipient => {
        // Check by UID first (most reliable)
        if (recipient.uid === currentUser.value.uid) {
          return true;
        }
        
        // Fallback check by user_tag
        if (recipient.user_tag && currentUser.value.user_tag && 
            recipient.user_tag === currentUser.value.user_tag) {
          return true;
        }
        
        // Last resort: check by email for backward compatibility
        if (recipient.user_tag && currentUser.value.email && 
            recipient.user_tag === currentUser.value.email) {
          return true;
        }
        
        return false;
      });
    });
    
    // Check if message is pinned
    const isPinned = computed(() => {
      return props.message.is_pinned === 1 || props.message.is_pinned === true;
    });
    
    const isPinning = ref(false);
    
    // Toggle pin status
    const togglePinStatus = async () => {
      try {
        isPinning.value = true;
        
        if (isPinned.value) {
          await store.dispatch('messages/unpinMessage', props.message.id);
        } else {
          await store.dispatch('messages/pinMessage', props.message.id);
        }
      } catch (error) {
        console.error('Error toggling pin status:', error);
      } finally {
        isPinning.value = false;
      }
    };
    
    // Get recipients excluding the current user
    const recipientsExcludingUser = computed(() => {
      if (!currentUser.value || !props.message.recipients) {
        return [];
      }
      
      return props.message.recipients.filter(recipient => {
        // First check by UID
        if (recipient.uid && currentUser.value.uid && 
            recipient.uid === currentUser.value.uid) {
          return false;
        }
        
        // Then check by user_tag
        if (recipient.user_tag && currentUser.value.user_tag && 
            recipient.user_tag === currentUser.value.user_tag) {
          return false;
        }
        
        // Finally check by email for backward compatibility
        if (recipient.user_tag && currentUser.value.email && 
            recipient.user_tag === currentUser.value.email) {
          return false;
        }
        
        return true;
      });
    });
    
    // Get author display name
    const authorDisplayName = computed(() => {
      return props.message.author_display_name || '';
    });
    
    // Get author user tag
    const authorUserTag = computed(() => {
      return props.message.author_user_tag || null;
    });
    
    // Check if the current user is the author of the message
    const isUserAuthor = computed(() => {
      if (!currentUser.value) {
        return false;
      }
      
      // Handle both old and new author formats
      if (props.message.content_author === 'chatgpt' || props.message.content_author === 'chatgpt-system' || props.message.author_email === 'chatgpt') {
        return false;
      }
      
      // First check the UID
      if (currentUser.value.uid === props.message.content_author) {
        return true;
      }
      
      // Then check the email (for backward compatibility)
      if (props.message.author_email && currentUser.value.email === props.message.author_email) {
        return true;
      }
      
      return false;
    });
    
    // Utility function to check if a recipient is the author
    const isUserAuthorOfContent = (recipient) => {
      if (!props.message || !recipient) return false;
      
      // The message author UID should match the recipient UID
      if (props.message.content_author && recipient.uid && 
          props.message.content_author === recipient.uid) {
        return true;
      }
      
      // Or the message author user_tag should match the recipient user_tag
      if (props.message.author_user_tag && recipient.user_tag && 
          props.message.author_user_tag === recipient.user_tag) {
        return true;
      }
      
      return false;
    };
    
    const isEndOfBranch = computed(() => {
      return store.getters['messages/isEndOfBranch'](props.message.id);
    });
    
    const isLoadingSiblings = computed(() => {
      // Check if parent exists
      if (!props.message.parent_id) return false;
      
      const parentMessage = store.getters['messages/getMessage'](props.message.parent_id);
      
      // If parent doesn't exist in the store, show loading
      if (!parentMessage) return true;
      
      // Check if parent is loading its children
      return store.getters['messages/isLoading'](props.message.parent_id, 'children');
    });
    
    const hasRecipients = computed(() => {
      return props.message.recipients && props.message.recipients.length > 0;
    });
    
    // Toggle recipients dropdown with positioning
    const toggleRecipientsDropdown = (badgeType) => {
      lastClickedBadge.value = badgeType;
      
      // Toggle the dropdown visibility
      showRecipientsDropdown.value = !showRecipientsDropdown.value;
      
      // If opening the dropdown, position it correctly
      if (showRecipientsDropdown.value) {
        nextTick(() => {
          const targetButton = badgeType === 'to-you' ? toYouButton.value : authorButton.value;
          if (targetButton) {
            const rect = targetButton.getBoundingClientRect();
            dropdownPositionStyle.value = {
              position: 'fixed',
              top: `${rect.bottom + 2}px`,
              left: `${rect.left}px`,
            };
          }
        });
      }
    };
    
    // Update the click handler to be more global
    const handleClickOutside = (event) => {
      // Simply close the dropdown no matter where clicked
      if (showRecipientsDropdown.value) {
        showRecipientsDropdown.value = false;
      }
    };
    
    const handleSiblingNavigation = ({ direction, targetSiblingId, parentId }) => {
      // No longer automatically select the new target sibling
      // Selection will be handled by the navigateToSibling action
      // based on whether the previous sibling was selected
      console.log(`[MessageNode] Sibling navigation: ${direction}, target: ${targetSiblingId}`);
    };
    
    const isCurrentUser = computed(() => {
      if (!currentUser.value) return false;
      
      // Check if the author is the current user
      // First try to match by user tag
      if (authorUserTag.value && currentUser.value.user_tag === authorUserTag.value) {
        return true;
      }
      
      // Then check by email
      if (props.message.author_email && currentUser.value.email === props.message.author_email) {
        return true;
      }
      
      // Finally check content_author for older messages
      if (props.message.content_author === currentUser.value.uid) {
        return true;
      }
      
      return false;
    });
    
    // Add new helper method to check if current user is a recipient
    const isCurrentUserRecipient = (recipient) => {
      if (!currentUser.value || !recipient) return false;
      
      // Check by UID
      if (recipient.uid && currentUser.value.uid && 
          recipient.uid === currentUser.value.uid) {
        return true;
      }
      
      // Check by user_tag
      if (recipient.user_tag && currentUser.value.user_tag && 
          recipient.user_tag === currentUser.value.user_tag) {
        return true;
      }
      
      // Check by email for backward compatibility
      if (recipient.user_tag && currentUser.value.email && 
          recipient.user_tag === currentUser.value.email) {
        return true;
      }
      
      return false;
    };
    
    // Listen in the capture phase to get clicks before other handlers
    onMounted(() => {
      document.addEventListener('click', handleClickOutside, true);
    });
    
    onBeforeUnmount(() => {
      document.removeEventListener('click', handleClickOutside, true);
    });
    
    return {
      currentUser,
      isUserRecipient,
      isUserAuthor,
      isPublic,
      isAdmin,
      isPinned,
      togglePinStatus,
      showTitleDescModal,
      editableTitle,
      editableDescription,
      isSaving,
      openTitleDescriptionModal,
      closeTitleDescModal,
      saveTitleAndDescription,
      hasReplies: computed(() => props.totalReplies > 0),
      isEndOfBranch,
      hasRecipients,
      showRecipientsDropdown,
      toggleRecipientsDropdown,
      recipientsExcludingUser,
      authorDisplayName,
      authorUserTag,
      isUserAuthorOfContent,
      isPinning,
      handleSiblingNavigation,
      isCurrentUser,
      isCurrentUserRecipient,
      toYouButton,
      authorButton,
      dropdownPositionStyle,
      saveMessage,
      saveError,
      titleInput
    };
  },
  
  methods: {
    formatTimestamp(timestamp) {
      return new Date(timestamp).toLocaleString();
    }
  }
}
</script>

<style scoped>
.message-node {
  margin-bottom: 15px;
  transition: all 0.2s ease;
  position: relative;
}

/* Add extra horizontal margin for messages with siblings */
/* First selector uses :has() which isn't supported in all browsers */
.message-node:has(> .sibling-navigator) .message-content,
/* Fallback for browsers that don't support :has() */
.message-node > .sibling-navigator ~ .message-content {
  margin-left: 40px;
  margin-right: 40px;
  max-width: calc(100% - 80px);
}

.message-content {
  background-color: var(--card-background, #f5f5f5);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid var(--border-color, #ddd);
}

.message-node.selected .message-content {
  border: 2px solid var(--primary-color, #007bff);
  background-color: var(--primary-color-light, #e6f2ff);
}

.message-node.pinned .message-content {
  border-color: var(--primary-color-light, #c8e6ff);
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.author-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.message-author {
  font-weight: bold;
}

.message-author.current-user-name {
  font-weight: 800;
  color: var(--primary-color, #4a90e2);
}

.author-user-tag {
  color: var(--text-color-light, #777);
  font-size: 0.85em;
}

.visibility-indicator, .recipients-toggle {
  /* Apply consistent base styling to both types of indicators */
  font-size: 0.75em;
  padding: 2px 6px;
  border-radius: 10px;
  height: 22px;
  display: inline-flex;
  align-items: center;
}

.visibility-indicator {
  background-color: #91c754;
  color: black;
}

.visibility-indicator.private {
  background-color: #ff9800;
}

.recipients-toggle {
  /* Base styling for all recipient toggles */
  font-size: 0.75em;
  padding: 2px 6px;
  cursor: pointer;
  border-radius: 10px;
  transition: all 0.2s;
  margin-left: 0;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.recipients-toggle:not(.to-you):not(.author-toggle) {
  /* Only apply these styles to the default toggle (not author or to-you) */
  background-color: transparent;
  border: 1px solid var(--border-color, #ddd);
  color: var(--text-color-light, #777);
}

.recipients-toggle.to-you {
  background-color: #2196f3; /* Blue for To You badge */
  color: white;
  border: none;
}

.recipients-toggle.author-toggle {
  background-color: #da843a; /* Dark orange for author badge */
  color: black;
  border: none;
}

.recipients-dropdown-container {
  position: relative;
}

.recipients-dropdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 90;
}

.recipients-dropdown {
  background-color: var(--card-background, white);
  border: 1px solid var(--border-color, #ddd);
  border-radius: 6px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 100;
  min-width: 180px;
  max-width: 250px;
}

.author-container {
  position: relative;
}

.author-dropdown {
  position: absolute;
}

.dropdown-header {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-color, #ddd);
  font-weight: bold;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}

.close-dropdown {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: var(--text-color-light, #777);
}

.recipients-list {
  list-style: none;
  padding: 4px 0;
  margin: 0;
  max-height: 180px;
  overflow-y: auto;
}

.recipient-item {
  padding: 4px 10px;
  line-height: 1.3;
  display: flex;
  flex-direction: column;
}

.recipient-name {
  font-weight: 500;
  margin-bottom: 0;
  font-size: 0.9rem;
}

.recipient-tag {
  font-size: 0.8em;
  color: var(--text-color-light, #777);
  opacity: 0.8;
}

.no-recipients {
  padding: 4px 10px;
  color: var(--text-color-light, #777);
  font-style: italic;
  font-size: 0.85rem;
}

.admin-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pin-button, .delete-button, .title-button {
  font-size: 0.75em;
  padding: 2px 8px;
  border-radius: 3px;
  cursor: pointer;
  background-color: transparent;
  border: 1px solid var(--border-color, #ddd);
  color: var(--text-color-light, #777);
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.pin-button:hover, .delete-button:hover, .title-button:hover {
  background-color: var(--card-background-active, #f0f0f0);
}

.title-icon {
  font-family: "Times New Roman", serif;
  font-style: italic;
  font-weight: bold;
  font-size: 1.3em;
  color: #b01b2e; /* Closer to the dark red in the image */
  cursor: pointer;
  transition: color 0.2s ease;
  margin: 0 8px 0 0;
  display: inline-block;
  transform: skewX(-5deg); /* Slight slant */
  position: relative;
  top: 1px;
}

.title-icon:hover {
  color: #d84156; /* Lighter red for hover state */
}

.delete-button {
  color: #e74c3c; /* Red for delete */
  border-color: #ffcccc;
}

.delete-button:hover {
  background-color: #fff0f0;
}

.pin-icon {
  font-size: 0.9em;
}

.message-timestamp {
  font-size: 0.8em;
  color: var(--text-color-light, #777);
  white-space: nowrap;
}

.message-body {
  margin-bottom: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.message-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8em;
  color: var(--text-color-light, #777);
}

.message-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.pin-status-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--primary-color);
  font-weight: 500;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background-color: var(--card-background);
  border-radius: 12px;
  width: 90%;
  max-width: 450px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  color: var(--text-color);
  font-size: 18px;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-color);
  opacity: 0.7;
}

.close-button:hover {
  opacity: 1;
}

.modal-content {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--input-background, #fff);
  color: var(--text-color);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  gap: 12px;
}

.cancel-btn {
  background-color: transparent;
  color: var(--text-color);
  border: 1px solid var(--border-color);
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.save-btn {
  background-color: var(--primary-color);
  color: black;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  min-width: 120px;
  height: 38px;
}

.save-btn:hover:not(:disabled) {
  background-color: var(--primary-color-dark, #0069d9);
}

.save-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.pin-loading-indicator {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--primary-color, #007bff);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 4px;
}

.pin-button.loading {
  opacity: 0.7;
  cursor: wait;
}

.save-status {
  margin-top: 12px;
  padding: 8px;
  border-radius: 4px;
  background-color: var(--card-background-active, #f0f0f0);
  color: var(--text-color);
  font-size: 0.85em;
}

.save-status.error {
  background-color: var(--card-background-error, #ffcccc);
}
</style>
