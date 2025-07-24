<template>
  <div class="graph-minimap" v-if="visible">
    <div class="minimap-header">
      <span class="minimap-title">Overview</span>
      <button
        @click="$emit('toggle-visibility')"
        class="close-button"
        title="Hide minimap">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>
    </div>
    
    <div class="minimap-canvas-container" ref="canvasContainer">
      <svg
        ref="minimapSvg"
        :width="minimapWidth"
        :height="minimapHeight"
        class="minimap-canvas"
        @mousedown="handleViewportDragStart"
        @mousemove="handleViewportDrag"
        @mouseup="handleViewportDragEnd"
        @mouseleave="handleViewportDragEnd"
        @click="handleMinimapClick">
        
        <!-- Background -->
        <rect
          width="100%"
          height="100%"
          :fill="backgroundColor"
          class="minimap-background"/>
        
        <!-- Graph content at reduced scale -->
        <g :transform="minimapTransform">
          <!-- Simplified edges -->
          <g class="minimap-edges">
            <line
              v-for="edge in visibleEdges"
              :key="edge.id"
              :x1="getMinimapNodePosition(edge.source).x"
              :y1="getMinimapNodePosition(edge.source).y"
              :x2="getMinimapNodePosition(edge.target).x"
              :y2="getMinimapNodePosition(edge.target).y"
              :stroke="edgeColor"
              :stroke-width="edgeWidth"
              opacity="0.6"/>
          </g>
          
          <!-- Simplified nodes -->
          <g class="minimap-nodes">
            <circle
              v-for="message in visibleMessages"
              :key="message.id"
              :cx="getMinimapNodePosition(message.id).x"
              :cy="getMinimapNodePosition(message.id).y"
              :r="nodeRadius"
              :fill="getNodeColor(message)"
              :stroke="getNodeStroke(message)"
              :stroke-width="nodeStrokeWidth"
              :opacity="getNodeOpacity(message)"
              class="minimap-node"/>
          </g>
        </g>
        
        <!-- Viewport indicator -->
        <rect
          :x="viewportRect.x"
          :y="viewportRect.y"
          :width="viewportRect.width"
          :height="viewportRect.height"
          fill="none"
          :stroke="viewportStroke"
          :stroke-width="viewportStrokeWidth"
          stroke-dasharray="2,2"
          class="viewport-indicator"
          opacity="0.8"/>
        
        <!-- Viewport drag handle -->
        <rect
          :x="viewportRect.x"
          :y="viewportRect.y"
          :width="viewportRect.width"
          :height="viewportRect.height"
          fill="rgba(74, 144, 226, 0.1)"
          class="viewport-drag-area"
          cursor="move"/>
      </svg>
    </div>
    
    <!-- Minimap controls -->
    <div class="minimap-controls">
      <button
        @click="$emit('zoom-to-fit')"
        class="minimap-button"
        title="Fit to view">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1h-4zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zM.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5zm15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5z"/>
        </svg>
      </button>
      
      <button
        @click="$emit('center-view')"
        class="minimap-button"
        title="Center view">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="8" r="1"/>
          <path d="M8 0a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0v-3A.5.5 0 0 1 8 0zm0 12a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0v-3A.5.5 0 0 1 8 12zM0 8a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3A.5.5 0 0 1 0 8zm12 0a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3A.5.5 0 0 1 12 8z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GraphMinimap',
  props: {
    visible: {
      type: Boolean,
      default: true
    },
    
    // Graph data
    visibleMessages: {
      type: Array,
      default: () => []
    },
    
    visibleEdges: {
      type: Array,
      default: () => []
    },
    
    // Layout bounds
    graphBounds: {
      type: Object,
      default: () => ({ minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 })
    },
    
    // Current viewport
    viewportBounds: {
      type: Object,
      default: () => ({ x: 0, y: 0, width: 800, height: 600 })
    },
    
    viewportScale: {
      type: Number,
      default: 1
    },
    
    viewportTranslate: {
      type: Object,
      default: () => ({ x: 0, y: 0 })
    },
    
    // Node positions from layout
    nodePositions: {
      type: Map,
      default: () => new Map()
    },
    
    selectedMessageIds: {
      type: Array,
      default: () => []
    }
  },
  
  data() {
    return {
      minimapWidth: 200,
      minimapHeight: 150,
      isDraggingViewport: false,
      dragStartPoint: null,
      
      // Visual constants
      nodeRadius: 3,
      nodeStrokeWidth: 1,
      edgeWidth: 1,
      viewportStrokeWidth: 2
    };
  },
  
  computed: {
    // Calculate scale to fit graph in minimap
    minimapScale() {
      if (!this.graphBounds || this.graphBounds.width === 0 || this.graphBounds.height === 0) {
        return 0.1;
      }
      
      const padding = 20;
      const availableWidth = this.minimapWidth - padding * 2;
      const availableHeight = this.minimapHeight - padding * 2;
      
      const scaleX = availableWidth / this.graphBounds.width;
      const scaleY = availableHeight / this.graphBounds.height;
      
      return Math.min(scaleX, scaleY, 1); // Don't scale up
    },
    
    minimapTransform() {
      const centerX = this.minimapWidth / 2;
      const centerY = this.minimapHeight / 2;
      
      const scaledWidth = this.graphBounds.width * this.minimapScale;
      const scaledHeight = this.graphBounds.height * this.minimapScale;
      
      const translateX = centerX - scaledWidth / 2 - (this.graphBounds.minX * this.minimapScale);
      const translateY = centerY - scaledHeight / 2 - (this.graphBounds.minY * this.minimapScale);
      
      return `translate(${translateX}, ${translateY}) scale(${this.minimapScale})`;
    },
    
    // Viewport rectangle in minimap coordinates
    viewportRect() {
      if (!this.graphBounds || this.minimapScale === 0) {
        return { x: 0, y: 0, width: 10, height: 10 };
      }
      
      // Calculate viewport in graph coordinates
      const viewportInGraph = {
        x: -this.viewportTranslate.x / this.viewportScale,
        y: -this.viewportTranslate.y / this.viewportScale,
        width: this.viewportBounds.width / this.viewportScale,
        height: this.viewportBounds.height / this.viewportScale
      };
      
      // Transform to minimap coordinates
      const centerX = this.minimapWidth / 2;
      const centerY = this.minimapHeight / 2;
      const scaledWidth = this.graphBounds.width * this.minimapScale;
      const scaledHeight = this.graphBounds.height * this.minimapScale;
      const translateX = centerX - scaledWidth / 2 - (this.graphBounds.minX * this.minimapScale);
      const translateY = centerY - scaledHeight / 2 - (this.graphBounds.minY * this.minimapScale);
      
      return {
        x: translateX + (viewportInGraph.x * this.minimapScale),
        y: translateY + (viewportInGraph.y * this.minimapScale),
        width: viewportInGraph.width * this.minimapScale,
        height: viewportInGraph.height * this.minimapScale
      };
    },
    
    // Theme-based colors
    backgroundColor() {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-surface-dark').trim() || '#181818';
    },
    
    edgeColor() {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || '#333333';
    },
    
    viewportStroke() {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim() || '#4a90e2';
    }
  },
  
  emits: [
    'toggle-visibility',
    'viewport-change',
    'zoom-to-fit',
    'center-view'
  ],
  
  methods: {
    getMinimapNodePosition(messageId) {
      const position = this.nodePositions.get(messageId);
      if (!position) {
        return { x: 0, y: 0 };
      }
      
      // Position is already in graph coordinates
      return {
        x: position.x,
        y: position.y
      };
    },
    
    getNodeColor(message) {
      if (this.selectedMessageIds.includes(message.id)) {
        return getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim() || '#4a90e2';
      }
      
      if (message.public) {
        return getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#10a37f';
      }
      
      return getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#f5f5f5';
    },
    
    getNodeStroke(message) {
      if (this.selectedMessageIds.includes(message.id)) {
        return getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim() || '#4a90e2';
      }
      
      return getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || '#333333';
    },
    
    getNodeOpacity(message) {
      return this.selectedMessageIds.includes(message.id) ? 1 : 0.8;
    },
    
    // Viewport dragging
    handleViewportDragStart(event) {
      if (event.target.classList.contains('viewport-drag-area')) {
        this.isDraggingViewport = true;
        this.dragStartPoint = {
          x: event.offsetX,
          y: event.offsetY
        };
        event.preventDefault();
      }
    },
    
    handleViewportDrag(event) {
      if (this.isDraggingViewport && this.dragStartPoint) {
        const deltaX = event.offsetX - this.dragStartPoint.x;
        const deltaY = event.offsetY - this.dragStartPoint.y;
        
        // Convert minimap delta to graph coordinates
        const graphDeltaX = deltaX / this.minimapScale;
        const graphDeltaY = deltaY / this.minimapScale;
        
        // Convert to viewport translate delta
        const viewportDeltaX = -graphDeltaX * this.viewportScale;
        const viewportDeltaY = -graphDeltaY * this.viewportScale;
        
        this.$emit('viewport-change', {
          translateX: this.viewportTranslate.x + viewportDeltaX,
          translateY: this.viewportTranslate.y + viewportDeltaY
        });
        
        this.dragStartPoint = {
          x: event.offsetX,
          y: event.offsetY
        };
      }
    },
    
    handleViewportDragEnd() {
      this.isDraggingViewport = false;
      this.dragStartPoint = null;
    },
    
    handleMinimapClick(event) {
      if (!this.isDraggingViewport && !event.target.classList.contains('viewport-drag-area')) {
        // Click to center viewport at this point
        const rect = this.$refs.minimapSvg.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        
        // Convert click position to graph coordinates
        const centerX = this.minimapWidth / 2;
        const centerY = this.minimapHeight / 2;
        const scaledWidth = this.graphBounds.width * this.minimapScale;
        const scaledHeight = this.graphBounds.height * this.minimapScale;
        const translateX = centerX - scaledWidth / 2 - (this.graphBounds.minX * this.minimapScale);
        const translateY = centerY - scaledHeight / 2 - (this.graphBounds.minY * this.minimapScale);
        
        const graphX = (clickX - translateX) / this.minimapScale;
        const graphY = (clickY - translateY) / this.minimapScale;
        
        // Center viewport on this point
        const newTranslateX = (this.viewportBounds.width / 2) - (graphX * this.viewportScale);
        const newTranslateY = (this.viewportBounds.height / 2) - (graphY * this.viewportScale);
        
        this.$emit('viewport-change', {
          translateX: newTranslateX,
          translateY: newTranslateY
        });
      }
    }
  }
};
</script>

<style scoped>
.graph-minimap {
  position: absolute;
  bottom: var(--space-md);
  right: var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--color-card-shadow);
  z-index: 10;
  overflow: hidden;
}

.minimap-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-surface-light);
  border-bottom: 1px solid var(--color-border);
}

.minimap-title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text);
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.close-button:hover {
  background: var(--color-hover-overlay);
  color: var(--color-text);
}

.minimap-canvas-container {
  position: relative;
  overflow: hidden;
}

.minimap-canvas {
  display: block;
  cursor: crosshair;
}

.minimap-background {
  transition: all var(--transition-fast);
}

.minimap-node {
  transition: all var(--transition-fast);
}

.minimap-node:hover {
  opacity: 1 !important;
  stroke-width: 2;
}

.viewport-indicator {
  pointer-events: none;
  animation: viewport-pulse 2s infinite;
}

.viewport-drag-area {
  cursor: move;
  transition: all var(--transition-fast);
}

.viewport-drag-area:hover {
  fill: rgba(74, 144, 226, 0.2);
}

.minimap-controls {
  display: flex;
  justify-content: center;
  gap: var(--space-xs);
  padding: var(--space-xs);
  background: var(--color-surface-light);
  border-top: 1px solid var(--color-border);
}

.minimap-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.minimap-button:hover {
  background: var(--color-hover-overlay);
  color: var(--color-text);
}

.minimap-button:active {
  background: var(--color-active-overlay);
}

/* Animations */
@keyframes viewport-pulse {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .graph-minimap {
    bottom: var(--space-sm);
    right: var(--space-sm);
  }
  
  .minimap-canvas {
    width: 150px;
    height: 110px;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .viewport-indicator {
    stroke-width: 3;
    opacity: 1;
  }
  
  .minimap-node {
    stroke-width: 2;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .minimap-node,
  .minimap-background,
  .viewport-drag-area,
  .minimap-button,
  .close-button {
    transition: none;
  }
  
  .viewport-indicator {
    animation: none;
    opacity: 0.8;
  }
}
</style> 