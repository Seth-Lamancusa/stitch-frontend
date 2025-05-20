<template>
  <div class="profile-filter-container">
    <div class="profile-filter-header">
      <h3>Viewing messages from:</h3>
      <button v-if="selectedProfile" @click="clearProfileFilter" class="clear-filter-btn">Clear filter</button>
    </div>
    
    <div class="profile-search-container">
      <div class="search-input-wrapper" :class="{ 'valid': isTagValid === true, 'invalid': isTagValid === false, 'searching': isSearching }">
        <input 
          v-model="searchQuery" 
          @input="searchUsers"
          @keydown.enter.prevent="selectFirstResult" 
          @keydown.escape="clearSearch"
          placeholder="Search for a user by name or tag..." 
          class="profile-search-input"
          ref="searchInput"
        />
        <div v-if="isSearching" class="search-indicator" title="Searching...">
          <div class="spinner"></div>
        </div>
        <div v-else-if="isTagValid === true" class="valid-indicator" title="Valid user tag">✓</div>
        <div v-else-if="isTagValid === false" class="invalid-indicator" title="Invalid user tag">✗</div>
      </div>
    </div>
    
    <!-- Search results container -->
    <div class="search-results-container">
      <!-- Search results dropdown (shown when results exist) -->
      <div v-if="showSearchResults && searchResults && searchResults.length > 0" class="search-results-list">
        <div 
          v-for="(user, index) in searchResults" 
          :key="user.uid" 
          class="search-result-item"
          @click="selectSearchResult(user)"
        >
          <div class="search-result-content">
            <span class="search-result-name">{{ user.display_name || 'User' }}</span>
            <span class="search-result-tag">@{{ user.user_tag }}</span>
          </div>
        </div>
      </div>

      <!-- No results message (shown when search performed but no results) -->
      <div v-else-if="searchResults.length === 0 && hasSearched && !isSearching" class="no-search-results">
        No users found. Try a different search term.
      </div>
    </div>
    
    <!-- Selected profile display -->
    <div v-if="selectedProfile" class="selected-profile">
      <div class="profile-info">
        <span class="profile-name">{{ selectedProfile.display_name || selectedProfile.user_tag }}</span>
        <span class="profile-tag">@{{ selectedProfile.user_tag }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useStore } from 'vuex';

const store = useStore();
const emit = defineEmits(['profile-selected', 'profile-cleared']);

// UI state
const searchQuery = ref('');
const searchResults = ref([]);
const isSearching = ref(false);
const hasSearched = ref(false);
const showSearchResults = ref(false);
const isTagValid = ref(null);
const searchInput = ref(null);

// Computed properties from store
const user = computed(() => store.getters['auth/user']);
const selectedProfile = computed({
  get: () => store.getters['messages/getSelectedProfile'],
  set: (value) => store.dispatch('messages/setSelectedProfile', value)
});

// Initialize with current user if authenticated
onMounted(() => {
  if (user.value && !selectedProfile.value) {
    store.dispatch('messages/setSelectedProfile', {
      uid: user.value.uid,
      display_name: user.value.displayName,
      user_tag: user.value.user_tag
    });
  }
});

// Debounce function for search
let searchTimeout = null;
const searchUsers = (event) => {
  clearTimeout(searchTimeout);
  const query = event.target.value.trim();
  
  // Clear previous search state
  isSearching.value = query.length >= 1;
  
  if (query.length < 1) {
    isTagValid.value = null;
    searchResults.value = [];
    showSearchResults.value = false;
    return;
  }
  
  // Set up debounce
  searchTimeout = setTimeout(async () => {
    try {
      isSearching.value = true;
      hasSearched.value = true;
      
      // Call API to search users
      const results = await store.dispatch('auth/searchUsers', query);
      
      if (!results) {
        searchResults.value = [];
        showSearchResults.value = false;
      } else if (!Array.isArray(results)) {
        searchResults.value = [];
        showSearchResults.value = false;
      } else {
        searchResults.value = results;
        
        // Only show dropdown if we have actual results
        showSearchResults.value = results.length > 0;
      }
      
      // Update validation state
      if (results && results.length > 0) {
        // Consider it valid if we have any results and query is at least 1 char
        isTagValid.value = results.length > 0 && query.length >= 1;
      } else {
        // Explicit validation if no results from search
        const isValid = await store.dispatch('auth/validateUserTag', query);
        isTagValid.value = isValid;
      }
      
      isSearching.value = false;
    } catch (error) {
      console.error('Error searching users:', error);
      isTagValid.value = false;
      searchResults.value = [];
      isSearching.value = false;
    }
  }, 300); // 300ms debounce
};

const clearSearch = () => {
  searchQuery.value = '';
  isTagValid.value = null;
  searchResults.value = [];
  isSearching.value = false;
  hasSearched.value = false;
  showSearchResults.value = false;
};

const selectFirstResult = () => {
  if (searchResults.value.length > 0) {
    selectSearchResult(searchResults.value[0]);
  }
};

const selectSearchResult = (user) => {
  if (user && user.uid) {
    // Update store instead of local state
    store.dispatch('messages/setSelectedProfile', {
      uid: user.uid,
      display_name: user.display_name,
      user_tag: user.user_tag
    });
    
    // Clear the search UI state
    clearSearch();
  }
};

const clearProfileFilter = () => {
  // Set to null to clear the filter
  store.dispatch('messages/setSelectedProfile', null);
  clearSearch();
  
  // If user is logged in, reselect their profile
  if (user.value) {
    nextTick(() => {
      store.dispatch('messages/setSelectedProfile', {
        uid: user.value.uid,
        display_name: user.value.displayName,
        user_tag: user.value.user_tag
      });
    });
  }
};

// Close search results when clicking outside
onMounted(() => {
  document.addEventListener('click', handleClickOutsideSearch);
});

const handleClickOutsideSearch = (event) => {
  const searchContainer = document.querySelector('.profile-search-container');
  const searchResults = document.querySelector('.search-results-list');
  
  if (showSearchResults.value && 
      searchContainer && 
      !searchContainer.contains(event.target) &&
      searchResults && 
      !searchResults.contains(event.target)) {
    showSearchResults.value = false;
  }
};

// Expose methods for parent components
defineExpose({
  clearProfileFilter,
  selectedProfile
});
</script>

<style scoped>
.profile-filter-container {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  margin-bottom: var(--space-md);
  width: 70%;
  margin: 0 auto;
}

.profile-filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-sm);
}

.profile-filter-header h3 {
  margin: 0;
  font-size: var(--font-size-md);
  color: var(--color-text);
}

.clear-filter-btn {
  background-color: transparent;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  padding: var(--space-xs) var(--space-sm);
  cursor: pointer;
  font-size: var(--font-size-xs);
  transition: all var(--transition-fast);
}

.clear-filter-btn:hover {
  background-color: var(--color-primary-light);
}

.profile-search-container {
  position: relative;
  margin-bottom: var(--space-sm);
  width: 70%;
}

.search-input-wrapper {
  position: relative;
  width: 100%;
}

.search-input-wrapper.valid .profile-search-input {
  border-color: var(--color-success);
}

.search-input-wrapper.invalid .profile-search-input {
  border-color: var(--color-error);
}

.profile-search-input {
  width: 100%;
  padding: var(--space-xs) var(--space-md);
  padding-right: 30px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
  color: var(--color-text);
  transition: border-color var(--transition-fast);
}

.search-indicator,
.valid-indicator,
.invalid-indicator {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--font-size-xs);
}

.search-indicator .spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.search-results-container {
  position: relative;
  width: 100%;
}

.search-results-list {
  position: absolute;
  width: 100%;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.search-result-item {
  padding: var(--space-xs) var(--space-md);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  border-bottom: 1px solid var(--color-border-light);
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background-color: var(--color-primary-light);
}

.search-result-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.search-result-name {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
}

.search-result-tag {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.no-search-results {
  padding: var(--space-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  text-align: center;
  font-style: italic;
  margin-top: var(--space-xs);
}

.selected-profile {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
  padding: var(--space-sm);
  background-color: var(--color-primary-light);
  border-radius: var(--radius-sm);
}

.profile-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.profile-name {
  font-weight: 500;
  color: var(--color-text);
}

.profile-tag {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style> 