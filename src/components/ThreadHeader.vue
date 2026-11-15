<template>
  <header class="thread-header">
    <div class="header-bar">
      <div class="header-leading">
        <button type="button" class="header-btn" aria-label="Back" title="Back" @click="$emit('back')">
          <svg class="btn-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12.5 4.5 7 10l5.5 5.5" />
          </svg>
          <span class="btn-label">Back</span>
        </button>
      </div>

      <div class="header-main">
        <div class="header-actions">
          <button type="button" class="header-btn" aria-label="Graph view" title="Switch to graph view" @click="$emit('openGraph')">
            <svg class="btn-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
              <line x1="10" y1="5" x2="10" y2="10" />
              <line x1="10" y1="10" x2="5" y2="15" />
              <line x1="10" y1="10" x2="15" y2="15" />
              <circle cx="10" cy="5" r="2" fill="currentColor" />
              <circle cx="5" cy="15" r="2" fill="currentColor" />
              <circle cx="15" cy="15" r="2" fill="currentColor" />
            </svg>
            <span class="btn-label">Graph View</span>
          </button>

          <button type="button" class="header-btn" aria-label="Conversation" title="Conversation" @click="$emit('openTreeOptions')">
            <svg class="btn-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="7" cy="7" r="2.1" />
              <circle cx="13.4" cy="7.6" r="1.7" />
              <path d="M3.6 15.4c.5-2.2 2-3.4 3.4-3.4s2.9 1.2 3.4 3.4" />
              <path d="M11.6 12.3c1.1-.3 2.3.3 3.1 1.5" />
            </svg>
            <span class="btn-label">Conversation</span>
          </button>

          <button
            v-if="showCopyThreadButton"
            type="button"
            class="header-btn"
            :class="{ copied: isThreadCopied }"
            :aria-label="isThreadCopied ? 'Thread copied' : 'Copy thread'"
            :title="isThreadCopied ? 'Copied' : 'Copy thread'"
            @click="$emit('copyThread')"
          >
            <svg v-if="isThreadCopied" class="btn-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4.5 10.5 8 14l7.5-8" />
            </svg>
            <svg v-else class="btn-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="7" y="7" width="9" height="9" rx="1.5" />
              <path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7" />
            </svg>
            <span class="btn-label">{{ isThreadCopied ? 'Copied' : 'Copy thread' }}</span>
          </button>
        </div>

        <p v-if="contextLabel" class="header-context" :title="`Context of ${contextLabel}`">
          Context of {{ contextLabel }}
        </p>
      </div>

      <div class="header-trailing">
        <div v-if="isSelectionMode" class="selection-controls">
          <span class="selection-count" :title="selectionCountLabel">{{ selectionCountLabel }}</span>
          <button
            type="button"
            class="header-btn"
            :class="{ copied: isCopied }"
            :disabled="selectedMessageCount === 0"
            :aria-label="isCopied ? 'Copied' : 'Copy selected messages'"
            :title="isCopied ? 'Copied' : 'Copy'"
            @click="$emit('copy')"
          >
            <svg v-if="isCopied" class="btn-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4.5 10.5 8 14l7.5-8" />
            </svg>
            <svg v-else class="btn-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="7" y="7" width="9" height="9" rx="1.5" />
              <path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7" />
            </svg>
            <span class="btn-label">{{ isCopied ? 'Copied' : 'Copy' }}</span>
          </button>
          <button type="button" class="header-btn header-btn-close" aria-label="Exit selection" title="Exit selection mode" @click="$emit('exitSelection')">
            <svg class="btn-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true">
              <path d="M5 5l10 10M15 5 5 15" />
            </svg>
          </button>
        </div>

        <div v-else class="account-controls">
          <button
            v-if="user"
            type="button"
            class="account-btn"
            :title="accountTitle"
            :aria-label="accountTitle"
            @click="$emit('openProfile')"
          >
            <span class="account-mark" aria-hidden="true">{{ accountMark }}</span>
            <span class="account-copy">
              <span class="username">{{ userDisplayName }}</span>
              <span v-if="userTag" class="user-tag">@{{ userTag }}</span>
              <span class="edit-icon" aria-hidden="true">✎</span>
            </span>
          </button>
          <span v-else class="guest-identity" title="Not logged in">
            <span class="account-mark" aria-hidden="true">?</span>
            <span class="guest-label">Guest</span>
          </span>

          <button type="button" class="header-btn header-btn-icon" aria-label="Settings" title="Settings" @click="openSettingsModal">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 21a8.985 8.985 0 0 1-1.755-.173 1 1 0 0 1-.791-.813l-.273-1.606a6.933 6.933 0 0 1-1.32-.762l-1.527.566a1 1 0 0 1-1.1-.278 8.977 8.977 0 0 1-1.756-3.041 1 1 0 0 1 .31-1.092l1.254-1.04a6.979 6.979 0 0 1 0-1.524L3.787 10.2a1 1 0 0 1-.31-1.092 8.977 8.977 0 0 1 1.756-3.042 1 1 0 0 1 1.1-.278l1.527.566a6.933 6.933 0 0 1 1.32-.762l.274-1.606a1 1 0 0 1 .791-.813 8.957 8.957 0 0 1 3.51 0 1 1 0 0 1 .791.813l.273 1.606a6.933 6.933 0 0 1 1.32.762l1.527-.566a1 1 0 0 1 1.1.278 8.977 8.977 0 0 1 1.756 3.041 1 1 0 0 1-.31 1.092l-1.254 1.04a6.979 6.979 0 0 1 0 1.524l1.254 1.04a1 1 0 0 1 .31 1.092 8.977 8.977 0 0 1-1.756 3.041 1 1 0 0 1-1.1.278l-1.527-.566a6.933 6.933 0 0 1-1.32.762l-.273 1.606a1 1 0 0 1-.791.813A8.985 8.985 0 0 1 12 21zm-.7-2.035a6.913 6.913 0 0 0 1.393 0l.247-1.451a1 1 0 0 1 .664-.779 4.974 4.974 0 0 0 1.696-.975 1 1 0 0 1 1.008-.186l1.381.512a7.012 7.012 0 0 0 .7-1.206l-1.133-.939a1 1 0 0 1-.343-.964 5.018 5.018 0 0 0 0-1.953 1 1 0 0 1 .343-.964l1.124-.94a7.012 7.012 0 0 0-.7-1.206l-1.38.512a1 1 0 0 1-1-.186 4.974 4.974 0 0 0-1.688-.976 1 1 0 0 1-.664-.779l-.248-1.45a6.913 6.913 0 0 0-1.393 0l-.25 1.45a1 1 0 0 1-.664.779A4.974 4.974 0 0 0 8.7 8.24a1 1 0 0 1-1 .186l-1.385-.512a7.012 7.012 0 0 0-.7 1.206l1.133.939a1 1 0 0 1 .343.964 5.018 5.018 0 0 0 0 1.953 1 1 0 0 1-.343.964l-1.128.94a7.012 7.012 0 0 0 .7 1.206l1.38-.512a1 1 0 0 1 1 .186 4.974 4.974 0 0 0 1.688.976 1 1 0 0 1 .664.779zm.7-3.725a3.24 3.24 0 0 1 0-6.48 3.24 3.24 0 0 1 0 6.48zm0-4.48A1.24 1.24 0 1 0 13.24 12 1.244 1.244 0 0 0 12 10.76z"/>
            </svg>
          </button>

          <button v-if="user" type="button" class="header-btn" aria-label="Logout" title="Logout" @click="$emit('logout')">
            <svg class="btn-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M8 4.5H5.5A1.5 1.5 0 0 0 4 6v8a1.5 1.5 0 0 0 1.5 1.5H8" />
              <path d="M8.5 10H16" />
              <path d="M13.5 7.5 16.5 10l-3 2.5" />
            </svg>
            <span class="btn-label">Logout</span>
          </button>
          <LoginButton v-else />
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue';
import { useStore } from 'vuex';
import LoginButton from './buttons/LoginButton.vue';

const store = useStore();

const props = defineProps({
  user: { type: Object, default: null },
  isAdmin: { type: Boolean, default: false },
  userDisplayName: { type: String, default: 'Guest' },
  userTag: { type: String, default: null },
  isSelectionMode: { type: Boolean, default: false },
  selectedMessageCount: { type: Number, default: 0 },
  isCopied: { type: Boolean, default: false },
  showCopyThreadButton: { type: Boolean, default: false },
  isThreadCopied: { type: Boolean, default: false },
  contextLabel: { type: String, default: '' },
});

defineEmits(['back', 'openGraph', 'openTreeOptions', 'copy', 'copyThread', 'exitSelection', 'logout', 'openProfile']);

const openSettingsModal = () => {
  store.dispatch('ui/setSettingsModalOpen', true);
};

const accountMark = computed(() => {
  const name = (props.userDisplayName || '').trim();
  return name ? name.charAt(0).toUpperCase() : '?';
});

const accountTitle = computed(() => {
  const tag = props.userTag ? ` @${props.userTag}` : '';
  return `Profile, ${props.userDisplayName || 'Guest'}${tag}`;
});

const selectionCountLabel = computed(() => {
  const count = props.selectedMessageCount;
  return `${count} message${count === 1 ? '' : 's'} selected`;
});
</script>

<style scoped>
.thread-header {
  position: sticky;
  top: 0;
  z-index: 5;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  padding-top: env(safe-area-inset-top);
  overflow-x: clip;
}

.header-bar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas: "leading main trailing";
  align-items: center;
  column-gap: var(--space-sm);
  min-width: 0;
  padding: var(--space-sm) max(var(--space-md), env(safe-area-inset-right)) var(--space-sm) max(var(--space-md), env(safe-area-inset-left));
}

.header-leading { grid-area: leading; }
.header-trailing { grid-area: trailing; }

.header-main {
  grid-area: main;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
}

.header-leading,
.header-trailing,
.selection-controls,
.account-controls {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: var(--space-xs);
}

.header-actions {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  min-width: max-content;
  gap: var(--space-xs);
}

.header-trailing,
.selection-controls,
.account-controls {
  justify-content: flex-end;
}

.header-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 0 0 auto;
  min-height: 32px;
  padding: var(--space-xs) var(--space-sm);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}

.header-btn:hover:not(:disabled) {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-hover);
}

.header-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.header-btn.copied {
  background-color: var(--color-success-light, rgba(92, 154, 90, 0.2));
  border-color: var(--color-success);
  color: var(--color-success);
}

.header-btn-icon {
  padding-inline: 8px;
}

.header-btn-close:hover:not(:disabled) {
  background-color: var(--color-error);
  border-color: var(--color-error);
  color: var(--color-text-inverse);
}

.btn-icon {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}

.header-context {
  min-width: 0;
  flex: 1 1 auto;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.selection-count {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.account-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 220px;
  flex: 0 1 auto;
  padding: 2px 6px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.account-btn:hover {
  background-color: var(--color-hover-overlay);
}

.account-copy {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.account-mark {
  display: none;
}

.username {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-tag {
  flex: 0 0 auto;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  opacity: 0.8;
}

.edit-icon {
  flex: 0 0 auto;
  font-size: 12px;
  opacity: 0.7;
}

.account-btn:hover .edit-icon {
  opacity: 1;
}

.guest-identity {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.guest-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.login-btn) {
  min-height: 32px;
  padding: var(--space-xs) var(--space-sm);
  white-space: nowrap;
}

@media (max-width: 768px) {
  .header-bar {
    grid-template-columns: auto auto minmax(0, 1fr);
    grid-template-areas:
      "leading actions trailing"
      "context context context";
    column-gap: 6px;
    row-gap: 4px;
    padding: 6px max(8px, env(safe-area-inset-right)) 6px max(8px, env(safe-area-inset-left));
  }

  .header-main {
    display: contents;
  }

  .header-actions {
    grid-area: actions;
    gap: 4px;
  }

  .header-context {
    grid-area: context;
    flex: none;
    font-size: var(--font-size-xs);
  }

  .header-trailing {
    grid-area: trailing;
  }

  .btn-label,
  .account-copy,
  .guest-label,
  .user-tag,
  .edit-icon {
    display: none;
  }

  .header-btn,
  .header-btn-icon {
    width: 36px;
    height: 36px;
    min-height: 36px;
    padding: 0;
    gap: 0;
  }

  .account-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background-color: var(--color-surface-light);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    font-size: var(--font-size-xs);
    font-weight: 600;
    line-height: 1;
  }

  .account-btn {
    width: 36px;
    height: 36px;
    max-width: none;
    padding: 0;
    justify-content: center;
  }

  .selection-count {
    max-width: 4.5rem;
    font-size: var(--font-size-xs);
  }

  :deep(.login-btn) {
    height: 36px;
    min-height: 36px;
    padding: 0 10px;
    font-size: var(--font-size-xs);
  }
}

@media (max-width: 380px) {
  .selection-count {
    display: none;
  }
}
</style>
