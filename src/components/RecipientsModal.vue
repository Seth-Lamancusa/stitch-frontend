<template>
  <div v-if="isVisible" class="modal-overlay" @click.self="closeModal">
    <div class="recipient-modal">
      <div class="modal-header">
        <h3>{{ isActuallyAddingToExisting ? 'Add Recipients' : 'Recipients' }}</h3>
        <button class="close-button" @click.stop="closeModal">×</button>
      </div>
      
      <div class="modal-content">


          <!-- Existing Recipients Section -->
          <div v-if="isAddMode && existingRecipients && existingRecipients.length > 0" class="existing-recipients-section">
            <p class="section-header">Current recipients</p>
            <div class="recipients-list">
              <div  
              v-for="(recipient, index) in existingRecipients" 
              :key="recipient.uid" 
              class="recipient-tag existing-recipient"
              :class="{
                'original': !recipient.timestamp,
                'added-later': recipient.timestamp
              }"
              :title="getRecipientTitle({ ...recipient, isExisting: true })"
            >
              <div class="recipient-info">
                <div class="recipient-name-line">
                  <span class="recipient-name">{{ recipient.display_name || recipient.user_tag }}</span>
                  <span v-if="recipient.user_tag" class="recipient-tag-name">@{{ recipient.user_tag }}</span>
                </div>
                <span class="recipient-timestamp">{{ recipient.timestamp ? new Date(recipient.timestamp).toLocaleString() : 'creation' }}</span>
              </div>
              <div class="recipient-controls">
                <span class="visibility-indicator" :title="recipient.visible !== false ? 'Visible (CC)' : 'Hidden (BCC)'">
                  {{ recipient.visible !== false ? '👁️' : '🙈' }}
                </span>
                <button 
                  v-if="canRemoveExistingRecipient(recipient)"
                  @click.stop="() => removeExistingRecipient(index, recipient)" 
                  class="remove-recipient-btn"
                  :class="{ 'removing': removingRecipientIds.has(recipient.uid) }"
                  :disabled="removingRecipientIds.has(recipient.uid)"
                >
                  <div v-if="removingRecipientIds.has(recipient.uid)" class="spinner-small"></div>
                  <span v-else>×</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Search and Add Section -->
        <div class="search-and-add-section">
          <p class="modal-description" v-if="!isAddMode && !isPublic">Private replies require at least one recipient</p>
          <p class="modal-description" v-else-if="!isAddMode">Recipients for public replies (optional)</p>
          <p class="section-header" v-else-if="isActuallyAddingToExisting">Add new recipients</p>
          <p class="section-header" v-else>Recipients</p>
          
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
              @click.stop="addRecipient" 
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
                @click.stop="selectSearchResult(user)"
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

          <!-- New Recipients Section -->
          <div v-if="isAddMode" class="new-recipients-section">
            <div class="recipients-list">
              <div 
                v-for="(recipient, index) in recipients" 
                :key="recipient.uid || index" 
                class="recipient-tag new-recipient"
                :title="getRecipientTitle({ ...recipient, isNew: true })"
              >
                <div class="recipient-info">
                  <div class="recipient-name-line">
                    <span class="recipient-name">{{ recipient.display_name || recipient.user_tag }}</span>
                    <span v-if="recipient.user_tag" class="recipient-tag-name">@{{ recipient.user_tag }}</span>
                  </div>
                  <span class="recipient-timestamp">{{ recipient.timestamp ? new Date(recipient.timestamp).toLocaleString() : 'creation' }}</span>
                </div>
                <div class="recipient-controls">
                  <button 
                    @click.stop="() => toggleRecipientVisibility(index)"
                    class="visibility-toggle-btn"
                    :class="{ 'visible': recipient.visible !== false, 'invisible': recipient.visible === false }"
                    :title="recipient.visible !== false ? 'Visible (CC)' : 'Hidden (BCC)'"
                  >
                    <span class="visibility-emoji visible-emoji">👁️</span>
                    <span class="visibility-emoji hidden-emoji">🙈</span>
                    <div class="visibility-slider" :class="{ 'is-visible': recipient.visible !== false }"></div>
                  </button>
                  <button 
                    @click.stop="() => removeRecipient(index, recipient)" 
                    class="remove-recipient-btn"
                  >×</button>
                </div>
              </div>
              
              <div v-if="!recipients || recipients.length === 0" class="no-recipients">
                No new recipients added yet
              </div>
            </div>
          </div>
        </div>
        
        <!-- Non-Add Mode Recipients List -->
        <div v-if="!isAddMode" class="recipients-list">
          <div 
            v-for="(recipient, index) in recipients" 
            :key="recipient.uid || index" 
            class="recipient-tag"
            :class="{
              'original': !recipient.timestamp,
              'added-later': recipient.timestamp
            }"
            :title="getRecipientTitle(recipient)"
          >
            <div class="recipient-info">
              <div class="recipient-name-line">
                <span class="recipient-name">{{ recipient.display_name || recipient.user_tag }}</span>
                <span v-if="recipient.user_tag" class="recipient-tag-name">@{{ recipient.user_tag }}</span>
              </div>
              <span class="recipient-timestamp">{{ recipient.timestamp ? new Date(recipient.timestamp).toLocaleString() : 'creation' }}</span>
            </div>
            <div class="recipient-controls">
              <button 
                @click.stop="() => toggleRecipientVisibility(index)"
                class="visibility-toggle-btn"
                :class="{ 'visible': recipient.visible !== false, 'invisible': recipient.visible === false }"
                :title="recipient.visible !== false ? 'Visible (CC)' : 'Hidden (BCC)'"
              >
                <span class="visibility-emoji visible-emoji">👁️</span>
                <span class="visibility-emoji hidden-emoji">🙈</span>
                <div class="visibility-slider" :class="{ 'is-visible': recipient.visible !== false }"></div>
              </button>
              <button 
                v-if="canRemoveRecipient(recipient)"
                @click.stop="() => removeRecipient(index, recipient)" 
                class="remove-recipient-btn"
              >×</button>
            </div>
          </div>
          
          <div v-if="!recipients || recipients.length === 0" class="no-recipients">
            No recipients {{ isPublic ? '(public reply)' : '' }}
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button @click.stop="handleDone" class="done-button">
          {{ isActuallyAddingToExisting ? 'Add Recipients' : 'Done' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useStore } from 'vuex';
import MessageService from '../services/MessageService.js';

const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  isAddMode: {
    type: Boolean,
    default: false
  },
  existingRecipients: {
    type: Array,
    default: () => []
  },
  messageId: {
    type: [String, Number],
    default: null
  },
  isRecipientRemovalDisabled: {
    type: Boolean,
    default: false // In add mode, we typically don't allow removing existing recipients
  }
});

const emit = defineEmits(['close', 'done', 'add-recipients', 'recipient-removed']);

// Setup store
const store = useStore();

// Refs
const recipientInput = ref(null);
const newRecipient = ref('');
const searchResults = ref([]);
const isSearching = ref(false);
const hasSearched = ref(false);
const showSearchResults = ref(false);
const isTagValid = ref(null);
const removingRecipientIds = ref(new Set()); // Track which recipients are being removed
let searchTimeout = null;

// Computed
const recipients = computed(() => {
  if (props.isAddMode) {
    // In add mode, show only the new recipients being added (from navigation store)
    return store.getters['navigation/replyRecipients'];
  } else {
    // In non-add mode, show the current message recipients
    return store.getters['navigation/replyRecipients'];
  }
});

// New computed property for unified display in add mode
const allRecipientsUnified = computed(() => {
  if (!props.isAddMode) return recipients.value;
  
  // In add mode, combine existing recipients with new ones
  const existing = props.existingRecipients || [];
  const newOnes = store.getters['navigation/replyRecipients'] || [];
  
  // Create a map to avoid duplicates (by uid)
  const recipientMap = new Map();
  
  // Add existing recipients first
  existing.forEach(recipient => {
    if (recipient.uid) {
      recipientMap.set(recipient.uid, { ...recipient, isExisting: true });
    }
  });
  
  // Add new recipients, marking them as new
  newOnes.forEach(recipient => {
    if (recipient.uid) {
      recipientMap.set(recipient.uid, { ...recipient, isExisting: false, isNew: true });
    }
  });
  
  return Array.from(recipientMap.values());
});

const canAddRecipient = computed(() => {
  return newRecipient.value.trim() !== '' && isTagValid.value;
});

const currentUser = computed(() => store.getters['auth/user']);

const currentMessage = computed(() => {
  if (!props.messageId) return null;
  return store.getters['messages/getMessage'](props.messageId);
});

// Determine if we're actually adding to an existing message or just managing staged recipients
const isActuallyAddingToExisting = computed(() => {
  return props.isAddMode && props.existingRecipients && props.existingRecipients.length > 0;
});

const canRemoveRecipient = computed(() => {
  return (recipient) => {
    if (!currentUser.value) return false;
    
    // In add mode, check if it's a new recipient or existing one
    if (props.isAddMode) {
      // If it's a new recipient being added, allow removal
      if (recipient.isNew) {
        return !props.isRecipientRemovalDisabled;
      }
      // If it's an existing recipient, use existing logic
      return canRemoveExistingRecipient.value(recipient);
    }
    
    // For non-add mode, use the existing recipient removal logic
    return canRemoveExistingRecipient.value(recipient);
  };
});

const canRemoveExistingRecipient = computed(() => {
  return (recipient) => {
    if (!currentUser.value) return false;
    
    const currentUserUid = currentUser.value.uid;
    
    // For existing recipients, check permissions based on added_by field
    if (recipient.added_by !== undefined && recipient.added_by !== null) {
      // Recipient was added later - only the user who added them can remove
      return recipient.added_by === currentUserUid;
    } else {
      // Original recipient (added_by is null) - only message author can remove
      return currentMessage.value && currentMessage.value.content_author === currentUserUid;
    }
  };
});

// Methods
const getRecipientTitle = (recipient) => {
  if (recipient.isNew) {
    return 'New recipient being added';
  } else if (!recipient.timestamp) {
    return 'Original recipient (added when message was created)';
  } else {
    return 'Added after message creation';
  }
};

const closeModal = () => {
  console.log('[RecipientsModal] closeModal called');
  clearSearch();
  emit('close');
};

const handleDone = async () => {
  console.log('[RecipientsModal] handleDone called, isAddMode:', props.isAddMode);
  console.log('[RecipientsModal] isActuallyAddingToExisting:', isActuallyAddingToExisting.value);
  console.log('[RecipientsModal] Current recipients:', recipients.value);
  
  if (isActuallyAddingToExisting.value) {
    console.log('[RecipientsModal] Actually adding to existing message, emitting add-recipients event');
    // Emit add-recipients event with current recipients
    emit('add-recipients', recipients.value);
    
    console.log('[RecipientsModal] Clearing navigation store recipients');
    // Clear the new recipients list after adding them
    await store.dispatch('navigation/clearRecipients');
    
    console.log('[RecipientsModal] Add mode complete - modal should stay open');
    // Don't close the modal - let it stay open for more additions
  } else {
    console.log('[RecipientsModal] Just managing staged recipients, closing modal');
    emit('done');
    closeModal();
  }
};

// Debounce function for search
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
    
    // Add the recipient right away with default visibility
    store.dispatch('navigation/addRecipient', {
      uid: user.uid,
      display_name: user.display_name,
      user_tag: user.user_tag,
      visible: true  // Default to visible (CC)
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

const removeRecipient = async (index, recipient) => {
  try {
    if (props.isAddMode && recipient.isNew) {
      // Remove new recipient from navigation store
      const newRecipients = store.getters['navigation/replyRecipients'];
      const newIndex = newRecipients.findIndex(r => r.uid === recipient.uid);
      if (newIndex !== -1) {
        store.dispatch('navigation/removeRecipient', newIndex);
      }
    } else if (props.isAddMode && recipient.isExisting) {
      // Remove existing recipient via API
      await removeExistingRecipient(index, recipient);
    } else {
      // For non-add mode, use the existing recipient removal logic
      await removeExistingRecipient(index, recipient);
    }
  } catch (error) {
    console.error('Error removing recipient:', error);
    
    // Show user-friendly error message
    const errorMessage = error.response?.data?.detail || 'Failed to remove recipient';
    alert(errorMessage);
  }
};

const removeExistingRecipient = async (index, recipient) => {
  if (!props.messageId || !recipient.uid) {
    console.error('Cannot remove existing recipient: missing messageId or recipient uid');
    return;
  }
  
  // Add to loading set
  removingRecipientIds.value.add(recipient.uid);
  
  try {
    // Call API to remove recipient from the actual message
    await MessageService.removeRecipientFromMessage(props.messageId, recipient.uid);
    
    // Refresh the message data to get updated recipients list
    await store.dispatch('messages/loadMessageRadius', { 
      messageId: props.messageId, 
      radius: 1 
    });
    
    // Also remove from the navigation store if it exists there
    // This ensures the display updates immediately
    const currentRecipients = store.getters['navigation/replyRecipients'];
    const recipientIndex = currentRecipients.findIndex(r => r.uid === recipient.uid);
    if (recipientIndex !== -1) {
      store.dispatch('navigation/removeRecipient', recipientIndex);
    }
    
    // Emit update event to parent to refresh existing recipients display
    emit('recipient-removed', recipient.uid);
    
  } catch (error) {
    console.error('Error removing existing recipient:', error);
    
    // Show user-friendly error message
    const errorMessage = error.response?.data?.detail || 'Failed to remove recipient';
    alert(errorMessage);
  } finally {
    // Remove from loading set
    removingRecipientIds.value.delete(recipient.uid);
  }
};

const toggleRecipientVisibility = (index) => {
  // Since we're now iterating directly over the navigation store recipients,
  // we can pass the index directly
  store.dispatch('navigation/toggleRecipientVisibility', index);
};

// Handle clicks outside search results
const handleClickOutside = (event) => {
  const searchResults = document.querySelector('.search-results-list');
  if (showSearchResults.value &&
      searchResults &&
      !searchResults.contains(event.target) &&
      !recipientInput.value?.contains(event.target)) {
    showSearchResults.value = false;
  }
};

// Auto-focus input when modal opens
watch(() => props.isVisible, (newVal) => {
  if (newVal) {
    nextTick(() => {
      if (recipientInput.value) {
        recipientInput.value.focus();
      }
    });
  }
});

// Lifecycle hooks
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
  clearTimeout(searchTimeout);
});

// Add logging to watch existing recipients
watch(() => props.existingRecipients, (newVal, oldVal) => {
  console.log('[RecipientsModal] existingRecipients changed:', {
    old: oldVal?.length,
    new: newVal?.length,
    recipients: newVal
  });
}, { deep: true });
</script>

<style scoped>
/* Modal overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1001;
  padding: 20px;
}

/* Recipient modal */
.recipient-modal {
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 0;
  min-width: 400px;
  max-width: 600px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

/* Modal header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
}

.close-button {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 24px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  transition: color 0.2s ease;
}

.close-button:hover {
  color: var(--color-error);
}

/* Modal content */
.modal-content {
  padding: 20px 24px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.modal-description {
  margin: 0 0 16px 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.section-header {
  margin: 0 0 8px 0;
  color: var(--color-text-tertiary, #666);
  font-size: var(--font-size-sm);
  font-weight: 400;
  line-height: 1.4;
  text-align: left;
  opacity: 0.8;
}

/* Existing recipients section */
.existing-recipients {
  margin-bottom: 10px;
}

/* Recipient input container */
.recipient-input-container {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.input-wrapper {
  flex: 1;
  position: relative;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-input-bg, var(--color-surface));
  transition: all 0.2s ease;
}

.input-wrapper:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb, 79, 140, 255), 0.2);
}

.input-wrapper.valid {
  border-color: var(--color-success);
}

.input-wrapper.invalid {
  border-color: var(--color-error);
}

.input-wrapper.searching {
  border-color: var(--color-primary);
}

.recipient-input {
  width: 100%;
  padding: 12px 40px 12px 12px;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  outline: none;
}

.recipient-input::placeholder {
  color: var(--color-text-secondary);
}

/* Input indicators */
.search-indicator,
.valid-indicator,
.invalid-indicator {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.valid-indicator {
  color: var(--color-success);
  font-weight: bold;
}

.invalid-indicator {
  color: var(--color-error);
  font-weight: bold;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top: 2px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.spinner-small {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(220, 38, 38, 0.2);
  border-top: 2px solid var(--color-error);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Add recipient button */
.add-recipient-btn {
  padding: 12px 16px;
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.add-recipient-btn:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.add-recipient-btn:disabled {
  background-color: var(--color-border);
  color: var(--color-text-secondary);
  cursor: not-allowed;
  transform: none;
}

/* Search results */
.search-results-container {
  position: relative;
  margin-bottom: 16px;
}

.search-results-list {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  max-height: 200px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.search-result-item {
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
  transition: background-color 0.2s ease;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background-color: var(--color-hover-overlay);
}

.search-result-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.search-result-name {
  font-weight: 500;
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.search-result-tag {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.no-search-results {
  padding: 16px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-style: italic;
}

/* Recipients list */
.recipients-list {
  min-height: 60px;
}

.recipients-list.read-only .recipient-tag {
  background-color: var(--color-surface-light, var(--color-surface));
  border: 1px solid var(--color-border);
}

.recipient-tag {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  margin-bottom: 8px;
  transition: all 0.2s ease;
  background-color: var(--color-primary-light, rgba(var(--color-primary-rgb, 79, 140, 255), 0.05));
  border: 1px solid var(--color-primary-light, rgba(var(--color-primary-rgb, 79, 140, 255), 0.2));
}

.recipient-tag.original {
  background-color: var(--color-surface-light, var(--color-surface));
  border: 2px solid var(--color-primary-light, rgba(var(--color-primary-rgb, 79, 140, 255), 0.3));
}

.recipient-tag.original {
  background-color: var(--color-surface-light, var(--color-surface));
  border: 2px solid var(--color-primary-light, rgba(var(--color-primary-rgb, 79, 140, 255), 0.3));
}

.recipient-tag.existing {
  opacity: 0.8;
}

.recipient-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.recipient-name-line {
  display: flex;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recipient-name {
  font-weight: 500;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.recipient-tag-name {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  white-space: nowrap;
  flex-shrink: 0;
}

.recipient-timestamp {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recipient-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.visibility-toggle-btn {
  position: relative;
  background: var(--color-primary-light);
  border: 1px solid var(--color-border);
  cursor: pointer;
  padding: 0;
  border-radius: 12px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  width: 56px;
  height: 24px;
  overflow: hidden;
}

.visibility-toggle-btn:hover {
  border-color: var(--color-border-hover);
  background-color: var(--color-hover-overlay);
}

.visibility-emoji {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 14px;
  transition: opacity 0.2s ease;
}

.visible-emoji {
  left: 2px;
  opacity: 0.4;
}

.hidden-emoji {
  right: 2px;
  opacity: 0.1;
}

.visibility-slider {
  position: absolute;
  width: 20px;
  height: 20px;
  background-color: var(--color-primary-rgb);
  border-radius: 10px;
  transition: transform 0.2s ease;
  left: 2px;
  transform: translateX(0);
}

.visibility-slider.is-visible {
  transform: translateX(32px);
}

.visibility-toggle-btn.visible .visible-emoji {
  opacity: 1;
}

.visibility-toggle-btn.invisible .hidden-emoji {
  opacity: 1;
}

.visibility-indicator {
  font-size: 16px;
  opacity: 0.7;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  cursor: default;
}

.remove-recipient-btn {
  background: none;
  border: none;
  color: var(--color-error);
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-weight: bold;
  line-height: 1;
}

.remove-recipient-btn:hover:not(:disabled) {
  background-color: var(--color-error-light, rgba(220, 38, 38, 0.1));
}

.remove-recipient-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.remove-recipient-btn.removing {
  background-color: var(--color-error-light, rgba(220, 38, 38, 0.1));
}

.no-recipients {
  text-align: center;
  color: var(--color-text-secondary);
  font-style: italic;
  padding: 20px;
  font-size: var(--font-size-sm);
}

/* Section styling */
.existing-recipients-section,
.new-recipients-section {
  margin-bottom: 0;
}

.existing-recipients-section {
  background-color: var(--color-background-light);
  border-radius: var(--radius-md);
  padding: 8px;
}

.search-and-add-section {
  padding: 8px;
}

.new-recipients-section {
  margin-top: 20px;
}

  /* New recipient styling */
  .recipient-tag.new-recipient {
    background-color: var(--color-primary-light, rgba(var(--color-primary-rgb, 79, 140, 255), 0.05));
    border: 1px solid var(--color-primary-light, rgba(var(--color-primary-rgb, 79, 140, 255), 0.2));
  }

  .recipient-tag.existing-recipient,
.recipient-tag.new-recipient {
  opacity: 0.7;
}

/* Modal footer */
.modal-footer {
  padding: 16px 24px 20px;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.done-button {
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

.done-button:hover {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .modal-overlay {
    padding: 10px;
  }
  
  .recipient-modal {
    min-width: unset;
    max-height: 90vh;
  }
  
  .modal-header {
    padding: 16px 20px 12px;
  }
  
  .modal-header h3 {
    font-size: var(--font-size-md);
  }
  
  .modal-content {
    padding: 16px 20px;
  }
  
  .modal-footer {
    padding: 12px 20px 16px;
  }
  
  .recipient-input-container {
    flex-direction: column;
    gap: 12px;
  }
  
  .add-recipient-btn {
    width: 100%;
  }
}
</style>