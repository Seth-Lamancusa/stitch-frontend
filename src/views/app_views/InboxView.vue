<template>
  <div class="inbox-view">
    <div class="app-header">
      <div class="branding">
        <span class="logo-text">Stitch</span>
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
      <MessageList />
    </div>
    <ProfileEditModal 
      :isOpen="isProfileModalOpen" 
      @close="closeProfileModal" 
    />
    <GlobalNotifications />
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useStore } from 'vuex';
import { useAuthentication } from '../../composables/useAuthentication';
import MessageList from '../../components/MessageList.vue';
import ProfileEditModal from '../../components/ProfileEditModal.vue';
import GlobalNotifications from '../../components/GlobalNotifications.vue';

const router = useRouter();
const route = useRoute();
const store = useStore();
const { signInWithGoogle, logout } = useAuthentication();

// Clear messages store on mount
onMounted(async () => {
  try {
    await store.dispatch('messages/clearCache');
    console.log('[InboxView] Messages store cleared on mount');
  } catch (error) {
    console.error('[InboxView] Error clearing messages store:', error);
  }
});

const user = computed(() => store.getters['auth/user']);
const isWhitelisted = computed(() => store.getters['auth/isWhitelisted']);
const isAdmin = computed(() => store.getters['auth/isAdmin']);
const authReady = computed(() => store.getters['auth/authReady']);
const isLoggingIn = ref(false);
const isProfileModalOpen = ref(false);

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
    if (route.query.redirect) {
      router.push(route.query.redirect);
    } else {
      router.push('/inbox');
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
</script>

<style scoped>
.inbox-view {
  display: flex;
  flex-direction: column;
  height: 100%;
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
}

.branding {
  display: flex;
  align-items: center;
}

.logo-text {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--color-primary, #4f8cff);
  letter-spacing: 1px;
}

.user-controls {
  display: flex;
  align-items: center;
  gap: var(--space-sm, 12px);
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
  flex: 1;
  overflow: auto;
  padding: 6px;
}
</style>
