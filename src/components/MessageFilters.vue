<template>
  <div class="message-filters">
    <!-- Profile filter section -->
    <div class="filter-section profile-filter">
      <div class="search-input-wrapper" :class="{ 'has-selection': selectedProfile }">
        <input 
          v-model="searchQuery" 
          @input="searchUsers"
          @keydown.enter.prevent="selectFirstResult" 
          @keydown.escape="clearSearch"
          :placeholder="selectedProfile ? selectedProfile.display_name : 'Filter by author...'" 
          class="filter-input"
        />
        <span class="input-label">Author</span>
        <button 
          v-if="selectedProfile" 
          @click="clearProfileFilter" 
          class="clear-btn"
          title="Clear author filter"
        >×</button>
      </div>
      
      <!-- Dropdown results -->
      <div v-if="showSearchResults && searchResults.length > 0" class="search-results">
        <div 
          v-for="user in searchResults" 
          :key="user.uid" 
          @click="selectSearchResult(user)"
          class="search-result-item"
        >
          {{ user.display_name || 'User' }} @{{ user.user_tag }}
        </div>
      </div>
    </div>

    <!-- Visibility filter -->
    <div class="filter-section visibility-filter">
      <label class="toggle-switch">
        <input 
          type="checkbox" 
          v-model="showPublic"
          @change="toggleVisibility"
        >
        <span class="toggle-slider"></span>
      </label>
      <span class="toggle-label">{{ showPublic ? 'Public' : 'Not Public' }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useStore } from 'vuex';

const store = useStore();

// Profile filter state
const searchQuery = ref('');
const searchResults = ref([]);
const showSearchResults = ref(false);
const selectedProfile = computed(() => store.getters['messages/getSelectedProfile']);

// Visibility filter state - inverted from store for UI purposes
const showPublic = computed({
  get: () => store.getters['messages/getVisibilityFilter'] === 'public',
  set: (value) => store.dispatch('messages/setVisibilityFilter', value ? 'public' : 'not-public')
});

// Add to script setup section after existing imports
const threads = computed(() => store.getters['messages/getLoadedMessages'] || []);

// Add method to check if we need to refresh
const checkAndRefreshMessages = async () => {
  // Get filtered messages count
  const filteredCount = threads.value.filter(message => {
    const isPinned = message.is_pinned === 1 || message.is_pinned === true;
    if (isPinned) return false;

    // Apply profile filter if selected
    if (selectedProfile.value) {
      const isMatchingAuthor = 
        message.author_user_tag === selectedProfile.value.user_tag ||
        message.author_email === selectedProfile.value.email ||
        message.content_author === selectedProfile.value.uid;
      if (!isMatchingAuthor) return false;
    }

    // Apply visibility filter based on public boolean
    const isPublic = message.public === true || message.public === 1;
    if (store.getters['messages/getVisibilityFilter'] === 'public') {
      return isPublic;
    } else if (store.getters['messages/getVisibilityFilter'] === 'not-public') {
      return !isPublic;
    }

    return true;
  }).length;

  // If we have less than 5 messages after filtering, fetch more
  if (filteredCount < 5) {
    console.log('[MessageFilters] Less than 5 messages after filtering, refreshing...');
    await store.dispatch('messages/fetchChronologicalMessages', { cursor: null });
  }
};

// Add watchers for filter changes
watch(() => selectedProfile.value, async (newProfile) => {
  console.log('[MessageFilters] Profile filter changed:', newProfile?.display_name);
  await checkAndRefreshMessages();
});

watch(() => showPublic.value, async (newValue) => {
  console.log('[MessageFilters] Visibility filter changed:', newValue ? 'public' : 'not-public');
  await checkAndRefreshMessages();
});

// Debounced search
let searchTimeout = null;
const searchUsers = (event) => {
  clearTimeout(searchTimeout);
  const query = event.target.value.trim();
  
  if (query.length < 1) {
    clearSearch();
    return;
  }
  
  searchTimeout = setTimeout(async () => {
    try {
      const results = await store.dispatch('auth/searchUsers', query);
      searchResults.value = Array.isArray(results) ? results : [];
      showSearchResults.value = searchResults.value.length > 0;
    } catch (error) {
      console.error('Error searching users:', error);
      searchResults.value = [];
    }
  }, 300);
};

const clearSearch = () => {
  searchQuery.value = '';
  searchResults.value = [];
  showSearchResults.value = false;
};

const selectSearchResult = async (user) => {
  if (user?.uid) {
    await store.dispatch('messages/setSelectedProfile', {
      uid: user.uid,
      display_name: user.display_name,
      user_tag: user.user_tag
    });
    clearSearch();
  }
};

const selectFirstResult = () => {
  if (searchResults.value.length > 0) {
    selectSearchResult(searchResults.value[0]);
  }
};

const clearProfileFilter = async () => {
  await store.dispatch('messages/setSelectedProfile', null);
  clearSearch();
};

const toggleVisibility = async () => {
  await store.dispatch('messages/setVisibilityFilter', showPublic.value ? 'public' : 'not-public');
};

// Close search results when clicking outside
onMounted(() => {
  document.addEventListener('click', (event) => {
    const filterContainer = document.querySelector('.message-filters');
    if (showSearchResults.value && 
        filterContainer && 
        !filterContainer.contains(event.target)) {
      showSearchResults.value = false;
    }
  });
});
</script>

<style scoped>
.message-filters {
  display: flex;
  gap: var(--space-md);
  align-items: center;
  padding: var(--space-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  width: 60%;
  margin: 0 auto;
}

.filter-section {
  position: relative;
}

.profile-filter {
  flex: 1;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-label {
  position: absolute;
  left: var(--space-xs);
  top: -8px;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  background: var(--color-surface);
  padding: 0 var(--space-xs);
}

.filter-input {
  width: 100%;
  padding: var(--space-sm) var(--space-sm);
  padding-right: var(--space-xl);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  background: var(--color-surface-light);
  transition: all var(--transition-fast);
}

.search-input-wrapper.has-selection .filter-input {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.clear-btn {
  position: absolute;
  right: var(--space-xs);
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: var(--font-size-lg);
  padding: 2px 6px;
  transition: all var(--transition-fast);
}

.clear-btn:hover {
  color: var(--color-text);
  transform: scale(1.1);
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
  margin-top: var(--space-xs);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.search-result-item {
  padding: var(--space-xs) var(--space-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: background var(--transition-fast);
}

.search-result-item:hover {
  background: var(--color-hover-overlay);
}

/* Toggle switch styles */
.visibility-filter {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding-left: var(--space-sm);
  border-left: 1px solid var(--color-border);
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 20px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-border);
  transition: .4s;
  border-radius: 20px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background-color: var(--color-primary);
}

input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

.toggle-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  min-width: 70px;
}
</style> 