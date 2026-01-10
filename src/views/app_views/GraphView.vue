<template>
  <div class="graph-view">
    <!-- Header (simplified) -->
    <div class="graph-header">
      <div class="header-left">
        <button
          @click="goBack"
          class="back-button"
          title="Back to thread view"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8.5 2.5L7 1 0 8l7 7 1.5-1.5L3 8l5.5-5.5z"/>
          </svg>
          Back
        </button>
        
        <button
          @click="toggleToListView"
          class="thread-view-button"
          title="Switch to thread view"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 3h14v2H1V3zm0 4h14v2H1V7zm0 4h14v2H1v-2z"/>
          </svg>
          Thread view
        </button>
        
        <!-- Tree view toggle button -->
        <button
          @click="toggleLayoutMode"
          class="tree-mode-button"
          :class="{ 'active': isTreeMode }"
          :title="isTreeMode ? 'Switch to detailed view' : 'Switch to tree view'"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <!-- Tree/hierarchy icon -->
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
          {{ isTreeMode ? 'Detailed' : 'Tree' }}
        </button>
      </div>
    </div>
    
    <!-- Main content area -->
    <div class="graph-main">
      <!-- Canvas area only -->
      <div class="graph-canvas-area">
        <graph-canvas
          ref="canvasRef"
          :width="canvasWidth"
          :height="canvasHeight"
        />
        
        <!-- Status overlay -->
        <div v-if="showStatus" class="status-overlay thread-loading">
          <div class="status-content">
            <div v-if="isLoading" class="status-loading">
              <div class="loading-spinner"></div>
              <span class="loading-text">Loading thread...</span>
            </div>
            
            <div v-else-if="messageCount === 0" class="status-empty">
              <div class="loading-spinner"></div>
              <p class="loading-text">Loading thread...</p>
            </div>
          </div>
        </div>
      </div>
      

    </div>
  </div>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex';
import GraphCanvas from '../../components/graph/GraphCanvas.vue';


export default {
  name: 'GraphView',
  components: {
    GraphCanvas,
  },
  
  data() {
    return {
      canvasWidth: 800,
      canvasHeight: 600
    };
  },
  
  computed: {
    ...mapState('graphView', [
      'currentMessageId',
      'messages'
    ]),
    
    ...mapGetters('graphView', [
      'selectedMessages',
      'selectionCount',
      'selectedMessageForPanel',
      'isLayoutCalculating',
      'nodePosition',
      'isTreeMode'
    ]),
    
    
    messageCount() {
      return this.messages.length;
    },
    
    isLoading() {
      return this.isLayoutCalculating || this.messageCount === 0;
    },
    
    showStatus() {
      return this.isLoading || this.messageCount === 0;
    },
    
    currentUserId() {
      return this.$store.getters['auth/user']?.uid || '';
    },
    
    isAdmin() {
      return this.$store.getters['auth/isAdmin'] || false;
    }
  },
  
  async created() {
    // Get message ID from route parameter
    const messageId = this.$route.params.messageId;
    
    if (messageId) {
      await this.loadGraphData(messageId);
    } else {
      // Redirect back if no message ID
      this.$router.push('/');
    }
  },
  
  mounted() {
    this.updateCanvasSize();
    window.addEventListener('resize', this.handleResize);
  },
  
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize);
  },
  
  methods: {
    ...mapActions('graphView', [
      'initializeGraph',
      'calculateLayout',
      'selectMessage',
      'clearSelection',
      'toggleLayoutMode'
    ]),
    
    async loadGraphData(messageId) {
      try {
        const hasStartingMessage = !!this.$store.getters['messages/getMessage'](messageId);

        // If message not in store (direct load), traverse from center like ThreadView
        if (!hasStartingMessage) {
          await this.$store.dispatch('messages/loadMessageRadius', {
          messageId,
            radius: 5
          });
        }

        // Prepare branch path from currently available messages in the store
        await this.$store.dispatch('messages/prepareBranchPath', messageId);

        // Build a store-only subgraph: highest ancestor down through all loaded descendants
        const messages = this.collectStoreSubgraph(messageId);

        // Initialize graph with data from store
        await this.initializeGraph({ messageId, messages });
      } catch (error) {
        console.error('[GraphView] Failed to load graph data:', error);
        this.$router.push('/');
      }
    },

    // Collect a subgraph from store-only data: from highest in-store ancestor and all in-store descendants
    collectStoreSubgraph(centerId) {
      const getMsg = (id) => this.$store.getters['messages/getMessage'](id);
      if (!centerId || !getMsg(centerId)) return [];

      // Find highest ancestor present in store
      let highest = getMsg(centerId);
      let p = highest.parent_id;
      while (p && getMsg(p)) {
        highest = getMsg(p);
        p = highest.parent_id;
      }

      // BFS down including all children that already exist in store
      const result = new Map();
      const queue = [highest.id];
      while (queue.length) {
        const id = queue.shift();
        const m = getMsg(id);
        if (!m || result.has(id)) continue;
        result.set(id, m);
        const kids = Array.isArray(m.child_ids) ? m.child_ids : [];
        for (const k of kids) {
          if (getMsg(k)) queue.push(k);
        }
      }

      return Array.from(result.values());
    },
    
    // Navigation
    goBack() {
      if (this.currentMessageId) {
        this.$router.push(`/messages/${this.currentMessageId}`);
      } else {
        this.$router.push('/');
      }
    },
    
    toggleToListView() {
      if (this.currentMessageId) {
        this.$router.push(`/messages/${this.currentMessageId}`);
      } else {
        this.$router.push('/');
      }
    },
    
    
    // Canvas management
    updateCanvasSize() {
      this.$nextTick(() => {
        const container = this.$el.querySelector('.graph-canvas-area');
        if (container) {
          const rect = container.getBoundingClientRect();
          this.canvasWidth = rect.width;
          this.canvasHeight = rect.height;
        }
      });
    },
    
    handleResize() {
      this.updateCanvasSize();
    },
    
    focusMessage(messageId) {
      // Center viewport on the specified message
      const position = this.nodePosition(messageId);
      if (position) {
        const scale = this.$store.state.graphView.viewport.scale;
        const centerX = (this.canvasWidth / 2) - (position.x * scale);
        const centerY = (this.canvasHeight / 2) - (position.y * scale);
        
        this.$store.dispatch('graphView/setViewportTranslate', {
          x: centerX,
          y: centerY
        });
        
        // Also select the message
        this.$store.dispatch('graphView/selectMessage', {
          messageId,
          multiSelect: false
        });
      }
    },
    
    handleReplyToMessage(message) {
      // Navigate back to thread view and set up reply
      this.$router.push({
        path: `/messages/${message.id}`,
        query: { reply: 'true' }
      });
    },
    
    handleDeleteMessage(message) {
      // Implement delete functionality
      if (confirm(`Are you sure you want to delete this message and all its replies?`)) {
        // Call delete API through existing store action
        // This would need to be implemented in the messages store
        console.log('Delete message:', message.id);
      }
    },
    
    handleExportSelection() {
      const messages = this.selectedMessages;
      if (messages.length === 0) return;
      
      // Create export data
      const exportData = {
        timestamp: new Date().toISOString(),
        messageCount: messages.length,
        messages: messages.map(msg => ({
          id: msg.id,
          author: msg.author?.display_name || msg.author?.username || 'Unknown',
          timestamp: msg.timestamp,
          content: msg.content,
          public: msg.public,
          parent_id: msg.parent_id
        }))
      };
      
      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `graph-selection-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }
};
</script>

<style scoped>
.graph-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-background);
}

/* Header */
.graph-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 14px;
}

.back-button:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-border-hover);
}

/* Thread view button styled like ThreadView's graph button */
.thread-view-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--space-xs) var(--space-sm);
  background-color: var(--color-primary);
  color: rgb(99, 90, 90);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: background-color 0.2s ease;
}

.thread-view-button:hover {
  background-color: var(--color-primary-dark);
}

/* Tree mode toggle button */
.tree-mode-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--space-xs) var(--space-sm);
  background-color: var(--color-surface-light);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: all 0.2s ease;
}

.tree-mode-button:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-hover);
}

.tree-mode-button.active {
  background-color: var(--color-secondary);
  color: white;
  border-color: var(--color-secondary);
}

.tree-mode-button.active:hover {
  background-color: var(--color-secondary-dark);
}

/* Main content */
.graph-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.graph-canvas-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.status-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  z-index: 10;
}

.status-content {
  text-align: center;
  color: var(--color-text-secondary);
}

.status-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 4px solid var(--color-border);
  border-top: 4px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.status-empty p {
  margin: 8px 0;
}

.empty-subtitle {
  font-size: 14px;
  opacity: 0.7;
}

/* Animations */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* CSS Custom Properties */
:root {
  --color-background: #ffffff;
  --color-surface: #f8fafc;
  --color-surface-light: #f1f5f9;
  --color-surface-hover: #e2e8f0;
  --color-border: #e2e8f0;
  --color-border-hover: #cbd5e0;
  --color-text-primary: #1a202c;
  --color-text-secondary: #718096;
  --color-primary: #3b82f6;
  --color-primary-dark: #2563eb;
}

/* Responsive design */
@media (max-width: 768px) {
  .graph-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .header-left,
  .header-right {
    justify-content: space-between;
  }
  
  .sidebar-open {
    width: 100%;
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    z-index: 20;
  }
}
</style> 