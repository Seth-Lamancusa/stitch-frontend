<template>
  <div class="channel-select" ref="rootRef">
    <button
      type="button"
      class="channel-select-trigger"
      :aria-expanded="open.toString()"
      aria-haspopup="listbox"
      aria-label="Select a channel"
      @click.stop="toggle"
    >
      <span class="channel-select-label">{{ displayLabel }}</span>
      <span class="channel-select-caret" aria-hidden="true">{{ open ? '▲' : '▼' }}</span>
    </button>

    <div v-if="open" class="channel-select-menu" role="listbox" aria-label="Channels">
      <div class="channel-select-list">
        <button
          v-if="channels.length"
          type="button"
          class="channel-select-item"
          role="option"
          :aria-selected="(!selectedId).toString()"
          :class="{ selected: !selectedId }"
          @click.stop="choose('')"
        >
          <span class="channel-select-name">No channel</span>
        </button>

        <button
          v-for="channel in channels"
          :key="channelId(channel)"
          type="button"
          class="channel-select-item"
          role="option"
          :aria-selected="(channelId(channel) === selectedId).toString()"
          :class="{ selected: channelId(channel) === selectedId }"
          @click.stop="choose(channelId(channel))"
        >
          <span class="channel-select-name">{{ channel.display_name }}</span>
          <span v-if="channel.is_admin" class="channel-select-admin">Admin</span>
        </button>

        <div v-if="loading && !channels.length" class="channel-select-empty">Loading channels...</div>
        <div v-else-if="!channels.length" class="channel-select-empty">No channels yet</div>
      </div>

      <button
        v-if="canCreate"
        type="button"
        class="channel-select-create"
        @click.stop="create"
      >
        <span class="channel-select-plus" aria-hidden="true">+</span>
        Create channel
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps({
  channels: {
    type: Array,
    default: () => []
  },
  selectedId: {
    type: String,
    default: ''
  },
  loading: {
    type: Boolean,
    default: false
  },
  canCreate: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    default: 'Select a channel'
  }
});

const emit = defineEmits(['select', 'create']);

const open = ref(false);
const rootRef = ref(null);

const channelId = (channel) => channel?.id || channel?._key || '';

const selectedChannel = computed(() =>
  props.channels.find((channel) => channelId(channel) === props.selectedId)
);

const displayLabel = computed(() => {
  if (selectedChannel.value) return selectedChannel.value.display_name;
  if (props.loading && !props.channels.length) return 'Loading channels...';
  return props.placeholder;
});

const close = () => {
  open.value = false;
};

const toggle = () => {
  open.value = !open.value;
};

const choose = (id) => {
  emit('select', id || '');
  close();
};

const create = () => {
  close();
  emit('create');
};

const handleClickOutside = (event) => {
  if (!open.value || !rootRef.value) return;
  if (!rootRef.value.contains(event.target)) close();
};

const handleKeydown = (event) => {
  if (event.key === 'Escape' && open.value) close();
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.channel-select {
  position: relative;
  width: 100%;
  min-width: 0;
}

.channel-select-trigger {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-base);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s ease;
}

.channel-select-trigger:hover,
.channel-select-trigger[aria-expanded="true"] {
  border-color: var(--color-primary);
}

.channel-select-trigger:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb, 89, 137, 88), 0.15);
}

.channel-select-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-select-caret {
  font-size: 10px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.channel-select-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: var(--z-index-dropdown, 100);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.channel-select-list {
  max-height: 280px;
  overflow-y: auto;
}

.channel-select-item {
  width: 100%;
  padding: 10px 14px;
  border: none;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  text-align: left;
  font-size: var(--font-size-sm);
}

.channel-select-item:last-child {
  border-bottom: none;
}

.channel-select-item:hover {
  background: var(--color-surface-hover, rgba(255, 255, 255, 0.05));
}

.channel-select-item.selected {
  background: var(--color-primary-light, rgba(89, 137, 88, 0.22));
  font-weight: 600;
}

.channel-select-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-select-admin {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
}

.channel-select-empty {
  padding: 14px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.channel-select-create {
  width: 100%;
  padding: 12px 14px;
  border: none;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  text-align: left;
}

.channel-select-create:hover {
  background: var(--color-primary-light, rgba(89, 137, 88, 0.22));
}

.channel-select-plus {
  font-size: 16px;
  line-height: 1;
}

@media (max-width: 768px) {
  .channel-select-trigger {
    padding: 10px 12px;
    font-size: var(--font-size-sm);
  }
}
</style>
