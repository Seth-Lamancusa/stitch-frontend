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
          >
            Direct
            <!-- Unread Message Badge with loading state -->
            <span 
              v-if="user && unreadMessageCount > 0" 
              class="unread-badge" 
              :class="{ 'loading': toYouBadgeLoading }"
              :title="`${unreadMessageCount} unread message${unreadMessageCount > 1 ? 's' : ''}`"
            >
              <span v-if="toYouBadgeLoading" class="badge-loading-spinner"></span>
              <span v-else>{{ unreadMessageCount > 99 ? '99+' : unreadMessageCount }}</span>
            </span>
          </button>
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
            
            <!-- Auth status badges - only shown when auth is ready -->
            <template v-if="authReady">
              <span v-if="isAdmin" class="admin-badge" title="Admin">⛊</span>
              <span v-else-if="isWhitelisted" class="whitelist-badge" title="Whitelisted">✓</span>
              <span v-else-if="user && !isWhitelisted" class="non-whitelist-badge" title="Not whitelisted">✗</span>
              <span v-if="!user" class="guest-badge" title="Not logged in">?</span>
            </template>
            
            <!-- Loading spinner when auth is not ready -->
            <span v-else class="auth-loading-badge" title="Loading authentication status">
              <span class="auth-loading-spinner"></span>
            </span>
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
import { computed, onMounted, ref, watch, onBeforeUnmount } from 'vue';
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
const authReady = computed(() => store.getters['auth/authReady']);
const isLoggingIn = ref(false);
const isProfileModalOpen = ref(false);
const unreadMessageCount = computed(() => store.getters['messages/getUnreadMessageCount']);
const toYouBadgeLoading = computed(() => store.getters['ui/getToYouBadgeLoading']);

// User display properties
const userDisplayName = computed(() => {
  if (!user.value) return 'Guest';
  return user.value.displayName || user.value.email || 'Unknown User';
});

const userTag = computed(() => {
  if (!user.value) return null;
  return user.value.user_tag || null;
});

// Fetch unread message count
const fetchUnreadMessageCount = async () => {
  if (user.value) {
    await store.dispatch('messages/fetchUnreadMessageCount');
  }
};

const handleLogin = async () => {
  isLoggingIn.value = true;
  try {
    await signInWithGoogle();
    
    // Handle redirect if there was one
    if (route.query.redirect) {
      router.push(route.query.redirect);
    } else {
      // Default redirect to feed page
      router.push('/feed');
    }
    
    // Fetch unread count after login
    fetchUnreadMessageCount();
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

// Watch for auth ready state to fetch unread count
watch(authReady, async (isReady) => {
  if (isReady && user.value) {
    console.log('Auth ready, fetching unread message count');
    await fetchUnreadMessageCount();
  }
});

// Watch for user changes
watch(user, async (newUser) => {
  if (newUser && authReady.value) {
    console.log('User changed, fetching unread message count');
    await fetchUnreadMessageCount();
  }
});

// Add a watcher for tab changes to refresh unread count
watch(() => props.activeTab, (newTab) => {
  // When switching to Direct tab, refresh unread message count
  if (newTab === 'private') {
    fetchUnreadMessageCount();
  }
});

// Only fetch unread count on mount if it's needed for some reason
onMounted(async () => {
  // Add store subscription to watch for unread message count changes
  const unsubscribe = store.subscribe((mutation) => {
    // If unread count changes in the store, update the UI
    if (mutation.type === 'messages/SET_UNREAD_MESSAGE_COUNT') {
      console.log('Unread message count updated:', mutation.payload);
    }
  });
  
  // Clean up subscription when component unmounts
  onBeforeUnmount(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });
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
  position: relative; /* Make sure this is here for absolute positioning of the badge */
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

.auth-loading-badge {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  text-align: center;
  line-height: 18px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  overflow: hidden;
  margin-left: var(--space-xs);
}

.auth-loading-spinner {
  display: block;
  width: 100%;
  height: 100%;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.unread-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background-color: var(--color-error, #ff3860);
  color: white;
  border-radius: 50%;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  font-size: 11px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style> 