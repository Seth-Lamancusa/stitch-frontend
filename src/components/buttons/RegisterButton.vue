<template>
  <div>
    <button class="register-btn" @click="open">Register</button>
    <RegisterModal :is-open="openModal" @close="close" @success="onSuccess" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import RegisterModal from '@/components/modals/RegisterModal.vue'

const openModal = ref(false)
const router = useRouter()

const open = () => { openModal.value = true }
const close = () => { openModal.value = false }
const onSuccess = async () => {
  await new Promise(r => setTimeout(r, 200))
  router.push('/inbox')
}
</script>

<style scoped>
.register-btn {
  background-color: var(--color-primary, #4f8cff);
  color: var(--color-text-inverse, #fff);
  padding: var(--space-xs, 6px) var(--space-sm, 12px);
  border: none;
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  font-size: var(--font-size-xs, 0.85rem);
}
.register-btn:hover { background-color: var(--color-primary-dark, #357ae8); }
</style>


