<template>
  <div class="reply-container">
    <div class="reply-form">
      <div class="reply-settings">
        <label class="visibility-toggle">
          <input 
            type="checkbox" 
            :checked="isPublic" 
            @click="toggleVisibility"
          >
          <span>Public reply</span>
        </label>
        
        <button class="recipients-toggle" @click="toggleRecipientSelector">
          Recipients ({{ recipients.length }})
        </button>
        
        <button class="chatgpt-shortcut" @click.prevent="addChatGPT">
          + ChatGPT
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
      ></textarea>
      
      <div class="reply-actions">
        <button 
          @click="sendReply" 
          class="send-button"
          :disabled="!canInteract || !content.trim()"
        >
          Send
        </button>
      </div>
    </div>

    <!-- Recipients modal with centered design -->
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
          
          <!-- Search results container - this will be where all results and messages appear -->
          <div class="search-results-container">
            <!-- Search results dropdown (shown when results exist) -->
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

            <!-- No results message (shown when search performed but no results) -->
            <div v-else-if="searchResults.length === 0 && hasSearched && !isSearching" class="no-search-results">
              No users found. Try a different search term.
            </div>
          </div>
          
          <div class="recipients-hint">
            Use user tags to add recipients.
          </div>
          
          <div class="recipients-list">
            <div 
              v-for="(recipient, index) in recipients" 
              :key="index" 
              class="recipient-tag"
              :class="{
                'author-tag': isAuthorRecipient(recipient),
                'system-tag': recipient === 'system',
                'chatgpt-tag': recipient.toLowerCase() === 'chatgpt'
              }"
            >
              {{ recipient }}
              <span v-if="isAuthorRecipient(recipient)" class="author-indicator">(author)</span>
              <button @click="() => removeRecipient(index)" class="remove-recipient-btn">×</button>
            </div>
            
            <div v-if="recipients.length === 0" class="no-recipients">
              No recipients {{ isPublic ? '(public reply)' : '' }}
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button @click="showRecipientSelector = false" class="done-button">Done</button>
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
  }
});

const emit = defineEmits(['send', 'cancel']);

// Setup store
const store = useStore();

// Refs
const replyTextarea = ref(null);
const content = ref('');

// UI state
const showRecipientSelector = ref(false);
const newRecipient = ref('');
const isTagValid = ref(null);
const searchResults = ref([]);
const isSearching = ref(false);
const hasSearched = ref(false);
const showSearchResults = ref(false);

// Computed properties from store
const user = computed(() => store.getters['auth/user']);
const isPublic = computed({
  get: () => store.getters['navigation/replyIsPublic'],
  set: (value) => store.dispatch('navigation/updateReplyVisibility', value)
});
const recipients = computed(() => store.getters['navigation/replyRecipients']);

// Check if the reply can be added
const canAddRecipient = computed(() => {
  return newRecipient.value.trim() !== '' && isTagValid.value;
});

// Generate placeholder text
const placeholderText = computed(() => {
  if (props.isTemporaryThread) {
    return "Type your message to create this thread...";
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
  // Force sync settings after toggle
  store.dispatch('navigation/syncReplySettingsWithSelectedMessage');
};

const toggleRecipientSelector = () => {
  showRecipientSelector.value = !showRecipientSelector.value;
  
  // Reset input field when opening the modal
  if (showRecipientSelector.value) {
    newRecipient.value = '';
  }
};

const ensureReplyingActive = () => {
  if (!store.getters['navigation/isReplying'] && store.getters['navigation/selectedMessageId']) {
    store.dispatch('navigation/toggleReply', true);
  }
};

const handleTextareaKeyDown = (event) => {
  if (event.key === 'Enter') {
    if (event.shiftKey) {
      return; // Allow newline
    }
    
    event.preventDefault();
    if (content.value.trim()) {
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
  
  // Only resize if we've added a line break
  if (content.value.includes('\n')) {
    // Reset height to auto to get new scrollHeight
    textarea.style.height = 'auto';
    
    // Calculate new height (with minimum)
    const newHeight = Math.max(40, textarea.scrollHeight);
    textarea.style.height = `${newHeight}px`;
  } else if (textarea.style.height === '' || textarea.style.height === 'auto') {
    // Set initial height if not set
    textarea.style.height = '40px';
  }
};

const sendReply = () => {
  if (!content.value.trim()) return;
  
  emit('send', {
    content: content.value,
    isPublic: isPublic.value,
    recipients: recipients.value
  });
  
  // Clear reply content
  content.value = '';
  
  // Reset textarea height
  nextTick(() => {
    if (replyTextarea.value) {
      replyTextarea.value.style.height = '40px';
    }
  });
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
    // Use the user tag for the recipient
    const userTag = user.user_tag;
    
    // Set as valid explicitly
    isTagValid.value = true;
    newRecipient.value = userTag;
    
    // Add the recipient right away
    store.dispatch('navigation/addRecipient', userTag);
    
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
    store.dispatch('navigation/addRecipient', tag);
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

const addChatGPT = () => {
  console.log('[CHATGPT] Add ChatGPT button clicked in ReplyBox component');
  
  // Use the action and get success indicator
  const added = store.dispatch('navigation/addChatGPT');
  console.log(`[CHATGPT] ChatGPT ${added ? 'added to' : 'already in'} recipients list`);
  
  // Show brief confirmation
  const chatgptBtn = document.querySelector('.chatgpt-shortcut');
  if (chatgptBtn) {
    const originalText = chatgptBtn.textContent;
    chatgptBtn.textContent = '✓ Added';
    chatgptBtn.classList.add('added');
    console.log('[CHATGPT] Updated button UI to show confirmation');
    setTimeout(() => {
      chatgptBtn.textContent = originalText;
      chatgptBtn.classList.remove('added');
      console.log('[CHATGPT] Reset button UI after timeout');
    }, 1000);
  }
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
          recipient.toLowerCase() === 'chatgpt') {
        return true;
      }
      
      // Check if recipient matches the target message's author's tag
      if (targetMessage.author_user_tag && recipient === targetMessage.author_user_tag) {
        return true;
      }
      
      // For backwards compatibility, check email as well
      if (targetMessage.author_email && recipient === targetMessage.author_email) {
        return true;
      }
    }
  }
  
  return false;
};

// Helper function to get the best display name for an author
const getAuthorDisplayName = (message) => {
  const currentUser = store.getters['auth/user'];
  
  // Special case for ChatGPT
  if (message.content_author === 'chatgpt' || 
      message.content_author === 'chatgpt-system' || 
      message.author_email === 'chatgpt') {
    return 'ChatGPT';
  }
  
  // If the author is the current user, use their display name from auth store
  if (currentUser && (
      message.content_author === currentUser.uid || 
      message.author_email === currentUser.email
    )) {
    if (currentUser.displayName) {
      return currentUser.displayName;
    }
  }
  
  // For other authors, use the hierarchy from the message
  if (message.author_display_name) {
    return message.author_display_name;
  }
  
  if (message.author_email_display) {
    return message.author_email_display;
  }
  
  // Use user tag if no display name is available
  if (message.author_user_tag) {
    return message.author_user_tag;
  }
  
  // For backward compatibility, if the content_author looks like an email
  if (typeof message.content_author === 'string' && message.content_author.includes('@')) {
    return message.content_author;
  }
  
  // Fallback to the raw author value (could be UUID)
  return message.content_author;
};

// Helper function to get author user tag
const getAuthorUserTag = (message) => {
  const currentUser = store.getters['auth/user'];
  
  // Skip for ChatGPT
  if (message.content_author === 'chatgpt' || 
      message.content_author === 'chatgpt-system' || 
      message.author_email === 'chatgpt') {
    return null;
  }
  
  // If the author is the current user, use their tag from auth state
  if (currentUser && (
      message.content_author === currentUser.uid || 
      message.author_email === currentUser.email
    )) {
    if (currentUser.user_tag) {
      return currentUser.user_tag;
    }
  }
  
  // Otherwise use the tag from the message
  if (message.author_user_tag) {
    return message.author_user_tag;
  }
  
  return null;
};

// Close search results when clicking outside
onMounted(() => {
  document.addEventListener('click', handleClickOutsideSearch);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutsideSearch);
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
.reply-container {
  position: fixed;
  bottom: 20px; /* Reduced bottom spacing */
  left: 40px;
  right: 40px;
  padding: 8px 16px;
  border: 1px solid var(--border-color, #ddd);
  border-radius: var(--border-radius-md, 8px);
  background-color: var(--surface-color, #f8f8f8);
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.reply-form {
  margin-bottom: 4px; /* Reduce margin */
}

.reply-settings {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  align-items: center;
  position: relative;
}

.textarea-container {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: 8px;
}

.visibility-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.recipients-toggle {
  padding: 6px 12px;
  background-color: var(--primary-color-light, #e6f2ff);
  border: 1px solid var(--primary-color, #007bff);
  color: var(--primary-color, #007bff);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: background-color 0.2s;
}

.recipients-toggle:hover {
  background-color: var(--primary-color-hover, #d1e6ff);
}

.chatgpt-shortcut {
  padding: 4px 8px;
  background-color: #10a37f; /* ChatGPT green color */
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75em;
  transition: all 0.2s;
}

.chatgpt-shortcut:hover {
  background-color: #0d8c6d;
}

.chatgpt-shortcut.added {
  background-color: #4caf50; /* Success green */
}

/* Reply input styles */
.reply-input {
  flex: 1;
  min-height: 40px; /* Single line height */
  height: 40px; /* Start with single line */
  max-height: 150px; /* Maximum height before scrolling */
  padding: 10px 14px;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 18px; /* More rounded corners */
  resize: none; /* Disable manual resizing since we're doing it programmatically */
  margin-bottom: 0;
  font-family: inherit;
  font-size: 16px; /* Better for mobile */
  background-color: var(--card-background, #f5f5f5);
  color: var(--text-color, #333);
  transition: all 0.2s ease;
  overflow-y: auto; /* Show scrollbar if content exceeds max-height */
}

.reply-input:focus {
  outline: none;
  border-color: var(--primary-color, #4a90e2);
  box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb, 74, 144, 226), 0.2);
}

.reply-actions {
  display: flex;
  align-items: center;
  margin-left: 8px;
}

.send-button {
  padding: 8px 16px;
  background-color: var(--primary-color, #4a90e2);
  color: rgb(65, 65, 65);
  border: none;
  border-radius: 18px;
  cursor: pointer;
  font-weight: bold;
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
}

.recipient-modal {
  background-color: var(--surface-color, #f8f8f8);
  padding: 24px;
  border-radius: var(--border-radius-md, 8px);
  max-width: 400px;
  width: 90%;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border-color, #ddd);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.modal-content {
  flex: 1;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
}

.done-button {
  padding: 8px 16px;
  background-color: var(--primary-color, #4a90e2);
  color: black;
  border: none;
  border-radius: var(--border-radius-sm, 4px);
  cursor: pointer;
  font-weight: 500;
}

.close-button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.5rem;
  color: var(--text-color, #333);
}

.modal-description {
  margin-bottom: 16px;
  color: var(--text-color, #333);
}

.recipients-hint {
  margin-top: 10px;
  color: var(--text-color-light, #777);
  font-size: 0.9rem;
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
  font-size: 0.8rem;
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
  border-top-color: var(--primary-color, #007bff);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.valid-indicator, .invalid-indicator {
  position: absolute;
  top: 100%;
  right: 40px;
  color: var(--text-color, #333);
  font-size: 0.8rem;
}

.valid-indicator {
  color: var(--success-color, #4caf50);
}

.invalid-indicator {
  color: var(--error-color, #dc3545);
}

.recipient-selector {
  position: absolute;
  right: unset; /* Remove right positioning */
  bottom: 40px; /* Position above the button */
  left: 50%; /* Center it on its parent */
  transform: translateX(-50%); /* Center it on its parent */
  background-color: var(--card-background, #f5f5f5);
  border: 1px solid var(--border-color, #ddd);
  border-radius: var(--border-radius-md, 8px);
  padding: 16px;
  min-width: 280px;
  z-index: 20;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.recipient-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.recipient-input {
  flex: 1;
  padding: 6px;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 4px;
}

.add-recipient-btn {
  padding: 6px 10px;
  background-color: var(--primary-color, #4a90e2);
  color: black;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.recipients-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.recipient-tag {
  background-color: var(--primary-color-light, #e6f2ff);
  padding: 6px 10px;
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  color: var(--text-color);
}

.author-tag {
  background-color: var(--primary-color-light, #e6f2ff);
  color: var(--text-color);
}

.system-tag {
  background-color: var(--primary-color);
  color: white;
}

.chatgpt-tag {
  background-color: var(--primary-color-light);
  color: white;
}

.author-indicator {
  font-size: 0.75rem;
  font-style: italic;
  margin-left: 4px;
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
  color: var(--text-color-light, #777);
  font-style: italic;
  font-size: 0.85rem;
  padding: 4px 0;
}

.recipient-input-container {
  position: relative;
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.input-wrapper {
  position: relative;
  flex: 1;
}

.input-wrapper.valid .recipient-input {
  border-color: var(--success-color, #4caf50);
}

.input-wrapper.invalid .recipient-input {
  border-color: var(--error-color, #dc3545);
}

.recipient-input {
  width: 100%;
  padding: 8px 12px;
  padding-right: 30px; /* Space for indicators */
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  background-color: var(--input-background);
  color: var(--text-color);
  transition: border-color 0.2s;
}

.search-indicator,
.valid-indicator,
.invalid-indicator {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.8rem;
}

.search-indicator .spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--primary-color, #007bff);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.search-results-container {
  margin-top: 10px;
  width: 100%;
}

.search-results-list {
  width: 100%;
  background-color: var(--surface-color, #f8f8f8);
  border: 1px solid var(--border-color, #ddd);
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 10px;
}

.search-result-item {
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid var(--border-color-light, #eee);
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background-color: var(--primary-color-light, #e6f2ff);
}

.search-result-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.search-result-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-color, #333);
}

.search-result-tag {
  font-size: 0.8rem;
  color: var(--text-color-light, #777);
}

.no-search-results {
  padding: 12px;
  color: var(--text-color-light, #777);
  font-size: 0.85rem;
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

/* Dark theme overrides */
@media (prefers-color-scheme: dark) {
  .reply-container {
    background-color: #000000;
    border-color: var(--border-color-dark, #444);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  .reply-input {
    background-color: var(--card-background-dark, #333);
    color: var(--text-color-dark, #eee);
    border-color: var(--border-color-dark, #444);
    margin-bottom: 10px;
  }
  
  .send-button:disabled {
    background-color: var(--primary-color-dark, #2b5a94);
    opacity: 0.5;
  }
  
  .send-button {
    background-color: var(--primary-color, #4a90e2);
    color: rgb(58, 58, 58);
  }
}
</style> 