<template>
  <div class="app-layout">
    <div class="app-header">
      <div class="header-left">
        <div class="branding">
          <router-link to="/home" class="logo-link">
            <span class="logo-text">Stitch</span>
          </router-link>
        </div>
        
        <!-- Navigation Tabs -->
        <div class="navigation-tabs">
          <!-- Admin Navigation -->
          <template v-if="isOnAdminPage && isAdmin">
            <router-link 
              to="/admin/users" 
              class="nav-tab"
              :class="{ 'active': $route.path === '/admin/users' }"
            >
              Users
            </router-link>
            <router-link 
              to="/admin/messages" 
              class="nav-tab"
              :class="{ 'active': $route.path === '/admin/messages' }"
            >
              Messages
            </router-link>
          </template>
          
          <!-- Regular Navigation -->
          <template v-else>
            <router-link 
              to="/public" 
              class="nav-tab"
              :class="{ 'active': activeTab === 'public' }"
              @click="handleTabClick('public')"
            >
              Public
            </router-link>
            <template v-if="user">
              <router-link 
                to="/saved" 
                class="nav-tab"
                :class="{ 'active': activeTab === 'saved' }"
                @click="handleTabClick('saved')"
              >
                Saved
              </router-link>
              <router-link 
                to="/inbox" 
                class="nav-tab"
                :class="{ 'active': activeTab === 'inbox' }"
                @click="handleTabClick('inbox')"
              >
                Inbox
                <span v-if="isUnreadCountLoading" class="unread-inline-badge">
                  <span class="loading-spinner"></span>
                </span>
                <span v-else-if="unreadCount > 0" class="unread-inline-badge">{{ unreadCount }}</span>
              </router-link>
            </template>
          </template>
        </div>
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
    
    <div class="main-content">
      <slot></slot>
    </div>
    
    <ProfileEditModal 
      :isOpen="isProfileModalOpen" 
      @close="closeProfileModal" 
    />
    <GlobalNotifications />
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useStore } from 'vuex';
import { useAuthentication } from '../../composables/useAuthentication';
import ProfileEditModal from '../ProfileEditModal.vue';
import GlobalNotifications from '../GlobalNotifications.vue';

const router = useRouter();
const route = useRoute();
const store = useStore();
const { signInWithGoogle, logout } = useAuthentication();

const user = computed(() => store.getters['auth/user']);
const isWhitelisted = computed(() => store.getters['auth/isWhitelisted']);
const isAdmin = computed(() => store.getters['auth/isAdmin']);
const authReady = computed(() => store.getters['auth/authReady']);
const activeTab = computed(() => store.getters['navigation/activeTab']);
const unreadCount = computed(() => store.getters['messages/getUnreadMessageCount']);
const isUnreadCountLoading = computed(() => store.getters['messages/isLoading']('fetchingUnreadCount'));
const isLoggingIn = ref(false);
const isProfileModalOpen = ref(false);

// Check if we're on an admin page
const isOnAdminPage = computed(() => {
  return route.path.startsWith('/admin');
});

const userDisplayName = computed(() => {
  if (!user.value) return 'Guest';
  return user.value.displayName || user.value.email || 'Unknown User';
});

const userTag = computed(() => {
  if (!user.value) return null;
  return user.value.user_tag || null;
});

// Fetch unread count when user authentication state changes
watch(
  () => user.value,
  (newUser) => {
    if (newUser) {
      // User is authenticated, fetch unread count
      store.dispatch('messages/fetchUnreadMessageCount');
    } else {
      // User logged out, reset count to 0
      store.commit('messages/SET_UNREAD_MESSAGE_COUNT', 0);
    }
  },
  { immediate: true }
);

// Also fetch on mount if user is already authenticated
onMounted(() => {
  if (user.value) {
    store.dispatch('messages/fetchUnreadMessageCount');
  }
});

const handleLogin = async () => {
  isLoggingIn.value = true;
  try {
    // Clear rejection state before login attempt to ensure fresh state
    store.commit('auth/SET_REJECTED_FOR_WHITELIST', false);
    await signInWithGoogle();
    
    // Wait a moment for auth state to be processed
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Check if user is still logged in and whitelisted
    const currentUser = store.getters['auth/user'];
    if (currentUser && ['admin', 'whitelisted', 'import'].includes(currentUser.status)) {
      // Only redirect if there was a specific redirect requested
      if (route.query.redirect) {
        router.push(route.query.redirect);
      }
      // Otherwise stay on current page
    }
    // If user is not logged in or not whitelisted, 
    // the auth store will have already handled the logout and redirect
  } catch (e) {
    console.error("Login error:", e);
    // On authentication error, set rejection state and redirect to public page
    await store.dispatch('auth/forceLogoutWithMessage', router);
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

const handleTabClick = (tab) => {
  store.dispatch('navigation/setActiveTab', tab);
};
</script>

<style scoped>
.app-layout {
  display: grid;
  grid-template-rows: 56px 1fr;
  height: var(--app-height, 100vh);
  background: var(--color-background, #fff);
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  border-bottom: 1px solid var(--color-border, #eee);
  background: #000;
  z-index: 100;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-lg, 24px);
  flex-shrink: 0;
}

.branding {
  display: flex;
  align-items: center;
}

.logo-link {
  text-decoration: none;
}

.logo-link:hover .logo-text {
  opacity: 0.9;
}

.logo-text {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--color-primary, #4f8cff);
  letter-spacing: 1px;
}

.navigation-tabs {
  display: flex;
  align-items: center;
  gap: var(--space-sm, 12px);
}

.nav-tab {
  text-decoration: none;
  color: var(--color-text-secondary, #aaa);
  padding: var(--space-xs, 6px) var(--space-sm, 12px);
  border-radius: var(--radius-sm, 4px);
  transition: background-color var(--transition-fast, 0.2s);
}

.nav-tab:hover {
  background-color: var(--color-hover-overlay, #222);
}

.nav-tab.active {
  background-color: var(--color-primary, #4f8cff);
  color: var(--color-text-inverse, #fff);
}

.unread-inline-badge {
  background-color: #dc2626; /* Red color */
  color: white;
  border-radius: 12px;
  height: 16px;
  font-size: 10px;
  font-weight: bold;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  min-width: 16px;
  padding: 0 6px;
  margin-left: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  white-space: nowrap;
  vertical-align: middle;
  overflow: hidden; /* Ensure spinner stays within bounds */
  position: relative; /* Create containing block */
}

.loading-spinner {
  width: 10px;
  height: 10px;
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  border-top: 1.5px solid white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: block;
  flex-shrink: 0;
  margin: 0;
  position: relative;
  z-index: 1;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.user-controls {
  display: flex;
  align-items: center;
  gap: var(--space-sm, 12px);
  flex-shrink: 0;
  margin-left: auto;
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-xs, 6px);
  margin-right: var(--space-sm, 12px);
}

.username-container {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  position: relative;
  padding: 2px 6px;
  border-radius: var(--radius-sm, 4px);
  transition: background-color var(--transition-fast, 0.2s);
}

.username-container:hover {
  background-color: var(--color-hover-overlay, #222);
}

.username {
  display: inline-block;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-tag {
  font-size: var(--font-size-xs, 0.85rem);
  color: var(--color-text-secondary, #aaa);
  opacity: 0.8;
}

.edit-icon {
  font-size: 12px;
  opacity: 0.7;
  color: var(--color-text, #fff);
}

.username-container:hover .edit-icon {
  opacity: 1;
}

.logout-btn {
  background-color: transparent;
  color: var(--color-text, #fff);
  padding: var(--space-xs, 6px) var(--space-sm, 12px);
  border: 1px solid var(--color-border, #eee);
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  font-size: var(--font-size-xs, 0.85rem);
}

.logout-btn:hover {
  background-color: var(--color-hover-overlay, #222);
}

.login-btn {
  background-color: var(--color-primary, #4f8cff);
  color: var(--color-text-inverse, #fff);
  padding: var(--space-xs, 6px) var(--space-sm, 12px);
  border: none;
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  font-size: var(--font-size-xs, 0.85rem);
  text-decoration: none;
}

.login-btn:hover {
  background-color: var(--color-primary-dark, #357ae8);
}

.whitelist-badge, .admin-badge, .non-whitelist-badge, .guest-badge {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  text-align: center;
  line-height: 18px;
  font-size: 12px;
  margin-left: var(--space-xs, 6px);
}

.whitelist-badge {
  background-color: var(--color-primary, #4f8cff);
  color: var(--color-text-inverse, #fff);
}

.admin-badge {
  background-color: var(--color-primary, #4f8cff);
  color: var(--color-text-inverse, #fff);
}

.non-whitelist-badge {
  background-color: var(--color-warning, #ffb300);
  color: var(--color-text-inverse, #fff);
}

.guest-badge {
  background-color: var(--color-text-secondary, #aaa);
  color: var(--color-text-inverse, #fff);
}

.auth-loading-badge {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  text-align: center;
  line-height: 18px;
  background-color: var(--color-surface, #222);
  border: 1px solid var(--color-border, #eee);
  overflow: hidden;
  margin-left: var(--space-xs, 6px);
}

.auth-loading-spinner {
  display: block;
  width: 100%;
  height: 100%;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--color-primary, #4f8cff);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.main-content {
  padding: 6px;
  overflow-y: auto;
  height: 100%;
}

/* Mobile responsive styles */
@media (max-width: 768px) {
  .app-header {
    padding: 0 12px; /* Reduce header padding */
    flex-wrap: nowrap; /* Prevent wrapping */
  }
  
  .header-left {
    gap: var(--space-md, 16px); /* Reduce gap */
    min-width: 0; /* Allow shrinking */
    flex: 1; /* Take available space */
  }
  
  .logo-text {
    font-size: 1.2rem; /* Smaller logo */
  }
  
  .navigation-tabs {
    gap: var(--space-xs, 8px); /* Reduce tab gaps */
    overflow-x: auto; /* Allow horizontal scroll if needed */
    flex-shrink: 1; /* Allow shrinking */
    min-width: 0;
  }
  
  .nav-tab {
    padding: var(--space-xs, 6px) var(--space-sm, 10px); /* Smaller tab padding */
    font-size: calc(var(--font-size-xs) - 1px); /* Smaller font */
    white-space: nowrap; /* Prevent text wrapping */
    flex-shrink: 0; /* Don't shrink tabs */
  }
  
  .unread-inline-badge {
    height: 14px;
    font-size: 9px;
    min-width: 14px;
    padding: 0 4px;
    margin-left: 4px;
  }
  
  .loading-spinner {
    width: 8px;
    height: 8px;
  }
  
  .user-controls {
    gap: var(--space-xs, 8px); /* Reduce gap */
    flex-shrink: 0; /* Never shrink user controls */
    min-width: 0;
  }
  
  .user-info {
    gap: 2px; /* Minimal gap */
    margin-right: var(--space-xs, 8px); /* Reduce margin */
    min-width: 0; /* Allow shrinking */
  }
  
  .username-container {
    gap: 2px; /* Reduce gap */
    padding: 1px 4px; /* Smaller padding */
    max-width: 100px; /* Limit username width */
    min-width: 0;
  }
  
  .username {
    max-width: 60px; /* Much smaller username width on mobile */
    font-size: calc(var(--font-size-xs)); /* Smaller font */
  }
  
  .user-tag {
    font-size: calc(var(--font-size-xs) - 2px); /* Even smaller tag */
    display: none; /* Hide user tag on mobile to save space */
  }
  
  .edit-icon {
    display: none; /* Hide edit icon on mobile */
  }
  
  .whitelist-badge, .admin-badge, .non-whitelist-badge, .guest-badge, .auth-loading-badge {
    width: 14px; /* Smaller badges */
    height: 14px;
    line-height: 14px;
    font-size: 10px;
    margin-left: 2px; /* Reduce margin */
  }
  
  .logout-btn, .login-btn {
    padding: var(--space-xs, 6px) var(--space-sm, 8px); /* Smaller button padding */
    font-size: calc(var(--font-size-xs) - 1px); /* Smaller font */
    white-space: nowrap; /* Prevent text wrapping */
    flex-shrink: 0; /* Never shrink the logout button */
  }
}

@media (max-width: 480px) {
  .app-header {
    padding: 0 8px; /* Even less padding on very narrow screens */
    min-height: 56px; /* Ensure minimum height */
  }
  
  .header-left {
    gap: var(--space-sm, 12px); /* Further reduce gap */
    overflow: hidden; /* Hide overflow */
  }
  
  .logo-text {
    font-size: 1rem; /* Even smaller logo */
  }
  
  .navigation-tabs {
    gap: 4px; /* Minimal gap between tabs */
    flex-shrink: 1;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none; /* Hide scrollbar in Firefox */
    -ms-overflow-style: none; /* Hide scrollbar in IE */
  }
  
  .navigation-tabs::-webkit-scrollbar {
    display: none; /* Hide scrollbar in WebKit browsers */
  }
  
  .nav-tab {
    padding: 4px 6px; /* Minimal tab padding */
    font-size: calc(var(--font-size-xs) - 2px); /* Very small font */
    min-width: fit-content; /* Only take needed space */
  }
  
  .unread-inline-badge {
    height: 12px;
    font-size: 8px;
    min-width: 12px;
    padding: 0 3px;
    margin-left: 3px;
  }
  
  .loading-spinner {
    width: 7px;
    height: 7px;
  }
  
  .user-controls {
    gap: 4px; /* Minimal gap */
    flex-shrink: 0; /* Never shrink */
  }
  
  .user-info {
    margin-right: 4px; /* Minimal margin */
    min-width: 0;
  }
  
  .username-container {
    max-width: 80px; /* Even smaller username container */
    padding: 1px 2px;
  }
  
  .username {
    max-width: 50px; /* Very small username width */
    font-size: calc(var(--font-size-xs) - 1px);
  }
  
  .whitelist-badge, .admin-badge, .non-whitelist-badge, .guest-badge, .auth-loading-badge {
    width: 12px; /* Very small badges */
    height: 12px;
    line-height: 12px;
    font-size: 8px;
    margin-left: 1px;
  }
  
  .logout-btn, .login-btn {
    padding: 4px 6px; /* Minimal button padding */
    font-size: calc(var(--font-size-xs) - 2px); /* Very small font */
    min-width: 50px; /* Ensure minimum button width */
  }
}

/* Stack layout vertically on very narrow screens - much better UX */
@media (max-width: 380px) {
  .app-header {
    flex-direction: column; /* Stack everything vertically */
    padding: 8px;
    height: auto; /* Allow height to expand */
    min-height: 56px;
    align-items: stretch; /* Full width for all elements */
  }
  
  .header-left {
    justify-content: space-between; /* Logo on left, user controls on right */
    margin-bottom: 8px; /* Space between rows */
    flex: none; /* Don't grow */
  }
  
  .branding {
    flex-shrink: 0; /* Never shrink logo */
  }
  
  .navigation-tabs {
    order: 2; /* Put navigation on second row */
    justify-content: center; /* Center the navigation tabs */
    flex-wrap: wrap; /* Allow wrapping if needed */
    gap: 8px; /* Restore normal gaps */
    margin-top: 4px; /* Small space from user controls */
  }
  
  .user-controls {
    order: 1; /* Keep with logo on first row */
    margin-left: 0; /* Reset margin */
    flex-shrink: 0; /* Never shrink */
  }
  
  .user-tag {
    display: none; /* Still hide user tag for space */
  }
  
  .username {
    max-width: 60px; /* Bit more space since we have vertical room */
  }
  
  .logout-btn, .login-btn {
    min-width: 60px; /* Better button size with vertical layout */
    padding: 4px 8px;
    font-size: calc(var(--font-size-xs)); /* Slightly larger font */
  }
  
  .nav-tab {
    padding: 6px 10px; /* Better padding with vertical layout */
    font-size: calc(var(--font-size-xs)); /* Restore normal size */
    min-width: fit-content;
  }
  
  .unread-inline-badge {
    height: 15px;
    font-size: 9px;
    min-width: 15px;
    padding: 0 5px;
    margin-left: 5px;
  }
  
  .loading-spinner {
    width: 9px;
    height: 9px;
  }
}
</style> 