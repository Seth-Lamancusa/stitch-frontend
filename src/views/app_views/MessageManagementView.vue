<template>
  <AppViewLayout>
    <!-- Admin Access Denied Notice -->
    <div v-if="!isAdmin && authReady" class="access-denied-notice">
      <div class="denial-content">
        <div class="denial-icon">🚫</div>
        <h3>Access Denied</h3>
        <p>You need administrator privileges to access message management.</p>
        <router-link to="/admin" class="back-link">← Back to Admin Dashboard</router-link>
      </div>
    </div>

    <!-- Loading State -->
    <div v-else-if="!authReady" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Checking admin privileges...</p>
    </div>

    <!-- Message Management Content -->
    <div v-else class="message-management-view">
      <div class="view-header">
        <div class="header-content">
          <div class="breadcrumb">
            <router-link to="/admin" class="breadcrumb-link">Admin</router-link>
            <span class="breadcrumb-separator">›</span>
            <span class="breadcrumb-current">Message Management</span>
          </div>
          <h1>Message Management</h1>
          <p class="view-subtitle">Monitor, moderate, and manage platform messages</p>
        </div>
        
        <!-- Message Stats -->
        <div v-if="stats" class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ stats.total_messages }}</div>
            <div class="stat-label">Total Messages</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats.public_messages }}</div>
            <div class="stat-label">Public Messages</div>
          </div>
        </div>
      </div>

      <!-- Message List in Admin Mode -->
      <MessageList mode="admin" />
    </div>
  </AppViewLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import AppViewLayout from '../../components/layouts/AppViewLayout.vue';
import MessageList from '../../components/MessageList.vue';
import AdminService from '../../services/AdminService';

const store = useStore();
const router = useRouter();

// Authentication state
const user = computed(() => store.getters['auth/user']);
const isAdmin = computed(() => store.getters['auth/isAdmin']);
const authReady = computed(() => store.getters['auth/authReady']);

// Simple stats
const stats = ref(null);

// Load statistics
const loadStats = async () => {
  try {
    const response = await AdminService.getStats();
    if (response.success) {
      stats.value = response.stats;
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
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
  }

  // Load stats if admin
  if (authReady.value && isAdmin.value) {
    loadStats();
  }
});
</script>

<style scoped>
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

.message-management-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.view-header {
  background: var(--color-surface, #222);
  border-bottom: 1px solid var(--color-border, #eee);
  padding: var(--space-lg, 24px);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  margin-bottom: var(--space-lg, 24px);
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-md, 16px);
  max-width: 600px;
  margin: 0 auto;
}

.stat-card {
  background: var(--color-background, #111);
  border: 1px solid var(--color-border, #333);
  border-radius: var(--radius-sm, 4px);
  padding: var(--space-md, 16px);
  text-align: center;
}

.stat-value {
  font-size: var(--font-size-xl, 1.5rem);
  font-weight: 600;
  color: var(--color-primary, #4f8cff);
  margin-bottom: var(--space-xs, 6px);
}

.stat-label {
  font-size: var(--font-size-sm, 0.9rem);
  color: var(--color-text-secondary, #aaa);
}
</style> 