<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import RecipientsModal from './components/RecipientsModal.vue';
import LinksModal from './components/LinksModal.vue';
import EditMessageModal from './components/EditMessageModal.vue';

// More robust height calculation for the entire app
const setAppHeight = () => {
  const doc = document.documentElement;
  doc.style.setProperty('--app-height', `${window.innerHeight}px`);
};

onMounted(() => {
  window.addEventListener('resize', setAppHeight);
  setAppHeight();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', setAppHeight);
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
