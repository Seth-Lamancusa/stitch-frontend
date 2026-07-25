<template>
  <div class="tag-dropdown" ref="dropdownRef">
    <button
      class="tag-dropdown-trigger"
      type="button"
      @click.stop="toggleMenu"
      :aria-expanded="showMenu.toString()"
    >
      <span>{{ displayLabel }}</span>
      <span class="icon" aria-hidden="true">{{ showMenu ? '▲' : '▼' }}</span>
    </button>
    <div
      v-if="showMenu"
      class="tag-dropdown-menu"
      ref="menuRef"
      role="listbox"
    >
      <div
        v-for="tag in availableTags"
        :key="tag"
        class="tag-dropdown-item"
        :class="{ disabled: isTagSelected(tag) }"
        role="option"
        :aria-disabled="isTagSelected(tag).toString()"
        @click="handleSelect(tag)"
      >
        #{{ tag }}
      </div>
      <div v-if="!availableTags.length" class="tag-dropdown-empty">No tags available</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  availableTags: {
    type: Array,
    default: () => [],
  },
  selectedTags: {
    type: Array,
    default: () => [],
  },
  placeholder: {
    type: String,
    default: 'All tags',
  },
  selectedLabel: {
    type: String,
    default: 'Selected tags',
  },
  logLabel: {
    type: String,
    default: 'TagDropdown',
  },
});

const emit = defineEmits(['select']);

const showMenu = ref(false);
const dropdownRef = ref(null);
const menuRef = ref(null);

const displayLabel = computed(() => {
  return props.selectedTags.length ? props.selectedLabel : props.placeholder;
});

const normalizedSelectedTags = computed(() =>
  props.selectedTags.map((tag) => (tag || '').toString().toLowerCase())
);

const isTagSelected = (tag) => {
  const normalized = (tag || '').toString().toLowerCase();
  return normalizedSelectedTags.value.includes(normalized);
};

const logMenuMetrics = () => {
  if (!menuRef.value) return;
  const el = menuRef.value;
  console.log(`[${props.logLabel}] dropdown metrics`, {
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    offsetHeight: el.offsetHeight,
  });
};

const openMenu = () => {
  if (showMenu.value) return;
  showMenu.value = true;
  nextTick(() => logMenuMetrics());
};

const closeMenu = () => {
  showMenu.value = false;
};

const toggleMenu = () => {
  if (showMenu.value) {
    closeMenu();
  } else {
    openMenu();
  }
};

const handleSelect = (tag) => {
  if (isTagSelected(tag)) return;
  emit('select', tag);
  closeMenu();
};

const handleClickOutside = (event) => {
  if (!dropdownRef.value) return;
  if (!dropdownRef.value.contains(event.target)) {
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
.tag-dropdown {
  position: relative;
  min-width: 150px;
}

.tag-dropdown-trigger {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background-color: var(--color-surface);
  color: var(--color-text);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.tag-dropdown-trigger:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb, 79, 140, 255), 0.25);
}

.icon {
  font-size: 10px;
}

.tag-dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  max-height: 250px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}

.tag-dropdown-item {
  padding: 8px 12px;
  cursor: pointer;
}

.tag-dropdown-item:hover {
  background-color: var(--color-surface-hover, rgba(0, 0, 0, 0.05));
}

.tag-dropdown-item.disabled {
  color: var(--color-text-secondary);
  cursor: not-allowed;
}

.tag-dropdown-empty {
  padding: 8px 12px;
  color: var(--color-text-secondary);
}
</style>

