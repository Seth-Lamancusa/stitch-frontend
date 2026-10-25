<template>
  <nav class="mobile-tab-bar" role="tablist" aria-label="Main navigation">
    <router-link 
      to="/history" 
      class="mobile-tab"
      :class="{ 'active': activeTab === 'history' }"
      role="tab"
      :aria-selected="activeTab === 'history'"
      aria-label="History"
    >
      <TabGlyph name="history" :size="40" />
    </router-link>
    
    <router-link 
      to="/timeline" 
      class="mobile-tab"
      :class="{ 'active': activeTab === 'timeline' }"
      role="tab"
      :aria-selected="activeTab === 'timeline'"
      aria-label="Timeline"
    >
      <TabGlyph name="timeline" :size="40" />
    </router-link>
    
    <router-link 
      to="/saved" 
      class="mobile-tab"
      :class="{ 'active': activeTab === 'saved' }"
      role="tab"
      :aria-selected="activeTab === 'saved'"
      aria-label="Saved"
    >
      <TabGlyph name="saved" :size="40" />
    </router-link>

    <button
      type="button"
      class="mobile-tab"
      :class="{ 'active': overflowIsCurrent }"
      role="tab"
      :aria-selected="overflowIsCurrent"
      aria-haspopup="dialog"
      :aria-expanded="overflowOpen"
      :aria-label="overflowLabel"
      @click="overflowOpen = true"
    >
      <TabGlyph :name="overflowTab || 'more'" :size="40" />
    </button>
    
    <router-link 
      to="/inbox" 
      class="mobile-tab"
      :class="{ 'active': activeTab === 'inbox' }"
      role="tab"
      :aria-selected="activeTab === 'inbox'"
      aria-label="Inbox"
    >
      <span class="tab-glyph-wrap">
        <TabGlyph name="inbox" :size="40" />
        <span v-if="isUnreadCountLoading" class="unread-badge">
          <span class="loading-spinner"></span>
        </span>
        <span v-else-if="unreadCount > 0" class="unread-badge">{{ unreadCount }}</span>
      </span>
    </router-link>

    <router-link
      to="/search"
      class="mobile-tab"
      :class="{ 'active': activeTab === 'search' }"
      role="tab"
      :aria-selected="activeTab === 'search'"
      aria-label="Search"
    >
      <TabGlyph name="search" :size="40" />
    </router-link>
  </nav>

  <div
    v-if="overflowOpen"
    class="overflow-backdrop"
    @click="overflowOpen = false"
  >
    <div
      class="overflow-sheet"
      role="dialog"
      aria-label="More tabs"
      @click.stop
    >
      <button
        v-for="tab in overflowTabs"
        :key="tab.name"
        type="button"
        class="overflow-option"
        :class="{ 'active': activeTab === tab.name }"
        @click="chooseOverflow(tab.name)"
      >
        <TabGlyph :name="tab.name" :size="28" />
        <span>{{ tab.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { useStore } from 'vuex';
import { useRoute, useRouter } from 'vue-router';
import TabGlyph from './TabGlyph.vue';

const OVERFLOW_TABS = [
  { name: 'public', label: 'Public', to: '/public' },
  { name: 'channels', label: 'Channels', to: '/channels' },
];
const OVERFLOW_KEY = 'stitch.mobileOverflowTab';

const store = useStore();
const route = useRoute();
const router = useRouter();
const overflowOpen = ref(false);

function readStoredOverflow() {
  try {
    const value = localStorage.getItem(OVERFLOW_KEY);
    return OVERFLOW_TABS.some(tab => tab.name === value) ? value : null;
  } catch {
    return null;
  }
}

const storedOverflow = ref(readStoredOverflow());

const activeTab = computed(() => {
  const p = route.path || '';
  if (p.startsWith('/search')) return 'search';
  if (p.startsWith('/history')) return 'history';
  if (p.startsWith('/timeline')) return 'timeline';
  if (p.startsWith('/public')) return 'public';
  if (p.startsWith('/saved')) return 'saved';
  if (p.startsWith('/channels')) return 'channels';
  if (p.startsWith('/inbox')) return 'inbox';
  return 'history';
});

const overflowTabs = OVERFLOW_TABS;

const overflowTab = computed(() => {
  if (OVERFLOW_TABS.some(tab => tab.name === activeTab.value)) return activeTab.value;
  return storedOverflow.value;
});

const overflowIsCurrent = computed(() => overflowTab.value != null && overflowTab.value === activeTab.value);

const overflowLabel = computed(() => {
  const tab = OVERFLOW_TABS.find(item => item.name === overflowTab.value);
  return tab ? tab.label : 'More';
});

function rememberOverflow(name) {
  storedOverflow.value = name;
  try {
    localStorage.setItem(OVERFLOW_KEY, name);
  } catch {
    // Private mode can reject storage. The in-memory choice still stands.
  }
}

function chooseOverflow(name) {
  const tab = OVERFLOW_TABS.find(item => item.name === name);
  overflowOpen.value = false;
  if (!tab) return;
  rememberOverflow(name);
  if (route.path !== tab.to) router.push(tab.to);
}

function onOverflowKey(event) {
  if (event.key === 'Escape') overflowOpen.value = false;
}

watch(activeTab, (tab) => {
  if (OVERFLOW_TABS.some(item => item.name === tab)) rememberOverflow(tab);
}, { immediate: true });

watch(overflowOpen, (open) => {
  if (open) window.addEventListener('keydown', onOverflowKey);
  else window.removeEventListener('keydown', onOverflowKey);
});

onUnmounted(() => window.removeEventListener('keydown', onOverflowKey));

const unreadCount = computed(() => store.getters['messages/getUnreadMessageCount']);
const isUnreadCountLoading = computed(() => store.getters['messages/isLoading']('fetchingUnreadCount'));
</script>

<style scoped>
.mobile-tab-bar {
  display: none !important; /* Hidden by default, shown on mobile */
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  background: var(--color-chrome, #0e0c0d);
  border-top: 1px solid var(--color-border, #2a2a2a);
  padding: 16px 0 calc(16px + env(safe-area-inset-bottom));
  z-index: 100;
  justify-content: space-around;
  align-items: center;
  box-sizing: border-box;
}

.mobile-tab {
  display: flex !important;
  align-items: center;
  justify-content: center;
  padding: 4px 0;
  text-decoration: none !important;
  color: var(--color-text-secondary, #aaa);
  background: transparent;
  border: none;
  border-radius: 0;
  position: relative;
  flex: 1;
  font: inherit;
  cursor: pointer;
}

.mobile-tab:hover {
  background-color: transparent;
}

.mobile-tab.active {
  background-color: transparent;
  color: inherit;
}

.tab-glyph-wrap {
  position: relative;
  display: inline-flex;
}

.mobile-tab :deep(.tab-glyph) {
  opacity: 0.45;
}

.mobile-tab.active :deep(.tab-glyph) {
  opacity: 1;
}

.unread-badge {
  position: absolute;
  top: -4px;
  right: -10px;
  background-color: #dc2626;
  color: white;
  border-radius: 10px;
  height: 16px;
  min-width: 16px;
  font-size: 9px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.loading-spinner {
  width: 8px;
  height: 8px;
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  border-top: 1.5px solid white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.overflow-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.45);
}

.overflow-sheet {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: calc(84px + env(safe-area-inset-bottom));
  background: var(--color-chrome, #0e0c0d);
  border: 1px solid var(--color-border, #2a2a2a);
  border-radius: 12px;
  padding: 6px;
}

.overflow-option {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--color-text-secondary, #aaa);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.overflow-option.active,
.overflow-option:hover {
  background: var(--color-hover-overlay, #222);
  color: var(--color-text-inverse, #fffcef);
}

/* Show on mobile screens */
@media (max-width: 768px) {
  .mobile-tab-bar {
    display: flex !important;
  }
}
</style>

