<template>
  <div class="message-list-view">
    <div class="app-container">
      <!-- App header with user info and tabs in a single row -->
      <div class="app-header">
        <!-- Tab navigation -->
        <div class="tab-navigation">
          <button 
            class="tab-button" 
            :class="{ 'active': activeTab === 'feed' }"
            @click="navigateToTab('feed')"
          >Feed</button>
          <button 
            class="tab-button" 
            :class="{ 'active': activeTab === 'curated' }"
            @click="navigateToTab('curated')"
          >Curated</button>
          <button 
            class="tab-button" 
            :class="{ 'active': activeTab === 'private' }"
            @click="navigateToTab('private')"
          >Direct</button>
          <button 
            class="tab-button" 
            :class="{ 'active': activeTab === 'profile' }"
            @click="navigateToTab('profile')"
          >Profile</button>
          <button 
            class="tab-button" 
            :class="{ 'active': activeTab === 'local' }"
            @click="navigateToTab('local')"
          >Local</button>
        </div>
        
        <div class="user-controls">
          <div class="user-info">
            <div class="username-container" @click="openProfileModal" v-if="user">
              <span class="username">{{ userDisplayName }}</span>
              <span v-if="userTag" class="user-tag">@{{ userTag }}</span>
              <span class="edit-icon" title="Edit profile">✎</span>
            </div>
            <span v-else class="username">Guest</span>
            <span v-if="user && user.status === 'admin'" class="admin-badge" title="Admin">⛊</span>
            <span v-else-if="user && user.status === 'whitelisted'" class="whitelist-badge" title="Whitelisted">✓</span>
            <span v-else-if="user && user.status !== 'admin' && user.status !== 'whitelisted'" class="non-whitelist-badge" title="Not whitelisted">✗</span>
            <span v-if="!user" class="guest-badge" title="Not logged in">?</span>
          </div>
          <button v-if="user" @click="logout" class="logout-btn">Logout</button>
          <button v-else @click="handleLogin" class="login-btn" :disabled="isLoggingIn">
            {{ isLoggingIn ? 'Signing in...' : 'Login' }}
          </button>
        </div>
      </div>
      
      <!-- Slot for tab-specific intro content -->
      <slot name="tab-intro"></slot>
      
      <!-- Main content area - can be overridden with custom content -->
      <slot name="content">
        <MessageList />
      </slot>
      
      <!-- Slot for additional components -->
      <slot name="extra-components"></slot>
    </div>
    
    <!-- Profile Edit Modal -->
    <ProfileEditModal 
      :isOpen="isProfileModalOpen" 
      @close="closeProfileModal" 
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useStore } from 'vuex';
import { useAuthentication } from '../../composables/useAuthentication';
import MessageList from '../../components/MessageList.vue';
import ProfileEditModal from '../../components/ProfileEditModal.vue';

// Props
const props = defineProps({
  // The active tab identifier: 'feed', 'curated', 'private', 'profile', 'local'
  activeTab: {
    type: String,
    required: true,
    validator: (value) => ['feed', 'curated', 'private', 'profile', 'local'].includes(value)
  },
  // The Vuex action to fetch messages (e.g., 'messages/fetchFeedMessages')
  fetchAction: {
    type: String,
    required: true
  }
});

const router = useRouter();
const route = useRoute();
const store = useStore();
const { signInWithGoogle, logout } = useAuthentication();

const user = computed(() => store.getters['auth/user']);
const isWhitelisted = computed(() => store.getters['auth/isWhitelisted']);
const isAdmin = computed(() => store.getters['auth/isAdmin']);
const canInteract = computed(() => store.getters['auth/canInteract']);
const isLoggingIn = ref(false);
const isProfileModalOpen = ref(false);

// User display properties
const userDisplayName = computed(() => {
  if (!user.value) return 'Guest';
  return user.value.displayName || user.value.email || 'Unknown User';
});

const userTag = computed(() => {
  if (!user.value) return null;
  return user.value.user_tag || null;
});

const handleLogin = async () => {
  isLoggingIn.value = true;
  try {
    await signInWithGoogle();
    
    // Handle redirect if there was one
    if (route.query.redirect) {
      router.push(route.query.redirect);
    }
  } catch (e) {
    console.error("Login error:", e);
  } finally {
    isLoggingIn.value = false;
  }
};

const openProfileModal = () => {
  if (user.value) {
    isProfileModalOpen.value = true;
  }
};

const closeProfileModal = () => {
  isProfileModalOpen.value = false;
};

// Navigation to other tabs
const navigateToTab = (tab) => {
  const routes = {
    'feed': '/feed',
    'curated': '/curated',
    'private': '/direct',
    'profile': '/profile',
    'local': '/local'
  };
  
  // Store current route before navigation
  store.dispatch('navigation/setPreviousRoute', route.path);
  
  // Navigate to new route
  router.push(routes[tab]);
};

// Load messages for this tab
onMounted(async () => {
  // Special handling for profile tab which requires authentication
  if (props.activeTab === 'profile' && !user.value) {
    console.log("User not logged in - profile messages unavailable");
    return;
  }
  
  // Dispatch the provided fetch action
  if (props.fetchAction && props.activeTab !== 'local') {
    await store.dispatch(props.fetchAction);
  }
});
</script>

<style scoped>
.message-list-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--color-background);
  color: var(--color-text);
  overflow: hidden;
}

.app-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  background-color: var(--color-surface);
  box-shadow: var(--color-card-shadow);
  overflow: hidden;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-md);
  border-bottom: 1px solid var(--color-border);
  background-color: #000000;
  min-height: 48px; /* Minimum height to ensure consistency */
  max-height: 48px; /* Maximum height to prevent overflow */
}

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

.user-controls {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-right: var(--space-sm);
}

.username-container {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  position: relative;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-fast);
}

.username-container:hover {
  background-color: var(--color-hover-overlay);
}

.username {
  display: inline-block;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-tag {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  opacity: 0.8;
}

.edit-icon {
  font-size: 12px;
  opacity: 0.7;
  color: var(--color-text);
}

.username-container:hover .edit-icon {
  opacity: 1;
}

.logout-btn {
  background-color: transparent;
  color: var(--color-text);
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-xs);
}

.logout-btn:hover {
  background-color: var(--color-hover-overlay);
}

.login-btn {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  padding: var(--space-xs) var(--space-sm);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-xs);
  text-decoration: none;
}

.login-btn:hover {
  background-color: var(--color-primary-dark);
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .app-header {
    flex-direction: column;
    padding: 0;
  }
  
  .user-controls {
    width: 100%;
    padding: var(--space-xs) var(--space-sm);
    justify-content: flex-end;
    background-color: var(--color-surface);
  }
  
  .username {
    max-width: 100px;
  }
  
  .tab-button {
    max-width: none;
    padding: var(--space-sm);
  }
}

/* Super small screens */
@media (max-width: 480px) {
  .username {
    display: none;
  }
}

.whitelist-badge, .admin-badge, .non-whitelist-badge, .guest-badge {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  text-align: center;
  line-height: 18px;
  font-size: 12px;
  margin-left: var(--space-xs);
}

.whitelist-badge {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.admin-badge {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.non-whitelist-badge {
  background-color: var(--color-warning);
  color: var(--color-text-inverse);
}

.guest-badge {
  background-color: var(--color-text-secondary);
  color: var(--color-text-inverse);
}
</style> 