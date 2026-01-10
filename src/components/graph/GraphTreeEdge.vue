<template>
  <g class="graph-tree-edge" :class="edgeClasses">
    <!-- Main edge line (matplotlib-style: simple straight line) -->
    <line
      :x1="sourcePosition.x"
      :y1="sourcePosition.y"
      :x2="targetPosition.x"
      :y2="targetPosition.y"
      :stroke="strokeColor"
      :stroke-width="strokeWidth"
      :opacity="opacity"
      class="edge-line"
    />
    
    <!-- Selection highlight -->
    <line
      v-if="isPartOfSelection"
      :x1="sourcePosition.x"
      :y1="sourcePosition.y"
      :x2="targetPosition.x"
      :y2="targetPosition.y"
      stroke="var(--color-secondary)"
      :stroke-width="strokeWidth + 2"
      opacity="0.4"
      class="edge-highlight"
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

    // Matplotlib uses 'k-' (black) with alpha=0.5
    strokeColor() {
      if (this.isPartOfSelection) {
        return 'var(--color-secondary)';
      }
      if (this.isHovered) {
        return '#555555';
      }
      return '#333333'; // Dark gray/black
    },

    strokeWidth() {
      if (this.isPartOfSelection) {
        return 2;
      }
      if (this.isHovered) {
        return 1.5;
      }
      return 1; // Thin lines like matplotlib linewidth=1
    },

    // Matplotlib uses alpha=0.5 for edges
    opacity() {
      if (this.isPartOfSelection) {
        return 0.8;
      }
      if (this.isHovered) {
        return 0.7;
      }
      return 0.5;
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
