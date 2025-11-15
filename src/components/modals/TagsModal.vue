<template>
  <div v-if="isVisible" class="modal-overlay" :class="{ 'closing': isClosing }" @click.self="closeModal">
    <div class="tags-modal">
      <div class="modal-header">
        <h3>{{ isAddMode ? 'Tags' : 'Tags (new message)' }}</h3>
        <button class="close-button" @click.stop="closeModal">×</button>
      </div>

      <div class="modal-content">
        <div class="edit-section">
          <p class="modal-description" v-if="!isAddMode">Tags for this new message (optional)</p>

          <div class="tag-input-container">
            <div class="input-wrapper" :class="{ 'valid': isValid === true, 'invalid': isValid === false }">
              <input
                ref="tagInput"
                v-model="newTag"
                @keydown.enter.prevent="addTag"
                @input="validateInput"
                placeholder="Add a tag (letters, numbers, -)"
                class="tag-input"
              />
              <div v-if="isValid === true" class="valid-indicator" title="Valid tag">✓</div>
              <div v-else-if="isValid === false" class="invalid-indicator" title="Invalid tag">✗</div>
            </div>
            <button class="add-tag-btn" @click.stop="addTag" :disabled="!canAdd || isUpdating">
              {{ isUpdating ? '...' : 'Add' }}
            </button>
          </div>

          <div class="existing-tags-select" v-if="availableTags.length">
            <label class="select-label" for="existing-tags-select">Add from existing</label>
            <select
              id="existing-tags-select"
              v-model="selectedExistingTag"
              class="tag-dropdown"
              @change="addExistingTag"
              :disabled="isLoadingTags"
            >
              <option value="">{{ defaultTagOptionText }}</option>
              <option
                v-for="tag in availableTags"
                :key="`existing-${tag}`"
                :value="tag"
                :disabled="isTagSelected(tag)"
              >
                #{{ tag }}
              </option>
            </select>
          </div>

          <div class="tags-list">
            <div v-if="displayTags.length === 0" class="no-tags">No tags yet</div>
            <div v-else class="tags-rows">
              <div v-for="(tag, index) in displayTags" :key="getTagKey(tag, index)" class="tag-row">
                <div class="tag-info">
                  <span class="tag-name">#{{ getTagName(tag) }}</span>
                  <span class="tag-meta">
                    <span v-if="getTagAddedBy(tag)" class="tag-author">@{{ getTagAddedBy(tag) }}</span>
                    <span v-if="getTagCreatedAt(tag)" class="tag-time">{{ formatTime(getTagCreatedAt(tag)) }}</span>
                  </span>
                </div>
                <button class="remove-tag-btn" @click.stop="removeTag(index)" aria-label="Remove tag" :disabled="isUpdating">×</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="done-button" @click.stop="handleDone">Done</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, nextTick } from 'vue';
import MessageService from '../../services/MessageService.js';

const props = defineProps({
  isVisible: { type: Boolean, default: false },
  isAddMode: { type: Boolean, default: false },
  existingTags: { type: Array, default: () => [] },
  messageId: { type: String, default: null }
});

const emit = defineEmits(['close', 'done', 'change', 'update']);

const isClosing = ref(false);
const isUpdating = ref(false);
const newTag = ref('');
const isValid = ref(null);
const tagInput = ref(null);
const availableTags = ref([]);
const selectedExistingTag = ref('');
const isLoadingTags = ref(false);

// Local working copy of tags
const tagsLocal = ref([]);

const defaultTagOptionText = computed(() => {
  return (tagsLocal.value || []).length > 0 ? 'Selected tags' : 'All tags';
});

const isTagSelected = (tag) => {
  const normalized = (tag || '').toLowerCase();
  const existingNames = (tagsLocal.value || []).map(t => getTagName(t).toLowerCase());
  return existingNames.includes(normalized);
};

// Display tags - handles both string and object formats
const displayTags = computed(() => {
  return (tagsLocal.value || []).map(tag => {
    // Handle both old string format and new object format
    if (typeof tag === 'string') {
      return { name: tag, added_by_tag: null, created_at: null };
    }
    return tag;
  });
});

const fetchAvailableTags = async () => {
  try {
    isLoadingTags.value = true;
    const resp = await MessageService.getAllTags();
    availableTags.value = Array.isArray(resp?.data) ? resp.data : [];
  } catch (e) {
    console.error('[TagsModal] fetch tags error', e);
    availableTags.value = [];
  } finally {
    isLoadingTags.value = false;
  }
};

watch(() => props.isVisible, (visible) => {
  if (visible) {
    // Initialize local list from existingTags when opening
    tagsLocal.value = (props.existingTags || []).slice();
    selectedExistingTag.value = '';
    fetchAvailableTags();
    // Autofocus
    nextTick(() => {
      try { tagInput.value && tagInput.value.focus(); } catch (_) {}
    });
  }
});

// Watch existingTags to refresh local tags after backend updates (when modal is open)
watch(() => props.existingTags, (newTags) => {
  if (props.isVisible && !isUpdating.value) {
    // Refresh local tags from props when they change (e.g., after backend update)
    tagsLocal.value = (newTags || []).slice();
  }
}, { deep: true });

const TAG_RE = /^[A-Za-z0-9-]+$/;
const MAX_TAG_LEN = 32;
const MAX_TAGS = 20;

// Helper functions to extract tag properties
const getTagName = (tag) => {
  return typeof tag === 'string' ? tag : (tag?.name || '');
};

const getTagAddedBy = (tag) => {
  return typeof tag === 'object' ? tag?.added_by_tag : null;
};

const getTagCreatedAt = (tag) => {
  return typeof tag === 'object' ? tag?.created_at : null;
};

const getTagKey = (tag, index) => {
  const name = getTagName(tag);
  const time = getTagCreatedAt(tag) || '';
  return `${name}:${time}:${index}`;
};

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  } catch (e) {
    return '';
  }
};

const canAdd = computed(() => {
  const v = (newTag.value || '').trim();
  if (!v) return false;
  if (displayTags.value.length >= MAX_TAGS) return false;
  const normalized = v.toLowerCase();
  const existingNames = displayTags.value.map(t => getTagName(t).toLowerCase());
  return TAG_RE.test(normalized) && normalized.length <= MAX_TAG_LEN && !existingNames.includes(normalized);
});

const validateInput = () => {
  const v = (newTag.value || '').trim();
  if (!v) { isValid.value = null; return; }
  const normalized = v.toLowerCase();
  const existingNames = displayTags.value.map(t => getTagName(t).toLowerCase());
  isValid.value = TAG_RE.test(normalized) && normalized.length <= MAX_TAG_LEN && !existingNames.includes(normalized);
};

const emitTagUpdates = async () => {
  const tagNames = tagsLocal.value.map(t => getTagName(t));
  if (props.isAddMode && props.messageId) {
    isUpdating.value = true;
    try {
      emit('update', { messageId: props.messageId, tags: tagNames });
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (e) {
      console.error('Failed to update tags:', e);
    } finally {
      isUpdating.value = false;
    }
  } else {
    emit('change', tagNames);
  }
};

const addTag = async () => {
  if (!canAdd.value || isUpdating.value) return;
  
  const normalized = (newTag.value || '').trim().toLowerCase();
  if (!normalized) return;
  
  const existingNames = displayTags.value.map(t => getTagName(t).toLowerCase());
  if (existingNames.includes(normalized)) return;
  
  // Add to local list (as string - backend will convert to object)
  tagsLocal.value.push(normalized);
  
  newTag.value = '';
  isValid.value = null;
  
  await emitTagUpdates();
  
  nextTick(() => { try { tagInput.value && tagInput.value.focus(); } catch (_) {} });
};

const addExistingTag = async () => {
  if (!selectedExistingTag.value || isUpdating.value) return;

  const normalized = selectedExistingTag.value.trim().toLowerCase();
  if (!normalized || isTagSelected(normalized)) {
    selectedExistingTag.value = '';
    return;
  }

  tagsLocal.value.push(normalized);
  selectedExistingTag.value = '';

  await emitTagUpdates();
};

const removeTag = async (index) => {
  if (index < 0 || index >= tagsLocal.value.length || isUpdating.value) return;
  
  tagsLocal.value.splice(index, 1);
  
  await emitTagUpdates();
};

const closeModal = () => {
  isClosing.value = true;
  setTimeout(() => {
    isClosing.value = false;
    emit('close');
  }, 150);
};

const handleDone = () => {
  const tagNames = tagsLocal.value.map(t => getTagName(t));
  emit('done', tagNames);
  closeModal();
};

onMounted(() => {
  if (props.isVisible) {
    nextTick(() => { try { tagInput.value && tagInput.value.focus(); } catch (_) {} });
  }
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex; justify-content: center; align-items: center;
  z-index: 1001; padding: 20px;
}
.modal-overlay.closing { animation: quick-fade-out 150ms ease forwards; }

.tags-modal {
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 0; min-width: 360px; max-width: 560px; width: 100%;
  max-height: 70vh; display: flex; flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px 12px; border-bottom: 1px solid var(--color-border); }
.modal-header h3 { margin: 0; font-size: var(--font-size-lg); font-weight: 600; color: var(--color-text); }
.close-button { background: none; border: none; color: var(--color-text-secondary); font-size: 24px; cursor: pointer; padding: 4px; line-height: 1; }
.close-button:hover { color: var(--color-error); }

.modal-content { padding: 16px 20px; flex: 1; min-height: 0; overflow-y: auto; }
.section-header { margin: 0 0 8px 0; color: var(--color-text-tertiary, #666); font-size: var(--font-size-sm); font-weight: 400; opacity: 0.8; }
.modal-description { margin: 0 0 12px 0; color: var(--color-text-secondary); font-size: var(--font-size-sm); }

.tag-input-container { display: flex; gap: 8px; margin-bottom: 12px; }
.input-wrapper { flex: 1; position: relative; border: 1px solid var(--color-border); border-radius: var(--radius-md); background-color: var(--color-input-bg, var(--color-surface)); transition: all 0.2s ease; }
.input-wrapper:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb, 79, 140, 255), 0.2); }
.input-wrapper.valid { border-color: var(--color-success); }
.input-wrapper.invalid { border-color: var(--color-error); }
.tag-input { width: 100%; padding: 10px 36px 10px 12px; border: none; background: transparent; color: var(--color-text); font-size: var(--font-size-sm); outline: none; }
.valid-indicator, .invalid-indicator { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-weight: bold; }
.valid-indicator { color: var(--color-success); }
.invalid-indicator { color: var(--color-error); }
.add-tag-btn { padding: 10px 16px; background-color: var(--color-primary); color: var(--color-text-inverse); border: none; border-radius: var(--radius-md); font-weight: 500; font-size: var(--font-size-sm); cursor: pointer; }
.add-tag-btn:disabled { background-color: var(--color-border); color: var(--color-text-secondary); cursor: not-allowed; }

.tags-list { min-height: 40px; margin-top: 12px; }
.tags-rows { display: flex; flex-direction: column; gap: 8px; }
.existing-tags-select { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
.select-label { font-size: var(--font-size-xs); color: var(--color-text-secondary); }
.tag-dropdown { padding: 10px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background-color: var(--color-surface); color: var(--color-text); }
.tag-dropdown:disabled { opacity: 0.6; cursor: not-allowed; }
.tag-row { 
  display: flex; 
  align-items: center; 
  justify-content: space-between;
  padding: 10px 12px; 
  border-radius: var(--radius-md); 
  background-color: var(--color-surface-light, rgba(0, 0, 0, 0.02)); 
  border: 1px solid var(--color-border);
  transition: background-color 0.2s ease;
}
.tag-row:hover { background-color: var(--color-surface-hover, rgba(0, 0, 0, 0.04)); }
.tag-info { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
.tag-name { 
  color: var(--color-text); 
  font-size: var(--font-size-base); 
  font-weight: 500;
}
.tag-meta { 
  display: flex; 
  gap: 8px; 
  font-size: var(--font-size-xs); 
  color: var(--color-text-tertiary);
}
.tag-author { color: var(--color-primary); }
.tag-time { opacity: 0.8; }
.remove-tag-btn { 
  background: none; 
  border: none; 
  color: var(--color-text-secondary); 
  cursor: pointer; 
  font-size: 18px; 
  line-height: 1; 
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
}
.remove-tag-btn:hover { 
  background-color: var(--color-error-light, rgba(255, 59, 48, 0.1)); 
  color: var(--color-error); 
}
.remove-tag-btn:disabled { 
  opacity: 0.3; 
  cursor: not-allowed; 
}
.no-tags { color: var(--color-text-secondary); font-size: var(--font-size-sm); font-style: italic; }

.modal-footer { padding: 12px 20px 16px; border-top: 1px solid var(--color-border); display: flex; justify-content: flex-end; }
.done-button { padding: 10px 16px; background-color: var(--color-primary); color: var(--color-text-inverse); border: none; border-radius: var(--radius-md); font-weight: 500; font-size: var(--font-size-sm); cursor: pointer; }

@keyframes quick-fade-out { 0% { opacity: 1; } 100% { opacity: 0; } }

@media (max-width: 768px) {
  .modal-overlay { padding: 10px; }
  .tags-modal { min-width: unset; max-height: 90vh; }
}
</style>








