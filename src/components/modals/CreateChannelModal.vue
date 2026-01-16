<template>
  <div v-if="show" class="modal-overlay" @click.stop="handleCancel">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h3>Create Channel</h3>
        <button class="close-button" @click.stop="handleCancel">×</button>
      </div>
      
      <div class="modal-content">
        <form @submit.prevent="handleCreate">
          <div class="form-group">
            <label for="display-name">Channel Name</label>
            <input
              id="display-name"
              v-model="displayName"
              type="text"
              placeholder="e.g., engineering"
              maxlength="32"
              required
              class="form-input"
              :disabled="isCreating"
            />
            <span class="char-count">{{ displayName.length }}/32</span>
          </div>

          <div class="form-group">
            <label for="description">Description</label>
            <textarea
              id="description"
              v-model="description"
              placeholder="Brief description of the channel"
              maxlength="128"
              rows="3"
              required
              class="form-textarea"
              :disabled="isCreating"
            ></textarea>
            <span class="char-count">{{ description.length }}/128</span>
          </div>

          <div class="form-actions">
            <button
              type="button"
              class="btn btn-secondary"
              @click="handleCancel"
              :disabled="isCreating"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="isCreating || !displayName.trim() || !description.trim()"
            >
              <span v-if="isCreating" class="btn-spinner"></span>
              <span v-else>Create Channel</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useStore } from 'vuex';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'created']);

const store = useStore();

const displayName = ref('');
const description = ref('');
const isCreating = ref(false);

// Reset form when modal opens/closes
watch(() => props.show, (newVal) => {
  if (newVal) {
    displayName.value = '';
    description.value = '';
    isCreating.value = false;
  }
});

const handleCancel = () => {
  if (!isCreating.value) {
    emit('close');
  }
};

const handleCreate = async () => {
  if (isCreating.value || !displayName.value.trim() || !description.value.trim()) {
    return;
  }

  try {
    isCreating.value = true;
    
    // Import ChannelsService dynamically
    const ChannelsService = (await import('../../services/ChannelsService')).default;
    
    const channel = await ChannelsService.createChannel({
      display_name: displayName.value.trim(),
      description: description.value.trim()
    });

    // Reset form
    displayName.value = '';
    description.value = '';
    
    // Emit success event
    emit('created', channel);
    emit('close');
  } catch (error) {
    console.error('[CreateChannelModal] Error creating channel:', error);
    
    // Show error message to user
    let errorMessage = 'Failed to create channel';
    if (error.response?.status === 403) {
      errorMessage = 'You do not have permission to create channels';
    } else if (error.response?.status === 400) {
      errorMessage = error.response?.data?.detail || 'Invalid channel data';
    } else if (error.message) {
      errorMessage = `Failed to create channel: ${error.message}`;
    }
    
    store.commit('ui/SET_ERROR', errorMessage);
  } finally {
    isCreating.value = false;
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
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--z-index-modal, 1000);
  backdrop-filter: blur(2px);
}

.modal-container {
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  width: 90%;
  max-width: 500px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-border);
  overflow: hidden;
  animation: modal-appear var(--transition-normal);
  display: flex;
  flex-direction: column;
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
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  color: var(--color-text);
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  font-size: var(--font-size-xl);
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: 4px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  height: 24px;
  width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover:not(:disabled) {
  color: var(--color-text);
  background-color: var(--color-hover-overlay);
}

.close-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-content {
  padding: var(--space-lg);
}

.form-group {
  margin-bottom: var(--space-lg);
  position: relative;
}

.form-group label {
  display: block;
  margin-bottom: var(--space-xs);
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
}

.form-input,
.form-textarea {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-secondary);
  color: var(--color-text);
  font-size: var(--font-size-base);
  font-family: inherit;
  transition: border-color var(--transition-fast);
  box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(79, 140, 255, 0.1);
}

.form-input:disabled,
.form-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.char-count {
  display: block;
  margin-top: var(--space-xs);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  text-align: right;
}

.form-actions {
  display: flex;
  gap: var(--space-md);
  justify-content: flex-end;
  margin-top: var(--space-xl);
}

.btn {
  padding: var(--space-sm) var(--space-lg);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  min-width: 100px;
}

.btn-primary {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background-color: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-hover-overlay);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Mobile responsive */
@media (max-width: 768px) {
  .modal-container {
    width: 95%;
    max-width: none;
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .btn {
    width: 100%;
  }
}
</style>

