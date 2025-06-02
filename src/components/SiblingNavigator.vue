<template>
  <div class="sibling-navigator">
    <button 
      @click.stop="navigate('prev')" 
      class="nav-button nav-prev"
      :class="{ 'disabled': !canNavigatePrev, 'loading': isLoading }"
      :disabled="!canNavigatePrev || isLoading"
      title="Previous reply"
    >
      <div v-if="isLoading" class="loading-dot"></div>
      <div v-else class="triangle-icon left-triangle"></div>
    </button>
    
    <button 
      @click.stop="navigate('next')" 
      class="nav-button nav-next"
      :class="{ 'disabled': !canNavigateNext, 'loading': isLoading }"
      :disabled="!canNavigateNext || isLoading" 
      title="Next reply"
    >
      <div v-if="isLoading" class="loading-dot"></div>
      <div v-else class="triangle-icon right-triangle"></div>
    </button>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useStore } from 'vuex';

const props = defineProps({
  messageId: {
    type: [Number, String],
    required: true
  },
  parentId: {
    type: [Number, String],
    required: true
  }
});

const emit = defineEmits(['navigate']);

const store = useStore();

// Internal loading state based on parent existence
const isParentLoading = computed(() => {
  // If parent ID doesn't exist or message doesn't exist, we're not loading
  if (!props.parentId) return false;
  
  // Check if parent exists in the store
  const parent = store.getters['messages/getMessage'](props.parentId);
  
  // If parent doesn't exist, we're loading
  return !parent;
});

// Check if siblings are currently loading
const isSiblingLoading = computed(() => {
  return store.getters['messages/isLoading'](`sibling_${props.parentId}`);
});

// Combined loading state
const isLoading = computed(() => {
  return isParentLoading.value || isSiblingLoading.value;
});

// Get message siblings from the store
const siblings = computed(() => {
  const parent = store.getters['messages/getMessage'](props.parentId);
  if (!parent || !parent.child_ids || !Array.isArray(parent.child_ids)) {
    return [];
  }
  return parent.child_ids;
});

const totalSiblings = computed(() => siblings.value.length);

// Find current message position in siblings array (0-indexed)
const currentPosition = computed(() => {
  if (isLoading.value || !siblings.value || !siblings.value.length) return 0;
  
  const childIds = siblings.value;
  const branchChild = store.getters['messages/getBranchChild'](props.parentId);
  
  if (!branchChild) return 1; // Default to first position if no branch child
  
  const position = childIds.indexOf(branchChild);
  return position === -1 ? 1 : position + 1;
});

// Navigation availability
const canNavigatePrev = computed(() => {
  if (isLoading.value) return false;
  return siblings.value.length > 1 && currentPosition.value > 1;
});

const canNavigateNext = computed(() => {
  if (isLoading.value) return false;
  return siblings.value.length > 1 && currentPosition.value < siblings.value.length;
});

// Navigation handler
const navigate = async (direction) => {
  if (isLoading.value) return;
  
  try {
    // Call the central store action for sibling navigation
    const success = await store.dispatch('messages/navigateToSibling', {
      messageId: props.parentId,
      direction: direction
    });
    
    if (success) {
      // Get the new branch child after navigation
      const newBranchChild = store.getters['messages/getBranchChild'](props.parentId);
      
      // Emit event with new target sibling
      emit('navigate', {
        direction,
        targetSiblingId: newBranchChild,
        parentId: props.parentId
      });
    }
  } catch (error) {
    console.error("Error navigating to sibling:", error);
  }
};
</script>

<style scoped>
.sibling-navigator {
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 50px;
  pointer-events: none;
  z-index: 5;
  transform: translateY(-50%);
}

/* Mobile styles for sibling navigator */
@media (max-width: 768px) {
  .sibling-navigator {
    top: auto;
    bottom: 70px; /* Adjusted to better align with the reply count text */
    transform: none;
    height: 32px; /* Match the height to the buttons */
  }
  
  .nav-button {
    width: 32px;
    height: 32px;
    top: -5px; /* Slight adjustment to align precisely */
  }
  
  .left-triangle {
    border-width: 6px 9px 6px 0;
  }
  
  .right-triangle {
    border-width: 6px 0 6px 9px;
  }
}

.nav-button {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--color-text);
  transition: all var(--transition-fast);
  padding: 0;
  line-height: 1;
  pointer-events: auto; /* Re-enable pointer events for buttons */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transform: none;
}

.nav-prev {
  left: -10px; /* Flush against the left side */
  border-top-right-radius: 7px;
  border-bottom-right-radius: 7px;
}

.nav-next {
  right: -10px; /* Flush against the right side */
  border-top-left-radius: 7px;
  border-bottom-left-radius: 7px;
}

/* Triangle icon styling */
.triangle-icon {
  width: 0;
  height: 0;
  border-style: solid;
}

.left-triangle {
  border-width: 8px 12px 8px 0;
  border-color: transparent var(--color-text-secondary) transparent transparent;
}

.right-triangle {
  border-width: 8px 0 8px 12px;
  border-color: transparent transparent transparent var(--color-text-secondary);
}

/* Hover styles - not disabled */
.nav-button:hover:not(:disabled) {
  background-color: var(--color-primary-light);
  border-color: var(--color-primary);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
  transform: none;
}

.nav-button:hover:not(:disabled) .left-triangle {
  border-color: transparent var(--color-primary) transparent transparent;
}

.nav-button:hover:not(:disabled) .right-triangle {
  border-color: transparent transparent transparent var(--color-primary);
}

/* Active (non-disabled) styling with gradient connection */
.nav-button:not(.disabled):not(:disabled) {
  border-color: var(--color-border);
}

.nav-button.nav-prev:not(.disabled):not(:disabled) {
  background: linear-gradient(to right, var(--color-surface), var(--color-primary-light, #e6f0ff));
}

.nav-button.nav-next:not(.disabled):not(:disabled) {
  background: linear-gradient(to left, var(--color-surface), var(--color-primary-light, #e6f0ff));
}

.nav-button.nav-prev:not(.disabled):not(:disabled) .left-triangle {
  border-color: transparent var(--color-primary) transparent transparent;
}

.nav-button.nav-next:not(.disabled):not(:disabled) .right-triangle {
  border-color: transparent transparent transparent var(--color-primary);
}

/* Disabled state - slightly transparent */
.nav-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-primary);
  animation: pulse 1.5s infinite;
}

.nav-button.loading {
  cursor: wait;
}

@keyframes pulse {
  0% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.1); }
  100% { opacity: 0.3; transform: scale(0.8); }
}

/* Dark theme styles are no longer needed as we're using CSS variables */
</style> 