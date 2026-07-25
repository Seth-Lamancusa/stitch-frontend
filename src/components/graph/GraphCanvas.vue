<template>
  <div class="graph-canvas-container" ref="containerRef">
    <svg
      ref="svgRef"
      class="graph-canvas"
      :width="containerWidth"
      :height="containerHeight"
      @wheel="handleWheel"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseLeave"
    >
      <!-- Background grid pattern -->
      <defs>
        <pattern
          id="grid"
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
          :patternTransform="`scale(${scale})`"
        >
          <path
            d="M 20 0 L 0 0 0 20"
            fill="none"
            stroke="var(--color-grid)"
            stroke-width="0.5"
            opacity="0.3"
          />
        </pattern>
      </defs>
      
      <!-- Background -->
      <rect
        width="100%"
        height="100%"
        fill="url(#grid)"
        class="canvas-background"
      />
      
      <!-- Main rendering group with transform -->
      <g
        class="graph-content"
        :transform="transformString"
      >
        <!-- Edges layer -->
        <g class="edges-layer">
          <!-- Tree mode: simple straight lines -->
          <graph-tree-edge
            v-for="edge in visibleEdges"
            :key="edge.id"
            :edge="edge"
            :source-position="getNodePosition(edge.source)"
            :target-position="getNodePosition(edge.target)"
            :is-part-of-selection="isEdgeInSelection(edge)"
            :zoom-level="scale"
          />
        </g>

        <!-- Reply-tree boundaries (dotted, draggable) -->
        <g class="reply-tree-boundaries-layer">
          <rect
            v-for="tree in replyTreeGroups"
            :key="tree.id"
            class="reply-tree-boundary"
            :x="tree.bounds.minX"
            :y="tree.bounds.minY"
            :width="tree.bounds.width"
            :height="tree.bounds.height"
            rx="16"
            ry="16"
            fill="transparent"
            stroke="var(--color-primary)"
            stroke-width="1"
            stroke-dasharray="6 4"
            opacity="0.35"
            :style="{ cursor: isDraggingReplyTree ? 'grabbing' : 'move' }"
            @pointerdown.stop.prevent="handleReplyTreeBoundaryPointerDown($event, tree)"
          />
        </g>
        
        <!-- Nodes layer -->
        <g class="nodes-layer">
          <!-- Tree mode: circular nodes -->
          <graph-tree-node
            v-for="message in visibleMessages"
            :key="message.id"
            :message="message"
            :position="getNodePosition(message.id)"
            :is-selected="isMessageSelected(message.id)"
            :is-hovered="hoveredMessageId === message.id"
            :zoom-level="scale"
            @click="handleNodeClick"
           @mouseenter="handleNodeMouseEnter"
           @mouseleave="handleNodeMouseLeave"
           @load-more-up="handleLoadMoreUp"
           @load-more-down="handleLoadMoreDown"
           @load-stitch-in="handleLoadStitchIn"
           @load-stitch-out="handleLoadStitchOut"
          />
        </g>
      </g>
      
      <!-- Loading overlay -->
      <g v-if="isLoading" class="loading-overlay">
        <rect
          width="100%"
          height="100%"
          fill="rgba(255, 255, 255, 0.8)"
        />
        <text
          :x="containerWidth / 2"
          :y="containerHeight / 2"
          text-anchor="middle"
          dominant-baseline="central"
          class="loading-text"
        >
          Calculating layout...
        </text>
      </g>
    </svg>
  </div>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex';
import GraphTreeNode from './GraphTreeNode.vue';
import GraphTreeEdge from './GraphTreeEdge.vue';

export default {
  name: 'GraphCanvas',
  components: {
    GraphTreeNode,
    GraphTreeEdge
  },
  
  props: {
    width: {
      type: Number,
      default: 800
    },
    height: {
      type: Number,
      default: 600
    }
  },
  
  data() {
    return {
      containerWidth: this.width,
      containerHeight: this.height,
      isPanning: false,
      lastPanPoint: null,
      hoveredMessageId: null,
      
      // Zoom constraints
      // Let users zoom out further than the previous 0.5x cap.
      minScale: 0.1,
      maxScale: 4,
      zoomSensitivity: 0.001,

      // Drag state for dotted reply-tree boundaries
      isDraggingReplyTree: false,
      dragReplyTreeInfo: null,
      dragStartClientX: 0,
      dragStartClientY: 0,
      lastAppliedDx: 0,
      lastAppliedDy: 0,
      rafId: null,
      pendingDx: 0,
      pendingDy: 0,
      windowPointerMoveHandler: null,
      windowPointerUpHandler: null
    };
  },
  
  computed: {
    ...mapState('graphView', [
      'messages',
      'edges'
    ]),
    
    ...mapGetters('graphView', [
      'filteredMessages',
      'visibleEdges',
      'nodePosition',
      'isMessageSelected',
      'isLayoutCalculating',
      'viewportTransform'
    ]),
    
    // Local viewport state
    scale() {
      return this.$store.state.graphView.viewport.scale;
    },
    
    translateX() {
      return this.$store.state.graphView.viewport.translateX;
    },
    
    translateY() {
      return this.$store.state.graphView.viewport.translateY;
    },
    
    transformString() {
      return `translate(${this.translateX}, ${this.translateY}) scale(${this.scale})`;
    },
    
    isLoading() {
      return this.isLayoutCalculating;
    },
    
    // Viewport culling - only show messages within visible area
    visibleMessages() {
      if (!this.filteredMessages || this.filteredMessages.length === 0) {
        return [];
      }
      
      // For Phase 1, show all filtered messages
      // Future optimization: implement viewport culling
      return this.filteredMessages.filter(message => {
        const position = this.getNodePosition(message.id);
        return position !== null;
      });
    },

    // Reply-edge connected components (reply trees) with bounds computed from layout positions.
    replyTreeGroups() {
      const messages = this.filteredMessages || [];
      if (messages.length === 0) return [];

      const messageIdSet = new Set(messages.map((m) => m.id));

      // parent_id -> child_ids
      const parentToChildren = new Map();
      for (const m of messages) {
        if (!m.parent_id) continue;
        if (!messageIdSet.has(m.parent_id)) continue;
        if (!parentToChildren.has(m.parent_id)) parentToChildren.set(m.parent_id, []);
        parentToChildren.get(m.parent_id).push(m.id);
      }

      // Roots are nodes whose parent is absent (or parent_id is null).
      const roots = messages.filter((m) => !m.parent_id || !messageIdSet.has(m.parent_id));
      const visited = new Set();
      const groups = [];

      const baseRadius = 24;
      const pad = 44;

      for (const root of roots) {
        if (visited.has(root.id)) continue;

        const queue = [root.id];
        const nodeIds = [];
        visited.add(root.id);

        while (queue.length) {
          const id = queue.shift();
          nodeIds.push(id);

          const kids = parentToChildren.get(id) || [];
          for (const childId of kids) {
            if (!messageIdSet.has(childId)) continue;
            if (visited.has(childId)) continue;
            visited.add(childId);
            queue.push(childId);
          }
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let anyPos = false;

        for (const id of nodeIds) {
          const p = this.nodePosition(id);
          if (!p) continue;
          anyPos = true;
          minX = Math.min(minX, p.x - baseRadius);
          maxX = Math.max(maxX, p.x + baseRadius);
          minY = Math.min(minY, p.y - baseRadius);
          maxY = Math.max(maxY, p.y + baseRadius);
        }

        if (!anyPos) continue;

        minX -= pad;
        minY -= pad;
        maxX += pad;
        maxY += pad;

        groups.push({
          id: `reply-tree-${root.id}`,
          rootId: root.id,
          nodeIds,
          bounds: {
            minX,
            minY,
            width: maxX - minX,
            height: maxY - minY
          }
        });
      }

      return groups;
    }
  },
  
  mounted() {
    this.updateContainerSize();
    window.addEventListener('resize', this.handleResize);
    
    // Set initial viewport size in store
    this.setViewportSize();
  },
  
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize);
  },
  
  methods: {
    ...mapActions('graphView', [
      'setViewportScale',
      'setViewportTranslate',
      'selectMessage'
    ]),
    ...mapActions('messages', [
      'loadMessageBranchUp',
      'loadMessageBranchDown'
    ]),
    
    getNodePosition(messageId) {
      const position = this.nodePosition(messageId);
      if (!position) {
        return { x: 0, y: 0 };
      }
      // Use layout position as node center; nodes will self-center around this
      return { x: position.x, y: position.y };
    },
    
    isEdgeInSelection(edge) {
      // Check if edge connects selected nodes
      return this.isMessageSelected(edge.source) && this.isMessageSelected(edge.target);
    },
    
    // Zoom and pan handling
    handleWheel(event) {
      event.preventDefault();
      
      const rect = this.$refs.svgRef.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      // Calculate zoom delta
      const deltaScale = -event.deltaY * this.zoomSensitivity;
      const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale + deltaScale));
      
      if (newScale !== this.scale) {
        // Zoom towards mouse position
        const scaleRatio = newScale / this.scale;
        
        const newTranslateX = mouseX - (mouseX - this.translateX) * scaleRatio;
        const newTranslateY = mouseY - (mouseY - this.translateY) * scaleRatio;
        
        this.setViewportScale(newScale);
        this.setViewportTranslate({ x: newTranslateX, y: newTranslateY });
      }
    },
    
    handleMouseDown(event) {
      if (this.isDraggingReplyTree) return;
      if (event.button === 0) { // Left mouse button
        this.isPanning = true;
        this.lastPanPoint = { x: event.clientX, y: event.clientY };
        event.preventDefault();
      }
    },
    
    handleMouseMove(event) {
      if (this.isDraggingReplyTree) return;
      if (this.isPanning && this.lastPanPoint) {
        const deltaX = event.clientX - this.lastPanPoint.x;
        const deltaY = event.clientY - this.lastPanPoint.y;
        
        const newTranslateX = this.translateX + deltaX;
        const newTranslateY = this.translateY + deltaY;
        
        this.setViewportTranslate({ x: newTranslateX, y: newTranslateY });
        
        this.lastPanPoint = { x: event.clientX, y: event.clientY };
      }
    },
    
    handleMouseUp(event) {
      if (this.isDraggingReplyTree) return;
      if (event.button === 0) {
        this.isPanning = false;
        this.lastPanPoint = null;
      }
    },
    
    handleMouseLeave() {
      if (this.isDraggingReplyTree) return;
      this.isPanning = false;
      this.lastPanPoint = null;
    },

    handleReplyTreeBoundaryPointerDown(event, tree) {
      if (!tree || !Array.isArray(tree.nodeIds) || tree.nodeIds.length === 0) return;

      this.isDraggingReplyTree = true;
      this.dragReplyTreeInfo = tree;
      this.isPanning = false;
      this.lastPanPoint = null;

      this.dragStartClientX = event.clientX;
      this.dragStartClientY = event.clientY;
      this.lastAppliedDx = 0;
      this.lastAppliedDy = 0;
      this.pendingDx = 0;
      this.pendingDy = 0;

      const applyDeltaFromPending = () => {
        this.rafId = null;
        const incDx = this.pendingDx - this.lastAppliedDx;
        const incDy = this.pendingDy - this.lastAppliedDy;

        if (Math.abs(incDx) < 0.01 && Math.abs(incDy) < 0.01) return;

        this.lastAppliedDx = this.pendingDx;
        this.lastAppliedDy = this.pendingDy;

        // Apply incremental delta in graph space.
        this.$store.dispatch('graphView/dragReplyTree', { nodeIds: tree.nodeIds, dx: incDx, dy: incDy });
      };

      this.windowPointerMoveHandler = (e) => {
        if (!this.isDraggingReplyTree) return;

        // graph-space delta (viewport scale affects screen delta)
        const dx = (e.clientX - this.dragStartClientX) / this.scale;
        const dy = (e.clientY - this.dragStartClientY) / this.scale;
        this.pendingDx = dx;
        this.pendingDy = dy;

        if (this.rafId == null) {
          this.rafId = requestAnimationFrame(applyDeltaFromPending);
        }
      };

      this.windowPointerUpHandler = () => {
        this.isDraggingReplyTree = false;
        this.dragReplyTreeInfo = null;

        if (this.windowPointerMoveHandler) {
          window.removeEventListener('pointermove', this.windowPointerMoveHandler);
        }
        if (this.windowPointerUpHandler) {
          window.removeEventListener('pointerup', this.windowPointerUpHandler);
        }
        window.removeEventListener('pointercancel', this.windowPointerUpHandler);

        if (this.rafId != null) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }

        this.windowPointerMoveHandler = null;
        this.windowPointerUpHandler = null;
      };

      // Capture pointer when possible.
      try {
        if (event.target && event.target.setPointerCapture) {
          event.target.setPointerCapture(event.pointerId);
        }
      } catch (e) {
        // ignore
      }

      window.addEventListener('pointermove', this.windowPointerMoveHandler);
      window.addEventListener('pointerup', this.windowPointerUpHandler);
      window.addEventListener('pointercancel', this.windowPointerUpHandler);
    },

    // Node interaction handlers
    handleNodeClick({ message, event, multiSelect }) {
      // Emit message click event to parent
      this.$emit('message-click', { message, multiSelect: !!multiSelect });
    },
    
    handleNodeMouseEnter({ message }) {
      this.hoveredMessageId = message.id;
    },
    
    handleNodeMouseLeave({ message }) {
      if (this.hoveredMessageId === message.id) {
        this.hoveredMessageId = null;
      }
    },
    
    // Container management
    updateContainerSize() {
      if (this.$refs.containerRef) {
        const rect = this.$refs.containerRef.getBoundingClientRect();
        this.containerWidth = rect.width;
        this.containerHeight = rect.height;
        this.setViewportSize();
      }
    },
    
    // Manual load handlers
    async handleLoadMoreUp({ message }) {
      const parentId = message.parent_id;
      if (!parentId) return;
      try {
        this.$emit('messages-loading-start', {
          anchorMessageId: message.id,
          loadKind: 'replies-up'
        });
        // Load messages from API - they will be added to the messages store
        await this.loadMessageBranchUp({ messageId: message.id, depth: 3 });
        
        // Emit event to notify parent that messages were loaded
        // The parent's watcher will detect the store change and refresh the graph
        this.$emit('messages-loaded', {
          anchorMessageId: message.id,
          loadKind: 'replies-up'
        });
      } catch (e) {
        console.error('[GraphCanvas] Failed loading parents:', e);
      }
    },
    async handleLoadMoreDown({ message }) {
      try {
        this.$emit('messages-loading-start', {
          anchorMessageId: message.id,
          loadKind: 'replies-down'
        });
        // Load messages from API - they will be added to the messages store
        await this.loadMessageBranchDown({ messageId: message.id, depth: 3 });
        
        // Emit event to notify parent that messages were loaded
        // The parent's watcher will detect the store change and refresh the graph
        this.$emit('messages-loaded', {
          anchorMessageId: message.id,
          loadKind: 'replies-down'
        });
      } catch (e) {
        console.error('[GraphCanvas] Failed loading children:', e);
      }
    },

    async handleLoadStitchIn({ message }) {
      try {
        this.$emit('messages-loading-start', {
          anchorMessageId: message.id,
          stitchEdgeType: 'in',
          loadKind: 'stitch-in'
        });
        await this.loadMessageBranchUp({ messageId: message.id, depth: 3, edge_type: 'links' });
        this.$emit('messages-loaded', {
          anchorMessageId: message.id,
          stitchEdgeType: 'in',
          loadKind: 'stitch-in'
        });
      } catch (e) {
        console.error('[GraphCanvas] Failed loading stitch in:', e);
      }
    },

    async handleLoadStitchOut({ message }) {
      try {
        this.$emit('messages-loading-start', {
          anchorMessageId: message.id,
          stitchEdgeType: 'out',
          loadKind: 'stitch-out'
        });
        await this.loadMessageBranchDown({ messageId: message.id, depth: 3, edge_type: 'links' });
        this.$emit('messages-loaded', {
          anchorMessageId: message.id,
          stitchEdgeType: 'out',
          loadKind: 'stitch-out'
        });
      } catch (e) {
        console.error('[GraphCanvas] Failed loading stitch out:', e);
      }
    },
    
    setViewportSize() {
      this.$store.commit('graphView/SET_VIEWPORT_SIZE', {
        width: this.containerWidth,
        height: this.containerHeight
      });
    },
    
    handleResize() {
      this.updateContainerSize();
    },
    
    // Public methods for external control
    zoomToFit() {
      this.$store.dispatch('graphView/zoomToFit');
    },
    
    zoomIn() {
      const newScale = Math.min(this.maxScale, this.scale * 1.2);
      this.setViewportScale(newScale);
    },
    
    zoomOut() {
      const newScale = Math.max(this.minScale, this.scale / 1.2);
      this.setViewportScale(newScale);
    },
    
    resetZoom() {
      this.setViewportScale(1);
      this.setViewportTranslate({ x: 0, y: 0 });
    }
  }
};
</script>

<style scoped>
.graph-canvas-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--color-background);
  position: relative;
}

.graph-canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
}

.graph-canvas:active {
  cursor: grabbing;
}

.canvas-background {
  fill: var(--color-background);
}

.graph-content {
  transform-origin: 0 0;
}

.edges-layer {
  /* Edges render behind nodes */
}

.nodes-layer {
  /* Nodes render on top */
}

.loading-overlay {
  pointer-events: none;
}

.loading-text {
  font-size: 16px;
  font-weight: 500;
  fill: var(--color-text-secondary);
}

/* Dotted reply-tree boundary overlay */
.reply-tree-boundary {
  pointer-events: all;
}

/* CSS Custom Properties */
:root {
  --color-background: #ffffff;
  --color-grid: #f1f5f9;
  --color-text-secondary: #718096;
}

/* Responsive behavior */
@media (max-width: 768px) {
  .graph-canvas {
    cursor: default; /* Touch devices don't need grab cursor */
  }
}
</style> 
