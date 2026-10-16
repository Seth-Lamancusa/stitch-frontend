<template>
  <g 
    class="graph-node" 
    :class="nodeClasses"
    :transform="`translate(${position.x - nodeWidth/2}, ${position.y - nodeHeight/2})`"
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
    
    
    
    <!-- Content based on zoom level -->
    <g v-if="showContent" class="node-content">
      <!-- Header (author + timestamp + public badge) -->
      <foreignObject :x="contentPadding" :y="contentPadding - 2" :width="nodeWidth - (contentPadding*2)" height="24">
        <div xmlns="http://www.w3.org/1999/xhtml" class="gnode-header">
          <div class="author-info">
            <span class="message-author" :class="{ 'current-user-name': isOwnMessage }">{{ authorDisplay }}</span>
            <span v-if="authorTag" class="author-user-tag">@{{ authorTag }}</span>
            <span v-if="message.public" class="visibility-indicator public">Public</span>
          </div>
          <div class="header-right">
            <span class="message-timestamp">{{ formattedTimestamp }}</span>
          </div>
        </div>
      </foreignObject>
      
      <!-- Message preview -->
      <foreignObject
        v-if="showPreview"
        :x="contentPadding"
        :y="contentPadding + 36"
        :width="nodeWidth - (contentPadding*2)"
        :height="contentAreaHeight"
      >
        <div xmlns="http://www.w3.org/1999/xhtml" class="preview-container" :class="{ expanded: isExpanded }">
          <div class="preview-text" v-text="truncatedContent"></div>
        </div>
      </foreignObject>
      
      
    </g>
    
    

    <!-- Manual load controls -->
    <!-- Load parent button (top center) -->
    <g
      v-if="canLoadParent"
      class="load-button load-parent"
      @click.stop="emitLoadParent"
    >
      <rect :x="(nodeWidth/2) - 8" y="-18" width="16" height="16" rx="3" ry="3" fill="var(--color-primary)" opacity="0.9" />
      <path d="M8 3 L8 13 M3 8 L13 8" stroke="white" stroke-width="2" stroke-linecap="round" transform="translate(0,-18) translate((nodeWidth/2)-8,0)"/>
    </g>

    <!-- Load children button (bottom center) -->
    <g
      v-if="canLoadChildren"
      class="load-button load-children"
      @click.stop="emitLoadChildren"
    >
      <rect :x="(nodeWidth/2) - 8" :y="nodeHeight + 2" width="16" height="16" rx="3" ry="3" fill="var(--color-primary)" opacity="0.9" />
      <path d="M3 8 L13 8" stroke="white" stroke-width="2" stroke-linecap="round" :transform="`translate(0, ${nodeHeight + 2}) translate(${(nodeWidth/2)-8}, 0)`"/>
    </g>

    <!-- Stitch parent button (left) -->
    <g
      v-if="canLoadStitchParent"
      class="load-button load-stitch-parent"
      @click.stop="emitLoadStitchParent"
    >
      <circle :cx="-10" :cy="nodeHeight/2" r="8" fill="var(--color-primary)" opacity="0.9" />
      <text
        x="-10"
        :y="nodeHeight/2 + 4"
        text-anchor="middle"
        dominant-baseline="central"
        fill="white"
        font-size="12"
        font-weight="bold"
      >←</text>
    </g>

    <!-- Stitch children button (right) -->
    <g
      v-if="canLoadStitchChild"
      class="load-button load-stitch-child"
      @click.stop="emitLoadStitchChild"
    >
      <circle :cx="nodeWidth + 10" :cy="nodeHeight/2" r="8" fill="var(--color-primary)" opacity="0.9" />
      <text
        :x="nodeWidth + 10"
        :y="nodeHeight/2 + 4"
        text-anchor="middle"
        dominant-baseline="central"
        fill="white"
        font-size="12"
        font-weight="bold"
      >→</text>
    </g>
  </g>
</template>

<script>
import { format } from 'date-fns';
import { contentText, getAuthorDisplayName, getAuthorUserTag, isCurrentUserAuthor } from '../../utils/messageCompat.js';

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
  
  data() {
    return {
    };
  },
  
  emits: ['click', 'mouseenter', 'mouseleave', 'load-more-up', 'load-more-down', 'load-stitch-in', 'load-stitch-out'],
  
  computed: {
    nodeClasses() {
      return {
        'node-hovered': this.isHovered,
        'node-public': this.message.public,
        'node-private': !this.message.public,
        'node-root': this.isRootMessage,
        'node-simplified': this.zoomLevel < 0.5
      };
    },
    
    contentPadding() {
      return 16; // align with MessageNode var(--space-xl) feel
    },
    
    nodeWidth() {
      // Fixed width for simplicity and consistency (50px wider)
      return 480;
    },
    
    contentAreaHeight() {
      // Ensure a couple of extra pixels to avoid clipping last line
      const innerWidth = this.nodeWidth - (this.contentPadding * 2);
      const text = this.truncatedContent;
      const charsPerLine = Math.max(20, Math.floor(innerWidth / 7));
      const lines = Math.ceil(text.length / charsPerLine);
      const base = Math.max(42, lines * 18);
      return this.isExpanded ? Math.max(base, 48) : Math.min(base, 64);
    },
    
    nodeHeight() {
      let height = this.contentPadding + 24; // header
      height += this.contentAreaHeight; // preview/body
      height += this.contentPadding; // bottom padding
      return height;
    },
    
    borderRadius() {
      return 8;
    },
    
    backgroundColor() {
      return 'var(--color-surface)';
    },
    
    borderColor() {
      if (this.message.public) {
        return 'var(--color-border)';
      }
      return 'var(--color-border)';
    },
    
    borderWidth() {
      return 1;
    },
    
    nodeColor() {
      return 'var(--color-primary)';
    },
    
    // Content visibility based on zoom
    showContent() {
      return true;
    },
    
    showAuthor() {
      return true;
    },
    
    showTimestamp() {
      return true;
    },
    
    showPreview() {
      return true;
    },
    
    showVisibility() {
      return true;
    },
    
    // Font sizes based on zoom
    authorFontSize() { return 12 * this.zoomLevel; },
    timestampFontSize() { return 11 * this.zoomLevel; },
    previewFontSize() { return 12 * this.zoomLevel; },
    metadataFontSize() { return 10 * this.zoomLevel; },
    
    // Content calculations
    authorName() {
      const importDisplay = this.message.import_info?.display_name;
      if (importDisplay) return importDisplay;
      const display = getAuthorDisplayName(this.message);
      const tag = getAuthorUserTag(this.message);
      if (display !== 'Unknown') {
        return tag ? `${display} (@${tag})` : display;
      }
      const fallback = this.message.author?.username || this.message.author?.email || 'Unknown';
      return tag ? `${fallback} (@${tag})` : fallback;
    },
    authorDisplay() {
      const importDisplay = this.message.import_info?.display_name;
      if (importDisplay) return importDisplay;
      const display = getAuthorDisplayName(this.message);
      if (display !== 'Unknown') return display;
      return this.message.author?.username || this.message.author?.email || display;
    },
    authorTag() {
      if (this.message.import_info?.display_name) return null;
      return getAuthorUserTag(this.message);
    },
    
    formattedTimestamp() {
      try {
        const date = new Date(this.message.timestamp);
        return format(date, 'PPpp');
      } catch (error) {
        return '';
      }
    },
    
    rawContent() {
      return contentText(this.message.content).replace(/\s+/g, ' ').trim();
    },
    truncatedContent() {
      const limit = 250;
      if (this.rawContent.length <= limit) return this.rawContent;
      return this.rawContent.substring(0, limit) + '...';
    },
    fullContentHeight() {
      // Rough estimate: lines based on width and characters per line
      const innerWidth = this.nodeWidth - (this.contentPadding * 2);
      const charsPerLine = Math.max(20, Math.floor(innerWidth / 7));
      const lines = Math.ceil(this.rawContent.length / charsPerLine);
      return Math.min(600, Math.max(42, lines * 16));
    },
    
    isOwnMessage() {
      if (this.message.import_info?.display_name) return false;
      return isCurrentUserAuthor(this.message, this.$store?.getters['auth/user']);
    },
    
    isUnread() {
      // Prefer normalized is_read flag from store
      if (this.message.is_read !== undefined && this.message.is_read !== null) {
        return this.message.is_read === false;
      }
      // Fallback to legacy read_status map
      const currentUserId = this.$store?.getters['auth/user']?.uid;
      if (this.message.read_status && currentUserId) {
        return this.message.read_status[currentUserId] === false || this.message.read_status[currentUserId] === undefined;
      }
      return false;
    },
    
    isRootMessage() {
      return !this.message.parent_id;
    },

    // Manual load availability
    canLoadParent() {
      if (!this.message.parent_id) return false;
      const parentLoaded = !!this.$store.getters['messages/getMessage'](this.message.parent_id);
      return !parentLoaded;
    },
    canLoadChildren() {
      const childIds = this.message.child_ids || [];
      if (!childIds.length) return false;
      // If any child id is not in store, allow loading
      return childIds.some(id => !this.$store.getters['messages/getMessage'](id));
    },

    // Stitch navigation controls (placeholders for future wiring)
    canLoadStitchParent() {
      const stitchParentIds = this.message.stitch_parent_ids || [];
      if (!stitchParentIds.length) return false;
      return stitchParentIds.some(id => !this.$store.getters['messages/getMessage'](id));
    },

    canLoadStitchChild() {
      const stitchChildIds = this.message.stitch_child_ids || [];
      if (!stitchChildIds.length) return false;
      return stitchChildIds.some(id => !this.$store.getters['messages/getMessage'](id));
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
    },
    toggleExpand() {
      this.isExpanded = !this.isExpanded;
    },
    emitLoadParent() {
      this.$emit('load-more-up', { message: this.message });
    },
    emitLoadChildren() {
      this.$emit('load-more-down', { message: this.message });
    },

    // Intentionally no implementation yet in the parent.
    emitLoadStitchParent() {
      this.$emit('load-stitch-in', { message: this.message });
    },

    // Intentionally no implementation yet in the parent.
    emitLoadStitchChild() {
      this.$emit('load-stitch-out', { message: this.message });
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
}

.preview-container {
  display: block;
  color: var(--color-text-primary);
  line-height: 1.3;
}

.preview-container .preview-text {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
}

.expand-button {
  margin-top: 6px;
  padding: 2px 6px;
  font-size: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: 4px;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.expand-button:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-border-hover);
}

.visibility-text {
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* MessageNode-aligned styles */
.gnode-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.message-author {
  font-weight: bold;
}

.message-author.current-user-name {
  font-weight: 800;
  color: var(--color-primary);
}

.author-user-tag {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.visibility-indicator {
  font-size: var(--font-size-xs);
  padding: 2px 6px;
  border-radius: var(--radius-pill);
  height: 20px;
  display: inline-flex;
  align-items: center;
}

.visibility-indicator.public {
  background-color: var(--color-success);
  color: var(--color-text-inverse);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.message-timestamp {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.gnode-body .preview-text {
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--color-text-primary);
}

.simplified-node {
  transition: all 0.2s ease;
}

.load-button {
  cursor: pointer;
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
