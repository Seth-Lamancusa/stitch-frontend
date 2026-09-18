<template>
  <div
    v-show="visible"
    ref="toolbarRef"
    class="compact-hover-toolbar"
    @click.stop
  >
    <CompactActionButton
      v-for="action in primaryActions"
      :key="action.id"
      :action="action"
    />

    <div v-if="moreActions.length" ref="moreWrapRef" class="more-wrap">
      <button
        type="button"
        class="compact-action-button more-button"
        :class="{ active: moreOpen }"
        title="More actions"
        @click.stop="toggleMore"
      >
        <span class="action-emoji">⋯</span>
      </button>
    </div>

    <div
      v-if="moreOpen"
      ref="moreMenuRef"
      class="more-menu"
      :class="menuSide"
    >
      <CompactActionButton
        v-for="action in moreActions"
        :key="action.id"
        :action="action"
      />
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import CompactActionButton from './CompactActionButton.vue'

const VIEWPORT_PAD = 8

const props = defineProps({
  visible: { type: Boolean, default: false },
  primaryActions: { type: Array, default: () => [] },
  moreActions: { type: Array, default: () => [] }
})

const emit = defineEmits(['moreOpenChanged'])

const moreOpen = ref(false)
const menuSide = ref('above')
const toolbarRef = ref(null)
const moreWrapRef = ref(null)
const moreMenuRef = ref(null)

const setMoreOpen = (value) => {
  moreOpen.value = value
  if (!value) {
    menuSide.value = 'above'
  }
  emit('moreOpenChanged', value)
}

const toggleMore = () => setMoreOpen(!moreOpen.value)

const placeMoreMenu = () => {
  const toolbar = toolbarRef.value
  const menu = moreMenuRef.value
  if (!toolbar || !menu) return

  menu.style.maxHeight = ''
  menuSide.value = 'above'

  const toolbarRect = toolbar.getBoundingClientRect()
  const spaceAbove = toolbarRect.top - VIEWPORT_PAD
  const spaceBelow = window.innerHeight - VIEWPORT_PAD - toolbarRect.bottom
  const needed = menu.scrollHeight
  const openAbove = needed <= spaceAbove || spaceAbove >= spaceBelow
  const available = openAbove ? spaceAbove : spaceBelow

  menuSide.value = openAbove ? 'above' : 'below'
  menu.style.maxHeight = needed > available ? `${Math.max(available, 0)}px` : ''
}

const onDocumentPointerDown = (event) => {
  if (!moreOpen.value) return
  const wrap = moreWrapRef.value
  const menu = moreMenuRef.value
  if (wrap?.contains(event.target) || menu?.contains(event.target)) return
  setMoreOpen(false)
}

const onViewportChange = () => {
  if (moreOpen.value) placeMoreMenu()
}

watch(moreOpen, async (isOpen) => {
  if (isOpen) {
    document.addEventListener('pointerdown', onDocumentPointerDown, true)
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    await nextTick()
    placeMoreMenu()
  } else {
    document.removeEventListener('pointerdown', onDocumentPointerDown, true)
    window.removeEventListener('resize', onViewportChange)
    window.removeEventListener('scroll', onViewportChange, true)
  }
})

watch(
  () => props.visible,
  (isVisible) => {
    if (!isVisible) setMoreOpen(false)
  }
)

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})
</script>

<style scoped>
.compact-hover-toolbar {
  position: absolute;
  right: 8px;
  bottom: -22px;
  z-index: 6;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.more-wrap {
  align-self: stretch;
  display: flex;
  align-items: center;
}

.more-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  min-height: 32px;
  padding: 6px 8px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.more-button:hover,
.more-button.active {
  background-color: var(--color-surface-hover);
  color: var(--color-primary);
}

.more-menu {
  position: absolute;
  right: 0;
  z-index: 7;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  min-width: 168px;
  padding: 4px;
  overflow-x: hidden;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.16);
}

.more-menu.above {
  bottom: 100%;
  top: auto;
}

.more-menu.below {
  top: 100%;
  bottom: auto;
}

.more-menu :deep(.compact-action-button) {
  width: 100%;
  justify-content: flex-start;
  flex-shrink: 0;
}
</style>
