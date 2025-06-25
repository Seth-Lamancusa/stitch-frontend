<template>
  <AppViewLayout>
    <!-- Whitelist rejection notification -->
    <div v-if="wasRejectedForWhitelist" class="whitelist-rejection-notice">
      <div class="rejection-content">
        <div class="rejection-icon">❌</div>
        <h4>Oh no! You aren't whitelisted.</h4>
        <p>You can still view free public messages via direct links, but you don't have an inbox and you can't create messages.</p>
        <router-link to="/requests" class="waitlist-link">Join the waitlist here!</router-link>
      </div>
    </div>
    
    <MessageList :mode="mode" />
  </AppViewLayout>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue';
import { useStore } from 'vuex';
import { useRoute } from 'vue-router';
import AppViewLayout from '../../components/layouts/AppViewLayout.vue';
import MessageList from '../../components/MessageList.vue';

// Accept mode prop from router
const props = defineProps({
  mode: {
    type: String,
    default: 'public'
  }
});

const store = useStore();
const route = useRoute();

// Clear messages store on mount and when mode changes
onMounted(async () => {
  try {
    await store.dispatch('messages/clearCache');
    console.log(`[MessageListView] Messages store cleared on mount for mode: ${props.mode}`);
  } catch (error) {
    console.error('[MessageListView] Error clearing messages store:', error);
  }
  
  // Set active tab based on route
  updateActiveTab();
});

// Watch for route changes to update active tab
watch(() => route.path, () => {
  updateActiveTab();
});

const updateActiveTab = () => {
  let tab = 'inbox';
  if (route.path === '/public') tab = 'public';
  else if (route.path === '/saved') tab = 'saved';
  else if (route.path === '/inbox') tab = 'inbox';
  
  store.dispatch('navigation/setActiveTab', tab);
};

const user = computed(() => store.getters['auth/user']);

// Check if user was recently rejected due to not being whitelisted
const wasRejectedForWhitelist = computed(() => {
  if (user.value) return false; // Don't show if user is logged in
  
  // Use Vuex store state instead of localStorage
  return store.getters['auth/wasRejectedForWhitelist'];
});
</script>

<style scoped>
/* Whitelist rejection notice styles */
.whitelist-rejection-notice {
  margin: 12px;
  padding: 0;
  border-radius: var(--radius-sm, 4px);
  background-color: #ff8a8aad;
  border: 1px solid rgba(255, 179, 0, 0.3);
  box-shadow: 0 2px 8px rgba(255, 179, 0, 0.1);
  width: 70%;
  margin: 0 auto;
  margin-top: 56px;
}

.rejection-content {
  padding: var(--space-md, 16px);
  text-align: center;
  color: var(--color-text-inverse, #fff);
}

.rejection-icon {
  font-size: 1.5rem;
  margin-bottom: var(--space-xs, 8px);
}

.rejection-content h4 {
  margin: 0 0 var(--space-sm, 8px) 0;
  font-size: var(--font-size-md, 1rem);
  font-weight: 600;
  color: var(--color-text-inverse, #fff);
}

.rejection-content p {
  margin: 0 0 var(--space-sm, 12px) 0;
  font-size: var(--font-size-sm, 0.9rem);
  line-height: 1.4;
  color: var(--color-text-inverse, #fff);
}

.waitlist-link {
  display: inline-block;
  padding: var(--space-xs, 6px) var(--space-sm, 12px);
  background-color: rgba(255, 255, 255, 0.2);
  color: var(--color-text-inverse, #fff);
  text-decoration: none;
  border-radius: var(--radius-sm, 4px);
  font-size: var(--font-size-sm, 0.9rem);
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: all var(--transition-fast, 0.2s);
}

.waitlist-link:hover {
  background-color: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  color: var(--color-text-inverse, #fff);
}
</style>
