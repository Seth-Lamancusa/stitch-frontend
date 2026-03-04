<template>
  <g 
    class="graph-tree-node" 
    :class="nodeClasses"
    :transform="`translate(${position.x}, ${position.y})`"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- Node circle (matplotlib-style) -->
    <circle
      :r="nodeRadius"
      :fill="fillColor"
      :stroke="strokeColor"
      :stroke-width="strokeWidth"
      class="node-circle"
    />
    
    <!-- Unread indicator dot -->
    <circle
      v-if="isUnread"
      :cx="nodeRadius * 0.6"
      :cy="-nodeRadius * 0.6"
      :r="4"
      fill="var(--color-warning)"
      class="unread-dot"
    />
    
    <!-- Saved indicator (bottom-right of node) -->
    <text
      v-if="isSaved && zoomLevel >= 0.3"
      :x="nodeRadius + 6"
      :y="nodeRadius + 6"
      text-anchor="middle"
      dominant-baseline="central"
      class="saved-indicator"
      font-size="10"
    >🔖</text>
    
    <!-- Author initial or icon -->
    <text
      v-if="showLabel && zoomLevel >= 0.5"
      y="4"
      text-anchor="middle"
      dominant-baseline="central"
      class="node-label"
      :fill="labelColor"
      :font-size="labelFontSize"
    >
      {{ authorInitial }}
    </text>
    
    <!-- Tooltip-style content on hover (only if not hovering load button) -->
    <g v-if="isHovered && !isLoadButtonHovered && zoomLevel >= 0.3" class="node-tooltip">
      <rect
        :x="-tooltipWidth / 2"
        :y="nodeRadius + 8"
        :width="tooltipWidth"
        :height="tooltipHeight"
        :rx="4"
        fill="var(--color-surface)"
        stroke="var(--color-border)"
        stroke-width="1"
        class="tooltip-background"
      />
      <foreignObject
        :x="-tooltipWidth / 2 + 8"
        :y="nodeRadius + 12"
        :width="tooltipWidth - 16"
        :height="tooltipHeight - 8"
      >
        <div xmlns="http://www.w3.org/1999/xhtml" class="tooltip-content">
          <div class="tooltip-author">{{ authorDisplay }}</div>
          <div class="tooltip-timestamp">{{ formattedTimestamp }}</div>
          <div class="tooltip-preview">{{ truncatedContent }}</div>
        </div>
      </foreignObject>
    </g>

    <!-- Manual load controls -->
    <!-- Load parent button (top) -->
    <g
      v-if="canLoadParent"
      class="load-button load-parent"
      @click.stop="emitLoadParent"
      @mouseenter.stop="handleLoadButtonEnter"
      @mouseleave.stop="handleLoadButtonLeave"
    >
      <circle
        :cy="-nodeRadius - 12"
        r="8"
        fill="var(--color-secondary)"
        opacity="0.9"
      />
      <text
        :y="-nodeRadius - 8"
        text-anchor="middle"
        fill="white"
        font-size="12"
        font-weight="bold"
      >↑</text>
    </g>

    <!-- Load children button (bottom) -->
    <g
      v-if="canLoadChildren"
      class="load-button load-children"
      @click.stop="emitLoadChildren"
      @mouseenter.stop="handleLoadButtonEnter"
      @mouseleave.stop="handleLoadButtonLeave"
    >
      <circle
        :cy="nodeRadius + 12"
        r="8"
        fill="var(--color-secondary)"
        opacity="0.9"
      />
      <text
        :y="nodeRadius + 16"
        text-anchor="middle"
        fill="white"
        font-size="12"
        font-weight="bold"
      >↓</text>
    </g>
  </g>
</template>

<script>
import { format } from 'date-fns';

export default {
  name: 'GraphTreeNode',
  props: {
    message: {
      type: Object,
      required: true
    },
    position: {
      type: Object,
      required: true
    },
    isSelected: {
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

  emits: ['click', 'mouseenter', 'mouseleave', 'load-more-up', 'load-more-down'],

  data() {
    return {
      showLabel: true,
      tooltipWidth: 200,
      tooltipHeight: 80,
      isLoadButtonHovered: false
    };
  },

  computed: {
    nodeClasses() {
      return {
        'node-selected': this.isSelected,
        'node-hovered': this.isHovered,
        'node-own': this.isOwnMessage,
        'node-root': this.isRootMessage,
        'node-public': this.message.public
      };
    },

    nodeRadius() {
      // Base radius, slightly larger for root
      const base = this.isRootMessage ? 24 : 20;
      return base;
    },

    // Get author ID for color mapping
    authorId() {
      return this.message.content_author || this.message.author?.uid || this.message.author?.user_tag || this.authorDisplay || 'unknown';
    },

    // Colors based on author - each sender gets a distinct color
    fillColor() {
      if (this.isSelected) {
        return 'var(--color-secondary)';
      }
      return this.getAuthorColor(this.authorId, true);
    },

    strokeColor() {
      if (this.isSelected) {
        return 'var(--color-secondary)';
      }
      return this.getAuthorColor(this.authorId, false);
    },

    strokeWidth() {
      if (this.isSelected) {
        return 3;
      }
      if (this.isHovered) {
        return 2.5;
      }
      return 2;
    },

    labelColor() {
      // Dark text for contrast on light backgrounds
      return '#1a202c';
    },

    labelFontSize() {
      return this.isRootMessage ? 14 : 12;
    },

    authorInitial() {
      const name = this.authorDisplay;
      return name ? name.charAt(0).toUpperCase() : '?';
    },

    authorDisplay() {
      if (this.message.author?.display_name) return this.message.author.display_name;
      return this.message.author_display_name || this.message.author?.username || this.message.author?.email || 'Unknown';
    },

    formattedTimestamp() {
      try {
        const date = new Date(this.message.timestamp);
        return format(date, 'MMM d, HH:mm');
      } catch {
        return '';
      }
    },

    truncatedContent() {
      const content = (this.message.content || '').replace(/\s+/g, ' ').trim();
      const limit = 60;
      if (content.length <= limit) return content;
      return content.substring(0, limit) + '...';
    },

    isOwnMessage() {
      const currentUserId = this.$store?.getters['auth/user']?.uid;
      const authorId = this.message.content_author || this.message.author?.uid;
      return currentUserId && authorId && currentUserId === authorId;
    },

    isUnread() {
      if (this.message.is_read !== undefined && this.message.is_read !== null) {
        return this.message.is_read === false;
      }
      const currentUserId = this.$store?.getters['auth/user']?.uid;
      if (this.message.read_status && currentUserId) {
        return this.message.read_status[currentUserId] === false || 
               this.message.read_status[currentUserId] === undefined;
      }
      return false;
    },

    isSaved() {
      return this.message.is_saved === true;
    },

    isRootMessage() {
      return !this.message.parent_id;
    },

    canLoadParent() {
      if (!this.message.parent_id) return false;
      const parentLoaded = !!this.$store.getters['messages/getMessage'](this.message.parent_id);
      return !parentLoaded;
    },

    canLoadChildren() {
      const childIds = this.message.child_ids || [];
      if (!childIds.length) return false;
      return childIds.some(id => !this.$store.getters['messages/getMessage'](id));
    }
  },

  methods: {
    // Generate a consistent color for an author ID
    getAuthorColor(authorId, isFill) {
      // Special color for current user (keep green)
      if (this.isOwnMessage) {
        return isFill ? '#90EE90' : '#228B22'; // lightgreen / green
      }

      // Palette of distinct colors (light pastels for fill, darker for stroke)
      const colorPalette = [
        { fill: '#FFB6C1', stroke: '#DC143C' }, // Light Pink / Crimson
        { fill: '#ADD8E6', stroke: '#4169E1' }, // Light Blue / Royal Blue
        { fill: '#DDA0DD', stroke: '#9370DB' }, // Plum / Medium Purple
        { fill: '#F0E68C', stroke: '#DAA520' }, // Khaki / Goldenrod
        { fill: '#98D8C8', stroke: '#20B2AA' }, // Pale Turquoise / Light Sea Green
        { fill: '#FFA07A', stroke: '#FF6347' }, // Light Salmon / Tomato
        { fill: '#87CEEB', stroke: '#4682B4' }, // Sky Blue / Steel Blue
        { fill: '#D3D3D3', stroke: '#696969' }, // Light Gray / Dim Gray
        { fill: '#F5DEB3', stroke: '#CD853F' }, // Wheat / Peru
        { fill: '#B0E0E6', stroke: '#5F9EA0' }, // Powder Blue / Cadet Blue
        { fill: '#FFDAB9', stroke: '#FF8C00' }, // Peach Puff / Dark Orange
        { fill: '#E6E6FA', stroke: '#9370DB' }, // Lavender / Medium Purple
        { fill: '#FFF8DC', stroke: '#DAA520' }, // Cornsilk / Goldenrod
        { fill: '#F0F8FF', stroke: '#4682B4' }, // Alice Blue / Steel Blue
        { fill: '#FFE4E1', stroke: '#DC143C' }, // Misty Rose / Crimson
      ];

      // Simple hash function to consistently map author ID to a color
      let hash = 0;
      const str = String(authorId);
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }

      // Use absolute value and modulo to get index
      const index = Math.abs(hash) % colorPalette.length;
      const color = colorPalette[index];

      return isFill ? color.fill : color.stroke;
    },

    handleClick(event) {
      this.$emit('click', {
        message: this.message,
        event,
        multiSelect: event.ctrlKey || event.metaKey
      });
    },

    handleMouseEnter(event) {
      this.$emit('mouseenter', {
        message: this.message,
        event
      });
    },

    handleMouseLeave(event) {
      this.$emit('mouseleave', {
        message: this.message,
        event
      });
    },

    emitLoadParent() {
      this.$emit('load-more-up', { message: this.message });
    },

    emitLoadChildren() {
      this.$emit('load-more-down', { message: this.message });
    },
    
    handleLoadButtonEnter() {
      this.isLoadButtonHovered = true;
    },
    
    handleLoadButtonLeave() {
      this.isLoadButtonHovered = false;
    }
  }
};
</script>

<style scoped>
.graph-tree-node {
  cursor: pointer;
}

.node-selected .node-circle {
  filter: drop-shadow(0 0 6px var(--color-secondary));
}

.node-label {
  font-weight: 600;
  pointer-events: none;
  user-select: none;
}

.saved-indicator {
  pointer-events: none;
  user-select: none;
}

.unread-dot {
  animation: pulse 2s infinite;
}

.node-tooltip {
  pointer-events: none;
  opacity: 0.95;
  /* Ensure tooltip renders on top */
  z-index: 1000;
}

.tooltip-content {
  font-size: 11px;
  color: var(--color-text);
  line-height: 1.3;
}

.tooltip-author {
  font-weight: 600;
  margin-bottom: 2px;
  color: var(--color-text);
}

.tooltip-timestamp {
  font-size: 10px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.tooltip-preview {
  color: var(--color-text-secondary);
  word-break: break-word;
}

.load-button {
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.2s ease;
}

.load-button:hover {
  opacity: 1;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

/* CSS Custom Properties */
:root {
  --color-secondary: #4a90e2;
  --color-surface: #1e1e1e;
  --color-border: #333333;
  --color-text: #e0e0e0;
  --color-text-secondary: #aaaaaa;
  --color-warning: #ff9800;
}
</style>
