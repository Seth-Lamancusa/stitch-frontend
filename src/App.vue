<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import RecipientsModal from './components/modals/RecipientsModal.vue';
import LinksModal from './components/modals/LinksModal.vue';
import QuickPromptModal from './components/modals/QuickPromptModal.vue';
import OnboardingModal from './components/modals/OnboardingModal.vue';
import SettingsModal from './components/modals/SettingsModal.vue';
import WebSocketService from '@/services/ws/WebSocketService';

const router = useRouter();
const ready = ref(false);

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

onMounted(async () => {
  window.addEventListener('resize', setAppHeight);
  setAppHeight();
  window.addEventListener('mousemove', activityHandler);
  window.addEventListener('keydown', activityHandler);
  window.addEventListener('click', activityHandler);
  window.addEventListener('touchstart', activityHandler);
  document.addEventListener('visibilitychange', visibilityHandler);
  try {
    await router.isReady();
  } catch (_) {}
  ready.value = true;
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
  <div class="app-canvas shell">
    <div v-if="!ready" class="boot" role="status" aria-label="Loading Stitch">
      <div class="boot-spinner"></div>
    </div>

    <main v-else>
      <router-view/>
    </main>

    <RecipientsModal />
    <LinksModal />
    <QuickPromptModal />
    <OnboardingModal />
    <SettingsModal />
  </div>
</template>

<style>
/* Base application styles */
:root {
  --app-height: 100vh;
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
  color: var(--color-text);
  font-family: var(--font-family-base);
}

#app {
  position: relative;
  z-index: 1;
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

.shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.boot {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.boot-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(243, 236, 220, 0.15);
  border-left-color: var(--color-sage, #598958);
  border-radius: 50%;
  animation: boot-spin 0.8s linear infinite;
}

@keyframes boot-spin {
  to { transform: rotate(360deg); }
}
</style>
