<template>
  <div class="graph-side-panel" :class="{ 'panel-open': isOpen }">
    <!-- Panel header -->
    <div class="panel-header">
      <div class="header-content">
        <h3 class="panel-title">
          <span v-if="selectionCount === 1">Message Details</span>
          <span v-else-if="selectionCount > 1">{{ selectionCount }} Messages Selected</span>
          <span v-else>No Selection</span>
        </h3>
        
        <div class="header-actions">
          <button
            v-if="selectionCount > 0"
            @click="$emit('clear-selection')"
            class="panel-button secondary"
            title="Clear selection">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/>
            </svg>
          </button>
          
          <button
            @click="$emit('close')"
            class="panel-button close-button"
            title="Close panel">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Selection summary for multiple items -->
      <div v-if="selectionCount > 1" class="selection-summary">
        <div class="summary-stats">
          <div class="stat-item">
            <span class="stat-label">Authors:</span>
            <span class="stat-value">{{ uniqueAuthorsCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Public:</span>
            <span class="stat-value">{{ publicMessagesCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Private:</span>
            <span class="stat-value">{{ privateMessagesCount }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Panel content -->
    <div class="panel-content">
      <!-- Single message view -->
      <div v-if="selectionCount === 1 && selectedMessage" class="single-message-view">
        <!-- Message metadata -->
        <div class="message-metadata">
          <div class="metadata-row">
            <span class="metadata-label">Author:</span>
            <span class="metadata-value author-name">{{ getAuthorName(selectedMessage) }}</span>
          </div>
          
          <div class="metadata-row">
            <span class="metadata-label">Timestamp:</span>
            <span class="metadata-value">{{ formatDetailedTimestamp(selectedMessage.timestamp) }}</span>
          </div>
          
          <div class="metadata-row">
            <span class="metadata-label">Visibility:</span>
            <span class="metadata-value visibility-badge" :class="{ 'public': selectedMessage.public, 'private': !selectedMessage.public }">
              {{ selectedMessage.public ? 'Public' : 'Private' }}
            </span>
          </div>
          
          <div v-if="selectedMessage.parent_id" class="metadata-row">
            <span class="metadata-label">Reply to:</span>
            <button
              @click="$emit('focus-message', selectedMessage.parent_id)"
              class="parent-link">
              {{ selectedMessage.parent_id }}
            </button>
          </div>
          
          <div class="metadata-row">
            <span class="metadata-label">Message ID:</span>
            <span class="metadata-value message-id">{{ selectedMessage.id }}</span>
          </div>
        </div>
        
        <!-- Message content -->
        <div class="message-content-section">
          <h4 class="section-title">Content</h4>
          <div class="message-content" v-html="formattedContent"></div>
        </div>
        
        <!-- Recipients (if private) -->
        <div v-if="!selectedMessage.public && selectedMessage.recipients?.length > 0" class="recipients-section">
          <h4 class="section-title">Recipients</h4>
          <div class="recipients-list">
            <div
              v-for="recipient in selectedMessage.recipients"
              :key="recipient.uid"
              class="recipient-item">
              <span class="recipient-name">{{ getRecipientName(recipient) }}</span>
              <span class="recipient-status" :class="getRecipientStatusClass(recipient)">
                {{ getRecipientStatus(recipient) }}
              </span>
            </div>
          </div>
        </div>
        
        <!-- Read status -->
        <div v-if="selectedMessage.read_status" class="read-status-section">
          <h4 class="section-title">Read Status</h4>
          <div class="read-status-list">
            <div
              v-for="[userId, isRead] in Object.entries(selectedMessage.read_status)"
              :key="userId"
              class="read-status-item">
              <span class="user-name">{{ getUserName(userId) }}</span>
              <span class="read-indicator" :class="{ 'read': isRead, 'unread': !isRead }">
                {{ isRead ? 'Read' : 'Unread' }}
              </span>
            </div>
          </div>
        </div>
        
        <!-- Message actions -->
        <div class="message-actions">
          <button
            @click="$emit('reply-to-message', selectedMessage)"
            class="action-button primary">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6.598 5.013a.144.144 0 0 1 .202.134V6.3a.5.5 0 0 0 .5.5c.667 0 2.013.005 3.3.822.984.624 1.99 1.76 2.595 3.876-1.02-.983-2.185-1.516-3.205-1.799a8.74 8.74 0 0 0-1.921-.306 7.404 7.404 0 0 0-.798.008h-.013l-.005.001h-.001L7.3 9.9l-.05-.498a.5.5 0 0 0-.45.498v1.153c0 .108-.11.176-.202.134L2.614 8.254a.503.503 0 0 0-.042-.028.147.147 0 0 1 0-.252.499.499 0 0 0 .042-.028l3.984-2.933zM7.8 10.386c.068 0 .143.003.223.006.434.02 1.034.086 1.7.271 1.326.368 2.896 1.202 3.94 3.08a.5.5 0 0 0 .933-.305c-.464-3.71-1.886-5.662-3.46-6.66-1.245-.79-2.527-.942-3.336-.971v-.66a1.144 1.144 0 0 0-1.767-.96l-3.994 2.94a1.147 1.147 0 0 0 0 1.946l3.994 2.94a1.144 1.144 0 0 0 1.767-.96v-.667z"/>
            </svg>
            Reply
          </button>
          
          <button
            @click="copyMessageContent"
            class="action-button secondary"
            :class="{ 'copied': isCopied }">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path v-if="!isCopied" d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
              <path v-if="!isCopied" d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
              <path v-else d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
            </svg>
            {{ isCopied ? 'Copied!' : 'Copy' }}
          </button>
          
          <button
            v-if="canDeleteMessage"
            @click="$emit('delete-message', selectedMessage)"
            class="action-button danger">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5zm3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0z"/>
            </svg>
            Delete
          </button>
        </div>
      </div>
      
      <!-- Multiple messages view -->
      <div v-else-if="selectionCount > 1" class="multi-message-view">
        <div class="bulk-actions">
          <h4 class="section-title">Bulk Actions</h4>
          <div class="action-grid">
            <button
              @click="copyAllSelected"
              class="action-button secondary"
              :class="{ 'copied': isCopied }">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
              </svg>
              {{ isCopied ? 'Copied!' : 'Copy All' }}
            </button>
            
            <button
              @click="$emit('export-selection')"
              class="action-button secondary">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
              </svg>
              Export
            </button>
          </div>
        </div>
        
        <div class="selected-messages-list">
          <h4 class="section-title">Selected Messages</h4>
          <div class="message-preview-list">
            <div
              v-for="message in selectedMessages"
              :key="message.id"
              class="message-preview"
              @click="$emit('focus-message', message.id)">
              <div class="preview-header">
                <span class="preview-author">{{ getAuthorName(message) }}</span>
                <span class="preview-timestamp">{{ formatRelativeTime(message.timestamp) }}</span>
              </div>
              <div class="preview-content">{{ getContentPreview(message.content) }}</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Empty state -->
      <div v-else class="empty-state">
        <svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor" opacity="0.3">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
        </svg>
        <p class="empty-message">Select a message node to view details</p>
        <p class="empty-submessage">Click on any node in the graph to see its content and metadata</p>
      </div>
    </div>
  </div>
</template>

<script>
import { format, formatRelative } from 'date-fns';

export default {
  name: 'GraphSidePanel',
  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    
    selectedMessages: {
      type: Array,
      default: () => []
    },
    
    currentUserId: {
      type: String,
      default: ''
    },
    
    isAdmin: {
      type: Boolean,
      default: false
    }
  },
  
  data() {
    return {
      isCopied: false,
      copyTimeout: null
    };
  },
  
  computed: {
    selectionCount() {
      return this.selectedMessages.length;
    },
    
    selectedMessage() {
      return this.selectionCount === 1 ? this.selectedMessages[0] : null;
    },
    
    uniqueAuthorsCount() {
      const authors = new Set(this.selectedMessages.map(m => m.author?.uid || 'unknown'));
      return authors.size;
    },
    
    publicMessagesCount() {
      return this.selectedMessages.filter(m => m.public).length;
    },
    
    privateMessagesCount() {
      return this.selectedMessages.filter(m => !m.public).length;
    },
    
    canDeleteMessage() {
      if (!this.selectedMessage) return false;
      return this.isAdmin || this.selectedMessage.author?.uid === this.currentUserId;
    },
    
    formattedContent() {
      if (!this.selectedMessage?.content) return '';
      
      // Simple HTML formatting - in production, use a proper markdown/HTML sanitizer
      return this.selectedMessage.content
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>');
    }
  },
  
  emits: [
    'close',
    'clear-selection',
    'focus-message',
    'reply-to-message',
    'delete-message',
    'export-selection'
  ],
  
  methods: {
    getAuthorName(message) {
      if (!message.author) return 'Unknown';
      return message.author.display_name || message.author.username || message.author.email || 'User';
    },
    
    formatDetailedTimestamp(timestamp) {
      try {
        return format(new Date(timestamp), 'PPpp');
      } catch (error) {
        return timestamp;
      }
    },
    
    formatRelativeTime(timestamp) {
      try {
        return formatRelative(new Date(timestamp), new Date());
      } catch (error) {
        return timestamp;
      }
    },
    
    getRecipientName(recipient) {
      return recipient.display_name || recipient.username || recipient.email || 'User';
    },
    
    getRecipientStatus(recipient) {
      return recipient.visible ? 'Visible' : 'Hidden';
    },
    
    getRecipientStatusClass(recipient) {
      return recipient.visible ? 'visible' : 'hidden';
    },
    
    getUserName(userId) {
      // In a real app, you'd look this up from a user store
      return userId;
    },
    
    getContentPreview(content) {
      if (!content) return 'No content';
      const plainText = content.replace(/<[^>]*>/g, '').replace(/\n/g, ' ');
      return plainText.length > 80 ? plainText.substring(0, 80) + '...' : plainText;
    },
    
    async copyMessageContent() {
      if (!this.selectedMessage?.content) return;
      
      try {
        await navigator.clipboard.writeText(this.selectedMessage.content);
        this.showCopiedState();
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    },
    
    async copyAllSelected() {
      if (this.selectedMessages.length === 0) return;
      
      const content = this.selectedMessages
        .map(msg => `${this.getAuthorName(msg)}: ${msg.content || 'No content'}`)
        .join('\n\n');
      
      try {
        await navigator.clipboard.writeText(content);
        this.showCopiedState();
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    },
    
    showCopiedState() {
      this.isCopied = true;
      
      if (this.copyTimeout) {
        clearTimeout(this.copyTimeout);
      }
      
      this.copyTimeout = setTimeout(() => {
        this.isCopied = false;
      }, 2000);
    }
  },
  
  beforeUnmount() {
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
    }
  }
};
</script>

<style scoped>
.graph-side-panel {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 0;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  overflow: hidden;
  transition: width var(--transition-normal);
  z-index: 20;
}

.panel-open {
  width: 400px;
}

.panel-header {
  background: var(--color-surface-light);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 1;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md);
}

.panel-title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
}

.header-actions {
  display: flex;
  gap: var(--space-xs);
}

.panel-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.panel-button:hover {
  background: var(--color-hover-overlay);
  border-color: var(--color-border-light);
  color: var(--color-text);
}

.panel-button.secondary {
  background: var(--color-surface);
}

.panel-button.close-button:hover {
  background: var(--color-error);
  border-color: var(--color-error);
  color: white;
}

.selection-summary {
  padding: var(--space-sm) var(--space-md);
  background: var(--color-surface-dark);
  border-top: 1px solid var(--color-border);
}

.summary-stats {
  display: flex;
  gap: var(--space-lg);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-xxs);
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-weight: 500;
}

.stat-value {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  font-weight: 600;
}

.panel-content {
  height: calc(100% - 80px);
  overflow-y: auto;
  padding: var(--space-md);
}

.single-message-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.message-metadata {
  background: var(--color-surface-light);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.metadata-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-xs) 0;
  border-bottom: 1px solid var(--color-border);
}

.metadata-row:last-child {
  border-bottom: none;
}

.metadata-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: 500;
}

.metadata-value {
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.author-name {
  font-weight: 600;
}

.visibility-badge {
  padding: var(--space-xxs) var(--space-xs);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 500;
  text-transform: uppercase;
}

.visibility-badge.public {
  background: var(--color-accent);
  color: white;
}

.visibility-badge.private {
  background: var(--color-warning);
  color: white;
}

.parent-link {
  background: none;
  border: none;
  color: var(--color-secondary);
  cursor: pointer;
  font-family: var(--font-family-code);
  font-size: var(--font-size-xs);
  text-decoration: underline;
}

.parent-link:hover {
  color: var(--color-secondary-dark);
}

.message-id {
  font-family: var(--font-family-code);
  font-size: var(--font-size-xs);
}

.section-title {
  margin: 0 0 var(--space-sm) 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
}

.message-content-section {
  background: var(--color-surface-light);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.message-content {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
  color: var(--color-text);
  white-space: pre-wrap;
  word-wrap: break-word;
}

.message-content :deep(code) {
  background: var(--color-surface-dark);
  padding: var(--space-xxs) var(--space-xs);
  border-radius: var(--radius-sm);
  font-family: var(--font-family-code);
  font-size: var(--font-size-xs);
}

.recipients-section,
.read-status-section {
  background: var(--color-surface-light);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.recipients-list,
.read-status-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.recipient-item,
.read-status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-xs);
  background: var(--color-surface);
  border-radius: var(--radius-sm);
}

.recipient-name,
.user-name {
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.recipient-status,
.read-indicator {
  font-size: var(--font-size-xs);
  padding: var(--space-xxs) var(--space-xs);
  border-radius: var(--radius-sm);
  font-weight: 500;
  text-transform: uppercase;
}

.recipient-status.visible,
.read-indicator.read {
  background: var(--color-accent);
  color: white;
}

.recipient-status.hidden,
.read-indicator.unread {
  background: var(--color-warning);
  color: white;
}

.message-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-button.primary {
  background: var(--color-secondary);
  border-color: var(--color-secondary);
  color: white;
}

.action-button.primary:hover {
  background: var(--color-secondary-dark);
  border-color: var(--color-secondary-dark);
}

.action-button.secondary {
  background: var(--color-surface);
  color: var(--color-text);
}

.action-button.secondary:hover {
  background: var(--color-surface-light);
  border-color: var(--color-border-light);
}

.action-button.danger {
  background: var(--color-surface);
  border-color: var(--color-error);
  color: var(--color-error);
}

.action-button.danger:hover {
  background: var(--color-error);
  color: white;
}

.action-button.copied {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
}

.multi-message-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.bulk-actions {
  background: var(--color-surface-light);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
}

.selected-messages-list {
  background: var(--color-surface-light);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.message-preview-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  max-height: 300px;
  overflow-y: auto;
}

.message-preview {
  padding: var(--space-sm);
  background: var(--color-surface);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.message-preview:hover {
  background: var(--color-surface-dark);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-xs);
}

.preview-author {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
}

.preview-timestamp {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.preview-content {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  text-align: center;
  color: var(--color-text-secondary);
}

.empty-message {
  margin: var(--space-md) 0 var(--space-xs) 0;
  font-size: var(--font-size-md);
  font-weight: 500;
}

.empty-submessage {
  margin: 0;
  font-size: var(--font-size-sm);
  opacity: 0.7;
}

/* Responsive design */
@media (max-width: 768px) {
  .panel-open {
    width: 100%;
  }
  
  .summary-stats {
    flex-direction: column;
    gap: var(--space-sm);
  }
  
  .action-grid {
    grid-template-columns: 1fr;
  }
}

/* Scrollbar styling */
.panel-content::-webkit-scrollbar,
.message-preview-list::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track,
.message-preview-list::-webkit-scrollbar-track {
  background: var(--color-surface);
}

.panel-content::-webkit-scrollbar-thumb,
.message-preview-list::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: var(--radius-sm);
}

.panel-content::-webkit-scrollbar-thumb:hover,
.message-preview-list::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-light);
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .panel-button,
  .action-button {
    border-width: 2px;
  }
  
  .visibility-badge,
  .recipient-status,
  .read-indicator {
    border: 1px solid currentColor;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .graph-side-panel,
  .panel-button,
  .action-button,
  .message-preview {
    transition: none;
  }
}
</style> 