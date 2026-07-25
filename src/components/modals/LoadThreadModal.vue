<template>
  <div v-if="isVisible" class="modal-overlay" @click.self="closeModal">
    <div class="load-thread-modal">
      <div class="modal-header">
        <h3>Load Thread</h3>
        <button class="close-button" @click.stop="closeModal">×</button>
      </div>

      <div class="modal-content">
        <p class="modal-description">Select a thread root to load into the graph view.</p>
        <div class="history-list-container">
          <MessageList
            mode="history"
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
  isVisible: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'select']);

const closeModal = () => {
  emit('close');
};

const handleMessageSelect = (messageId) => {
  console.log('[LoadThreadModal] Message selected:', messageId);
  emit('select', messageId);
  closeModal();
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.load-thread-modal {
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

.history-list-container {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

/* Custom scrollbar for the container */
.history-list-container::-webkit-scrollbar {
  width: 8px;
}

.history-list-container::-webkit-scrollbar-track {
  background: var(--color-scrollbar-track);
}

.history-list-container::-webkit-scrollbar-thumb {
  background: var(--color-scrollbar-thumb);
  border-radius: var(--radius-sm);
}
</style>
