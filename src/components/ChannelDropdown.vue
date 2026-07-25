<template>
  <div class="channel-dropdown" ref="dropdownRef">
    <button
      class="channel-dropdown-trigger"
      type="button"
      @click.stop="toggleMenu"
      :aria-expanded="showMenu.toString()"
      :disabled="disabled"
    >
      <span>{{ displayLabel }}</span>
      <span class="icon" aria-hidden="true">{{ showMenu ? '▲' : '▼' }}</span>
    </button>

    <div
      v-if="showMenu"
      class="channel-dropdown-menu"
      ref="menuRef"
      role="listbox"
    >
      <div
        v-for="channel in availableChannels"
        :key="channel.id"
        class="channel-dropdown-item"
        :class="{ disabled: isChannelSelected(channel.id) }"
        role="option"
        :aria-disabled="isChannelSelected(channel.id).toString()"
        @click="handleSelect(channel, $event)"
      >
        <span class="channel-item-name">📢 {{ channel.display_name }}</span>
        <span v-if="channel.is_admin" class="channel-item-admin">Admin</span>
      </div>
      <div v-if="!availableChannels.length" class="channel-dropdown-empty">No channels available</div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps({
  availableChannels: {
    type: Array,
    default: () => []
  },
  selectedChannelIds: {
    type: Array,
    default: () => []
  },
  placeholder: {
    type: String,
    default: 'Select a channel...'
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['select']);

const showMenu = ref(false);
const dropdownRef = ref(null);
const menuRef = ref(null);

const displayLabel = computed(() => {
  return props.placeholder;
});

const isChannelSelected = (channelId) => {
  return props.selectedChannelIds.includes(channelId);
};

const closeMenu = () => {
  showMenu.value = false;
};

const handleSelect = (channel, event) => {
  if (isChannelSelected(channel.id)) return;

  // Stop event propagation immediately to prevent it from reaching modal overlay
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  emit('select', channel);
  closeMenu();
};

const toggleMenu = () => {
  if (showMenu.value) {
    closeMenu();
  } else {
    showMenu.value = true;
    nextTick(() => {
      // Keep refs resolved for click-outside.
    });
  }
};

const handleClickOutside = (event) => {
  if (!dropdownRef.value) return;
  if (!showMenu.value) return;

  const isDropdownItem = event.target?.closest('.channel-dropdown-item');
  if (isDropdownItem) return;

  const dropdownElement = dropdownRef.value;
  const menuElement = menuRef.value;
  const clickedInsideDropdown = dropdownElement.contains(event.target);
  const clickedInsideMenu = menuElement && menuElement.contains(event.target);

  if (!clickedInsideDropdown && !clickedInsideMenu) {
    closeMenu();
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.channel-dropdown {
  position: relative;
  width: 100%;
}

.channel-dropdown-trigger {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-input-bg, var(--color-surface));
  color: var(--color-text);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: all 0.2s ease;
}

.channel-dropdown-trigger:hover:not(:disabled) {
  border-color: var(--color-primary);
}

.channel-dropdown-trigger:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb, 79, 140, 255), 0.2);
}

.channel-dropdown-trigger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.icon {
  font-size: 10px;
  color: var(--color-text-secondary);
  margin-left: 8px;
}

.channel-dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  max-height: 300px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}

.channel-dropdown-item {
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
  transition: background-color 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.channel-dropdown-item:hover:not(.disabled) {
  background-color: var(--color-surface-hover, rgba(255, 255, 255, 0.05));
}

.channel-dropdown-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  font-style: italic;
}

.channel-item-name {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: 500;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-item-admin {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
}

.channel-dropdown-empty {
  padding: 16px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-style: italic;
}
</style>
