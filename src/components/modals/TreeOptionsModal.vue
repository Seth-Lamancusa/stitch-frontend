<template>
  <div v-if="isVisible" class="modal-overlay" @click.self="closeModal">
    <div class="tree-options-modal">
      <div class="modal-header">
        <h3>
          Conversation
          <span
            class="conversation-info-icon"
            title="Conversation includes all ancestors and descendants of the current message."
            aria-label="Info: conversation includes all ancestors and descendants"
          >ⓘ</span>
        </h3>
        <button class="close-button" @click.stop="closeModal">×</button>
      </div>
      
      <div class="modal-content">
        <!-- Add recipients to conversation option -->
        <div class="option-section">
          <button 
            @click="toggleAddRecipientsDropdown"
            class="dropdown-toggle"
            :class="{ 'open': showAddRecipientsDropdown }"
          >
            <span>Add recipients to conversation</span>
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

        <!-- Add to channel option -->
        <div class="option-section">
          <button 
            @click="toggleAddChannelsDropdown"
            class="dropdown-toggle"
            :class="{ 'open': showAddChannelsDropdown }"
          >
            <span>Add conversation to channel</span>
            <span class="dropdown-arrow">{{ showAddChannelsDropdown ? '▲' : '▼' }}</span>
          </button>
          
          <div v-if="showAddChannelsDropdown" class="dropdown-content">
            <div class="search-section">
              <div class="input-wrapper" :class="{ 'searching': isSearchingChannels }">
                <input 
                  v-model="channelSearchQuery" 
                  @input="searchChannels"
                  placeholder="Search channels" 
                  class="search-input"
                  ref="channelSearchInput"
                />
                <div v-if="isSearchingChannels" class="search-indicator" title="Searching...">
                  <div class="spinner"></div>
                </div>
              </div>
              
              <!-- Search results -->
              <div v-if="showChannelSearchResults && channelSearchResults.length > 0" class="search-results-list">
                <div 
                  v-for="channel in channelSearchResults" 
                  :key="channel.id" 
                  class="search-result-item"
                  @click="selectChannel(channel)"
                >
                  <span class="search-result-name">{{ channel.display_name }}</span>
                  <span class="search-result-tag">{{ channel.description }}</span>
                </div>
              </div>
              
              <div v-else-if="hasSearchedChannels && !isSearchingChannels && channelSearchQuery.length > 1 && channelSearchResults.length === 0" class="no-search-results">
                No channels found.
              </div>
            </div>
          </div>
        </div>

        <!-- Publicity option -->
        <div class="option-section">
          <button 
            @click="togglePublicityOptions"
            class="dropdown-toggle"
            :class="{ 'open': showPublicityOptions }"
          >
            <span>Set conversation visibility</span>
            <span class="dropdown-arrow">{{ showPublicityOptions ? '▲' : '▼' }}</span>
          </button>
          
          <div v-if="showPublicityOptions" class="dropdown-content">
            <div class="publicity-actions">
              <button class="action-btn public-btn" @click="initiateSetPublic">
                <span class="icon">🌍</span>
                <span class="text">Make Public</span>
              </button>
              <button class="action-btn private-btn" @click="initiateSetPrivate">
                <span class="icon">🔒</span>
                <span class="text">Make Private</span>
              </button>
            </div>
            <p class="helper-text">This will update visibility for all messages in this conversation.</p>
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
          <p v-if="confirmationType === 'recipient'">
            Add <strong>{{ selectedUser?.display_name || selectedUser?.user_tag }}</strong> (@{{ selectedUser?.user_tag }}) to all messages in this conversation?
          </p>
          <p v-else-if="confirmationType === 'channel'">
            Add all messages in this conversation to channel <strong>{{ selectedChannel?.display_name }}</strong>?
          </p>
          <p v-else-if="confirmationType === 'public'">
            Make all messages in this conversation <strong>public</strong>?
          </p>
          <p v-else-if="confirmationType === 'private'">
            Make all messages in this conversation <strong>private</strong>?
          </p>
          
          <div class="confirmation-actions">
            <button 
              @click="confirmAction"
              class="confirm-btn"
              :disabled="isProcessing"
              :class="{ 'loading': isProcessing }"
            >
              <div v-if="isProcessing" class="button-loading">
                <div class="spinner-small"></div>
                <span>Processing...</span>
              </div>
              <span v-else>Confirm</span>
            </button>
            
            <button 
              @click="cancelConfirmation"
              class="cancel-btn"
              :disabled="isProcessing"
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
import ChannelsService from '../../services/ChannelsService.js';

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

const emit = defineEmits(['close', 'recipients-added', 'channels-added', 'publicity-updated']);

const store = useStore();

// Recipient state
const showAddRecipientsDropdown = ref(false);
const searchResults = ref([]);
const selectedUser = ref(null);
const searchQuery = ref('');
const isSearching = ref(false);
const hasSearched = ref(false);
const showSearchResults = ref(false);
const searchInput = ref(null);
let searchTimeout = null;

// Channel state
const showAddChannelsDropdown = ref(false);
const channelSearchResults = ref([]);
const selectedChannel = ref(null);
const channelSearchQuery = ref('');
const isSearchingChannels = ref(false);
const hasSearchedChannels = ref(false);
const showChannelSearchResults = ref(false);
const channelSearchInput = ref(null);
let channelSearchTimeout = null;

// Publicity state
const showPublicityOptions = ref(false);

// Confirmation state
const showConfirmation = ref(false);
const confirmationType = ref(null); // 'recipient', 'channel', 'public', 'private'
const isProcessing = ref(false);

// Watch for modal visibility
watch(() => props.isVisible, (newVal) => {
  if (newVal) {
    resetState();
  }
});

const resetState = () => {
  showAddRecipientsDropdown.value = false;
  searchResults.value = [];
  selectedUser.value = null;
  searchQuery.value = '';
  isSearching.value = false;
  hasSearched.value = false;
  showSearchResults.value = false;
  
  showAddChannelsDropdown.value = false;
  channelSearchResults.value = [];
  selectedChannel.value = null;
  channelSearchQuery.value = '';
  isSearchingChannels.value = false;
  hasSearchedChannels.value = false;
  showChannelSearchResults.value = false;
  
  showPublicityOptions.value = false;
  
  showConfirmation.value = false;
  confirmationType.value = null;
  isProcessing.value = false;
};

// --- User Search ---
const searchUsers = (event) => {
  if (!props.isVisible) return;
  
  clearTimeout(searchTimeout);
  const query = event.target.value.trim();
  searchQuery.value = query;
  isSearching.value = query.length >= 1;
  
  if (query.length < 1) {
    searchResults.value = [];
    showSearchResults.value = false;
    hasSearched.value = false;
    return;
  }
  
  searchTimeout = setTimeout(async () => {
    try {
      isSearching.value = true;
      hasSearched.value = true;
      const results = await store.dispatch('auth/searchUsers', query);
      searchResults.value = Array.isArray(results) ? results : [];
      showSearchResults.value = searchResults.value.length > 0;
      isSearching.value = false;
    } catch (error) {
      console.error('Error searching users:', error);
      searchResults.value = [];
      isSearching.value = false;
      showSearchResults.value = false;
    }
  }, 300);
};

const toggleAddRecipientsDropdown = () => {
  showAddRecipientsDropdown.value = !showAddRecipientsDropdown.value;
  if (showAddRecipientsDropdown.value) {
    showAddChannelsDropdown.value = false;
    showPublicityOptions.value = false;
    nextTick(() => searchInput.value?.focus());
  }
};

const selectUser = (user) => {
  selectedUser.value = user;
  confirmationType.value = 'recipient';
  showConfirmation.value = true;
  searchResults.value = [];
};

// --- Channel Search ---
const searchChannels = (event) => {
  if (!props.isVisible) return;
  
  clearTimeout(channelSearchTimeout);
  const query = event.target.value.trim();
  channelSearchQuery.value = query;
  isSearchingChannels.value = query.length >= 1;
  
  if (query.length < 1) {
    channelSearchResults.value = [];
    showChannelSearchResults.value = false;
    hasSearchedChannels.value = false;
    return;
  }
  
  channelSearchTimeout = setTimeout(async () => {
    try {
      isSearchingChannels.value = true;
      hasSearchedChannels.value = true;
      // Use existing user channels as base, filter by query
      // Ideally we'd have a global channel search, but for now search user's channels
      const allChannels = await ChannelsService.getUserChannels();
      const results = allChannels.filter(c => 
        c.display_name.toLowerCase().includes(query.toLowerCase()) || 
        (c.description && c.description.toLowerCase().includes(query.toLowerCase()))
      );
      
      channelSearchResults.value = results;
      showChannelSearchResults.value = results.length > 0;
      isSearchingChannels.value = false;
    } catch (error) {
      console.error('Error searching channels:', error);
      channelSearchResults.value = [];
      isSearchingChannels.value = false;
      showChannelSearchResults.value = false;
    }
  }, 300);
};

const toggleAddChannelsDropdown = () => {
  showAddChannelsDropdown.value = !showAddChannelsDropdown.value;
  if (showAddChannelsDropdown.value) {
    showAddRecipientsDropdown.value = false;
    showPublicityOptions.value = false;
    nextTick(() => channelSearchInput.value?.focus());
  }
};

const selectChannel = (channel) => {
  selectedChannel.value = channel;
  confirmationType.value = 'channel';
  showConfirmation.value = true;
  channelSearchResults.value = [];
};

// --- Publicity Options ---
const togglePublicityOptions = () => {
  showPublicityOptions.value = !showPublicityOptions.value;
  if (showPublicityOptions.value) {
    showAddRecipientsDropdown.value = false;
    showAddChannelsDropdown.value = false;
  }
};

const initiateSetPublic = () => {
  confirmationType.value = 'public';
  showConfirmation.value = true;
};

const initiateSetPrivate = () => {
  confirmationType.value = 'private';
  showConfirmation.value = true;
};

// --- Confirmation & Execution ---
const cancelConfirmation = () => {
  if (isProcessing.value) return;
  showConfirmation.value = false;
  selectedUser.value = null;
  selectedChannel.value = null;
  confirmationType.value = null;
};

const confirmAction = async () => {
  if (!props.centeredMessageId) return;
  
  isProcessing.value = true;
  
  try {
    // 1. Get conversation message IDs
    const treeResponse = await MessageService.getTreeIds(props.centeredMessageId);
    const messageIds = treeResponse.data.message_ids;
    
    if (!messageIds || messageIds.length === 0) {
      throw new Error("No messages found in conversation");
    }
    
    // 2. Execute Action
    if (confirmationType.value === 'recipient') {
      const recipient = {
        uid: selectedUser.value.uid,
        display_name: selectedUser.value.display_name,
        user_tag: selectedUser.value.user_tag,
        public: true
      };
      
      // Use batch add (no propagation param needed as we have explicit IDs)
      await MessageService.addRecipientsToMessage(
        messageIds,
        [recipient],
        false, // addToAncestors
        false  // addToFullTree (we handled it)
      );
      
      emit('recipients-added', { recipient, count: messageIds.length });
      
    } else if (confirmationType.value === 'channel') {
      await ChannelsService.batchAddMessagesToChannels(
        messageIds,
        [selectedChannel.value.id]
      );
      
      emit('channels-added', { channel: selectedChannel.value, count: messageIds.length });
      
    } else if (confirmationType.value === 'public' || confirmationType.value === 'private') {
      const isPublic = confirmationType.value === 'public';
      await MessageService.setMessagesPublic(messageIds, isPublic);
      
      emit('publicity-updated', { isPublic, count: messageIds.length });
    }
    
    // 3. Refresh UI
    await store.dispatch('messages/loadMessageRadius', {
      messageId: props.centeredMessageId,
      radius: 10
    });
    
    // Close
    showConfirmation.value = false;
    resetState();
    closeModal();
    
  } catch (error) {
    console.error(`Error executing ${confirmationType.value} action:`, error);
    const errorMessage = error.response?.data?.detail || 'Operation failed';
    store.commit('ui/SET_ERROR', { 
      code: 'tree_op_failed', 
      message: errorMessage 
    });
  } finally {
    isProcessing.value = false;
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
  display: flex;
  align-items: center;
  gap: 6px;
}

.conversation-info-icon {
  font-size: 0.95em;
  opacity: 0.7;
  cursor: help;
  color: var(--color-text-muted, #6b7280);
}

.conversation-info-icon:hover {
  opacity: 1;
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

.publicity-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface);
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.action-btn:hover {
  background-color: var(--color-hover-overlay);
  border-color: var(--color-border-hover);
}

.public-btn:hover {
  background-color: rgba(var(--color-success-rgb, 40, 167, 69), 0.1);
  border-color: var(--color-success);
}

.private-btn:hover {
  background-color: rgba(var(--color-warning-rgb, 255, 193, 7), 0.1);
  border-color: var(--color-warning);
}

.icon {
  font-size: 16px;
}

.helper-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin: 0;
  text-align: center;
}
</style>

