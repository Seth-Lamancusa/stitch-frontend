<template>
  <TabViewLayout>
    <div class="search-view">
      <div class="search-controls">
        <div class="query-row">
          <input v-model="q" class="query-input" type="text" placeholder="Search content" />
          <button class="tags-btn" @click="openTagsModal" aria-label="Open tags modal"># Tags ({{ tags.length }})</button>
          <select v-model="match" class="match-select" aria-label="Match mode">
            <option value="any">any</option>
            <option value="all">all</option>
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

      <TagsModal :is-visible="showTags" :is-add-mode="false" :existing-tags="tags" @close="showTags=false" @done="setTags" />
    </div>
  </TabViewLayout>
  
</template>

<script setup>
import { ref } from 'vue';
import TabViewLayout from '../../components/layouts/TabViewLayout.vue';
import MessageList from '../../components/MessageList.vue';
import TagsModal from '../../components/modals/TagsModal.vue';
import MessageService from '../../services/MessageService.js';

const q = ref('');
const tags = ref([]);
const match = ref('any');
const results = ref([]);
const showTags = ref(false);

const openTagsModal = () => { showTags.value = true; };
const setTags = (newTags) => { tags.value = Array.isArray(newTags) ? newTags.slice() : []; showTags.value = false; };
const removeTag = (i) => { if (i >= 0 && i < tags.value.length) tags.value.splice(i,1); };

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
</script>

<style scoped>
.search-view { padding: 8px; }
.search-controls { margin-bottom: 8px; }
.query-row { display: flex; gap: 8px; flex-wrap: wrap; }
.query-input { flex: 1; min-width: 180px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); }
.tags-btn, .search-btn, .match-select { padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); cursor: pointer; }
.search-view { max-width: 60%; margin: 0 auto; }
.tags-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.tag-chip { display: inline-flex; align-items: center; gap: 4px; padding: 6px 8px; border: 1px solid var(--color-border); border-radius: 6px; font-size: var(--font-size-xs); background: var(--color-surface); color: var(--color-text); }
.remove-tag { background: none; border: none; color: var(--color-text-secondary); cursor: pointer; font-size: 14px; }
.empty-state { padding: 12px; color: var(--color-text-secondary); font-style: italic; }
</style>


