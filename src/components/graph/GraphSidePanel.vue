<template>
  <aside
    class="graph-side-panel"
    :class="{ 'graph-side-panel--open': isOpen, 'graph-side-panel--closed': !isOpen }"
    ref="panelEl"
    role="dialog"
    aria-label="Message details"
  >
    <div class="side-panel-header">
      <div class="side-panel-title">Message Details</div>
      <div class="side-panel-actions">
        <button
          class="side-panel-goto"
          :disabled="!displayedMessage?.id"
          @click="goToThread"
        >
          Go to thread
        </button>
        <button class="side-panel-close" @click="close" aria-label="Close">✕</button>
      </div>
    </div>

    <div class="side-panel-content" v-if="displayedMessage">
      <div class="detail-section">
        <label>Author</label>
        <div class="value">{{ authorName }}</div>
      </div>

      <div class="detail-section">
        <label>Timestamp</label>
        <div class="value">{{ formattedDate }}</div>
      </div>

      <div class="detail-section">
        <label>Content</label>
        <formatted-content
          v-if="displayedMessage.content"
          class="message-content"
          :content="displayedMessage.content"
        />
        <div v-else class="message-content">—</div>
      </div>

      <div class="detail-section" v-if="displayedMessage.id">
        <label>Message ID</label>
        <div class="value mono">{{ displayedMessage.id }}</div>
      </div>
    </div>

    <div v-else class="side-panel-empty">
      <div class="spinner-container" v-if="isLoading">
        <div class="spinner"></div>
        <span>Loading message details...</span>
      </div>
      <span v-else>No message selected.</span>
    </div>
  </aside>
</template>

<script setup>
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import { useStore } from 'vuex';
  import { useRouter } from 'vue-router';
  import { format } from 'date-fns';
  import FormattedContent from '../FormattedContent/index.vue';

  const store = useStore();
  const router = useRouter();

const panelEl = ref(null);

// Side panel visibility should be driven by selection, not a separate flag.
// Suppression while in stitch-drawing mode.
const isOpen = computed(() => {
  return store.state.graphView.selection.lastSelectedId != null && 
         !store.state.graphView.ui.isStitchDrawingMode;
});
const message = computed(() => store.getters['graphView/selectedMessageForPanel']);
const isLoading = computed(() => store.state.graphView.layout.isCalculating);

onMounted(() => {
  console.debug('[GRAPH SIDE PANEL] mounted');
});

onBeforeUnmount(() => {
  console.debug('[GRAPH SIDE PANEL] beforeUnmount');
});

// Keep the last resolved message to avoid a white flash when the selector briefly
// resolves to null during graph refresh/layout updates.
  const displayedMessage = ref(null);

watch(
  () => message.value,
  (next) => {
    if (next) {
      displayedMessage.value = next;
      console.debug('[GRAPH SIDE PANEL] displayedMessage updated', { id: next?.id });
    } else {
      console.debug('[GRAPH SIDE PANEL] message became null/undefined', { id: store.state.graphView.selection.lastSelectedId });
    }
  },
  { immediate: true }
);

watch(
  isOpen,
  (open) => {
    if (!open) displayedMessage.value = null;
  },
  { immediate: true }
);

watch(
  isOpen,
  (next, prev) => {
    console.debug('[GRAPH SIDE PANEL] isOpen changed', { prev, next, lastSelectedId: store.state.graphView.selection.lastSelectedId });

    if (next) {
      nextTick(() => {
        const el = panelEl.value;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        console.debug('[GRAPH SIDE PANEL] DOM snapshot', {
          className: el.className,
          opacity: cs.opacity,
          transform: cs.transform,
          pointerEvents: cs.pointerEvents,
          rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
        });
      });

      setTimeout(() => {
        const el = panelEl.value;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        console.debug('[GRAPH SIDE PANEL] DOM snapshot (later)', {
          className: el.className,
          opacity: cs.opacity,
          transform: cs.transform,
          pointerEvents: cs.pointerEvents,
          rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
        });
      }, 350);
    }
  },
  { flush: 'post' }
);

watch(
  () => message.value?.id,
  (next, prev) => {
    console.debug('[GRAPH SIDE PANEL] selected message changed', { prev, next });
  },
  { flush: 'post' }
);

const authorName = computed(() => {
  if (!displayedMessage.value) return 'Unknown';
  const name = getAuthorDisplayName(displayedMessage.value);
  if (name !== 'Unknown') return name;
  return getAuthorUserTag(displayedMessage.value) || 'Unknown';
});

const formattedDate = computed(() => {
  if (!displayedMessage.value?.timestamp) return '';
  try {
    return format(new Date(displayedMessage.value.timestamp), 'PPP p');
  } catch (e) {
    return displayedMessage.value.timestamp;
  }
});

  const close = () => {
    store.dispatch('graphView/clearSelection');
  };

  const goToThread = () => {
    const id = displayedMessage.value?.id;
    if (!id) return;

    // ThreadView route is /messages/:id and already performs the correct
    // ensureCorrectScroll positioning when the messageId is present.
    router.push(`/messages/${id}`);
  };
</script>

<style scoped>
.graph-side-panel {
  position: fixed;
  top: 16px;
  right: 16px;
  bottom: 16px;
  height: auto;
  width: 620px;
  max-width: calc(100vw - 32px);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  box-shadow: -8px 0 28px rgba(0, 0, 0, 0.14);
  display: flex;
  flex-direction: column;
  z-index: 1000;
  transform: translateX(100%);
  will-change: transform, opacity;
  transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.18s ease;
  opacity: 0;
  pointer-events: none;
}

.graph-side-panel--open {
  transform: translateX(0);
  opacity: 1;
  pointer-events: auto;
}

.graph-side-panel--closed {
  transform: translateX(100%);
  opacity: 0;
  pointer-events: none;
}

  .side-panel-header {
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-light);
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  }

  .side-panel-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .side-panel-goto {
    background: none;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 8px 12px;
    cursor: pointer;
    color: var(--color-text-primary);
    font-weight: 600;
    font-size: 0.9rem;
    transition: background 0.15s ease;
  }

  .side-panel-goto:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .side-panel-goto:hover:not(:disabled) {
    background: var(--color-surface-hover);
  }

.side-panel-title {
  font-weight: 600;
  font-size: 1.1rem;
}

.side-panel-close {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.5rem;
  color: var(--color-text-secondary);
}

.side-panel-content {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.detail-section {
  margin-bottom: 1.5rem;
}

.detail-section label {
  display: block;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
  margin-bottom: 0.25rem;
}

.value {
  font-size: 1rem;
  color: var(--color-text-primary);
}

.value.mono {
  font-family: monospace;
  font-size: 0.85rem;
  background: var(--color-surface-light);
  padding: 0.25rem;
  border-radius: 4px;
}

.message-content {
  line-height: 1.5;
  font-size: 0.95rem;
}

.side-panel-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
}

.spinner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

</style>
