import { computed, onBeforeUnmount, ref } from 'vue'

export function useDelayedHover({ hideDelayMs = 120 } = {}) {
  const hovered = ref(false)
  const pinned = ref(false)
  const sticky = ref(false)
  let hideTimer = null

  const clearHideTimer = () => {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
  }

  const enter = () => {
    clearHideTimer()
    hovered.value = true
  }

  const leave = () => {
    clearHideTimer()
    hideTimer = setTimeout(() => {
      hovered.value = false
      hideTimer = null
    }, hideDelayMs)
  }

  const togglePinned = () => {
    pinned.value = !pinned.value
  }

  const visible = computed(() => hovered.value || pinned.value || sticky.value)

  onBeforeUnmount(clearHideTimer)

  return {
    hovered,
    pinned,
    sticky,
    visible,
    enter,
    leave,
    togglePinned,
    clearHideTimer
  }
}
