<template>
  <div
    ref="toolbarRef"
    class="compact-hover-toolbar"
    :class="{ 'is-visible': visible }"
    @click.stop
  >
    <span class="compact-reply-count" title="Replies">{{ replyCount }} 💬</span>

    <CompactActionButton
      v-for="action in primaryActions"
      :key="action.id"
      :action="action"
      :show-text="false"
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
import { clampMenuToMessageList, messageListClipBounds } from '../../utils/menuPlacement.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  primaryActions: { type: Array, default: () => [] },
  moreActions: { type: Array, default: () => [] },
  replyCount: { type: Number, default: 0 },
  menuOpen: { type: Boolean, default: false }
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

  const bounds = messageListClipBounds(toolbar)
  const toolbarRect = toolbar.getBoundingClientRect()
  const spaceAbove = toolbarRect.top - bounds.top
  const spaceBelow = bounds.bottom - toolbarRect.bottom
  const needed = menu.scrollHeight
  const openAbove = needed <= spaceAbove || spaceAbove >= spaceBelow
  menuSide.value = openAbove ? 'above' : 'below'

  requestAnimationFrame(() => {
    const menuEl = moreMenuRef.value
    const anchor = toolbarRef.value
    if (!menuEl || !anchor || !moreOpen.value) return
    clampMenuToMessageList(menuEl, anchor, {
      openingBelow: menuSide.value === 'below',
      gap: 0
    })
  })
}

const onDocumentPointerDown = (event) => {
  if (!moreOpen.value || props.menuOpen) return
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
    if (!isVisible && !props.menuOpen) setMoreOpen(false)
  }
)

watch(
  () => props.menuOpen,
  (open) => {
    setMoreOpen(!!open)
  },
  { immediate: true }
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
  bottom: -16px;
  z-index: 6;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}

.compact-hover-toolbar.is-visible {
  opacity: 1;
  pointer-events: auto;
}

.compact-reply-count {
  padding: 0 6px;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
  line-height: 1;
}

.more-wrap {
  align-self: stretch;
  display: flex;
  align-items: center;
}

.compact-hover-toolbar > :deep(.compact-action-button) {
  height: 24px;
  min-height: 24px;
  padding-top: 2px;
  padding-bottom: 2px;
  line-height: 1;
}

.more-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 24px;
  min-height: 24px;
  padding: 2px 8px;
  line-height: 1;
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
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  width: 280px;
  padding: 6px;
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
  min-width: 0;
  justify-content: flex-start;
}
</style>
