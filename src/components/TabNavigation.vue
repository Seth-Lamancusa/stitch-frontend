<script setup>
import { ref, onMounted } from 'vue';
import { useStore } from 'vuex';

/**
 * TabNavigation component provides a UI for switching between 
 * public and private chat modes.
 * 
 * Props:
 * - activeTab: Current active tab, either 'public' or 'private'
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

/**
 * Changes the active tab and updates the store state
 * @param {string} tab - The tab to switch to ('public' or 'private')
 */
const changeTab = (tab) => {
  emit('tab-change', tab);
  store.dispatch('ui/setActiveTab', tab);
};

</script>

<template>
  <div class="tab-navigation">
    <button 
      :class="['tab-button', { active: activeTab === 'public' }]"
      @click="changeTab('public')"
    >
      Public Messages
    </button>
    
    <button 
      :class="['tab-button', { active: activeTab === 'private' }]"
      @click="changeTab('private')"
    >
      Direct Messages
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
  max-width: 180px;
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