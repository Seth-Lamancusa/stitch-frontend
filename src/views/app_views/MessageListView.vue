<template>
  <AppViewLayout>
    <!-- Whitelist rejection notification -->
    <div v-if="wasRejectedForWhitelist && !isRejectionNoticeDismissed" class="whitelist-rejection-notice">
      <button @click="dismissRejectionNotice" class="close-button" title="Dismiss">×</button>
      <div class="rejection-content">
        <div class="rejection-icon">❌</div>
        <h4>Oh no! You aren't whitelisted.</h4>
        <p>You can still view free public messages via direct links, but you don't have an inbox and you can't create messages.</p>
        <router-link to="/requests" class="waitlist-link">Join the waitlist here!</router-link>
      </div>
    </div>
    
    <MessageList :mode="mode" />

    <!-- Global Recipients Modal -->
    <RecipientsModal
      :is-visible="recipientsModalVisible"
      :is-public="recipientsModalIsPublic"
      :is-add-mode="recipientsModalIsAddMode"
      :existing-recipients="recipientsModalExistingRecipients"
      :message-id="recipientsModalMessageId"
      :is-recipient-removal-disabled="recipientsModalIsRecipientRemovalDisabled"
      @close="closeRecipientsModal"
      @done="closeRecipientsModal"
      @add-recipients="handleAddRecipients"
      @recipient-removed="handleRecipientRemoved"
    />

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteConfirm" class="delete-confirm-modal">
      <div class="delete-confirm-content">
        <h3>Confirm Deletion</h3>
        <p>Are you sure you want to delete this message and all its replies?</p>
        <p class="warning">This action cannot be undone.</p>
        <div class="delete-confirm-actions">
          <button @click="store.dispatch('ui/hideDeleteConfirm')" class="cancel-button" :disabled="isDeleting">
            Cancel
          </button>
          <button @click="deleteMessage" class="delete-button" :disabled="isDeleting">
            <span v-if="!isDeleting">Delete</span>
            <div v-else class="button-spinner"></div>
          </button>
        </div>
      </div>
    </div>
  </AppViewLayout>
</template>

<script setup>
import { computed, onMounted, watch, ref } from 'vue';
import { useStore } from 'vuex';
import { useRoute } from 'vue-router';
import AppViewLayout from '../../components/layouts/AppViewLayout.vue';
import MessageList from '../../components/MessageList.vue';
import RecipientsModal from '../../components/RecipientsModal.vue';

// Accept mode prop from router
const props = defineProps({
  mode: {
    type: String,
    default: 'public'
  }
});

const store = useStore();
const route = useRoute();

// Clear messages store on mount and when mode changes
onMounted(async () => {
  try {
    await store.dispatch('messages/clearCache');
    console.log(`[MessageListView] Messages store cleared on mount for mode: ${props.mode}`);
  } catch (error) {
    console.error('[MessageListView] Error clearing messages store:', error);
  }
  
  // Set active tab based on route
  updateActiveTab();
});

// Watch for route changes to update active tab
watch(() => route.path, () => {
  updateActiveTab();
});

const updateActiveTab = () => {
  let tab = 'public'; // Default to public
  if (route.path === '/public') tab = 'public';
  else if (route.path === '/saved') tab = 'saved';
  else if (route.path === '/inbox') tab = 'inbox';
  
  store.dispatch('navigation/setActiveTab', tab);
};

const user = computed(() => store.getters['auth/user']);

// Global recipients modal computed properties
const recipientsModalVisible = computed(() => store.getters['navigation/recipientsModalVisible']);
const recipientsModalIsPublic = computed(() => store.getters['navigation/recipientsModalIsPublic']);
const recipientsModalIsAddMode = computed(() => store.getters['navigation/recipientsModalIsAddMode']);
const recipientsModalExistingRecipients = computed(() => store.getters['navigation/recipientsModalExistingRecipients']);
const recipientsModalMessageId = computed(() => store.getters['navigation/recipientsModalMessageId']);
const recipientsModalIsRecipientRemovalDisabled = computed(() => store.getters['navigation/recipientsModalIsRecipientRemovalDisabled']);

// Check if user was recently rejected due to not being whitelisted
const wasRejectedForWhitelist = computed(() => {
  // Only show banner if user was explicitly rejected for whitelist
  // (they shouldn't be able to stay logged in if not whitelisted)
  return store.getters['auth/wasRejectedForWhitelist'];
});

// Track if the rejection notice has been dismissed
const isRejectionNoticeDismissed = ref(false);

// Watch for changes in wasRejectedForWhitelist to reset dismissal state
watch(wasRejectedForWhitelist, (newValue, oldValue) => {
  if (newValue) {
    // Always reset dismissal state when rejection flag is set
    // This ensures the banner shows for every failed login attempt
    isRejectionNoticeDismissed.value = false;
    console.log('[MessageListView] Rejection state changed, showing banner');
  }
});

// Handler to dismiss the rejection notice
const dismissRejectionNotice = () => {
  isRejectionNoticeDismissed.value = true;
};

// Global recipients modal methods
const closeRecipientsModal = () => {
  store.dispatch('navigation/hideRecipientsModal');
};

const handleAddRecipients = async (recipients) => {
  try {
    const messageId = recipientsModalMessageId.value;
    if (!messageId) {
      console.error('[MessageListView] No message ID for adding recipients');
      return;
    }

    const MessageService = await import('../../services/MessageService');
    const response = await MessageService.default.addRecipientsToMessage(messageId, recipients);
    
    console.log('[MessageListView] Recipients added successfully', response.data);
    
    // Close the modal
    closeRecipientsModal();
    
  } catch (error) {
    console.error('[MessageListView] Error adding recipients:', error);
    store.commit('ui/SET_ERROR', 'Failed to add recipients. Please try again.');
  }
};

const handleRecipientRemoved = (recipientUid) => {
  console.log('[MessageListView] handleRecipientRemoved called with', recipientUid);
};

// Add computed properties for delete confirmation modal
const showDeleteConfirm = computed(() => store.getters['ui/showDeleteConfirm']);
const messageToDelete = computed(() => store.getters['ui/messageToDelete']);
const isDeleting = ref(false);

// Add delete message functionality
const deleteMessage = async () => {
  if (!messageToDelete.value || isDeleting.value) return;
  
  const deletedId = messageToDelete.value.id;
  
  try {
    isDeleting.value = true;
    await store.dispatch('messages/deleteMessage', deletedId);
    store.commit('ui/SET_DELETE_CONFIRM', { show: false, message: null });
  } catch (error) {
    console.error('Error deleting message:', error);
    
    let errorMessage = 'Failed to delete message';
    
    if (error.response?.status === 404) {
      errorMessage = 'This message has already been deleted (likely when its parent was deleted)';
      store.commit('ui/SET_DELETE_CONFIRM', { show: false, message: null });
    } else if (error.response?.status === 403) {
      errorMessage = 'You do not have permission to delete this message';
    } else if (error.message) {
      errorMessage = 'Failed to delete message: ' + error.message;
    }
    
    store.commit('ui/SET_ERROR', errorMessage);
  } finally {
    isDeleting.value = false;
  }
};
</script>

<style scoped>
/* Whitelist rejection notice styles */
.whitelist-rejection-notice {
  padding: 0;
  border-radius: var(--radius-sm, 4px);
  background-color: #ff8a8aad;
  border: 1px solid rgba(255, 179, 0, 0.3);
  box-shadow: 0 2px 8px rgba(255, 179, 0, 0.1);
  width: 50%;
  margin: var(--space-md, 16px) auto;
  position: relative;
}

.close-button {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  color: var(--color-text-inverse, #fff);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all var(--transition-fast, 0.2s);
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.close-button:active {
  transform: scale(0.95);
}

.rejection-content {
  padding: var(--space-md, 16px);
  text-align: center;
  color: var(--color-text-inverse, #fff);
}

.rejection-icon {
  font-size: 1.5rem;
  margin-bottom: var(--space-xs, 8px);
}

.rejection-content h4 {
  margin: 0 0 var(--space-sm, 8px) 0;
  font-size: var(--font-size-md, 1rem);
  font-weight: 600;
  color: var(--color-text-inverse, #fff);
}

.rejection-content p {
  margin: 0 0 var(--space-sm, 12px) 0;
  font-size: var(--font-size-sm, 0.9rem);
  line-height: 1.4;
  color: var(--color-text-inverse, #fff);
}

.waitlist-link {
  display: inline-block;
  padding: var(--space-xs, 6px) var(--space-sm, 12px);
  background-color: rgba(255, 255, 255, 0.2);
  color: var(--color-text-inverse, #fff);
  text-decoration: none;
  border-radius: var(--radius-sm, 4px);
  font-size: var(--font-size-sm, 0.9rem);
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: all var(--transition-fast, 0.2s);
}

.waitlist-link:hover {
  background-color: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  color: var(--color-text-inverse, #fff);
}

/* Add styles for delete confirmation modal */
.delete-confirm-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.delete-confirm-content {
  background-color: var(--color-surface);
  padding: var(--space-lg);
  border-radius: var(--radius-md);
  max-width: 400px;
  width: 90%;
}

.delete-confirm-content h3 {
  margin: 0 0 var(--space-md);
  color: var(--color-error);
}

.delete-confirm-content p {
  margin: var(--space-sm) 0;
}

.warning {
  color: var(--color-error);
  font-weight: bold;
}

.delete-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.cancel-button, .delete-button {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.cancel-button {
  background: transparent;
  border: 1px solid var(--color-border);
}

.delete-button {
  background-color: var(--color-error);
  color: white;
  border: none;
}

.delete-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.button-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
