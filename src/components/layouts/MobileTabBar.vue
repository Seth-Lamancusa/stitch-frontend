<template>
  <nav class="mobile-tab-bar" role="tablist" aria-label="Main navigation">
    <!-- Search tab commented out
    <router-link 
      to="/search" 
      class="mobile-tab"
      :class="{ 'active': activeTab === 'search' }"
      role="tab"
      :aria-selected="activeTab === 'search'"
      aria-label="Search"
    >
      <span class="tab-emoji" aria-hidden="true">🔎</span>
      <span class="tab-label">Search</span>
    </router-link>
    -->
    
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
    
    <router-link 
      to="/channels" 
      class="mobile-tab"
      :class="{ 'active': activeTab === 'channels' }"
      role="tab"
      :aria-selected="activeTab === 'channels'"
      aria-label="Channels"
    >
      <TabGlyph name="channels" :size="40" />
    </router-link>
    
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
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { useStore } from 'vuex';
import { useRoute } from 'vue-router';
import TabGlyph from './TabGlyph.vue';

const store = useStore();
const route = useRoute();

const activeTab = computed(() => {
  const p = route.path || '';
  if (p.startsWith('/search')) return 'search';
  if (p.startsWith('/history')) return 'history';
  if (p.startsWith('/timeline')) return 'timeline';
  if (p.startsWith('/saved')) return 'saved';
  if (p.startsWith('/channels')) return 'channels';
  if (p.startsWith('/inbox')) return 'inbox';
  return 'history';
});

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
  border-radius: 0;
  position: relative;
  flex: 1;
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

/* Show on mobile screens */
@media (max-width: 768px) {
  .mobile-tab-bar {
    display: flex !important;
  }
}
</style>

