<template>
  <g class="graph-edge" :class="edgeClasses">
    <path
      :d="pathData"
      :stroke="strokeColor"
      :stroke-width="strokeWidth"
      fill="none"
      class="edge-path"
    />
    
    <!-- Selection highlight path -->
    <path
      v-if="isPartOfSelection"
      :d="pathData"
      stroke="var(--color-primary)"
      :stroke-width="strokeWidth + 2"
      fill="none"
      class="edge-highlight"
      opacity="0.6"
    />
    
    <!-- Arrow marker for direction indication -->
    <polygon
      v-if="showArrow"
      :points="arrowPoints"
      :fill="strokeColor"
      class="edge-arrow"
    />
  </g>
</template>

<script>
export default {
  name: 'GraphEdge',
  props: {
    // Edge data
    edge: {
      type: Object,
      required: true
    },
    
    // Node positions
    sourcePosition: {
      type: Object,
      required: true
    },
    
    targetPosition: {
      type: Object,
      required: true
    },
    
    // Visual properties
    isSelected: {
      type: Boolean,
      default: false
    },
    
    isPartOfSelection: {
      type: Boolean,
      default: false
    },
    
    isHovered: {
      type: Boolean,
      default: false
    },
    
    // Display options
    showArrow: {
      type: Boolean,
      default: true
    },
    
    // Zoom level for LOD
    zoomLevel: {
      type: Number,
      default: 1
    }
  },
  
  computed: {
    edgeClasses() {
      return {
        'edge-selected': this.isSelected,
        'edge-highlighted': this.isPartOfSelection,
        'edge-hovered': this.isHovered,
        'edge-simplified': this.zoomLevel < 0.5
      };
    },
    
    strokeColor() {
      if (this.isPartOfSelection) {
        return 'var(--color-primary)';
      }
      if (this.isHovered) {
        return 'var(--color-border-hover)';
      }
      return 'var(--color-border)';
    },
    
    strokeWidth() {
      if (this.isPartOfSelection) {
        return 3;
      }
      if (this.isHovered) {
        return 2.5;
      }
      return 2;
    },
    
    pathData() {
      const { sourcePosition, targetPosition } = this;
      
      // Calculate control points for smooth curve
      const dx = targetPosition.x - sourcePosition.x;
      const dy = targetPosition.y - sourcePosition.y;
      
      // Vertical curve with moderate tension
      const tension = Math.min(Math.abs(dy) * 0.6, 50);
      
      const cp1x = sourcePosition.x;
      const cp1y = sourcePosition.y + tension;
      const cp2x = targetPosition.x;
      const cp2y = targetPosition.y - tension;
      
      return `M ${sourcePosition.x} ${sourcePosition.y} 
              C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetPosition.x} ${targetPosition.y}`;
    },
    
    arrowPoints() {
      if (!this.showArrow) return '';
      
      const { targetPosition, sourcePosition } = this;
      
      // Calculate arrow direction
      const dx = targetPosition.x - sourcePosition.x;
      const dy = targetPosition.y - sourcePosition.y;
      const angle = Math.atan2(dy, dx);
      
      // Arrow size
      const arrowSize = 8;
      const arrowWidth = 6;
      
      // Calculate arrow points
      const x1 = targetPosition.x - arrowSize * Math.cos(angle);
      const y1 = targetPosition.y - arrowSize * Math.sin(angle);
      
      const x2 = x1 - arrowWidth * Math.cos(angle - Math.PI / 2);
      const y2 = y1 - arrowWidth * Math.sin(angle - Math.PI / 2);
      
      const x3 = x1 - arrowWidth * Math.cos(angle + Math.PI / 2);
      const y3 = y1 - arrowWidth * Math.sin(angle + Math.PI / 2);
      
      return `${targetPosition.x},${targetPosition.y} ${x2},${y2} ${x3},${y3}`;
    }
  }
};
</script>

<style scoped>
.graph-edge {
  pointer-events: none;
}

.edge-path {
  transition: all 0.2s ease;
  opacity: 0.6;
}

.edge-highlighted .edge-path {
  opacity: 0.9;
}

.edge-hovered .edge-path {
  opacity: 0.8;
}

.edge-simplified .edge-path {
  opacity: 0.4;
}

.edge-highlight {
  animation: pulse 2s infinite;
}

.edge-arrow {
  transition: all 0.2s ease;
  opacity: 0.8;
}

.edge-highlighted .edge-arrow {
  opacity: 1;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 0.9;
  }
}

/* CSS Custom Properties for theming */
:root {
  --color-border: #e2e8f0;
  --color-border-hover: #cbd5e0;
  --color-primary: #3b82f6;
}
</style> 