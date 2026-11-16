<template>
  <div v-if="message" class="persistent-error-bar" role="alert">
    <p class="persistent-error-message">{{ message }}</p>
    <button type="button" class="persistent-error-copy" @click="copy">
      {{ copied ? 'Copied' : 'Copy' }}
    </button>
    <button type="button" class="persistent-error-dismiss" aria-label="Dismiss error" @click="dismiss">
      Dismiss
    </button>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useStore } from 'vuex'
import { dismissPersistentError } from '../utils/userErrors.js'

const store = useStore()
const copied = ref(false)

const message = computed(() => store.getters['ui/persistentError']?.message || '')

const dismiss = () => {
  copied.value = false
  dismissPersistentError(store)
}

const copy = async () => {
  const text = message.value
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 1200)
  } catch {
    copied.value = false
  }
}
</script>

<style>
.persistent-error-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10050;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom)) 124px;
  background: #3a1616;
  color: var(--color-cream, #fffcef);
  border-top: 1px solid var(--color-error, #c44747);
  box-shadow: 0 -6px 18px rgba(0, 0, 0, 0.35);
}

.persistent-error-message {
  flex: 1;
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.4;
}

.persistent-error-copy,
.persistent-error-dismiss {
  flex-shrink: 0;
  background: transparent;
  color: inherit;
  border: 1px solid rgba(255, 252, 239, 0.35);
  border-radius: 6px;
  padding: 6px 10px;
  font: inherit;
  cursor: pointer;
}

.persistent-error-copy:hover,
.persistent-error-dismiss:hover {
  background: rgba(255, 252, 239, 0.08);
}

@media (max-width: 768px) {
  .persistent-error-bar {
    padding-left: 76px;
  }

  html.has-mobile-tab-bar .persistent-error-bar {
    bottom: calc(88px + env(safe-area-inset-bottom));
    padding-bottom: 12px;
  }
}
</style>
