<template>
  <TabViewLayout>
    <div class="search-view">
      <!-- Search description -->
      <div class="mode-description">
        <span class="info-icon">ℹ</span>
        <p>Search results show messages visible to you that match your search criteria (tags and content). Results include both public messages and private messages you have access to.</p>
      </div>
      
      <div class="search-controls">
        <div v-if="similarToMessage" class="similar-to-row">
          <span class="preview-label">Similar to:</span>
          <MessagePreview :message="similarToMessage" displayMode="single-line" />
          <button class="clear-similar" @click="clearSimilarTo" title="Clear similarity search">✕</button>
        </div>
        <div class="query-row">
          <input v-model="q" class="query-input" type="text" placeholder="Search content" @keydown.enter="runSearch" />
          <TagDropdown
            :available-tags="availableTags"
            :selected-tags="tags"
            placeholder="Filter by tags"
            selected-label="Selected tags"
            log-label="SearchView TagDropdown"
            @select="handleTagSelected"
          />
          <select v-model="match" class="match-select" aria-label="Match mode">
            <option value="any">any tag</option>
            <option value="all">all tags</option>
          </select>
          <button class="search-btn" @click="runSearch">Search</button>
        </div>
        <div v-if="tags.length" class="tags-chips">
          <span v-for="(t, i) in tags" :key="t + ':' + i" class="tag-chip">#{{ t }}
            <button class="remove-tag" @click="removeTag(i)" aria-label="Remove tag">×</button>
          </span>
        </div>
      </div>

      <MessageList v-if="results.length" mode="custom" :customMessages="results" :hideHeader="true" />
      <div v-else class="empty-state">Search by content with filtration by tags.</div>
    </div>
  </TabViewLayout>
  
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import TabViewLayout from '../../components/layouts/TabViewLayout.vue';
import MessageList from '../../components/MessageList.vue';
import TagDropdown from '../../components/TagDropdown.vue';
import MessagePreview from '../../components/MessagePreview.vue';
import MessageService from '../../services/MessageService.js';
import { useStore } from 'vuex';

const route = useRoute();
const router = useRouter();
const store = useStore();

const q = ref('');
const tags = ref([]);
const availableTags = ref([]);
const match = ref('any');
const results = ref([]);
const isLoadingTags = ref(false);
const similarToMessageId = ref(route.query.similar_to || null);

const similarToMessage = computed(() => {
  if (!similarToMessageId.value) return null;
  return store.getters['messages/getMessage'](similarToMessageId.value);
});

const clearSimilarTo = () => {
  similarToMessageId.value = null;
  const newQuery = { ...route.query };
  delete newQuery.similar_to;
  router.replace({ query: newQuery });
  runSearch();
};

const fetchTags = async () => {
  try {
    isLoadingTags.value = true;
    const resp = await MessageService.getAllTags();
    availableTags.value = Array.isArray(resp?.data) ? resp.data : [];
  } catch (e) {
    console.error('[SearchView] fetch tags error', e);
    availableTags.value = [];
  } finally {
    isLoadingTags.value = false;
  }
};

const handleTagSelected = (tag) => {
  if (!tag) return;
  if (!tags.value.includes(tag)) {
    tags.value.push(tag);
  }
};

const removeTag = (i) => { 
  if (i >= 0 && i < tags.value.length) {
    tags.value.splice(i, 1);
  }
};

const runSearch = async () => {
  try {
    if (similarToMessageId.value) {
      // 1. Ensure source message is in store for the preview
      if (!similarToMessage.value) {
        await store.dispatch('messages/loadMessage', similarToMessageId.value);
      }

      const resp = await MessageService.getSimilarMessages(similarToMessageId.value, 15);
      results.value = Array.isArray(resp?.data) ? resp.data : [];
    } else {
      const resp = await MessageService.search({ q: q.value || null, tags: tags.value, match: match.value, skip: 0, limit: 15 });
      const data = resp?.data || {};
      results.value = Array.isArray(data.messages) ? data.messages : [];
    }
  } catch (e) {
    console.error('[SearchView] search error', e);
    results.value = [];
  }
};

onMounted(() => {
  fetchTags();
});

watch(
  () => tags.value.slice(),
  () => {
    runSearch();
  }
);
</script>

<style scoped>
.search-view { 
  padding: 8px; 
  max-width: 50%; 
  margin: 0 auto; 
}

@media (max-width: 768px) {
  .search-view {
    max-width: 100%;
    padding: 8px 4px;
  }
}

.search-controls { margin-bottom: 16px; width: 100%; }

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

.query-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.query-input { flex: 1; min-width: 180px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); }
.search-btn, .match-select { padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); cursor: pointer; }
.tags-chips { display: block; margin-top: 6px; max-height: 250px; overflow-y: auto; padding: 4px; }
.tag-chip { display: inline-flex; align-items: center; gap: 4px; padding: 6px 8px; border: 1px solid var(--color-border); border-radius: 6px; font-size: var(--font-size-xs); background: var(--color-surface); color: var(--color-text); margin: 2px 6px 2px 0; }
.remove-tag { background: none; border: none; color: var(--color-text-secondary); cursor: pointer; font-size: 14px; padding: 0 4px; }
.remove-tag:hover { color: var(--color-error); }
.empty-state { padding: 12px; color: var(--color-text-secondary); font-style: italic; }

.mode-description {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  width: 80%;
  padding: var(--space-md);
  margin: 0 auto var(--space-md) auto;
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
}

.mode-description .info-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: var(--color-surface-light);
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  font-weight: 600;
  font-style: normal;
  margin-top: 2px;
}

.mode-description p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

@media (max-width: 480px) {
  .mode-description {
    width: calc(100% - var(--space-md) * 2);
    margin: 0 auto var(--space-md) auto;
    padding: var(--space-sm);
  }
}
</style>


