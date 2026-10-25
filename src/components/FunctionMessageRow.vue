<template>
  <div
    class="message-node function-message"
    :class="{ 'menu-open': menuOpen, 'compact': compact, 'selected': isMessageSelected, 'selection-target': isSelectionMode, 'reply-target': isSelected, 'has-typing-cue': typingLabel && !menuOpen }"
    :data-message-id="message.id"
    :data-has-siblings="shouldReserveSiblingNavSpace ? 'true' : 'false'"
    :data-is-reply-root="isReplyRoot ? 'true' : 'false'"
    ref="rootRef"
    @click.capture="handleSelectionClick"
  >
    <div v-if="showSiblingNavMobile" class="mobile-sibling-nav-slot">
      <SiblingNavigator
        :message-id="message.id"
        :parent-id="derivedParentId"
        :mobile-mode="true"
        compact
      />
    </div>

    <LinkSwitcher
      :activeParentId="activeParentId"
      :replyParentId="message.parent_id"
      :stitchParentIds="message.stitch_parent_ids || []"
      @switchParent="handleSwitchParent"
    />

    <div class="fn-body">
      <SiblingNavigator
        v-if="showSiblingNavDesktop"
        :message-id="message.id"
        :parent-id="derivedParentId"
        :mobile-mode="false"
        compact
      />

      <div class="fn-line">
        <button
          class="fn-toggle"
          type="button"
          :aria-expanded="open ? 'true' : 'false'"
          @click="open = !open"
        >
          <svg class="chevron" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3.5 L11 8 L6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="fn-label">
            <span class="fn-kind">{{ kind }}<template v-if="displayName">:</template></span>
            <span v-if="displayName" class="fn-name"> {{ displayName }}</span>
          </span>
        </button>

        <div class="fn-meta">
          <UserDisplay
            :display-name="isImported ? message.import_info.display_name : authorDisplayName"
            :user-tag="isImported ? null : authorUserTag"
            :show-tag="!isImported && !!authorUserTag"
            :is-current-user="isCurrentUser"
            :is-bot="isBot"
            :is-imported="isImported"
            name-class="message-author"
            tag-class="author-user-tag"
            variant="message"
            :title="isBot ? botVersionTooltip : undefined"
          />
          <span v-if="isImported" class="imported-badge" :title="importedBadgeTitle">
            via <UserDisplay
              :display-name="message.import_info.importer_user_tag"
              :user-tag="message.import_info.importer_user_tag"
              :show-tag="false"
              variant="badge"
              size="xs"
            />
            <a
              v-if="message.import_info.source_url"
              :href="message.import_info.source_url"
              target="_blank"
              rel="noopener noreferrer"
              class="import-source-link"
            >🔗</a>
          </span>
          <span
            v-if="isDefaultOutgoing"
            class="default-outgoing-mark"
            title="Default outgoing"
          >
            <DefaultOutgoingStar />
          </span>

          <input
            v-if="isSelectionMode"
            type="checkbox"
            class="selection-checkbox"
            :checked="isMessageSelected"
            @change="toggleSelection"
            @click.stop
          />

          <div v-else ref="menuContainerRef" class="fn-menu desktop-menu-container">
            <button
              class="action-button menu-button"
              type="button"
              title="More actions"
              aria-label="More actions"
              :aria-expanded="menuOpen ? 'true' : 'false'"
              @click.stop="toggleMenu"
            >
              <span class="action-emoji">⋯</span>
            </button>
            <div
              v-if="menuOpen"
              ref="menuRef"
              class="desktop-action-menu"
              :class="{ 'menu-below': menuBelow }"
              @click.stop
            >
              <button
                v-for="action in menuActions"
                :key="action.id"
                type="button"
                class="desktop-menu-button"
                :disabled="action.disabled"
                @click="runAction(action)"
              >
                <span class="action-emoji">{{ action.emoji }}</span>
                <span class="action-text">{{ action.text }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <pre
        v-show="open"
        ref="codeRef"
        class="fn-code"
        :class="{ fades: codeFades }"
        role="button"
        tabindex="0"
        :aria-label="`Show full ${label}`"
        @click="showModal = true"
        @keydown.enter.prevent="showModal = true"
        @keydown.space.prevent="showModal = true"
      >{{ code }}</pre>

      <MessageAttachments v-if="open && message.files?.length" :attachments="message.files" />
      <p v-if="typingLabel && !menuOpen" class="typing-cue" aria-live="polite">{{ typingLabel }}</p>
    </div>

    <teleport to="body">
      <ReplyOrderModal
        :is-visible="showReplyOrderModal"
        :message-id="message?.id"
        :child-ids="message?.child_ids || []"
        :stitch-child-ids="message?.stitch_child_ids || []"
        :existing-reply-order="message?.reply_order || []"
        @close="showReplyOrderModal = false"
        @update="handleReplyOrderUpdate"
      />
    </teleport>

    <teleport to="body">
      <div v-if="showModal" class="fn-modal-overlay" @click.self="showModal = false">
        <div class="fn-code-modal" role="dialog" aria-modal="true" :aria-label="label">
          <div class="fn-modal-header">
            <h3>{{ label }}</h3>
            <button class="fn-modal-close" type="button" aria-label="Close" @click="showModal = false">✕</button>
          </div>
          <pre class="fn-modal-body">{{ code }}</pre>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
import DefaultOutgoingStar from './DefaultOutgoingStar.vue';
import LinkSwitcher from './LinkSwitcher.vue';
import MessageAttachments from './MessageAttachments.vue';
import ReplyOrderModal from './modals/ReplyOrderModal.vue';
import SiblingNavigator from './SiblingNavigator.vue';
import UserDisplay from './common/UserDisplay.vue';
import MessageService, { LOAD_RADIUS } from '../services/MessageService.js';
import { clampMenuToMessageList, messageListClipBounds } from '../utils/menuPlacement.js';
import { getAuthorDisplayName, getAuthorUserTag, getAuthorUid, isAuthorBot, isCurrentUserAuthor } from '../utils/messageCompat.js';
import { messageUrl } from '../config/appConfig.js';
import {
  functionCallName,
  functionCode,
  functionKind,
  functionLabel,
  functionResponseName
} from '../utils/functionMessage.js';

const props = defineProps({
  message: { type: Object, required: true },
  activeParentId: { type: String, default: null },
  compact: { type: Boolean, default: false },
  isSelected: { type: Boolean, default: false }
});

const emit = defineEmits(['delete', 'showLinks', 'refreshReplies', 'center']);

const store = useStore();
const route = useRoute();
const router = useRouter();

const open = ref(false);
const showModal = ref(false);
const showReplyOrderModal = ref(false);
const menuBelow = ref(false);
const codeFades = ref(false);
const textCopied = ref(false);
const linkCopied = ref(false);
const jsonCopied = ref(false);
const isMobile = ref(false);
const rootRef = ref(null);
const codeRef = ref(null);
const menuRef = ref(null);
const menuContainerRef = ref(null);

const currentUser = computed(() => store.getters['auth/user']);
const isAdmin = computed(() => store.getters['auth/isAdmin']);
const isSelectionMode = computed(() => store.getters['navigation/isSelectionMode']);
const isMessageSelected = computed(() => store.getters['navigation/isMessageSelected'](props.message.id));
const menuOpen = computed(() => store.getters['navigation/isActionBarOpen'](props.message.id));
const isCentered = computed(() => String(route.params.id) === String(props.message.id));

const parentMessage = computed(() => {
  if (!props.message?.parent_id) return null;
  return store.getters['messages/getMessage'](props.message.parent_id);
});

const columnParent = computed(() => {
  const parentId = props.activeParentId || props.message.parent_id;
  if (!parentId) return null;
  return store.getters['messages/getMessage'](parentId);
});

const typingLabel = computed(() => store.getters['typing/labelAt'](props.message.id));
const kind = computed(() => functionKind(props.message));
const displayName = computed(() => (
  props.message.type === 'function_invocation'
    ? functionCallName(props.message.content)
    : functionResponseName(props.message, parentMessage.value)
));
const label = computed(() => functionLabel(props.message, parentMessage.value));
const code = computed(() => functionCode(props.message, parentMessage.value));

const authorDisplayName = computed(() => getAuthorDisplayName(props.message));
const authorUserTag = computed(() => getAuthorUserTag(props.message));
const authorUid = computed(() => getAuthorUid(props.message));
const isBot = computed(() => isAuthorBot(props.message));
const isImported = computed(() => !!props.message.import_info);
const isCurrentUser = computed(() => isCurrentUserAuthor(props.message, currentUser.value));

const importedBadgeTitle = computed(() => {
  const info = props.message.import_info || {};
  const importer = info.importer_user_tag || 'user';
  const platform = typeof info.source_platform === 'string' ? info.source_platform.trim() : '';
  return platform ? `Imported by ${importer} from ${platform}` : `Imported by ${importer}`;
});

const botVersionTooltip = computed(() => {
  if (!isBot.value) return '';
  const versionId = props.message.author?.bot_version_id;
  if (!versionId) return 'No version available';
  const versions = Array.isArray(props.message.author?.available_versions)
    ? props.message.author.available_versions
    : [];
  const match = versions.find((version) => version && version.id === versionId);
  if (match?.label) return `Bot version: ${match.label}`;
  const fallback = versions.find((version) => version && version.default === true);
  if (fallback?.label) return `Bot version: ${fallback.label}`;
  return `Bot version: ${versionId}`;
});

const isReplyRoot = computed(() => props.message.parent_id == null);
const derivedParentId = computed(() => (
  props.activeParentId != null ? props.activeParentId : props.message.parent_id
));
const shouldReserveSiblingNavSpace = computed(() => !!derivedParentId.value);
const showSiblingNavMobile = computed(() => shouldReserveSiblingNavSpace.value && isMobile.value);
const showSiblingNavDesktop = computed(() => shouldReserveSiblingNavSpace.value && !isMobile.value);

const isDefaultOutgoing = computed(() => {
  const parent = columnParent.value;
  return !!(parent && parent.default_outgoing && parent.default_outgoing === props.message.id);
});

const canDelete = computed(() => store.getters['auth/canDeleteMessage'](props.message));

const canOrderReplies = computed(() => {
  const outgoing = [
    ...(props.message.child_ids || []),
    ...(props.message.stitch_child_ids || [])
  ];
  return store.getters['auth/canUpdateReplyOrder'](props.message) && outgoing.length > 0;
});

const canSetDefaultOutgoing = computed(() => {
  const parent = columnParent.value;
  if (!parent || !store.getters['auth/canUpdateReplyOrder'](parent)) return false;
  const outgoing = [...(parent.child_ids || []), ...(parent.stitch_child_ids || [])];
  return outgoing.includes(props.message.id);
});

const menuActions = computed(() => {
  const items = [
    { id: 'copy-text', emoji: '📝', text: textCopied.value ? 'Copied!' : 'Copy', run: copyText },
    {
      id: 'copy-link',
      emoji: linkCopied.value ? '✅' : '📋',
      text: linkCopied.value ? 'Copied' : 'Copy link',
      run: copyLink
    },
    { id: 'refresh-replies', emoji: '🔄', text: 'Refresh replies', close: true, run: () => emit('refreshReplies', props.message.id) },
    { id: 'links', emoji: '🪡', text: 'Stitch', close: true, run: openLinks },
    {
      id: 'center',
      emoji: '🎯',
      text: isCentered.value ? 'Centered' : 'Center',
      disabled: isCentered.value,
      close: true,
      run: () => { if (!isCentered.value) emit('center', props.message.id); }
    },
    { id: 'similar', emoji: '🔍', text: 'Similar', close: true, run: findSimilar }
  ];
  if (isAdmin.value) {
    items.splice(4, 0, {
      id: 'copy-json',
      emoji: '📋',
      text: jsonCopied.value ? 'Copied!' : 'JSON',
      run: copyJson
    });
  }
  if (canOrderReplies.value) {
    items.splice(items.length - 1, 0, {
      id: 'reply-order',
      emoji: '📋',
      text: 'Order',
      close: true,
      run: () => { showReplyOrderModal.value = true; }
    });
  }
  if (canSetDefaultOutgoing.value) {
    items.splice(items.length - 1, 0, {
      id: 'set-default-outgoing',
      emoji: '⭐',
      text: isDefaultOutgoing.value ? 'Clear default outgoing' : 'Set default outgoing',
      close: true,
      run: toggleDefaultOutgoing
    });
  }
  if (canDelete.value) {
    items.push({
      id: 'delete',
      emoji: '🗑️',
      text: 'Delete',
      close: true,
      run: () => emit('delete', props.message)
    });
  }
  return items;
});

function flash(flag) {
  flag.value = true;
  setTimeout(() => { flag.value = false; }, 1500);
}

function copyText() {
  navigator.clipboard.writeText(code.value).then(() => flash(textCopied)).catch(() => {});
}

function copyLink() {
  navigator.clipboard.writeText(messageUrl(props.message.id)).then(() => flash(linkCopied)).catch(() => {});
}

function copyJson() {
  navigator.clipboard.writeText(JSON.stringify(props.message, null, 2)).then(() => flash(jsonCopied)).catch(() => {});
}

function openLinks() {
  store.dispatch('navigation/clearReplyingTo');
  emit('showLinks', props.message);
}

function findSimilar() {
  store.commit('navigation/SET_SIMILAR_MESSAGES_SOURCE_ID', props.message.id);
  router.push({ path: '/search', query: { similar_to: props.message.id } });
}

async function toggleDefaultOutgoing() {
  const parentId = props.activeParentId || props.message.parent_id;
  const parent = columnParent.value;
  if (!parentId || !parent) return;
  const next = isDefaultOutgoing.value ? null : props.message.id;
  try {
    const response = await MessageService.updateDefaultOutgoing(parentId, next);
    if (response?.data?.id) {
      const updated = response.data;
      const existing = store.getters['messages/getMessage'](parentId) || {};
      if (updated.parent_id === undefined) updated.parent_id = existing.parent_id;
      if (!Array.isArray(updated.child_ids)) updated.child_ids = existing.child_ids || [];
      if (!Array.isArray(updated.stitch_child_ids)) updated.stitch_child_ids = existing.stitch_child_ids || [];
      store.commit('messages/SET_MESSAGE', updated);
    }
  } catch (error) {
    console.error('[FunctionMessageRow] Failed to update default outgoing', error);
    store.commit('ui/SET_ERROR', 'Failed to update default outgoing');
  }
}

async function handleReplyOrderUpdate({ messageId, replyOrder }) {
  try {
    if (!messageId) return;
    const response = await MessageService.updateReplyOrder(messageId, replyOrder);
    if (response?.data?.id) {
      const updated = response.data;
      const existing = store.getters['messages/getMessage'](messageId) || {};
      if (updated.parent_id === undefined) updated.parent_id = existing.parent_id;
      if (!Array.isArray(updated.child_ids)) updated.child_ids = existing.child_ids || [];
      store.commit('messages/SET_MESSAGE', updated);
    }
    showReplyOrderModal.value = false;
  } catch (error) {
    console.error('[FunctionMessageRow] Failed to update reply order', error);
    store.commit('ui/SET_ERROR', 'Failed to update reply order');
  }
}

async function handleSwitchParent(parentId) {
  if (rootRef.value) {
    store.commit('navigation/SET_LAST_ANCHOR_OFFSET', rootRef.value.getBoundingClientRect().top);
  }
  if (!store.getters['messages/getMessage'](parentId)) {
    try {
      await store.dispatch('messages/loadMessageRadius', { messageId: parentId, radius: LOAD_RADIUS });
    } catch (error) {
      console.error('[FunctionMessageRow] Failed to load alternative origin', error);
      return;
    }
  }
  store.commit('messages/SET_BRANCH_PARENT', { messageId: props.message.id, parentId });
  await store.dispatch('messages/prepareBranchPath', props.message.id);
  try {
    await router.push(`/messages/${props.message.id}`);
  } catch (error) {
    console.error('[FunctionMessageRow] navigation failed', error);
  }
  emit('refreshReplies', props.message.id);
}

function toggleSelection() {
  store.dispatch('navigation/toggleMessageSelection', props.message.id);
}

function handleSelectionClick(event) {
  if (!isSelectionMode.value) return;
  if (event.target.closest('a, input')) return;
  event.preventDefault();
  event.stopPropagation();
  toggleSelection();
}

function toggleMenu() {
  store.dispatch('navigation/toggleActionBar', props.message.id);
}

function runAction(action) {
  if (action.disabled) return;
  action.run();
  if (action.close) store.dispatch('navigation/hideActionBar', props.message.id);
}

function placeMenu() {
  const menu = menuRef.value;
  const anchor = menuContainerRef.value;
  if (!menu || !anchor) return;
  const bounds = messageListClipBounds(anchor);
  const anchorRect = anchor.getBoundingClientRect();
  const viewportMax = window.innerHeight - 20;
  const height = Math.min(menu.scrollHeight || 200, viewportMax);
  const spaceAbove = anchorRect.top - bounds.top;
  const spaceBelow = bounds.bottom - anchorRect.bottom;
  const needed = height + 8;
  const overflowTop = spaceAbove < needed;
  const overflowBottom = spaceBelow < needed;
  menuBelow.value = overflowTop && overflowBottom ? spaceBelow > spaceAbove : overflowTop;
  nextTick(() => {
    clampMenuToMessageList(menuRef.value, menuContainerRef.value, {
      openingBelow: menuBelow.value,
      gap: 8,
      viewportMax
    });
  });
}

function updateFade() {
  const el = codeRef.value;
  if (!el || !open.value) {
    codeFades.value = false;
    return;
  }
  codeFades.value = el.scrollHeight > el.clientHeight + 1;
}

function onDocumentClick(event) {
  if (!menuOpen.value) return;
  if (event.target.closest?.('.fn-menu')) return;
  store.dispatch('navigation/hideActionBar', props.message.id);
}

function onKeydown(event) {
  if (event.key !== 'Escape') return;
  if (showModal.value) showModal.value = false;
  else if (menuOpen.value) store.dispatch('navigation/hideActionBar', props.message.id);
}

function checkMobile() {
  isMobile.value = window.innerWidth <= 768;
}

watch(menuOpen, (isOpen) => {
  if (!isOpen) return;
  nextTick(() => placeMenu());
});

watch([open, code], async () => {
  if (!open.value) return;
  await nextTick();
  updateFade();
});

onMounted(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
  window.addEventListener('resize', updateFade);
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile);
  window.removeEventListener('resize', updateFade);
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<style scoped>
.function-message {
  width: 100%;
  max-width: 100%;
  margin-left: auto;
  margin-right: auto;
  padding: 0 4px;
  position: relative;
  box-sizing: border-box;
}

.function-message.menu-open {
  z-index: 100;
}

.function-message.has-typing-cue {
  padding-bottom: 22px;
}

.fn-body {
  position: relative;
  padding: 2px 12px;
}

.function-message.compact .fn-body {
  padding-top: 0;
  padding-bottom: 0;
}

.fn-line {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 28px;
  border-radius: 6px;
}

.fn-line:hover,
.function-message.reply-target .fn-line {
  background: rgba(255, 255, 255, 0.04);
}

.function-message.selection-target {
  cursor: pointer;
}

.function-message.selected .fn-line,
.function-message.selection-target:hover .fn-line {
  background: var(--color-surface-hover);
  box-shadow: inset 0 0 0 1px var(--color-primary);
}

.fn-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  background: none;
  border: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  padding: 2px 0;
  text-align: left;
}

.chevron {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--color-text-secondary);
  transition: transform 0.15s ease;
}

.fn-toggle[aria-expanded="true"] .chevron {
  transform: rotate(90deg);
}

.fn-label {
  font-size: 0.9rem;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fn-kind { color: var(--color-text-secondary); }
.fn-name { color: var(--color-text); }

.fn-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  min-width: 0;
}

.default-outgoing-mark {
  display: inline-flex;
  align-items: center;
  line-height: 1;
  color: var(--color-text-secondary);
}

.imported-badge {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--color-hover-overlay);
  padding: 1px 6px;
  border-radius: 4px;
  cursor: help;
}

.import-source-link {
  text-decoration: none;
  font-size: 0.8rem;
  opacity: 0.7;
}

.import-source-link:hover { opacity: 1; }

:deep(.message-author) {
  font-weight: 600;
  white-space: nowrap;
}

:deep(.user-display__name--current) {
  font-weight: 800;
  color: var(--color-current-user-name);
}

:deep(.author-user-tag) {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.fn-code {
  margin: 8px 0 2px 20px;
  background: var(--color-code-background, #252526);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 10px 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.45;
  color: var(--color-code-text, #d4d4d4);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: calc(1.45em * 6 + 20px);
  overflow: hidden;
  cursor: pointer;
}

.fn-code:hover { border-color: #555; }

.fn-code.fades {
  -webkit-mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 2.6em), transparent 100%);
  mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 2.6em), transparent 100%);
}

.action-button,
.desktop-menu-button {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 5px 8px;
  font-size: var(--font-size-xs, 0.75rem);
  font-family: inherit;
  cursor: pointer;
  color: var(--color-text-secondary);
}

.action-button:hover,
.desktop-menu-button:hover {
  background: var(--color-surface-hover, rgba(255, 255, 255, 0.06));
  border-color: #555;
  color: var(--color-primary);
}

.action-emoji {
  font-size: 0.875rem;
  line-height: 1;
}

.desktop-menu-container { position: relative; }

.desktop-action-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 20;
  min-width: 180px;
  overflow-x: hidden;
  overflow-y: auto;
}

.desktop-action-menu.menu-below {
  bottom: auto;
  top: calc(100% + 8px);
}

.desktop-menu-button {
  width: 100%;
  justify-content: flex-start;
  border: none;
  border-radius: 0;
  padding: 8px 12px;
}

.desktop-menu-button:hover {
  background: var(--color-hover-overlay);
  border: none;
  color: var(--color-text);
}

.desktop-menu-button:disabled,
.desktop-menu-button:disabled:hover {
  background: transparent;
  color: var(--color-text-secondary);
  opacity: 0.7;
  cursor: default;
}

.selection-checkbox {
  cursor: pointer;
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
  flex-shrink: 0;
  appearance: none;
  background: transparent;
  border: 2px solid var(--color-border);
  border-radius: 4px;
  position: relative;
  margin: 0;
}

.selection-checkbox:checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.selection-checkbox:checked::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 2px;
  width: 4px;
  height: 8px;
  border: solid var(--color-text-inverse);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.fn-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  z-index: 1000;
}

.fn-code-modal {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  width: min(720px, 100%);
  max-height: min(70vh, 640px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
}

.fn-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--color-border);
}

.fn-modal-header h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fn-modal-close {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.fn-modal-close:hover {
  background: var(--color-hover-overlay);
  color: var(--color-text);
}

.fn-modal-body {
  overflow: auto;
  min-height: 0;
  margin: 0;
  padding: 16px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.45;
  color: var(--color-code-text, #d4d4d4);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (min-width: 769px) {
  .function-message[data-has-siblings="true"],
  .function-message[data-has-siblings="true"][data-is-reply-root="true"] {
    width: calc(100% - 28px);
  }

  .function-message[data-has-siblings="true"] :deep(.sibling-navigator) {
    width: calc(100% + 28px);
    left: -14px;
  }
}

@media (max-width: 768px) {
  .function-message[data-has-siblings="true"] .fn-line {
    padding-left: 36px;
  }

  .mobile-sibling-nav-slot {
    display: flex;
    position: absolute;
    top: 4px;
    left: 3px;
    z-index: 20;
  }
}
</style>
