<template>
  <div v-if="show" class="modal-overlay" @click.stop="requestClose" @keydown.esc.stop="requestClose">
    <div class="modal-container" role="dialog" aria-modal="true" aria-labelledby="save-default-title" @click.stop>
      <div class="modal-header">
        <h3 id="save-default-title">Save default thread</h3>
        <button type="button" class="close-button" aria-label="Close" :disabled="saving" @click.stop="requestClose">×</button>
      </div>

      <div class="modal-content">
        <p class="prompt">Save the messages on screen as the default thread?</p>
        <fieldset class="directions" :disabled="saving">
          <legend class="sr-only">Which links to save</legend>
          <label class="direction">
            <input v-model="direction" type="radio" value="both" />
            <span>Both directions</span>
          </label>
          <label class="direction">
            <input v-model="direction" type="radio" value="incoming" />
            <span>Incoming only</span>
          </label>
          <label class="direction">
            <input v-model="direction" type="radio" value="outgoing" />
            <span>Outgoing only</span>
          </label>
        </fieldset>
        <p v-if="error" class="save-error">{{ error }}</p>
      </div>

      <div class="modal-footer">
        <button type="button" class="cancel-btn" :disabled="saving" @click.stop="requestClose">Cancel</button>
        <button type="button" class="save-btn" :disabled="saving" @click.stop="confirm">
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';

const props = defineProps({
  show: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  error: { type: String, default: '' },
});

const emit = defineEmits(['cancel', 'confirm']);

const direction = ref('both');

const requestClose = () => {
  if (props.saving) return;
  emit('cancel');
};

const confirm = () => {
  if (props.saving) return;
  emit('confirm', direction.value);
};

const onKeydown = (event) => {
  if (event.key === 'Escape' && props.show) requestClose();
};

watch(() => props.show, (open) => {
  if (open) {
    direction.value = 'both';
    window.addEventListener('keydown', onKeydown);
  } else {
    window.removeEventListener('keydown', onKeydown);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--z-index-modal);
  backdrop-filter: blur(2px);
  padding: var(--space-md);
}

.modal-container {
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  width: 100%;
  max-width: 340px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.modal-header {
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-sm);
}

.modal-header h3 {
  margin: 0;
  font-size: var(--font-size-md);
  color: var(--color-text);
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  font-size: var(--font-size-xl);
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: 0;
  border-radius: var(--radius-sm);
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

.modal-content {
  padding: var(--space-md);
}

.prompt {
  margin: 0 0 var(--space-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.directions {
  margin: 0;
  padding: 0;
  border: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.direction {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.direction input {
  margin: 0;
}

.save-error {
  margin: var(--space-sm) 0 0;
  color: var(--color-error);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.modal-footer {
  padding: var(--space-sm) var(--space-md);
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
}

.cancel-btn,
.save-btn {
  min-height: 32px;
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
}

.cancel-btn {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.cancel-btn:hover:not(:disabled) {
  background-color: var(--color-hover-overlay);
}

.save-btn {
  background-color: var(--color-accent);
  border: 1px solid var(--color-accent);
  color: var(--color-text-inverse, #fff);
}

.save-btn:hover:not(:disabled) {
  filter: brightness(1.05);
}

.cancel-btn:disabled,
.save-btn:disabled,
.close-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
