<script setup>
import { onMounted, onBeforeUnmount } from 'vue';

// More robust height calculation for the entire app
const updateAppHeight = () => {
  // Get the window's inner height
  const vh = window.innerHeight;
  // Set it as a CSS variable (minus 1px for safety margin)
  document.documentElement.style.setProperty('--app-height', `${vh - 1}px`);
};

onMounted(() => {
  // Set initial height
  updateAppHeight();
  
  // Update height on resize and orientation change
  window.addEventListener('resize', updateAppHeight);
  window.addEventListener('orientationchange', updateAppHeight);
  
  // Special handling for mobile browsers
  if ('virtualKeyboard' in navigator) {
    // Modern browsers with virtual keyboard API
    window.addEventListener('virtualKeyboardDidShow', updateAppHeight);
    window.addEventListener('virtualKeyboardDidHide', updateAppHeight);
  } else {
    // Fallback for browsers without virtual keyboard API
    window.addEventListener('focusin', () => {
      // Add small delay to account for keyboard opening
      setTimeout(updateAppHeight, 200);
    });
    window.addEventListener('focusout', updateAppHeight);
  }
});

onBeforeUnmount(() => {
  // Clean up all event listeners
  window.removeEventListener('resize', updateAppHeight);
  window.removeEventListener('orientationchange', updateAppHeight);
  
  if ('virtualKeyboard' in navigator) {
    window.removeEventListener('virtualKeyboardDidShow', updateAppHeight);
    window.removeEventListener('virtualKeyboardDidHide', updateAppHeight);
  } else {
    window.removeEventListener('focusin', updateAppHeight);
    window.removeEventListener('focusout', updateAppHeight);
  }
});
</script>

<template>
  <router-view />
</template>

<style>
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
</style>
