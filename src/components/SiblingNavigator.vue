<template>
  <!-- Mobile mode - render as inline buttons for footer -->
  <div v-if="mobileMode" class="mobile-sibling-nav">
    <button 
      @click.stop="navigate('prev')" 
      class="mobile-nav-btn mobile-nav-prev"
      :class="{ 'disabled': !canNavigatePrev, 'loading': isLoading }"
      :disabled="!canNavigatePrev || isLoading"
      title="Previous reply"
    >
      <div v-if="isLoading" class="loading-dot"></div>
      <div v-else class="arrow-icon left-arrow">←</div>
    </button>
    
    <button 
      @click.stop="navigate('next')" 
      class="mobile-nav-btn mobile-nav-next"
      :class="{ 'disabled': !canNavigateNext, 'loading': isLoading }"
      :disabled="!canNavigateNext || isLoading" 
      title="Next reply"
    >
      <div v-if="isLoading" class="loading-dot"></div>
      <div v-else class="arrow-icon right-arrow">→</div>
    </button>
  </div>
  
  <!-- Desktop mode - original positioning -->
  <div v-else class="sibling-navigator">
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
import { computed, ref, watch } from 'vue';
import { useStore } from 'vuex';

const props = defineProps({
  messageId: {
    type: [Number, String],
    required: true
  },
  parentId: {
    type: [Number, String],
    required: true
  },
  mobileMode: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['navigate']);

const store = useStore();

// Internal loading state based on parent existence (original behavior)
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

// Debug logging to trace flicker root cause
const parentRef = computed(() => store.getters['messages/getMessage'](props.parentId));
watch(parentRef, (newVal, oldVal) => {
  console.debug('[SiblingNavigator] parent change', {
    parentId: props.parentId,
    hadParent: !!oldVal,
    hasParent: !!newVal,
    childIds: Array.isArray(newVal?.child_ids) ? [...newVal.child_ids] : null
  });
});

watch(isSiblingLoading, (v) => {
  console.debug('[SiblingNavigator] sibling loading changed', {
    parentId: props.parentId,
    key: `sibling_${props.parentId}`,
    isSiblingLoading: v
  });
});

watch(isParentLoading, (v) => {
  console.debug('[SiblingNavigator] parent loading changed', {
    parentId: props.parentId,
    isParentLoading: v
  });
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
    // Clear any active reply box when navigating between siblings
    store.dispatch('navigation/clearReplyingTo');
    
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
/* Mobile navigation styles - styled like action-hint-button */
.mobile-sibling-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mobile-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xs);
  padding: 8px;
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--color-text-secondary);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  opacity: 1; /* Make clickable buttons fully visible */
  min-width: 36px;
  min-height: 36px;
}

/* Make active/clickable buttons more prominent - bright arrows, subtle border */
.mobile-nav-btn:not(.disabled):not(.loading) {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border); /* Keep border subtle */
  color: var(--color-primary); /* Bright arrow color */
  opacity: 1;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
}

.mobile-nav-btn:hover:not(:disabled) {
  opacity: 1;
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-hover);
  color: var(--color-primary);
  transform: scale(1.1);
}

.mobile-nav-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.mobile-nav-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.mobile-nav-btn.loading {
  cursor: wait;
}

.arrow-icon {
  font-size: 16px;
  line-height: 1;
  font-weight: bold;
}

/* Smaller buttons for very small screens */
@media (max-width: 480px) {
  .mobile-nav-btn {
    padding: 6px;
    min-width: 32px;
    min-height: 32px;
  }
  
  .arrow-icon {
    font-size: 14px;
  }
}

/* Desktop navigation styles */
.sibling-navigator {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
}



.nav-button {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 38px;
  background-color: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text);
  transition: all var(--transition-fast);
  padding: 0;
  line-height: 1;
  pointer-events: auto; /* Re-enable pointer events for buttons */
  z-index: 10; /* Ensure buttons are above other content */
}

.nav-button::before {
  content: '';
  position: absolute;
  top: 0;
  width: 38px; /* Match button width */
  bottom: 0;
  background-color: transparent;
  transition: background-color var(--transition-fast);
  border-radius: var(--radius-md);
}

/* Position the background for each side */
.nav-prev::before {
  left: 0;
}

.nav-next::before {
  right: 0;
}

.nav-button:hover::before {
  background-color: var(--color-primary-light, rgba(0, 123, 255, 0.1));
}

.nav-button::after {
  content: '';
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  width: 32px;
  height: 32px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all var(--transition-fast);
  z-index: -1;
}

.nav-button:hover::after {
  background-color: var(--color-primary-light);
  border-color: var(--color-primary);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
}

.nav-prev {
  left: -10px; /* Flush against the left side */
}

.nav-prev::after {
  border-top-right-radius: 7px;
  border-bottom-right-radius: 7px;
  border-top-left-radius: var(--radius-md);
  border-bottom-left-radius: var(--radius-md);
}

.nav-next {
  right: -10px; /* Flush against the right side */
}

.nav-next::after {
  border-top-left-radius: 7px;
  border-bottom-left-radius: 7px;
  border-top-right-radius: var(--radius-md);
  border-bottom-right-radius: var(--radius-md);
}

/* Triangle icon styling */
.triangle-icon {
  width: 0;
  height: 0;
  border-style: solid;
  position: relative;
  top: 20px; /* Position at the top where the visual button is */
  z-index: 1;
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
.nav-button:hover:not(:disabled) .left-triangle {
  border-color: transparent var(--color-primary) transparent transparent;
}

.nav-button:hover:not(:disabled) .right-triangle {
  border-color: transparent transparent transparent var(--color-primary);
}

/* Active (non-disabled) styling with gradient connection */
.nav-button:not(.disabled):not(:disabled)::after {
  border-color: var(--color-border);
}

.nav-button.nav-prev:not(.disabled):not(:disabled)::after {
  background: linear-gradient(to right, var(--color-surface), var(--color-primary-light, #e6f0ff));
}

.nav-button.nav-next:not(.disabled):not(:disabled)::after {
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

.nav-button.disabled::after {
  opacity: 0.5;
}

.nav-button.disabled::before {
  display: none;
}

.loading-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-primary);
  animation: pulse 1.5s infinite;
  position: relative;
  top: 20px; /* Position at the top where the visual button is */
  z-index: 1;
}

.nav-button.loading {
  cursor: wait;
}

.nav-button.loading::before {
  display: none;
}

@keyframes pulse {
  0% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.1); }
  100% { opacity: 0.3; transform: scale(0.8); }
}


</style> 