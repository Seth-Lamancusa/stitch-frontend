<template>
  <div v-if="isOpen" class="modal-overlay" @pointerdown="onOverlayPointerDown" @click.self="onOverlayClick">
    <div class="modal-container" @click.stop @pointerdown="onContainerPointerDown">
      <div class="modal-header">
        <h3>Sign in</h3>
        <button class="close-button" @click.stop="onClose">×</button>
      </div>
      <form
        class="modal-form"
        method="post"
        action="/login"
        autocomplete="on"
        @submit.prevent="submitPassword"
      >
      <div class="modal-content">
        <div class="panel">
          <label for="login-identifier">Tag, Email, or Phone</label>
          <input
            id="login-identifier"
            name="username"
            autocomplete="username"
            v-model="identifier"
            type="text"
            placeholder="tag, email, or phone"
            enterkeyhint="next"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            required
          />
          <label for="login-password">Password</label>
          <div class="password-field">
            <input
              id="login-password"
              name="password"
              autocomplete="current-password"
              :type="showPassword ? 'text' : 'password'"
              v-model="password"
              placeholder="••••••••"
              enterkeyhint="go"
              required
            />
            <button type="button" class="eye-toggle" @click="showPassword = !showPassword" :aria-pressed="showPassword ? 'true' : 'false'" :title="showPassword ? 'Hide password' : 'Show password'">
              {{ showPassword ? '🙈' : '👁️' }}
            </button>
          </div>
          <div class="row between">
            <span></span>
            <router-link class="forgot" to="/reset-password">Forgot password?</router-link>
          </div>
          <p v-if="error" class="error">{{ error }}</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="primary" :disabled="busy" :aria-busy="busy ? 'true' : 'false'" type="submit">{{ busy ? 'Signing in…' : 'Sign in' }}</button>
      </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useStore } from 'vuex'
import { useAuthentication } from '@/composables/useAuthentication'

const props = defineProps({
  isOpen: { type: Boolean, default: false }
})
const emit = defineEmits(['close','success'])

const identifier = ref('')
const password = ref('')
const showPassword = ref(false)
const busy = ref(false)
const error = ref('')

const store = useStore()
const { signInWithPassword } = useAuthentication()

// Overlay click guard: prevent close when pointer starts inside and ends outside
const startedInsideModal = ref(false)
const onContainerPointerDown = () => { startedInsideModal.value = true }
const onOverlayPointerDown = () => { startedInsideModal.value = false }
const onOverlayClick = () => {
  if (startedInsideModal.value) { startedInsideModal.value = false; return }
  onClose()
}

// Identifier validation
// - tag: letters, numbers, hyphen (no leading @ in input)
// - email: basic pattern user@host.tld
// - phone: digits with optional leading +, 7-15 digits total
const TAG_RE = /^[A-Za-z0-9-]+$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_RE = /^\+?\d{7,15}$/

const classifyIdentifier = (raw) => {
  const v = String(raw || '').trim()
  if (!v) return null
  if (EMAIL_RE.test(v)) return 'email'
  if (PHONE_RE.test(v)) return 'phone'
  if (TAG_RE.test(v)) return 'tag'
  return null
}

watch(() => props.isOpen, (open) => {
  if (open) {
    identifier.value = ''
    password.value = ''
    showPassword.value = false
    error.value = ''
  }
})

const onClose = () => emit('close')

const persistPasswordManagerCredentials = async (id, secret) => {
  try {
    if (typeof window === 'undefined' || !window.PasswordCredential || !navigator.credentials?.store) return
    const credential = new window.PasswordCredential({ id, password: secret, name: id })
    await navigator.credentials.store(credential)
  } catch {
    // Browser declined or does not support Credential Management; form metadata still applies.
  }
}

const submitPassword = async () => {
  if (busy.value) return
  busy.value = true
  error.value = ''
  showPassword.value = false
  try {
    if (!identifier.value || !password.value) throw new Error('Identifier and password required')
    const trimmed = identifier.value.trim()
    const kind = classifyIdentifier(trimmed)
    if (!kind) {
      throw new Error('Enter a valid tag, email, or phone number')
    }
    const toSend = (kind === 'tag')
      ? `@${(trimmed.startsWith('@') ? trimmed.slice(1) : trimmed).toLowerCase()}`
      : trimmed
    await signInWithPassword(toSend, password.value)
    await persistPasswordManagerCredentials(trimmed, password.value)
    emit('success')
    // Keep the filled form in the DOM briefly so the browser can snapshot it.
    await new Promise((resolve) => setTimeout(resolve, 250))
    emit('close')
  } catch (e) {
    const msg = e && e.message ? e.message : ''
    error.value = (msg === 'multiple_accounts_for_email') ? 'Multiple accounts use that email. Sign in with your @tag.' : (msg || 'Login failed')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--z-index-modal);
  backdrop-filter: blur(2px);
}

.modal-container {
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  width: 90%;
  max-width: 500px;
  max-height: 70vh;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-border);
  overflow: hidden;
  animation: modal-appear var(--transition-normal);
  display: flex;
  flex-direction: column;
}

.modal-form { display: flex; flex-direction: column; flex: 0 1 auto; min-height: 0; }

@keyframes modal-appear {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.modal-header {
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  color: var(--color-text);
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  font-size: var(--font-size-xl);
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: 4px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  height: 24px;
  width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover { color: var(--color-text); background-color: var(--color-hover-overlay); }

.modal-content {
  padding: var(--space-lg);
  flex: 0 1 auto;
  overflow-y: auto;
  min-height: 0;
}

.modal-footer {
  padding: var(--space-md) var(--space-lg);
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
  flex-shrink: 0;
}

.panel { display: flex; flex-direction: column; gap: var(--space-sm); }
label { font-size: var(--font-size-xs); color: var(--color-text-secondary); }
input { padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: var(--font-size-sm); background: var(--color-surface); color: var(--color-text); }
.password-field { position: relative; display: grid; grid-template-columns: 1fr auto; align-items: center; }
.password-field input { padding-right: 36px; }
.eye-toggle { margin-left: 6px; background: transparent; border: 1px solid var(--color-border); color: var(--color-text-secondary); border-radius: var(--radius-sm); cursor: pointer; padding: 6px 8px; font-size: 14px; }
.eye-toggle:hover { background: var(--color-hover-overlay); color: var(--color-text); }
.row.between { display: flex; justify-content: space-between; align-items: center; }
.forgot { font-size: var(--font-size-xs); color: var(--color-primary); text-decoration: none; }
.forgot:hover { text-decoration: underline; }
.primary { background: var(--color-primary); color: var(--color-text-inverse); border: none; padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; }
.secondary { background: transparent; color: var(--color-primary); border: 1px solid var(--color-primary); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; }
.error { color: var(--color-error); margin-top: var(--space-sm); font-size: var(--font-size-sm); }
.hint { color: var(--color-text-secondary); margin-top: var(--space-xs); font-size: var(--font-size-xs); }

@media (max-width: 768px) {
  .modal-container { width: 95%; max-height: 80vh; }
  .modal-content { padding: var(--space-md); }
}
</style>


