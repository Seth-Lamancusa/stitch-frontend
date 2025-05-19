<template>
  <TabLayout 
    :activeTab="activeTab" 
    :fetchAction="fetchAction"
  >
    <!-- Force component remount on tab change using :key -->
    <template #content>
      <MessageList :key="activeTab" />
    </template>
  </TabLayout>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import TabLayout from '../../components/layouts/TabLayout.vue';
import MessageList from '../../components/MessageList.vue';

const route = useRoute();

/**
 * Determine active tab based on the current route path
 */
const activeTab = computed(() => {
  const path = route.path;
  if (path.includes('/direct')) return 'private';
  if (path.includes('/profile')) return 'profile';
  if (path.includes('/local')) return 'local';
  if (path.includes('/curated')) return 'curated';
  if (path.includes('/feed')) return 'feed';
  return 'feed'; // Default tab
});

/**
 * Select the appropriate fetch action based on the active tab
 */
const fetchAction = computed(() => {
  switch (activeTab.value) {
    case 'private':
      return 'messages/fetchDirectMessages';
    case 'profile':
      return 'messages/fetchUserMessages';
    case 'curated':
      return 'messages/fetchCuratedMessages';
    case 'local':
      return ''; // Local tab has no fetch action
    default:
      return 'messages/fetchFeedMessages';
  }
});
</script>

<style scoped>
.local-message-info {
  padding: 20px;
  text-align: center;
  color: var(--color-text-secondary);
  background-color: var(--color-surface-light);
  border-bottom: 1px solid var(--color-border);
}

.tab-info {
  max-width: 600px;
  margin: 20px auto;
  padding: 16px 20px;
  text-align: center;
  color: var(--color-text-secondary);
  background-color: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.tab-info p, .local-message-info p {
  margin: 0 0 8px 0;
}

.tab-info p:last-child, .local-message-info p:last-child {
  margin-bottom: 0;
}
</style> 