<template>
  <div 
    class="message-node" 
    :class="{ 'selected': isSelected, 'pinned': isPinned }"
  >
    <div class="message-content">
      <div class="message-header">
        <div class="author-section">
          <div class="author-info">
            <span class="message-author">{{ authorDisplayName }}</span>
            <span v-if="authorUserTag" class="author-user-tag">@{{ authorUserTag }}</span>
          </div>
          
          <!-- Public badge - shown for all public messages -->
          <span v-if="isPublic" class="visibility-indicator public">
            Public
          </span>
          
          <!-- To You badge with recipients dropdown (for recipients) -->
          <div v-if="isUserRecipient" class="recipients-dropdown-container">
            <button 
              @click.stop="toggleRecipientsDropdown" 
              class="recipients-toggle to-you"
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
            
            <!-- Recipients dropdown -->
            <div v-if="showRecipientsDropdown" class="recipients-dropdown">
              <div class="dropdown-header">
                Recipients
                <button @click.stop="toggleRecipientsDropdown" class="close-dropdown">×</button>
              </div>
              <ul class="recipients-list">
                <li v-if="currentUser" class="recipient-item current-user">
                  {{ currentUser.email }} <span class="user-tag">(you)</span>
                </li>
                <li v-for="(recipient, index) in recipientsExcludingUser" 
                    :key="index" 
                    class="recipient-item"
                >
                  {{ recipient }}
                  <span v-if="isUserAuthorOfContent(recipient)" class="author-tag">(author)</span>
                </li>
              </ul>
            </div>
          </div>
          
          <!-- Recipients dropdown for authors who are not recipients -->
          <div v-else-if="isUserAuthor && hasRecipients" class="recipients-dropdown-container author-container">
            <button 
              @click.stop="toggleRecipientsDropdown" 
              class="recipients-toggle author-toggle"
            >
              Recipients ({{ message.recipients.length }})
            </button>
            
            <!-- Recipients dropdown -->
            <div v-if="showRecipientsDropdown" class="recipients-dropdown author-dropdown">
              <div class="dropdown-header">
                Recipients
                <button @click.stop="toggleRecipientsDropdown" class="close-dropdown">×</button>
              </div>
              <ul class="recipients-list">
                <li v-for="(recipient, index) in message.recipients" 
                    :key="index" 
                    class="recipient-item"
                >
                  {{ recipient }}
                  <span v-if="recipient === currentUser.email" class="user-tag">(you)</span>
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
              :title="isPinned ? 'Unpin this message' : 'Pin this message'"
            >
              <span class="pin-icon">📌</span>
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
        
        <div class="sibling-navigation" v-if="showSiblingNav">
          <button 
            @click.stop="$emit('navigate', 'prev')" 
            class="nav-button"
            :disabled="!hasPrevSibling"
          >
            &larr;
          </button>
          
          <div class="sibling-position">
            <span v-if="isLoadingSiblings" class="sibling-loading-indicator"></span>
            <span v-else>{{ siblingPosition }} / {{ parentTotalReplies }}</span>
          </div>
          
          <button 
            @click.stop="$emit('navigate', 'next')" 
            class="nav-button"
            :disabled="!hasNextSibling"
          >
            &rarr;
          </button>
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
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { useStore } from 'vuex';

export default {
  name: 'MessageNode',
  
  components: {
    AdaptiveMarker
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
    parentTotalReplies: {
      type: Number,
      default: 0
    },
    canReply: {
      type: Boolean,
      default: true
    },
    hasPrevSibling: {
      type: Boolean,
      default: false
    },
    hasNextSibling: {
      type: Boolean,
      default: false
    },
    showSiblingNav: {
      type: Boolean,
      default: false
    },
    isFirstSibling: {
      type: Boolean,
      default: false
    },
    isLastSibling: {
      type: Boolean,
      default: false
    },
    siblingPosition: {
      type: Number,
      default: 0
    }
  },
  
  setup(props) {
    const store = useStore();
    const currentUser = computed(() => store.getters['auth/user']);
    const isAdmin = computed(() => store.getters['auth/isAdmin']);
    const showRecipientsDropdown = ref(false);
    
    // Title/Description Modal
    const showTitleDescModal = ref(false);
    const editableTitle = ref('');
    const editableDescription = ref('');
    const isSaving = ref(false);
    
    const openTitleDescriptionModal = () => {
      editableTitle.value = props.message.title || '';
      editableDescription.value = props.message.description || '';
      showTitleDescModal.value = true;
    };
    
    const closeTitleDescModal = () => {
      showTitleDescModal.value = false;
    };
    
    const saveTitleAndDescription = async () => {
      try {
        isSaving.value = true;
        await store.dispatch('messages/updateMessage', {
          id: props.message.id,
          title: editableTitle.value.trim() || null,
          description: editableDescription.value.trim() || null
        });
        
        closeTitleDescModal();
      } catch (error) {
        console.error('Error saving title/description:', error);
        // You could add error handling/display here
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
      if (!currentUser.value || !currentUser.value.email || !props.message.recipients) {
        return false;
      }
      const result = props.message.recipients.includes(currentUser.value.email);
      return result;
    });
    
    // Check if message is pinned
    const isPinned = computed(() => {
      return props.message.is_pinned === 1;
    });
    
    // Toggle pin status
    const togglePinStatus = async () => {
      try {
        if (isPinned.value) {
          await store.dispatch('messages/unpinMessage', props.message.id);
        } else {
          await store.dispatch('messages/pinMessage', props.message.id);
        }
      } catch (error) {
        console.error('Error toggling pin status:', error);
      }
    };
    
    // Get recipients excluding the current user
    const recipientsExcludingUser = computed(() => {
      if (!props.message.recipients || !currentUser.value) {
        return props.message.recipients || [];
      }
      
      return props.message.recipients.filter(
        recipient => recipient !== currentUser.value.email
      );
    });
    
    // Get author email for display
    const authorEmail = computed(() => {
      // Check for new author fields first
      if (props.message.author_email) {
        return props.message.author_email;
      }
      // Fall back to content_author (for compatibility with existing data)
      return props.message.content_author;
    });
    
    // Get author display name
    const authorDisplayName = computed(() => {
      // For all authors (including ChatGPT), use display name from database when available
      if (props.message.author_display_name) {
        return props.message.author_display_name;
      }
      
      // Special case for ChatGPT (fallback)
      if (props.message.content_author === 'chatgpt' || props.message.content_author === 'chatgpt-system' || props.message.author_email === 'chatgpt') {
        return 'ChatGPT';
      }
      
      // If the current user is the author, prefer the up-to-date display name from auth state
      if (currentUser.value && (
          props.message.content_author === currentUser.value.uid || 
          props.message.author_email === currentUser.value.email
        )) {
        // Use the current user's display name from the auth store (most up-to-date)
        if (currentUser.value.displayName) {
          return currentUser.value.displayName;
        }
      }
      
      // For email-only authors (legacy data)
      if (props.message.author_email_display) {
        return props.message.author_email_display;
      }
      
      // Use user tag if no display name is available
      if (props.message.author_user_tag) {
        return props.message.author_user_tag;
      }
      
      // Last resort: use content_author (may be a UUID now)
      return props.message.content_author;
    });
    
    // Get author user tag
    const authorUserTag = computed(() => {
      // Skip for ChatGPT
      if (props.message.content_author === 'chatgpt' || props.message.content_author === 'chatgpt-system' || props.message.author_email === 'chatgpt') {
        return null;
      }
      
      // If the current user is the author, use their tag from auth state
      if (currentUser.value && (
          props.message.content_author === currentUser.value.uid || 
          props.message.author_email === currentUser.value.email
        )) {
        if (currentUser.value.user_tag) {
          return currentUser.value.user_tag;
        }
      }
      
      // Otherwise use the tag from the message
      if (props.message.author_user_tag) {
        return props.message.author_user_tag;
      }
      
      return null;
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
      // Special case for ChatGPT
      if (props.message.content_author === 'chatgpt' || props.message.content_author === 'chatgpt-system' || props.message.author_email === 'chatgpt') {
        return recipient === 'chatgpt';
      }
      
      // Check if the recipient matches the author email
      return recipient === authorEmail.value;
    };
    
    const isEndOfBranch = computed(() => {
      return store.getters['messages/isEndOfBranch'](props.message.id);
    });
    
    const isLoadingSiblings = computed(() => {
      // Check if parent is loading its children (siblings of this message)
      return props.message.parent_id ? 
        store.getters['messages/isLoading'](props.message.parent_id, 'children') : false;
    });
    
    const hasRecipients = computed(() => {
      return props.message.recipients && props.message.recipients.length > 0;
    });
    
    const toggleRecipientsDropdown = (event) => {
      event.stopPropagation();
      showRecipientsDropdown.value = !showRecipientsDropdown.value;
    };
    
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      const dropdown = document.querySelector('.recipients-dropdown');
      const dropdownToggle = document.querySelector('.recipients-toggle');
      
      if (showRecipientsDropdown.value && 
          dropdown && 
          !dropdown.contains(event.target) &&
          dropdownToggle &&
          !dropdownToggle.contains(event.target)) {
        showRecipientsDropdown.value = false;
      }
    };
    
    onMounted(() => {
      document.addEventListener('click', handleClickOutside);
    });
    
    onBeforeUnmount(() => {
      document.removeEventListener('click', handleClickOutside);
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
      isLoadingSiblings,
      hasRecipients,
      showRecipientsDropdown,
      toggleRecipientsDropdown,
      recipientsExcludingUser,
      authorDisplayName,
      authorUserTag,
      isUserAuthorOfContent
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
  background-color: #8bc34a;
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
  background-color: #9c27b0; /* Purple for author badge */
  color: white;
  border: none;
}

.recipients-dropdown-container {
  position: relative;
}

.recipients-dropdown {
  position: absolute;
  top: 24px;
  left: 0;
  background-color: var(--card-background, white);
  border: 1px solid var(--border-color, #ddd);
  border-radius: 6px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 100;
  min-width: 200px;
  max-width: 300px;
}

.author-container {
  position: relative;
}

.author-dropdown {
  position: absolute;
}

.dropdown-header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #ddd);
  font-weight: bold;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.close-dropdown {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-color-light, #777);
}

.recipients-list {
  list-style: none;
  padding: 8px 0;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
}

.recipient-item {
  padding: 4px 12px;
  line-height: 1.4;
  word-break: break-all;
}

.recipient-item.current-user {
  background-color: var(--primary-color-light, #e6f2ff);
}

.user-tag, .author-tag {
  font-size: 0.85em;
  opacity: 0.8;
  margin-left: 4px;
}

.user-tag {
  color: var(--primary-color, #007bff);
}

.author-tag {
  color: #9c27b0; /* Purple to match author toggle */
}

.no-recipients {
  padding: 4px 12px;
  color: var(--text-color-light, #777);
  font-style: italic;
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

.sibling-navigation {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-button {
  background: none;
  border: 1px solid var(--border-color, #ddd);
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-color, #333);
}

.nav-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.sibling-position {
  min-width: 40px;
  text-align: center;
}

.sibling-loading-indicator {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--primary-color, #007bff);
  animation: spin 1s linear infinite;
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
