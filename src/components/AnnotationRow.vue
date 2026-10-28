<template>
  <div
    v-if="annotation && !unavailable"
    class="annotation-card"
    :class="{ 'is-open': open }"
    @mouseover="onPointerOver"
    @mouseleave="hover = false"
  >
    <button
      type="button"
      class="annotation-toggle"
      :aria-expanded="open ? 'true' : 'false'"
      @click.stop="toggle"
    >
      <svg class="chevron" :class="{ 'is-open': open }" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6 3.5 L11 8 L6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span class="annotation-label">annotation</span>
      <span v-if="!open && preview" class="annotation-preview">{{ preview }}</span>
    </button>
    <div v-if="open" class="annotation-expanded">
      <div class="annotation-author">{{ authorName }}</div>
      <div class="annotation-text">
        <AnnotatedBody
          :message="annotation"
          :options="options"
          :can-annotate="canAnnotate"
          :pin-controls="pinControls"
          :depth="depth + 1"
        />
      </div>
    </div>
    <div
      v-if="canDelete"
      class="annotation-toolbar"
      :class="{ 'is-visible': showToolbar }"
    >
      <button
        v-if="canDelete"
        type="button"
        class="annotation-delete"
        :class="{ 'is-confirm': confirming }"
        :disabled="deleting"
        :title="deleteLabel"
        :aria-label="deleteLabel"
        @click.stop="onDelete"
      >
        <svg v-if="confirming" viewBox="0 0 16 16" aria-hidden="true">
          <path fill="currentColor" d="M6.1 11.2 3.4 8.5l-1 1 3.7 3.7 7.5-7.5-1-1z" />
        </svg>
        <svg v-else viewBox="0 0 16 16" aria-hidden="true">
          <path fill="currentColor" d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5zm3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0z" />
        </svg>
      </button>
    </div>
    <p v-if="deleteError" class="annotation-delete-error">{{ deleteError }}</p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useStore } from 'vuex'
import AnnotatedBody from './AnnotatedBody.vue'
import { getAuthorDisplayName } from '../utils/messageCompat.js'
import { previewLine } from '../utils/annotations.js'

const props = defineProps({
  annotationId: { type: String, required: true },
  options: { type: Object, default: () => ({}) },
  canAnnotate: { type: Boolean, default: false },
  pinControls: { type: Boolean, default: false },
  depth: { type: Number, default: 0 }
})

const store = useStore()
const open = ref(false)
const hover = ref(false)
const confirming = ref(false)
const deleting = ref(false)
const deleteError = ref('')

const unavailable = computed(() => !!store.state.messages.unavailableAnnotationIds?.[props.annotationId])
const annotation = computed(() => store.getters['messages/getMessage'](props.annotationId))
const preview = computed(() => previewLine(annotation.value?.content))
const authorName = computed(() => getAuthorDisplayName(annotation.value))
const canDelete = computed(() => store.getters['auth/canDeleteMessage'](annotation.value))
const showToolbar = computed(() => (
  hover.value || confirming.value || deleting.value || props.pinControls
))
const deleteLabel = computed(() => {
  if (deleting.value) return 'Deleting annotation'
  return confirming.value ? 'Confirm delete' : 'Delete annotation'
})

function onPointerOver(event) {
  hover.value = event.target.closest('.annotation-card') === event.currentTarget
}

function toggle() {
  confirming.value = false
  open.value = !open.value
}

async function onDelete() {
  if (deleting.value) return
  if (!confirming.value) {
    confirming.value = true
    return
  }
  deleting.value = true
  deleteError.value = ''
  try {
    await store.dispatch('messages/deleteMessage', {
      messageId: props.annotationId,
      deleteDescendants: false
    })
  } catch (err) {
    deleteError.value = err?.message || 'Could not delete annotation'
    confirming.value = false
  } finally {
    deleting.value = false
  }
}
</script>

<style scoped>
.annotation-card {
  position: relative;
  margin: 12px 0 10px;
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
}

.annotation-card:has(.annotation-toolbar.is-visible) .annotation-toggle {
  padding-right: 28px;
}

.annotation-toggle {
  display: flex;
  align-items: baseline;
  gap: 6px;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font: inherit;
  font-size: var(--font-size-xs);
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}

.chevron {
  flex: none;
  width: 12px;
  height: 12px;
  align-self: center;
  transition: transform 0.18s ease;
}

.chevron.is-open {
  transform: rotate(90deg);
}

.annotation-label {
  flex: none;
  letter-spacing: 0.02em;
}

.annotation-preview {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text);
  font-style: italic;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.annotation-expanded {
  margin-top: 6px;
}

.annotation-author {
  margin-top: 7px;
  margin-bottom: 2px;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: 600;
  letter-spacing: 0.01em;
}

.annotation-text :deep(.formatted-content) {
  color: var(--color-text);
  font-size: 0.95rem;
  font-style: italic;
}

.annotation-text :deep(.message-parts > .message-part:not(:last-child)) {
  margin-bottom: 2px;
}

.annotation-toolbar {
  position: absolute;
  top: 0;
  right: 0;
  margin-top: 3px;
  margin-left: 4px;
  margin-right: 4px;
  z-index: 6;
  display: inline-flex;
  align-items: center;
  padding: 1px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}

.annotation-toolbar.is-visible {
  opacity: 1;
  pointer-events: auto;
}

.annotation-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.annotation-delete svg {
  width: 11px;
  height: 11px;
}

.annotation-delete:hover:not(:disabled) {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.annotation-delete.is-confirm,
.annotation-delete.is-confirm:hover:not(:disabled) {
  color: #e05a5a;
}

.annotation-delete:disabled {
  opacity: 0.6;
  cursor: default;
}

.annotation-delete-error {
  margin: 4px 0 0;
  color: #e05a5a;
  font-size: var(--font-size-xs);
}
</style>
