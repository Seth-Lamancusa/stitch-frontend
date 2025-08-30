<template>
  <div>
    <button
      class="login-btn"
      :disabled="isLoggingIn"
      @click="openLoginModal"
    >
      {{ isLoggingIn ? 'Signing in...' : 'Login' }}
    </button>
    <LoginModal :is-open="showLogin" @close="closeLoginModal" @success="onSuccess" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStore } from 'vuex'
import { useAuthentication } from '@/composables/useAuthentication'
import RegisterButton from '@/components/buttons/RegisterButton.vue'
import LoginModal from '@/components/modals/LoginModal.vue'

// Props allow different login strategies if needed
// strategy: 'apiKey' | 'google'
const props = defineProps({
  strategy: { type: String, default: 'apiKey' }
})

const isLoggingIn = ref(false)
const router = useRouter()
const route = useRoute()
const store = useStore()
const { logout } = useAuthentication()
const showLogin = ref(false)

const openLoginModal = () => { showLogin.value = true }
const closeLoginModal = () => { showLogin.value = false }
const onSuccess = async () => {
  // After successful login, route if redirect present
  await new Promise(resolve => setTimeout(resolve, 300))
  if (route.query.redirect) router.push(route.query.redirect)
}
</script>

<style scoped>
.login-btn {
  background-color: var(--color-primary, #4f8cff);
  color: var(--color-text-inverse, #fff);
  padding: var(--space-xs, 6px) var(--space-sm, 12px);
  border: none;
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  font-size: var(--font-size-xs, 0.85rem);
  text-decoration: none;
}

.login-btn:hover {
  background-color: var(--color-primary-dark, #357ae8);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>


