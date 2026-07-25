<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  messages: { type: Array, required: true },
  currentIndex: { type: Number, default: 0 },
  messagePositions: { type: Array, default: () => [] }, // [{ id, top, height, width }]
  originMessageId: { type: [String, Number], default: null },
  scrollState: { type: Object, default: () => ({ top: 0, viewportHeight: 0, totalHeight: 0 }) },
  topState: { type: String, default: 'end' },
  bottomState: { type: String, default: 'end' },
  topStitchCount: { type: Number, default: 0 },
  bottomStitchCount: { type: Number, default: 0 }
});

const emit = defineEmits(['loadMoreTop', 'loadMoreBottom', 'loadStitchTop', 'loadStitchBottom', 'navigatorScrollDelta', 'navigatorJump']);

// THE FIXED GEOMETRIC RATIO
const RATIO = 0.056;
const PAD_VIEWPORT_HEIGHT = 300;
const MIN_TICK_HEIGHT = 4;

const hoveredIndex = ref(null);
const sensitivity = ref(localStorage.getItem('pad-sensitivity') || 0.4);

const saveSensitivity = () => {
  localStorage.setItem('pad-sensitivity', sensitivity.value);
};

const colorPalette = [
  { fill: '#4ade80' }, { fill: '#60a5fa' }, { fill: '#fb923c' }, { fill: '#c084fc' },
  { fill: '#2dd4bf' }, { fill: '#f472b6' }, { fill: '#fbbf24' }, { fill: '#818cf8' },
  { fill: '#a78bfa' }, { fill: '#475569' },
];

const getAuthorColor = (message) => {
  if (!message) return '#666';
  const authorId = message.import_info?.display_name || message.content_author || message.author?.uid || message.author?.user_tag || 'unknown';
  let hash = 0;
  const str = String(authorId);
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colorPalette[Math.abs(hash) % colorPalette.length].fill;
};

const getSnippet = (content) => {
  if (!content) return '';
  return content.length > 50 ? content.substring(0, 50) + '...' : content;
};

// TRACK POSITIONING
const trackTransform = computed(() => {
  const physicalScrollTopOnPad = props.scrollState.top * RATIO;
  const viewportCenterOnPad = (physicalScrollTopOnPad + (props.scrollState.viewportHeight * RATIO / 2));
  return `translateY(${ (PAD_VIEWPORT_HEIGHT / 2) - viewportCenterOnPad }px)`;
});

const focusBoxStyle = computed(() => ({
  top: `${props.scrollState.top * RATIO}px`,
  height: `${props.scrollState.viewportHeight * RATIO}px`
}));

// INTERACTION
const handleWheel = (e) => {
  const multiplier = e.deltaMode === 1 ? 40 : 1; 
  const delta = ((e.deltaY * multiplier) / RATIO) * parseFloat(sensitivity.value);
  emit('navigatorScrollDelta', delta);
};

const jumpToMessage = (msgId) => {
  emit('navigatorJump', msgId);
};

</script>

<template>
  <div class="branch-navigator desktop-only">
    <!-- Top Anchor -->
    <div 
      class="nav-anchor top" 
      :class="[topState, { hasStitch: topStitchCount > 0 }]"
      @click="topState === 'waiting' ? $emit('loadMoreTop') : (topStitchCount > 0 ? $emit('loadStitchTop') : null)"
    >
      <div class="anchor-content">
        <div v-if="topState === 'loading'" class="mini-spinner"></div>
        <template v-else>
          <div v-if="topStitchCount > 0" class="stitch-indicator">
            <span class="stitch-icon">🔗</span>
            <span class="stitch-count">{{ topStitchCount }}</span>
          </div>
          <div v-else-if="topState === 'waiting'" class="more-indicator">
            <span class="arrow">↑</span>
            <span class="label">Load More</span>
          </div>
          <div v-else class="end-dot"></div>
        </template>
      </div>
    </div>

    <!-- The Proportional Virtual Pad -->
    <div class="virtual-pad-wrapper" @wheel.prevent="handleWheel">
      <div class="counter-badge">{{ currentIndex + 1 }} / {{ messages.length }}</div>
      
      <div class="virtual-pad-viewport">
        <!-- Static Horizon Line (Centered, Non-moving) -->
        <div class="horizon-line"></div>

        <div class="virtual-pad-track" :style="{ transform: trackTransform }">
          <!-- Viewport Focus Box -->
          <div class="viewport-focus-box" :style="focusBoxStyle"></div>

          <!-- Physical Ticks -->
          <div 
            v-for="(pos, index) in messagePositions" 
            :key="pos.id"
            class="msg-tick"
            :class="{ 
              active: index === currentIndex, 
              origin: String(pos.id) === String(originMessageId)
            }"
            :style="{ 
              '--author-color': getAuthorColor(messages.find(m => String(m.id) === String(pos.id))), 
              top: (pos.top * RATIO) + 'px',
              height: Math.max(MIN_TICK_HEIGHT, pos.height * RATIO) + 'px',
              width: Math.max(35, Math.min(90, (pos.width / 1000) * 80)) + '%'
            }"
            @mouseenter="hoveredIndex = index"
            @mouseleave="hoveredIndex = null"
            @click.stop="jumpToMessage(pos.id)"
          >
            <!-- Hover Tooltip -->
            <div v-if="hoveredIndex === index" class="tick-tooltip">
              <span class="tooltip-author" :style="{ color: getAuthorColor(messages.find(m => String(m.id) === String(pos.id))) }">
                @{{ (messages.find(m => String(m.id) === String(pos.id)) || {}).author_user_tag || 'guest' }}
              </span>
              <span class="tooltip-snippet">{{ getSnippet((messages.find(m => String(m.id) === String(pos.id)) || {}).content) }}</span>
            </div>
            
            <div v-if="(messages.find(m => String(m.id) === String(pos.id)) || {}).files?.length > 0" class="media-radar-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </div>

            <div v-if="String(pos.id) === String(originMessageId)" class="origin-label">ORIGIN</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Anchor -->
    <div 
      class="nav-anchor bottom" 
      :class="[bottomState, { hasStitch: bottomStitchCount > 0 }]"
      @click="bottomState === 'waiting' ? $emit('loadMoreBottom') : (bottomStitchCount > 0 ? $emit('loadStitchBottom') : null)"
    >
      <div class="anchor-content">
        <div v-if="bottomState === 'loading'" class="mini-spinner"></div>
        <template v-else>
          <div v-if="bottomStitchCount > 0" class="stitch-indicator">
            <span class="stitch-icon">🔗</span>
            <span class="stitch-count">{{ bottomStitchCount }}</span>
          </div>
          <div v-else-if="bottomState === 'waiting'" class="more-indicator">
            <span class="arrow">↓</span>
            <span class="label">Load More</span>
          </div>
          <div v-else class="end-dot"></div>
        </template>
      </div>
    </div>

    <!-- Sensitivity Slider -->
    <div class="sensitivity-control">
      <span class="sens-label">Sensitivity</span>
      <input 
        type="range" 
        min="0.05" 
        max="1.5" 
        step="0.05" 
        v-model="sensitivity" 
        @change="saveSensitivity"
        title="Adjust Pad-to-List Gear Ratio"
      />
    </div>
  </div>
</template>

<style scoped>
.branch-navigator {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 268px;
  height: 418px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 12px;
  box-shadow: 0 4px 30px rgba(0,0,0,0.3);
  user-select: none;
}

.nav-anchor {
  width: 100%; height: 40px;
  display: flex; align-items: center; justify-content: center;
  background: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.nav-anchor.bottom { margin-top: 8px; }
.nav-anchor:hover { background: var(--color-hover-overlay); border-color: var(--color-primary); }
.nav-anchor.end { opacity: 0.4; cursor: default; }

.anchor-content { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.stitch-indicator { display: flex; align-items: center; gap: 4px; color: #4ade80; font-weight: bold; }
.more-indicator { display: flex; flex-direction: column; align-items: center; font-size: 10px; color: var(--color-primary); font-weight: 600; }
.end-dot { width: 6px; height: 6px; background: var(--color-text-secondary); border-radius: 50%; opacity: 0.5; }

.virtual-pad-wrapper {
  flex: 1;
  width: 100%;
  position: relative;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-input-background);
  overflow: hidden;
  cursor: ns-resize;
  margin: 8px 0;
}

.counter-badge {
  position: absolute;
  top: 4px; right: 4px;
  background: rgba(20, 20, 20, 0.9);
  color: var(--color-primary-light, #fff);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 9px;
  font-family: monospace;
  font-weight: bold;
  z-index: 20;
  border: 1px solid rgba(255,255,255,0.1);
}

.virtual-pad-viewport {
  width: 100%;
  height: 300px;
  position: relative;
}

.horizon-line {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 0;
  border-top: 1px dashed rgba(255, 255, 255, 0.2);
  z-index: 15;
  pointer-events: none;
}

.virtual-pad-track {
  position: absolute;
  left: 0; right: 0; top: 0;
  will-change: transform;
  transition: transform 0.1s linear;
}

.viewport-focus-box {
  position: absolute;
  left: 0; right: 0;
  background: rgba(255, 255, 255, 0.05);
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  z-index: 5;
  pointer-events: none;
}

.msg-tick {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background: var(--author-color);
  opacity: 0.45;
  border-radius: 3px;
  transition: opacity 0.2s ease, width 0.2s ease;
  cursor: pointer;
}

.msg-tick.active {
  opacity: 1;
  z-index: 10;
  box-shadow: 0 0 12px var(--author-color);
}

.msg-tick.origin {
  opacity: 1;
  border: 1.5px solid white;
}

.origin-label {
  position: absolute;
  left: -40px; top: 50%;
  transform: translateY(-50%);
  font-size: 7px; font-weight: 800;
  color: white; background: var(--color-primary);
  padding: 1px 3px; border-radius: 2px;
}

.media-radar-icon {
  position: absolute;
  right: -15px; top: 50%;
  transform: translateY(-50%);
  width: 9px; height: 9px;
  color: #ffcc00;
}

.tick-tooltip {
  position: absolute;
  left: 105%; top: 50%;
  transform: translateY(-50%);
  background: rgba(10, 10, 10, 0.98);
  border: 1px solid var(--color-border);
  padding: 6px 10px; border-radius: var(--radius-sm);
  min-width: 160px; z-index: 100;
  box-shadow: 0 8px 25px rgba(0,0,0,0.6);
}

.tooltip-author { font-size: 10px; font-weight: bold; margin-bottom: 2px; display: block; }
.tooltip-snippet { font-size: 11px; color: #eee; line-height: 1.4; display: block; }

.mini-spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,0.1);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.sensitivity-control {
  width: 100%;
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sens-label {
  font-size: 8px;
  font-weight: bold;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  letter-spacing: 0.5px;
}

.sensitivity-control input[type="range"] {
  width: 100%;
  height: 4px;
  accent-color: var(--color-primary);
  cursor: pointer;
}

@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@media (max-width: 1024px) { .desktop-only { display: none; } }
</style>
