<template>
  <div class="import-view">
    <!-- Permission Blocking Screen -->
    <div v-if="!hasImportPermissions" class="permission-blocking-screen">
      <div class="permission-block-content">
        <div class="permission-block-icon">🔒</div>
        <h2 class="permission-block-title">Import Access Required</h2>
        <p class="permission-block-description">
          To import conversations, you need specific permissions that are not currently assigned to your account.
        </p>
        
        <div class="permission-requirements">
          <h3>Required Permissions:</h3>
          <ul class="permission-list">
            <li :class="{ 'has-permission': can('messages.write') }">
              <span class="permission-icon">{{ can('messages.write') ? '✓' : '✗' }}</span>
              <span class="permission-name">messages.write</span>
              <span class="permission-desc">— Write messages</span>
            </li>
          </ul>
        </div>
        
        <button @click="goBack" class="permission-block-back-button">
          ← Go Back
        </button>
      </div>
    </div>
    
    <!-- Main Import View -->
    <template v-else>
      <div class="import-header">
        <button @click="goBack" class="back-button">
          &larr; Cancel
        </button>
        <h2 class="import-title">Import Conversation</h2>
      </div>

      <div class="import-content">
        <!-- Mode Tabs -->
        <div class="import-tabs" v-if="true">
          <button 
            class="tab-button" 
            :class="{ active: activeMode === 'cursor' }"
            @click="activeMode = 'cursor'"
          >
            <span class="tab-icon">📝</span>
            Text / Markdown
          </button>
          <button 
            class="tab-button" 
            :class="{ active: activeMode === 'audio' }"
            @click="activeMode = 'audio'"
          >
            <span class="tab-icon">🎙️</span>
            Audio Transcript
          </button>
        </div>

        <div class="import-panel">
          
          <!-- Text / Markdown Import Mode -->
          <div v-if="activeMode === 'cursor'" class="mode-container">
            <h3>Import Text / Markdown</h3>
            <p class="mode-description">
              Paste conversation text or upload a markdown file.
            </p>

            <p class="help-text">
              Prefill runs a best-effort parse. Then set each message’s speaker name (and optionally mark it as "Me").
            </p>

            <div class="input-method-container">
              <div class="input-group">
                <label>Paste Text</label>
                <textarea 
                  v-model="importText"
                  class="import-textarea"
                  placeholder="Paste your conversation here..."
                  :disabled="isImporting"
                />
              </div>
              
              <div class="divider"><span>OR</span></div>
              
              <div class="input-group">
                <label>Upload File (.md, .txt)</label>
                <input 
                  type="file" 
                  ref="fileInput"
                  accept=".md,.txt,.markdown"
                  @change="handleFileUpload"
                  :disabled="isImporting"
                  class="file-input"
                />
              </div>
            </div>

            <!-- Preview -->
            <div v-if="parsedMessages.length > 0" class="preview-section">
              <h4>Preview ({{ parsedMessages.length }} messages)</h4>
              <div class="preview-list manual-preview-list">
                <div v-for="(msg, idx) in parsedMessages" :key="idx" class="preview-item">
                  <div class="preview-item-header">
                    <div class="preview-speaker-header">
                      <strong>{{ idx + 1 }}.</strong>
                      <label class="checkbox-label me-checkbox">
                        <input type="checkbox" v-model="msg.isMe" />
                        Me
                      </label>
                      <input
                        v-if="!msg.isMe"
                        v-model="msg.speakerName"
                        class="select-input speaker-name-input"
                        placeholder="Speaker name"
                      />
                    </div>
                    <div class="preview-item-actions">
                      <button
                        class="text-button"
                        :disabled="!canSplit(idx) || isImporting"
                        @click="splitAt(idx)"
                      >
                        Split here
                      </button>
                      <button
                        class="text-button"
                        :disabled="isImporting"
                        @click="removeMessage(idx)"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <textarea
                    v-model="parsedMessages[idx].content"
                    class="preview-textarea"
                    @click="onCaretUpdate(idx, $event)"
                    @keyup="onCaretUpdate(idx, $event)"
                    @select="onCaretUpdate(idx, $event)"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Audio Import Mode -->
          <div v-if="activeMode === 'audio'" class="mode-container">
            <h3>Import Audio Transcript</h3>
            <p class="mode-description">
              Upload an audio file to transcribe and import as a conversation.
            </p>

            <div v-if="!transcriptionResult" class="audio-upload-section">
              <div class="input-group">
                <label>Select Audio File</label>
                <input 
                  type="file" 
                  ref="audioInput"
                  accept="audio/*,.mp3,.wav,.m4a"
                  @change="handleAudioUpload"
                  :disabled="isImporting"
                  class="file-input"
                />
              </div>
              
              <div class="input-group">
                <label>Speakers Expected</label>
                <input 
                  type="number" 
                  v-model.number="speakersExpected"
                  min="1"
                  placeholder="2"
                  class="number-input"
                  :disabled="isImporting"
                />
              </div>

              <button 
                class="primary-button" 
                @click="transcribeAudio"
                :disabled="!selectedAudioFile || !speakersExpected || isImporting"
              >
                {{ isImporting ? 'Transcribing...' : 'Start Transcription' }}
              </button>
            </div>

            <!-- Transcription Result / Mapping -->
            <div v-else class="transcription-editor">
              <div class="editor-header">
                <h4>Speaker Mapping</h4>
                <button class="text-button" @click="resetAudio">Reset</button>
              </div>
              
              <div class="speaker-mapping">
                <div v-for="speakerId in uniqueSpeakers" :key="speakerId" class="mapping-row">
                  <span class="speaker-name">Speaker {{ speakerId }}</span>
                  <label class="checkbox-label me-checkbox">
                    <input type="checkbox" v-model="speakerRegistry[speakerId].isMe" />
                    Me
                  </label>
                  <input
                    v-if="!speakerRegistry[speakerId].isMe"
                    v-model="speakerRegistry[speakerId].speakerName"
                    class="select-input speaker-name-input"
                    placeholder="Speaker name"
                  />
                </div>
              </div>

              <div class="messages-preview">
                <h4>Preview ({{ builtMessages.length }} utterances)</h4>
                <div class="messages-editor">
                  <div v-for="(msg, idx) in builtMessages.slice(0, 5)" :key="idx" class="editor-message">
                    <div class="message-meta">
                      <span class="speaker-label">Speaker {{ msg.speakerId }}</span>
                    </div>
                    <div class="message-content-preview">{{ truncate(msg.content) }}</div>
                  </div>
                  <div v-if="builtMessages.length > 5" class="preview-more">
                    ... and {{ builtMessages.length - 5 }} more
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Common Settings & Actions -->
          <div v-if="canProceed" class="actions-section">
            <div class="settings-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="isPublic">
                Public Conversation
              </label>

              <label class="source-platform-label">
                Source
                <input
                  v-model="sourcePlatform"
                  class="select-input source-platform-input"
                  placeholder="Slack, Discord..."
                  :disabled="isImporting"
                />
              </label>
              
              <button class="text-button" @click="showRecipients = true">
                Manage Recipients ({{ recipients.length }})
              </button>
            </div>

            <div class="error-message" v-if="importError">{{ importError }}</div>

            <button 
              class="primary-button large" 
              @click="importConversation"
              :disabled="isImporting"
            >
              {{ isImporting ? 'Importing...' : 'Import Conversation' }}
            </button>
          </div>

        </div>
      </div>

      <!-- Recipients Modal -->
      <RecipientsModal
        :is-visible="showRecipients"
        :is-public="isPublic"
        :is-add-mode="false"
        @close="showRecipients = false"
        @done="showRecipients = false"
      />
      
      <GlobalNotifications />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';
import { usePermissions } from '../../composables/usePermissions';
import ImportService from '../../services/ImportService';
import TranscriptionService from '../../services/TranscriptionService';
import RecipientsModal from '../../components/modals/RecipientsModal.vue';
import GlobalNotifications from '../../components/GlobalNotifications.vue';

const router = useRouter();
const store = useStore();
const { can, canAny, isAdmin, user: currentUser } = usePermissions();

const hasImportPermissions = computed(() => {
  return can('messages.write');
});

// State
const activeMode = ref('cursor');
const isImporting = ref(false);
const importError = ref('');
const isPublic = ref(false);
const sourcePlatform = ref('');
const recipients = ref([]);
const showRecipients = ref(false);

const loginModalOpen = computed(() => store.getters['ui/loginModalOpen']);

watch(loginModalOpen, (open) => {
  if (open) showRecipients.value = false;
});

// Builder mode state (Cursor)

// Cursor Mode State
const importText = ref('');
const parsedMessages = ref([]);
const fileInput = ref(null);
const caretPositions = ref({});

// Audio Mode State
const audioInput = ref(null);
const selectedAudioFile = ref(null);
const speakersExpected = ref(2);
const transcriptionResult = ref(null);
const builtMessages = ref([]);
const speakerRegistry = ref({}); // speakerId -> user object

onMounted(async () => {
  // No-op
});

// Watchers
watch(importText, (val) => {
  if (val) {
    const result = ImportService.parseConversation(val);
    const normalized = Array.isArray(result) ? result : (result.messages || []);
    parsedMessages.value = (normalized || []).map(m => ({
      content: m.content || '',
      isMe: m.role === 'user',
      speakerName: m.role === 'assistant' ? 'Assistant' : 'User',
    }));
    caretPositions.value = {};
  } else {
    parsedMessages.value = [];
    caretPositions.value = {};
  }
});

watch(() => store.getters['navigation/replyRecipients'], (newRecipients) => {
  recipients.value = newRecipients;
}, { immediate: true });

// Methods
const goBack = () => router.back();

const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    importText.value = text;
  } catch (e) {
    importError.value = "Failed to read file";
  }
};

const handleAudioUpload = (event) => {
  const file = event.target.files[0];
  if (file) {
    selectedAudioFile.value = file;
  }
};

const transcribeAudio = async () => {
  if (!selectedAudioFile.value) return;
  
  isImporting.value = true;
  try {
    const result = await TranscriptionService.transcribe(selectedAudioFile.value, speakersExpected.value);
    transcriptionResult.value = result;
    
    // Convert utterances to message format
    builtMessages.value = (result.utterances || []).map(u => ({
      speakerId: u.speaker,
      content: u.utterance
    }));
    
    // Initialize registry
    const speakers = [...new Set(builtMessages.value.map(m => m.speakerId))];
    const reg = {};
    speakers.forEach(s => {
      reg[s] = {
        isMe: false,
        speakerName: `Speaker ${s}`
      };
    });
    speakerRegistry.value = reg;
    
  } catch (e) {
    importError.value = "Transcription failed";
  } finally {
    isImporting.value = false;
  }
};

const resetAudio = () => {
  selectedAudioFile.value = null;
  transcriptionResult.value = null;
  builtMessages.value = [];
  speakerRegistry.value = {};
  if (audioInput.value) audioInput.value.value = '';
};

const truncate = (str) => str && str.length > 100 ? str.substring(0, 100) + '...' : str;

const uniqueSpeakers = computed(() => Object.keys(speakerRegistry.value));

const canProceed = computed(() => {
  if (activeMode.value === 'cursor') {
    if (!parsedMessages.value.length) return false;
    return parsedMessages.value.every(m => {
      if (!m || !m.content || !m.content.trim()) return false;
      if (m.isMe) return true;
      return !!(m.speakerName && m.speakerName.trim());
    });
  }
  if (activeMode.value === 'audio') {
    // All speakers must be assigned
    if (!builtMessages.value.length) return false;
    return uniqueSpeakers.value.every(s => {
      const reg = speakerRegistry.value[s];
      if (!reg) return false;
      if (reg.isMe) return true;
      return !!(reg.speakerName && reg.speakerName.trim());
    });
  }
  return false;
});

const onCaretUpdate = (idx, e) => {
  const el = e && e.target ? e.target : null;
  const pos = el && typeof el.selectionStart === 'number' ? el.selectionStart : null;
  caretPositions.value[idx] = pos;
};

const canSplit = (idx) => {
  const pos = caretPositions.value[idx];
  const content = (parsedMessages.value[idx] && parsedMessages.value[idx].content) || '';
  return Number.isInteger(pos) && pos > 0 && pos < content.length;
};

const splitAt = (idx) => {
  const pos = caretPositions.value[idx];
  const msg = parsedMessages.value[idx];
  if (!msg || !Number.isInteger(pos)) return;

  const before = msg.content.slice(0, pos).trim();
  const after = msg.content.slice(pos).trim();
  if (!before || !after) return;

  parsedMessages.value.splice(idx, 1, { ...msg, content: before }, { ...msg, content: after });
  caretPositions.value = {};
};

const removeMessage = (idx) => {
  parsedMessages.value.splice(idx, 1);
  caretPositions.value = {};
};

const importConversation = async () => {
  if (!canProceed.value) return;
  
  isImporting.value = true;
  importError.value = '';
  
  try {
    let builderMessages = [];

    if (activeMode.value === 'cursor') {
      builderMessages = parsedMessages.value.map(m => ({
        content: m.content,
        isMe: !!m.isMe,
        speakerName: m.speakerName
      }));
    } else {
      builderMessages = builtMessages.value.map(u => {
        const reg = speakerRegistry.value[u.speakerId];
        if (!reg) throw new Error(`Speaker ${u.speakerId} not configured`);
        return {
          content: u.content,
          isMe: !!reg.isMe,
          speakerName: reg.speakerName
        };
      });
    }

    const result = await ImportService.importQuoteConversation(
      builderMessages,
      recipients.value,
      isPublic.value,
      { sourcePlatform: sourcePlatform.value }
    );
    
    if (result.success) {
      router.push(`/messages/${result.thread_id}`);
    }
  } catch (e) {
    console.error(e);
    importError.value = e.message || "Import failed";
  } finally {
    isImporting.value = false;
  }
};
</script>

<style scoped>
.import-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--color-bg-primary);
}

.permission-blocking-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: var(--space-lg);
}

.permission-block-content {
  text-align: center;
  max-width: 500px;
  background: var(--color-surface);
  padding: var(--space-xl);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.permission-block-icon {
  font-size: 48px;
  margin-bottom: var(--space-md);
}

.permission-list {
  text-align: left;
  list-style: none;
  padding: 0;
  margin: var(--space-lg) 0;
}

.permission-list li {
  padding: var(--space-sm);
  border-bottom: 1px solid var(--color-border-light);
}

.permission-list li.has-permission {
  color: var(--color-success);
}

.import-header {
  padding: var(--space-md);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  background: var(--color-surface);
}

.back-button {
  background: none;
  border: none;
  font-size: var(--font-size-md);
  cursor: pointer;
  margin-right: var(--space-md);
  color: var(--color-text-secondary);
}

.import-title {
  margin: 0;
  font-size: var(--font-size-lg);
}

.import-content {
  flex: 1;
  padding: var(--space-lg);
  overflow-y: auto;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.import-tabs {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-xs);
}

.tab-button {
  background: none;
  border: none;
  padding: var(--space-sm) var(--space-md);
  cursor: pointer;
  font-weight: 500;
  color: var(--color-text-secondary);
  border-bottom: 2px solid transparent;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.tab-button.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.mode-container {
  background: var(--color-surface);
  padding: var(--space-lg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  margin-bottom: var(--space-lg);
}

.input-method-container, .audio-upload-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-top: var(--space-md);
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.input-group label {
  font-weight: 500;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.divider {
  display: flex;
  align-items: center;
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.divider::before, .divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--color-border);
}

.divider span {
  padding: 0 var(--space-sm);
}

.import-textarea {
  width: 100%;
  min-height: 150px;
  padding: var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: monospace;
}

.select-input {
  padding: var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.help-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin: 0;
}

.preview-section {
  margin-top: var(--space-lg);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.preview-item {
  padding: var(--space-xs) 0;
  border-bottom: 1px solid var(--color-border-light);
}

.manual-preview-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.preview-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-xs);
}

.preview-speaker-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.speaker-name-input {
  flex: 1;
  min-width: 160px;
}

.me-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.preview-item-actions {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.preview-textarea {
  width: 100%;
  min-height: 70px;
  padding: var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: monospace;
}

.actions-section {
  background: var(--color-surface);
  padding: var(--space-lg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.settings-group {
  display: flex;
  gap: var(--space-lg);
  align-items: center;
  flex-wrap: wrap;
}

.source-platform-label {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.source-platform-input {
  width: 160px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  cursor: pointer;
}

.primary-button {
  background-color: var(--color-primary);
  color: var(--color-button-text);
  padding: var(--space-sm) var(--space-md);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 500;
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.primary-button.large {
  width: 100%;
  padding: var(--space-md);
  font-size: var(--font-size-md);
}

.text-button {
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: underline;
}

.error-message {
  color: var(--color-error);
  padding: var(--space-sm);
  background: var(--color-bg-error);
  border-radius: var(--radius-sm);
  text-align: center;
}

.number-input {
  padding: var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  width: 80px;
}

.transcription-editor {
  margin-top: var(--space-md);
}

.editor-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
}

.speaker-mapping {
  background: var(--color-surface-light);
  padding: var(--space-md);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-md);
}

.mapping-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-sm);
}

.speaker-name {
  font-weight: 600;
  width: 80px;
}

.arrow {
  color: var(--color-text-tertiary);
}

.messages-preview {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-md);
}

.editor-message {
  margin-bottom: var(--space-sm);
  padding: var(--space-xs);
  background: var(--color-surface-light);
  border-radius: var(--radius-xs);
}

.speaker-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.message-content-preview {
  font-size: var(--font-size-sm);
}
</style>
