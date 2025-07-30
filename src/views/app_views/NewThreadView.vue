<template>
  <div class="thread-view">
    <!-- Loading states -->
    <div v-if="!authReady" class="auth-loading">
      <p>Loading...</p>
    </div>
    
    <!-- Normal view - show when auth is ready -->
    <template v-else>
      <!-- Thread header with navigation back and title -->
      <div class="thread-header">
        <button @click="cancelThread()" class="back-button">
          &larr; Cancel
        </button>
        <h2 class="thread-title">New Message</h2>
        <div class="user-controls">
          <div class="user-info">
            <div class="username-container" @click="openProfileModal" v-if="user">
              <span class="username">{{ userDisplayName }}</span>
              <span v-if="userTag" class="user-tag">@{{ userTag }}</span>
              <span class="edit-icon" title="Edit profile">✎</span>
            </div>
            <span v-else class="username">Guest</span>

            <!-- Auth status badges -->
            <span v-if="isAdmin" class="admin-badge" title="Admin">⛊</span>
            <span v-else-if="isWhitelisted" class="whitelist-badge" title="Whitelisted">✓</span>
            <span v-else-if="user && !isWhitelisted" class="non-whitelist-badge" title="Not whitelisted">✗</span>
            <span v-if="!user" class="guest-badge" title="Not logged in">?</span>
          </div>
          <button v-if="user" @click="logout" class="logout-btn">Logout</button>
          <button v-else @click="handleLogin" class="login-btn" :disabled="isLoggingIn">
            {{ isLoggingIn ? 'Signing in...' : 'Login' }}
          </button>
        </div>
      </div>
      
      <!-- Guest notification box - only shown for guests -->
      <div v-if="!user" class="guest-notification">
        <div class="notification-content">
          <div class="notification-icon">🔒</div>
          <div class="notification-text">
            <h3>Not logged in</h3>
            <p>You need to login to send messages</p>
          </div>
          <div class="notification-arrow">↑</div>
        </div>
      </div>

      <!-- Reply box component -->
      <reply-box
        :is-new-thread="true"
        :can-interact="canInteract"
        ref="replyBox"
        @send-success="handleSendSuccess"
        @send-error="handleSendError"
      />

      <!-- Loading Overlay -->
      <div v-if="isCreatingThread" class="loading-overlay">
        <div class="loading-content">
          <div class="loading-main-line">
            <p class="loading-message">{{ loadingMessage }}</p>
            <div class="import-spinner"></div>
          </div>
          <p class="loading-submessage">{{ loadingSubmessage }}</p>
        </div>
      </div>

      <!-- Global Notifications component -->
      <GlobalNotifications />
      
      <!-- Profile Edit Modal -->
      <ProfileEditModal 
        :isOpen="isProfileModalOpen" 
        @close="closeProfileModal" 
      />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute } from 'vue-router';
import ReplyBox from '../../components/ReplyBox.vue';
import GlobalNotifications from '../../components/GlobalNotifications.vue';
import ProfileEditModal from '../../components/ProfileEditModal.vue';
import { useAuthentication } from '../../composables/useAuthentication';

// Setup store and routing
const store = useStore();
const router = useRouter();
const route = useRoute();
const { signInWithGoogle, logout } = useAuthentication();

// Refs
const messageList = ref(null);
const replyBox = ref(null);

// Update the refs
const isCreatingThread = ref(false);
const loadingMessage = ref('Creating new thread...');
const loadingSubmessage = ref('This will only take a moment');

// Add login state
const isLoggingIn = ref(false);
const isProfileModalOpen = ref(false);

// Computed properties from store
const user = computed(() => store.getters['auth/user']);
const authReady = computed(() => store.getters['auth/authReady']);
const isAdmin = computed(() => store.getters['auth/isAdmin']);
const isWhitelisted = computed(() => store.getters['auth/isWhitelisted']);

// User display properties
const userDisplayName = computed(() => {
  if (!user.value) return 'Guest';
  return user.value.displayName || user.value.email || 'Unknown User';
});

const userTag = computed(() => {
  if (!user.value) return null;
  return user.value.user_tag || null;
});

const canInteract = computed(() => {
  console.log("NewThreadView - checking canInteract:", 
    user.value?.status, 
    store.getters['auth/isAdmin'], 
    store.getters['auth/isWhitelisted'],
    store.getters['auth/canInteract']
  );
  
  // First priority: direct user status check
  if (user.value?.status === 'admin' || user.value?.status === 'whitelisted' || user.value?.status === 'import') {
    return true;
  }
  
  // Fallback to the store properties if status isn't available directly
  if (store.getters['auth/isAdmin'] || store.getters['auth/isWhitelisted']) {
    return true;
  }
  
  return false;
});

// Add computed property for current reply visibility
const isPublic = computed(() => store.getters['navigation/replyIsPublic']);

// Add computed property for previous route
const previousRoute = computed(() => store.getters['navigation/previousRoute']);

// Lifecycle hooks
onMounted(async () => {
  // Add reload detection
  window.addEventListener('beforeunload', () => {
    console.log('[NewThreadView] 🚨 PAGE RELOAD DETECTED!');
    console.trace('[NewThreadView] Reload stack trace:');
  });
  
  // Wait for auth to be ready before proceeding - auth store handles initialization
  if (!authReady.value) {
    console.log(`[NewThreadView] Auth not ready, waiting...`);
    await new Promise((resolve) => {
      const unwatch = store.watch(
        () => store.getters['auth/authReady'],
        (newValue) => {
          if (newValue) {
            console.log(`[NewThreadView] Auth ready now`);
            unwatch();
            resolve();
          }
        }
      );
    });
  }
  
  // Reset visibility settings for new threads
  console.log(`[NewThreadView] Resetting visibility settings for new thread`);
  
  // Set default visibility to public and clear recipients in one call
  store.dispatch('navigation/setVisibilitySettings', {
    isPublic: true,
    recipients: []
  });
  
  // Focus the reply box textarea on mount
  nextTick(() => {
    if (replyBox.value) {
      replyBox.value.focus();
    }
  });
});

// Watch for rejection state changes and redirect to /public
watch(() => store.getters['auth/wasRejectedForWhitelist'], (newValue, oldValue) => {
  console.log('[NewThreadView] Rejection state watcher triggered - oldValue:', oldValue, 'newValue:', newValue);
  // Always redirect when rejection state is set to true
  if (newValue) {
    console.log('[NewThreadView] Rejection state is true, redirecting to /public');
    router.push('/public');
  }
});

// Methods
const cancelThread = () => {
  // Get reply content
  const content = replyBox.value?.content?.trim();
  
  if (content) {
    if (!confirm("Discard this thread? Any unsent message will be lost.")) {
      return;
    }
  }
  
  // Navigate back to the previous route
  router.push(previousRoute.value);
};

const handleSendSuccess = async (newMessage) => {
  try {
    // Set loading state to show overlay
    isCreatingThread.value = true;
    loadingMessage.value = 'Creating new thread...';
    loadingSubmessage.value = 'This will only take a moment';
    
    // Redirect to the new thread
    router.replace({ path: `/${newMessage.id}` });
  } catch (error) {
    console.error('Error handling message success:', error);
    store.commit('ui/SET_ERROR', 'Failed to complete thread creation.');
  } finally {
    // This may not execute if navigation happens first
    isCreatingThread.value = false;
  }
};

const handleSendError = (error) => {
  console.error('Error sending message:', error);
  store.commit('ui/SET_ERROR', 'Failed to create thread. Please try again.');
};

// Add login handler
const handleLogin = async () => {
  isLoggingIn.value = true;
  try {
    console.log('[NewThreadView] Starting signInWithGoogle');
    // Clear rejection state before login attempt to ensure fresh state
    store.commit('auth/SET_REJECTED_FOR_WHITELIST', false);
    await signInWithGoogle();
    console.log('[NewThreadView] signInWithGoogle completed successfully');
    
    // Wait a moment for auth state to be processed
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Check if user is still logged in and whitelisted
    const currentUser = store.getters['auth/user'];
    if (currentUser && ['admin', 'whitelisted', 'import'].includes(currentUser.status)) {
      console.log('[NewThreadView] User logged in successfully, staying on page');
      // Only redirect if there was a specific redirect requested
      if (route.query.redirect) {
        router.push(route.query.redirect);
      }
      // Otherwise stay on current page
    } else {
      console.log('[NewThreadView] User not whitelisted or not logged in after auth');
    }
  } catch (e) {
    console.error("Login error:", e);
    console.log('[NewThreadView] About to call forceLogoutWithMessage');
    console.log('[NewThreadView] Current location before forceLogoutWithMessage:', window.location.href);
    // On authentication error, set rejection state and redirect to public page
    await store.dispatch('auth/forceLogoutWithMessage', router);
    console.log('[NewThreadView] forceLogoutWithMessage completed');
    console.log('[NewThreadView] Current location after forceLogoutWithMessage:', window.location.href);
  } finally {
    isLoggingIn.value = false;
  }
};

// Profile modal methods
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
.thread-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.thread-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-sm);
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-surface);
  z-index: 5;
}

.back-button {
  padding: var(--space-xs) var(--space-sm);
  background-color: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text);
}

.thread-title {
  margin: 0;
  color: var(--color-primary);
  font-size: var(--font-size-lg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.messages-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-left: 80px;
  padding-right: 80px;
  gap: 20px;
  overflow-y: auto;
  justify-content: flex-start;
  margin-bottom: 130px;
  min-height: 0;
  max-height: calc(100vh - 200px);
}

.import-hint {
  text-align: center;
  padding: var(--space-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  background-color: var(--color-surface-light);
  border-radius: var(--radius-md);
  width: 50%;
  margin: 100px auto;
}

.import-link {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
  transition: color var(--transition-fast);
}

.import-link:hover {
  color: var(--color-primary-dark);
  text-decoration: underline;
}

.import-disabled-message {
  color: var(--color-text-secondary);
  font-weight: 500;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--z-index-modal);
  backdrop-filter: blur(3px);
}

.loading-content {
  background-color: var(--color-surface);
  padding: var(--space-xl);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 400px;
  width: 90%;
  text-align: center;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.loading-main-line {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-xs);
  width: 100%;
}

.import-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border);
  border-top: 3px solid var(--color-accent);
  border-radius: 50%;
  animation: import-spin 1.2s linear infinite;
  margin-left: var(--space-sm);
}

.loading-message {
  font-size: var(--font-size-lg);
  font-weight: bold;
  margin: 0;
  color: var(--color-text);
}

.loading-submessage {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

@keyframes import-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Responsive styles */
@media (max-width: 768px) {
  .messages-container {
    padding-left: 12px;
    padding-right: 12px;
    margin-bottom: 70px;
    max-height: calc(100vh - 120px);
  }
  
  .import-hint {
    width: 90%;
    margin: 60px auto;
    padding: var(--space-md);
    font-size: calc(var(--font-size-sm));
  }
  
  .thread-header {
    padding: var(--space-xs) var(--space-sm);
  }
  
  .back-button {
    padding: 4px 8px;
    font-size: calc(var(--font-size-sm) - 1px);
  }
  
  .thread-title {
    font-size: var(--font-size-md);
  }
}

@media (max-width: 480px) {
  .messages-container {
    padding-left: 8px;
    padding-right: 8px;
    margin-bottom: 80px;
  }
  
  .import-hint {
    width: 96%;
    margin: 40px auto;
    padding: var(--space-sm);
    font-size: calc(var(--font-size-sm) - 1px);
  }
  
  .thread-header {
    padding: 6px 8px;
  }
  
  .back-button {
    padding: 3px 6px;
    font-size: calc(var(--font-size-xs));
  }
  
  .thread-title {
    font-size: calc(var(--font-size-md) - 1px);
  }
}

/* Dark theme */
@media (prefers-color-scheme: dark) {
  .thread-header {
    background-color: #000000;
  }
  
  .loading-content {
    background-color: var(--surface-color-dark, #222);
    border: 1px solid var(--border-color-dark, #444);
  }
  
  .loading-message {
    color: var(--text-color-dark, #eee);
  }
  
  .loading-submessage {
    color: var(--text-color-light-dark, #aaa);
  }
  
  .import-spinner {
    border-color: rgba(255, 255, 255, 0.1);
    border-top-color: #10a37f;
  }
}

.user-controls {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
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

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
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

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .user-controls {
    gap: var(--space-xs);
    flex-shrink: 0;
  }
  
  .user-info {
    gap: 2px;
    margin-right: var(--space-xs);
    min-width: 0;
  }
  
  .username-container {
    gap: 2px;
    padding: 1px 4px;
    max-width: 100px;
    min-width: 0;
  }
  
  .username {
    max-width: 60px;
    font-size: var(--font-size-xs);
  }
  
  .user-tag {
    font-size: calc(var(--font-size-xs) - 2px);
    display: none;
  }
  
  .edit-icon {
    display: none;
  }
  
  .whitelist-badge, .admin-badge, .non-whitelist-badge, .guest-badge, .auth-loading-badge {
    width: 14px;
    height: 14px;
    line-height: 14px;
    font-size: 10px;
    margin-left: 2px;
  }
  
  .logout-btn, .login-btn {
    padding: var(--space-xs) var(--space-sm);
    font-size: calc(var(--font-size-xs) - 1px);
    white-space: nowrap;
    flex-shrink: 0;
  }
}

@media (max-width: 480px) {
  .user-controls {
    gap: 4px;
    flex-shrink: 0;
  }
  
  .user-info {
    margin-right: 4px;
    min-width: 0;
  }
  
  .username-container {
    max-width: 80px;
    padding: 1px 2px;
  }
  
  .username {
    max-width: 50px;
    font-size: calc(var(--font-size-xs) - 1px);
  }
  
  .whitelist-badge, .admin-badge, .non-whitelist-badge, .guest-badge, .auth-loading-badge {
    width: 12px;
    height: 12px;
    line-height: 12px;
    font-size: 8px;
    margin-left: 1px;
  }
  
  .logout-btn, .login-btn {
    padding: 4px 6px;
    font-size: calc(var(--font-size-xs) - 2px);
    min-width: 50px;
  }
}

/* Dark theme */
@media (prefers-color-scheme: dark) {
  .thread-header {
    background-color: #000000;
  }
  
  .loading-content {
    background-color: var(--surface-color-dark, #222);
    border: 1px solid var(--border-color-dark, #444);
  }
  
  .loading-message {
    color: var(--text-color-dark, #eee);
  }
  
  .loading-submessage {
    color: var(--text-color-light-dark, #aaa);
  }
  
  .import-spinner {
    border-color: rgba(255, 255, 255, 0.1);
    border-top-color: #10a37f;
  }
}

/* Thread markers and loading indicators */
.thread-begin-marker {
  margin-bottom: 20px;
}

.thread-end-marker {
  margin-top: 20px;
  margin-bottom: 20px;
}

.auth-loading,
.loading-indicator,
.error-message,
.not-found {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: var(--color-text-secondary);
  text-align: center;
  gap: var(--space-sm);
}

/* Guest notification styles */
.guest-notification {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  pointer-events: none;
}

.notification-content {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
  opacity: 0.9;
}

.notification-icon {
  font-size: 2rem;
  opacity: 0.8;
}

.notification-text {
  text-align: center;
}

.notification-text h3 {
  margin: 0 0 var(--space-xs) 0;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.notification-text p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
}

.notification-arrow {
  font-size: 1.5rem;
  color: var(--color-primary);
  font-weight: bold;
  animation: arrow-pulse 2s ease-in-out infinite;
}

@keyframes arrow-pulse {
  0%, 100% { opacity: 0.6; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-4px); }
}

/* Dark theme for guest notification */
@media (prefers-color-scheme: dark) {
  .notification-content {
    background-color: var(--surface-color-dark, #222);
    border-color: var(--border-color-dark, #444);
  }
  
  .notification-text h3 {
    color: var(--text-color-dark, #eee);
  }
  
  .notification-text p {
    color: var(--text-color-light-dark, #aaa);
  }
}
</style> 