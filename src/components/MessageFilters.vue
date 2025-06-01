<template>
  <div class="message-filters" :class="{ 'loading': isLoadingMessages }">
    <div class="filters-main">
      <!-- Row 1: Author and Recipient filters -->
      <div class="filter-row">
        <!-- Author filter section -->
        <div class="filter-section author-filter">
          <div class="search-input-wrapper" :class="{ 'has-selection': selectedAuthors.length > 0 }">
            <input 
              v-model="authorSearchQuery" 
              @input="searchAuthors"
              @keydown.enter.prevent="selectFirstAuthorResult" 
              @keydown.escape="clearAuthorSearch"
              placeholder="Filter by authors..." 
              class="filter-input"
              :disabled="isLoadingMessages"
            />
            <span class="input-label">Authors</span>
            <button 
              v-if="selectedAuthors.length > 0" 
              @click="clearAuthorFilter" 
              class="clear-btn"
              title="Clear author filter"
              :disabled="isLoadingMessages"
            >×</button>
          </div>
          
          <!-- Selected authors display -->
          <div v-if="selectedAuthors.length > 0" class="selected-authors">
            <div 
              v-for="author in selectedAuthors" 
              :key="author.uid" 
              class="author-tag"
            >
              {{ author.display_name || 'User' }} @{{ author.user_tag }}
              <button 
                @click="removeAuthor(author)" 
                class="remove-author-btn"
                title="Remove author"
                :disabled="isLoadingMessages"
              >×</button>
            </div>
          </div>
          
          <!-- Dropdown results -->
          <div v-if="showAuthorResults && authorSearchResults.length > 0 && !isLoadingMessages" class="search-results">
            <div 
              v-for="user in authorSearchResults" 
              :key="user.uid" 
              @click="selectAuthorResult(user)"
              class="search-result-item"
            >
              {{ user.display_name || 'User' }} @{{ user.user_tag }}
            </div>
          </div>
        </div>

        <!-- Recipient filter section -->
        <div class="filter-section recipient-filter">
          <div class="search-input-wrapper" :class="{ 'has-selection': selectedRecipients.length > 0 }">
            <input 
              v-model="recipientSearchQuery" 
              @input="searchRecipients"
              @keydown.enter.prevent="selectFirstRecipientResult" 
              @keydown.escape="clearRecipientSearch"
              placeholder="Filter by recipients..." 
              class="filter-input"
              :disabled="isLoadingMessages"
            />
            <span class="input-label">Recipients</span>
            <button 
              v-if="selectedRecipients.length > 0" 
              @click="clearRecipientFilter" 
              class="clear-btn"
              title="Clear recipient filter"
              :disabled="isLoadingMessages"
            >×</button>
          </div>
          
          <!-- Selected recipients display -->
          <div v-if="selectedRecipients.length > 0" class="selected-recipients">
            <div 
              v-for="recipient in selectedRecipients" 
              :key="recipient.uid" 
              class="recipient-tag"
            >
              {{ recipient.display_name || 'User' }} @{{ recipient.user_tag }}
              <button 
                @click="removeRecipient(recipient)" 
                class="remove-recipient-btn"
                title="Remove recipient"
                :disabled="isLoadingMessages"
              >×</button>
            </div>
          </div>
          
          <!-- Dropdown results -->
          <div v-if="showRecipientResults && recipientSearchResults.length > 0 && !isLoadingMessages" class="search-results">
            <div 
              v-for="user in recipientSearchResults" 
              :key="user.uid" 
              @click="selectRecipientResult(user)"
              class="search-result-item"
            >
              {{ user.display_name || 'User' }} @{{ user.user_tag }}
            </div>
          </div>
        </div>
      </div>

      <!-- Row 2: Date range filter -->
      <div class="filter-row">
        <div class="filter-section date-from-filter">
          <div class="search-input-wrapper" :class="{ 'has-selection': localDateStart }">
            <input 
              type="datetime-local" 
              v-model="localDateStart"
              class="filter-input date-input"
              :disabled="isLoadingMessages"
            />
            <span class="input-label">From</span>
            <button 
              v-if="localDateStart" 
              @click="updateLocalDateRange('start', '')" 
              class="clear-btn"
              title="Clear from date"
              :disabled="isLoadingMessages"
            >×</button>
          </div>
        </div>

        <div class="filter-section date-to-filter">
          <div class="search-input-wrapper" :class="{ 'has-selection': localDateEnd }">
            <input 
              type="datetime-local" 
              v-model="localDateEnd"
              class="filter-input date-input"
              :disabled="isLoadingMessages"
            />
            <span class="input-label">To</span>
            <button 
              v-if="localDateEnd" 
              @click="updateLocalDateRange('end', '')" 
              class="clear-btn"
              title="Clear to date"
              :disabled="isLoadingMessages"
            >×</button>
          </div>
        </div>
      </div>

      <!-- Row 3: Sort order -->
      <div class="filter-row">
        <div class="filter-section sort-filter">
          <div class="sort-order-toggle">
            <label class="toggle-switch">
              <input 
                type="checkbox" 
                v-model="isNewestFirst"
                :disabled="isLoadingMessages"
              >
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">{{ isNewestFirst ? 'Newest First' : 'Oldest First' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Visibility column -->
    <div class="filters-visibility">
      <div class="filter-section public-filter">
        <div class="public-filter-selector">
          <label class="filter-label">Visibility</label>
          <div class="radio-group">
            <label class="radio-option">
              <input 
                type="radio" 
                value="all" 
                v-model="isPublic"
                @change="togglePublic"
                :disabled="isLoadingMessages"
              >
              <span class="radio-label">All</span>
            </label>
            <label class="radio-option">
              <input 
                type="radio" 
                value="public" 
                v-model="isPublic"
                @change="togglePublic"
                :disabled="isLoadingMessages"
              >
              <span class="radio-label">Public</span>
            </label>
            <label class="radio-option">
              <input 
                type="radio" 
                value="private" 
                v-model="isPublic"
                @change="togglePublic"
                :disabled="isLoadingMessages"
              >
              <span class="radio-label">Private</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useStore } from 'vuex';

const store = useStore();

// Author filter state
const authorSearchQuery = ref('');
const authorSearchResults = ref([]);
const showAuthorResults = ref(false);
const selectedAuthors = computed({
  get: () => store.getters['messages/getAuthors'],
  set: (value) => store.dispatch('messages/setAuthors', value)
});

// Recipient filter state
const recipientSearchQuery = ref('');
const recipientSearchResults = ref([]);
const showRecipientResults = ref(false);
const selectedRecipients = computed({
  get: () => store.getters['messages/getRecipients'],
  set: (value) => store.dispatch('messages/setRecipients', value)
});

// Public filter state
const isPublic = computed({
  get: () => store.getters['messages/getIsPublic'],
  set: (value) => store.dispatch('messages/setIsPublic', value)
});

// Date range state
const dateRange = computed({
  get: () => store.getters['messages/getDateRange'],
  set: (value) => store.dispatch('messages/setDateRange', value)
});

// Sort order state  
const isNewestFirst = computed({
  get: () => store.getters['messages/getSortOrder'] === 'newest',
  set: async (value) => {
    const newOrder = value ? 'newest' : 'oldest';
    await store.dispatch('messages/setSortOrder', newOrder);
  }
});

// Loading state for disabling controls
const isLoadingMessages = computed(() => {
  return store.getters['messages/isLoading']('fetchingMessages');
});

// Local date values for datetime-local inputs (converts from ISO to local format)
const localDateStart = computed({
  get: () => {
    if (!dateRange.value.start) return '';
    // Convert ISO string back to datetime-local format (YYYY-MM-DDTHH:mm)
    const date = new Date(dateRange.value.start);
    return date.toISOString().slice(0, 16);
  },
  set: (value) => {
    updateLocalDateRange('start', value);
  }
});

const localDateEnd = computed({
  get: () => {
    if (!dateRange.value.end) return '';
    // Convert ISO string back to datetime-local format (YYYY-MM-DDTHH:mm)
    const date = new Date(dateRange.value.end);
    return date.toISOString().slice(0, 16);
  },
  set: (value) => {
    updateLocalDateRange('end', value);
  }
});

// Computed property to check if date range is set
const hasDateRange = computed(() => {
  return dateRange.value.start || dateRange.value.end;
});

const applyFilters = async () => {
  console.log('[MessageFilters] Applying filters - clearing cache and fetching fresh data');
  console.log('[MessageFilters] Current filter state:', {
    authors: selectedAuthors.value.map(a => a.display_name),
    recipients: selectedRecipients.value.map(r => r.display_name),
    isPublic: isPublic.value,
    dateRange: dateRange.value,
    sortOrder: isNewestFirst.value ? 'newest' : 'oldest'
  });
  
  // Always clear cache when filters change for clarity, but preserve pinned messages
  console.log('[MessageFilters] About to clear cache...');
  await store.dispatch('messages/clearCache', { excludePinned: true });
  console.log('[MessageFilters] Cache cleared');
  
  try {
    // Trigger a refresh by dispatching the fetch action with all current filters
    console.log('[MessageFilters] About to fetch fresh messages...');
    const result = await store.dispatch('messages/fetchChronologicalMessages', { 
      cursor: null, // Always start fresh
      filters: store.state.messages.filters
    });
    console.log('[MessageFilters] Fetch completed with result:', {
      hasResult: !!result,
      messagesCount: result?.messages?.length || 0,
      exhausted: result?.exhausted,
      nextCursor: result?.nextCursor
    });
  } catch (error) {
    console.error('[MessageFilters] Error during fetch:', error);
  } finally {
    console.log('[MessageFilters] applyFilters completed');
  }
};

// Simplified watchers - just apply filters on any change
watch(() => selectedAuthors.value, async (newAuthors, oldAuthors) => {
  console.log('[MessageFilters] Author filter changed:', {
    old: oldAuthors?.map(a => a.display_name) || [],
    new: newAuthors?.map(a => a.display_name) || []
  });
  await applyFilters();
});

watch(() => selectedRecipients.value, async (newRecipients, oldRecipients) => {
  console.log('[MessageFilters] Recipient filter changed:', {
    old: oldRecipients?.map(r => r.display_name) || [],
    new: newRecipients?.map(r => r.display_name) || []
  });
  await applyFilters();
});

watch(() => isPublic.value, async (newValue, oldValue) => {
  console.log('[MessageFilters] Public filter changed:', {
    oldValue,
    newValue,
    filterChangeTriggered: oldValue !== newValue
  });
  if (oldValue !== newValue) {
    console.log('[MessageFilters] Public filter actually changed, applying filters...');
    await applyFilters();
  } else {
    console.log('[MessageFilters] Public filter unchanged, skipping apply');
  }
});

watch(() => dateRange.value, async (newRange, oldRange) => {
  console.log('[MessageFilters] Date range changed:', {
    old: oldRange,
    new: newRange
  });
  await applyFilters();
}, { deep: true });

// Watch sort order changes
watch(() => isNewestFirst.value, async (newValue, oldValue) => {
  console.log('[MessageFilters] Sort order changed:', {
    oldValue: oldValue ? 'newest first' : 'oldest first',
    newValue: newValue ? 'newest first' : 'oldest first'
  });
  await applyFilters();
});

// Author search functions
let authorSearchTimeout = null;
const searchAuthors = (event) => {
  clearTimeout(authorSearchTimeout);
  const query = event.target.value.trim();
  
  if (query.length < 1) {
    clearAuthorSearch();
    return;
  }
  
  authorSearchTimeout = setTimeout(async () => {
    try {
      const results = await store.dispatch('auth/searchUsers', query);
      authorSearchResults.value = Array.isArray(results) ? results : [];
      showAuthorResults.value = authorSearchResults.value.length > 0;
    } catch (error) {
      console.error('Error searching users:', error);
      authorSearchResults.value = [];
    }
  }, 300);
};

const clearAuthorSearch = () => {
  authorSearchQuery.value = '';
  authorSearchResults.value = [];
  showAuthorResults.value = false;
};

const selectAuthorResult = async (user) => {
  if (user?.uid) {
    if (!selectedAuthors.value.find(a => a.uid === user.uid)) {
      const newAuthors = [...selectedAuthors.value, {
        uid: user.uid,
        display_name: user.display_name,
        user_tag: user.user_tag
      }];
      await store.dispatch('messages/setAuthors', newAuthors);
    }
    clearAuthorSearch();
  }
};

const selectFirstAuthorResult = () => {
  if (authorSearchResults.value.length > 0) {
    selectAuthorResult(authorSearchResults.value[0]);
  }
};

const removeAuthor = (author) => {
  const newAuthors = selectedAuthors.value.filter(a => a.uid !== author.uid);
  store.dispatch('messages/setAuthors', newAuthors);
};

const clearAuthorFilter = () => {
  store.dispatch('messages/setAuthors', []);
  clearAuthorSearch();
};

// Recipient search functions
let recipientSearchTimeout = null;
const searchRecipients = (event) => {
  clearTimeout(recipientSearchTimeout);
  const query = event.target.value.trim();
  
  if (query.length < 1) {
    clearRecipientSearch();
    return;
  }
  
  recipientSearchTimeout = setTimeout(async () => {
    try {
      const results = await store.dispatch('auth/searchUsers', query);
      recipientSearchResults.value = Array.isArray(results) ? results : [];
      showRecipientResults.value = recipientSearchResults.value.length > 0;
    } catch (error) {
      console.error('Error searching users:', error);
      recipientSearchResults.value = [];
    }
  }, 300);
};

const clearRecipientSearch = () => {
  recipientSearchQuery.value = '';
  recipientSearchResults.value = [];
  showRecipientResults.value = false;
};

const selectRecipientResult = async (user) => {
  if (user?.uid) {
    if (!selectedRecipients.value.find(r => r.uid === user.uid)) {
      const newRecipients = [...selectedRecipients.value, {
        uid: user.uid,
        display_name: user.display_name,
        user_tag: user.user_tag
      }];
      await store.dispatch('messages/setRecipients', newRecipients);
    }
    clearRecipientSearch();
  }
};

const selectFirstRecipientResult = () => {
  if (recipientSearchResults.value.length > 0) {
    selectRecipientResult(recipientSearchResults.value[0]);
  }
};

const removeRecipient = (recipient) => {
  const newRecipients = selectedRecipients.value.filter(r => r.uid !== recipient.uid);
  store.dispatch('messages/setRecipients', newRecipients);
};

const clearRecipientFilter = () => {
  store.dispatch('messages/setRecipients', []);
  clearRecipientSearch();
};

const togglePublic = async () => {
  console.log('[MessageFilters] togglePublic called with value:', isPublic.value);
  await store.dispatch('messages/setIsPublic', isPublic.value);
};

// Function to update date range when local inputs change
const updateLocalDateRange = (type, value) => {
  let startISO = dateRange.value.start;
  let endISO = dateRange.value.end;
  
  if (type === 'start') {
    startISO = value ? new Date(value).toISOString() : null;
  } else if (type === 'end') {
    endISO = value ? new Date(value).toISOString() : null;
  }
  
  store.dispatch('messages/setDateRange', {
    start: startISO,
    end: endISO
  });
};

// Close search results when clicking outside
onMounted(() => {
  document.addEventListener('click', (event) => {
    const filterContainer = document.querySelector('.message-filters');
    if ((showAuthorResults.value || showRecipientResults.value) && 
        filterContainer && 
        !filterContainer.contains(event.target)) {
      showAuthorResults.value = false;
      showRecipientResults.value = false;
    }
  });
});
</script>

<style scoped>
.message-filters {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  width: 90%;
  margin: 0 auto;
}

.filters-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.filters-visibility {
  width: 150px;
  border-left: 1px solid var(--color-border);
  padding-left: var(--space-md);
  display: flex;
  flex-direction: column;
}

.filter-row {
  display: flex;
  gap: var(--space-md);
  align-items: flex-start;
}

.filter-section {
  position: relative;
  margin-bottom: var(--space-sm);
}

.author-filter,
.recipient-filter {
  flex: 1;
  min-width: 200px;
}

.date-from-filter,
.date-to-filter {
  flex: 1;
  min-width: 200px;
}

.sort-filter {
  flex: 1;
  display: flex;
  align-items: center;
}

.public-filter {
  flex: 1;
  display: flex;
  flex-direction: column;
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

/* Selected authors and recipients styles */
.selected-authors,
.selected-recipients {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin-top: var(--space-xs);
}

.author-tag,
.recipient-tag {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-primary-light);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text);
}

.remove-author-btn,
.remove-recipient-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: var(--font-size-sm);
  padding: 0 2px;
  transition: all var(--transition-fast);
}

.remove-author-btn:hover,
.remove-recipient-btn:hover {
  color: var(--color-text);
  transform: scale(1.1);
}

/* Toggle switch styles */
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
  background-color: var(--color-surface);
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
  background-color: rgb(61, 61, 61);
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

/* Date range filter styles */
.date-input {
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--font-size-sm);
}

/* Override default datetime-local styling */
.date-input::-webkit-calendar-picker-indicator {
  filter: var(--calendar-icon-filter, invert(0.5));
  cursor: pointer;
  opacity: 0.6;
  padding-right: var(--space-xs);
}

.date-input::-webkit-calendar-picker-indicator:hover {
  opacity: 1;
}

/* Ensure date inputs have consistent height with other inputs */
input[type="datetime-local"].filter-input {
  height: 38px;
  padding-right: var(--space-xl);
}

/* Dark mode support for calendar icon */
@media (prefers-color-scheme: dark) {
  .date-input::-webkit-calendar-picker-indicator {
    --calendar-icon-filter: invert(1);
  }
}

/* Sort order toggle styles */
.sort-order-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.sort-order-toggle .toggle-switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 20px;
}

.sort-order-toggle .toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.sort-order-toggle .toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-surface);
  transition: .4s;
  border-radius: 20px;
}

.sort-order-toggle .toggle-slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: rgb(61, 61, 61);
  transition: .4s;
  border-radius: 50%;
}

.sort-order-toggle input:checked + .toggle-slider {
  background-color: var(--color-primary);
}

.sort-order-toggle input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

.sort-order-toggle .toggle-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  min-width: 85px;
}

/* Public filter styles */
.public-filter-selector {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.filter-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-weight: 500;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.radio-option {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.radio-option input[type="radio"] {
  margin: 0;
  cursor: pointer;
}

.radio-option:hover .radio-label {
  color: var(--color-primary);
}

.radio-option input[type="radio"]:checked + .radio-label {
  color: var(--color-primary);
  font-weight: 500;
}

.radio-label {
  cursor: pointer;
  transition: color var(--transition-fast);
}

/* Loading state styles */
.message-filters.loading {
  opacity: 0.6;
  pointer-events: none;
  position: relative;
}

.message-filters.loading::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(1px);
  z-index: 5;
  border-radius: var(--radius-md);
}

/* Disabled input styles */
.filter-input:disabled,
.clear-btn:disabled,
.remove-author-btn:disabled,
.remove-recipient-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: var(--color-surface-light);
}

.toggle-switch input:disabled + .toggle-slider {
  opacity: 0.5;
  cursor: not-allowed;
}

.radio-option input:disabled + .radio-label {
  opacity: 0.5;
  cursor: not-allowed;
  color: var(--color-text-secondary);
}

/* Hide search results during loading */
.message-filters.loading .search-results {
  display: none;
}
</style> 