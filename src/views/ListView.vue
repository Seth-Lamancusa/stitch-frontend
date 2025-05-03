<script setup>
import { computed, onMounted, ref } from 'vue';
import { signOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { getFirebaseAuth } from '../firebase.js';
import { useRouter, useRoute } from 'vue-router';
import { useStore } from 'vuex';
import TabNavigation from '../components/TabNavigation.vue';
import MessageList from '../components/MessageList.vue';
import ProfileEditModal from '../components/ProfileEditModal.vue';

/**
 * ListView is the main view component that:
 * - Contains the tabs and message list
 * - Manages user authentication state
 * - Handles tab navigation
 */

const router = useRouter();
const route = useRoute();
const store = useStore();
const user = computed(() => store.getters['auth/user']);
const activeTab = computed(() => store.getters['ui/activeTab']);
const isWhitelisted = computed(() => store.getters['auth/isWhitelisted']);
const isAdmin = computed(() => store.getters['auth/isAdmin']);
const canInteract = computed(() => store.getters['auth/canInteract']);
const isLoggingIn = ref(false);
const isProfileModalOpen = ref(false);

const logout = async () => {
  try {
    await signOut(getFirebaseAuth());
    store.dispatch('auth/setUser', null);
  } catch (error) {
    console.error("Error signing out:", error);
  }
};

const login = async () => {
  isLoggingIn.value = true;
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(getFirebaseAuth(), provider);
    store.dispatch('auth/setUser', result.user);
    
    // Check if user email is whitelisted and admin status
    if (result.user.email) {
      store.dispatch('auth/checkWhitelistStatus', result.user.email);
      store.dispatch('auth/checkAdminStatus', result.user.email);
    }
    
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

const handleTabChange = (tab) => {
  store.dispatch('ui/setActiveTab', tab);
};

const openProfileModal = () => {
  if (user.value) {
    isProfileModalOpen.value = true;
  }
};

const closeProfileModal = () => {
  isProfileModalOpen.value = false;
};

onMounted(() => {
  // Add null check before trying to access currentUser
  const auth = getFirebaseAuth();
  if (auth && auth.currentUser) {
    store.dispatch('auth/setUser', auth.currentUser);
    
    if (auth.currentUser.email) {
      store.dispatch('auth/checkWhitelistStatus', auth.currentUser.email);
      store.dispatch('auth/checkAdminStatus', auth.currentUser.email);
    }
  }
});
</script>

<template>
  <div class="message-list-view">
    <div class="app-container">
      <!-- App header with user info and tabs in a single row -->
      <div class="app-header">
        <TabNavigation 
          :activeTab="activeTab" 
          @tab-change="handleTabChange" 
        />
        
        <div class="user-controls">
          <div class="user-info">
            <img 
              v-if="user?.photoURL" 
              :src="user.photoURL" 
              alt="Profile" 
              class="profile-pic" 
              @click="openProfileModal"
            />
            <div class="username-container" @click="openProfileModal" v-if="user">
            <span class="username">{{ user?.displayName || user?.email || 'Guest' }}</span>
              <span class="edit-icon" title="Edit profile">✎</span>
            </div>
            <span v-else class="username">Guest</span>
            <span v-if="user && isAdmin" class="admin-badge" title="Admin">⛊</span>
            <span v-else-if="user && isWhitelisted" class="whitelist-badge" title="Whitelisted">✓</span>
            <span v-else-if="user && !isWhitelisted" class="non-whitelist-badge" title="Not whitelisted">✗</span>
            <span v-if="!user" class="guest-badge" title="Not logged in">?</span>
          </div>
          <button v-if="user" @click="logout" class="logout-btn">Logout</button>
          <button v-else @click="login" class="login-btn" :disabled="isLoggingIn">
            {{ isLoggingIn ? 'Signing in...' : 'Login' }}
          </button>
        </div>
      </div>
      
      <!-- Message list area -->
      <MessageList />
    </div>
    
    <!-- Profile Edit Modal -->
    <ProfileEditModal 
      :isOpen="isProfileModalOpen" 
      @close="closeProfileModal" 
    />
  </div>
</template>

<style scoped>
.message-list-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--background-color);
  color: var(--text-color);
  overflow: hidden;
}

.app-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  background-color: var(--card-background);
  box-shadow: var(--card-shadow);
  overflow: hidden;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-md);
  border-bottom: 1px solid var(--border-color);
  background-color: #000000;
  min-height: 48px; /* Minimum height to ensure consistency */
  max-height: 48px; /* Maximum height to prevent overflow */
}

.user-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-right: var(--spacing-sm);
}

.profile-pic {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  cursor: pointer; /* Add cursor pointer to indicate clickable */
}

.username-container {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  position: relative;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.username-container:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.username {
  display: inline-block;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edit-icon {
  font-size: 12px;
  opacity: 0.7;
  color: var(--text-color);
}

.username-container:hover .edit-icon {
  opacity: 1;
}

.logout-btn {
  background-color: transparent;
  color: var(--text-color);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  font-size: 0.8rem;
}

.logout-btn:hover {
  background-color: var(--hover-color);
}

.login-btn {
  background-color: var(--primary-color);
  color: black;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: none;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  font-size: 0.8rem;
  text-decoration: none;
}

.login-btn:hover {
  background-color: var(--primary-color-dark);
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .app-header {
    flex-direction: column;
    padding: 0;
  }
  
  .user-controls {
    width: 100%;
    padding: var(--spacing-xs) var(--spacing-sm);
    justify-content: flex-end;
    background-color: var(--surface-color);
  }
  
  .username {
    max-width: 100px;
  }
}

/* Super small screens */
@media (max-width: 480px) {
  .username {
    display: none;
  }
}

.whitelist-badge {
  display: inline-block;
  background-color: var(--primary-color);
  color: black;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  text-align: center;
  line-height: 18px;
  font-size: 12px;
  margin-left: var(--spacing-xs);
}

.admin-badge {
  display: inline-block;
  background-color: #ffd700; /* Gold color for admin */
  color: black;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  text-align: center;
  line-height: 18px;
  font-size: 12px;
  margin-left: var(--spacing-xs);
}

.non-whitelist-badge {
  display: inline-block;
  background-color: #e74c3c;
  color: black;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  text-align: center;
  line-height: 18px;
  font-size: 12px;
  margin-left: var(--spacing-xs);
}

.guest-badge {
  display: inline-block;
  background-color: #95a5a6;
  color: black;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  text-align: center;
  line-height: 18px;
  font-size: 12px;
  margin-left: var(--spacing-xs);
}
</style> 