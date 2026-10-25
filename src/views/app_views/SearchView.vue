<template>
  <TabViewLayout>
    <div class="search-view">
      <div class="mode-description">
        <span class="info-icon">ℹ</span>
        <p>Similar ranks messages you can see by overlap with the source. #tags narrow with any or all. @user keeps messages from that author.</p>
      </div>

      <div class="search-controls">
        <div v-if="similarToMessageId" class="similar-to-row">
          <span class="preview-label">Similar to:</span>
          <MessagePreview v-if="similarToMessage" :message="similarToMessage" displayMode="single-line" />
          <span v-else class="preview-pending">Loading message…</span>
          <button class="clear-similar" @click="clearSimilarTo" title="Clear similarity search">✕</button>
        </div>
        <form class="query-row" @submit.prevent="runSearch()">
          <input
            v-model="q"
            class="query-input"
            type="text"
            :placeholder="similarToMessageId ? 'Ranking by the message above' : 'Search content'"
            :disabled="!!similarToMessageId"
          />
          <button class="search-btn" type="submit" :disabled="isLoading">
            {{ isLoading && !results.length ? 'Searching…' : 'Search' }}
          </button>
        </form>
        <div class="filter-row">
          <div class="tag-filter">
            <input
              v-model="tagInput"
              class="user-filter-input"
              type="text"
              placeholder="#tag"
              aria-label="Filter by tag"
              @keydown.enter.prevent="commitTag"
            />
          </div>
          <div class="user-filter" ref="userFilterRef">
            <input
              :value="userFilter"
              class="user-filter-input"
              type="text"
              placeholder="Author"
              aria-label="Filter by author"
              @input="onUserFilterInput"
              @keydown.enter.prevent="selectFirstUser"
            />
            <div v-if="userResults.length" class="user-filter-menu" role="listbox">
              <button
                v-for="user in userResults"
                :key="user.uid || user.user_tag"
                type="button"
                class="user-filter-item"
                @click="addUserTag(user)"
              >
                {{ user.display_name || user.user_tag }}
                <span class="user-filter-tag">@{{ user.user_tag }}</span>
              </button>
            </div>
            <div v-else-if="showNoUsers" class="user-filter-menu">
              <div class="user-filter-empty">No users found</div>
            </div>
          </div>
          <select v-model="match" class="match-select" aria-label="How #tags combine">
            <option value="any">Any tag</option>
            <option value="all">All tags</option>
          </select>
        </div>
        <div class="date-row">
          <label class="date-field">
            From
            <input v-model="fromDate" type="date" :max="toDate || undefined" aria-label="From date" />
          </label>
          <label class="date-field">
            To
            <input v-model="toDate" type="date" :min="fromDate || undefined" aria-label="To date" />
          </label>
        </div>
        <div v-if="tags.length || userTags.length" class="tags-chips">
          <span v-for="(t, i) in tags" :key="'tag:' + t" class="tag-chip">#{{ t }}
            <button class="remove-tag" @click="removeTag(i)" aria-label="Remove tag">×</button>
          </span>
          <span v-for="(u, i) in userTags" :key="'user:' + u.user_tag" class="tag-chip user-chip">@{{ u.user_tag }}
            <button class="remove-tag" @click="removeUserTag(i)" aria-label="Remove user">×</button>
          </span>
        </div>
      </div>

      <MessageList
        v-if="results.length"
        mode="custom"
        :customMessages="results"
        :hideHeader="true"
        external-paging
        :has-more="hasMore"
        :loading-more="isLoading && results.length > 0"
        @load-more="runSearch({ append: true })"
      />
      <div v-else-if="isLoading" class="empty-state">Searching…</div>
      <div v-else-if="error" class="empty-state">{{ error }}</div>
      <div v-else-if="searched" class="empty-state">No messages matched.</div>
      <div v-else class="empty-state">Search by content, or filter with #tags and @users.</div>
    </div>
  </TabViewLayout>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import TabViewLayout from '../../components/layouts/TabViewLayout.vue';
import MessageList from '../../components/MessageList.vue';
import MessagePreview from '../../components/MessagePreview.vue';
import MessageService from '../../services/MessageService.js';
import { useStore } from 'vuex';

const PAGE_SIZE = 15;

const route = useRoute();
const router = useRouter();
const store = useStore();

const similarIdFromRoute = (value) => {
  const id = Array.isArray(value) ? value[0] : value;
  return typeof id === 'string' && id ? id : null;
};

const q = ref('');
const tagInput = ref('');
const tags = ref([]);
const userTags = ref([]);
const fromDate = ref('');
const toDate = ref('');
const match = ref('any');
const results = ref([]);
const hasMore = ref(false);
const isLoading = ref(false);
const error = ref('');
const searched = ref(false);
const similarToMessageId = ref(similarIdFromRoute(route.query.similar_to));
const userFilter = ref('');
const userResults = ref([]);
const userLookupSettled = ref(false);
const userFilterRef = ref(null);
let requestSerial = 0;
let userSearchTimer = null;

const similarToMessage = computed(() => {
  if (!similarToMessageId.value) return null;
  return store.getters['messages/getMessage'](similarToMessageId.value);
});

const authorQuery = () => userFilter.value.trim().replace(/^@/, '');

const showNoUsers = computed(() => (
  userLookupSettled.value && !userResults.value.length && authorQuery().length >= 2
));

const hasCriteria = () => !!(
  similarToMessageId.value
  || q.value.trim()
  || tags.value.length
  || userTags.value.length
  || fromDate.value
  || toDate.value
);

const filterTokens = () => [
  ...tags.value,
  ...userTags.value.map((user) => `@${user.user_tag}`),
];

const clearSimilarTo = () => {
  const newQuery = { ...route.query };
  delete newQuery.similar_to;
  router.replace({ query: newQuery });
};

let skipNextTagWatch = false;

const commitTag = ({ silent = false } = {}) => {
  const raw = tagInput.value.trim();
  if (!raw) return true;
  const name = raw.replace(/^#/, '').toLowerCase();
  if (!/^[a-z0-9-]+$/.test(name)) {
    error.value = 'Tags use letters, numbers, and hyphens.';
    return false;
  }
  tagInput.value = '';
  if (tags.value.includes(name)) return true;
  if (silent) skipNextTagWatch = true;
  tags.value.push(name);
  return true;
};

const removeTag = (i) => {
  if (i >= 0 && i < tags.value.length) tags.value.splice(i, 1);
};

const addUserTag = (user) => {
  const userTag = user && user.user_tag;
  if (!userTag) return;
  if (!userTags.value.some((entry) => entry.user_tag === userTag)) {
    userTags.value.push({ user_tag: userTag, display_name: user.display_name || userTag });
  }
  userFilter.value = '';
  userResults.value = [];
};

const removeUserTag = (i) => {
  if (i >= 0 && i < userTags.value.length) userTags.value.splice(i, 1);
};

const onUserFilterInput = (event) => {
  userFilter.value = event.target.value;
  userLookupSettled.value = false;
  if (userSearchTimer) clearTimeout(userSearchTimer);
  const query = authorQuery();
  if (query.length < 2) {
    userResults.value = [];
    return;
  }
  userSearchTimer = setTimeout(async () => {
    try {
      const found = await store.dispatch('auth/searchUsers', query);
      userResults.value = Array.isArray(found) ? found : [];
    } catch (e) {
      userResults.value = [];
    } finally {
      userLookupSettled.value = true;
    }
  }, 300);
};

const selectFirstUser = () => {
  if (userResults.value.length) addUserTag(userResults.value[0]);
};

const closeUserResults = (event) => {
  if (!userFilterRef.value || userFilterRef.value.contains(event.target)) return;
  userResults.value = [];
};

const runSearch = async ({ append = false } = {}) => {
  if (append && isLoading.value) return;
  if (!append && !commitTag({ silent: true })) return;
  if (fromDate.value && toDate.value && fromDate.value > toDate.value) {
    error.value = 'Start date is after the end date.';
    return;
  }
  if (!append && !hasCriteria()) {
    requestSerial += 1;
    results.value = [];
    hasMore.value = false;
    searched.value = false;
    error.value = '';
    isLoading.value = false;
    return;
  }

  const requestId = ++requestSerial;
  const skip = append ? results.value.length : 0;
  isLoading.value = true;
  error.value = '';
  if (!append) hasMore.value = false;

  try {
    const tokens = filterTokens();
    let messages = [];
    let more = false;
    if (similarToMessageId.value) {
      if (!similarToMessage.value) {
        await store.dispatch('messages/loadMessage', similarToMessageId.value);
      }
      if (requestId !== requestSerial) return;
      const resp = await MessageService.getSimilarMessages(similarToMessageId.value, {
        tags: tokens,
        match: match.value,
        skip,
        limit: PAGE_SIZE,
        from: fromDate.value || null,
        to: toDate.value || null,
      });
      const data = resp?.data || {};
      messages = Array.isArray(data.messages) ? data.messages : [];
      more = !!data.has_more;
    } else {
      const resp = await MessageService.search({
        q: q.value.trim() || null,
        tags: tokens,
        match: match.value,
        skip,
        limit: PAGE_SIZE,
        from: fromDate.value || null,
        to: toDate.value || null,
      });
      const data = resp?.data || {};
      messages = Array.isArray(data.messages) ? data.messages : [];
      more = !!data.has_more;
    }
    if (requestId !== requestSerial) return;
    results.value = append ? results.value.concat(messages) : messages;
    hasMore.value = more;
    searched.value = true;
  } catch (e) {
    console.error('[SearchView] search error', e);
    if (requestId !== requestSerial) return;
    error.value = 'Search failed. Try again.';
    if (!append) results.value = [];
    hasMore.value = false;
    searched.value = true;
  } finally {
    if (requestId === requestSerial) isLoading.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', closeUserResults);
  if (hasCriteria()) runSearch();
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeUserResults);
  if (userSearchTimer) clearTimeout(userSearchTimer);
});

watch(
  () => route.query.similar_to,
  (id) => {
    const next = similarIdFromRoute(id);
    if (next === similarToMessageId.value) return;
    similarToMessageId.value = next;
  }
);

watch(
  () => [
    tags.value.slice(),
    userTags.value.map((user) => user.user_tag),
    match.value,
    fromDate.value,
    toDate.value,
    similarToMessageId.value,
  ],
  () => {
    if (skipNextTagWatch) {
      skipNextTagWatch = false;
      return;
    }
    runSearch();
  }
);
</script>

<style scoped>
.search-view {
  padding: 8px;
  width: 100%;
  box-sizing: border-box;
}

.search-controls {
  width: 70%;
  margin: 0 auto 16px;
  box-sizing: border-box;
}

.similar-to-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.preview-label {
  font-size: var(--font-size-xs);
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.preview-pending {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.similar-to-row :deep(.message-preview) {
  flex: 1;
  min-width: 0;
}

.clear-similar {
  background: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 12px;
  flex-shrink: 0;
  transition: all var(--transition-fast);
}

.clear-similar:hover {
  background-color: var(--color-error-light);
  color: var(--color-error);
  border-color: var(--color-error);
}

.query-row { display: flex; align-items: stretch; }
.query-input {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-right: none;
  border-radius: 6px 0 0 6px;
  background: var(--color-surface);
  color: var(--color-text);
}
.query-input:disabled { opacity: 0.7; }
.query-input:focus { outline: none; border-color: var(--color-primary); }
.search-btn {
  padding: 8px 16px;
  border: 1px solid var(--color-primary);
  border-radius: 0 6px 6px 0;
  background: var(--color-primary);
  color: var(--color-text-inverse);
  cursor: pointer;
  white-space: nowrap;
}
.search-btn:hover { background: var(--color-primary-dark); }
.search-btn:disabled { opacity: 0.7; cursor: wait; }

.filter-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 8px;
}
.match-select {
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}

.tag-filter { flex: 1 1 140px; min-width: 120px; max-width: 200px; }
.user-filter { position: relative; flex: 1 1 180px; min-width: 140px; max-width: 240px; }

.date-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 8px;
}
.date-field {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}
.date-field input {
  padding: 7px 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  color-scheme: dark;
}
.user-filter-input { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); }
.user-filter-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 10;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  max-height: 240px;
  overflow-y: auto;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}
.user-filter-item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}
.user-filter-item:hover { background: var(--color-hover-overlay, #222); }
.user-filter-tag { color: var(--color-text-secondary); }
.user-filter-empty { padding: 8px 12px; color: var(--color-text-secondary); }

@media (max-width: 768px) {
  .search-controls,
  .empty-state { width: 100%; }
}

.tags-chips { display: block; margin-top: 6px; max-height: 250px; overflow-y: auto; padding: 4px; }
.tag-chip { display: inline-flex; align-items: center; gap: 4px; padding: 6px 8px; border: 1px solid var(--color-border); border-radius: 6px; font-size: var(--font-size-xs); background: var(--color-surface); color: var(--color-text); margin: 2px 6px 2px 0; }
.remove-tag { background: none; border: none; color: var(--color-text-secondary); cursor: pointer; font-size: 14px; padding: 0 4px; }
.remove-tag:hover { color: var(--color-error); }
.empty-state {
  width: 70%;
  margin: 0 auto;
  padding: 12px 0;
  color: var(--color-text-secondary);
  font-style: italic;
  box-sizing: border-box;
}
</style>
