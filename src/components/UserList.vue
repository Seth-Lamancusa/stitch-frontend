<template>
  <div class="user-list" ref="userListRef">
    <!-- Empty state for no results -->
    <div v-if="shouldShowEmptyState" class="empty-state">
      <p v-if="searchQuery">No users found matching "{{ searchQuery }}"</p>
      <p v-else>No users found.</p>
    </div>

    <!-- Users container -->
    <div class="users-container">
      <!-- Users list -->
      <div 
        v-for="user in users" 
        :key="user.id" 
        class="user-list-item"
      >
        <div class="user-card">
          <div class="user-info">
            <div class="user-main-info">
              <h3 class="user-name">{{ user.display_name || 'No Display Name' }}</h3>
              <div class="user-email">{{ userEmail(user) }}</div>
              <div v-if="user.user_tag" class="user-tag">@{{ user.user_tag }}</div>
            </div>
            <div class="user-metadata">
              <div class="user-dates">
                <div v-if="user.created_at" class="user-date">
                  Joined: {{ formatDate(user.created_at) }}
                </div>
                <div v-if="user.last_login" class="user-date">
                  Last login: {{ formatDate(user.last_login) }}
                </div>
              </div>
            </div>
          </div>
          
          <div class="user-status">
            <div class="status-badges">
              <span 
                v-if="(user.scopes || '').split(' ').includes('admin')" 
                class="status-badge admin-badge" 
                title="Admin"
              >
                Admin
              </span>
              <span 
                v-else-if="(user.scopes || '').split(' ').includes('msg.write')" 
                class="status-badge whitelist-badge" 
                title="Can write"
              >
                Writer
              </span>
              
              <span 
                v-else 
                class="status-badge guest-badge" 
                title="Guest user"
              >
                Guest
              </span>
            </div>
            
            <div class="user-actions">
              <div class="actions-container">
                <!-- Status update functionality could go here in the future -->
                <!-- <select class="status-dropdown">
                  <option value="guest">Guest</option>
                  <option value="msg.write">Writer</option>
                  <option value="admin">Admin</option>
                </select> -->
                
                <!-- Delete user button -->
                <button 
                  @click="confirmDeleteUser(user)"
                  :disabled="isDeleting[user.uid] || isCurrentUser(user.uid)"
                  class="delete-user-btn"
                  :class="{ 'deleting': isDeleting[user.uid] }"
                  :title="isCurrentUser(user.uid) ? 'Cannot delete your own account' : 'Delete user'"
                >
                  <span v-if="isDeleting[user.uid]" class="deleting-spinner"></span>
                  <span v-else>🗑️</span>
                  {{ isDeleting[user.uid] ? 'Deleting...' : 'Delete' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Loading indicator -->
      <div 
        v-if="shouldShowLoadingIndicator" 
        ref="loadingIndicatorRef"
        class="loading-indicator" 
        :class="{ 'full-height': users.length === 0, 'loading': isLoading }"
      >
        <div class="loading-spinner" v-if="isLoading"></div>
        <p v-if="isLoading">{{ 
          users.length === 0 ? 'Loading users...' : 'Loading more users...' 
        }}</p>
        <button 
          v-else-if="!isAllLoaded" 
          @click="loadMoreUsers" 
          class="load-more-button"
          :disabled="isLoading"
        >
          Load More Users
        </button>
      </div>
      
      <!-- End of results message -->
      <div v-if="!isLoading && isAllLoaded && users.length > 0" class="end-of-results">
        <p>No more users to load</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useStore } from 'vuex';
import AdminService from '../services/AdminService';

// Props
const props = defineProps({
  searchQuery: {
    type: String,
    default: ''
  }
});

// Emits
const emit = defineEmits(['update:loading', 'update:error', 'user-deleted']);

const store = useStore();

// Refs
const userListRef = ref(null);
const loadingIndicatorRef = ref(null);
const users = ref([]);
const isLoading = ref(false);
const isAllLoaded = ref(false);
const currentPage = ref(1);
const isUpdating = ref({});
const isDeleting = ref({});
const error = ref(null);

// Computed
const currentUserId = computed(() => store.getters['auth/user']?.id);
const currentUserUid = computed(() => store.getters['auth/user']?.uid);

const shouldShowLoadingIndicator = computed(() => {
  return isLoading.value || (!isAllLoaded.value && users.value.length > 0);
});

const shouldShowEmptyState = computed(() => {
  return !isLoading.value && isAllLoaded.value && users.value.length === 0;
});

const isCurrentUser = computed(() => (userUid) => {
  return userUid === currentUserUid.value;
});

// Methods
const formatDate = (dateString) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const loadUsers = async (reset = false) => {
  if (isLoading.value || (isAllLoaded.value && !reset)) return;
  
  isLoading.value = true;
  error.value = null;
  emit('update:loading', true);
  
  try {
    const params = {
      skip: reset ? 0 : (currentPage.value - 1) * 15,
      limit: 15,
    };
    
    if (props.searchQuery.trim()) {
      params.search = props.searchQuery.trim();
    }
    
    const response = await AdminService.getUsers(params);
    
    if (response.success) {
      if (reset) {
        users.value = response.users;
        currentPage.value = 1;
      } else {
        users.value.push(...response.users);
      }
      
      // Use the has_more flag from the backend response
      isAllLoaded.value = !response.has_more;
      
      if (!isAllLoaded.value) {
        currentPage.value += 1;
      }
    } else {
      error.value = response.error;
      emit('update:error', response.error);
      console.error('Failed to load users:', response.error);
    }
  } catch (err) {
    error.value = 'Failed to load users';
    emit('update:error', 'Failed to load users');
    console.error('Error loading users:', err);
  } finally {
    isLoading.value = false;
    emit('update:loading', false);
  }
};

const loadMoreUsers = () => {
  loadUsers(false);
};

const confirmDeleteUser = (user) => {
  const emailStr = userEmail(user) || 'no-email';
  const confirmMessage = `Are you sure you want to delete user "${user.display_name}" (${emailStr})?\n\nThis action cannot be undone and will permanently remove:\n- The user account\n- All messages authored by this user\n- All user relationships and saved data`;
  
  if (confirm(confirmMessage)) {
    deleteUser(user);
  }
};

const deleteUser = async (user) => {
  if (isDeleting.value[user.uid]) return;
  
  isDeleting.value[user.uid] = true;
  
  try {
    console.log('[UserList] Deleting user:', user.uid, user.display_name);
    const response = await AdminService.deleteUser(user.uid);
    
    if (response.success) {
      // Remove user from local list
      users.value = users.value.filter(u => u.uid !== user.uid);
      
      // Show success message
      store.commit('ui/SET_SUCCESS', response.message || `User ${user.display_name} deleted successfully`);
      
      // Emit success to parent for stats refresh
      emit('user-deleted', user);
      
      console.log('[UserList] User deleted successfully:', user.uid);
    } else {
      console.error('[UserList] Failed to delete user:', response.error);
      store.commit('ui/SET_ERROR', response.error || 'Failed to delete user');
    }
  } catch (error) {
    console.error('[UserList] Error deleting user:', error);
    store.commit('ui/SET_ERROR', 'An unexpected error occurred while deleting the user');
  } finally {
    delete isDeleting.value[user.uid];
  }
};

// Watch for search query changes
watch(() => props.searchQuery, () => {
  isAllLoaded.value = false;
  loadUsers(true);
});

// Initialize
onMounted(() => {
  loadUsers(true);
});

// Expose methods for parent component
defineExpose({
  loadUsers,
  refresh: () => loadUsers(true)
});

// Helpers
function userEmail(u) {
  try {
    // Prefer contacts[] email
    if (Array.isArray(u.contacts)) {
      const c = u.contacts.find(c => c && c.type === 'email' && typeof c.value === 'string' && c.value.trim());
      if (c) return c.value;
    }
  } catch (e) {}
  return '';
}
</script>

<style scoped>
.user-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
  height: 100%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: var(--space-xl);
  text-align: center;
  color: var(--color-text-secondary);
}

.users-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
}

.user-list-item {
  width: 100%;
}

.user-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-md);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.user-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.user-main-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.user-name {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
}

.user-email {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.user-tag {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.user-metadata {
  display: flex;
  gap: var(--space-md);
}

.user-dates {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.user-date {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.user-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-sm);
}

.status-badges {
  display: flex;
  gap: var(--space-xs);
  flex-wrap: wrap;
}

.status-badge {
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.admin-badge {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}

 

.whitelist-badge {
  background: var(--color-success, #10b981);
  color: var(--color-text-inverse);
}

.guest-badge {  
  background: var(--color-text-secondary);
  color: var(--color-text-inverse);
}

.user-actions {
  display: flex;
  gap: var(--space-xs);
  flex-wrap: wrap;
}

.action-btn {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: var(--font-size-xs);
  font-weight: 500;
  transition: all var(--transition-fast);
}

.action-btn:hover:not(:disabled) {
  background: var(--color-hover-overlay);
}

.action-btn.active {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-primary);
}

.action-btn.admin-btn.active {
  background: var(--color-warning, #f59e0b);
  border-color: var(--color-warning, #f59e0b);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--color-text-secondary);
  text-align: center;
  flex-direction: column;
  gap: 12px;
  margin-top: var(--space-sm);
  padding: var(--space-md);
  min-height: 50px;
}

.loading-indicator.full-height {
  height: 160px;
}

.loading-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border);
  border-top: 3px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.load-more-button {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-lg);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.load-more-button:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
}

.load-more-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.end-of-results {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--space-md);
  color: var(--color-text-secondary);
  text-align: center;
  font-size: var(--font-size-sm);
  opacity: 0.7;
}

/* Delete user button styles */
.actions-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  align-items: flex-end;
}

.delete-user-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-error, #ef4444);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-error, #ef4444);
  cursor: pointer;
  font-size: var(--font-size-xs);
  font-weight: 500;
  transition: all var(--transition-fast);
  min-width: 80px;
  justify-content: center;
}

.delete-user-btn:hover:not(:disabled) {
  background: var(--color-error, #ef4444);
  color: var(--color-text-inverse);
}

.delete-user-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.delete-user-btn.deleting {
  background: var(--color-error, #ef4444);
  color: var(--color-text-inverse);
}

.deleting-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
</style> 