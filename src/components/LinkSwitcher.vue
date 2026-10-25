<template>
  <div v-if="shouldShowIndicator" class="link-switcher-container" :class="{ 'is-switchable': isSwitchable }">
    
    <div class="switchable-state">
      <button 
        class="switcher-btn prev" 
        :class="{ 'target-is-stitch': isPrevStitch, 'disabled': !canNavigatePrev }"
        :disabled="!canNavigatePrev"
        @click="cycleParent(-1)"
        title="Previous origin"
      >
        <div class="triangle-icon left-triangle"></div>
      </button>
      
      <div class="pill-wrap" :class="{ 'is-stitch': isCurrentStitch }">
        <svg v-if="isCurrentStitch" class="link-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
        </svg>
        <span class="indicator-text" :class="{ 'italic': isCurrentStitch }">
          {{ indicatorLabel }}
        </span>
      </div>
      
      <button 
        class="switcher-btn next" 
        :class="{ 'target-is-stitch': isNextStitch, 'disabled': !canNavigateNext }"
        :disabled="!canNavigateNext"
        @click="cycleParent(1)"
        title="Next origin"
      >
        <div class="triangle-icon right-triangle"></div>
      </button>
    </div>
    
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  // The ID of the currently active path from above
  activeParentId: {
    type: String,
    required: false,
    default: null
  },
  // The true reply tree parent (can be null if root)
  replyParentId: {
    type: String,
    required: false,
    default: null
  },
  // Array of IDs for incoming stitch links
  stitchParentIds: {
    type: Array,
    required: false,
    default: () => []
  }
});

const emit = defineEmits(['switchParent', 'loadParent']);

// Combine all valid parents into a single array for cycling.
// Order: Reply Parent (if exists) -> Stitch Parents (in order)
const allParents = computed(() => {
  const parents = [];
  if (props.replyParentId) {
    parents.push({ id: props.replyParentId, type: 'reply' });
  }
  
  if (props.stitchParentIds && props.stitchParentIds.length > 0) {
    props.stitchParentIds.forEach((id, index) => {
      parents.push({ 
        id, 
        type: 'stitch', 
        index: index + 1, 
        total: props.stitchParentIds.length 
      });
    });
  }
  return parents;
});

const currentIndex = computed(() => {
  return allParents.value.findIndex(p => p.id === props.activeParentId);
});

const currentParentInfo = computed(() => {
  if (currentIndex.value === -1 && allParents.value.length > 0) {
    return allParents.value[0]; // Fallback
  }
  return allParents.value[currentIndex.value] || null;
});

const isSwitchable = computed(() => allParents.value.length > 1);

const hasActiveParent = computed(() => !!props.activeParentId);

const isCurrentStitch = computed(() => {
  return currentParentInfo.value?.type === 'stitch';
});

// Show:
// - full navigator when we can cycle between multiple origins
// - OR a “Linked origin” indicator when this message has a stitch parent,
//   including a reply root whose stitch parent is not the active parent yet.
const shouldShowIndicator = computed(() => {
  if (isSwitchable.value) return true;
  if ((props.stitchParentIds || []).length > 0) return true;
  return hasActiveParent.value && isCurrentStitch.value;
});

const isPrevStitch = computed(() => {
  if (currentIndex.value <= 0) return false;
  return allParents.value[currentIndex.value - 1]?.type === 'stitch';
});

const isNextStitch = computed(() => {
  const idx = currentIndex.value + 1;
  if (idx < 0 || idx >= allParents.value.length) return false;
  return allParents.value[idx]?.type === 'stitch';
});

const canNavigatePrev = computed(() => currentIndex.value > 0);
const canNavigateNext = computed(() => {
  if (allParents.value.length === 0) return false;
  // No origin selected yet (reply root). The next arrow steps onto the first one.
  if (currentIndex.value === -1) return true;
  return currentIndex.value < allParents.value.length - 1;
});

const indicatorLabel = computed(() => {
  const info = currentParentInfo.value;
  if (!info) return '';
  
  if (info.type === 'reply') {
    return 'Reply origin';
  } else {
    if (info.total > 1) {
      return `Linked origin (${info.index}/${info.total})`;
    }
    return 'Linked origin';
  }
});

const cycleParent = (direction) => {
  if (allParents.value.length === 0) return;

  const nextIdx = currentIndex.value + direction;

  // Guard against out of bounds (no looping). Index -1 is "no origin selected".
  if (nextIdx < 0 || nextIdx >= allParents.value.length) return;

  emit('switchParent', allParents.value[nextIdx].id);
};
</script>

<style scoped>
.link-switcher-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0;
  margin-top: -12px;
  margin-bottom: 6px;
  width: 100%;
}

.display-only-state, .switchable-state {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.7rem;
}

.pill-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border-radius: 12px;
  background-color: var(--color-surface, #2a2a2a);
  color: #ffffff;
  border: 1px solid var(--color-border, #444);
  white-space: nowrap;
}

.pill-wrap.is-stitch {
  border-color: rgba(76, 175, 80, 0.6);
}

.link-icon {
  width: 10px;
  height: 10px;
  color: #4caf50;
}

.indicator-text {
  opacity: 0.9;
}

.italic {
  font-style: italic;
}

.switcher-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  color: white;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.switcher-btn:hover:not(:disabled) {
  opacity: 1;
}

.switcher-btn:disabled {
  opacity: 0.15;
  cursor: not-allowed;
}

.switcher-btn.target-is-stitch:not(:disabled) .left-triangle {
  border-right-color: #4caf50;
}

.switcher-btn.target-is-stitch:not(:disabled) .right-triangle {
  border-left-color: #4caf50;
}

.triangle-icon {
  width: 0;
  height: 0;
  border-style: solid;
}
.left-triangle {
  border-width: 4px 6px 4px 0;
  border-color: transparent white transparent transparent;
}
.right-triangle {
  border-width: 4px 0 4px 6px;
  border-color: transparent transparent transparent white;
}
</style>
