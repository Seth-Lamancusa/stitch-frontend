<template>
  <router-link
    :to="`/messages/${FEEDBACK_MESSAGE_ID}`"
    class="global-feedback-btn"
    title="Give feedback"
    aria-label="Give feedback"
  >
    <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4 3.5h16a2.5 2.5 0 0 1 2.5 2.5v8.5a2.5 2.5 0 0 1-2.5 2.5H10.2L4.8 21.2a.9.9 0 0 1-1.4-.7v-3.5H4A2.5 2.5 0 0 1 1.5 14.5V6A2.5 2.5 0 0 1 4 3.5z"/>
    </svg>
  </router-link>
</template>

<script setup>
import { FEEDBACK_MESSAGE_ID } from '@/config/appConfig.js';
</script>

<style scoped>
.global-feedback-btn {
  position: fixed;
  bottom: var(--space-xl);
  left: var(--space-xl);
  z-index: 20;
  isolation: isolate;
  overflow: hidden;
  width: 84px;
  height: 84px;
  padding: 0;
  border: none;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--color-primary);
  background-image: url("/textures/wood-matte-contrast.png");
  background-repeat: repeat;
  background-size: 168px;
  background-blend-mode: overlay;
  color: var(--color-text-inverse);
  text-decoration: none;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: background-color var(--transition-normal);
}

.global-feedback-btn .btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  width: 42px;
  height: 42px;
}

.global-feedback-btn:hover {
  background-color: var(--color-primary-dark);
  color: var(--color-text-inverse);
}

.global-feedback-btn:focus-visible {
  outline: 3px solid var(--color-cream);
  outline-offset: 3px;
}

@media (max-width: 768px) {
  .global-feedback-btn {
    background-size: 64px;
    width: 52px;
    height: 52px;
    bottom: 80px;
    left: var(--space-md);
  }

  .global-feedback-btn .btn-icon {
    width: 26px;
    height: 26px;
  }
}
</style>
