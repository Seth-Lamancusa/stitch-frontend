<template>
  <transition name="disclaimer-fade">
    <div
      v-if="open"
      class="disclaimer-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-disclaimer-title"
      aria-describedby="mobile-disclaimer-body"
    >
      <div ref="modalRef" class="disclaimer-modal">
        <h2 id="mobile-disclaimer-title">Optimized for desktop</h2>
        <p id="mobile-disclaimer-body">
          stitch.fyi's web app is optimized for desktop use. Proceed at your own discretion, for bugs abound. An open-source mobile app is in development on
          <a href="https://github.com/Seth-Lamancusa/stitch-chat" target="_blank" rel="noopener noreferrer">GitHub</a>
          and the source for this web client is available on
          <a href="https://github.com/Seth-Lamancusa/stitch-frontend" target="_blank" rel="noopener noreferrer">GitHub</a>
          too if you would like to contribute.
        </p>
        <button ref="acceptRef" type="button" class="btn-accept" @click="accept">
          Accept
        </button>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { acceptMobileDisclaimer, isMobileDisclaimerPending } from '../../utils/mobileDisclaimer.js';

const open = ref(false);
const modalRef = ref(null);
const acceptRef = ref(null);

const accept = () => {
  acceptMobileDisclaimer();
  open.value = false;
};

const focusableInModal = () => {
  if (!modalRef.value) return [];
  return [...modalRef.value.querySelectorAll('a[href], button:not([disabled])')];
};

const onKeydown = (event) => {
  if (!open.value) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  if (event.key !== 'Tab') return;
  const focusable = focusableInModal();
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

watch(open, (isOpen) => {
  if (!isOpen) return;
  nextTick(() => {
    acceptRef.value?.focus();
  });
});

onMounted(() => {
  open.value = isMobileDisclaimerPending();
  window.addEventListener('keydown', onKeydown, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown, true);
});
</script>

<style scoped>
.disclaimer-overlay {
  position: fixed;
  inset: 0;
  z-index: 11000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(8, 9, 8, 0.78);
  backdrop-filter: blur(8px);
}

.disclaimer-modal {
  width: 100%;
  max-width: 440px;
  padding: 28px 24px 24px;
  background: var(--app-surface-1, #1c1e1c);
  color: var(--app-text-primary, #f3ecdc);
  border: 1px solid var(--border-color, #2f332f);
  border-radius: 20px;
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.65);
}

.disclaimer-modal h2 {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.3;
}

.disclaimer-modal p {
  margin: 0;
  font-size: 15px;
  line-height: 1.55;
  color: var(--app-text-secondary, #b2aa99);
}

.disclaimer-modal a {
  color: var(--primary-color, #8fbf9f);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.btn-accept {
  display: block;
  width: 100%;
  margin-top: 22px;
  min-height: 44px;
  padding: 10px 22px;
  border-radius: 10px;
  border: 1px solid rgba(143, 191, 159, 0.45);
  background: var(--accent-primary, #598958);
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.btn-accept:hover,
.btn-accept:focus-visible {
  background: var(--accent-primary-hover, #699b68);
}

.btn-accept:focus-visible,
.disclaimer-modal a:focus-visible {
  outline: 2px solid var(--primary-color, #8fbf9f);
  outline-offset: 2px;
}

.disclaimer-fade-enter-active,
.disclaimer-fade-leave-active {
  transition: opacity 0.2s ease;
}

.disclaimer-fade-enter-from,
.disclaimer-fade-leave-to {
  opacity: 0;
}
</style>
