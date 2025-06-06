<template>
  <div class="global-notifications">
    <!-- Error Notification -->
    <transition name="notification">
      <div v-if="error" class="notification error-notification" @click="clearError">
        <div class="notification-icon">⚠️</div>
        <div class="notification-content">
          <div class="notification-message">{{ error }}</div>
        </div>
        <button class="notification-close" @click.stop="clearError">×</button>
      </div>
    </transition>
    
    <!-- Success Notification -->
    <transition name="notification">
      <div v-if="success" class="notification success-notification" @click="clearSuccess">
        <div class="notification-icon">✓</div>
        <div class="notification-content">
          <div class="notification-message">{{ success }}</div>
        </div>
        <button class="notification-close" @click.stop="clearSuccess">×</button>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue';
import { useStore } from 'vuex';

const store = useStore();

// Get error and success from store
const error = computed(() => store.getters['ui/error']);
const success = computed(() => store.getters['ui/success']);

// Auto-clear success messages after 8 seconds
watch(success, (newSuccess) => {
  if (newSuccess) {
    setTimeout(() => {
      store.commit('ui/SET_SUCCESS', null);
    }, 8000);
  }
});

// Errors stay until manually dismissed

// Methods to clear notifications
const clearError = () => {
  store.commit('ui/SET_ERROR', null);
};

const clearSuccess = () => {
  store.commit('ui/SET_SUCCESS', null);
};
</script>

<style scoped>
.global-notifications {
  position: fixed;
  top: 80px; /* Position below the navigation bar */
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 400px;
}

.notification {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-md);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform var(--transition-fast), opacity var(--transition-fast);
  border-left: 4px solid;
}

.error-notification {
  background-color: var(--color-error-background, #fef2f2);
  color: var(--color-error-text, #dc2626);
  border-left-color: var(--color-error, #dc2626);
}

.success-notification {
  background-color: var(--color-success-background, #f0fdf4);
  color: var(--color-success-text, #16a34a);
  border-left-color: var(--color-success, #16a34a);
}

.notification-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.notification-content {
  flex: 1;
}

.notification-message {
  font-weight: 500;
  line-height: 1.4;
}

.notification-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: inherit;
  opacity: 0.7;
  transition: opacity var(--transition-fast);
}

.notification-close:hover {
  opacity: 1;
}

/* Animation transitions */
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.notification-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .global-notifications {
    top: 70px; /* Slightly less space on mobile */
    right: 10px;
    left: 10px;
    max-width: none;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .error-notification {
    background-color: var(--color-error-background, #450a0a);
    color: var(--color-error-text, #fca5a5);
  }
  
  .success-notification {
    background-color: var(--color-success-background, #14532d);
    color: var(--color-success-text, #86efac);
  }
}
</style> 