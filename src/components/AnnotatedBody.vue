<template>
  <div class="annotated-body">
    <div v-if="showParts" class="message-parts">
      <div
        v-for="(part, index) in parts"
        :key="index"
        class="message-part"
      >
        <div
          class="message-part-text"
          :class="{ 'is-active': partActive(index) }"
          @mouseenter="activePart = index"
          @mouseleave="leavePart(index)"
          @click="onPartClick(index)"
        >
          <formatted-content :content="partText(part)" :options="options" />
          <div
            v-if="canAnnotate && depth < maxDepth"
            class="part-hover-toolbar"
            :class="{ 'is-visible': partActive(index) }"
          >
            <button
              type="button"
              class="part-annotate"
              title="Annotate"
              aria-label="Annotate"
              @click.stop="openPart(index)"
            >+</button>
          </div>
        </div>
        <template v-if="depth < maxDepth">
          <AnnotationRow
            v-for="ref in refsForPart(partRefs, index)"
            :key="ref.id"
            :annotation-id="ref.id"
            :options="options"
            :can-annotate="canAnnotate"
            :pin-controls="pinControls"
            :depth="depth"
          />
        </template>
        <form
          v-if="composePart === index"
          class="annotation-composer"
          @submit.prevent="submit(index)"
        >
          <textarea
            ref="partComposerRef"
            v-model="draft"
            rows="2"
            placeholder="Annotation"
            @keydown.enter.exact.prevent="submit(index)"
            @keydown.escape.prevent="closePart"
          />
          <div class="annotation-composer-actions">
            <button type="submit" :disabled="sending || !draft.trim()">Save</button>
            <button type="button" @click="closePart">Cancel</button>
          </div>
          <p v-if="error" class="annotation-error">{{ error }}</p>
        </form>
      </div>
    </div>

    <AnnotationRow
      v-for="ref in wholeRefs"
      :key="ref.id"
      :annotation-id="ref.id"
      :options="options"
      :can-annotate="canAnnotate"
      :pin-controls="pinControls"
      :depth="depth"
    />
    <form
      v-if="composingWhole && depth < maxDepth"
      class="annotation-composer"
      @submit.prevent="submit(null)"
    >
      <textarea
        ref="wholeComposerRef"
        v-model="draft"
        rows="2"
        placeholder="Annotation"
        @keydown.enter.exact.prevent="submit(null)"
        @keydown.escape.prevent="closeWhole"
      />
      <div class="annotation-composer-actions">
        <button type="submit" :disabled="sending || !draft.trim()">Save</button>
        <button type="button" @click="closeWhole">Cancel</button>
      </div>
      <p v-if="error" class="annotation-error">{{ error }}</p>
    </form>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useStore } from 'vuex'
import FormattedContent from './FormattedContent/index.vue'
import AnnotationRow from './AnnotationRow.vue'
import {
  annotationRefs,
  displayParts,
  orderAnnotationRefs,
  partText,
  refsForPart,
  wholeMessageRefs
} from '../utils/annotations.js'

const maxDepth = 8

const props = defineProps({
  message: { type: Object, required: true },
  options: { type: Object, default: () => ({}) },
  canAnnotate: { type: Boolean, default: false },
  pinControls: { type: Boolean, default: false },
  composingWhole: { type: Boolean, default: false },
  renderParts: { type: Boolean, default: true },
  depth: { type: Number, default: 0 }
})

const emit = defineEmits(['done-whole'])

const store = useStore()
const activePart = ref(null)
const composePart = ref(null)
const draft = ref('')
const sending = ref(false)
const error = ref('')
const partComposerRef = ref(null)
const wholeComposerRef = ref(null)

const parts = computed(() => (props.renderParts ? displayParts(props.message) : null))
const showParts = computed(() => Array.isArray(parts.value) && parts.value.length > 0)
const partRefs = computed(() => orderAnnotationRefs(
  annotationRefs(props.message),
  (ref) => store.getters['messages/getMessage'](ref.id)?.timestamp
))
const wholeRefs = computed(() => (props.depth < maxDepth ? wholeMessageRefs(partRefs.value) : []))

const annotationIds = computed(() => partRefs.value.map((ref) => ref.id).join('\0'))

watch(annotationIds, () => {
  const ids = partRefs.value.map((ref) => ref.id)
  if (!ids.length || props.depth >= maxDepth) return
  store.dispatch('messages/ensureAnnotations', ids)
}, { immediate: true })

watch(() => props.composingWhole, async (open) => {
  if (!open) return
  composePart.value = null
  draft.value = ''
  error.value = ''
  await nextTick()
  focusComposer(wholeComposerRef.value)
})

function partActive(index) {
  return activePart.value === index || composePart.value === index
}

function leavePart(index) {
  if (composePart.value === index) return
  if (activePart.value === index) activePart.value = null
}

function onPartClick(index) {
  if (!props.pinControls) return
  activePart.value = index
}

function focusComposer(target) {
  const el = Array.isArray(target) ? target[0] : target
  el?.focus?.()
}

async function openPart(index) {
  composePart.value = index
  draft.value = ''
  error.value = ''
  emit('done-whole')
  await nextTick()
  focusComposer(partComposerRef.value)
}

function closePart() {
  composePart.value = null
  draft.value = ''
  error.value = ''
}

function closeWhole() {
  draft.value = ''
  error.value = ''
  emit('done-whole')
}

async function submit(part) {
  const content = draft.value.trim()
  if (!content || sending.value || !props.message?.id) return
  sending.value = true
  error.value = ''
  try {
    await store.dispatch('messages/createAnnotation', {
      targetId: props.message.id,
      content,
      part: Number.isInteger(part) ? part : null
    })
    draft.value = ''
    if (Number.isInteger(part)) closePart()
    else closeWhole()
  } catch (err) {
    error.value = err?.message || 'Could not save annotation'
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.annotated-body {
  min-width: 0;
}

.message-part {
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
}

.message-parts > .message-part:not(:last-child) {
  margin-bottom: var(--space-sm);
}

.message-part-text {
  position: relative;
  border: none;
  border-radius: 8px;
  background: transparent;
  padding: 4px 8px;
  margin: -4px -8px;
  transition: background-color 0.18s ease;
}

.message-part-text.is-active {
  background: color-mix(in srgb, var(--color-hover-overlay) 40%, transparent);
}

.message-part-text :deep(.formatted-content > p:last-child) {
  margin-bottom: 0;
}

.part-hover-toolbar {
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

.part-hover-toolbar.is-visible {
  opacity: 1;
  pointer-events: auto;
}

.part-annotate {
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
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.part-annotate:hover {
  background: var(--color-surface-hover);
  color: var(--color-primary);
}

.annotation-composer {
  margin-top: 6px;
}

.annotation-composer textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-sm);
}

.annotation-composer-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.annotation-composer-actions button {
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font: inherit;
  font-size: var(--font-size-xs);
  cursor: pointer;
  padding: 2px 0;
}

.annotation-composer-actions button:hover:not(:disabled) {
  color: var(--color-primary);
}

.annotation-composer-actions button:disabled {
  opacity: 0.5;
  cursor: default;
}

.annotation-error {
  margin: 4px 0 0;
  color: var(--color-danger, #d66);
  font-size: var(--font-size-xs);
}
</style>
