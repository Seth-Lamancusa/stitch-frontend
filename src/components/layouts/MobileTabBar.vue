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
      <span class="tab-emoji" aria-hidden="true">🕘</span>
      <span class="tab-label">History</span>
    </router-link>
    
    <router-link 
      to="/timeline" 
      class="mobile-tab"
      :class="{ 'active': activeTab === 'timeline' }"
      role="tab"
      :aria-selected="activeTab === 'timeline'"
      aria-label="Timeline"
    >
      <span class="tab-emoji" aria-hidden="true">📜</span>
      <span class="tab-label">Timeline</span>
    </router-link>
    
    <router-link 
      to="/saved" 
      class="mobile-tab"
      :class="{ 'active': activeTab === 'saved' }"
      role="tab"
      :aria-selected="activeTab === 'saved'"
      aria-label="Saved"
    >
      <span class="tab-emoji" aria-hidden="true">🔖</span>
      <span class="tab-label">Saved</span>
    </router-link>
    
    <router-link 
      to="/channels" 
      class="mobile-tab"
      :class="{ 'active': activeTab === 'channels' }"
      role="tab"
      :aria-selected="activeTab === 'channels'"
      aria-label="Channels"
    >
      <span class="tab-emoji" aria-hidden="true">📢</span>
      <span class="tab-label">Channels</span>
    </router-link>
    
    <router-link 
      to="/inbox" 
      class="mobile-tab"
      :class="{ 'active': activeTab === 'inbox' }"
      role="tab"
      :aria-selected="activeTab === 'inbox'"
      aria-label="Inbox"
    >
      <span class="tab-emoji" aria-hidden="true">📥</span>
      <span class="tab-label">Inbox</span>
      <span v-if="isUnreadCountLoading" class="unread-badge">
        <span class="loading-spinner"></span>
      </span>
      <span v-else-if="unreadCount > 0" class="unread-badge">{{ unreadCount }}</span>
    </router-link>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { useStore } from 'vuex';
import { useRoute } from 'vue-router';

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
  background: #000;
  border-top: 1px solid var(--color-border, #2a2a2a);
  padding: 8px 0;
  z-index: 100;
  justify-content: space-around;
  align-items: center;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.3);
  width: 100%;
  box-sizing: border-box;
}

.mobile-tab {
  display: flex !important;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  text-decoration: none !important;
  color: var(--color-text-secondary, #aaa);
  border-radius: var(--radius-sm, 4px);
  transition: all var(--transition-fast, 0.2s);
  position: relative;
  flex: 1;
  max-width: 80px;
  min-width: 50px;
}

.mobile-tab:hover {
  background-color: var(--color-hover-overlay, #222);
  color: var(--color-text, #fff);
}

.mobile-tab.active {
  background-color: var(--color-primary, #4f8cff);
  color: var(--color-text-inverse, #fff);
}

.tab-emoji {
  font-size: 20px;
  line-height: 1;
}

.tab-label {
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
}

.unread-badge {
  position: absolute;
  top: 2px;
  right: 2px;
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

