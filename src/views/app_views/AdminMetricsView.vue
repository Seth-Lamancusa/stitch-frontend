<template>
  <TabViewLayout>
    <div class="admin-metrics-view">
      <div class="page-header">
        <h1 class="page-title">Messages per day by user</h1>
        <p class="page-description">Aggregated message counts by calendar day and author. Admin only.</p>
      </div>

      <div class="filters">
        <div class="filter-row">
          <label for="admin-metrics-from">From date</label>
          <input
            id="admin-metrics-from"
            v-model="fromDate"
            type="date"
            class="filter-input"
            aria-label="Start date YYYY-MM-DD"
          />
          <label for="admin-metrics-to">To date</label>
          <input
            id="admin-metrics-to"
            v-model="toDate"
            type="date"
            class="filter-input"
            aria-label="End date YYYY-MM-DD"
          />
          <label for="admin-metrics-limit">Limit</label>
          <select
            id="admin-metrics-limit"
            v-model.number="limit"
            class="filter-select"
            aria-label="Max rows"
          >
            <option :value="100">100</option>
            <option :value="500">500</option>
            <option :value="1000">1000</option>
            <option :value="5000">5000</option>
            <option :value="10000">10000</option>
          </select>
          <button
            type="button"
            class="refresh-btn"
            :disabled="loading"
            aria-label="Refresh"
            @click="fetchData"
          >
            {{ loading ? 'Loading...' : 'Refresh' }}
          </button>
        </div>
      </div>

      <div v-if="error" class="error-message" role="alert">
        {{ error }}
      </div>

      <div v-if="loading && rows.length === 0" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading metrics...</p>
      </div>

      <div v-else-if="rows.length === 0" class="empty-state">
        <p>No data. Adjust filters and click Refresh, or there are no messages in the selected range.</p>
      </div>

      <div v-else class="table-wrapper">
        <table class="metrics-table" aria-label="Messages per day by user">
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">User</th>
              <th scope="col">Message count</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in rows" :key="`${row.day}-${row.user_uid}-${idx}`">
              <td>{{ row.day }}</td>
              <td>{{ row.user_tag || row.user_uid || '—' }}</td>
              <td class="num">{{ row.message_count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </TabViewLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import TabViewLayout from '../../components/layouts/TabViewLayout.vue';
import { getMessagesPerDay } from '../../services/AdminService.js';

const rows = ref([]);
const loading = ref(false);
const error = ref('');
const fromDate = ref('');
const toDate = ref('');
const limit = ref(1000);

async function fetchData() {
  error.value = '';
  loading.value = true;
  try {
    const params = { limit: limit.value };
    if (fromDate.value) params.from_date = fromDate.value;
    if (toDate.value) params.to_date = toDate.value;
    rows.value = await getMessagesPerDay(params);
  } catch (err) {
    const msg = err.response?.data?.detail || err.message || 'Failed to load metrics';
    error.value = msg;
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchData();
});
</script>

<style scoped>
.admin-metrics-view {
  padding: 8px;
  max-width: 960px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 1rem;
}

.page-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
}

.page-description {
  font-size: 0.875rem;
  color: var(--color-text-secondary, #666);
  margin: 0;
}

.filters {
  margin-bottom: 1rem;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
}

.filter-row label {
  font-size: 0.875rem;
}

.filter-input,
.filter-select {
  padding: 0.35rem 0.5rem;
  font-size: 0.875rem;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 4px;
}

.refresh-btn {
  padding: 0.35rem 0.75rem;
  font-size: 0.875rem;
  cursor: pointer;
  background: var(--color-primary, #333);
  color: var(--color-primary-inverse, #1d1d1d);
  border: none;
  border-radius: 4px;
}

.refresh-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  padding: 0.75rem;
  margin-bottom: 1rem;
  background: #f8d7da;
  color: #721c24;
  border-radius: 4px;
  font-size: 0.875rem;
}

.loading-state,
.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--color-text-secondary, #666);
  font-size: 0.875rem;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  margin: 0 auto 0.5rem auto;
  border: 2px solid var(--color-border, #ccc);
  border-top-color: var(--color-primary, #333);
  border-radius: 50%;
  animation: admin-metrics-spin 0.8s linear infinite;
}

@keyframes admin-metrics-spin {
  to { transform: rotate(360deg); }
}

.table-wrapper {
  overflow-x: auto;
}

.metrics-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.metrics-table th,
.metrics-table td {
  padding: 0.5rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border, #eee);
}

.metrics-table th {
  font-weight: 600;
  background: var(--color-surface, #f5f5f5);
}

.metrics-table td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
