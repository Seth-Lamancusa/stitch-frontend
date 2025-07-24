<template>
  <g 
    class="graph-node" 
    :class="nodeClasses"
    :transform="`translate(${position.x}, ${position.y})`"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- Node background -->
    <rect
      :width="nodeWidth"
      :height="nodeHeight"
      :rx="borderRadius"
      :ry="borderRadius"
      :fill="backgroundColor"
      :stroke="borderColor"
      :stroke-width="borderWidth"
      class="node-background"
    />
    
    <!-- Selection indicator -->
    <rect
      v-if="isSelected"
      :width="nodeWidth + 4"
      :height="nodeHeight + 4"
      :rx="borderRadius + 2"
      :ry="borderRadius + 2"
      x="-2"
      y="-2"
      fill="none"
      stroke="var(--color-primary)"
      stroke-width="2"
      class="selection-indicator"
    />
    
    <!-- Unread indicator -->
    <circle
      v-if="isUnread"
      :cx="nodeWidth - 8"
      cy="8"
      r="4"
      fill="var(--color-primary)"
      class="unread-indicator"
    />
    
    <!-- Content based on zoom level -->
    <g v-if="showContent" class="node-content">
      <!-- Author name -->
      <text
        v-if="showAuthor"
        x="8"
        y="16"
        class="author-text"
        :font-size="authorFontSize"
        fill="var(--color-text-primary)"
      >
        {{ authorName }}
      </text>
      
      <!-- Timestamp -->
      <text
        v-if="showTimestamp"
        :x="nodeWidth - 8"
        y="16"
        class="timestamp-text"
        :font-size="timestampFontSize"
        fill="var(--color-text-secondary)"
        text-anchor="end"
      >
        {{ formattedTimestamp }}
      </text>
      
      <!-- Message preview -->
      <text
        v-if="showPreview"
        x="8"
        y="32"
        class="preview-text"
        :font-size="previewFontSize"
        fill="var(--color-text-primary)"
      >
        {{ messagePreview }}
      </text>
      
      <!-- Public/Private indicator -->
      <text
        v-if="showVisibility"
        x="8"
        :y="nodeHeight - 8"
        class="visibility-text"
        :font-size="metadataFontSize"
        :fill="message.public ? 'var(--color-success)' : 'var(--color-warning)'"
      >
        {{ message.public ? 'Public' : 'Private' }}
      </text>
    </g>
    
    <!-- Simplified view for small zoom levels -->
    <circle
      v-else
      :cx="nodeWidth / 2"
      :cy="nodeHeight / 2"
      :r="Math.min(nodeWidth, nodeHeight) / 4"
      :fill="nodeColor"
      class="simplified-node"
    />
  </g>
</template>

<script>
import { format } from 'date-fns';

export default {
  name: 'GraphNode',
  props: {
    // Message data
    message: {
      type: Object,
      required: true
    },
    
    // Position from layout
    position: {
      type: Object,
      required: true
    },
    
    // Visual state
    isSelected: {
      type: Boolean,
      default: false
    },
    
    isHovered: {
      type: Boolean,
      default: false
    },
    
    // Zoom level for LOD
    zoomLevel: {
      type: Number,
      default: 1
    },
    
    // Display options
    maxContentWidth: {
      type: Number,
      default: 200
    }
  },
  
  emits: ['click', 'mouseenter', 'mouseleave'],
  
  computed: {
    nodeClasses() {
      return {
        'node-selected': this.isSelected,
        'node-hovered': this.isHovered,
        'node-own-message': this.isOwnMessage,
        'node-public': this.message.public,
        'node-private': !this.message.public,
        'node-unread': this.isUnread,
        'node-root': this.isRootMessage,
        'node-simplified': this.zoomLevel < 0.5
      };
    },
    
    nodeWidth() {
      if (this.zoomLevel < 0.5) return 20;
      
      const baseWidth = this.isRootMessage ? 140 : 120;
      const contentWidth = this.calculateContentWidth();
      
      return Math.min(Math.max(baseWidth, contentWidth + 16), this.maxContentWidth);
    },
    
    nodeHeight() {
      if (this.zoomLevel < 0.5) return 20;
      
      let height = this.isRootMessage ? 60 : 48;
      
      if (this.showPreview && this.zoomLevel > 1.5) {
        height += 16; // Extra height for preview text
      }
      
      return height;
    },
    
    borderRadius() {
      return this.zoomLevel < 0.5 ? 10 : 8;
    },
    
    backgroundColor() {
      if (this.isOwnMessage) {
        return 'var(--color-accent-light)';
      }
      return 'var(--color-surface-light)';
    },
    
    borderColor() {
      if (this.isSelected) {
        return 'var(--color-primary)';
      }
      if (this.isUnread) {
        return 'var(--color-primary)';
      }
      if (this.message.public) {
        return 'var(--color-border)';
      }
      return 'var(--color-border-dashed)';
    },
    
    borderWidth() {
      if (this.isSelected || this.isUnread) {
        return 2;
      }
      return 1;
    },
    
    nodeColor() {
      // Color for simplified view
      if (this.isOwnMessage) {
        return 'var(--color-accent)';
      }
      return 'var(--color-primary)';
    },
    
    // Content visibility based on zoom
    showContent() {
      return this.zoomLevel >= 0.5;
    },
    
    showAuthor() {
      return this.zoomLevel >= 0.5;
    },
    
    showTimestamp() {
      return this.zoomLevel >= 0.5;
    },
    
    showPreview() {
      return this.zoomLevel > 1.5;
    },
    
    showVisibility() {
      return this.zoomLevel > 2;
    },
    
    // Font sizes based on zoom
    authorFontSize() {
      return Math.max(10, 12 * this.zoomLevel);
    },
    
    timestampFontSize() {
      return Math.max(9, 10 * this.zoomLevel);
    },
    
    previewFontSize() {
      return Math.max(9, 11 * this.zoomLevel);
    },
    
    metadataFontSize() {
      return Math.max(8, 9 * this.zoomLevel);
    },
    
    // Content calculations
    authorName() {
      if (!this.message.author) return 'Unknown';
      return this.message.author.display_name || this.message.author.username || 'User';
    },
    
    formattedTimestamp() {
      try {
        const date = new Date(this.message.timestamp);
        if (this.zoomLevel > 2) {
          return format(date, 'MMM d, HH:mm');
        }
        return format(date, 'HH:mm');
      } catch (error) {
        return '';
      }
    },
    
    messagePreview() {
      if (!this.message.content) return '';
      
      const maxLength = this.zoomLevel > 2.5 ? 120 : 60;
      const content = this.message.content.replace(/\s+/g, ' ').trim();
      
      if (content.length <= maxLength) {
        return content;
      }
      
      return content.substring(0, maxLength - 3) + '...';
    },
    
    isOwnMessage() {
      // This should check against current user - placeholder for now
      return this.message.author && this.message.author.uid === 'current-user-id';
    },
    
    isUnread() {
      // Check if message is unread for current user
      return this.message.read_status && !this.message.read_status['current-user-id'];
    },
    
    isRootMessage() {
      return !this.message.parent_id;
    }
  },
  
  methods: {
    calculateContentWidth() {
      // Estimate content width based on text length
      const authorWidth = this.authorName.length * 7;
      const timestampWidth = this.formattedTimestamp.length * 6;
      const previewWidth = this.showPreview ? this.messagePreview.length * 6 : 0;
      
      return Math.max(authorWidth + timestampWidth + 20, previewWidth + 16);
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
    }
  }
};
</script>

<style scoped>
.graph-node {
  cursor: pointer;
  transition: all 0.2s ease;
}

.graph-node:hover {
  filter: brightness(1.05);
}

.node-background {
  transition: all 0.2s ease;
}

.node-selected .node-background {
  filter: drop-shadow(0 4px 8px rgba(59, 130, 246, 0.3));
}

.node-hovered .node-background {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.selection-indicator {
  animation: selection-pulse 1.5s infinite;
}

.unread-indicator {
  animation: unread-pulse 2s infinite;
}

.author-text {
  font-weight: 500;
  dominant-baseline: hanging;
}

.timestamp-text {
  font-weight: 400;
  dominant-baseline: hanging;
}

.preview-text {
  font-weight: 400;
  dominant-baseline: hanging;
}

.visibility-text {
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.simplified-node {
  transition: all 0.2s ease;
}

.node-private .node-background {
  stroke-dasharray: 4,2;
}

/* Animations */
@keyframes selection-pulse {
  0%, 100% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
}

@keyframes unread-pulse {
  0%, 100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

/* CSS Custom Properties */
:root {
  --color-text-primary: #1a202c;
  --color-text-secondary: #718096;
  --color-surface-light: #f7fafc;
  --color-accent-light: #ebf8ff;
  --color-accent: #3b82f6;
  --color-primary: #3b82f6;
  --color-border: #e2e8f0;
  --color-border-dashed: #cbd5e0;
  --color-success: #48bb78;
  --color-warning: #ed8936;
}
</style> 