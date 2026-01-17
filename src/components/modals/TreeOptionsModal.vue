<template>
  <div v-if="isVisible" class="modal-overlay" @click.self="closeModal">
    <div class="tree-options-modal">
      <div class="modal-header">
        <h3>Tree Options</h3>
        <button class="close-button" @click.stop="closeModal">×</button>
      </div>
      
      <div class="modal-content">
        <!-- Add recipients to tree option -->
        <div class="option-section">
          <button 
            @click="toggleAddRecipientsDropdown"
            class="dropdown-toggle"
            :class="{ 'open': showAddRecipientsDropdown }"
          >
            <span>Add recipients to tree</span>
            <span class="dropdown-arrow">{{ showAddRecipientsDropdown ? '▲' : '▼' }}</span>
          </button>
          
          <div v-if="showAddRecipientsDropdown" class="dropdown-content">
            <div class="search-section">
              <div class="input-wrapper" :class="{ 'searching': isSearching }">
                <input 
                  v-model="searchQuery" 
                  @input="searchUsers"
                  placeholder="Search by username or tag" 
                  class="search-input"
                  ref="searchInput"
                />
                <div v-if="isSearching" class="search-indicator" title="Searching...">
                  <div class="spinner"></div>
                </div>
              </div>
              
              <!-- Search results -->
              <div v-if="showSearchResults && searchResults.length > 0" class="search-results-list">
                <div 
                  v-for="user in searchResults" 
                  :key="user.uid" 
                  class="search-result-item"
                  @click="selectUser(user)"
                >
                  <span class="search-result-name">{{ user.display_name || 'User' }}</span>
                  <span class="search-result-tag">@{{ user.user_tag }}</span>
                </div>
              </div>
              
              <div v-else-if="hasSearched && !isSearching && searchQuery.length > 1 && searchResults.length === 0" class="no-search-results">
                No users found. Try a different search term.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Confirmation overlay (teleported to body) -->
  <teleport to="body">
    <div v-if="showConfirmation && isVisible" class="modal-overlay confirmation-overlay" @click.self="cancelConfirmation">
      <div class="confirmation-modal">
        <div class="confirmation-header">
          <h4>Confirm Add Recipient</h4>
        </div>
        
        <div class="confirmation-content">
          <p>Add <strong>{{ selectedUser?.display_name || selectedUser?.user_tag }}</strong> (@{{ selectedUser?.user_tag }}) to all messages in this tree?</p>
          
          <div class="confirmation-actions">
            <button 
              @click="confirmAddRecipient"
              class="confirm-btn"
              :disabled="isAdding"
              :class="{ 'loading': isAdding }"
            >
              <div v-if="isAdding" class="button-loading">
                <div class="spinner-small"></div>
                <span>Adding...</span>
              </div>
              <span v-else>Confirm</span>
            </button>
            
            <button 
              @click="cancelConfirmation"
              class="cancel-btn"
              :disabled="isAdding"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import { useStore } from 'vuex';
import MessageService from '../../services/MessageService.js';

const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  centeredMessageId: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close', 'recipients-added']);

const store = useStore();
const showAddRecipientsDropdown = ref(false);
const searchResults = ref([]);
const selectedUser = ref(null);
const showConfirmation = ref(false);
const isAdding = ref(false);
const searchQuery = ref('');
const isSearching = ref(false);
const hasSearched = ref(false);
const showSearchResults = ref(false);
const searchInput = ref(null);
let searchTimeout = null;

// Watch for modal visibility
watch(() => props.isVisible, (newVal) => {
  if (newVal) {
    // Reset state when modal opens
    showAddRecipientsDropdown.value = false;
    searchResults.value = [];
    selectedUser.value = null;
    showConfirmation.value = false;
    searchQuery.value = '';
    isSearching.value = false;
    hasSearched.value = false;
    showSearchResults.value = false;
  }
});

// Search users function
const searchUsers = (event) => {
  if (!props.isVisible) {
    return;
  }
  
  clearTimeout(searchTimeout);
  const query = event.target.value.trim();
  searchQuery.value = query;
  
  // Clear previous search state
  isSearching.value = query.length >= 1;
  
  if (query.length < 1) {
    searchResults.value = [];
    showSearchResults.value = false;
    hasSearched.value = false;
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
        showSearchResults.value = results.length > 0;
      }
      
      isSearching.value = false;
    } catch (error) {
      console.error('Error searching users:', error);
      searchResults.value = [];
      isSearching.value = false;
      showSearchResults.value = false;
    }
  }, 300); // 300ms debounce
};

const toggleAddRecipientsDropdown = () => {
  showAddRecipientsDropdown.value = !showAddRecipientsDropdown.value;
};

const selectUser = (user) => {
  selectedUser.value = user;
  showConfirmation.value = true;
  searchResults.value = [];
};

const cancelConfirmation = () => {
  if (isAdding.value) return;
  showConfirmation.value = false;
  selectedUser.value = null;
};

const confirmAddRecipient = async () => {
  if (!selectedUser.value || !props.centeredMessageId) {
    return;
  }
  
  isAdding.value = true;
  
  try {
    // Format recipient
    const recipient = {
      uid: selectedUser.value.uid,
      display_name: selectedUser.value.display_name,
      user_tag: selectedUser.value.user_tag,
      public: true
    };
    
    // Add recipient to full tree using the centered message as reference
    // Backend will traverse up to root and down to all leaves
    await MessageService.addRecipientsToMessage(
      props.centeredMessageId,  // Single message ID (the centered one)
      [recipient],
      false, // Don't use ancestor propagation (add_to_full_tree overrides this)
      true   // add_to_full_tree = true
    );
    
    // Refresh messages - refresh the centered message's radius to get all related messages
    await store.dispatch('messages/loadMessageRadius', {
      messageId: props.centeredMessageId,
      radius: 10 // Load a larger radius to ensure all tree messages are refreshed
    });
    
    // Emit success event
    emit('recipients-added', {
      recipient: selectedUser.value,
      centeredMessageId: props.centeredMessageId
    });
    
    // Close confirmation and reset
    showConfirmation.value = false;
    selectedUser.value = null;
    showAddRecipientsDropdown.value = false;
    
    // Close modal after brief delay
    setTimeout(() => {
      closeModal();
    }, 500);
    
  } catch (error) {
    console.error('Error adding recipient to tree:', error);
    const errorMessage = error.response?.data?.detail || 'Failed to add recipient to tree';
    store.commit('ui/SET_ERROR', { 
      code: 'tree_recipient_add_failed', 
      message: errorMessage 
    });
  } finally {
    isAdding.value = false;
  }
};

const closeModal = () => {
  emit('close');
};
</script>

<style scoped>
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

.confirmation-overlay {
  z-index: 1002;
}

.tree-options-modal {
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 0;
  min-width: 400px;
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

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

.modal-content {
  padding: 20px 24px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.option-section {
  margin-bottom: 16px;
}

.dropdown-toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.dropdown-toggle:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-hover);
}

.dropdown-toggle.open {
  background-color: var(--color-primary-light);
  border-color: var(--color-primary);
}

.dropdown-arrow {
  font-size: 12px;
  transition: transform 0.2s ease;
}

.dropdown-content {
  margin-top: 12px;
  padding: 16px;
  background-color: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.search-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-wrapper {
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

.input-wrapper.searching {
  border-color: var(--color-primary);
}

.search-input {
  width: 100%;
  padding: 12px 40px 12px 12px;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  outline: none;
}

.search-input::placeholder {
  color: var(--color-text-secondary);
}

.search-indicator {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top: 2px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.no-search-results {
  padding: 16px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-style: italic;
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
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background-color: var(--color-hover-overlay);
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

.confirmation-modal {
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 0;
  min-width: 400px;
  max-width: 500px;
  width: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}

.confirmation-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.confirmation-header h4 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
}

.confirmation-content {
  padding: 20px 24px;
  flex: 1;
}

.confirmation-content p {
  margin: 0 0 20px 0;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.confirmation-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.confirm-btn {
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

.confirm-btn:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.confirm-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.confirm-btn.loading {
  opacity: 0.7;
}

.cancel-btn {
  padding: 10px 20px;
  background-color: var(--color-border);
  color: var(--color-text);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn:hover:not(:disabled) {
  background-color: var(--color-hover-overlay);
}

.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}

.spinner-small {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top: 2px solid var(--color-text-inverse);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .tree-options-modal,
  .confirmation-modal {
    min-width: unset;
    max-width: 90vw;
  }
  
  .modal-header,
  .confirmation-header {
    padding: 16px 20px 12px;
  }
  
  .modal-content,
  .confirmation-content {
    padding: 16px 20px;
  }
}
</style>

