<template>
  <div class="user-search-input">
    <input
      type="text"
      :value="searchQuery"
      @input="handleInput"
      @focus="showSearchResults = true"
      placeholder="Search by name or @username"
      class="form-control"
    />
    <div v-if="showSearchResults && searchResults.length > 0" class="search-results">
      <ul>
        <li v-for="user in searchResults" :key="user.uid" @click="selectUser(user)">
          {{ user.display_name }} (@{{ user.user_tag }})
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useStore } from 'vuex';

const props = defineProps({
  initialUser: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['user-selected', 'text-updated']);

const store = useStore();
const searchQuery = ref('');
const searchResults = ref([]);
const showSearchResults = ref(false);
let debounceTimer = null;

watch(() => props.initialUser, (newUser) => {
  if (newUser) {
    searchQuery.value = `${newUser.display_name} (@${newUser.user_tag})`;
  } else {
    searchQuery.value = '';
  }
}, { immediate: true });

const handleInput = (event) => {
  searchQuery.value = event.target.value;
  emit('text-updated', searchQuery.value);
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(async () => {
    if (searchQuery.value.length > 1) {
      const results = await store.dispatch('auth/searchUsers', searchQuery.value);
      searchResults.value = results;
      showSearchResults.value = true;
    } else {
      searchResults.value = [];
      showSearchResults.value = false;
    }
  }, 300);
};

const selectUser = (user) => {
  searchQuery.value = `${user.display_name} (@${user.user_tag})`;
  showSearchResults.value = false;
  emit('user-selected', user);
  emit('text-updated', searchQuery.value);
};
</script>

<style scoped>
.user-search-input {
  position: relative;
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

li {
  padding: 8px 12px;
  cursor: pointer;
}

li:hover {
  background-color: var(--color-primary-light);
}
</style> 