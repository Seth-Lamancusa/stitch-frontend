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


