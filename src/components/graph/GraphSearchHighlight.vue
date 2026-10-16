<template>
  <g class="graph-search-highlight">
    <!-- Search result highlights -->
    <g v-for="messageId in highlightedMessageIds" :key="`highlight-${messageId}`">
      <g v-if="getNodePosition(messageId)" class="search-highlight-wrapper">
        <!-- Pulsing highlight circle -->
        <circle
          :cx="getNodePosition(messageId).x"
          :cy="getNodePosition(messageId).y"
          :r="highlightRadius"
          fill="none"
          :stroke="highlightColor"
          :stroke-width="highlightStrokeWidth"
          class="search-highlight-pulse"
          opacity="0.8"/>
        
        <!-- Static highlight circle -->
        <circle
          :cx="getNodePosition(messageId).x"
          :cy="getNodePosition(messageId).y"
          :r="highlightRadius - 5"
          fill="none"
          :stroke="highlightColor"
          :stroke-width="2"
          class="search-highlight-static"
          opacity="0.6"/>
        
        <!-- Search result indicator -->
        <text
          :x="getNodePosition(messageId).x + highlightRadius + 8"
          :y="getNodePosition(messageId).y - highlightRadius - 5"
          class="search-result-indicator"
          :fill="indicatorTextColor"
          font-size="12"
          font-weight="600">
          {{ getSearchResultIndex(messageId) }}
        </text>
      </g>
    </g>
    
    <!-- Current search focus highlight -->
    <g v-if="focusedMessageId && getNodePosition(focusedMessageId)" class="current-focus-highlight">
      <circle
        :cx="getNodePosition(focusedMessageId).x"
        :cy="getNodePosition(focusedMessageId).y"
        :r="focusHighlightRadius"
        fill="none"
        :stroke="focusHighlightColor"
        :stroke-width="focusStrokeWidth"
        class="focus-highlight-ring"
        opacity="0.9"/>
      
      <!-- Focus indicator arrow -->
      <g :transform="`translate(${getNodePosition(focusedMessageId).x}, ${getNodePosition(focusedMessageId).y - focusHighlightRadius - 15})`">
        <polygon
          points="-6,0 6,0 0,8"
          :fill="focusHighlightColor"
          class="focus-arrow"/>
      </g>
    </g>
    
    <!-- Search path highlighting -->
    <g v-if="showSearchPaths" class="search-paths">
      <g v-for="path in searchPaths" :key="`path-${path.id}`">
        <path
          :d="path.pathData"
          fill="none"
          :stroke="pathHighlightColor"
          :stroke-width="pathStrokeWidth"
          stroke-dasharray="5,3"
          class="search-path-highlight"
          opacity="0.7"/>
      </g>
    </g>
    
    <!-- Search result summary overlay -->
    <foreignObject
      v-if="showSummary && searchResults.length > 0"
      x="10"
      y="10"
      width="250"
      height="auto"
      class="search-summary-overlay">
      <div class="search-summary" xmlns="http://www.w3.org/1999/xhtml">
        <div class="summary-header">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="search-icon">
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
          </svg>
          <span class="search-count">{{ searchResults.length }} result{{ searchResults.length === 1 ? '' : 's' }}</span>
          <button @click="$emit('close-summary')" class="close-summary">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>
        
        <div class="summary-content" v-if="currentSearchResult">
          <div class="result-info">
            <span class="result-position">{{ currentSearchResultIndex + 1 }} / {{ searchResults.length }}</span>
            <span class="result-matches">{{ currentSearchResult.totalMatches }} match{{ currentSearchResult.totalMatches === 1 ? '' : 'es' }}</span>
          </div>
          
          <div class="result-preview">
            <span class="author-name">{{ getAuthorName(currentSearchResult.message) }}:</span>
            <span class="content-preview">{{ getContentPreview(currentSearchResult.message.content) }}</span>
          </div>
          
          <div class="navigation-hints">
            <span class="hint">↑↓ Navigate • Enter Select • Esc Clear</span>
          </div>
        </div>
      </div>
    </foreignObject>
  </g>
</template>

<script>
import { contentText, getAuthorDisplayName } from '../../utils/messageCompat.js';
export default {
  name: 'GraphSearchHighlight',
  props: {
    // Search results to highlight
    searchResults: {
      type: Array,
      default: () => []
    },
    
    // Currently focused message ID
    focusedMessageId: {
      type: String,
      default: null
    },
    
    // Node positions from layout
    nodePositions: {
      type: Map,
      default: () => new Map()
    },
    
    // Display options
    showSummary: {
      type: Boolean,
      default: true
    },
    
    showSearchPaths: {
      type: Boolean,
      default: false
    },
    
    // Visual customization
    highlightColor: {
      type: String,
      default: '#ff6b35'
    },
    
    focusHighlightColor: {
      type: String,
      default: '#4a90e2'
    },
    
    pathHighlightColor: {
      type: String,
      default: '#10a37f'
    }
  },
  
  data() {
    return {
      highlightRadius: 35,
      highlightStrokeWidth: 3,
      focusHighlightRadius: 40,
      focusStrokeWidth: 4,
      pathStrokeWidth: 3
    };
  },
  
  computed: {
    highlightedMessageIds() {
      return this.searchResults.map(result => result.messageId);
    },
    
    currentSearchResult() {
      if (!this.focusedMessageId) return null;
      return this.searchResults.find(result => result.messageId === this.focusedMessageId);
    },
    
    currentSearchResultIndex() {
      if (!this.currentSearchResult) return -1;
      return this.searchResults.indexOf(this.currentSearchResult);
    },
    
    // Theme-aware colors
    indicatorTextColor() {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-text-inverse').trim() || '#ffffff';
    },
    
    // Calculate connection paths between search results
    searchPaths() {
      if (!this.showSearchPaths || this.searchResults.length < 2) return [];
      
      const paths = [];
      
      for (let i = 0; i < this.searchResults.length - 1; i++) {
        const currentResult = this.searchResults[i];
        const nextResult = this.searchResults[i + 1];
        
        const currentPos = this.getNodePosition(currentResult.messageId);
        const nextPos = this.getNodePosition(nextResult.messageId);
        
        if (currentPos && nextPos) {
          paths.push({
            id: `${currentResult.messageId}-${nextResult.messageId}`,
            pathData: this.calculatePath(currentPos, nextPos)
          });
        }
      }
      
      return paths;
    }
  },
  
  emits: ['close-summary'],
  
  methods: {
    getNodePosition(messageId) {
      const position = this.nodePositions.get(messageId);
      if (!position) return null;
      
      // Return center point of node
      return {
        x: position.x,
        y: position.y
      };
    },
    
    getSearchResultIndex(messageId) {
      const index = this.searchResults.findIndex(result => result.messageId === messageId);
      return index >= 0 ? index + 1 : '';
    },
    
    calculatePath(start, end) {
      // Simple curved path between points
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const controlOffset = 30;
      
      return `M ${start.x} ${start.y} Q ${midX} ${midY - controlOffset} ${end.x} ${end.y}`;
    },
    
    getAuthorName(message) {
      if (message.import_info?.display_name) return message.import_info.display_name;
      const name = getAuthorDisplayName(message);
      if (name !== 'Unknown') return name;
      return message.author?.username || 'User';
    },
    
    getContentPreview(content) {
      const text = contentText(content);
      if (!text) return 'No content';
      const preview = text.replace(/\s+/g, ' ').trim();
      return preview.length > 60 ? preview.substring(0, 60) + '...' : preview;
    }
  }
};
</script>

<style scoped>
.graph-search-highlight {
  pointer-events: none;
}

.search-highlight-pulse {
  animation: search-pulse 2s infinite;
}

.search-highlight-static {
  opacity: 0.6;
}

.focus-highlight-ring {
  animation: focus-pulse 1.5s infinite;
}

.focus-arrow {
  animation: focus-bounce 1s infinite;
}

.search-path-highlight {
  animation: path-flow 3s infinite;
}

.search-result-indicator {
  text-anchor: middle;
  dominant-baseline: central;
  background: v-bind(highlightColor);
  border-radius: 50%;
  padding: 2px;
}

.search-summary-overlay {
  pointer-events: auto;
}

.search-summary {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--color-card-shadow);
  padding: var(--space-sm);
  font-family: var(--font-family-base);
  max-width: 250px;
}

.summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-xs);
}

.search-icon {
  color: var(--color-secondary);
  margin-right: var(--space-xs);
}

.search-count {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  flex: 1;
}

.close-summary {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 2px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.close-summary:hover {
  background: var(--color-hover-overlay);
  color: var(--color-text);
}

.summary-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.result-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.result-position {
  font-weight: 600;
  color: var(--color-secondary);
}

.result-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-xxs);
}

.author-name {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
}

.content-preview {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
  word-wrap: break-word;
}

.navigation-hints {
  padding-top: var(--space-xs);
  border-top: 1px solid var(--color-border);
}

.hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-disabled);
  font-style: italic;
}

/* Animations */
@keyframes search-pulse {
  0%, 100% {
    opacity: 0.4;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.1);
  }
}

@keyframes focus-pulse {
  0%, 100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

@keyframes focus-bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

@keyframes path-flow {
  0% {
    stroke-dashoffset: 0;
  }
  100% {
    stroke-dashoffset: 16;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .search-highlight-pulse,
  .focus-highlight-ring,
  .focus-arrow,
  .search-path-highlight {
    animation: none;
  }
  
  .search-highlight-pulse {
    opacity: 0.6;
  }
  
  .focus-highlight-ring {
    opacity: 0.9;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .search-summary {
    border-width: 2px;
  }
  
  .search-highlight-pulse,
  .focus-highlight-ring {
    stroke-width: 4px;
  }
}
</style> 
