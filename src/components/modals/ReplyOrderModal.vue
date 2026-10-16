<template>
  <div v-if="isVisible" class="modal-overlay" :class="{ 'closing': isClosing }" @click.self="closeModal">
    <div class="reply-order-modal">
      <div class="modal-header">
        <h3>Order Replies</h3>
        <button class="close-button" @click.stop="closeModal">×</button>
      </div>

      <div class="modal-content">
        <p class="modal-description">
          Select outgoing messages in the order you want them displayed. Replies you leave out appear before this list. Stitches you leave out appear after it.
        </p>

        <!-- Current Order Section -->
        <div v-if="orderedReplies.length > 0" class="order-section">
          <h4 class="section-title">Current Order</h4>
          <div class="ordered-list">
            <div v-for="(replyId, index) in orderedReplies" :key="`ordered-${replyId}`" class="ordered-item">
              <div class="order-number">{{ index + 1 }}</div>
              <div class="reply-info">
                <span class="reply-id">{{ replyId }}</span>
                <span class="reply-preview">{{ getReplyPreview(replyId) }}</span>
              </div>
              <div class="order-actions">
                <button 
                  @click.stop="moveUp(index)" 
                  :disabled="index === 0 || isUpdating"
                  class="order-btn up-btn"
                  title="Move up"
                >↑</button>
                <button 
                  @click.stop="moveDown(index)" 
                  :disabled="index === orderedReplies.length - 1 || isUpdating"
                  class="order-btn down-btn"
                  title="Move down"
                >↓</button>
                <button 
                  @click.stop="removeFromOrder(index)" 
                  :disabled="isUpdating"
                  class="order-btn remove-btn"
                  title="Remove from order"
                >×</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Available Replies Section -->
        <div class="available-section">
          <h4 class="section-title">
            Available
            <span class="section-subtitle">({{ availableReplies.length }})</span>
          </h4>
          <div v-if="availableReplies.length === 0" class="no-replies">
            Nothing left to add
          </div>
          <div v-else class="available-list">
            <button
              v-for="replyId in availableReplies"
              :key="`available-${replyId}`"
              @click.stop="addToOrder(replyId)"
              :disabled="isUpdating || isInOrder(replyId)"
              class="available-item"
              :class="{ 'in-order': isInOrder(replyId) }"
            >
              <span class="reply-id">{{ replyId }}</span>
              <span class="reply-preview">{{ getReplyPreview(replyId) }}</span>
              <span v-if="isInOrder(replyId)" class="added-indicator">✓</span>
            </button>
          </div>
        </div>

        <!-- Clear Order Button -->
        <div v-if="orderedReplies.length > 0" class="clear-section">
          <button 
            @click.stop="clearOrder" 
            :disabled="isUpdating"
            class="clear-button"
          >
            Clear Order (use default)
          </button>
        </div>
      </div>

      <div class="modal-footer">
        <button class="cancel-button" @click.stop="closeModal">Cancel</button>
        <button 
          class="save-button" 
          @click.stop="handleSave" 
          :disabled="isUpdating || !hasChanges"
        >
          {{ isUpdating ? 'Saving...' : 'Save Order' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, nextTick } from 'vue';
import { useStore } from 'vuex';
import { contentText } from '../../utils/messageCompat.js';

const props = defineProps({
  isVisible: { type: Boolean, default: false },
  messageId: { type: String, default: null },
  childIds: { type: Array, default: () => [] },
  stitchChildIds: { type: Array, default: () => [] },
  existingReplyOrder: { type: Array, default: () => [] }
});

const emit = defineEmits(['close', 'update']);

const store = useStore();
const isClosing = ref(false);
const isUpdating = ref(false);

// Local working copy of reply order
const orderedReplies = ref([]);

// Initialize from existing order when modal opens
watch(() => props.isVisible, (visible) => {
  if (visible) {
    // Start with existing order, or empty if none
    orderedReplies.value = (props.existingReplyOrder || []).slice();
  }
});

// Available replies (those not yet in order, or all if none ordered)
const availableReplies = computed(() => {
  const ordered = new Set(orderedReplies.value);
  const replies = (props.childIds || []).filter(id => !ordered.has(id));
  const replySet = new Set(props.childIds || []);
  const stitches = (props.stitchChildIds || []).filter(id => !ordered.has(id) && !replySet.has(id));
  return [...replies, ...stitches];
});

// Check if reply is already in order
const isInOrder = (replyId) => {
  return orderedReplies.value.includes(replyId);
};

// Get reply preview text
const getReplyPreview = (replyId) => {
  const message = store.getters['messages/getMessage'](replyId);
  if (!message) return 'Loading...';
  
  const content = contentText(message.content);
  if (content.length <= 50) return content;
  return content.substring(0, 50) + '...';
};

// Add reply to order
const addToOrder = (replyId) => {
  if (isInOrder(replyId) || isUpdating.value) return;
  orderedReplies.value.push(replyId);
};

// Remove reply from order
const removeFromOrder = (index) => {
  if (index < 0 || index >= orderedReplies.value.length || isUpdating.value) return;
  orderedReplies.value.splice(index, 1);
};

// Move reply up in order
const moveUp = (index) => {
  if (index <= 0 || index >= orderedReplies.value.length || isUpdating.value) return;
  const temp = orderedReplies.value[index];
  orderedReplies.value[index] = orderedReplies.value[index - 1];
  orderedReplies.value[index - 1] = temp;
};

// Move reply down in order
const moveDown = (index) => {
  if (index < 0 || index >= orderedReplies.value.length - 1 || isUpdating.value) return;
  const temp = orderedReplies.value[index];
  orderedReplies.value[index] = orderedReplies.value[index + 1];
  orderedReplies.value[index + 1] = temp;
};

// Clear order
const clearOrder = () => {
  if (isUpdating.value) return;
  orderedReplies.value = [];
};

// Check if order has changed
const hasChanges = computed(() => {
  const existing = props.existingReplyOrder || [];
  const current = orderedReplies.value;
  
  if (existing.length !== current.length) return true;
  
  for (let i = 0; i < existing.length; i++) {
    if (existing[i] !== current[i]) return true;
  }
  
  return false;
});

// Save order
const handleSave = async () => {
  if (isUpdating.value || !hasChanges.value) return;
  
  isUpdating.value = true;
  try {
    // If order is empty, send null to clear custom ordering
    const orderToSave = orderedReplies.value.length > 0 ? orderedReplies.value : null;
    
    emit('update', { messageId: props.messageId, replyOrder: orderToSave });
    
    // Wait a bit for the backend to respond
    await new Promise(resolve => setTimeout(resolve, 300));
  } catch (e) {
    console.error('Failed to update reply order:', e);
    store.commit('ui/SET_ERROR', 'Failed to update reply order');
  } finally {
    isUpdating.value = false;
  }
};

const closeModal = () => {
  isClosing.value = true;
  setTimeout(() => {
    isClosing.value = false;
    emit('close');
  }, 150);
};

onMounted(() => {
  if (props.isVisible) {
    orderedReplies.value = (props.existingReplyOrder || []).slice();
  }
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex; justify-content: center; align-items: center;
  z-index: 1001; padding: 20px;
}
.modal-overlay.closing { animation: quick-fade-out 150ms ease forwards; }

.reply-order-modal {
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 0; min-width: 400px; max-width: 600px; width: 100%;
  max-height: 70vh; display: flex; flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px 12px; border-bottom: 1px solid var(--color-border); }
.modal-header h3 { margin: 0; font-size: var(--font-size-lg); font-weight: 600; color: var(--color-text); }
.close-button { background: none; border: none; color: var(--color-text-secondary); font-size: 24px; cursor: pointer; padding: 4px; line-height: 1; }
.close-button:hover { color: var(--color-error); }

.modal-content { padding: 16px 20px; flex: 1; min-height: 0; overflow-y: auto; }
.modal-description { margin: 0 0 16px 0; color: var(--color-text-secondary); font-size: var(--font-size-sm); }

.order-section { margin-bottom: 24px; }
.section-title { margin: 0 0 12px 0; font-size: var(--font-size-base); font-weight: 600; color: var(--color-text); display: flex; align-items: center; gap: 8px; }
.section-subtitle { font-weight: 400; color: var(--color-text-secondary); font-size: var(--font-size-sm); }

.ordered-list { display: flex; flex-direction: column; gap: 8px; }
.ordered-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-md);
  background-color: var(--color-surface-light, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--color-border);
  transition: background-color 0.2s ease;
}
.ordered-item:hover { background-color: var(--color-surface-hover, rgba(0, 0, 0, 0.04)); }

.order-number {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.reply-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.reply-id {
  font-size: var(--font-size-sm);
  font-family: monospace;
  color: var(--color-text-secondary);
  font-weight: 500;
}
.reply-preview {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-actions {
  display: flex;
  gap: 4px;
}
.order-btn {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
  min-width: 32px;
}
.order-btn:hover:not(:disabled) {
  background-color: var(--color-surface-hover);
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.order-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.remove-btn:hover:not(:disabled) {
  background-color: var(--color-error-light, rgba(255, 59, 48, 0.1));
  border-color: var(--color-error);
  color: var(--color-error);
}

.available-section { margin-bottom: 16px; }
.available-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}
.available-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background-color: var(--color-surface-light, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
}
.available-item:hover:not(:disabled) {
  background-color: var(--color-surface-hover, rgba(0, 0, 0, 0.04));
  border-color: var(--color-primary);
}
.available-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.available-item.in-order {
  background-color: var(--color-success-light, rgba(34, 197, 94, 0.1));
  border-color: var(--color-success);
}
.available-item .reply-info {
  flex: 1;
}
.added-indicator {
  color: var(--color-success);
  font-weight: bold;
  font-size: 18px;
}

.no-replies {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-style: italic;
  padding: 20px;
  text-align: center;
}

.clear-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}
.clear-button {
  width: 100%;
  padding: 10px 16px;
  background-color: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}
.clear-button:hover:not(:disabled) {
  background-color: var(--color-surface-hover);
  border-color: var(--color-error);
  color: var(--color-error);
}
.clear-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.modal-footer {
  padding: 12px 20px 16px;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.cancel-button, .save-button {
  padding: 10px 16px;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}
.cancel-button {
  background-color: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}
.cancel-button:hover {
  background-color: var(--color-surface-hover);
}
.save-button {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
}
.save-button:hover:not(:disabled) {
  background-color: var(--color-primary-dark, #4f8cff);
}
.save-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes quick-fade-out { 0% { opacity: 1; } 100% { opacity: 0; } }

@media (max-width: 768px) {
  .modal-overlay { padding: 10px; }
  .reply-order-modal { min-width: unset; max-height: 90vh; }
}
</style>

