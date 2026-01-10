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
          <template v-if="isTreeMode">
            <graph-tree-edge
              v-for="edge in visibleEdges"
              :key="edge.id"
              :edge="edge"
              :source-position="getNodePosition(edge.source)"
              :target-position="getNodePosition(edge.target)"
              :is-part-of-selection="isEdgeInSelection(edge)"
              :zoom-level="scale"
            />
          </template>
          <!-- Default mode: bezier curves -->
          <template v-else>
            <graph-edge
              v-for="edge in visibleEdges"
              :key="edge.id"
              :edge="edge"
              :source-position="getNodePosition(edge.source)"
              :target-position="getNodePosition(edge.target)"
              :is-part-of-selection="isEdgeInSelection(edge)"
              :zoom-level="scale"
            />
          </template>
        </g>
        
        <!-- Nodes layer -->
        <g class="nodes-layer">
          <!-- Tree mode: circular nodes -->
          <template v-if="isTreeMode">
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
            />
          </template>
          <!-- Default mode: rectangular nodes -->
          <template v-else>
            <graph-node
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
            />
          </template>
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
import GraphNode from './GraphNode.vue';
import GraphEdge from './GraphEdge.vue';
import GraphTreeNode from './GraphTreeNode.vue';
import GraphTreeEdge from './GraphTreeEdge.vue';

export default {
  name: 'GraphCanvas',
  components: {
    GraphNode,
    GraphEdge,
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
      minScale: 0.5,
      maxScale: 4,
      zoomSensitivity: 0.001
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
      'viewportTransform',
      'isTreeMode'
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
      if (event.button === 0) { // Left mouse button
        this.isPanning = true;
        this.lastPanPoint = { x: event.clientX, y: event.clientY };
        event.preventDefault();
      }
    },
    
    handleMouseMove(event) {
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
      if (event.button === 0) {
        this.isPanning = false;
        this.lastPanPoint = null;
      }
    },
    
    handleMouseLeave() {
      this.isPanning = false;
      this.lastPanPoint = null;
    },
    
    // Node interaction handlers
    handleNodeClick({ message, event, multiSelect }) {
      // No selection state in simplified graph mode
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
        await this.loadMessageBranchUp({ messageId: message.id, depth: 3 });
      } catch (e) {
        console.error('[GraphCanvas] Failed loading parents:', e);
      }
    },
    async handleLoadMoreDown({ message }) {
      try {
        await this.loadMessageBranchDown({ messageId: message.id, depth: 3 });
      } catch (e) {
        console.error('[GraphCanvas] Failed loading children:', e);
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