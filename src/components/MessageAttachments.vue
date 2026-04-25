<template>
  <div v-if="attachments && attachments.length > 0" class="message-attachments">
    <a 
      v-for="att in attachments" 
      :key="att.id || att.gcs_path || att.url || att.name || att.filename"
      :href="att.url" 
      target="_blank" 
      rel="noopener noreferrer"
      :title="att.name || att.filename"
      class="attachment-link"
    >
      <span class="attachment-icon" aria-hidden="true">{{ getIcon(att) }}</span>
      <div class="attachment-info">
        <span class="attachment-name">{{ att.name || att.filename || 'attachment' }}</span>
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

const getFileExt = (att) => {
  const name = att?.name || att?.filename || '';
  const gcs = att?.gcs_path || '';
  const candidate = name || gcs.split('/').pop() || '';
  const ext = candidate.toLowerCase().split('.').pop();
  return ext || '';
};

const getFileType = (att) => {
  return att?.type || att?.mime_type || att?.content_type || '';
};

const getIcon = (att) => {
  const mime = getFileType(att);
  const ext = getFileExt(att);

  if (mime?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return '🖼️';
  }

  if (mime === 'application/pdf' || ext === 'pdf') return '📄';

  if (mime?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'webm'].includes(ext)) {
    return '🎵';
  }

  if (ext === 'py') return '🐍';
  if (mime?.startsWith('text/') || ['txt', 'md', 'json', 'yml', 'yaml', 'log'].includes(ext)) {
    return '📝';
  }

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
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 8px;
  margin-top: 8px;
}

@media (max-width: 520px) {
  .message-attachments {
    grid-template-columns: 1fr;
  }
}

.attachment-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  text-decoration: none;
  color: var(--color-text);
  font-size: 14px;
  transition: background 0.2s;
  width: 100%;
}

.attachment-link:hover {
  background: var(--color-surface-3);
}

.attachment-icon {
  font-size: 16px;
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
