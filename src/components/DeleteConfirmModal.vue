/**
 * DeleteConfirmModal - Confirmation modal for message deletion
 * 
 * This component handles the confirmation process for deleting a message and its replies.
 * It's used by ThreadView and displays when a user or admin clicks the delete button.
 */
<template>
  <div v-if="showModal" class="modal-overlay" @click.stop="cancel">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h3>Delete Message</h3>
        <button class="close-button" @click.stop="cancel">×</button>
      </div>
      
      <div class="modal-content">
        <p class="warning-text">
          Are you sure you want to delete this message?
        </p>
        <p class="delete-details">
          <strong>Warning:</strong> This will permanently delete this message and all of its replies.
          This action cannot be undone.
        </p>
      </div>
      
      <div class="modal-footer">
        <button class="cancel-btn" @click.stop="cancel">Cancel</button>
        <button 
          class="delete-btn" 
          @click.stop="confirmDelete" 
          :disabled="isDeleting"
        >
          {{ isDeleting ? 'Deleting...' : 'Delete Message' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue';
import { useStore } from 'vuex';

export default {
  name: 'DeleteConfirmModal',
  
  setup() {
    const store = useStore();
    
    // State variables
    const showModal = ref(false);
    const isDeleting = ref(false);
    const messageToDelete = ref(null);
    
    // Listen for delete events from the store
    const openModal = (message) => {
      messageToDelete.value = message;
      showModal.value = true;
    };
    
    // Cancel deletion
    const cancel = () => {
      showModal.value = false;
      messageToDelete.value = null;
    };
    
    // Confirm and process deletion
    const confirmDelete = async () => {
      if (!messageToDelete.value) return;
      
      isDeleting.value = true;
      
      try {
        // Call the store action to delete the message
        await store.dispatch('messages/deleteMessage', messageToDelete.value.id);
        
        // Close the modal and reset
        showModal.value = false;
        messageToDelete.value = null;
        
        // Navigate back to list if we deleted the root message
        const currentRoute = window.location.pathname;
        if (currentRoute.includes(`/thread/${messageToDelete.value.id}`)) {
          // We're deleting the current thread, go back to list
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Error deleting message:', error);
      } finally {
        isDeleting.value = false;
      }
    };
    
    // Register event listener for delete requests
    store.subscribe((mutation, state) => {
      if (mutation.type === 'ui/REQUEST_MESSAGE_DELETE') {
        openModal(mutation.payload);
      }
    });
    
    return {
      showModal,
      isDeleting,
      cancel,
      confirmDelete
    };
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
}

.modal-container {
  background-color: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.modal-header {
  padding: 16px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
}

.modal-content {
  padding: 16px;
}

.warning-text {
  font-size: 16px;
  margin-bottom: 12px;
}

.delete-details {
  color: #e74c3c;
  font-size: 14px;
  margin-bottom: 0;
}

.modal-footer {
  padding: 16px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.cancel-btn {
  padding: 8px 16px;
  background-color: #f1f1f1;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.delete-btn {
  padding: 8px 16px;
  background-color: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.delete-btn:disabled {
  background-color: #e57373;
  cursor: not-allowed;
}
</style> 