<template>
  <TabViewLayout>
    <!-- Admin Access Denied Notice -->
    <div v-if="!isAdmin && authReady" class="access-denied-notice">
      <div class="denial-content">
        <div class="denial-icon">🚫</div>
        <h3>Access Denied</h3>
        <p>You need administrator privileges to access this page.</p>
        <router-link to="/inbox" class="back-link">← Back to Inbox</router-link>
      </div>
    </div>

    <!-- Loading State -->
    <div v-else-if="!authReady" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Checking admin privileges...</p>
    </div>

    <!-- Admin Dashboard -->
    <div v-else class="admin-dashboard">
      <div class="admin-header">
        <h1>Admin Dashboard</h1>
        <p class="admin-subtitle">Manage users, content, and system settings</p>
      </div>

      <div class="admin-grid">
        <!-- User Management Card -->
        <div class="admin-card">
          <div class="card-header">
            <h3>👥 User Management</h3>
            <span v-if="stats" class="card-badge">{{ stats.total_users }} users</span>
          </div>
          <div class="card-content">
            <p>Manage user accounts and permissions</p>
            <div class="card-actions">
              <router-link to="/admin/users" class="admin-btn primary">
                Manage Users
              </router-link>
            </div>
          </div>
        </div>

        <!-- Message Management Card -->
        <div class="admin-card">
          <div class="card-header">
            <h3>💬 Message Management</h3>
            <span v-if="stats" class="card-badge">{{ stats.total_messages }} messages</span>
          </div>
          <div class="card-content">
            <p>Monitor, moderate, and manage platform messages</p>
            <div class="card-actions">
              <router-link to="/admin/messages" class="admin-btn primary">
                Manage Messages
              </router-link>
            </div>
          </div>
        </div>


        <!-- System Settings Card
        <div class="admin-card">
          <div class="card-header">
            <h3>⚙️ System Settings</h3>
          </div>
          <div class="card-content">
            <p>Configure platform settings and system parameters</p>
            <div class="card-actions">
              <button class="admin-btn primary" @click="openSystemSettings">
                System Settings
              </button>
            </div>
          </div>
        </div> -->

        <!-- Analytics Card
        <div class="admin-card">
          <div class="card-header">
            <h3>📊 Analytics</h3>
          </div>
          <div class="card-content">
            <p>View platform usage statistics and performance metrics</p>
            <div class="card-actions">
              <button class="admin-btn primary" @click="openAnalytics">
                View Analytics
              </button>
            </div>
          </div>
        </div> -->
      </div>

      <!-- Metrics Section -->
      <div class="metrics-section">
        <h2>📊 System Metrics</h2>
        <div v-if="metrics" class="metrics-grid">
          <!-- Authentication Metrics -->
          <div class="metrics-card">
            <h3>🔐 Authentication</h3>
            <div class="metrics-content">
              <div class="metric-group">
                <h4>Successful Logins</h4>
                <div class="metric-item" v-if="successfulLoginsTotal > 0">
                  <span class="metric-value">{{ successfulLoginsTotal }}</span>
                </div>
                <div class="metric-item" v-else>
                  <span class="metric-value no-data">No login data</span>
                </div>
              </div>
              <div class="metric-group">
                <h4>Unsuccessful Logins</h4>
                <div class="metric-item">
                  <span class="metric-value">{{ metrics['🔐 Authentication Metrics']['Unsuccessful Logins'] }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Message Metrics -->
          <div class="metrics-card">
            <h3>💬 Message Activity</h3>
            <div class="metrics-content">
              <div class="metric-group">
                <h4>Messages Created</h4>
                <div class="metric-item" v-if="messagesCreatedTotal > 0">
                  <span class="metric-value">{{ messagesCreatedTotal }}</span>
                </div>
                <div class="metric-item" v-else>
                  <span class="metric-value no-data">No message data</span>
                </div>
              </div>
              <div class="metric-group">
                <h4>Reformat Requests</h4>
                <div class="metric-item">
                  <span class="metric-value">{{ metrics['💬 Message Metrics']['Reformat Requests'] }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else-if="metricsError" class="metrics-error">
          <p>{{ metricsError }}</p>
          <button @click="loadMetrics" class="admin-btn secondary">Retry</button>
        </div>
        <div v-else class="metrics-loading">
          <div class="loading-spinner"></div>
          <p>Loading metrics...</p>
        </div>
        
        <!-- Metrics Actions -->
        <div class="metrics-actions">
          <button @click="loadMetrics" class="admin-btn secondary">
            🔄 Refresh Metrics
          </button>
          <button @click="resetMetrics" class="admin-btn secondary" :disabled="isResettingMetrics">
            {{ isResettingMetrics ? '⏳ Resetting...' : '🗑️ Reset Metrics' }}
          </button>
        </div>
      </div>

      <!-- Quick Actions
      <div class="quick-actions">
        <h3>Quick Actions</h3>
        <div class="action-buttons">
          <button class="admin-btn secondary" @click="exportData">
            📥 Export Data
          </button>
          <button class="admin-btn secondary" @click="viewLogs">
            📄 View Logs
          </button>
          <button class="admin-btn secondary" @click="systemHealthCheck">
            🏥 System Health
          </button>
        </div>
      </div> -->
    </div>
  </TabViewLayout>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import TabViewLayout from '../../components/layouts/TabViewLayout.vue';
import AdminService from '../../services/AdminService';

const store = useStore();
const router = useRouter();

// Authentication state
const user = computed(() => store.getters['auth/user']);
const isAdmin = computed(() => store.getters['auth/isAdmin']);
const authReady = computed(() => store.getters['auth/authReady']);

// Stats and metrics data
const stats = ref(null);
const metrics = ref(null);
const metricsError = ref(null);
const isResettingMetrics = ref(false);

// Derived totals for metrics (handles number or object)
const successfulLoginsTotal = computed(() => {
  try {
    const section = metrics.value && metrics.value['🔐 Authentication Metrics'];
    const raw = section && section['Successful Logins'];
    if (typeof raw === 'number') return raw;
    if (raw && typeof raw === 'object') {
      return Object.values(raw).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
    }
    return 0;
  } catch (_) {
    return 0;
  }
});

const messagesCreatedTotal = computed(() => {
  try {
    const section = metrics.value && metrics.value['💬 Message Metrics'];
    const raw = section && section['Messages Created'];
    if (typeof raw === 'number') return raw;
    if (raw && typeof raw === 'object') {
      return Object.values(raw).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
    }
    return 0;
  } catch (_) {
    return 0;
  }
});

// Redirect non-admin users after auth is ready
onMounted(() => {
  // Watch for auth state changes and redirect if not admin
  store.watch(
    () => store.getters['auth/authReady'],
    (ready) => {
      if (ready && !store.getters['auth/isAdmin']) {
        router.push('/inbox');
      }
    }
  );

  // If already ready and not admin, redirect immediately
  if (authReady.value && !isAdmin.value) {
    router.push('/inbox');
  }

  // Load dashboard data and metrics
  loadDashboardData();
  loadMetrics();
});

const loadDashboardData = async () => {
  try {
    const response = await AdminService.getStats();
    if (response.success) {
      stats.value = response.stats;
    }
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
};

const loadMetrics = async () => {
  try {
    metricsError.value = null;
    metrics.value = null;
    const response = await AdminService.getMetrics();
    if (response.success) {
      metrics.value = response.metrics;
    } else {
      metricsError.value = response.error;
    }
  } catch (error) {
    console.error('Error loading metrics:', error);
    metricsError.value = 'Failed to load metrics. Please try again.';
  }
};

const resetMetrics = async () => {
  try {
    isResettingMetrics.value = true;
    const response = await AdminService.resetMetrics();
    if (response.success) {
      // After successful reset, reload metrics
      await loadMetrics();
      console.log('Metrics reset successfully');
    } else {
      metricsError.value = response.error || 'Failed to reset metrics';
    }
  } catch (error) {
    console.error('Error resetting metrics:', error);
    metricsError.value = 'Failed to reset metrics. Please try again.';
  } finally {
    isResettingMetrics.value = false;
  }
};

// Placeholder functions for future features
const openSystemSettings = () => {
  console.log('Opening system settings...');
  // TODO: Implement system settings functionality
};

const openAnalytics = () => {
  console.log('Opening analytics...');
  // TODO: Implement analytics functionality
};

const exportData = () => {
  console.log('Exporting data...');
  // TODO: Implement data export functionality
};

const viewLogs = () => {
  console.log('Viewing logs...');
  // TODO: Implement log viewing functionality
};

const systemHealthCheck = () => {
  console.log('Running system health check...');
  // TODO: Implement system health check functionality
};
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

.admin-dashboard {
  padding: var(--space-lg, 24px);
  max-width: 1200px;
  margin: 0 auto;
}

.admin-header {
  margin-bottom: var(--space-xl, 32px);
  text-align: center;
}

.admin-header h1 {
  margin: 0 0 var(--space-sm, 12px) 0;
  color: var(--color-text, #fff);
  font-size: var(--font-size-xl, 2rem);
}

.admin-subtitle {
  margin: 0;
  color: var(--color-text-secondary, #aaa);
  font-size: var(--font-size-md, 1rem);
}

.admin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-lg, 24px);
  margin-bottom: var(--space-xl, 32px);
}

.admin-card {
  background: var(--color-surface, #222);
  border: 1px solid var(--color-border, #eee);
  border-radius: var(--radius-md, 8px);
  padding: var(--space-lg, 24px);
  transition: transform var(--transition-fast, 0.2s);
}

.admin-card:hover {
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md, 16px);
}

.card-header h3 {
  margin: 0;
  color: var(--color-text, #fff);
  font-size: var(--font-size-lg, 1.25rem);
}

.card-badge {
  background: var(--color-primary, #4f8cff);
  color: var(--color-text-inverse, #fff);
  padding: 4px 12px;
  border-radius: var(--radius-sm, 4px);
  font-size: var(--font-size-xs, 0.75rem);
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.card-content p {
  margin: 0 0 var(--space-md, 16px) 0;
  color: var(--color-text-secondary, #aaa);
  line-height: 1.5;
}

.card-actions {
  display: flex;
  gap: var(--space-sm, 12px);
}

.admin-btn {
  padding: var(--space-sm, 12px) var(--space-md, 16px);
  border: none;
  border-radius: var(--radius-sm, 4px);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast, 0.2s);
  font-size: var(--font-size-sm, 0.9rem);
}

.admin-btn.primary {
  background-color: var(--color-primary, #4f8cff);
  color: var(--color-text-inverse, #fff);
}

.admin-btn.primary:hover {
  background-color: var(--color-primary-dark, #357ae8);
}

.admin-btn.secondary {
  background-color: transparent;
  color: var(--color-text, #fff);
  border: 1px solid var(--color-border, #eee);
}

.admin-btn.secondary:hover {
  background-color: var(--color-hover-overlay, #333);
}

.quick-actions {
  background: var(--color-surface, #222);
  border: 1px solid var(--color-border, #eee);
  border-radius: var(--radius-md, 8px);
  padding: var(--space-lg, 24px);
}

.quick-actions h3 {
  margin: 0 0 var(--space-md, 16px) 0;
  color: var(--color-text, #fff);
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm, 12px);
}

.metrics-section {
  margin-top: var(--space-xl, 32px);
  background: var(--color-surface, #222);
  border: 1px solid var(--color-border, #eee);
  border-radius: var(--radius-md, 8px);
  padding: var(--space-lg, 24px);
}

.metrics-section h2 {
  margin: 0 0 var(--space-lg, 24px) 0;
  color: var(--color-text, #fff);
  font-size: var(--font-size-lg, 1.25rem);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-lg, 24px);
}

.metrics-card {
  background: var(--color-surface-elevated, #2a2a2a);
  border: 1px solid var(--color-border, #eee);
  border-radius: var(--radius-md, 8px);
  padding: var(--space-lg, 24px);
}

.metrics-card h3 {
  margin: 0 0 var(--space-md, 16px) 0;
  color: var(--color-text, #fff);
  font-size: var(--font-size-md, 1rem);
}

.metrics-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg, 24px);
}

.metric-group {
  border-left: 2px solid var(--color-primary, #4f8cff);
  padding-left: var(--space-md, 16px);
}

.metric-group h4 {
  margin: 0 0 var(--space-sm, 12px) 0;
  color: var(--color-text-secondary, #aaa);
  font-size: var(--font-size-sm, 0.9rem);
  font-weight: 500;
}

.metric-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-xs, 8px);
}

.metric-label {
  color: var(--color-text-secondary, #aaa);
  font-size: var(--font-size-sm, 0.9rem);
}

.metric-value {
  color: var(--color-text, #fff);
  font-size: var(--font-size-sm, 0.9rem);
  font-weight: 500;
}

.metric-value.no-data {
  color: var(--color-text-secondary, #aaa);
  font-style: italic;
  opacity: 0.7;
}

.metrics-error {
  text-align: center;
  padding: var(--space-lg, 24px);
  color: var(--color-error, #ff4f4f);
}

.metrics-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md, 16px);
  padding: var(--space-lg, 24px);
}

.metrics-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-md, 16px);
  padding-top: var(--space-md, 16px);
  border-top: 1px solid var(--color-border, #eee);
  gap: var(--space-sm, 12px);
}

.metrics-actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Mobile responsive styles */
@media (max-width: 768px) {
  .admin-dashboard {
    padding: var(--space-md);
  }
  
  .admin-grid {
    grid-template-columns: 1fr; /* Single column on mobile */
    gap: var(--space-sm);
  }
  
  .admin-card {
    padding: var(--space-md);
    margin: 0 4px;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr); /* 2 columns instead of auto-fit */
  }
  
  .metrics-grid {
    grid-template-columns: 1fr; /* Single column for metrics */
  }
  
  .card-actions {
    flex-direction: column;
    gap: var(--space-xs);
  }
  
  .admin-btn {
    width: 100%;
    text-align: center;
  }
  
  .action-buttons {
    flex-direction: column;
    gap: var(--space-xs);
  }
  
  .metrics-actions {
    flex-direction: column;
    gap: var(--space-xs);
    align-items: stretch;
  }
}

@media (max-width: 480px) {
  .admin-dashboard {
    padding: var(--space-sm);
  }
  
  .stats-grid {
    grid-template-columns: 1fr; /* Single column on very narrow */
  }
  
  .admin-card {
    padding: var(--space-sm);
    margin: 0 2px;
  }
  
  .card-header h3 {
    font-size: var(--font-size-md);
  }
  
  .admin-header h1 {
    font-size: var(--font-size-lg);
  }
  
  .card-badge {
    font-size: calc(var(--font-size-xs) - 1px);
    padding: 2px 8px;
  }
  
  .admin-btn {
    font-size: calc(var(--font-size-sm) - 1px);
    padding: var(--space-xs) var(--space-sm);
  }
}
</style>
