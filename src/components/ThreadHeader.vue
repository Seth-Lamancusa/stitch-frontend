<template>
  <div class="thread-header">
    <button @click="$emit('back')" class="back-button">
      &larr; Back
    </button>

    <!-- Graph view toggle -->
    <button @click="$emit('openGraph')" class="graph-view-button" title="Switch to graph view">
      <span class="btn-icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <line x1="10" y1="5" x2="10" y2="10" />
          <line x1="10" y1="10" x2="5" y2="15" />
          <line x1="10" y1="10" x2="15" y2="15" />
          <circle cx="10" cy="5" r="2" fill="currentColor" />
          <circle cx="5" cy="15" r="2" fill="currentColor" />
          <circle cx="15" cy="15" r="2" fill="currentColor" />
        </svg>
      </span>
      Graph View
    </button>

    <!-- Compact density toggle -->
    <button
      type="button"
      class="compact-toggle-button"
      :class="{ active: compactThread }"
      :title="compactThread ? 'Switch to full thread layout' : 'Switch to compact thread layout'"
      @click="toggleCompactThread"
    >
      Compact
    </button>

    <!-- Conversation options button -->
    <button @click="$emit('openTreeOptions')" class="tree-options-button" title="Conversation">
      <span class="btn-icon" aria-hidden="true">
        <!-- License: PD. Made by nilicons: https://github.com/barepants/nilicons -->
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 21a8.985 8.985 0 0 1-1.755-.173 1 1 0 0 1-.791-.813l-.273-1.606a6.933 6.933 0 0 1-1.32-.762l-1.527.566a1 1 0 0 1-1.1-.278 8.977 8.977 0 0 1-1.756-3.041 1 1 0 0 1 .31-1.092l1.254-1.04a6.979 6.979 0 0 1 0-1.524L3.787 10.2a1 1 0 0 1-.31-1.092 8.977 8.977 0 0 1 1.756-3.042 1 1 0 0 1 1.1-.278l1.527.566a6.933 6.933 0 0 1 1.32-.762l.274-1.606a1 1 0 0 1 .791-.813 8.957 8.957 0 0 1 3.51 0 1 1 0 0 1 .791.813l.273 1.606a6.933 6.933 0 0 1 1.32.762l1.527-.566a1 1 0 0 1 1.1.278 8.977 8.977 0 0 1 1.756 3.041 1 1 0 0 1-.31 1.092l-1.254 1.04a6.979 6.979 0 0 1 0 1.524l1.254 1.04a1 1 0 0 1 .31 1.092 8.977 8.977 0 0 1-1.756 3.041 1 1 0 0 1-1.1.278l-1.527-.566a6.933 6.933 0 0 1-1.32.762l-.273 1.606a1 1 0 0 1-.791.813A8.985 8.985 0 0 1 12 21zm-.7-2.035a6.913 6.913 0 0 0 1.393 0l.247-1.451a1 1 0 0 1 .664-.779 4.974 4.974 0 0 0 1.696-.975 1 1 0 0 1 1.008-.186l1.381.512a7.012 7.012 0 0 0 .7-1.206l-1.133-.939a1 1 0 0 1-.343-.964 5.018 5.018 0 0 0 0-1.953 1 1 0 0 1 .343-.964l1.124-.94a7.012 7.012 0 0 0-.7-1.206l-1.38.512a1 1 0 0 1-1-.186 4.974 4.974 0 0 0-1.688-.976 1 1 0 0 1-.664-.779l-.248-1.45a6.913 6.913 0 0 0-1.393 0l-.25 1.45a1 1 0 0 1-.664.779A4.974 4.974 0 0 0 8.7 8.24a1 1 0 0 1-1 .186l-1.385-.512a7.012 7.012 0 0 0-.7 1.206l1.133.939a1 1 0 0 1 .343.964 5.018 5.018 0 0 0 0 1.953 1 1 0 0 1-.343.964l-1.128.94a7.012 7.012 0 0 0 .7 1.206l1.38-.512a1 1 0 0 1 1 .186 4.974 4.974 0 0 0 1.688.976 1 1 0 0 1 .664.779zm.7-3.725a3.24 3.24 0 0 1 0-6.48 3.24 3.24 0 0 1 0 6.48zm0-4.48A1.24 1.24 0 1 0 13.24 12 1.244 1.244 0 0 0 12 10.76z"/>
        </svg>
      </span>
      Conversation
    </button>

    <!-- Copy entire thread button (thread view only) -->
    <button
      v-if="showCopyThreadButton"
      @click="$emit('copyThread')"
      class="copy-thread-button"
      :class="{ copied: isThreadCopied }"
      type="button"
      title="Copy thread"
    >
      <span class="copy-thread-icon" aria-hidden="true">{{ isThreadCopied ? '✓' : '📝' }}</span>
      <span class="copy-thread-text">{{ isThreadCopied ? 'Copied!' : 'Copy thread' }}</span>
    </button>

    <!-- Selection mode controls -->
    <div v-if="isSelectionMode" class="selection-controls">
      <span class="selection-count">{{ selectedMessageCount }} message{{ selectedMessageCount === 1 ? '' : 's' }} selected</span>
      <button @click="$emit('copy')" class="copy-button" :disabled="selectedMessageCount === 0" :class="{ 'copied': isCopied }">
        <span class="copy-icon">{{ isCopied ? '✓' : '📝' }}</span>
        {{ isCopied ? 'Copied!' : 'Copy' }}
      </button>
      <button @click="$emit('exitSelection')" class="exit-selection-button" title="Exit selection mode">
        ×
      </button>
    </div>

    <!-- Login/User controls -->
    <div v-else class="user-controls">
      <div class="user-info">
        <div class="username-container" @click="$emit('openProfile')" v-if="user">
          <span class="username">{{ userDisplayName }}</span>
          <span v-if="userTag" class="user-tag">@{{ userTag }}</span>
          <span class="edit-icon" title="Edit profile">✎</span>
        </div>
        <span v-else class="username">Guest</span>

        
        <span v-if="!user" class="guest-badge" title="Not logged in">?</span>
      </div>
      <button v-if="user" @click="$emit('logout')" class="logout-btn">Logout</button>
      <LoginButton v-else />
    </div>
  </div>
</template>

<script setup>
import LoginButton from './buttons/LoginButton.vue';
import { useCompactThread } from '../composables/useCompactThread.js';
// Public SPA: no admin link here; a single admin badge exists in the main layout

const { compactThread, toggleCompactThread } = useCompactThread();

defineProps({
  user: { type: Object, default: null },
  isAdmin: { type: Boolean, default: false },
  userDisplayName: { type: String, default: 'Guest' },
  userTag: { type: String, default: null },
  isSelectionMode: { type: Boolean, default: false },
  selectedMessageCount: { type: Number, default: 0 },
  isCopied: { type: Boolean, default: false },
  showCopyThreadButton: { type: Boolean, default: false },
  isThreadCopied: { type: Boolean, default: false },
});

defineEmits(['back', 'openGraph', 'openTreeOptions', 'copy', 'copyThread', 'exitSelection', 'logout', 'openProfile']);
</script>

<style scoped>
.thread-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-surface);
  z-index: 5;
  position: sticky;
  top: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.back-button {
  padding: var(--space-xs) var(--space-sm);
  background-color: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text);
}

  .graph-view-button,
  .tree-options-button,
  .compact-toggle-button,
  .copy-thread-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: var(--space-xs) var(--space-sm);
  background-color: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

  .copy-thread-button.copied {
    background-color: var(--color-success-light);
    border-color: var(--color-success);
    color: var(--color-success);
  }

  .copy-thread-icon {
    display: inline-flex;
    width: 22px;
    justify-content: center;
  }

.btn-icon {
  display: inline-flex;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.btn-icon svg {
  width: 100%;
  height: 100%;
}

  .graph-view-button:hover,
  .tree-options-button:hover,
  .compact-toggle-button:hover,
  .copy-thread-button:hover {
    background-color: var(--color-surface-hover);
    border-color: var(--color-border-hover);
  }

.compact-toggle-button.active {
  background-color: var(--color-primary-light, rgba(0, 123, 255, 0.12));
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.selection-controls {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-left: auto;
}

.selection-count {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.copy-button {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xs);
  padding: 5px 8px;
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--color-text-secondary);
}

.copy-button:hover:not(:disabled) {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-hover);
  color: var(--color-primary);
}

.copy-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.copy-button.copied {
  background-color: var(--color-success-light);
  border-color: var(--color-success);
  color: var(--color-success);
}

.copy-icon {
  font-size: var(--font-size-sm);
  line-height: 1;
}

.exit-selection-button {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xs);
  padding: 4px 8px;
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--color-text-secondary);
  min-width: 28px;
  height: 28px;
}

.exit-selection-button:hover {
  background-color: var(--color-error);
  border-color: var(--color-error);
  color: var(--color-text-inverse);
}

.user-controls {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-right: var(--space-sm);
}

.username-container {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  position: relative;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-fast);
}

.username-container:hover {
  background-color: var(--color-hover-overlay);
}

.username {
  display: inline-block;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-tag {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  opacity: 0.8;
}

.edit-icon {
  font-size: 12px;
  opacity: 0.7;
  color: var(--color-text);
}

.username-container:hover .edit-icon {
  opacity: 1;
}

.logout-btn {
  background-color: transparent;
  color: var(--color-text);
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-xs);
}

.logout-btn:hover {
  background-color: var(--color-hover-overlay);
}

.login-btn {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  padding: var(--space-xs) var(--space-sm);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-xs);
  text-decoration: none;
}

.login-btn:hover {
  background-color: var(--color-primary-dark);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.guest-badge {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  text-align: center;
  line-height: 18px;
  font-size: 12px;
  margin-left: var(--space-xs);
}


.guest-badge {
  background-color: var(--color-text-secondary);
  color: var(--color-text-inverse);
}

@media (max-width: 768px) {
  .thread-header {
    padding: var(--space-xs) var(--space-sm);
  }
  .user-controls {
    gap: var(--space-xs);
    flex-shrink: 0;
  }
  .user-info {
    gap: 2px;
    margin-right: var(--space-xs);
    min-width: 0;
  }
  .username-container {
    gap: 2px;
    padding: 1px 4px;
    max-width: 100px;
    min-width: 0;
  }
  .username {
    max-width: 60px;
    font-size: var(--font-size-xs);
  }
  .user-tag {
    font-size: calc(var(--font-size-xs) - 2px);
    display: none;
  }
  .edit-icon { display: none; }
  .guest-badge {
    width: 14px;
    height: 14px;
    line-height: 14px;
    font-size: 10px;
    margin-left: 2px;
  }
  .logout-btn, .login-btn {
    padding: var(--space-xs) var(--space-sm);
    font-size: calc(var(--font-size-xs) - 1px);
    white-space: nowrap;
    flex-shrink: 0;
  }
}

@media (max-width: 480px) {
  .thread-header { padding: 6px 8px; }
  .back-button {
    padding: 4px 8px;
    font-size: calc(var(--font-size-sm) - 1px);
  }
  .guest-badge {
    width: 12px;
    height: 12px;
    line-height: 12px;
    font-size: 8px;
    margin-left: 1px;
  }
  .logout-btn, .login-btn {
    padding: 4px 6px;
    font-size: calc(var(--font-size-xs) - 2px);
    min-width: 50px;
  }
}
</style>
