<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useStore } from 'vuex';
import {
  DEFAULT_MESSAGE_TEXT_SIZE,
  MIN_MESSAGE_TEXT_SIZE,
  MAX_MESSAGE_TEXT_SIZE,
  MESSAGE_TEXT_SIZE_PRESETS,
} from '@/store/modules/ui';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: undefined,
  },
});

const emit = defineEmits(['close']);

const THEME_STORAGE_KEY = 'stitch_theme';
const THEMES = [
  {
    id: 'pine-ink',
    label: 'Pine & Ink',
    swatches: ['#121110', '#1c1e1c', '#598958', '#f3ecdc'],
  },
];

const store = useStore();
const selectedTheme = ref('pine-ink');

const isVisible = computed(() =>
  props.isOpen !== undefined ? props.isOpen : store.getters['ui/settingsModalOpen']
);

const messageTextSize = computed({
  get: () => store.getters['ui/messageTextSize'],
  set: (value) => store.dispatch('ui/setMessageTextSize', value),
});

const isDefaultTextSize = computed(
  () => messageTextSize.value === DEFAULT_MESSAGE_TEXT_SIZE
);

const activePresetId = computed(() => {
  const match = MESSAGE_TEXT_SIZE_PRESETS.find(
    (preset) => preset.size === messageTextSize.value
  );
  return match ? match.id : null;
});

const selectPreset = (size) => {
  store.dispatch('ui/setMessageTextSize', size);
};

const resetTextSize = () => {
  store.dispatch('ui/resetMessageTextSize');
};

const selectTheme = (themeId) => {
  selectedTheme.value = themeId;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch (_) {}
};

const closeModal = () => {
  if (props.isOpen === undefined) {
    store.dispatch('ui/setSettingsModalOpen', false);
  }
  emit('close');
};

const onKeydown = (e) => {
  if (!isVisible.value) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    closeModal();
  }
};

onMounted(() => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (THEMES.some((theme) => theme.id === stored)) {
      selectedTheme.value = stored;
    }
  } catch (_) {}
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <transition name="fade">
    <div v-if="isVisible" class="modal-overlay" @click.self="closeModal">
      <div class="modal-container" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
        <div class="modal-header">
          <div class="header-copy">
            <h3 id="settings-modal-title">Settings</h3>
            <p class="header-subtitle">Customize how messages and threads are displayed</p>
          </div>
          <button
            class="close-button"
            type="button"
            @click="closeModal"
            aria-label="Close settings"
          >×</button>
        </div>

        <div class="modal-content">
          <section class="panel">
            <div class="panel-header">
              <div class="panel-header-row">
                <h4>Message text size</h4>
                <div class="size-readout">
                  <span class="size-badge">{{ messageTextSize }}px</span>
                  <button
                    v-if="!isDefaultTextSize"
                    type="button"
                    class="reset-btn"
                    @click="resetTextSize"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div class="preset-group" role="group" aria-label="Message text size presets">
              <button
                v-for="preset in MESSAGE_TEXT_SIZE_PRESETS"
                :key="preset.id"
                type="button"
                class="preset-btn"
                :class="{ active: activePresetId === preset.id }"
                :aria-pressed="activePresetId === preset.id ? 'true' : 'false'"
                @click="selectPreset(preset.size)"
              >
                <span class="preset-label">{{ preset.label }}</span>
              </button>
            </div>

            <div class="slider-row">
              <span class="slider-bound slider-bound--sm">A</span>
              <input
                type="range"
                class="size-slider"
                :min="MIN_MESSAGE_TEXT_SIZE"
                :max="MAX_MESSAGE_TEXT_SIZE"
                step="1"
                v-model.number="messageTextSize"
                aria-label="Message text size in pixels"
              />
              <span class="slider-bound slider-bound--lg">A</span>
            </div>

            <div class="preview-card">
              <div class="preview-header">
                <span class="preview-author">Alice</span>
                <span class="preview-tag">@alice</span>
                <span class="preview-time">just now</span>
              </div>
              <div class="preview-body">
                The quick brown fox jumps over the lazy dog. Here is a preview of how messages appear at <strong>{{ messageTextSize }}px</strong>.
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header">
              <h4>Theme</h4>
            </div>

            <div class="theme-group" role="group" aria-label="Theme">
              <button
                v-for="theme in THEMES"
                :key="theme.id"
                type="button"
                class="theme-option"
                :class="{ active: selectedTheme === theme.id }"
                :aria-pressed="selectedTheme === theme.id ? 'true' : 'false'"
                @click="selectTheme(theme.id)"
              >
                <span class="theme-swatches" aria-hidden="true">
                  <span
                    v-for="color in theme.swatches"
                    :key="color"
                    class="swatch"
                    :style="{ background: color }"
                  ></span>
                </span>
                <span class="theme-name">{{ theme.label }}</span>
              </button>
            </div>
          </section>
        </div>

        <div class="modal-footer">
          <div class="button-group">
            <button class="btn primary" type="button" @click="closeModal">Done</button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-fast);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-index-modal);
  backdrop-filter: blur(4px);
  padding: var(--space-md);
}

.modal-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  width: min(540px, 100%);
  max-height: 88vh;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  background: var(--color-surface-dark);
}

.header-copy h3 {
  margin: 0;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: 600;
  line-height: var(--line-height-tight);
}

.header-subtitle {
  margin: var(--space-xxs) 0 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: var(--color-text-secondary);
  height: 32px;
  width: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.close-button:hover {
  color: var(--color-text);
  background: var(--color-hover-overlay);
}

.modal-content {
  padding: var(--space-lg);
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.panel {
  background: var(--color-surface-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md) var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.panel-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.panel-header h4 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
}

.panel-header p {
  margin: var(--space-xxs) 0 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

.size-readout {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.size-badge {
  background: var(--color-surface-light);
  border: 1px solid var(--color-border-light);
  color: var(--color-text);
  font-size: var(--font-size-xs);
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-variant-numeric: tabular-nums;
}

.reset-btn {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.reset-btn:hover {
  color: var(--color-text);
  background: var(--color-hover-overlay);
}

.preset-group {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-xs);
}

.preset-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 8px 6px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}

.preset-btn:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-border-hover);
}

.preset-btn.active {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
  color: var(--color-text);
}

.preset-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.slider-bound {
  color: var(--color-text-secondary);
  font-weight: 600;
  user-select: none;
  line-height: 1;
}

.slider-bound--sm {
  font-size: 13px;
}

.slider-bound--lg {
  font-size: 22px;
}

.size-slider {
  flex: 1;
  accent-color: var(--color-primary);
  cursor: pointer;
  padding: 0;
  border: none;
  background: transparent;
}

.preview-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preview-card.compact {
  padding: 6px 10px;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-xs);
}

.preview-author {
  font-weight: 600;
  color: var(--color-text);
}

.preview-tag,
.preview-time {
  color: var(--color-text-secondary);
}

.preview-time {
  margin-left: auto;
}

.preview-body {
  color: #fffdf5;
  line-height: 1.5;
  font-size: var(--message-font-size, 1.125rem);
}

.theme-group {
  display: flex;
}

.theme-option {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 10px 14px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  cursor: pointer;
}

.theme-option.active {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
}

.theme-swatches {
  display: flex;
  gap: 4px;
}

.swatch {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.theme-name {
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.modal-footer {
  display: flex;
  padding: var(--space-sm) var(--space-lg);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
  background: var(--color-surface-dark);
}

.button-group {
  display: flex;
  gap: var(--space-sm);
  margin-left: auto;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  padding: 6px 16px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
}

.btn.primary {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border: 1px solid transparent;
}

.btn.primary:hover {
  background: var(--color-primary-dark);
}

@media (max-width: 520px) {
  .preset-group {
    grid-template-columns: repeat(2, 1fr);
  }
  .modal-content {
    padding: var(--space-md);
  }
  .panel {
    padding: var(--space-md);
  }
}
</style>
