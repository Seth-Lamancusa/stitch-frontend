<template>
  <div class="global-notifications">
    
    <!-- Error Notification -->
    <transition name="notification">
      <div v-if="error" class="notification error-notification" @click="clearError">
        <div class="notification-icon">⚠️</div>
        <div class="notification-content">
          <div class="notification-message">
            <template v-if="typeof error === 'object'">
              <span v-if="error.code" class="notification-title">{{ error.code }}</span>
              <span>{{ error.message }}</span>
            </template>
            <template v-else>
              {{ error }}
            </template>
          </div>
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
    
    <!-- Message Notification -->
    <transition name="notification">
      <div v-if="messageNotification" class="notification message-notification" @click="handleMessageClick">
        <div class="notification-icon">💬</div>
        <div class="notification-content">
          <div class="notification-title">{{ messageNotification.title }}</div>
          <div class="notification-message">{{ messageNotification.message }}</div>
        </div>
        <button class="notification-close" @click.stop="clearMessageNotification">×</button>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';

const store = useStore();
const router = useRouter();

// Get notifications from store
const error = computed(() => store.getters['ui/error']);
const success = computed(() => store.getters['ui/success']);
const messageNotification = computed(() => store.getters['ui/messageNotification']);
 

// Auto-clear success messages
watch(success, (newSuccess) => {
  if (newSuccess) {
    setTimeout(() => {
      store.commit('ui/SET_SUCCESS', null);
    }, 3000);
  }
});

// Auto-clear message notifications
watch(messageNotification, (newNotification) => {
  if (newNotification) {
    setTimeout(() => {
      store.dispatch('ui/clearMessageNotification');
    }, 3000);
  }
});

// Auto-clear errors
watch(error, (newError) => {
  if (newError) {
    setTimeout(() => {
      store.commit('ui/SET_ERROR', null);
    }, 3000);
  }
});

// Methods to clear notifications
const clearError = () => {
  store.commit('ui/SET_ERROR', null);
};

const clearSuccess = () => {
  store.commit('ui/SET_SUCCESS', null);
};

const clearMessageNotification = () => {
  store.dispatch('ui/clearMessageNotification');
};

 

// Handle clicking on message notification - navigate to the message
const handleMessageClick = () => {
  if (messageNotification.value && messageNotification.value.messageData) {
    const messageData = messageNotification.value.messageData;
    
    // Clear the notification first
    clearMessageNotification();
    
    // Navigate to the message
    router.push(`/messages/${messageData.id}`);
  }
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

.message-notification {
  background-color: var(--color-message-background, #f8fafc);
  color: var(--color-message-text, #374151);
  border-left-color: var(--color-primary, #3b82f6);
}

.notification-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.notification-content {
  flex: 1;
}

.notification-title {
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 4px;
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
  
  .message-notification {
    background-color: var(--color-message-background, #1f2937);
    color: var(--color-message-text, #f3f4f6);
  }
}
</style> 