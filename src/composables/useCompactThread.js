import { computed } from 'vue'
import { useStore } from 'vuex'

export function useCompactThread() {
  const store = useStore()
  const compactThread = computed(() => store.getters['ui/compactThread'])

  const setCompactThread = (value) => {
    store.dispatch('ui/setCompactThread', value)
  }

  const toggleCompactThread = () => {
    store.dispatch('ui/toggleCompactThread')
  }

  return { compactThread, setCompactThread, toggleCompactThread }
}
