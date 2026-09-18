<template>
  <button
    type="button"
    class="compact-action-button"
    :class="[
      {
        active: isActive,
        disabled: isDisabled
      },
      customClass
    ]"
    :disabled="isDisabled"
    :title="action.text"
    @click.stop="onClick"
  >
    <span v-if="isLoading" class="loading-indicator"></span>
    <span v-else class="action-emoji">{{ action.emoji }}</span>
    <span v-if="showText" class="action-text">{{ action.text }}</span>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  action: { type: Object, required: true },
  showText: { type: Boolean, default: true }
})

const isActive = computed(() => !!props.action.active?.())
const isDisabled = computed(() => !!props.action.disabled?.())
const isLoading = computed(() => !!props.action.loading?.())
const customClass = computed(() => props.action.customClass?.() || '')

const onClick = () => {
  if (isDisabled.value) return
  props.action.handler?.()
}
</script>

<style scoped>
.compact-action-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  border-radius: 6px;
  padding: 6px 8px;
  min-height: 32px;
  font-size: var(--font-size-xs);
  cursor: pointer;
  color: var(--color-text-secondary);
  line-height: 1.2;
  white-space: nowrap;
}

.compact-action-button:hover:not(:disabled) {
  background-color: var(--color-surface-hover);
  color: var(--color-primary);
}

.compact-action-button.active {
  background-color: var(--color-primary-light, #bdbdbd);
  color: var(--color-text);
}

.compact-action-button:disabled,
.compact-action-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-indicator {
  width: 10px;
  height: 10px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: compact-spin 0.8s linear infinite;
}

@keyframes compact-spin {
  to { transform: rotate(360deg); }
}
</style>
