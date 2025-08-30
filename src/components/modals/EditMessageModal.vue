<template>
  <div v-if="isVisible" class="modal-overlay" @click.self="closeModal">
    <div class="modal-container">
      <div class="modal-header">
        <h3>Edit Message</h3>
        <button @click="closeModal" class="close-button">&times;</button>
      </div>
      <div class="modal-content">
        <div v-if="messageToEdit" class="form-container">
          <div class="form-group">
            <label for="message-content">Content</label>
            <textarea
              id="message-content"
              v-model="editableContent"
              rows="5"
              class="form-control"
            ></textarea>
          </div>
          <div class="form-group">
            <label for="message-author">Author</label>
            <user-search-input
              :initial-user="initialAuthor"
              @user-selected="handleAuthorSelected"
            />
          </div>
        </div>
        <div v-else class="loading-container">
          <p>Loading message...</p>
        </div>
      </div>
      <div class="modal-footer">
        <button @click="closeModal" class="cancel-btn">Cancel</button>
        <button @click="saveChanges" class="save-btn" :disabled="isSaving">
          <span v-if="isSaving" class="spinner"></span>
          {{ isSaving ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, computed } from 'vue';
import { useStore } from 'vuex';
import MessageService from '../../services/MessageService';
import UserSearchInput from '../UserSearchInput.vue';

export default {
  name: 'EditMessageModal',
  components: {
    UserSearchInput,
  },
  setup() {
    const store = useStore();
    const isVisible = computed(() => store.getters['navigation/editMessageModalVisible']);
    const messageToEdit = computed(() => store.getters['navigation/messageToEdit']);

    const editableContent = ref('');
    const selectedAuthor = ref(null);
    const initialAuthor = ref(null);
    const isSaving = ref(false);

    watch(messageToEdit, (newMessage) => {
      if (newMessage) {
        editableContent.value = newMessage.content;
        initialAuthor.value = {
          uid: newMessage.content_author,
          display_name: newMessage.author_display_name,
          user_tag: newMessage.author_user_tag,
        };
        selectedAuthor.value = initialAuthor.value;
      }
    }, { immediate: true });

    const closeModal = () => {
      store.dispatch('navigation/hideEditMessageModal');
    };

    const handleAuthorSelected = (user) => {
      selectedAuthor.value = user;
    };

    const saveChanges = async () => {
      if (!messageToEdit.value) return;

      isSaving.value = true;
      const payload = {};

      if (editableContent.value !== messageToEdit.value.content) {
        payload.content = editableContent.value;
      }

      if (selectedAuthor.value && selectedAuthor.value.uid !== messageToEdit.value.content_author) {
        payload.content_author = selectedAuthor.value.uid;
      }

      if (Object.keys(payload).length > 0) {
        try {
          const updatedMessage = await MessageService.adminUpdateMessage(
            messageToEdit.value.id,
            payload
          );
          store.dispatch('messages/updateMessage', updatedMessage, { root: true });
          closeModal();
        } catch (error) {
          console.error('Failed to update message:', error);
          // Optionally, show an error message to the user
        }
      } else {
        closeModal();
      }

      isSaving.value = false;
    };

    return {
      isVisible,
      messageToEdit,
      editableContent,
      initialAuthor,
      isSaving,
      closeModal,
      handleAuthorSelected,
      saveChanges,
    };
  },
};
</script>

<style scoped>
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
  background-color: var(--color-surface);
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
  margin: 0;
  color: var(--color-text);
  font-size: 18px;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--color-text);
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
  color: var(--color-text-secondary);
}

.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background-color: var(--color-surface-hover);
  color: var(--color-text);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
  gap: 12px;
}

.cancel-btn {
  background-color: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
}

.save-btn {
  background-color: var(--color-primary);
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.save-btn:disabled {
  background-color: var(--color-primary-disabled);
  cursor: not-allowed;
}

.spinner {
  display: inline-block;
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 5px;
  vertical-align: middle;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style> 