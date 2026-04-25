<template>
  <div
    class="bot-version-picker"
    :class="{ 'is-disabled': disabled, 'is-compact': compact }"
  >
    <select
      class="bot-version-select"
      :disabled="disabled"
      v-model="internalValue"
    >
      <option value="">Default</option>
      <option
        v-if="missingOptionValue"
        :value="missingOptionValue"
        style="display: none"
      >
        {{ missingOptionValue }}
      </option>
      <option v-for="v in availableVersions" :key="v.id" :value="v.id">
        {{ v.label }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  availableVersions: {
    type: Array,
    default: () => []
  },
  modelValue: {
    type: String,
    default: null
  },
  disabled: {
    type: Boolean,
    default: false
  },
  compact: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue']);

const defaultVersionId = computed(() => {
  const list = Array.isArray(props.availableVersions) ? props.availableVersions : [];
  if (list.length === 0) return null;
  const defaultEntry = list.find(v => v && v.default === true);
  return (defaultEntry && defaultEntry.id) || list[0]?.id || null;
});

const internalValue = computed({
  get() {
    const mv = props.modelValue ?? '';
    if (!mv) return '';
    if (defaultVersionId.value && mv === defaultVersionId.value) return '';
    return mv;
  },
  set(value) {
    emit('update:modelValue', value === '' ? null : value);
  }
});

const missingOptionValue = computed(() => {
  const list = Array.isArray(props.availableVersions) ? props.availableVersions : [];
  const mv = internalValue.value;
  if (!mv) return null;
  const ok = list.some(v => v && v.id === mv);
  return ok ? null : mv;
});
</script>

<style scoped>
.bot-version-picker {
  display: inline-flex;
  align-items: center;
  max-width: 30%;
  flex-shrink: 0;
}

.bot-version-picker.is-compact {
  max-width: 120px;
  flex-shrink: 1;
}

.bot-version-select {
  height: 28px;
  width: 100%;
  padding: 0 8px;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--color-border);
  background-color: var(--color-input-bg, var(--color-surface-light));
  color: var(--color-text);
  font-size: var(--font-size-xs, 12px);
  cursor: pointer;
  min-width: 96px;
}

.bot-version-picker.is-compact .bot-version-select {
  min-width: 72px;
}

.bot-version-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.bot-version-picker.is-disabled {
  opacity: 0.6;
}
</style>
