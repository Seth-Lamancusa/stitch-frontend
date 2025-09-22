<template>
  <TabViewLayout>
    <keep-alive>
      <MessageList :key="route.path + '::' + (store.getters['auth/activePrincipalUid'] || '')" :mode="mode" />
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
    await store.dispatch('messages/clearCache');
    console.log(`[MessageListView] Messages store cleared on mount for mode: ${props.mode}`);
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

const handleAddRecipients = async (recipients, propagateToDescendants = false) => {
  try {
    const messageId = recipientsModalMessageId.value;
    console.log('[MessageListView] handleAddRecipients called with:', {
      messageId,
      recipients,
      recipientsCount: recipients?.length,
      propagateToDescendants
    });
    
    if (!messageId) {
      console.error('[MessageListView] No message ID for adding recipients');
      recipientsModalRef.value?.onAddRecipientsError(new Error('No message ID provided'));
      return;
    }

    // Check current recipients before API call
    const currentRecipients = recipientsModalExistingRecipients.value;
    console.log('[MessageListView] Current existing recipients BEFORE API call:', {
      count: currentRecipients?.length || 0,
      recipients: currentRecipients
    });

    // Not supported: show an error
    throw new Error('Adding recipients is not supported');
    
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
