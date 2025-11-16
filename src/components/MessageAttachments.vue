<template>
  <div v-if="attachments && attachments.length > 0" class="message-attachments">
    <a 
      v-for="att in attachments" 
      :key="att.name || att.gcs_path"
      :href="att.url" 
      target="_blank" 
      rel="noopener noreferrer"
      class="attachment-link"
    >
      <span class="attachment-icon">{{ getIcon(att.type) }}</span>
      <div class="attachment-info">
        <span class="attachment-name">{{ att.name }}</span>
        <span v-if="att.size" class="attachment-size">{{ formatFileSize(att.size) }}</span>
      </div>
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

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
  gap: 8px;
  padding: 8px 10px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  text-decoration: none;
  color: var(--color-text);
  font-size: 14px;
  transition: background 0.2s;
  margin-bottom: .6rem;
}

.attachment-link:hover {
  background: var(--color-surface-3);
}

.attachment-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.attachment-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 2px;
}

.attachment-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.attachment-size {
  font-size: 12px;
  color: var(--color-text-secondary, rgba(0, 0, 0, 0.6));
  opacity: 0.7;
}
</style>




