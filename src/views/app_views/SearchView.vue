<template>
  <TabViewLayout>
    <div class="search-view">
      <div class="search-controls">
        <div class="query-row">
          <input v-model="q" class="query-input" type="text" placeholder="Search content" @keydown.enter="runSearch" />
          <TagDropdown
            :available-tags="availableTags"
            :selected-tags="tags"
            placeholder="All tags"
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
import { ref, onMounted, watch } from 'vue';
import TabViewLayout from '../../components/layouts/TabViewLayout.vue';
import MessageList from '../../components/MessageList.vue';
import TagDropdown from '../../components/TagDropdown.vue';
import MessageService from '../../services/MessageService.js';

const q = ref('');
const tags = ref([]);
const availableTags = ref([]);
const match = ref('any');
const results = ref([]);
const isLoadingTags = ref(false);

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
    const resp = await MessageService.search({ q: q.value || null, tags: tags.value, match: match.value, skip: 0, limit: 15 });
    const data = resp?.data || {};
    results.value = Array.isArray(data.messages) ? data.messages : [];
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
  max-width: 60%; 
  margin: 0 auto; 
}

@media (max-width: 768px) {
  .search-view {
    max-width: 100%;
    padding: 8px 4px;
  }
}

.search-controls { margin-bottom: 8px; }
.query-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.query-input { flex: 1; min-width: 180px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); }
.search-btn, .match-select { padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); cursor: pointer; }
.tags-chips { display: block; margin-top: 6px; max-height: 250px; overflow-y: auto; padding: 4px; }
.tag-chip { display: inline-flex; align-items: center; gap: 4px; padding: 6px 8px; border: 1px solid var(--color-border); border-radius: 6px; font-size: var(--font-size-xs); background: var(--color-surface); color: var(--color-text); margin: 2px 6px 2px 0; }
.remove-tag { background: none; border: none; color: var(--color-text-secondary); cursor: pointer; font-size: 14px; padding: 0 4px; }
.remove-tag:hover { color: var(--color-error); }
.empty-state { padding: 12px; color: var(--color-text-secondary); font-style: italic; }
</style>


