<template>
  <TabViewLayout>
    <div class="admin-admissions-view">
      <nav class="admin-nav" aria-label="Admin">
        <router-link to="/admin/metrics">Metrics</router-link>
        <router-link to="/admin/admissions">Admissions</router-link>
      </nav>
      <div class="page-header">
        <h1 class="page-title">Join lists</h1>
        <p class="page-description">
          Who is on each list, the note they left, whether they can register, and whether they have API access.
          Admit opens registration on a platform list. On an API list it grants API access, and on API beta it also marks them as a tester.
        </p>
      </div>

      <div class="list-switch" role="group" aria-label="Join list">
        <button
          v-for="item in lists"
          :key="item.id"
          type="button"
          class="list-btn"
          :class="{ active: item.id === selected }"
          :aria-pressed="item.id === selected"
          @click="choose(item.id)"
        >
          {{ item.label }}
        </button>
      </div>

      <div v-if="error" class="error-message" role="alert">
        {{ error }}
      </div>

      <div v-if="loading && rows.length === 0" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading list...</p>
      </div>

      <div v-else-if="!error && rows.length === 0 && page === 0" class="empty-state">
        <p>No one is on this list.</p>
      </div>

      <div v-else-if="!error" class="table-wrapper">
        <p v-if="rows.length" class="truncation">
          Showing {{ rangeStart }}–{{ rangeEnd }} of {{ total }}. Newest first.
        </p>
        <p v-else class="empty-state">Nothing else on this list.</p>
        <table v-if="rows.length" class="admissions-table" :aria-label="current.label">
          <thead>
            <tr>
              <th scope="col">Email</th>
              <th scope="col">{{ current.nameLabel }}</th>
              <th scope="col">Joined</th>
              <th scope="col">Note</th>
              <th scope="col">Can register</th>
              <th scope="col">API access</th>
              <th scope="col"><span class="sr-only">Admit</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.email">
              <td>{{ row.email }}</td>
              <td>{{ row.label || '—' }}</td>
              <td>{{ formatWhen(row.requested_at) }}</td>
              <td class="note-cell">{{ row.note || '—' }}</td>
              <td>{{ row.registration_open ? 'Yes' : 'No' }}</td>
              <td>{{ row.api_allowed ? 'Yes' : 'No' }}</td>
              <td class="action-cell">
                <button
                  v-if="!gateOpen(row)"
                  type="button"
                  class="list-btn admit-btn"
                  :disabled="admitting === row.email"
                  :aria-label="`${admitLabel} ${row.email}`"
                  @click="admit(row)"
                >
                  {{ admitting === row.email ? 'Admitting…' : admitLabel }}
                </button>
                <p v-if="actionError && actionError.email === row.email" class="row-error" role="alert">
                  {{ actionError.message }}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="page > 0 || hasNext" class="pager">
          <button type="button" class="list-btn" :disabled="page === 0 || loading" @click="go(page - 1)">
            Previous
          </button>
          <span>Page {{ page + 1 }} of {{ pageCount }}</span>
          <button type="button" class="list-btn" :disabled="!hasNext || loading" @click="go(page + 1)">
            Next
          </button>
        </div>
      </div>
    </div>
  </TabViewLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import TabViewLayout from '../../components/layouts/TabViewLayout.vue';
import { admitAdmission, getAdmissionList } from '../../services/AdminService.js';

const lists = [
  { id: 'platform_waitlist', label: 'Platform waitlist', nameLabel: 'Username' },
  { id: 'platform_beta', label: 'Platform beta', nameLabel: 'Username' },
  { id: 'api_waitlist', label: 'API waitlist', nameLabel: 'Name' },
  { id: 'api_beta', label: 'API beta', nameLabel: 'Name' },
];

const pageSize = 50;

const selected = ref(lists[0].id);
const page = ref(0);
const rows = ref([]);
const total = ref(0);
const loading = ref(false);
const error = ref('');
const admitting = ref('');
const actionError = ref(null);

const current = computed(() => lists.find((item) => item.id === selected.value) || lists[0]);
const admitLabel = computed(() => (current.value.id.startsWith('api_') ? 'Admit to API' : 'Admit to platform'));
const rangeStart = computed(() => (rows.value.length ? page.value * pageSize + 1 : 0));
const rangeEnd = computed(() => page.value * pageSize + rows.value.length);
const hasNext = computed(() => rangeEnd.value < total.value);
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

function gateOpen(row) {
  return current.value.id.startsWith('api_') ? Boolean(row.api_allowed) : Boolean(row.registration_open);
}

function formatWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function choose(id) {
  if (id === selected.value && page.value === 0) return;
  selected.value = id;
  page.value = 0;
  actionError.value = null;
  fetchData();
}

function go(next) {
  if (next < 0 || next === page.value) return;
  if (next > page.value && !hasNext.value) return;
  page.value = next;
  fetchData();
}

async function admit(row) {
  const listName = selected.value;
  const email = row.email;
  actionError.value = null;
  admitting.value = email;
  try {
    const updated = await admitAdmission(listName, email);
    if (selected.value !== listName) return;
    const index = rows.value.findIndex((item) => item.email === email);
    if (index >= 0 && updated && typeof updated === 'object') {
      const next = rows.value.slice();
      next[index] = { ...next[index], ...updated, email };
      rows.value = next;
    }
  } catch (err) {
    if (selected.value !== listName) return;
    actionError.value = {
      email,
      message: err.response?.data?.detail || err.message || 'Could not admit this address',
    };
  } finally {
    if (admitting.value === email) admitting.value = '';
  }
}

async function fetchData() {
  const listName = selected.value;
  const pageIndex = page.value;
  error.value = '';
  rows.value = [];
  total.value = 0;
  loading.value = true;
  try {
    const data = await getAdmissionList(listName, {
      offset: pageIndex * pageSize,
      limit: pageSize,
    });
    if (selected.value !== listName || page.value !== pageIndex) return;
    rows.value = Array.isArray(data.rows) ? data.rows : [];
    total.value = Number.isFinite(data.total) ? data.total : rows.value.length;
  } catch (err) {
    if (selected.value !== listName || page.value !== pageIndex) return;
    error.value = err.response?.data?.detail || err.message || 'Failed to load the list';
    rows.value = [];
    total.value = 0;
  } finally {
    if (selected.value === listName && page.value === pageIndex) loading.value = false;
  }
}

onMounted(fetchData);
</script>

<style scoped>
.admin-admissions-view {
  padding: 8px;
  max-width: 1100px;
  margin: 0 auto;
}

.admin-nav {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

.admin-nav a {
  color: var(--color-text-secondary, #666);
  text-decoration: none;
}

.admin-nav a.router-link-active {
  color: var(--color-text, #111);
  font-weight: 600;
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

.list-switch {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.list-btn {
  padding: 0.35rem 0.75rem;
  font-size: 0.875rem;
  cursor: pointer;
  background: transparent;
  color: var(--color-text, #111);
  border: 1px solid var(--color-border, #ccc);
  border-radius: 4px;
}

.list-btn.active {
  background: var(--color-primary, #333);
  color: var(--color-primary-inverse, #1d1d1d);
  border-color: var(--color-primary, #333);
}

.list-btn:disabled {
  cursor: default;
  opacity: 0.5;
}

.pager {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;
  font-size: 0.875rem;
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
  animation: admin-admissions-spin 0.8s linear infinite;
}

@keyframes admin-admissions-spin {
  to { transform: rotate(360deg); }
}

.truncation {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  color: var(--color-text-secondary, #666);
}

.table-wrapper {
  overflow-x: auto;
}

.admissions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.admissions-table th,
.admissions-table td {
  padding: 0.5rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border, #eee);
}

.admissions-table th {
  font-weight: 600;
  background: var(--color-surface, #f5f5f5);
}

.note-cell {
  max-width: 280px;
  white-space: pre-wrap;
  word-break: break-word;
}

.action-cell {
  white-space: nowrap;
}

.admit-btn {
  background: var(--color-primary, #333);
  color: var(--color-primary-inverse, #fff);
  border-color: var(--color-primary, #333);
}

.row-error {
  margin: 0.35rem 0 0 0;
  color: #721c24;
  font-size: 0.75rem;
  white-space: normal;
  max-width: 160px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
