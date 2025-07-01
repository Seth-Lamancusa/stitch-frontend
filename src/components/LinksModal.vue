<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import MessageList from './MessageList.vue';
import { useStore } from 'vuex';

const props = defineProps({
  isOpen: Boolean,
  message: Object
});

const emit = defineEmits(['close']);

const isLoading = ref(false);
const errorMessage = ref('');
const activeTab = ref('incoming');

// Selection state management
const isSelecting = ref(false);
const linkType = ref(null); // 'incoming' or 'outgoing'
const selectedMessages = ref(new Set());

// Toggle for showing all links vs user's links
const showAllLinks = ref(false);

const store = useStore();

// Reset form whenever modal is opened
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    resetForm();
  }
});

const resetForm = () => {
  errorMessage.value = '';
  isLoading.value = false;
  activeTab.value = 'incoming';
  isSelecting.value = false;
  linkType.value = null;
  selectedMessages.value.clear();
};

onMounted(() => {
  resetForm();
});

const closeModal = () => {
  emit('close');
};

const handleMessageClick = (messageId) => {
  // Close modal when a message is clicked and navigation begins
  closeModal();
};

// Start selection mode for adding links
const startAddingLinks = (type) => {
  isSelecting.value = true;
  linkType.value = type; // 'incoming' or 'outgoing'
  selectedMessages.value.clear();
};

// Handle selection changes from MessageList
const handleSelectionChanged = (selectedIds) => {
  selectedMessages.value = new Set(selectedIds);
};

// Cancel selection mode and return to viewing
const cancelSelection = () => {
  isSelecting.value = false;
  linkType.value = null;
  selectedMessages.value.clear();
};

// Add selected links and return to viewing
const addSelectedLinks = async () => {
  if (selectedMessages.value.size === 0) return;
  
  try {
    isLoading.value = true;
    errorMessage.value = '';
    
    // Create links for each selected message
    const promises = Array.from(selectedMessages.value).map(async (targetMessageId) => {
      let messageIdFrom, messageIdTo;
      
      if (linkType.value === 'incoming') {
        // For incoming links: selected message links TO current message
        messageIdFrom = targetMessageId;
        messageIdTo = props.message.id;
      } else if (linkType.value === 'outgoing') {
        // For outgoing links: current message links TO selected message
        messageIdFrom = props.message.id;
        messageIdTo = targetMessageId;
      }
      
      // Call the create link API (we'll need to implement this)
      return await store.dispatch('messages/createLink', {
        messageIdFrom,
        messageIdTo
      });
    });
    
    // Wait for all links to be created
    const results = await Promise.all(promises);
    
    // Check if all succeeded
    const failedCount = results.filter(result => !result).length;
    if (failedCount > 0) {
      errorMessage.value = `Failed to create ${failedCount} link(s). Please try again.`;
      return;
    }
    
    // Success - return to viewing mode and refresh the appropriate tab
    cancelSelection();
    
    // Refresh the current tab to show new links
    // This will be handled automatically by the store action
    
  } catch (error) {
    console.error('Error adding links:', error);
    errorMessage.value = 'Failed to add links. Please try again.';
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <transition name="fade">
    <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-container">
        <div class="modal-header">
          <div class="header-left">
            <h3>{{ isSelecting ? `Adding ${linkType} links...` : 'Linked Messages' }}</h3>
            <!-- Toggle for showing all links vs user's links -->
            <div 
              v-if="!isSelecting"
              class="toggle-container"
              :title="showAllLinks ? 'Showing all links' : 'Showing only your links'"
            >
              <span class="toggle-label" :class="{ 'active': !showAllLinks }">Mine</span>
              <div class="toggle-switch" @click="showAllLinks = !showAllLinks">
                <div class="toggle-slider" :class="{ 'active': showAllLinks }"></div>
              </div>
              <span class="toggle-label" :class="{ 'active': showAllLinks }">All</span>
            </div>
          </div>
          <button class="close-button" @click="closeModal">×</button>
        </div>
        
        <!-- Tab Navigation - only show when not selecting -->
        <div v-if="!isSelecting" class="tab-navigation">
          <button 
            class="tab-button"
            :class="{ 'active': activeTab === 'incoming' }"
            @click="activeTab = 'incoming'"
          >
            Incoming
          </button>
          <button 
            class="tab-button"
            :class="{ 'active': activeTab === 'outgoing' }"
            @click="activeTab = 'outgoing'"
          >
            Outgoing
          </button>
        </div>
        
        <!-- Add Link Button - only show when not selecting -->
        <div v-if="!isSelecting" class="add-link-section">
          <button 
            class="add-link-button"
            @click="startAddingLinks(activeTab)"
          >
            Add {{ activeTab }} links
          </button>
        </div>
        
        <div class="modal-content">
          <div v-if="isLoading" class="loading-state">
            <div class="spinner"></div>
            <p>Loading messages...</p>
          </div>
          
          <div v-else class="messages-container">
            <MessageList
              :mode="isSelecting ? 'saved' : (activeTab === 'incoming' ? 'incoming-links' : 'outgoing-links')"
              :sourceMessageId="message?.id"
              :showAllLinks="showAllLinks"
              :hideHeader="true"
              :hideInfoBox="true"
              :compact="true"
              :selectable="isSelecting"
              @messageClicked="handleMessageClick"
              @selectionChanged="handleSelectionChanged"
            />
          </div>
          
          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
        </div>
        
        <div class="modal-footer">
          <template v-if="isSelecting">
            <button class="cancel-btn" @click="cancelSelection" :disabled="isLoading">
              Cancel
            </button>
            <button 
              class="add-btn" 
              @click="addSelectedLinks" 
              :disabled="isLoading || selectedMessages.size === 0"
            >
              <span v-if="!isLoading">Add ({{ selectedMessages.size }})</span>
              <div v-else class="button-spinner"></div>
            </button>
          </template>
          <template v-else>
            <button class="close-btn" @click="closeModal">Close</button>
          </template>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-fast);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

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
  z-index: 9999;
  backdrop-filter: blur(2px);
}

.modal-container {
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  width: 90%;
  max-width: 600px;
  max-height: 85vh;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  animation: modal-appear var(--transition-normal);
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 10000;
}

@keyframes modal-appear {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.modal-header h3 {
  margin: 0;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  font-size: var(--font-size-xl);
  cursor: pointer;
  color: var(--color-text);
  opacity: 0.7;
  transition: opacity var(--transition-fast);
  height: 24px;
  width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.close-button:hover {
  opacity: 1;
}

.modal-content {
  padding: var(--space-lg);
  flex: 1;
  overflow-y: auto;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xl);
  color: var(--color-text-secondary);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: var(--color-primary);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.tab-navigation {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-surface);
  flex-shrink: 0;
}

.tab-button {
  flex: 1;
  padding: var(--space-md) var(--space-lg);
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: all var(--transition-fast);
  position: relative;
}

.tab-button:hover {
  color: var(--color-text);
  background-color: var(--color-hover-overlay);
}

.tab-button.active {
  color: var(--color-primary);
  background-color: var(--color-surface);
}

.tab-button.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background-color: var(--color-primary);
}

.messages-container {
  flex: 1;
  min-height: 200px;
}

.add-link-section {
  padding: var(--space-lg) var(--space-lg) 0 var(--space-lg);
  display: flex;
  justify-content: center;
}

.add-link-button {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-lg);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.add-link-button:hover {
  background-color: var(--color-primary-dark);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
  border-top: 1px solid var(--color-border);
  background-color: var(--color-surface);
  flex-shrink: 0;
}

.close-btn, .cancel-btn, .add-btn {
  padding: var(--space-xs) var(--space-lg);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-width: 80px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn, .cancel-btn {
  background-color: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.close-btn:hover, .cancel-btn:hover {
  background-color: var(--color-hover-overlay);
  border-color: var(--color-border-dark);
}

.add-btn {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.add-btn:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
}

.add-btn:disabled, .cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid var(--color-text-inverse);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.error-message {
  color: var(--color-error);
  background-color: var(--color-error-light);
  border: 1px solid var(--color-error);
  border-radius: var(--radius-sm);
  padding: var(--space-sm);
  margin-top: var(--space-md);
  font-size: var(--font-size-sm);
}

.toggle-container {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: 0;
}

.toggle-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.toggle-label.active {
  color: var(--color-primary);
}

.toggle-switch {
  width: 40px;
  height: 20px;
  background-color: var(--color-border);
  border-radius: 10px;
  position: relative;
  cursor: pointer;
}

.toggle-slider {
  width: 16px;
  height: 16px;
  background-color: var(--color-text-inverse);
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform var(--transition-fast);
}

.toggle-slider.active {
  transform: translateX(20px);
}

/* Mobile responsive styles */
@media (max-width: 768px) {
  .modal-container {
    width: 95%;
    max-width: none;
    max-height: 90vh;
  }
  
  .modal-content {
    padding: var(--space-md);
  }
  
  .modal-header {
    padding: var(--space-sm) var(--space-md);
    flex-wrap: wrap;
    gap: var(--space-sm);
  }
  
  .header-left {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-xs);
  }
  
  .tab-button {
    padding: var(--space-sm) var(--space-md);
    font-size: calc(var(--font-size-sm) - 1px);
  }
  
  .add-link-section {
    padding: var(--space-md);
  }
  
  .add-link-button {
    padding: var(--space-xs) var(--space-md);
    font-size: calc(var(--font-size-sm) - 1px);
  }
  
  .modal-footer {
    padding: var(--space-sm) var(--space-md);
    gap: var(--space-xs);
  }
  
  .close-btn, .cancel-btn, .add-btn {
    padding: var(--space-xs) var(--space-sm);
    font-size: calc(var(--font-size-sm) - 1px);
    min-width: 70px;
    height: 32px;
  }
}

@media (max-width: 480px) {
  .modal-container {
    width: 98%;
    max-height: 95vh;
    margin: 1% 1%;
  }
  
  .modal-content {
    padding: var(--space-sm);
  }
  
  .modal-header {
    padding: var(--space-xs) var(--space-sm);
  }
  
  .modal-header h3 {
    font-size: var(--font-size-md);
  }
  
  .tab-navigation {
    flex-direction: column;
  }
  
  .tab-button {
    padding: var(--space-xs) var(--space-sm);
    font-size: calc(var(--font-size-xs));
  }
  
  .add-link-section {
    padding: var(--space-sm);
  }
  
  .toggle-container {
    gap: var(--space-sm);
  }
  
  .toggle-label {
    font-size: calc(var(--font-size-xs));
  }
  
  .modal-footer {
    flex-direction: column;
    gap: var(--space-xs);
  }
  
  .close-btn, .cancel-btn, .add-btn {
    width: 100%;
    padding: var(--space-xs);
    min-width: unset;
    height: 36px;
  }
}

</style>
