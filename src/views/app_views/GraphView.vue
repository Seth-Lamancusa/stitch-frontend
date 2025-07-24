<template>
  <div class="graph-view">
    <!-- Header -->
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
        
        <h1 class="view-title">Thread Graph</h1>
        
        <div v-if="currentMessageId" class="message-context">
          <span class="context-label">Centered on:</span>
          <span class="context-id">{{ currentMessageId }}</span>
        </div>
      </div>
      
      <div class="header-right">
        <!-- Zoom controls -->
        <div class="zoom-controls">
          <button
            @click="zoomOut"
            :disabled="scale <= minScale"
            class="zoom-button"
            title="Zoom out"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 8h12"/>
            </svg>
          </button>
          
          <span class="zoom-indicator">{{ Math.round(scale * 100) }}%</span>
          
          <button
            @click="zoomIn"
            :disabled="scale >= maxScale"
            class="zoom-button"
            title="Zoom in"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2v12M2 8h12"/>
            </svg>
          </button>
          
          <button
            @click="fitToContent"
            class="zoom-button fit-button"
            title="Fit to content"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 1h4v1H2v3H1V1zm10 0h4v4h-1V2h-3V1zm-6 9H2v3h3v1H1v-4h1zm9 3h-3v1h4v-4h-1v3z"/>
            </svg>
          </button>
        </div>
        
        <!-- View toggle -->
        <button
          @click="toggleToListView"
          class="view-toggle-button"
          title="Switch to list view"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 3h14v2H1V3zm0 4h14v2H1V7zm0 4h14v2H1v-2z"/>
          </svg>
          List View
        </button>
      </div>
    </div>
    
    <!-- Main content area -->
    <div class="graph-main">
      <!-- Canvas area -->
      <div class="graph-canvas-area">
        <graph-canvas
          ref="canvasRef"
          :width="canvasWidth"
          :height="canvasHeight"
        />
        
        <!-- Enhanced toolbar -->
        <graph-toolbar
          :scale="scale"
          :min-scale="minScale"
          :max-scale="maxScale"
          :selection-count="selectionCount"
          :filters="filters"
          :layout-options="layoutOptions"
          @zoom-in="zoomIn"
          @zoom-out="zoomOut"
          @fit-to-content="fitToContent"
          @clear-selection="clearSelection"
          @update-filter="handleFilterUpdate"
          @clear-filters="handleClearFilters"
          @update-layout-option="handleLayoutOptionUpdate"
        />
        
        <!-- Minimap -->
        <graph-minimap
          :visible="minimapVisible"
          :visible-messages="filteredMessages"
          :visible-edges="visibleEdges"
          :graph-bounds="layoutBounds"
          :viewport-bounds="{ width: canvasWidth, height: canvasHeight }"
          :viewport-scale="scale"
          :viewport-translate="{ x: viewportTranslateX, y: viewportTranslateY }"
          :node-positions="nodePositions"
          :selected-message-ids="selectedMessageIds"
          @toggle-visibility="toggleMinimapVisibility"
          @viewport-change="handleViewportChange"
          @zoom-to-fit="fitToContent"
          @center-view="centerView"
        />
        
        <!-- Status overlay -->
        <div v-if="showStatus" class="status-overlay">
          <div class="status-content">
            <div v-if="isLoading" class="status-loading">
              <div class="loading-spinner"></div>
              <span>Loading messages...</span>
            </div>
            
            <div v-else-if="messageCount === 0" class="status-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.4">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <p>No messages to display</p>
              <p class="empty-subtitle">Try adjusting your filters or load more messages</p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Enhanced side panel -->
      <graph-side-panel
        :is-open="sidePanelOpen"
        :selected-messages="selectedMessages"
        :current-user-id="currentUserId"
        :is-admin="isAdmin"
        @close="closeSidePanel"
        @clear-selection="clearSelection"
        @focus-message="focusMessage"
        @reply-to-message="handleReplyToMessage"
        @delete-message="handleDeleteMessage"
        @export-selection="handleExportSelection"
      />
    </div>
    
    <!-- Bottom status bar -->
    <div class="graph-footer">
      <div class="footer-left">
        <span class="message-count">{{ messageCount }} messages</span>
        <span v-if="selectionCount > 0" class="selection-count">
          {{ selectionCount }} selected
        </span>
      </div>
      
      <div class="footer-right">
        <span class="zoom-level">Zoom: {{ Math.round(scale * 100) }}%</span>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex';
import GraphCanvas from '../../components/graph/GraphCanvas.vue';
import GraphToolbar from '../../components/graph/GraphToolbar.vue';
import GraphMinimap from '../../components/graph/GraphMinimap.vue';
import GraphSidePanel from '../../components/graph/GraphSidePanel.vue';
import MessageNode from '../../components/MessageNode.vue';
import { useGraphInteraction } from '../../composables/useGraphInteraction.js';

export default {
  name: 'GraphView',
  components: {
    GraphCanvas,
    GraphToolbar,
    GraphMinimap,
    GraphSidePanel,
    MessageNode
  },
  
  setup() {
    // Use interaction composable for enhanced functionality
    const interaction = useGraphInteraction();
    
    return {
      ...interaction
    };
  },
  
  data() {
    return {
      canvasWidth: 800,
      canvasHeight: 600,
      minScale: 0.1,
      maxScale: 4,
      minimapVisible: true
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
      'filteredMessages',
      'visibleEdges',
      'nodePosition',
      'layoutBounds'
    ]),
    
    scale() {
      return this.$store.state.graphView.viewport.scale;
    },
    
    viewportTranslateX() {
      return this.$store.state.graphView.viewport.translateX;
    },
    
    viewportTranslateY() {
      return this.$store.state.graphView.viewport.translateY;
    },
    
    sidePanelOpen() {
      return this.$store.state.graphView.ui.sidePanelOpen;
    },
    
    selectedMessage() {
      return this.selectedMessageForPanel;
    },
    
    messageCount() {
      return this.messages.length;
    },
    
    isLoading() {
      return this.isLayoutCalculating || this.messageCount === 0;
    },
    
    showStatus() {
      return this.isLoading || this.messageCount === 0;
    },
    
    // Phase 2 computed properties
    filters() {
      return this.$store.state.graphView.filters;
    },
    
    layoutOptions() {
      return this.$store.state.graphView.layout.options;
    },
    
    nodePositions() {
      return this.$store.state.graphView.layout.positions;
    },
    
    selectedMessageIds() {
      return this.$store.state.graphView.selection.selectedIds;
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
      'setViewportScale',
      'fitToContent'
    ]),
    
    async loadGraphData(messageId) {
      try {
        // Load message radius data using existing store action
        const response = await this.$store.dispatch('messages/loadMessageRadius', {
          messageId,
          radius: 3, // Start with radius 3 for Phase 1
          get_replies: true
        });
        
        if (response && response.data) {
          const messages = response.data.messages || [];
          
          // Initialize graph with loaded data
          await this.initializeGraph({
            messageId,
            messages
          });
        }
      } catch (error) {
        console.error('[GraphView] Failed to load graph data:', error);
        // Could show error message to user
        this.$router.push('/');
      }
    },
    
    // Navigation
    goBack() {
      if (this.currentMessageId) {
        this.$router.push(`/${this.currentMessageId}`);
      } else {
        this.$router.push('/');
      }
    },
    
    toggleToListView() {
      if (this.currentMessageId) {
        this.$router.push(`/${this.currentMessageId}`);
      } else {
        this.$router.push('/');
      }
    },
    
    // Zoom controls
    zoomIn() {
      const newScale = Math.min(this.maxScale, this.scale * 1.2);
      this.setViewportScale(newScale);
    },
    
    zoomOut() {
      const newScale = Math.max(this.minScale, this.scale / 1.2);
      this.setViewportScale(newScale);
    },
    
    // UI controls
    closeSidePanel() {
      this.$store.commit('graphView/SET_SIDE_PANEL_OPEN', false);
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
    
    // Phase 2 event handlers
    handleFilterUpdate({ key, value }) {
      this.$store.dispatch('graphView/setFilter', { key, value });
    },
    
    handleClearFilters() {
      this.$store.dispatch('graphView/clearAllFilters');
    },
    
    handleLayoutOptionUpdate({ key, value }) {
      this.$store.commit('graphView/SET_LAYOUT_OPTIONS', { [key]: value });
      // Recalculate layout with new options
      this.$store.dispatch('graphView/calculateLayout');
    },
    
    toggleMinimapVisibility() {
      this.minimapVisible = !this.minimapVisible;
    },
    
    handleViewportChange({ translateX, translateY }) {
      this.$store.dispatch('graphView/setViewportTranslate', {
        x: translateX,
        y: translateY
      });
    },
    
    centerView() {
      this.$store.dispatch('graphView/fitToContent');
    },
    
    focusMessage(messageId) {
      // Center viewport on the specified message
      const position = this.nodePosition(messageId);
      if (position) {
        const centerX = (this.canvasWidth / 2) - (position.x * this.scale);
        const centerY = (this.canvasHeight / 2) - (position.y * this.scale);
        
        this.handleViewportChange({
          translateX: centerX,
          translateY: centerY
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
        path: `/${message.id}`,
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

.view-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: var(--color-text-primary);
}

.message-context {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.context-label {
  color: var(--color-text-secondary);
}

.context-id {
  font-family: monospace;
  background: var(--color-surface-light);
  padding: 2px 6px;
  border-radius: 3px;
  color: var(--color-text-primary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.zoom-button:hover:not(:disabled) {
  background: var(--color-surface-hover);
  border-color: var(--color-border-hover);
}

.zoom-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.zoom-indicator {
  font-size: 14px;
  color: var(--color-text-secondary);
  min-width: 50px;
  text-align: center;
}

.fit-button {
  width: auto;
  padding: 0 8px;
}

.view-toggle-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.view-toggle-button:hover {
  background: var(--color-primary-dark);
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
  background: rgba(255, 255, 255, 0.9);
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
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top: 3px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.status-empty p {
  margin: 8px 0;
}

.empty-subtitle {
  font-size: 14px;
  opacity: 0.7;
}

/* Sidebar */
.graph-sidebar {
  width: 0;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  overflow: hidden;
  transition: width 0.3s ease;
}

.sidebar-open {
  width: 400px;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.sidebar-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-panel-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: 3px;
}

.close-panel-button:hover {
  background: var(--color-surface-hover);
}

.sidebar-content {
  padding: 16px;
  overflow-y: auto;
  height: calc(100% - 60px);
}

.multi-selection-info {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.multi-selection-actions {
  margin-top: 12px;
}

.action-button {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: 14px;
}

.action-button:hover {
  background: var(--color-surface-hover);
}

.action-button.secondary {
  background: none;
  color: var(--color-text-secondary);
}

/* Footer */
.graph-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: 14px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.selection-count {
  color: var(--color-primary);
  font-weight: 500;
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