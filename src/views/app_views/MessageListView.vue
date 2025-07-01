<template>
  <AppViewLayout>
    <!-- Whitelist rejection notification -->
    <div v-if="wasRejectedForWhitelist && !isRejectionNoticeDismissed" class="whitelist-rejection-notice">
      <button @click="dismissRejectionNotice" class="close-button" title="Dismiss">×</button>
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
import { computed, onMounted, watch, ref } from 'vue';
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
  let tab = 'public'; // Default to public
  if (route.path === '/public') tab = 'public';
  else if (route.path === '/saved') tab = 'saved';
  else if (route.path === '/inbox') tab = 'inbox';
  
  store.dispatch('navigation/setActiveTab', tab);
};

const user = computed(() => store.getters['auth/user']);

// Check if user was recently rejected due to not being whitelisted
const wasRejectedForWhitelist = computed(() => {
  // Only show banner if user was explicitly rejected for whitelist
  // (they shouldn't be able to stay logged in if not whitelisted)
  return store.getters['auth/wasRejectedForWhitelist'];
});

// Track if the rejection notice has been dismissed
const isRejectionNoticeDismissed = ref(false);

// Watch for changes in wasRejectedForWhitelist to reset dismissal state
watch(wasRejectedForWhitelist, (newValue, oldValue) => {
  if (newValue) {
    // Always reset dismissal state when rejection flag is set
    // This ensures the banner shows for every failed login attempt
    isRejectionNoticeDismissed.value = false;
    console.log('[MessageListView] Rejection state changed, showing banner');
  }
});

// Handler to dismiss the rejection notice
const dismissRejectionNotice = () => {
  isRejectionNoticeDismissed.value = true;
};
</script>

<style scoped>
/* Whitelist rejection notice styles */
.whitelist-rejection-notice {
  padding: 0;
  border-radius: var(--radius-sm, 4px);
  background-color: #ff8a8aad;
  border: 1px solid rgba(255, 179, 0, 0.3);
  box-shadow: 0 2px 8px rgba(255, 179, 0, 0.1);
  width: 50%;
  margin: var(--space-md, 16px) auto;
  position: relative;
}

.close-button {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  color: var(--color-text-inverse, #fff);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all var(--transition-fast, 0.2s);
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.close-button:active {
  transform: scale(0.95);
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
