<template>
  <div v-if="isOpen" class="modal-overlay" @click.stop="onClose">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h3>Create account</h3>
        <button class="close-button" @click.stop="onClose">×</button>
      </div>
      <div class="modal-content">
        <div class="panel">
          <label for="register-email">Email</label>
          <input v-model="email" type="email" placeholder="you@example.com" id="register-email" name="email" autocomplete="email" autocapitalize="off" spellcheck="false" />
          <label for="register-phone">Phone (optional)</label>
          <input v-model="phone" type="tel" placeholder="+1 555 123 4567" id="register-phone" name="tel" autocomplete="tel" inputmode="tel" />
          <label for="register-username">Tag (required)</label>
          <input 
            v-model="userTag" 
            type="text" 
            placeholder="unique, numbers, letters, underscores, and hyphens only" 
            pattern="[A-Za-z0-9_-]*" 
            title="Only letters, numbers, underscores, and hyphens are allowed"
            id="register-username"
            name="username"
            autocomplete="username"
            autocapitalize="off"
            spellcheck="false"
            @input="onTagInput"
          />
          <p v-if="tagError" class="error">{{ tagError }}</p>
          <label for="register-nickname">Display name (required)</label>
          <input v-model="displayName" type="text" placeholder="Display name" id="register-nickname" name="nickname" autocomplete="nickname" />
          <label for="register-password">Password</label>
          <input v-model="password" type="password" placeholder="••••••••" id="register-password" name="new-password" autocomplete="new-password" />
          <p class="hint">Minimum 8 characters, must include a letter and a number.</p>
          <hr class="hr">
          <div class="notify">
            <div class="notify-label">Notify me of new direct messages at:</div>
            <div class="notify-buttons">
              <button type="button" :class="['chip', { selected: notify.email }]" @click="selectNotify('email')">Email</button>
              <button type="button" :class="['chip', { selected: notify.phone, disabled: !phone }]" :disabled="!phone" @click="selectNotify('phone')">Phone</button>
            </div>
            <p class="hint">Notifications are sent only to verified contacts, and only after your email is verified.</p>
          </div>
          <p v-if="error" class="error">{{ error }}</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="primary" :disabled="busy || !canSubmit" @click="submit">Create account</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useAuthentication } from '@/composables/useAuthentication'

const props = defineProps({ isOpen: { type: Boolean, default: false } })
const emit = defineEmits(['close','success'])

const email = ref('')
const phone = ref('')
const endpoint = ref('')
const userTag = ref('')
const displayName = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')
const notify = ref({ email: false, phone: false, endpoint: false })
const tagError = ref('')

const { registerWithPassword } = useAuthentication()

watch(() => props.isOpen, (open) => {
  if (open) {
    email.value = ''
    phone.value = ''
    endpoint.value = ''
    userTag.value = ''
    displayName.value = ''
    password.value = ''
    busy.value = false
    error.value = ''
    notify.value = { email: false, phone: false, endpoint: false }
    tagError.value = ''
  }
})

const onClose = () => emit('close')

const canSubmit = computed(() => {
  const hasEmailPw = !!email.value && !!password.value
  const hasTag = !!(userTag.value || '').trim()
  const hasDisplay = !!(displayName.value || '').trim()
  return hasEmailPw && hasTag && hasDisplay && !tagError.value
})

const validateTag = () => {
  tagError.value = ''
  const tag = (userTag.value || '').trim()
  if (!tag) {
    tagError.value = 'Tag is required'
    return false
  }
  if (!/^[A-Za-z0-9_-]+$/.test(tag)) {
    tagError.value = 'Tag must contain only letters, numbers, underscores, and hyphens'
    return false
  }
  return true
}

const submit = async () => {
  busy.value = true
  error.value = ''
  try {
    if (!email.value || !password.value) throw new Error('Email and password required')
    if (!validateTag()) throw new Error(tagError.value)
    if (!(displayName.value || '').trim()) throw new Error('Display name required')
    await registerWithPassword({
      email: email.value,
      password: password.value,
      user_tag: userTag.value,
      display_name: (displayName.value || '').trim(),
      phone: phone.value || undefined,
      endpoint: endpoint.value || undefined,
      notify: notify.value
    })
    emit('success')
    emit('close')
  } catch (e) {
    if ((e && e.message) === 'user_tag_in_use') {
      tagError.value = 'That tag is already taken'
      error.value = ''
    } else {
      error.value = e.message || 'Registration failed'
    }
  } finally {
    busy.value = false
  }
}

const selectNotify = (channel) => {
  if (channel === 'phone' && !phone.value) return
  notify.value[channel] = !notify.value[channel]
}

const onTagInput = () => {
  userTag.value = (userTag.value || '').replace(/[^A-Za-z0-9_-]/g, '')
  validateTag()
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background-color: rgba(0,0,0,0.75);
  display: flex; justify-content: center; align-items: center;
  z-index: var(--z-index-modal);
  backdrop-filter: blur(2px);
}
.modal-container {
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  width: 90%; max-width: 500px; height: 70vh; max-height: 70vh;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  border: 1px solid var(--color-border);
  overflow: hidden; animation: modal-appear var(--transition-normal);
  display: flex; flex-direction: column;
}
@keyframes modal-appear { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.modal-header { padding: var(--space-md) var(--space-lg); border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { margin: 0; font-size: var(--font-size-lg); color: var(--color-text); font-weight: 600; }
.close-button { background: none; border: none; font-size: var(--font-size-xl); cursor: pointer; color: var(--color-text-secondary); padding: 4px; border-radius: var(--radius-sm); transition: all var(--transition-fast); height: 24px; width: 24px; display: flex; align-items: center; justify-content: center; }
.close-button:hover { color: var(--color-text); background-color: var(--color-hover-overlay); }
.modal-content { padding: var(--space-lg); flex: 1; overflow-y: auto; min-height: 0; }
.modal-footer { padding: var(--space-md) var(--space-lg); border-top: 1px solid var(--color-border); display: flex; justify-content: flex-end; gap: var(--space-md); flex-shrink: 0; }
.panel { display: flex; flex-direction: column; gap: var(--space-sm); }
label { font-size: var(--font-size-xs); color: var(--color-text-secondary); }
input { padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: var(--font-size-sm); background: var(--color-surface); color: var(--color-text); }
.primary { background: var(--color-primary); color: var(--color-text-inverse); border: none; padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; }
.error { color: var(--color-error); margin-top: var(--space-sm); font-size: var(--font-size-sm); }
.hint { color: var(--color-text-secondary); margin-top: 0; font-size: var(--font-size-xs); }
.notify { display: flex; flex-direction: column; gap: var(--space-xs); margin-top: 0; }
.notify-label { font-size: var(--font-size-xs); color: var(--color-text-secondary); }
.notify-buttons { display: flex; gap: var(--space-xs); flex-wrap: wrap; }
.chip { border: 1px solid var(--color-border); background: transparent; color: var(--color-text); padding: 6px 10px; border-radius: 16px; cursor: pointer; font-size: var(--font-size-xs); }
.chip.selected { background: var(--color-primary); color: var(--color-text-inverse); border-color: var(--color-primary); }
.chip.disabled { opacity: 0.5; cursor: not-allowed; }
.none-link { background: none; border: none; color: var(--color-text-secondary); text-decoration: underline; font-size: var(--font-size-xs); width: fit-content; padding: 0; cursor: pointer; }
.hr { margin-top: 0; margin-bottom: 12px; border: none; border-top: 1px solid var(--color-border); }
@media (max-width: 768px) { .modal-container { width: 95%; height: 80vh; max-height: 80vh; } .modal-content { padding: var(--space-md); } }
</style>


