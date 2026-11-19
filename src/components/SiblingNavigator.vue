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
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useStore } from 'vuex';
import { useRoute, useRouter } from 'vue-router';

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
const router = useRouter();
const route = useRoute();

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
  return store.getters['messages/getChildIds'](props.parentId);
});

// Find current message position in siblings array (0-indexed)
const currentPosition = computed(() => {
  if (isLoading.value || !siblings.value || !siblings.value.length) return 0;
  
  const childIds = siblings.value;
  let position = childIds.findIndex(id => String(id) === String(props.messageId));
  if (position === -1) {
    const branchChild = store.getters['messages/getBranchChild'](props.parentId);
    position = childIds.findIndex(id => String(id) === String(branchChild));
  }
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
    const hadWalk = !!store.state.messages.contextView;
    const success = await store.dispatch('messages/navigateToSibling', {
      messageId: props.parentId,
      direction: direction,
      fromChildId: props.messageId
    });
    
    if (success) {
      const newBranchChild = store.getters['messages/getBranchChild'](props.parentId);
      if (hadWalk && newBranchChild) {
        const nav = route.name
          ? { name: route.name, params: { ...route.params, id: newBranchChild }, query: { ...route.query } }
          : { path: `/messages/${newBranchChild}`, query: { ...route.query } };
        try {
          await router.push(nav);
        } catch (error) {
          console.error('[SiblingNavigator] navigation failed', error);
        }
      }
      
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

</style>
<style scoped src="./sibling-rail.css"></style>
<style scoped>
/* Mobile function rows keep a disclosure-sized chevron. Desktop uses the shared rail. */

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

.sibling-navigator.compact .loading-dot {
  top: 0;
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
