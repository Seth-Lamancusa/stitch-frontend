<template>
  <div class="formatted-content" v-html="renderedContent"></div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { applyFormatters } from './formatters';
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

// Initial processing
onMounted(() => {
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