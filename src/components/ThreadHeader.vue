<template>
  <div class="thread-header">
    <button @click="$emit('back')" class="back-button">
      &larr; Back
    </button>

    <!-- Graph view toggle -->
    <button @click="$emit('openGraph')" class="graph-view-button" title="View thread as tree graph">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <!-- Tree/hierarchy icon matching GraphView -->
        <circle cx="8" cy="2" r="1.5"/>
        <circle cx="4" cy="7" r="1.5"/>
        <circle cx="12" cy="7" r="1.5"/>
        <circle cx="2" cy="12" r="1.5"/>
        <circle cx="6" cy="12" r="1.5"/>
        <circle cx="10" cy="12" r="1.5"/>
        <circle cx="14" cy="12" r="1.5"/>
        <line x1="8" y1="3.5" x2="4" y2="5.5" stroke="currentColor" stroke-width="1"/>
        <line x1="8" y1="3.5" x2="12" y2="5.5" stroke="currentColor" stroke-width="1"/>
        <line x1="4" y1="8.5" x2="2" y2="10.5" stroke="currentColor" stroke-width="1"/>
        <line x1="4" y1="8.5" x2="6" y2="10.5" stroke="currentColor" stroke-width="1"/>
        <line x1="12" y1="8.5" x2="10" y2="10.5" stroke="currentColor" stroke-width="1"/>
        <line x1="12" y1="8.5" x2="14" y2="10.5" stroke="currentColor" stroke-width="1"/>
      </svg>
      <span class="graph-button-text">Graph</span>
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
// Public SPA: no admin link here; a single admin badge exists in the main layout

defineProps({
  user: { type: Object, default: null },
  isAdmin: { type: Boolean, default: false },
  userDisplayName: { type: String, default: 'Guest' },
  userTag: { type: String, default: null },
  isSelectionMode: { type: Boolean, default: false },
  selectedMessageCount: { type: Number, default: 0 },
  isCopied: { type: Boolean, default: false },
});

defineEmits(['back', 'openGraph', 'copy', 'exitSelection', 'logout', 'openProfile']);
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

.graph-view-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--space-xs) var(--space-sm);
  background-color: var(--color-surface);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.graph-view-button:hover {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-primary);
}

.graph-view-button svg {
  flex-shrink: 0;
}

.graph-button-text {
  white-space: nowrap;
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
    gap: var(--space-sm);
  }
  .back-button {
    padding: 4px 8px;
    font-size: var(--font-size-xs);
  }
  .graph-view-button {
    padding: 4px 8px;
    font-size: var(--font-size-xs);
    gap: 4px;
  }
  .graph-view-button svg {
    width: 14px;
    height: 14px;
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
  .thread-header { 
    padding: 6px 8px; 
    gap: var(--space-xs);
  }
  .back-button {
    padding: 4px 6px;
    font-size: calc(var(--font-size-xs) - 1px);
  }
  .graph-view-button {
    padding: 4px 6px;
    font-size: calc(var(--font-size-xs) - 1px);
    gap: 3px;
  }
  .graph-view-button svg {
    width: 12px;
    height: 12px;
  }
  .graph-button-text {
    /* Hide text on very small screens, only show icon */
    display: none;
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


