/**
 * DeleteConfirmModal - Confirmation modal for message deletion
 * 
 * This component handles the confirmation process for deleting a message and its replies.
 * It's used by ThreadView and MessageListView and displays when a user or admin clicks the delete button.
 */
<template>
  <div v-if="show" class="modal-overlay" @click.stop="handleCancel">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h3>Delete Message</h3>
        <button class="close-button" @click.stop="handleCancel">×</button>
      </div>
      
      <div class="modal-content">
        <p class="warning-text">
          Are you sure you want to delete this message?
        </p>
        <p v-if="relationHint" class="relation-hint">
          {{ relationHint }}
        </p>
        <p v-if="disallowReason" class="disallow-hint">
          {{ disallowReason }}
        </p>
        
        <!-- Delete descendants toggle -->
        <div class="delete-option">
          <label class="toggle-container">
            <input 
              type="checkbox" 
              v-model="deleteDescendants" 
              :disabled="isDeleting"
              class="toggle-checkbox"
            >
            <span class="toggle-slider"></span>
            <span class="toggle-label">Also delete all replies (descendants)</span>
          </label>
          <p class="option-description">
            If enabled, this will also delete all replies to this message and their replies recursively.
          </p>
        </div>
        
        <p class="delete-details">
          <strong>Warning:</strong> This will permanently delete 
          {{ deleteDescendants ? 'this message and all its replies' : 'this message' }}.
          This action cannot be undone.
        </p>
      </div>
      
      <div class="modal-footer">
        <button class="cancel-btn" @click.stop="handleCancel" :disabled="isDeleting">Cancel</button>
        <button 
          class="delete-btn" 
          @click.stop="handleConfirm" 
          :disabled="isDeleting || disallowConfirm"
        >
          {{ isDeleting ? 'Deleting...' : (deleteDescendants ? 'Delete Message & Replies' : 'Delete Message') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'

// Props
const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  message: {
    type: Object,
    default: null
  },
  isDeleting: {
    type: Boolean,
    default: false
  },
  relation: {
    type: String,
    default: null // 'above' | 'below' | null
  },
  disallowConfirm: {
    type: Boolean,
    default: false
  },
  disallowReason: {
    type: String,
    default: ''
  }
});

// Emits
const emit = defineEmits(['cancel', 'confirm']);

// Local state for delete descendants toggle
const deleteDescendants = ref(false);

// Human-readable hint for relation to centered message
const relationHint = computed(() => {
  if (!props.relation) return null;
  if (props.relation === 'above') {
    return 'Note: The currently centered message is above this one. You will not be able to navigate downward past the deletion point afterwards.';
  }
  if (props.relation === 'below') {
    return 'Note: The currently centered message is below this one. You will not be able to navigate upward past the deletion point afterwards.';
  }
  return null;
});

// Reset toggle when modal is hidden (operation completed)
watch(() => props.show, (newShow, oldShow) => {
  if (!newShow && oldShow) {
    // Modal was just hidden, reset the toggle
    deleteDescendants.value = false;
  }
});

// Event handlers
const handleCancel = () => {
  emit('cancel');
};

const handleConfirm = () => {
  // Emit the delete descendants option but don't reset toggle yet
  emit('confirm', { deleteDescendants: deleteDescendants.value });
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
  z-index: var(--z-index-modal);
  backdrop-filter: blur(2px);
}

.modal-container {
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  width: 90%;
  max-width: 500px;
  height: 75vh;
  max-height: 75vh;
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

.close-button:hover {
  color: var(--color-text);
  background-color: var(--color-hover-overlay);
}

.modal-content {
  padding: var(--space-lg);
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.warning-text {
  font-size: var(--font-size-md);
  margin-bottom: var(--space-md);
  color: var(--color-text);
  line-height: var(--line-height-normal);
}

.delete-details {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  margin-bottom: 0;
  line-height: var(--line-height-normal);
  background-color: rgba(220, 38, 38, 0.1);
  padding: var(--space-sm);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(220, 38, 38, 0.3);
}

.relation-hint {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-sm);
}

.disallow-hint {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin-top: 0;
}

.modal-footer {
  padding: var(--space-md) var(--space-lg);
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
  flex-shrink: 0;
}

.cancel-btn {
  padding: var(--space-sm) var(--space-lg);
  background-color: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text);
  font-weight: 500;
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
  min-width: 80px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cancel-btn:hover:not(:disabled) {
  background-color: var(--color-hover-overlay);
  border-color: var(--color-border-light);
}

.delete-btn {
  padding: var(--space-sm) var(--space-lg);
  background-color: var(--color-error);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 500;
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
  min-width: 120px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-btn:hover:not(:disabled) {
  background-color: #c82333;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(220, 38, 38, 0.3);
}

.delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.delete-option {
  margin: var(--space-md) 0;
  padding: var(--space-md);
  background-color: var(--color-surface-secondary, #f8f9fa);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.toggle-container {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
  user-select: none;
}

.toggle-checkbox {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: relative;
  width: 44px;
  height: 24px;
  background-color: var(--color-border-light, #ddd);
  border-radius: 24px;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background-color: white;
  border-radius: 50%;
  transition: all var(--transition-fast);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle-checkbox:checked + .toggle-slider {
  background-color: var(--color-error);
}

.toggle-checkbox:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.toggle-checkbox:disabled + .toggle-slider {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: black;
}

.option-description {
  font-size: var(--font-size-xs);
  color: gray;
  margin: var(--space-xs) 0 0 0;
  line-height: var(--line-height-normal);
}

/* Mobile responsive styles */
@media (max-width: 768px) {
  .modal-container {
    width: 95%;
    margin: var(--space-sm);
  }
  
  .modal-header {
    padding: var(--space-md);
  }
  
  .modal-content {
    padding: var(--space-md);
  }
  
  .modal-footer {
    padding: var(--space-md);
    flex-direction: column;
  }
  
  .cancel-btn,
  .delete-btn {
    width: 100%;
    justify-content: center;
  }
}
</style> 