<template>
  <div v-if="isVisible" class="modal-overlay" @click.stop.self="closeModal">
    <div class="context-origin-modal" @click.stop>
      <div class="modal-header">
        <h3>Context origin</h3>
        <button class="close-button" @click.stop="closeModal" :disabled="saving">×</button>
      </div>

      <div class="modal-content">
        <p class="modal-description">Choose the message that starts this bot's context.</p>
        <div v-if="error" class="error-message">{{ error }}</div>
        <div class="history-list-container">
          <MessageList
            mode="saved"
            hide-header
            hide-info-box
            compact
            emitOnly
            @messageClicked="handleMessageSelect"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import MessageList from '../MessageList.vue';

const props = defineProps({
  isVisible: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  error: { type: String, default: '' }
});

const emit = defineEmits(['close', 'select']);

const closeModal = () => {
  if (props.saving) return;
  emit('close');
};

const handleMessageSelect = (messageId) => {
  if (props.saving || !messageId) return;
  emit('select', messageId);
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: calc(var(--z-index-modal) + 2);
}

.context-origin-modal {
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  width: 90%;
  max-width: 800px;
  height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  border: 1px solid var(--color-border);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--color-text);
  padding: 0;
}

.close-button:disabled {
  cursor: default;
  opacity: 0.5;
}

.modal-content {
  flex: 1;
  overflow-y: hidden;
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
}

.modal-description {
  margin-top: 0;
  margin-bottom: var(--space-md);
  color: var(--color-text-secondary);
}

.error-message {
  color: var(--color-error, #ef4444);
  margin-bottom: var(--space-sm);
}

.history-list-container {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding-top: var(--space-sm);
}
</style>
