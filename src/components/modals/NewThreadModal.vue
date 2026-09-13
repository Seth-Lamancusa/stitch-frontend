<template>
  <div v-if="show" class="modal-overlay" @click.stop="handleCancel">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h3>Create New</h3>
        <button class="close-button" @click.stop="handleCancel">×</button>
      </div>
      
      <div class="modal-content">
        <div class="action-buttons">
          <button class="action-btn primary" @click="handleNewThread">
            <span class="btn-icon">📝</span>
            <div class="btn-text">
              <span class="btn-title">New Thread</span>
              <span class="btn-desc">Start a fresh conversation</span>
            </div>
          </button>
          
          <button 
            v-if="canImport" 
            class="action-btn secondary" 
            @click="handleImport"
          >
            <span class="btn-icon">📥</span>
            <div class="btn-text">
              <span class="btn-title">Import Conversation</span>
              <span class="btn-desc">Import from Cursor text or Audio</span>
            </div>
          </button>
          
          <button 
            v-if="canCreateChannel" 
            class="action-btn secondary" 
            @click="handleCreateChannel"
          >
            <span class="btn-icon">📢</span>
            <div class="btn-text">
              <span class="btn-title">Create Channel</span>
              <span class="btn-desc">Create a new channel for group discussions</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useStore } from 'vuex';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'new-thread', 'import', 'create-channel']);

const store = useStore();

// Check scopes
const canImport = computed(() => {
  return store.getters['auth/hasAnyScope'](['msg.import.cursor', 'msg.import.audio']);
});

const canCreateChannel = computed(() => {
  return store.getters['auth/hasScope']('channels.create');
});

const handleCancel = () => {
  emit('close');
};

const handleNewThread = () => {
  emit('new-thread');
};

const handleImport = () => {
  emit('import');
};

const handleCreateChannel = () => {
  emit('create-channel');
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
  max-width: 450px;
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
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-secondary);
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-fast);
}

.action-btn:hover {
  background: var(--color-hover-overlay);
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  border-color: var(--color-primary);
}

.btn-icon {
  font-size: 24px;
}

.btn-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.btn-title {
  font-weight: 600;
  font-size: var(--font-size-md);
  color: var(--color-text);
}

.btn-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
</style>

