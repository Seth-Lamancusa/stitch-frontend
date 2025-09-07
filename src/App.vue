<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import RecipientsModal from './components/modals/RecipientsModal.vue';
import LinksModal from './components/modals/LinksModal.vue';
import BotPromptModal from './components/modals/BotPromptModal.vue';
import EditMessageModal from './components/modals/EditMessageModal.vue';
import WebSocketService from '@/services/ws/WebSocketService';

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
    <main>
      <router-view/>
    </main>
    <RecipientsModal />
    <LinksModal />
    <EditMessageModal />
    <BotPromptModal />
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
