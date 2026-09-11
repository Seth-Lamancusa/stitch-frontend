<template>
  <TabViewLayout>
    <keep-alive>
      <MessageList :key="route.path + '::' + (store.getters['auth/activePrincipalUid'] || '') + '::' + (store.getters['auth/sessionEpoch'] || 0)" :mode="mode" />
    </keep-alive>

    <!-- Global Recipients Modal -->
    <RecipientsModal
      ref="recipientsModalRef"
      :is-visible="recipientsModalVisible"
      :is-public="recipientsModalIsPublic"
      :is-add-mode="recipientsModalIsAddMode"
      :existing-recipients="recipientsModalExistingRecipients"
      :message-id="recipientsModalMessageId"
      @close="closeRecipientsModal"
      @done="closeRecipientsModal"
      @add-recipients="handleAddRecipients"
      @recipient-removed="handleRecipientRemoved"
    />

    <!-- Delete Confirmation Modal -->
    <DeleteConfirmModal 
      :show="showDeleteConfirm"
      :message="messageToDelete"
      :is-deleting="isDeleting"
      @cancel="store.dispatch('ui/hideDeleteConfirm')"
      @confirm="deleteMessage"
    />
  </TabViewLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useStore } from 'vuex';
import { useRoute } from 'vue-router';
import TabViewLayout from '../../components/layouts/TabViewLayout.vue';
import MessageList from '../../components/MessageList.vue';
import RecipientsModal from '../../components/modals/RecipientsModal.vue';
import DeleteConfirmModal from '../../components/modals/DeleteConfirmModal.vue';
import MessageService from '../../services/MessageService.js';
import { addRecipientsToAncestorsExcludingAuthoredMessages } from '../../utils/recipientPropagation.js';

// Accept mode prop from router
const props = defineProps({
  mode: {
    type: String,
    default: 'public'
  }
});

const store = useStore();
const route = useRoute();

// Clear messages store on mount
onMounted(async () => {
  try {
    const ready = store.getters['auth/authReady'];
    const authed = store.getters['auth/isAuthenticated'];
    if (ready && !authed) {
      await store.dispatch('messages/clearCache');
      console.log(`[MessageListView] Messages store cleared on mount for mode: ${props.mode}`);
    } else {
      console.log('[MessageListView] Skipping clearCache on mount until authReady && !isAuthenticated');
    }
  } catch (error) {
    console.error('[MessageListView] Error clearing messages store:', error);
  }
});

const user = computed(() => store.getters['auth/user']);

// Global recipients modal computed properties
const recipientsModalVisible = computed(() => store.getters['navigation/recipientsModalVisible']);
const recipientsModalIsPublic = computed(() => store.getters['navigation/recipientsModalIsPublic']);
const recipientsModalIsAddMode = computed(() => store.getters['navigation/recipientsModalIsAddMode']);
const recipientsModalExistingRecipients = computed(() => store.getters['navigation/recipientsModalExistingRecipients']);
const recipientsModalMessageId = computed(() => store.getters['navigation/recipientsModalMessageId']);

const recipientsModalRef = ref(null);

// Global recipients modal methods
const closeRecipientsModal = () => {
  store.dispatch('navigation/hideRecipientsModal');
};

const handleAddRecipients = async (recipients, addToAncestors = true) => {
  if (!recipients || recipients.length === 0) {
    recipientsModalRef.value?.onAddRecipientsError(new Error('No recipients provided'));
    return;
  }

  try {
    const messageId = recipientsModalMessageId.value;
    console.log('[MessageListView] handleAddRecipients called with:', {
      messageId,
      recipients,
      recipientsCount: recipients?.length,
      addToAncestors
    });
    
    if (!messageId) {
      console.error('[MessageListView] No message ID for adding recipients');
      recipientsModalRef.value?.onAddRecipientsError(new Error('No message ID provided'));
      return;
    }

    // Add recipients, optionally propagating to ancestors while excluding
    // recipient-authored messages in the ancestor chain.
    if (addToAncestors) {
      await addRecipientsToAncestorsExcludingAuthoredMessages({
        originMessageId: messageId,
        recipients,
        addToAncestors: true,
      });
    } else {
      await MessageService.addRecipientsToMessage(messageId, recipients, false);
    }

    // Refresh the message to reflect recipient changes
    await store.dispatch('messages/refreshLoadedAncestors', {
      messageId: messageId,
      get_replies: true,
      get_children: true,
    });
    
    // Signal completion to the modal
    recipientsModalRef.value?.onAddRecipientsComplete();
    
  } catch (error) {
    console.error('[MessageListView] Error adding recipients:', error);
    // Signal error to the modal
    recipientsModalRef.value?.onAddRecipientsError(error);
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
const deleteMessage = async (options) => {
  if (!messageToDelete.value || isDeleting.value) return;
  
  const deletedId = messageToDelete.value.id;
  const deleteDescendants = options?.deleteDescendants || false;
  
  try {
    isDeleting.value = true;
    await store.dispatch('messages/deleteMessage', { messageId: deletedId, deleteDescendants });
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
 
</style>
