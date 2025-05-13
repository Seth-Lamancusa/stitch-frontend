<script setup>
import { onMounted, ref } from 'vue';
import { auth } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';

const user = ref(null);
const isLoading = ref(true);

onMounted(() => {
  onAuthStateChanged(auth, (userData) => {
    user.value = userData;
    isLoading.value = false;
  });
});
</script>

<template>
  <div v-if="isLoading" class="loading">
    Loading...
  </div>
  <router-view v-else />
</template>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: var(--font-family-base);
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-size: var(--font-size-lg);
  color: var(--color-primary);
}
</style> 