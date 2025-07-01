<template>
  <div 
    class="adaptive-marker"
    :class="[state, position, { visible: isVisible }]"
    ref="markerElement"
  >
    <!-- Waiting state - not yet scrolled into view -->
    <div v-if="state === 'waiting'" class="marker-content waiting-state">
      <div class="end-marker"></div>
      <span class="marker-text">{{ position === 'top' ? 'Scroll up for more' : 'Scroll down for more' }}</span>
    </div>
    
    <!-- Loading state -->
    <div v-else-if="state === 'loading'" class="marker-content loading-state">
      <span class="loading-spinner"></span>
      <span class="marker-text">{{ loadingText }}</span>
    </div>
    
    <!-- End of branch state -->
    <div v-else-if="state === 'end'" class="marker-content end-state">
      <div class="end-marker"></div>
      <span class="marker-text">{{ endText }}</span>
    </div>
    
    <!-- Error state -->
    <div v-else-if="state === 'error'" class="marker-content error-state">
      <span class="error-icon">⚠️</span>
      <span class="marker-text">{{ errorText }}</span>
      <button 
        @click="$emit('retry')" 
        class="retry-button"
      >
        Retry
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AdaptiveMarker',
  
  props: {
    // Required state for the marker
    state: {
      type: String,
      required: true,
      validator: value => ['waiting', 'loading', 'end', 'error'].includes(value)
    },
    
    // Position determines text content and styling
    position: {
      type: String,
      default: 'bottom',
      validator: value => ['top', 'bottom'].includes(value)
    },
    
    // Set to false to disable the IntersectionObserver
    active: {
      type: Boolean,
      default: true
    },
    
    // Custom text for error state
    errorText: {
      type: String,
      default: 'Failed to load content'
    },
    
    // Class name for custom styles
    className: {
      type: String,
      default: ''
    }
  },
  
  data() {
    return {
      isVisible: false,
      observer: null,
      hasEmittedLoad: false,
      initialLoadDelay: false
    };
  },
  
  computed: {
    loadingText() {
      if (this.position === 'top') {
        return 'Loading earlier messages...';
      } else if (this.className === 'inline-loading') {
        return 'Loading more...';
      } else {
        return 'Loading more messages...';
      }
    },
    
    endText() {
      if (this.position === 'top') {
        return 'Beginning of thread';
      } else {
        return 'End of thread';
      }
    }
  },
  
  mounted() {
    // Nothing to observe for end or error state
    if (this.state === 'end' || this.state === 'error') {
      this.isVisible = true;
      return;
    }
    
    // Set up the observer for waiting state
    if (this.active && this.state === 'waiting') {
      this.setupObserver();
    }
  },
  
  beforeUnmount() {
    // Clean up the observer
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  },
  
  watch: {
    // Update if state or active changes
    state(newState) {
      // Reset for new render cycle
      this.hasEmittedLoad = false;
      
      // Clean up old observer if exists
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      
      // Nothing to observe for end or error states
      if (newState === 'end' || newState === 'error') {
        this.isVisible = true;
        return;
      }
      
      // Set up observer for waiting state
      if (this.active && newState === 'waiting') {
        this.$nextTick(() => {
          this.setupObserver();
        });
      }
    },
    
    active(newValue) {
      // Clean up if becoming inactive
      if (!newValue && this.observer) {
        this.observer.disconnect();
        this.observer = null;
        return;
      }
      
      // Set up if becoming active and in waiting state
      if (newValue && this.state === 'waiting' && !this.observer) {
        this.setupObserver();
      }
    }
  },
  
  methods: {
    setupObserver() {
      // Only set up for waiting state
      if (this.state !== 'waiting' || !this.active) {
        return;
      }
      
      this.observer = new IntersectionObserver(entries => {
        const isIntersecting = entries[0].isIntersecting;
        
        if (isIntersecting) {
          this.isVisible = true;
          
          // Only emit load-more if we haven't already for this cycle
          // and we're still in waiting state
          if (!this.hasEmittedLoad && this.state === 'waiting') {
            this.hasEmittedLoad = true;
            this.$emit('load-more');
          }
        } else {
          this.isVisible = false;
        }
      }, {
        rootMargin: '200px', // Start loading a bit before scrolling into view
        threshold: 0.1
      });
      
      if (this.$refs.markerElement) {
        this.observer.observe(this.$refs.markerElement);
      }
    }
  }
}
</script>

<style scoped>
.adaptive-marker {
  padding: var(--space-md);
  text-align: center;
  opacity: 0.5;
  transition: opacity var(--transition-normal);
  border-radius: var(--radius-md);
  position: relative;
}

.adaptive-marker.visible {
  opacity: 1;
}

.marker-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
}

/* Loading state styling */
.loading-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s infinite linear;
}

/* End state styling */
.end-marker {
  width: 20px;
  height: 20px;
  position: relative;
}

.end-marker:before,
.end-marker:after {
  content: '';
  position: absolute;
  width: 100%;
  left: 0;
  border-top: 1px solid var(--color-text-secondary);
}

.end-marker:before {
  top: 45%;
}

.end-marker:after {
  top: 55%;
}

.marker-text {
  font-size: 0.9em;
  color: var(--color-text-secondary);
}

.error-icon {
  font-size: 1.2em;
}

.retry-button {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
  padding: var(--space-xxs) var(--space-xs);
  cursor: pointer;
  font-size: 0.8em;
}

.retry-button:hover {
  background-color: var(--color-primary-dark);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Dark theme styles are no longer needed as we're using CSS variables */
</style> 