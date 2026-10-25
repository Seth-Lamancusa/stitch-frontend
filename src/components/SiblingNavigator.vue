<template>
  <!-- Mobile mode - render as inline buttons for footer -->
  <div v-if="mobileMode" class="mobile-sibling-nav" :class="{ compact }">
    <button 
      @click.stop="navigate('prev')" 
      class="mobile-nav-btn mobile-nav-prev"
      :class="{ 'disabled': !canNavigatePrev, 'loading': isLoading, 'target-is-stitch': isPrevStitch }"
      :disabled="!canNavigatePrev || isLoading"
      title="Previous reply"
    >
      <div v-if="isLoading" class="loading-dot"></div>
      <svg v-else-if="compact" class="line-chevron" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M10 3.5 L5 8 L10 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <div v-else class="arrow-icon left-arrow">←</div>
      <span v-if="defaultMarkSide === 'prev'" class="mobile-default-mark" title="Default outgoing">
        <DefaultOutgoingStar :size="9" />
      </span>
    </button>
    
    <button 
      @click.stop="navigate('next')" 
      class="mobile-nav-btn mobile-nav-next"
      :class="{ 'disabled': !canNavigateNext, 'loading': isLoading, 'target-is-stitch': isNextStitch }"
      :disabled="!canNavigateNext || isLoading" 
      title="Next reply"
    >
      <div v-if="isLoading" class="loading-dot"></div>
      <svg v-else-if="compact" class="line-chevron" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6 3.5 L11 8 L6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <div v-else class="arrow-icon right-arrow">→</div>
      <span v-if="defaultMarkSide === 'next'" class="mobile-default-mark" title="Default outgoing">
        <DefaultOutgoingStar :size="9" />
      </span>
    </button>
  </div>
  
  <!-- Desktop mode - original positioning -->
  <div v-else class="sibling-navigator" :class="{ compact }">
    <button 
      @click.stop="navigate('prev')" 
      class="nav-button nav-prev"
      :class="{ 'disabled': !canNavigatePrev, 'loading': isLoading, 'target-is-stitch': isPrevStitch }"
      :disabled="!canNavigatePrev || isLoading"
      :data-debug-stitch="isPrevStitch"
      title="Previous reply"
    >
      <div v-if="isLoading" class="loading-dot"></div>
      <svg v-else-if="compact" class="line-chevron" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M10 3.5 L5 8 L10 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <div v-else class="triangle-icon left-triangle"></div>
      <span v-if="defaultMarkSide === 'prev'" class="default-outgoing-side-mark" title="Default outgoing">
        <DefaultOutgoingStar :size="9" />
      </span>
    </button>
    
    <button 
      @click.stop="navigate('next')" 
      class="nav-button nav-next"
      :class="{ 'disabled': !canNavigateNext, 'loading': isLoading, 'target-is-stitch': isNextStitch }"
      :disabled="!canNavigateNext || isLoading" 
      :data-debug-stitch="isNextStitch"
      title="Next reply"
    >
      <div v-if="isLoading" class="loading-dot"></div>
      <svg v-else-if="compact" class="line-chevron" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6 3.5 L11 8 L6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <div v-else class="triangle-icon right-triangle"></div>
      <span v-if="defaultMarkSide === 'next'" class="default-outgoing-side-mark" title="Default outgoing">
        <DefaultOutgoingStar :size="9" />
      </span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useStore } from 'vuex';
import DefaultOutgoingStar from './DefaultOutgoingStar.vue';

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
  },
  compact: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['navigate']);

const store = useStore();

// Parent record for this column. structureVersion forces a refresh when a
// live reply is linked, which is what enables the arrows.
const parentMessage = computed(() => {
  void store.state.messages.structureVersion;
  if (!props.parentId) return null;
  return store.state.messages.messages[props.parentId] || null;
});

const isParentLoading = computed(() => !!props.parentId && !parentMessage.value);

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
  const parent = parentMessage.value;
  return !!(nextSiblingId.value && parent?.stitch_child_ids?.includes(nextSiblingId.value));
});

const isPrevStitch = computed(() => {
  const parent = parentMessage.value;
  return !!(prevSiblingId.value && parent?.stitch_child_ids?.includes(prevSiblingId.value));
});

// Check if siblings are currently loading
const isSiblingLoading = computed(() => {
  return store.getters['messages/isLoading'](`sibling_${props.parentId}`);
});

// Combined loading state
const isLoading = computed(() => {
  return isParentLoading.value || isSiblingLoading.value;
});

const siblings = computed(() => {
  // Read the structure counter here. A parent-record computed can return the
  // same object, and the arrows already on screen would keep the old list.
  void store.state.messages.structureVersion;
  if (!props.parentId) return [];
  const parent = store.state.messages.messages[props.parentId];
  void parent?.child_ids;
  void parent?.stitch_child_ids;
  void parent?.reply_order;
  void store.state.messages.childrenByParent?.[String(props.parentId)];
  const ids = store.getters['messages/getChildIds'](props.parentId);
  console.log('[sibling-nav] siblings', {
    messageId: props.messageId,
    parentId: props.parentId,
    ids,
    structureVersion: store.state.messages.structureVersion,
  });
  return ids;
});

// Link under the arrow on the side where the default sits, when this message is not the default.
const defaultMarkSide = computed(() => {
  const parent = parentMessage.value;
  if (!parent || !parent.default_outgoing || parent.default_outgoing === props.messageId) return null;
  const ids = siblings.value;
  const currentIndex = ids.indexOf(props.messageId);
  const defaultIndex = ids.indexOf(parent.default_outgoing);
  if (currentIndex < 0 || defaultIndex < 0 || currentIndex === defaultIndex) return null;
  return defaultIndex < currentIndex ? 'prev' : 'next';
});

// Find current message position in siblings array (0-indexed)
const currentPosition = computed(() => {
  if (isLoading.value || !siblings.value || !siblings.value.length) return 0;
  
  const childIds = siblings.value;
  const branchChild = store.getters['messages/getBranchChild'](props.parentId);
  
  if (!branchChild) return 1; // Default to first position if no branch child
  
  const position = childIds.findIndex(id => String(id) === String(branchChild));
  return position === -1 ? 1 : position + 1;
});

// Navigation availability
const canNavigatePrev = computed(() => {
  if (isLoading.value) return false;
  return siblings.value.length > 1 && currentPosition.value > 1;
});

const canNavigateNext = computed(() => {
  const loading = isLoading.value;
  const ids = siblings.value;
  const position = currentPosition.value;
  const next = !loading && ids.length > 1 && position < ids.length;
  const prev = !loading && ids.length > 1 && position > 1;
  console.log('[sibling-nav] arrows', {
    messageId: props.messageId,
    parentId: props.parentId,
    loadingForcedOff: loading,
    parentMissing: isParentLoading.value,
    siblingLoading: isSiblingLoading.value,
    count: ids.length,
    position,
    prev,
    next,
  });
  return next;
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

/* Available reply arrows light up in the neutral palette. */
.mobile-nav-btn:not(.disabled):not(.loading) {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-light);
  color: var(--color-text);
  opacity: 1;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
}

.mobile-nav-btn:hover:not(:disabled) {
  opacity: 1;
  background-color: var(--color-surface-light);
  border-color: var(--color-text-secondary);
  color: var(--color-text);
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

.mobile-default-mark {
  display: block;
  font-size: 10px;
  line-height: 1;
  margin-top: 6px;
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
  background-color: rgba(243, 236, 220, 0.08);
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
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-light);
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

/* Hover styles - not disabled. Reply targets stay in the neutral palette. */
.nav-button:hover:not(:disabled) .left-triangle {
  border-color: transparent var(--color-text) transparent transparent;
}

.nav-button:hover:not(:disabled) .right-triangle {
  border-color: transparent transparent transparent var(--color-text);
}

/* Available reply targets light up with a white/grey wash. */
.nav-button:not(.disabled):not(:disabled)::after {
  border-color: var(--color-border-light);
}

.nav-button.nav-prev:not(.disabled):not(:disabled)::after {
  background: linear-gradient(to right, var(--color-surface), rgba(243, 236, 220, 0.16));
}

.nav-button.nav-next:not(.disabled):not(:disabled)::after {
  background: linear-gradient(to left, var(--color-surface), rgba(243, 236, 220, 0.16));
}

.nav-button.nav-prev:not(.disabled):not(:disabled) .left-triangle {
  border-color: transparent var(--color-text) transparent transparent;
}

.nav-button.nav-next:not(.disabled):not(:disabled) .right-triangle {
  border-color: transparent transparent transparent var(--color-text);
}

.default-outgoing-side-mark {
  position: absolute;
  top: 48px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  line-height: 1;
  pointer-events: none;
  z-index: 2;
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
/* Stitched siblings use the sage lit state that reply arrows used to use. */
.sibling-navigator .nav-button.nav-next.target-is-stitch:not(:disabled)::after {
  background: linear-gradient(to left, var(--color-surface), var(--color-primary-light));
  border-color: var(--color-border);
}

.sibling-navigator .nav-button.nav-prev.target-is-stitch:not(:disabled)::after {
  background: linear-gradient(to right, var(--color-surface), var(--color-primary-light));
  border-color: var(--color-border);
}

.sibling-navigator .nav-button.target-is-stitch:not(:disabled) .right-triangle {
  border-color: transparent transparent transparent var(--color-primary);
  opacity: 1;
}
.sibling-navigator .nav-button.target-is-stitch:not(:disabled) .left-triangle {
  border-color: transparent var(--color-primary) transparent transparent;
  opacity: 1;
}

.sibling-navigator .nav-button.target-is-stitch:hover:not(:disabled)::before {
  background-color: var(--color-primary-light);
}

.sibling-navigator .nav-button.nav-next.target-is-stitch:hover:not(:disabled)::after,
.sibling-navigator .nav-button.nav-prev.target-is-stitch:hover:not(:disabled)::after {
  background-color: var(--color-primary-light);
  border-color: var(--color-primary);
}

.sibling-navigator .nav-button.target-is-stitch:hover:not(:disabled) .right-triangle {
  border-color: transparent transparent transparent var(--color-primary);
}

.sibling-navigator .nav-button.target-is-stitch:hover:not(:disabled) .left-triangle {
  border-color: transparent var(--color-primary) transparent transparent;
}

/* Function rows: a disclosure-sized chevron, not the full reply rail. */
.line-chevron {
  width: 14px;
  height: 14px;
  display: block;
}

.sibling-navigator.compact .nav-button {
  top: 8px;
  width: 16px;
  height: 16px;
  align-items: center;
  color: var(--color-text-secondary);
}

.sibling-navigator.compact .nav-button::before,
.sibling-navigator.compact .nav-button::after {
  content: none;
}

.sibling-navigator.compact .nav-prev {
  left: 0;
}

.sibling-navigator.compact .nav-next {
  right: 0;
}

.sibling-navigator.compact .nav-button:hover:not(:disabled) {
  color: var(--color-text);
}

.sibling-navigator.compact .nav-button.disabled {
  opacity: 0.35;
}

.sibling-navigator.compact .loading-dot,
.sibling-navigator.compact .default-outgoing-side-mark {
  top: 0;
}

.sibling-navigator.compact .default-outgoing-side-mark {
  top: 16px;
  font-size: 9px;
}

.sibling-navigator.compact .nav-button.target-is-stitch:not(:disabled),
.sibling-navigator.compact .nav-button.target-is-stitch:hover:not(:disabled) {
  color: var(--color-accent-light);
}

.mobile-sibling-nav.compact {
  gap: 0;
}

.mobile-sibling-nav.compact .mobile-nav-btn,
.mobile-sibling-nav.compact .mobile-nav-btn:not(.disabled):not(.loading),
.mobile-sibling-nav.compact .mobile-nav-btn:hover:not(:disabled) {
  min-width: 16px;
  min-height: 16px;
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  color: var(--color-text-secondary);
  transform: none;
}

.mobile-sibling-nav.compact .mobile-nav-btn:hover:not(:disabled) {
  color: var(--color-text);
}

.mobile-sibling-nav.compact .mobile-nav-btn.disabled {
  opacity: 0.35;
}

.mobile-sibling-nav.compact .mobile-nav-btn.target-is-stitch:not(:disabled),
.mobile-sibling-nav.compact .mobile-nav-btn.target-is-stitch:hover:not(:disabled) {
  background: transparent;
  border: none;
  color: var(--color-accent-light);
}

.mobile-sibling-nav.compact .loading-dot {
  top: 0;
}

.mobile-sibling-nav .mobile-nav-btn.target-is-stitch:not(:disabled) {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border);
  color: var(--color-primary);
}

.mobile-sibling-nav .mobile-nav-btn.target-is-stitch:hover:not(:disabled) {
  background-color: var(--color-primary-light);
  border-color: var(--color-primary);
  color: var(--color-primary);
}
</style>
