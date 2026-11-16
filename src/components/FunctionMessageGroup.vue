<template>
  <div class="function-group" :class="{ compact, 'is-collapsed': !expanded }">
    <div v-if="!expanded" class="function-group-collapsed">
      <button
        v-if="showSiblingHint"
        type="button"
        class="group-sibling-hint"
        :class="{ 'is-available': hasPrevSibling }"
        :title="hasPrevSibling ? 'A function in this group has a previous reply' : 'Expand'"
        aria-label="Expand"
        @click="emit('expand')"
      >
        <svg class="hint-chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M10 3.5 L5 8 L10 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        class="function-group-toggle"
        aria-expanded="false"
        :aria-label="collapsedAriaLabel"
        @click="emit('expand')"
      >
        <svg class="chevron" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M6 3.5 L11 8 L6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>{{ label }}</span>
      </button>
      <button
        v-if="showSiblingHint"
        type="button"
        class="group-sibling-hint"
        :class="{ 'is-available': hasNextSibling }"
        :title="hasNextSibling ? 'A function in this group has a next reply' : 'Expand'"
        aria-label="Expand"
        @click="emit('expand')"
      >
        <svg class="hint-chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 3.5 L11 8 L6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
    <template v-else>
      <button
        type="button"
        class="function-group-toggle"
        aria-expanded="true"
        @click="emit('collapse')"
      >
        <svg class="chevron" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" style="transform: rotate(90deg)">
          <path d="M6 3.5 L11 8 L6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>Collapse</span>
      </button>
      <div class="function-group-items">
        <slot />
      </div>
      <button
        type="button"
        class="function-group-toggle function-group-toggle--below"
        aria-expanded="true"
        @click="emit('collapse')"
      >
        <svg class="chevron" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" style="transform: rotate(-90deg)">
          <path d="M6 3.5 L11 8 L6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>Collapse</span>
      </button>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  label: { type: String, required: true },
  expanded: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  showSiblingHint: { type: Boolean, default: false },
  hasPrevSibling: { type: Boolean, default: false },
  hasNextSibling: { type: Boolean, default: false },
});

const emit = defineEmits(['expand', 'collapse']);

const collapsedAriaLabel = computed(() => {
  if (!props.hasPrevSibling && !props.hasNextSibling) return undefined;
  return `${props.label}. A function in this group has another reply. Expand to switch.`;
});
</script>

<style scoped>
.function-group {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.function-group.is-collapsed {
  width: max-content;
  max-width: 100%;
  align-self: center;
}

.function-group-collapsed {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
}

.group-sibling-hint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex: none;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  opacity: 0.35;
  cursor: pointer;
}

.group-sibling-hint:hover {
  background: transparent;
  color: var(--color-text);
  opacity: 1;
}

.group-sibling-hint.is-available {
  color: var(--color-text);
  opacity: 1;
}

.hint-chevron {
  width: 14px;
  height: 14px;
  display: block;
}

.function-group.compact {
  gap: 8px;
}

.function-group-items {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.function-group.compact .function-group-items {
  gap: 8px;
}

.function-group-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  flex: none;
  gap: 6px;
  width: max-content;
  max-width: 100%;
  min-height: 28px;
  margin: 0;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 0.9rem;
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
}

.function-group-toggle:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-text);
}

.chevron {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--color-text-secondary);
}
</style>
