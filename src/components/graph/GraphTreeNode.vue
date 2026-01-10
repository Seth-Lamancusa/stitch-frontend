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

    // Colors following matplotlib visualizer:
    // Light blue for others, light green for current user
    fillColor() {
      if (this.isOwnMessage) {
        return '#90EE90'; // lightgreen
      }
      return '#ADD8E6'; // lightblue
    },

    strokeColor() {
      if (this.isSelected) {
        return 'var(--color-secondary)';
      }
      if (this.isOwnMessage) {
        return '#228B22'; // green
      }
      return '#4169E1'; // blue
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
