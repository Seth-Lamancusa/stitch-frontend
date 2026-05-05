<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue';
import { useStore } from 'vuex';
import RecipientsModal from './components/modals/RecipientsModal.vue';
import LinksModal from './components/modals/LinksModal.vue';
import QuickPromptModal from './components/modals/QuickPromptModal.vue';
import WebSocketService from '@/services/ws/WebSocketService';

const store = useStore();

const authReady = computed(() => store.getters['auth/authReady']);

// More robust height calculation for the entire app
const setAppHeight = () => {
  const doc = document.documentElement;
  doc.style.setProperty('--app-height', `${window.innerHeight}px`);
};

const activityHandler = () => {
  WebSocketService.maybeActivityReconnect();
};

const visibilityHandler = () => {
  if (document.visibilityState === 'visible') {
    WebSocketService.maybeActivityReconnect();
  }
};

onMounted(() => {
  window.addEventListener('resize', setAppHeight);
  setAppHeight();
  window.addEventListener('mousemove', activityHandler);
  window.addEventListener('keydown', activityHandler);
  window.addEventListener('click', activityHandler);
  window.addEventListener('touchstart', activityHandler);
  document.addEventListener('visibilitychange', visibilityHandler);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', setAppHeight);
  window.removeEventListener('mousemove', activityHandler);
  window.removeEventListener('keydown', activityHandler);
  window.removeEventListener('click', activityHandler);
  window.removeEventListener('touchstart', activityHandler);
  document.removeEventListener('visibilitychange', visibilityHandler);
});
</script>

<template>
  <div>
    <div v-if="!authReady" class="loading-screen">
      <div class="loading-spinner"></div>
      <p>Loading Stitch...</p>
    </div>

    <main v-else>
      <router-view/>
    </main>

    <RecipientsModal />
    <LinksModal />
    <QuickPromptModal />
  </div>
</template>

<style>
/* Base application styles */
:root {
  --app-height: 100vh;
}

.loading-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: #333;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  margin-bottom: 20px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: #09f;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (prefers-color-scheme: dark) {
  .loading-screen {
    color: #e0e0e0;
  }

  .loading-spinner {
    border: 4px solid rgba(255, 255, 255, 0.08);
    border-left-color: #09f;
  }
}

html {
  box-sizing: border-box;
}

*, *:before, *:after {
  box-sizing: inherit;
}

html, body {
  margin: 0;
  padding: 0;
  height: var(--app-height);
  overflow: hidden;
  position: fixed;
  width: 100%;
  overscroll-behavior: none;
}

body {
  background-color: var(--color-background);
  color: var(--color-text);
  font-family: var(--font-family-base);
}

#app {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

#app > div {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

main {
  flex: 1;
  min-height: 0;
}
</style>
