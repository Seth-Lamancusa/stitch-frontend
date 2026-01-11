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
        
        <button
          @click="loadAllMessages"
          class="load-all-button"
          :disabled="isLoadingAll"
          :title="isLoadingAll ? `Loading... (${loadingProgress})` : 'Load all messages in the thread'"
        >
          <div v-if="isLoadingAll" class="button-spinner"></div>
          <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 2v4m0 4v4M2 8h4m4 0h4"/>
            <path d="M4 4l2 2m4 4l2 2M12 4l-2 2M6 10l-2 2"/>
          </svg>
          {{ isLoadingAll ? loadingProgress : 'Load All' }}
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
          @messages-loaded="refreshGraphFromStore"
          @message-click="handleMessageClick"
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
      canvasHeight: 600,
      refreshTimeout: null,
      unwatchMessages: null,
      isLoadingAll: false,
      loadingProgress: ''
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
      'nodePosition'
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
    
    // Watch for new messages in store and refresh graph
    this.unwatchMessages = this.$store.watch(
      (state) => Object.keys(state.messages.messages || {}).length,
      () => {
        // Debounce refresh to avoid excessive updates
        if (this.refreshTimeout) {
          clearTimeout(this.refreshTimeout);
        }
        this.refreshTimeout = setTimeout(() => {
          this.refreshGraphFromStore();
        }, 300);
      }
    );
  },
  
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize);
    if (this.unwatchMessages) {
      this.unwatchMessages();
    }
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
  },
  
  methods: {
    ...mapActions('graphView', [
      'initializeGraph',
      'calculateLayout',
      'selectMessage',
      'clearSelection'
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
    
    // Refresh graph view with current store data
    async refreshGraphFromStore() {
      if (!this.currentMessageId) return;
      
      try {
        // Re-collect subgraph from store (includes newly loaded messages)
        const messages = this.collectStoreSubgraph(this.currentMessageId);
        
        // Update graph view with new messages
        await this.$store.dispatch('graphView/initializeGraph', {
          messageId: this.currentMessageId,
          messages
        });
      } catch (error) {
        console.error('[GraphView] Failed to refresh graph from store:', error);
      }
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
    
    handleMessageClick({ message }) {
      // Navigate to thread view with the clicked message ID
      // ThreadView will automatically scroll to this message via ensureCorrectScroll
      if (message && message.id) {
        this.$router.push(`/messages/${message.id}`);
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
    },
    
    // Load all messages by iteratively loading parents and children
    async loadAllMessages() {
      if (this.isLoadingAll) return;
      
      this.isLoadingAll = true;
      let iteration = 0;
      const maxIterations = 50; // Safety limit to prevent infinite loops
      
      try {
        while (iteration < maxIterations) {
          iteration++;
          
          // Get current messages from store
          const currentMessages = this.messages;
          if (currentMessages.length === 0) break;
          
          // Find messages with unloaded parents
          const messagesWithUnloadedParents = currentMessages.filter(msg => {
            if (!msg.parent_id) return false;
            const parentLoaded = !!this.$store.getters['messages/getMessage'](msg.parent_id);
            return !parentLoaded;
          });
          
          // Find messages with unloaded children
          const messagesWithUnloadedChildren = currentMessages.filter(msg => {
            const childIds = msg.child_ids || [];
            if (!childIds.length) return false;
            return childIds.some(id => !this.$store.getters['messages/getMessage'](id));
          });
          
          const totalToLoad = messagesWithUnloadedParents.length + messagesWithUnloadedChildren.length;
          
          // If nothing to load, we're done
          if (totalToLoad === 0) {
            this.loadingProgress = 'Complete!';
            setTimeout(() => {
              this.isLoadingAll = false;
              this.loadingProgress = '';
            }, 1000);
            break;
          }
          
          this.loadingProgress = `Iteration ${iteration}: ${totalToLoad} branches`;
          
          // Load parents in parallel
          const parentPromises = messagesWithUnloadedParents.map(msg =>
            this.$store.dispatch('messages/loadMessageBranchUp', {
              messageId: msg.id,
              depth: 5
            }).catch(err => {
              console.error(`[GraphView] Failed to load parents for ${msg.id}:`, err);
            })
          );
          
          // Load children in parallel
          const childPromises = messagesWithUnloadedChildren.map(msg =>
            this.$store.dispatch('messages/loadMessageBranchDown', {
              messageId: msg.id,
              depth: 5
            }).catch(err => {
              console.error(`[GraphView] Failed to load children for ${msg.id}:`, err);
            })
          );
          
          // Wait for all loads to complete
          await Promise.all([...parentPromises, ...childPromises]);
          
          // Refresh graph to include new messages
          await this.refreshGraphFromStore();
          
          // Small delay to prevent overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (iteration >= maxIterations) {
          this.loadingProgress = 'Max iterations reached';
          setTimeout(() => {
            this.isLoadingAll = false;
            this.loadingProgress = '';
          }, 2000);
        }
        
      } catch (error) {
        console.error('[GraphView] Error loading all messages:', error);
        this.loadingProgress = 'Error occurred';
        setTimeout(() => {
          this.isLoadingAll = false;
          this.loadingProgress = '';
        }, 2000);
      }
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

/* Thread view button */
.thread-view-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background-color: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-text);
  font-size: 14px;
}

.thread-view-button:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-hover);
}

/* Load all button */
.load-all-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background-color: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-text);
  font-size: 14px;
}

.load-all-button:hover:not(:disabled) {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-hover);
}

.load-all-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top: 2px solid var(--color-text);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
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