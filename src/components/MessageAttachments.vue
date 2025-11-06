<template>
  <div v-if="attachments && attachments.length > 0" class="message-attachments">
    <a 
      v-for="att in attachments" 
      :key="att.name"
      :href="att.url" 
      target="_blank" 
      rel="noopener noreferrer"
      class="attachment-link"
    >
      <span class="attachment-icon">{{ getIcon(att.type) }}</span>
      <span class="attachment-name">{{ att.name }}</span>
    </a>
  </div>
</template>

<script setup>
defineProps({
  attachments: {
    type: Array,
    default: () => []
  }
});

const getIcon = (type) => {
  if (type?.startsWith('image/')) return '🖼️';
  if (type === 'application/pdf') return '📄';
  return '📎';
};
</script>

<style scoped>
.message-attachments {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.attachment-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  text-decoration: none;
  color: var(--color-text);
  font-size: 14px;
  transition: background 0.2s;
}

.attachment-link:hover {
  background: var(--color-surface-3);
}

.attachment-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.attachment-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>




