<template>
  <div class="reset-container">
    <h2>Password reset</h2>
    <div class="card">
      <label>Email</label>
      <input v-model="email" type="email" placeholder="you@example.com" />
      <div v-if="needsTag" class="tag-row">
        <label>User tag</label>
        <input v-model="userTag" @input="onTagInput" type="text" placeholder="your_tag (without @)" />
        <p class="hint">Multiple accounts use this email. Enter your @tag to continue.</p>
      </div>
      <div class="row">
        <input v-model="code" type="text" placeholder="6-digit code" />
        <button class="secondary" :disabled="busy || cooldown>0 || !email || (needsTag && !hasValidTag)" @click="requestCode">
          {{ cooldown>0 ? `Resend in ${cooldown}s` : 'Get code' }}
        </button>
      </div>
      <label>New password</label>
      <input v-model="newPassword" type="password" placeholder="••••••••" />
      <p class="hint">Minimum 8 characters, must include a letter and a number.</p>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="actions">
        <button class="primary" :disabled="busy || (needsTag && !hasValidTag)" @click="reset">Reset password</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthentication } from '@/composables/useAuthentication'

const router = useRouter()
const { requestPasswordResetCode, resetPasswordWithCode } = useAuthentication()

const email = ref('')
const userTag = ref('')
const needsTag = ref(false)
const code = ref('')
const newPassword = ref('')
const busy = ref(false)
const error = ref('')
const cooldown = ref(0)
let timer = null

const normalizeTag = (val) => {
  let s = String(val || '')
  // Remove leading '@'s
  while (s.startsWith('@')) s = s.slice(1)
  // Strip disallowed characters
  s = s.replace(/[^A-Za-z0-9_-]/g, '')
  return s
}

const hasValidTag = computed(() => normalizeTag(userTag.value).length > 0)

const onTagInput = () => {
  userTag.value = normalizeTag(userTag.value)
}

const requestCode = async () => {
  busy.value = true
  error.value = ''
  try {
    if (!email.value) throw new Error('Email required')
    await requestPasswordResetCode(email.value, needsTag.value ? normalizeTag(userTag.value) : undefined)
    cooldown.value = 30
    if (timer) clearInterval(timer)
    timer = setInterval(() => {
      cooldown.value = Math.max(0, cooldown.value - 1)
      if (cooldown.value === 0 && timer) { clearInterval(timer); timer = null }
    }, 1000)
  } catch (e) {
    if (e && e.message === 'multiple_accounts_for_email') {
      if (!needsTag.value) {
        needsTag.value = true
        error.value = 'Multiple accounts match this email. Enter your @tag to continue.'
      } else if (hasValidTag.value) {
        error.value = 'That tag does not match this email. Check spelling.'
      } else {
        error.value = 'Enter your @tag to continue.'
      }
    } else {
      error.value = e.message || 'Failed to request code'
    }
  } finally {
    busy.value = false
  }
}

const reset = async () => {
  busy.value = true
  error.value = ''
  try {
    if (!email.value || !code.value || !newPassword.value) throw new Error('All fields required')
    await resetPasswordWithCode({ email: email.value, user_tag: needsTag.value ? normalizeTag(userTag.value) : undefined, code: code.value, new_password: newPassword.value })
    router.push('/inbox')
  } catch (e) {
    if (e && e.message === 'multiple_accounts_for_email') {
      needsTag.value = true
      error.value = hasValidTag.value ? 'That tag does not match this email. Check spelling.' : 'Multiple accounts match this email. Enter your @tag to continue.'
    } else {
      error.value = e.message || 'Password reset failed'
    }
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.reset-container { max-width: 480px; margin: 40px auto; padding: 0 16px; }
.card { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 16px; background: var(--color-surface); }
label { font-size: var(--font-size-xs); color: var(--color-text-secondary); }
input { width: 100%; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); margin-bottom: 8px; }
.row { display: flex; gap: 8px; }
.tag-row { margin: 8px 0; }
.actions { display: flex; justify-content: flex-end; margin-top: 8px; }
.primary { background: var(--color-primary); color: var(--color-text-inverse); border: none; padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; }
.secondary { background: transparent; color: var(--color-primary); border: 1px solid var(--color-primary); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; }
.error { color: var(--color-error); margin-top: 6px; font-size: var(--font-size-sm); }
.hint { color: var(--color-text-secondary); margin-top: 4px; font-size: var(--font-size-xs); }
</style>


