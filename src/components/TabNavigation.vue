<script setup>
import { ref, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';

/**
 * TabNavigation component provides a UI for switching between 
 * different message tabs (public, direct, profile, local).
 * 
 * Props:
 * - activeTab: Current active tab
 * 
 * Events:
 * - tab-change: Emitted when a tab is selected, with the tab name as payload
 */

const props = defineProps({
  activeTab: {
    type: String,
    default: 'public'
  }
});

const emit = defineEmits(['tab-change']);
const store = useStore();
const router = useRouter();

/**
 * Changes the active tab and updates the store state
 * @param {string} tab - The tab to switch to
 */
const changeTab = (tab) => {
  emit('tab-change', tab);
  store.dispatch('ui/setActiveTab', tab);
  
  // Navigate to the tab-specific route
  router.push(`/messages/${tab === 'private' ? 'direct' : tab}`);
};

</script>

<template>
  <div class="tab-navigation">
    <button 
      :class="['tab-button', { active: activeTab === 'public' }]"
      @click="changeTab('public')"
    >
      Public
    </button>
    
    <button 
      :class="['tab-button', { active: activeTab === 'private' }]"
      @click="changeTab('private')"
    >
      Direct
    </button>
    
    <button 
      :class="['tab-button', { active: activeTab === 'profile' }]"
      @click="changeTab('profile')"
    >
      Profile
    </button>
    
    <button 
      :class="['tab-button', { active: activeTab === 'local' }]"
      @click="changeTab('local')"
    >
      Local
    </button>
  </div>
</template>

<style scoped>
.tab-navigation {
  display: flex;
  justify-content: center;
  flex: 1;
}

.tab-button {
  padding: var(--space-md) var(--space-sm);
  background-color: transparent;
  color: var(--color-text-secondary);
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
  flex: 1;
  text-align: center;
  max-width: 120px;
}

.tab-button.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  background-color: var(--color-primary-light);
}

.tab-button:hover:not(.active) {
  background-color: var(--color-hover-overlay);
  color: var(--color-text);
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .tab-navigation {
    width: 100%;
  }
  
  .tab-button {
    max-width: none;
    padding: var(--space-sm);
  }
}
</style> 