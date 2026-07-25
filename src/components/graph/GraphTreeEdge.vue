<template>
  <g class="graph-tree-edge" :class="edgeClasses">
    <!-- Main edge line (directed edge, shortened to not run through nodes) -->
    <line
      :x1="line.x1"
      :y1="line.y1"
      :x2="line.x2"
      :y2="line.y2"
      :stroke="strokeColor"
      :stroke-width="strokeWidth"
      :opacity="opacity"
      class="edge-line"
    />
    
    <!-- Selection highlight -->
    <line
      v-if="isPartOfSelection"
      :x1="line.x1"
      :y1="line.y1"
      :x2="line.x2"
      :y2="line.y2"
      stroke="var(--color-secondary)"
      :stroke-width="strokeWidth + 2"
      opacity="0.4"
      class="edge-highlight"
    />

    <!-- Directed arrow head at the outgoing end -->
    <path
      :d="arrowPath"
      :fill="arrowFill"
      :opacity="arrowOpacity"
      class="edge-arrow"
    />
  </g>
</template>

<script>
export default {
  name: 'GraphTreeEdge',
  props: {
    edge: {
      type: Object,
      required: true
    },
    sourcePosition: {
      type: Object,
      required: true
    },
    targetPosition: {
      type: Object,
      required: true
    },
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
        'edge-hovered': this.isHovered
      };
    },

    // Brighter lines for better visibility
    strokeColor() {
      if (this.isPartOfSelection) {
        return 'var(--color-secondary)';
      }
      if (this.isHovered) {
        return '#666666';
      }

      // Stitch links: visually distinct
      if (this.edge && this.edge.edgeType === 'stitch') {
        return '#7B2CBF'; // purple
      }

      return '#666666'; // Brighter gray for better visibility
    },

    strokeWidth() {
      if (this.isPartOfSelection) {
        return 2;
      }
      if (this.isHovered) {
        return 1.5;
      }

      if (this.edge && this.edge.edgeType === 'stitch') {
        return 2.2;
      }

      return 1.5; // Slightly thicker for better visibility
    },

    // Higher opacity for better visibility
    opacity() {
      if (this.isPartOfSelection) {
        return 0.9;
      }
      if (this.isHovered) {
        return 0.8;
      }

      if (this.edge && this.edge.edgeType === 'stitch') {
        return 0.85;
      }

      return 0.75; // Increased from 0.5 for better visibility
    }

    ,

    // Geometry for shortening the line and placing an arrow head.
    geometry() {
      const x1 = this.sourcePosition?.x ?? 0;
      const y1 = this.sourcePosition?.y ?? 0;
      const x2 = this.targetPosition?.x ?? 0;
      const y2 = this.targetPosition?.y ?? 0;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);

      // Fallback to avoid NaNs.
      if (len === 0) {
        return {
          ux: 0,
          uy: 0,
          lineX1: x1,
          lineY1: y1,
          lineX2: x2,
          lineY2: y2,
          tipX: x2,
          tipY: y2,
          baseLeftX: x2,
          baseLeftY: y2,
          baseRightX: x2,
          baseRightY: y2
        };
      }

      const ux = dx / len;
      const uy = dy / len;

      // Approximation: GraphTreeNode uses radius ~20 (leaf) or 24 (root).
      // Push the arrow tip further out so it can't be hidden by the target node.
      const nodeRadius = 24;
      // Shorten the line a lot, and keep the arrow tip just outside the node.
      const lineInset = nodeRadius + 10;
      const tipOutset = -48;

      const lineX1 = x1 + ux * lineInset;
      const lineY1 = y1 + uy * lineInset;
      const lineX2 = x2 - ux * lineInset;
      const lineY2 = y2 - uy * lineInset;

      const perpX = -uy;
      const perpY = ux;

      const arrowLength = 9;
      const arrowHalfWidth = 6;

      const tipX = x2 + ux * (nodeRadius + tipOutset);
      const tipY = y2 + uy * (nodeRadius + tipOutset);

      const baseX = tipX - ux * arrowLength;
      const baseY = tipY - uy * arrowLength;

      const baseLeftX = baseX + perpX * arrowHalfWidth;
      const baseLeftY = baseY + perpY * arrowHalfWidth;
      const baseRightX = baseX - perpX * arrowHalfWidth;
      const baseRightY = baseY - perpY * arrowHalfWidth;

      return {
        ux,
        uy,
        lineX1,
        lineY1,
        lineX2,
        lineY2,
        tipX,
        tipY,
        baseLeftX,
        baseLeftY,
        baseRightX,
        baseRightY
      };
    },

    line() {
      return {
        x1: this.geometry.lineX1,
        y1: this.geometry.lineY1,
        x2: this.geometry.lineX2,
        y2: this.geometry.lineY2
      };
    },

    arrowPath() {
      const g = this.geometry;
      // Filled triangle.
      return `M ${g.tipX} ${g.tipY} L ${g.baseLeftX} ${g.baseLeftY} L ${g.baseRightX} ${g.baseRightY} Z`;
    },

    arrowFill() {
      if (this.isPartOfSelection) return 'var(--color-secondary)';
      return this.strokeColor;
    },

    arrowOpacity() {
      if (this.isPartOfSelection) return 0.9;
      return this.opacity;
    }
  }
};
</script>

<style scoped>
.graph-tree-edge {
  pointer-events: none;
}

.edge-line {
  transition: all 0.2s ease;
}

.edge-highlighted .edge-line {
  opacity: 0.8;
}

.edge-hovered .edge-line {
  opacity: 0.7;
}

.edge-highlight {
  animation: edge-pulse 2s infinite;
}

.edge-arrow {
  /* Arrow sits behind nodes; geometry places the tip outside the target circle. */
}

@keyframes edge-pulse {
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 0.5;
  }
}

/* CSS Custom Properties */
:root {
  --color-secondary: #4a90e2;
}
</style>
