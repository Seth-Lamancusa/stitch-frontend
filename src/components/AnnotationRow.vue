<template>
  <div
    v-if="(annotation || loadingContent) && !unavailable"
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
      <span v-if="!open && loadingContent" class="annotation-loading">Loading</span>
      <span v-else-if="!open && preview" class="annotation-preview">{{ preview }}</span>
    </button>
    <div v-if="open" class="annotation-expanded">
      <p v-if="loadingContent" class="annotation-loading annotation-loading--block" aria-live="polite">Loading</p>
      <template v-else>
      <div class="annotation-author">
        <UserDisplay
          :user="authorView(annotation).user"
          :display-name="authorView(annotation).displayName"
          :user-tag="authorView(annotation).userTag"
          :show-tag="authorView(annotation).showTag"
          :is-current-user="authorView(annotation).isCurrentUser"
          :is-bot="authorView(annotation).isBot"
          :is-imported="authorView(annotation).imported"
          name-class="annotation-author-name"
          tag-class="annotation-author-tag"
          variant="message"
          :title="authorView(annotation).title"
        />
        <span
          v-if="authorView(annotation).imported"
          class="imported-badge"
          :title="authorView(annotation).badgeTitle"
        >
          via <UserDisplay
            :display-name="authorView(annotation).importerTag"
            :user-tag="authorView(annotation).importerTag"
            :show-tag="false"
            variant="badge"
            size="xs"
          />
          <a
            v-if="authorView(annotation).sourceUrl"
            :href="authorView(annotation).sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="import-source-link"
          >🔗</a>
        </span>
      </div>
      <div class="annotation-text">
        <AnnotatedBody
          :message="annotation"
          :options="options"
          :can-annotate="canAnnotate"
          :pin-controls="pinControls"
          :depth="depth + 1"
        />
      </div>
      <div
        v-for="reply in replyChain"
        :key="reply.id"
        class="annotation-reply"
      >
        <div class="annotation-author">
          <UserDisplay
            :user="authorView(reply).user"
            :display-name="authorView(reply).displayName"
            :user-tag="authorView(reply).userTag"
            :show-tag="authorView(reply).showTag"
            :is-current-user="authorView(reply).isCurrentUser"
            :is-bot="authorView(reply).isBot"
            :is-imported="authorView(reply).imported"
            name-class="annotation-author-name"
            tag-class="annotation-author-tag"
            variant="message"
            :title="authorView(reply).title"
          />
          <span
            v-if="authorView(reply).imported"
            class="imported-badge"
            :title="authorView(reply).badgeTitle"
          >
            via <UserDisplay
              :display-name="authorView(reply).importerTag"
              :user-tag="authorView(reply).importerTag"
              :show-tag="false"
              variant="badge"
              size="xs"
            />
            <a
              v-if="authorView(reply).sourceUrl"
              :href="authorView(reply).sourceUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="import-source-link"
            >🔗</a>
          </span>
        </div>
        <div class="annotation-text">
          <AnnotatedBody
            v-if="replyHasParts(reply)"
            :message="reply"
            :options="options"
            :can-annotate="canAnnotate"
            :pin-controls="pinControls"
            :depth="depth + 1"
          />
          <template v-else>
            <formatted-content :content="replyContent(reply)" :options="options" />
            <AnnotatedBody
              :message="reply"
              :render-parts="false"
              :options="options"
              :can-annotate="canAnnotate"
              :pin-controls="pinControls"
              :depth="depth + 1"
            />
          </template>
        </div>
      </div>
      <p v-if="loadingReplies" class="annotation-loading annotation-loading--block" aria-live="polite">Loading replies</p>
      </template>
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
import { computed, ref, watch } from 'vue'
import { useStore } from 'vuex'
import AnnotatedBody from './AnnotatedBody.vue'
import FormattedContent from './FormattedContent/index.vue'
import UserDisplay from './common/UserDisplay.vue'
import { contentText, getAuthorDisplayName, getAuthorUserTag, isAuthorBot, isCurrentUserAuthor } from '../utils/messageCompat.js'
import { continuationChain, displayParts, previewLine } from '../utils/annotations.js'

const CHAIN_LIMIT = 100

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
const loadingReplies = ref(false)
const loadingContent = ref(false)

const unavailable = computed(() => !!store.state.messages.unavailableAnnotationIds?.[props.annotationId])
const annotation = computed(() => store.getters['messages/getMessage'](props.annotationId))
const currentUser = computed(() => store.getters['auth/user'])
const preview = computed(() => previewLine(annotation.value?.content))

function authorView(message) {
  const info = message?.import_info
  const imported = !!info
  const userTag = imported ? null : getAuthorUserTag(message)
  return {
    imported,
    displayName: imported ? info.display_name : getAuthorDisplayName(message),
    userTag,
    showTag: !imported && !!userTag,
    isCurrentUser: isCurrentUserAuthor(message, currentUser.value),
    isBot: isAuthorBot(message),
    user: imported ? null : message?.author || null,
    title: botTitle(message),
    badgeTitle: importedTitle(info),
    importerTag: info?.importer_user_tag,
    sourceUrl: info?.source_url || ''
  }
}

function botTitle(message) {
  if (!isAuthorBot(message)) return undefined
  const versionId = message?.author?.bot_version_id
  if (!versionId) return 'No version available'
  const versions = Array.isArray(message.author?.available_versions)
    ? message.author.available_versions
    : []
  const match = versions.find((version) => version && version.id === versionId)
  if (match?.label) return `Bot version: ${match.label}`
  const fallback = versions.find((version) => version && version.default === true)
  if (fallback?.label) return `Bot version: ${fallback.label}`
  return `Bot version: ${versionId}`
}

function importedTitle(info) {
  const importer = info?.importer_user_tag || 'user'
  const platform = typeof info?.source_platform === 'string' ? info.source_platform.trim() : ''
  return platform ? `Imported by ${importer} from ${platform}` : `Imported by ${importer}`
}
const replyChain = computed(() => {
  if (!open.value || !annotation.value) return []
  return continuationChain(
    annotation.value,
    (id) => store.getters['messages/getMessage'](id),
    CHAIN_LIMIT
  )
})

let loadToken = 0
let contentToken = 0

watch(() => props.annotationId, (id) => {
  contentToken += 1
  const token = contentToken
  if (!id || unavailable.value || store.getters['messages/getMessage'](id)) {
    loadingContent.value = false
    return
  }
  loadingContent.value = true
  store.dispatch('messages/ensureAnnotations', [id]).finally(() => {
    if (token === contentToken) loadingContent.value = false
  })
}, { immediate: true })

function replyHasParts(message) {
  return !!displayParts(message)
}

function replyContent(message) {
  return contentText(message?.content)
}

async function walkReplyChain(token) {
  const rootId = props.annotationId
  if (token !== loadToken || !open.value || !rootId) return
  loadingReplies.value = true
  try {
    await store.dispatch('messages/loadDefaultOutgoingChain', rootId)
  } finally {
    if (token === loadToken) loadingReplies.value = false
  }
}

watch(open, (isOpen) => {
  loadToken += 1
  if (!isOpen) {
    loadingReplies.value = false
    return
  }
  const token = loadToken
  walkReplyChain(token).catch((error) => {
    console.error('[annotation] reply chain load failed', error)
  })
})
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
  text-overflow: ellipsis;
  white-space: nowrap;
}

.annotation-expanded {
  margin-top: 6px;
}

.annotation-author {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 7px;
  margin-bottom: 2px;
  color: var(--color-text);
  font-size: var(--font-size-xs);
  letter-spacing: 0.01em;
}

.annotation-author :deep(.annotation-author-name) {
  font-weight: 600;
}

.annotation-author :deep(.annotation-author-tag) {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.imported-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 2px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--color-hover-overlay);
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-weight: 400;
  cursor: help;
}

.import-source-link {
  font-size: 0.8rem;
  text-decoration: none;
  opacity: 0.7;
}

.import-source-link:hover {
  opacity: 1;
}

.annotation-reply {
  margin-top: 10px;
}

.annotation-loading {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  animation: annotation-replies-pulse 1.4s ease-in-out infinite;
}

.annotation-loading--block {
  margin: 8px 0 2px;
}

@keyframes annotation-replies-pulse {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .annotation-loading {
    animation: none;
  }
}

.annotation-text {
  font-size: calc(var(--message-font-size, 1.125rem) - 0.25rem);
}

.annotation-card .annotation-text :deep(.formatted-content) {
  color: var(--color-text);
  font-size: calc(var(--message-font-size, 1.125rem) - 0.25rem);
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
