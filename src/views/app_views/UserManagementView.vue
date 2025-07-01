<template>
  <AppViewLayout>
    <!-- Admin Access Denied Notice -->
    <div v-if="!isAdmin && authReady" class="access-denied-notice">
      <div class="denial-content">
        <div class="denial-icon">🚫</div>
        <h3>Access Denied</h3>
        <p>You need administrator privileges to access user management.</p>
        <router-link to="/admin" class="back-link">← Back to Admin Dashboard</router-link>
      </div>
    </div>

    <!-- Loading State -->
    <div v-else-if="!authReady" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Checking admin privileges...</p>
    </div>

    <!-- User Management Content -->
    <div v-else class="user-management-view">
      <div class="scrollable-content">
        <div class="view-header">
          <div class="header-content">
            <div class="breadcrumb">
              <router-link to="/admin" class="breadcrumb-link">Admin</router-link>
              <span class="breadcrumb-separator">›</span>
              <span class="breadcrumb-current">User Management</span>
            </div>
            <h1>User Management</h1>
            <p class="view-subtitle">Manage user accounts, permissions, and whitelist status</p>
          </div>
        </div>

        <!-- Search and Stats Section -->
        <div class="management-controls">
          <!-- Search Bar
          <div class="search-section">
            <div class="search-container">
              <input
                v-model="searchQuery"
                @input="handleSearch"
                placeholder="Search users by email, name, or tag..."
                class="search-input"
              />
              <button v-if="searchQuery" @click="clearSearch" class="clear-search-btn">×</button>
            </div>
            <div class="search-stats">
              <span v-if="userStats" class="stats-text">
                {{ userStats.total_users }} total users
              </span>
            </div>
          </div> -->

          <!-- User Stats Cards -->
          <div v-if="userStats && !searchQuery" class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">{{ userStats.total_users }}</div>
              <div class="stat-label">Total Users</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ userStats.whitelisted_users }}</div>
              <div class="stat-label">Whitelisted</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ userStats.admin_users }}</div>
              <div class="stat-label">Admins</div>
            </div>
            <div class="stat-card import-card">
              <div class="stat-value">{{ userStats.import_users }}</div>
              <div class="stat-label">Import Users</div>
            </div>
          </div>
        </div>

        <!-- User List Component -->
        <div class="user-list-container">
          <UserList 
            :search-query="debouncedSearchQuery"
            @update:loading="handleLoadingUpdate"
            @update:error="handleErrorUpdate"
          />
        </div>
      </div>
    </div>
  </AppViewLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import AppViewLayout from '../../components/layouts/AppViewLayout.vue';
import UserList from '../../components/UserList.vue';
import AdminService from '../../services/AdminService';

const store = useStore();
const router = useRouter();

// Search and stats state
const searchQuery = ref('');
const debouncedSearchQuery = ref('');
const userStats = ref(null);
const isLoadingStats = ref(false);
const error = ref(null);

// Authentication state
const user = computed(() => store.getters['auth/user']);
const isAdmin = computed(() => store.getters['auth/isAdmin']);
const authReady = computed(() => store.getters['auth/authReady']);

// Methods
const loadUserStats = async () => {
  if (isLoadingStats.value) return;
  
  isLoadingStats.value = true;
  try {
    const response = await AdminService.getStats();
    if (response.success) {
      // Use the actual stats from the API
      userStats.value = {
        total_users: response.stats.total_users || 0,
        whitelisted_users: response.stats.total_whitelisted || 0,
        admin_users: response.stats.total_admin || 0,
        import_users: response.stats.total_import || 0
      };
    }
  } catch (err) {
    console.error('Error loading user stats:', err);
    error.value = 'Failed to load user statistics';
  } finally {
    isLoadingStats.value = false;
  }
};

const handleSearch = () => {
  // Debounce search
  clearTimeout(handleSearch.timeoutId);
  handleSearch.timeoutId = setTimeout(() => {
    debouncedSearchQuery.value = searchQuery.value;
  }, 300);
};

const clearSearch = () => {
  searchQuery.value = '';
  debouncedSearchQuery.value = '';
};

const handleLoadingUpdate = (loading) => {
  // Handle loading state updates from UserList if needed
  // Could be used to show global loading indicators
};

const handleErrorUpdate = (errorMessage) => {
  error.value = errorMessage;
  // Could show a global error notification here
};

// Redirect non-admin users after auth is ready
onMounted(() => {
  // Watch for auth state changes and redirect if not admin
  store.watch(
    () => store.getters['auth/authReady'],
    (ready) => {
      if (ready && !store.getters['auth/isAdmin']) {
        router.push('/admin');
      }
    }
  );

  // If already ready and not admin, redirect immediately
  if (authReady.value && !isAdmin.value) {
    router.push('/admin');
  } else if (authReady.value && isAdmin.value) {
    // Load stats when component mounts and user is admin
    loadUserStats();
  }
});
</script>

<style scoped>
.user-management-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.scrollable-content {
  flex: 1;
  overflow-y: auto;
  padding-bottom: var(--space-lg);
}

.view-header {
  background: var(--color-surface, #222);
  border-bottom: 1px solid var(--color-border, #eee);
  padding: var(--space-lg, 24px);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-xs, 6px);
  margin-bottom: var(--space-sm, 12px);
  font-size: var(--font-size-sm, 0.9rem);
}

.breadcrumb-link {
  color: var(--color-primary, #4f8cff);
  text-decoration: none;
  transition: opacity var(--transition-fast, 0.2s);
}

.breadcrumb-link:hover {
  opacity: 0.8;
}

.breadcrumb-separator {
  color: var(--color-text-secondary, #aaa);
}

.breadcrumb-current {
  color: var(--color-text, #fff);
}

.view-header h1 {
  margin: 0 0 var(--space-sm, 12px) 0;
  color: var(--color-text, #fff);
  font-size: var(--font-size-xl, 2rem);
}

.view-subtitle {
  margin: 0;
  color: var(--color-text-secondary, #aaa);
  font-size: var(--font-size-md, 1rem);
}

.management-controls {
  background: var(--color-surface, #222);
  border-bottom: 1px solid var(--color-border, #eee);
}

.search-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md, 16px);
  padding: var(--space-md, 16px);
  flex-wrap: wrap;
}

.search-container {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-input {
  width: 100%;
  padding: var(--space-sm, 12px) var(--space-md, 16px);
  border: 1px solid var(--color-border, #eee);
  border-radius: var(--radius-sm, 4px);
  background: var(--color-background, #111);
  color: var(--color-text, #fff);
  font-size: var(--font-size-sm, 0.9rem);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary, #4f8cff);
}

.clear-search-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-text-secondary, #aaa);
  cursor: pointer;
  font-size: 20px;
  padding: 4px;
}

.clear-search-btn:hover {
  color: var(--color-text, #fff);
}

.search-stats {
  color: var(--color-text-secondary, #aaa);
  font-size: var(--font-size-sm, 0.9rem);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-md, 16px);
  padding: var(--space-md, 16px);
  margin-bottom: var(--space-sm, 12px);
  max-width: 1200px;
  margin: 0 auto;
}

.stat-card {
  background: var(--color-background, #111);
  border: 1px solid var(--color-border, #eee);
  border-radius: var(--radius-sm, 4px);
  padding: var(--space-md, 16px);
  text-align: center;
}

.stat-value {
  font-size: var(--font-size-xl, 2rem);
  font-weight: 600;
  color: var(--color-primary, #4f8cff);
  margin-bottom: var(--space-xs, 6px);
}

.stat-label {
  font-size: var(--font-size-sm, 0.9rem);
  color: var(--color-text-secondary, #aaa);
}

.user-list-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  padding: 0 var(--space-md, 16px);
}

.access-denied-notice {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
  padding: var(--space-lg, 24px);
}

.denial-content {
  text-align: center;
  background: var(--color-surface, #222);
  border: 1px solid var(--color-border, #eee);
  border-radius: var(--radius-md, 8px);
  padding: var(--space-xl, 32px);
  max-width: 400px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.denial-icon {
  font-size: 3rem;
  margin-bottom: var(--space-md, 16px);
}

.denial-content h3 {
  margin: 0 0 var(--space-sm, 12px) 0;
  color: var(--color-text, #fff);
  font-size: var(--font-size-lg, 1.25rem);
}

.denial-content p {
  margin: 0 0 var(--space-lg, 24px) 0;
  color: var(--color-text-secondary, #aaa);
  line-height: 1.5;
}

.back-link {
  display: inline-block;
  padding: var(--space-sm, 12px) var(--space-md, 16px);
  background-color: var(--color-primary, #4f8cff);
  color: var(--color-text-inverse, #fff);
  text-decoration: none;
  border-radius: var(--radius-sm, 4px);
  font-weight: 500;
  transition: background-color var(--transition-fast, 0.2s);
}

.back-link:hover {
  background-color: var(--color-primary-dark, #357ae8);
}

.loading-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
  gap: var(--space-md, 16px);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--color-border, #eee);
  border-top-color: var(--color-primary, #4f8cff);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style> 