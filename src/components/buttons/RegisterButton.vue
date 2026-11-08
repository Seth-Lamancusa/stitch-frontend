<template>
  <div>
    <button class="register-btn" @click="open">Register</button>
    <RegisterModal :is-open="openModal" @close="close" @success="onSuccess" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStore } from 'vuex'
import RegisterModal from '@/components/modals/RegisterModal.vue'

const openModal = ref(false)
const router = useRouter()
const route = useRoute()
const store = useStore()

const authReady = computed(() => store.getters['auth/authReady'])
const user = computed(() => store.getters['auth/user'])

const isRegisterHash = () => {
  const h = (route.hash || window.location.hash || '').toLowerCase()
  return h === '#register'
}

const clearRegisterHash = () => {
  if (!isRegisterHash()) return
  try {
    router.replace({ path: route.path, query: route.query, hash: '' })
  } catch {
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }
}

const syncFromHash = () => {
  if (!authReady.value || user.value) return
  if (isRegisterHash()) {
    openModal.value = true
  }
}

const open = () => { openModal.value = true }
const close = () => {
  openModal.value = false
  clearRegisterHash()
}
const onSuccess = async () => {
  clearRegisterHash()
  await new Promise(r => setTimeout(r, 200))
  router.push('/inbox')
}

watch([authReady, user, () => route.hash, () => route.fullPath], syncFromHash, { immediate: true })
onMounted(() => {
  window.addEventListener('hashchange', syncFromHash)
  syncFromHash()
})
onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncFromHash)
})
</script>

<style scoped>
.register-btn {
  background-color: var(--color-primary, #4f8cff);
  color: var(--color-text-inverse, #fff);
  padding: 6px 12px;
  border: none;
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  font-size: calc(var(--font-size-xs, 0.85rem) - 2px);
  line-height: 1.1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
}
.register-btn:hover { background-color: var(--color-primary-dark, #357ae8); }
</style>


