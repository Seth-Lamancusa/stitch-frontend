<template>
  <div ref="root" class="formatted-content" v-html="renderedContent"></div>
  <teleport to="body">
    <div
      v-if="openFence"
      class="fc-fence-modal-overlay"
      @click.self="openFence = null"
    >
      <div
        class="fc-fence-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="openFence.label || 'Code'"
      >
        <div class="fc-fence-modal-header">
          <h3>{{ openFence.label || 'Code' }}</h3>
          <button type="button" class="fc-fence-modal-close" aria-label="Close" @click="openFence = null">✕</button>
        </div>
        <div class="fc-fence-modal-body">
          <div
            v-for="(line, index) in openFence.lines"
            :key="index"
            class="fc-fence-line"
            :style="{ paddingLeft: line.indent }"
          >{{ line.text }}</div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { applyFormatters } from './formatters';
import { fenceLabelFromClass } from './helpers/fenceLabel';
import { contentText } from '../../utils/messageCompat.js';

const props = defineProps({
  content: {
    type: [String, Object, Array],
    default: ''
  },
  // Optional configuration object for formatters
  options: {
    type: Object,
    default: () => ({})
  }
});

// Store the rendered content
const renderedContent = ref('');
const root = ref(null);
const copyTimers = new WeakMap();

const openFence = ref(null);
const copyIcon = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10.5 5.5V3.2A1.2 1.2 0 0 0 9.3 2H3.2A1.2 1.2 0 0 0 2 3.2v6.1A1.2 1.2 0 0 0 3.2 10.5H5.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
const checkIcon = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3.2 8.2 6.4 11.4 12.8 4.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const expandIcon = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3 6.5V3.5h3M10 3.5h3V6.5M13 9.5v3h-3M6 12.5H3V9.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function fenceText(pre) {
  const code = pre.querySelector('code');
  return (code || pre).textContent.replace(/\n$/, '');
}

function fenceLines(text) {
  return text.split('\n').map((line) => {
    let cols = 0;
    let index = 0;
    while (index < line.length) {
      const char = line[index];
      if (char === ' ') {
        cols += 1;
      } else if (char === '\t') {
        cols += 4 - (cols % 4);
      } else {
        break;
      }
      index += 1;
    }
    return { indent: `${cols}ch`, text: line.slice(index) };
  });
}

function showFence(pre) {
  const label = pre.parentElement?.querySelector('.fc-fence-label')?.textContent || '';
  openFence.value = { label, lines: fenceLines(fenceText(pre)) };
}

function resetCopyButton(button) {
  button.classList.remove('is-copied');
  button.innerHTML = copyIcon;
  button.setAttribute('aria-label', 'Copy code');
}

function flashCopied(button) {
  const pending = copyTimers.get(button);
  if (pending) clearTimeout(pending);
  button.classList.add('is-copied');
  button.innerHTML = checkIcon;
  button.setAttribute('aria-label', 'Copied');
  const timer = setTimeout(() => {
    copyTimers.delete(button);
    if (button.isConnected) resetCopyButton(button);
  }, 1000);
  copyTimers.set(button, timer);
}

async function copyFence(pre, button) {
  const text = fenceText(pre);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    if (!copied) return;
  }
  flashCopied(button);
}

function attachFenceCopyButtons() {
  const host = root.value;
  if (!host) return;
  host.querySelectorAll('pre').forEach((pre) => {
    if (pre.closest('.fc-fence')) return;
    const wrap = document.createElement('div');
    wrap.className = 'fc-fence';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    const label = pre.getAttribute('data-label') || fenceLabelFromClass(pre.querySelector('code')?.className);
    if (label) {
      const caption = document.createElement('div');
      caption.className = 'fc-fence-label';
      caption.textContent = label;
      wrap.insertBefore(caption, pre);
    }

    const actions = document.createElement('div');
    actions.className = 'fc-fence-actions';

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'fc-fence-open';
    open.innerHTML = expandIcon;
    open.setAttribute('aria-label', 'Open code');
    open.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    open.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showFence(pre);
    });

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fc-fence-copy';
    button.innerHTML = copyIcon;
    button.setAttribute('aria-label', 'Copy code');
    button.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      copyFence(pre, button);
    });

    actions.append(open, button);
    wrap.appendChild(actions);
  });
}

function onFenceKeydown(event) {
  if (event.key === 'Escape' && openFence.value) openFence.value = null;
}

// Process content whenever it changes
watch(() => props.content, processContent, { immediate: true });

// Process the content through the formatting pipeline
async function processContent() {
  const text = contentText(props.content);
  if (!text || text.trim() === '') {
    renderedContent.value = '';
    return;
  }
  
  try {
    // Apply all registered formatters to the content
    const formattedContent = await applyFormatters(text, props.options);
    renderedContent.value = formattedContent;
    await nextTick();
    attachFenceCopyButtons();
  } catch (error) {
    console.error('Error formatting content:', error);
    // Fallback to sanitized plain text if formatting fails
    renderedContent.value = escapeHtml(text);
  }
}

// Basic HTML escaping as a fallback
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let previousBodyOverflow = '';
watch(openFence, (value) => {
  if (value) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = previousBodyOverflow;
  }
});

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow;
  window.removeEventListener('keydown', onFenceKeydown);
  const host = root.value;
  if (!host) return;
  host.querySelectorAll('.fc-fence-copy').forEach((button) => {
    const timer = copyTimers.get(button);
    if (timer) clearTimeout(timer);
  });
});

// Initial processing
onMounted(() => {
  window.addEventListener('keydown', onFenceKeydown);
  processContent();
});
</script>

<style scoped>
.formatted-content {
  width: 100%;
  font-family: var(--author-font, var(--font-family-base));
  font-size: var(--message-font-size, 1.125rem);
  line-height: var(--line-height-normal);
  color: var(--color-text);
}
</style> 