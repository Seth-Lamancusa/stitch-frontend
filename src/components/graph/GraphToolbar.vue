<template>
  <div class="graph-toolbar" :class="{ 'toolbar-expanded': expanded }">
    <!-- Main toolbar strip -->
    <div class="toolbar-main">
      <!-- Zoom controls group -->
      <div class="control-group">
        <span class="group-label">Zoom</span>
        <div class="button-group">
          <button
            @click="$emit('zoom-out')"
            :disabled="scale <= minScale"
            class="toolbar-button"
            title="Zoom out (-)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"/>
            </svg>
          </button>
          
          <div class="zoom-display">{{ Math.round(scale * 100) }}%</div>
          
          <button
            @click="$emit('zoom-in')"
            :disabled="scale >= maxScale"
            class="toolbar-button"
            title="Zoom in (+)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
            </svg>
          </button>
          
          <button
            @click="$emit('fit-to-content')"
            class="toolbar-button"
            title="Fit to screen (Space)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1h-4zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zM.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5zm15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5z"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Selection controls -->
      <div class="control-group" v-if="selectionCount > 0">
        <span class="group-label">Selection</span>
        <div class="selection-info">
          <span class="selection-count">{{ selectionCount }}</span>
          <button
            @click="$emit('clear-selection')"
            class="toolbar-button secondary"
            title="Clear selection (Escape)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Filter toggle -->
      <div class="control-group">
        <button
          @click="toggleFilters"
          class="toolbar-button filter-toggle"
          :class="{ 'active': showingFilters }"
          title="Toggle filters">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/>
          </svg>
          Filters
        </button>
      </div>

      <!-- Expand/collapse toggle -->
      <div class="control-group">
        <button
          @click="toggleExpanded"
          class="toolbar-button expand-toggle"
          :title="expanded ? 'Collapse toolbar' : 'Expand toolbar'">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path v-if="!expanded" d="M3.5 6.5A.5.5 0 0 1 4 7v1a.5.5 0 0 1-1 0V7.5H1.5a.5.5 0 0 1 0-1H3V5.5a.5.5 0 0 1 1 0V6.5z M9.5 6.5A.5.5 0 0 1 10 7v1a.5.5 0 0 1-1 0V7.5H7.5a.5.5 0 0 1 0-1H9V5.5a.5.5 0 0 1 1 0V6.5z"/>
            <path v-else d="M4 8a.5.5 0 0 1-.5-.5V6.5a.5.5 0 0 1 1 0V7h1.5a.5.5 0 0 1 0 1H4z M10 8a.5.5 0 0 1-.5-.5V6.5a.5.5 0 0 1 1 0V7h1.5a.5.5 0 0 1 0 1H10z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Expanded controls -->
    <div v-if="expanded" class="toolbar-expanded-content">
      <!-- Filter controls -->
      <div v-if="showingFilters" class="filter-panel">
        <div class="filter-section">
          <h4 class="section-title">Message Filters</h4>
          <div class="filter-row">
            <label class="filter-checkbox">
              <input
                type="checkbox"
                :checked="filters.showUnreadOnly"
                @change="updateFilter('showUnreadOnly', $event.target.checked)">
              <span class="checkmark"></span>
              Show unread only
            </label>
            
            <label class="filter-checkbox">
              <input
                type="checkbox"
                :checked="filters.showPublicOnly"
                @change="updateFilter('showPublicOnly', $event.target.checked)">
              <span class="checkmark"></span>
              Public messages only
            </label>
          </div>
          
          <div class="filter-row">
            <div class="search-box">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="search-icon">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
              </svg>
              <input
                type="text"
                placeholder="Search messages..."
                :value="filters.searchQuery"
                @input="updateFilter('searchQuery', $event.target.value)"
                class="search-input">
              <button
                v-if="filters.searchQuery"
                @click="updateFilter('searchQuery', '')"
                class="clear-search">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="filter-actions">
            <button
              @click="clearAllFilters"
              class="toolbar-button secondary small">
              Clear All
            </button>
          </div>
        </div>
      </div>

      <!-- Layout controls -->
      <div class="layout-panel">
        <div class="layout-section">
          <h4 class="section-title">Layout</h4>
          <div class="layout-controls">
            <label class="control-label">
              Node Spacing
              <input
                type="range"
                min="40"
                max="120"
                :value="layoutOptions.nodeSpacing"
                @input="updateLayoutOption('nodeSpacing', parseInt($event.target.value))"
                class="range-slider">
              <span class="range-value">{{ layoutOptions.nodeSpacing }}px</span>
            </label>
            
            <label class="control-label">
              Layer Height
              <input
                type="range"
                min="60"
                max="150"
                :value="layoutOptions.layerHeight"
                @input="updateLayoutOption('layerHeight', parseInt($event.target.value))"
                class="range-slider">
              <span class="range-value">{{ layoutOptions.layerHeight }}px</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GraphToolbar',
  props: {
    scale: {
      type: Number,
      default: 1
    },
    minScale: {
      type: Number,
      default: 0.1
    },
    maxScale: {
      type: Number,
      default: 4
    },
    selectionCount: {
      type: Number,
      default: 0
    },
    filters: {
      type: Object,
      default: () => ({
        showUnreadOnly: false,
        showPublicOnly: false,
        searchQuery: ''
      })
    },
    layoutOptions: {
      type: Object,
      default: () => ({
        nodeSpacing: 60,
        layerHeight: 100
      })
    }
  },
  
  data() {
    return {
      expanded: false,
      showingFilters: false
    };
  },
  
  emits: [
    'zoom-in',
    'zoom-out', 
    'fit-to-content',
    'clear-selection',
    'update-filter',
    'clear-filters',
    'update-layout-option'
  ],
  
  methods: {
    toggleExpanded() {
      this.expanded = !this.expanded;
    },
    
    toggleFilters() {
      this.showingFilters = !this.showingFilters;
      if (this.showingFilters && !this.expanded) {
        this.expanded = true;
      }
    },
    
    updateFilter(key, value) {
      this.$emit('update-filter', { key, value });
    },
    
    clearAllFilters() {
      this.$emit('clear-filters');
    },
    
    updateLayoutOption(key, value) {
      this.$emit('update-layout-option', { key, value });
    }
  }
};
</script>

<style scoped>
.graph-toolbar {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--color-card-shadow);
  z-index: 10;
  min-width: 300px;
  transition: all var(--transition-normal);
}

.toolbar-main {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.group-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-weight: 500;
  margin-right: var(--space-xs);
}

.button-group {
  display: flex;
  align-items: center;
  background: var(--color-surface-light);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.toolbar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  min-width: 32px;
  height: 32px;
  padding: 0 var(--space-xs);
  background: transparent;
  border: none;
  color: var(--color-text);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: var(--font-size-sm);
}

.toolbar-button:hover:not(:disabled) {
  background: var(--color-hover-overlay);
}

.toolbar-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toolbar-button.secondary {
  color: var(--color-text-secondary);
}

.toolbar-button.active,
.toolbar-button.filter-toggle.active {
  background: var(--color-secondary);
  color: var(--color-text-inverse);
}

.toolbar-button.small {
  height: 24px;
  font-size: var(--font-size-xs);
  padding: 0 var(--space-xs);
}

.zoom-display {
  padding: 0 var(--space-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: 500;
  min-width: 45px;
  text-align: center;
}

.selection-info {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  background: var(--color-surface-light);
  padding: var(--space-xs);
  border-radius: var(--radius-sm);
}

.selection-count {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-secondary);
}

.selection-count::after {
  content: ' selected';
  color: var(--color-text-secondary);
  font-weight: normal;
}

.toolbar-expanded-content {
  border-top: 1px solid var(--color-border);
  padding: var(--space-md);
  background: var(--color-surface-dark);
}

.filter-panel,
.layout-panel {
  margin-bottom: var(--space-md);
}

.filter-panel:last-child,
.layout-panel:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--space-sm);
}

.filter-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-sm);
  flex-wrap: wrap;
}

.filter-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.filter-checkbox input[type="checkbox"] {
  appearance: none;
  width: 16px;
  height: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-light);
  cursor: pointer;
  position: relative;
  transition: all var(--transition-fast);
}

.filter-checkbox input[type="checkbox"]:checked {
  background: var(--color-secondary);
  border-color: var(--color-secondary);
}

.filter-checkbox input[type="checkbox"]:checked::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 10px;
  font-weight: bold;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  min-width: 200px;
}

.search-icon {
  position: absolute;
  left: var(--space-xs);
  color: var(--color-text-secondary);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: var(--space-xs) var(--space-xl) var(--space-xs) 32px;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.search-input::placeholder {
  color: var(--color-text-disabled);
}

.search-input:focus {
  outline: none;
}

.clear-search {
  position: absolute;
  right: var(--space-xs);
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 2px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.clear-search:hover {
  background: var(--color-hover-overlay);
}

.filter-actions {
  display: flex;
  gap: var(--space-xs);
  margin-top: var(--space-sm);
}

.layout-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.control-label {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.range-slider {
  appearance: none;
  width: 150px;
  height: 4px;
  background: var(--color-surface-light);
  border-radius: var(--radius-sm);
  outline: none;
  cursor: pointer;
}

.range-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: var(--color-secondary);
  border-radius: 50%;
  cursor: pointer;
}

.range-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: var(--color-secondary);
  border-radius: 50%;
  border: none;
  cursor: pointer;
}

.range-value {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  text-align: right;
}

/* Responsive design */
@media (max-width: 768px) {
  .graph-toolbar {
    position: relative;
    top: 0;
    right: 0;
    margin: var(--space-sm);
    min-width: auto;
    width: calc(100% - 2 * var(--space-sm));
  }
  
  .toolbar-main {
    justify-content: space-between;
  }
  
  .filter-row {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-sm);
  }
  
  .search-box {
    min-width: auto;
  }
  
  .layout-controls {
    gap: var(--space-sm);
  }
  
  .range-slider {
    width: 100%;
  }
}
</style> 