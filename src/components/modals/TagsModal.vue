<template>
  <div v-if="isVisible" class="modal-overlay" :class="{ 'closing': isClosing }" @click.self="closeModal">
    <div class="tags-modal">
      <div class="modal-header">
        <h3>{{ isAddMode ? 'Add Tags' : 'Tags (new message)' }}</h3>
        <button class="close-button" @click.stop="closeModal">×</button>
      </div>

      <div class="modal-content">
        <!-- Existing Tags (read-only context when adding to existing) -->
        <div v-if="isAddMode && existingTags && existingTags.length > 0" class="existing-tags-section">
          <p class="section-header">Current tags</p>
          <div class="tags-list read-only">
            <span v-for="(tag, index) in dedupedExistingTags" :key="tag + ':' + index" class="tag-chip">#{{ tag }}</span>
          </div>
        </div>

        <div class="edit-section">
          <p class="modal-description" v-if="!isAddMode">Tags for this new message (optional)</p>
          <p class="modal-description" v-else>Add new tags</p>

          <div class="tag-input-container">
            <div class="input-wrapper" :class="{ 'valid': isValid === true, 'invalid': isValid === false }">
              <input
                ref="tagInput"
                v-model="newTag"
                @keydown.enter.prevent="addTag"
                @input="validateInput"
                placeholder="Add a tag (letters, numbers, _)"
                class="tag-input"
              />
              <div v-if="isValid === true" class="valid-indicator" title="Valid tag">✓</div>
              <div v-else-if="isValid === false" class="invalid-indicator" title="Invalid tag">✗</div>
            </div>
            <button class="add-tag-btn" @click.stop="addTag" :disabled="!canAdd">Add</button>
          </div>

          <div class="tags-list">
            <div v-if="tagsLocal.length === 0" class="no-tags">No tags yet</div>
            <div v-else class="chips">
              <span v-for="(tag, index) in tagsLocal" :key="tag + ':' + index" class="tag-chip">
                #{{ tag }}
                <button class="remove-tag-btn" @click.stop="removeTag(index)" aria-label="Remove tag">×</button>
              </span>
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

const props = defineProps({
  isVisible: { type: Boolean, default: false },
  isAddMode: { type: Boolean, default: false },
  existingTags: { type: Array, default: () => [] }
});

const emit = defineEmits(['close', 'done', 'change', 'blocked-add']);

const isClosing = ref(false);
const newTag = ref('');
const isValid = ref(null);
const tagInput = ref(null);

// Local working copy of tags
const tagsLocal = ref([]);

const dedupedExistingTags = computed(() => {
  const set = new Set((props.existingTags || []).map(t => String(t || '').toLowerCase()));
  return Array.from(set);
});

watch(() => props.isVisible, (visible) => {
  if (visible) {
    // Initialize local list from existingTags when opening
    tagsLocal.value = dedupedExistingTags.value.slice();
    // Autofocus
    nextTick(() => {
      try { tagInput.value && tagInput.value.focus(); } catch (_) {}
    });
  }
});

const TAG_RE = /^[A-Za-z0-9_-]+$/;
const MAX_TAG_LEN = 32;
const MAX_TAGS = 20;

const canAdd = computed(() => {
  const v = (newTag.value || '').trim();
  if (!v) return false;
  if (tagsLocal.value.length >= MAX_TAGS) return false;
  const normalized = v.toLowerCase();
  return TAG_RE.test(normalized) && normalized.length <= MAX_TAG_LEN && !tagsLocal.value.includes(normalized);
});

const validateInput = () => {
  const v = (newTag.value || '').trim();
  if (!v) { isValid.value = null; return; }
  const normalized = v.toLowerCase();
  isValid.value = TAG_RE.test(normalized) && normalized.length <= MAX_TAG_LEN && !tagsLocal.value.includes(normalized);
};

const addTag = () => {
  if (!canAdd.value) return;
  const normalized = (newTag.value || '').trim().toLowerCase();
  if (!normalized) return;
  // In add mode (used for existing messages), block additions for now and surface via parent
  if (props.isAddMode) {
    emit('blocked-add', normalized);
    return;
  }
  if (!tagsLocal.value.includes(normalized)) {
    tagsLocal.value.push(normalized);
  }
  newTag.value = '';
  isValid.value = null;
  emit('change', tagsLocal.value.slice());
  nextTick(() => { try { tagInput.value && tagInput.value.focus(); } catch (_) {} });
};

const removeTag = (index) => {
  if (index < 0 || index >= tagsLocal.value.length) return;
  tagsLocal.value.splice(index, 1);
  emit('change', tagsLocal.value.slice());
};

const closeModal = () => {
  isClosing.value = true;
  setTimeout(() => {
    isClosing.value = false;
    emit('close');
  }, 150);
};

const handleDone = () => {
  emit('done', tagsLocal.value.slice());
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

.tags-list { min-height: 40px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.tag-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: var(--radius-md); background-color: var(--color-primary-light, rgba(var(--color-primary-rgb, 79, 140, 255), 0.08)); border: 1px solid var(--color-border); color: var(--color-text); font-size: var(--font-size-xs); }
.tag-chip .remove-tag-btn { background: none; border: none; color: var(--color-text-secondary); cursor: pointer; font-size: 14px; line-height: 1; }
.no-tags { color: var(--color-text-secondary); font-size: var(--font-size-sm); font-style: italic; }

.existing-tags-section { margin-bottom: 12px; }
.tags-list.read-only .tag-chip { background-color: var(--color-surface-light, var(--color-surface)); }

.modal-footer { padding: 12px 20px 16px; border-top: 1px solid var(--color-border); display: flex; justify-content: flex-end; }
.done-button { padding: 10px 16px; background-color: var(--color-primary); color: var(--color-text-inverse); border: none; border-radius: var(--radius-md); font-weight: 500; font-size: var(--font-size-sm); cursor: pointer; }

@keyframes quick-fade-out { 0% { opacity: 1; } 100% { opacity: 0; } }

@media (max-width: 768px) {
  .modal-overlay { padding: 10px; }
  .tags-modal { min-width: unset; max-height: 90vh; }
}
</style>





