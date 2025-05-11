<template>
  <div class="sibling-navigator">
    <button 
      @click.stop="navigate('prev')" 
      class="nav-button nav-prev"
      :class="{ 'disabled': !canNavigatePrev, 'loading': isParentLoading }"
      :disabled="!canNavigatePrev || isParentLoading"
      title="Previous reply"
    >
      <div v-if="isParentLoading" class="loading-dot"></div>
      <template v-else>&lt;</template>
    </button>
    
    <button 
      @click.stop="navigate('next')" 
      class="nav-button nav-next"
      :class="{ 'disabled': !canNavigateNext, 'loading': isParentLoading }"
      :disabled="!canNavigateNext || isParentLoading" 
      title="Next reply"
    >
      <div v-if="isParentLoading" class="loading-dot"></div>
      <template v-else>&gt;</template>
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
  if (isParentLoading.value || !siblings.value || !siblings.value.length) return 0;
  
  const childIds = siblings.value;
  const branchChild = store.getters['messages/getBranchChild'](props.parentId);
  
  if (!branchChild) return 1; // Default to first position if no branch child
  
  const position = childIds.indexOf(branchChild);
  return position === -1 ? 1 : position + 1;
});

// Navigation availability
const canNavigatePrev = computed(() => {
  if (isParentLoading.value) return false;
  return siblings.value.length > 1 && currentPosition.value > 1;
});

const canNavigateNext = computed(() => {
  if (isParentLoading.value) return false;
  return siblings.value.length > 1 && currentPosition.value < siblings.value.length;
});

// Navigation handler
const navigate = (direction) => {
  if (isParentLoading.value) return;
  
  // Call the central store action for sibling navigation
  const success = store.dispatch('messages/navigateToSibling', {
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
};
</script>

<style scoped>
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
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background-color: var(--card-background, #f5f5f5);
  border: 1px solid var(--border-color, #ddd);
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-color, #333);
  transition: all 0.2s ease;
  padding: 0;
  line-height: 1;
  pointer-events: auto; /* Re-enable pointer events for buttons */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.nav-prev {
  left: -40px;
}

.nav-next {
  right: -40px;
}

.nav-button:hover:not(:disabled) {
  background-color: var(--primary-color-light, #e6f2ff);
  border-color: var(--primary-color, #4a90e2);
  color: var(--primary-color, #4a90e2);
  transform: translateY(-50%) scale(1.1);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
}

.nav-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--primary-color, #4a90e2);
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

@media (prefers-color-scheme: dark) {
  .nav-button {
    background-color: var(--card-background-dark, #333);
    border-color: var(--border-color-dark, #444);
    color: var(--text-color-dark, #eee);
  }
  
  .nav-button:hover:not(:disabled) {
    background-color: var(--primary-color-dark, #1a3b66);
    border-color: var(--primary-color-dark, #2c5894);
    color: var(--text-color-dark, #eee);
  }
}
</style> 