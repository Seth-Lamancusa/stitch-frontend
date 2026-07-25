<template>
  <!-- Mobile mode - render as inline buttons for footer -->
  <div v-if="mobileMode" class="mobile-sibling-nav">
    <button 
      @mouseover="logHover('prev')"
      @click.stop="navigate('prev')" 
      class="mobile-nav-btn mobile-nav-prev"
      :class="{ 'disabled': !canNavigatePrev, 'loading': isLoading, 'target-is-stitch': isPrevStitch }"
      :disabled="!canNavigatePrev || isLoading"
      title="Previous reply"
    >
      <div v-if="isLoading" class="loading-dot"></div>
      <div v-else class="arrow-icon left-arrow">←</div>
    </button>
    
    <button 
      @mouseover="logHover('next')"
      @click.stop="navigate('next')" 
      class="mobile-nav-btn mobile-nav-next"
      :class="{ 'disabled': !canNavigateNext, 'loading': isLoading, 'target-is-stitch': isNextStitch }"
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
      @mouseover="logHover('prev')"
      @click.stop="navigate('prev')" 
      class="nav-button nav-prev"
      :class="{ 'disabled': !canNavigatePrev, 'loading': isLoading, 'target-is-stitch': isPrevStitch }"
      :disabled="!canNavigatePrev || isLoading"
      :data-debug-stitch="isPrevStitch"
      title="Previous reply"
    >
      <div v-if="isLoading" class="loading-dot"></div>
      <div v-else class="triangle-icon left-triangle"></div>
    </button>
    
    <button 
      @mouseover="logHover('next')"
      @click.stop="navigate('next')" 
      class="nav-button nav-next"
      :class="{ 'disabled': !canNavigateNext, 'loading': isLoading, 'target-is-stitch': isNextStitch }"
      :disabled="!canNavigateNext || isLoading" 
      :data-debug-stitch="isNextStitch"
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

const nextSiblingId = computed(() => {
  if (!canNavigateNext.value) return null;
  // currentPosition is 1-indexed, so currentPosition.value is the index of the next item
  return siblings.value[currentPosition.value];
});

const prevSiblingId = computed(() => {
  if (!canNavigatePrev.value) return null;
  // currentPosition is 1-indexed, so currentPosition.value - 2 is the index of the prev item
  return siblings.value[currentPosition.value - 2];
});

const isNextStitch = computed(() => {
  if (!nextSiblingId.value) return false;
  const parent = store.getters['messages/getMessage'](props.parentId);
  return parent && parent.stitch_child_ids && parent.stitch_child_ids.includes(nextSiblingId.value);
});

const isPrevStitch = computed(() => {
  if (!prevSiblingId.value) return false;
  const parent = store.getters['messages/getMessage'](props.parentId);
  return parent && parent.stitch_child_ids && parent.stitch_child_ids.includes(prevSiblingId.value);
});

// Check if siblings are currently loading
const isSiblingLoading = computed(() => {
  return store.getters['messages/isLoading'](`sibling_${props.parentId}`);
});

// Combined loading state
const isLoading = computed(() => {
  return isParentLoading.value || isSiblingLoading.value;
});

const logHover = (dir) => {
  const isStitch = dir === 'next' ? isNextStitch.value : isPrevStitch.value;
  const targetId = dir === 'next' ? nextSiblingId.value : prevSiblingId.value;
  if (targetId?.startsWith('msg_')) {
     console.log(`[SIBLING HOVER DEBUG] Hovering ${dir} button. Target: ${targetId}, isStitch: ${isStitch}`);
  }
};

// Watch for parent changes to update sibling order
const parentRef = computed(() => store.getters['messages/getMessage'](props.parentId));
watch(parentRef, (newVal) => {
  if (newVal && newVal.reply_order) {
    const orderedIds = store.getters['messages/getChildIds'](props.parentId);
    const unorderedIds = (newVal.child_ids || []).filter(id => !newVal.reply_order.includes(id));
    if (unorderedIds.length > 0) {
      const unorderedWithTimestamps = unorderedIds.map(id => {
        const msg = store.getters['messages/getMessage'](id);
        return { id, timestamp: msg?.timestamp || 'unknown' };
      });
      console.log(`[SiblingNavigator] reply_order active for ${props.parentId}: ordered=${orderedIds.length}, unordered=${unorderedIds.length}`, {
        ordered: orderedIds,
        unordered: unorderedWithTimestamps
      });
    }
  }
});

// Get message siblings from the store - use getChildIds to respect reply_order
const siblings = computed(() => {
  const parent = store.getters['messages/getMessage'](props.parentId);
  if (!parent) {
    return [];
  }
  // Use getChildIds getter which respects reply_order
  return store.getters['messages/getChildIds'](props.parentId);
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
  padding: 6px;
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--color-text-secondary);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  opacity: 1; /* Make clickable buttons fully visible */
  min-width: 28px;
  min-height: 28px;
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
  font-size: 14px;
  line-height: 1;
  font-weight: bold;
}

/* Smaller buttons for very small screens */
@media (max-width: 480px) {
  .mobile-nav-btn {
    padding: 4px;
    min-width: 24px;
    min-height: 24px;
  }
  
  .arrow-icon {
    font-size: 12px;
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
  width: 32px;
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
  width: 32px; /* Match button width */
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
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: 26px;
  height: 26px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
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
  top: 16px; /* Position at the top where the visual button is */
  z-index: 1;
}

.left-triangle {
  border-width: 6px 9px 6px 0;
  border-color: transparent var(--color-text-secondary) transparent transparent;
}

.right-triangle {
  border-width: 6px 0 6px 9px;
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
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--color-primary);
  animation: pulse 1.5s infinite;
  position: relative;
  top: 16px; /* Position at the top where the visual button is */
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
<style scoped>
/* State when an arrow targets a stitch link (static preview) */
.sibling-navigator .nav-button.target-is-stitch:not(:disabled)::after {
  background: linear-gradient(to left, var(--color-surface), rgba(76, 175, 80, 0.35)) !important;
  border-color: rgba(76, 175, 80, 0.65);
  border-style: solid;
}

.sibling-navigator .nav-button.nav-prev.target-is-stitch:not(:disabled)::after {
  background: linear-gradient(to right, var(--color-surface), rgba(76, 175, 80, 0.35)) !important;
}

/* Keep arrow white when targeting a stitch */
.sibling-navigator .nav-button.target-is-stitch:not(:disabled) .right-triangle {
  border-color: transparent transparent transparent #ffffff;
  opacity: 1;
}
.sibling-navigator .nav-button.target-is-stitch:not(:disabled) .left-triangle {
  border-color: transparent #ffffff transparent transparent;
  opacity: 1;
}

/* Hover over stitch target */
.sibling-navigator .nav-button.target-is-stitch:hover:not(:disabled)::after {
  background: linear-gradient(to left, var(--color-surface), rgba(76, 175, 80, 0.55)) !important;
  border-color: rgba(76, 175, 80, 0.85);
  border-style: solid;
}
.sibling-navigator .nav-button.nav-prev.target-is-stitch:hover:not(:disabled)::after {
  background: linear-gradient(to right, var(--color-surface), rgba(76, 175, 80, 0.55)) !important;
}
.sibling-navigator .nav-button.target-is-stitch:hover:not(:disabled) .triangle-icon {
  filter: drop-shadow(0 0 2px rgba(76, 175, 80, 0.5));
}

.sibling-navigator .nav-button.target-is-stitch:hover:not(:disabled) .right-triangle {
  /* Guard against generic hover styles that would recolor the arrow */
  border-color: transparent transparent transparent #ffffff;
}

.sibling-navigator .nav-button.target-is-stitch:hover:not(:disabled) .left-triangle {
  border-color: transparent #ffffff transparent transparent;
}

.mobile-sibling-nav .mobile-nav-btn.target-is-stitch:not(:disabled) {
  background: rgba(76, 175, 80, 0.1);
  border-color: rgba(76, 175, 80, 0.55);
  border-style: solid;
  color: #ffffff;
}
</style>
