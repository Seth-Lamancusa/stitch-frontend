<template>
  <TabLayout 
    :activeTab="activeTab"
  >
    <!-- Custom content for cloud tab -->
    <template #content v-if="activeTab === 'cloud'">
      <div class="cloud-tab-container">
        <!-- Message Filters at the top -->
        <MessageFilters />
        
        <!-- Pinned Messages below filters -->
        <PinnedMessageList />
        
        <!-- Regular Message List -->
        <MessageList :key="activeTab" />
      </div>
    </template>
    
    <!-- Default content for other tabs -->
    <template #content v-else>
      <MessageList :key="activeTab" />
    </template>
  </TabLayout>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import TabLayout from '../../components/layouts/TabLayout.vue';
import MessageList from '../../components/MessageList.vue';
import PinnedMessageList from '../../components/PinnedMessageList.vue';
import MessageFilters from '../../components/MessageFilters.vue';

const route = useRoute();

/**
 * Determine active tab based on the current route path
 */
const activeTab = computed(() => {
  const path = route.path;
  if (path.includes('/ground')) return 'ground';
  if (path.includes('/cloud')) return 'cloud';
  return 'cloud'; // Default tab
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

.cloud-tab-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  padding: var(--space-md);
  gap: var(--space-lg);
}
</style> 