<template>
  <span
    v-if="isBot"
    class="bot-version-indicator"
    :title="tooltip"
    aria-label="Bot version"
  >
    🤖
  </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  isBot: {
    type: Boolean,
    default: false
  },
  versionId: {
    type: String,
    default: null
  },
  availableVersions: {
    type: Array,
    default: () => []
  },
  defaultLabel: {
    type: String,
    default: 'default'
  }
});

const defaultVersionLabel = computed(() => {
  if (!Array.isArray(props.availableVersions) || props.availableVersions.length === 0) return props.defaultLabel;
  const defaultEntry = props.availableVersions.find(v => v && v.default === true);
  return defaultEntry?.label || props.availableVersions[0]?.label || props.defaultLabel;
});

const resolvedLabel = computed(() => {
  if (props.versionId) {
    const match = props.availableVersions.find(v => v && v.id === props.versionId);
    if (match?.label) return match.label;
  }
  return defaultVersionLabel.value;
});

const tooltip = computed(() => {
  if (!props.isBot) return '';
  return `Bot version: ${resolvedLabel.value}`;
});
</script>

<style scoped>
.bot-version-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 6px;
  flex-shrink: 0;
  font-size: 12px;
  line-height: 1;
  cursor: help;
}
</style>
