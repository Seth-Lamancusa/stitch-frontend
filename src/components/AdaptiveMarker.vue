<template>
  <div 
    class="adaptive-marker"
    :class="[state, position, { visible: isVisible }]"
    ref="markerElement"
  >
    <!-- Loading state -->
    <div v-if="state === 'loading'" class="marker-content loading-state">
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
        v-if="showRetry"
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
    // State determines what type of marker to show
    state: {
      type: String,
      default: 'loading',
      validator: value => ['loading', 'end', 'error'].includes(value)
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
    
    // Whether to show retry button in error state
    showRetry: {
      type: Boolean,
      default: true
    },

    // Added for the new loadingText computation
    className: {
      type: String,
      default: ''
    }
  },
  
  data() {
    return {
      isVisible: false,
      observer: null
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
    this.setupObserver();
  },
  
  beforeUnmount() {
    if (this.observer) {
      this.observer.disconnect();
    }
  },
  
  methods: {
    setupObserver() {
      // Only set up the observer if in loading state
      if (this.state !== 'loading' || !this.active) {
        this.isVisible = true; // Always show end/error states
        return;
      }
      
      // Special handling for top loading markers - make them visible immediately
      if (this.position === 'top') {
        this.isVisible = true;
        // If we're in loading state and active, emit load-more after a delay
        if (this.state === 'loading' && this.active) {
          console.log(`AdaptiveMarker: Auto-loading more (${this.position}) - waiting 1.5s`);
          setTimeout(() => {
            console.log(`AdaptiveMarker: Executing delayed auto-load (${this.position})`);
            this.$emit('load-more');
          }, 1500); // 1.5 second delay
        }
        return;
      }
      
      this.observer = new IntersectionObserver(entries => {
        const isIntersecting = entries[0].isIntersecting;
        
        if (isIntersecting && this.active) {
          this.isVisible = true;
          // Only emit load-more event if in loading state
          if (this.state === 'loading') {
            console.log(`AdaptiveMarker: Loading more (${this.position}) - waiting 1.5s`);
            // Add delay before making the API call
            setTimeout(() => {
              console.log(`AdaptiveMarker: Executing delayed load (${this.position})`);
              this.$emit('load-more');
            }, 1500); // 1.5 second delay
          }
        } else {
          this.isVisible = false;
        }
      }, {
        rootMargin: '100px',
        threshold: 0.1
      });
      
      this.observer.observe(this.$refs.markerElement);
    }
  },
  
  watch: {
    // Update observer when state changes
    state(newState, oldState) {
      console.log(`AdaptiveMarker state changed: ${oldState} -> ${newState}`);
      
      if (this.observer) {
        this.observer.disconnect();
      }
      
      this.$nextTick(() => {
        this.setupObserver();
        
        // If state changes to 'end', ensure marker is visible
        if (newState === 'end') {
          this.isVisible = true;
        }
      });
    },
    
    // Update observer when active state changes
    active() {
      if (this.observer) {
        this.observer.disconnect();
      }
      
      this.$nextTick(() => {
        this.setupObserver();
      });
    }
  }
}
</script>

<style scoped>
.adaptive-marker {
  padding: 15px;
  text-align: center;
  opacity: 0.5;
  transition: opacity 0.3s ease;
  border-radius: 8px;
  position: relative;
}

.adaptive-marker.visible {
  opacity: 1;
}

.marker-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

/* Loading state styling */
.loading-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--primary-color, #007bff);
  border-radius: 50%;
  animation: spin 1s infinite linear;
}

/* End state styling */
.end-marker {
  width: 20px;
  height: 20px;
  position: relative;
}

.end-marker::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: var(--border-color, #ddd);
  transform: translateY(-50%);
}

/* Error state styling */
.error-icon {
  font-size: 20px;
}

.retry-button {
  background-color: var(--primary-color, #007bff);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 0.85em;
  cursor: pointer;
  margin-left: 8px;
}

.retry-button:hover {
  background-color: var(--primary-color-dark, #0056b3);
}

.marker-text {
  color: var(--text-color-light, #777);
  font-style: italic;
}

/* Position-specific styling */
.adaptive-marker.top .marker-content {
  border-bottom: 1px solid var(--border-color, #ddd);
  padding-bottom: 10px;
}

.adaptive-marker.bottom .marker-content {
  border-top: 1px solid var(--border-color, #ddd);
  padding-top: 10px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style> 