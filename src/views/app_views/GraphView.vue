<template>
  <div class="graph-view">
    <!-- Header (simplified) -->
    <div class="graph-header" :class="{ 'drawing-mode': ui.isStitchDrawingMode }">
      <div class="header-left" v-if="!ui.isStitchDrawingMode">
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
            <path d="M8 12L3 7h3V1h4v6h3L8 12z"/>
            <path d="M14 14H2v-2h12v2z"/>
          </svg>
          {{ isLoadingAll ? loadingProgress : 'Load All' }}
        </button>

        <button
          @click="showLoadThreadModal = true"
          class="load-thread-button"
          title="Load an independent thread into the view"
        >
          <span class="load-icon">📂</span>
          Load Thread
        </button>

        <button
          @click="startDrawingStitch"
          class="draw-stitch-button"
          title="Connect two messages with a stitch"
        >
          <span class="stitch-icon">🪡</span>
          Draw Stitch
        </button>
      </div>

      <div class="header-left drawing-controls" v-else>
        <div class="drawing-instruction">
          <span class="pulse-dot"></span>
          {{ ui.stitchSourceId ? 'Select posterior node' : 'Select prior node' }}
        </div>
        
        <div v-if="isLinking" class="linking-status">
          <div class="button-spinner small"></div>
          Stitching...
        </div>

        <button 
          @click="cancelDrawingStitch" 
          class="cancel-draw-button"
          :disabled="isLinking"
        >
          ✕
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
          @messages-loading-start="handleMessagesLoadingStart"
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
              <p class="loading-text">No graph data loaded.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Right side panel (message details) -->
      <graph-side-panel />
    </div>

    <load-thread-modal
      :is-visible="showLoadThreadModal"
      @close="showLoadThreadModal = false"
      @select="handleLoadThread"
    />
  </div>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex';
import GraphCanvas from '../../components/graph/GraphCanvas.vue';
import GraphSidePanel from '../../components/graph/GraphSidePanel.vue';
import LoadThreadModal from '../../components/modals/LoadThreadModal.vue';
import UserService from '../../services/UserService.js';


export default {
  name: 'GraphView',
  components: {
    GraphCanvas,
    GraphSidePanel,
    LoadThreadModal
  },
  
  data() {
    return {
      canvasWidth: 800,
      canvasHeight: 600,
      refreshTimeout: null,
      unwatchMessages: null,
      isLoadingAll: false,
      loadingProgress: '',
      pendingMessagesLoad: null,
      stashedSelectedId: null,
      isLinking: false,
      showLoadThreadModal: false
    };
  },
  
  computed: {
    ...mapState('graphView', [
      'currentMessageId',
      'messages',
      'ui'
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
      return this.isLayoutCalculating;
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
    
    // Watch for structural changes in the messages store and refresh graph
    this.unwatchMessages = this.$store.watch(
      (state) => state.messages.structureVersion,
      () => {
        // Debounce refresh to avoid excessive updates
        if (this.refreshTimeout) {
          clearTimeout(this.refreshTimeout);
        }
        this.refreshTimeout = setTimeout(() => {
          // When a user-triggered incremental expansion is in-flight,
          // prefer the explicit payload-based refresh (from GraphCanvas).
          if (this.pendingMessagesLoad) return;
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
      'clearSelection',
      'startStitchDrawing',
      'cancelStitchDrawing',
      'addStitchLink'
    ]),

    async handleLoadThread(messageId) {
      console.log('[GraphView] handleLoadThread called with ID:', messageId);
      const message = this.$store.getters['messages/getMessage'](messageId);
      if (message) {
        console.log('[GraphView] Found message in store:', message.id);
        // Check if message is already in graph
        if (this.messages.some(m => m.id === message.id)) {
          console.log('[GraphView] Message already in graph, focusing:', message.id);
          this.focusMessage(message.id);
          return;
        }

        console.log('[GraphView] Adding new extra seed ID to graphView store:', message.id);

        // Add to extra seeds so it persists through refreshes
        this.$store.commit('graphView/ADD_EXTRA_SEED_ID', message.id);
        
        // Refresh graph from store to include the new seed and its local subgraph
        console.log('[GraphView] Triggering refreshGraphFromStore after adding seed');
        await this.refreshGraphFromStore();
        
        // Focus the new message
        this.$nextTick(() => {
          console.log('[GraphView] Focusing new message after refresh:', message.id);
          this.focusMessage(message.id);
        });
      } else {
        console.error('[GraphView] Message NOT found in store for ID:', messageId);
      }
    },


    startDrawingStitch() {
      // Stash currently selected message ID to restore later
      this.stashedSelectedId = this.$store.state.graphView.selection.lastSelectedId;
      this.startStitchDrawing();
    },

    cancelDrawingStitch() {
      this.cancelStitchDrawing();
      // Restore previous selection if it existed
      if (this.stashedSelectedId) {
        this.selectMessage({ messageId: this.stashedSelectedId, multiSelect: false });
      }
    },

    handleMessageClick({ message, multiSelect = false }) {
      if (!message || !message.id) return;

      // Handle stitch drawing mode
      if (this.ui.isStitchDrawingMode) {
        if (!this.ui.stitchSourceId) {
          // First node selected - set as source
          this.$store.commit('graphView/SET_STITCH_DRAWING_MODE', { 
            isDrawing: true, 
            sourceId: message.id 
          });
          // Highlight the source node visually using the standard selection state
          this.selectMessage({ messageId: message.id, multiSelect: false });
        } else if (message.id !== this.ui.stitchSourceId) {
          // Second node selected - perform stitch
          this.confirmStitchLink(this.ui.stitchSourceId, message.id);
        }
        return;
      }

      // Normal selection mode
      this.selectMessage({
        messageId: message.id,
        multiSelect
      });
    },

    async confirmStitchLink(sourceId, targetId) {
      if (this.isLinking) return;
      
      this.isLinking = true;
      try {
        const success = await UserService.createLink(sourceId, targetId);
        if (success) {
          // Optimistically update the graph edges in the store
          this.addStitchLink({ sourceId, targetId });
          
          // Selection is already on the target node; side panel will open automatically
          // because isStitchDrawingMode becomes false in addStitchLink action.
        } else {
          alert('Failed to create stitch link.');
          this.cancelDrawingStitch();
        }
      } catch (e) {
        console.error('[GraphView] Error creating stitch:', e);
        alert('Error creating stitch link.');
        this.cancelDrawingStitch();
      } finally {
        this.isLinking = false;
      }
    },

    handleMessagesLoadingStart(payload) {
      this.pendingMessagesLoad = payload || {};
    },

    // Collect a subgraph from store-only data: from highest in-store ancestor and all in-store descendants
    collectStoreSubgraph(centerId) {
      console.log('[GraphView] collectStoreSubgraph called with centerId:', centerId);
      const getMsg = (id) => this.$store.getters['messages/getMessage'](id);
      
      const seedIds = [];
      if (centerId && getMsg(centerId)) seedIds.push(centerId);
      
      // Add extra seeds from store
      const extraSeeds = this.$store.state.graphView.extraSeedIds || [];
      console.log('[GraphView] Found extraSeedIds in store:', extraSeeds);
      for (const id of extraSeeds) {
        if (id && getMsg(id) && !seedIds.includes(id)) {
          seedIds.push(id);
        }
      }

      console.log('[GraphView] Final seed IDs for collection:', seedIds);
      if (seedIds.length === 0) return [];

      const result = new Map();
      const queue = [];

      // Find highest ancestor for each seed and add to queue
      for (const id of seedIds) {
        let highest = getMsg(id);
        let p = highest.parent_id;
        while (p && getMsg(p)) {
          highest = getMsg(p);
          p = highest.parent_id;
        }
        if (!result.has(highest.id)) {
          console.log('[GraphView] Adding highest ancestor to BFS queue:', highest.id, 'for seed:', id);
          queue.push(highest.id);
        }
      }

      // BFS across reply-children and stitch-neighbors that already exist in store
      while (queue.length) {
        const id = queue.shift();
        const m = getMsg(id);
        if (!m || result.has(id)) continue;
        result.set(id, m);

        // Include reply parents too
        const parentId = m.parent_id;
        if (parentId && getMsg(parentId)) queue.push(parentId);

        const kids = Array.isArray(m.child_ids) ? m.child_ids : [];
        const stitchKids = Array.isArray(m.stitch_child_ids) ? m.stitch_child_ids : [];
        const stitchParents = Array.isArray(m.stitch_parent_ids) ? m.stitch_parent_ids : [];

        for (const k of kids) if (getMsg(k)) queue.push(k);
        for (const sk of stitchKids) if (getMsg(sk)) queue.push(sk);
        for (const sp of stitchParents) if (getMsg(sp)) queue.push(sp);
      }

      console.log('[GraphView] collectStoreSubgraph returning node count:', result.size);
      return Array.from(result.values());
    },
    
    // Refresh graph view with current store data (incremental, anchored)
    async refreshGraphFromStore(eventPayload = {}) {
      if (!this.currentMessageId) return;
      
      try {
        const prevIds = new Set(this.messages.map((m) => m.id));

        // Re-collect subgraph from store (includes newly loaded messages)
        const messages = this.collectStoreSubgraph(this.currentMessageId);
        const nextIds = new Set(messages.map((m) => m.id));
        const addedIds = Array.from(nextIds).filter((id) => !prevIds.has(id));

        const anchorId = eventPayload.anchorMessageId || this.currentMessageId;

        const lockOtherTrees = eventPayload.lockOtherTrees !== false;

        // Reply-connected component rooted at anchorId.
        // Nodes outside this component are considered "other trees" and must keep their
        // existing coordinates (locked) so we don't reset the whole canvas.
        const msgMap = new Map(messages.map((m) => [m.id, m]));
        const idSet = new Set(messages.map((m) => m.id));

        let lockedNodeIds = null;
        if (lockOtherTrees) {
          const replyComponentIds = new Set();
          if (anchorId && msgMap.has(anchorId)) {
            const q = [anchorId];
            while (q.length) {
              const id = q.shift();
              if (!id || replyComponentIds.has(id)) continue;
              if (!msgMap.has(id)) continue;
              replyComponentIds.add(id);

              const m = msgMap.get(id);
              const parentId = m?.parent_id;
              if (parentId && idSet.has(parentId)) q.push(parentId);

              const childIds = Array.isArray(m?.child_ids) ? m.child_ids : [];
              for (const childId of childIds) {
                if (idSet.has(childId)) q.push(childId);
              }
            }
          }

          lockedNodeIds = new Set(Array.from(prevIds).filter((id) => !replyComponentIds.has(id)));
        }

        // For stitched expansions, influence left/right placement.
        // Only stitch-in is forced to the left; stitch-out keeps existing/default placement.
        let rootPriorityMap = null;
        if (eventPayload?.stitchEdgeType === 'in' && addedIds.length > 0) {
          const findReplyRootId = (startId) => {
            let cur = startId;
            let guard = 0;
            while (cur && msgMap.has(cur) && guard < 2000) {
              guard += 1;
              const m = msgMap.get(cur);
              const p = m?.parent_id;
              if (p && msgMap.has(p)) {
                cur = p;
                continue;
              }
              return cur;
            }
            return startId;
          };

          const originalRootId = findReplyRootId(anchorId);
          const addedRootIds = new Set(addedIds.map((id) => findReplyRootId(id)));

          rootPriorityMap = new Map();
          // Keep the original root in the middle.
          if (originalRootId) rootPriorityMap.set(originalRootId, 50);

          for (const rid of addedRootIds) {
            if (rid === originalRootId) continue;
            rootPriorityMap.set(rid, 0);
          }
        }

        await this.$store.dispatch('graphView/updateGraphMessages', {
          messageId: this.currentMessageId,
          messages,
          fitToContent: false,
          anchorId,
          rootPriorityMap,
          lockedNodeIds
        });
      } catch (error) {
        console.error('[GraphView] Failed to refresh graph from store:', error);
      } finally {
        // Done with this explicit refresh; allow watcher-driven updates again.
        this.pendingMessagesLoad = null;
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

    async loadGraphData(messageId) {
      // No auto-loading: render whatever is already in store.
      const graphState = this.$store.state.graphView;

      // Reuse previous session if it matches the current origin and we already have a layout.
      const hasSession =
        graphState.currentMessageId === messageId &&
        Array.isArray(graphState.messages) &&
        graphState.messages.length > 0 &&
        graphState.layout?.positions &&
        graphState.layout.positions.size > 0;

      if (hasSession) {
        // Refresh with any new data loaded in global store while this view was inactive.
        await this.refreshGraphFromStore();
        this.clearSelection();
        return;
      }

      // Otherwise initialize from what is already loaded in the global messages store.
      const combined = this.collectStoreSubgraph(messageId);
      if (combined.length > 0) {
        await this.$store.dispatch('graphView/initializeGraph', {
          messageId,
          messages: combined
        });
      }

      // Default render should not auto-select any node.
      this.clearSelection();
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
          
           // Find messages with unloaded reply parents
           const messagesWithUnloadedParents = currentMessages.filter(msg => {
             if (!msg.parent_id) return false;
             const parentLoaded = !!this.$store.getters['messages/getMessage'](msg.parent_id);
             return !parentLoaded;
           });

           // Find messages with unloaded reply children
           const messagesWithUnloadedChildren = currentMessages.filter(msg => {
             const childIds = msg.child_ids || [];
             if (!childIds.length) return false;
             return childIds.some(id => !this.$store.getters['messages/getMessage'](id));
           });

           // Find messages with unloaded stitch-in neighbors (links inbound)
           const messagesWithUnloadedStitchParents = currentMessages.filter(msg => {
             const ids = msg.stitch_parent_ids || [];
             if (!ids.length) return false;
             return ids.some(id => !this.$store.getters['messages/getMessage'](id));
           });

           // Find messages with unloaded stitch-out neighbors (links outbound)
           const messagesWithUnloadedStitchChildren = currentMessages.filter(msg => {
             const ids = msg.stitch_child_ids || [];
             if (!ids.length) return false;
             return ids.some(id => !this.$store.getters['messages/getMessage'](id));
           });

           const totalToLoad =
             messagesWithUnloadedParents.length +
             messagesWithUnloadedChildren.length +
             messagesWithUnloadedStitchParents.length +
             messagesWithUnloadedStitchChildren.length;
          
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
          
           // Load parents in parallel (replies inbound)
           const parentPromises = messagesWithUnloadedParents.map(msg =>
             this.$store.dispatch('messages/loadMessageBranchUp', {
               messageId: msg.id,
               depth: 5,
               edge_type: 'replies'
             }).catch(err => {
               console.error(`[GraphView] Failed to load parents for ${msg.id}:`, err);
             })
           );

           // Load children in parallel (replies outbound)
           const childPromises = messagesWithUnloadedChildren.map(msg =>
             this.$store.dispatch('messages/loadMessageBranchDown', {
               messageId: msg.id,
               depth: 5,
               edge_type: 'replies'
             }).catch(err => {
               console.error(`[GraphView] Failed to load children for ${msg.id}:`, err);
             })
           );

           // Load stitch parents in parallel (links inbound)
           const stitchParentPromises = messagesWithUnloadedStitchParents.map(msg =>
             this.$store.dispatch('messages/loadMessageBranchUp', {
               messageId: msg.id,
               depth: 5,
               edge_type: 'links'
             }).catch(err => {
               console.error(`[GraphView] Failed to load stitch-in for ${msg.id}:`, err);
             })
           );

           // Load stitch children in parallel (links outbound)
           const stitchChildPromises = messagesWithUnloadedStitchChildren.map(msg =>
             this.$store.dispatch('messages/loadMessageBranchDown', {
               messageId: msg.id,
               depth: 5,
               edge_type: 'links'
             }).catch(err => {
               console.error(`[GraphView] Failed to load stitch-out for ${msg.id}:`, err);
             })
           );

           // Wait for all loads to complete
           await Promise.all([...parentPromises, ...childPromises, ...stitchParentPromises, ...stitchChildPromises]);
          
           // Refresh graph to include new messages.
           // Disable locking so the reply forest keeps consistent spacing.
           await this.refreshGraphFromStore({ lockOtherTrees: false });
          
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

          // Final full layout recompute (no anchoring/locking) to normalize spacing.
          await this.$store.dispatch('graphView/calculateLayout');
          this.$store.dispatch('graphView/fitToContent');

        
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

/* Load thread button */
.load-thread-button {
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

.load-thread-button:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-hover);
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

/* Side panel */
  .side-panel {
    position: fixed;
    top: 0;
    right: 0;
    height: 100vh;
    width: 380px;
    max-width: 92vw;
    background: rgba(248, 250, 252, 0.96);
    backdrop-filter: blur(8px);
    border-left: 1px solid var(--color-border);
    box-shadow: -12px 0 36px rgba(0, 0, 0, 0.12);
    transform: translateX(100%);
    will-change: transform;
    z-index: 40;
    display: flex;
    flex-direction: column;
  }

  .side-panel-slide-enter-active,
  .side-panel-slide-leave-active {
    transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .side-panel-slide-enter-from,
  .side-panel-slide-leave-to {
    transform: translateX(100%);
  }

  .side-panel-slide-enter-to,
  .side-panel-slide-leave-from {
    transform: translateX(0);
  }

  .side-panel-header {
    padding: 14px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--color-border);
    background: linear-gradient(to bottom, rgba(248, 250, 252, 1), rgba(248, 250, 252, 0.92));
  }

  .side-panel-title {
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .side-panel-close {
    border: 1px solid var(--color-border);
    background: rgba(255, 255, 255, 0.6);
    color: var(--color-text-primary);
    border-radius: 10px;
    width: 32px;
    height: 32px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease, transform 0.15s ease;
  }

  .side-panel-close:hover {
    background: rgba(255, 255, 255, 0.9);
    transform: translateY(-1px);
  }

  .side-panel-body {
    padding: 16px;
    overflow: auto;
  }

  .side-panel-empty {
    padding: 16px;
    color: var(--color-text-secondary);
  }

  .side-panel-row {
    margin-bottom: 14px;
  }

  .side-panel-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin-bottom: 6px;
  }

  .side-panel-value {
    color: var(--color-text-primary);
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.35;
  }

  .side-panel-value.mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 12px;
  }

.graph-header.drawing-mode {
  background: var(--color-primary-light);
  border-bottom: 2px solid var(--color-primary);
}

.drawing-controls {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.drawing-instruction {
  font-weight: 700;
  color: var(--color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background-color: var(--color-primary);
  border-radius: 50%;
  display: inline-block;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); opacity: 0.7; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.7; }
}

.cancel-draw-button {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all 0.2s ease;
}

.cancel-draw-button:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
  border-color: var(--color-text-secondary);
}

.draw-stitch-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  color: var(--color-primary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.draw-stitch-button:hover {
  background: var(--color-primary-light);
}

.stitch-icon {
  font-size: 16px;
}

.linking-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--color-primary);
  font-weight: 600;
}

.button-spinner.small {
  width: 14px;
  height: 14px;
  border-width: 2px;
}

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
