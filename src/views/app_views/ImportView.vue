<template>
  <div class="import-view">
    <div class="import-header">
      <button @click="cancelImport()" class="back-button">
        &larr; Cancel
      </button>
      <h2 class="import-title">Import Conversation</h2>
      
      <!-- Admin Mode Toggle (only visible to admins) -->
      <div v-if="isAdmin" class="admin-mode-toggle">
        <button 
          @click="toggleAdminMode"
          class="admin-toggle-button"
          :class="{ 'active': adminMode }"
          :disabled="isImporting"
        >
          <span class="toggle-icon">⚙️</span>
          <span class="toggle-text">{{ adminMode ? 'Admin Mode' : 'Admin Mode' }}</span>
        </button>
      </div>
    </div>

    <!-- Main content area -->
    <div class="import-content">
      <div class="import-panel">
        
        <!-- Normal Import Mode -->
        <div v-if="!adminMode" class="normal-import-mode">
          <h3>Import AI Conversation</h3>
          
          <!-- Bot Selection -->
          <div class="bot-selection-container">
            <label class="bot-selection-label">Select Featured Bot:</label>
            <select 
              v-model="selectedBot" 
              class="bot-selection-dropdown"
              :disabled="isImporting"
            >
              <option value="">Choose an AI assistant...</option>
              <option 
                v-for="bot in featuredBots" 
                :key="bot.uid" 
                :value="bot"
              >
                {{ bot.display_name }}
              </option>
            </select>
            <p v-if="!selectedBot" class="bot-selection-hint">
              Select the AI assistant that was used in your conversation
            </p>
          </div>

          <!-- Input Method Selection -->
          <div class="input-method-container">
            <div class="input-method-tabs">
              <button 
                @click="inputMethod = 'text'" 
                :class="{ active: inputMethod === 'text' }"
                class="input-method-tab"
              >
                Paste Text
              </button>
              <button 
                @click="inputMethod = 'file'" 
                :class="{ active: inputMethod === 'file' }"
                class="input-method-tab"
              >
                Upload File
              </button>
              <button 
                v-if="isAdmin"
                @click="inputMethod = 'audio'" 
                :class="{ active: inputMethod === 'audio' }"
                class="input-method-tab"
              >
                Audio
              </button>
            </div>
          
            <!-- Text Input -->
            <div v-if="inputMethod === 'text'" class="text-input-container">
              <textarea 
                v-model="importText"
                class="import-textarea"
                placeholder="Paste your conversation here...

Supported formats:
• ChatGPT conversations (copy from web interface)
• Claude conversations (copy from web interface)  
• Gemini conversations (copy from web interface)
• Cursor markdown exports (.md files)
• Plain text conversations

The format will be auto-detected once you paste your conversation."
                :disabled="isImporting"
              />
            </div>
          
            <!-- File Upload -->
            <div v-if="inputMethod === 'file'" class="file-upload-container">
              <input 
                type="file" 
                ref="fileInput"
                accept=".md,.txt,.markdown"
                @change="handleFileUpload"
                :disabled="isImporting"
                class="file-input"
                id="file-input"
              />
              <label for="file-input" class="file-upload-label" :class="{ 'disabled': isImporting }">
                <span v-if="!uploadedFileName">Choose File (.md, .txt, .markdown)</span>
                <span v-else>{{ uploadedFileName }}</span>
                <span class="file-icon">📁</span>
              </label>
              <p class="file-upload-hint">
                Upload markdown files from Cursor or plain text conversation files
              </p>
            </div>

            <!-- Audio Upload (Admin only) -->
            <div v-if="inputMethod === 'audio' && isAdmin" class="file-upload-container">
              <input 
                type="file" 
                ref="audioInput"
                accept="audio/*,.mp3,.wav,.m4a"
                @change="handleAudioFileSelect"
                :disabled="isImporting"
                class="file-input"
                id="audio-file-input"
              />
              <label for="audio-file-input" class="file-upload-label" :class="{ 'disabled': isImporting }">
                <span v-if="!audioFileName">Choose Audio (.mp3, .wav, .m4a)</span>
                <span v-else>{{ audioFileName }}</span>
                <span class="file-icon">🎧</span>
              </label>

              <div class="model-selection-container" style="margin-top: var(--space-sm)">
                <label class="model-selection-label">Speakers expected</label>
                <input 
                  type="number" 
                  min="1" 
                  step="1"
                  v-model.number="speakersExpected"
                  class="model-selection-dropdown"
                  :disabled="isImporting"
                  required
                />
              </div>

              <div style="display:flex; gap: var(--space-sm); justify-content:center; margin-top: var(--space-sm)">
                <button 
                  @click="transcribeAudio"
                  :disabled="!selectedAudioFile || !isValidSpeakersExpected || isImporting"
                  class="import-button"
                >
                  {{ isImporting ? 'Transcribing...' : 'Transcribe Audio' }}
                </button>
              </div>
              <p class="file-upload-hint">
                Audio transcription is admin-only. After transcription, speakers will be mapped to users.
              </p>
            </div>
          </div>
          
          <!-- Conversation Settings -->
          <div v-if="parsedMessages.length > 0" class="conversation-settings">
            <h4>Conversation Settings</h4>
            
            <!-- Public/Private Toggle -->
            <div class="setting-group">
              <label class="setting-label">Visibility:</label>
              <div class="visibility-toggle">
                <button 
                  @click="isPublic = !isPublic"
                  class="visibility-toggle-button"
                  :class="{ 'public': isPublic, 'private': !isPublic }"
                  :disabled="isImporting"
                >
                  <span class="toggle-slider"></span>
                  <span class="toggle-label">{{ isPublic ? 'Public' : 'Private' }}</span>
                </button>
              </div>
            </div>

            <!-- Recipients -->
            <div class="setting-group">
              <label class="setting-label">Recipients:</label>
              <button 
                class="recipients-button" 
                @click="openRecipientSelector"
                :disabled="isImporting"
              >
                👥 Add Recipients ({{ recipients.length }})
              </button>
              <p class="setting-hint">
                Add users who should have access to this imported conversation
              </p>
            </div>
          </div>

          <!-- Format Detection & Preview -->
          <div v-if="parsedMessages.length > 0" class="import-content-container">
            <div class="import-preview">
              <div class="preview-header">
                <h4>Preview ({{ parsedMessages.length }} messages)</h4>
                <div v-if="formatDetection.hint" class="format-detection" :class="formatDetection.format">
                  <span class="format-icon">{{ getFormatIcon() }}</span>
                  <span class="format-hint">{{ formatDetection.hint }}</span>
                </div>
              </div>
              <div class="preview-messages">
                <div v-for="(msg, index) in parsedMessages" :key="index" class="preview-message">
                  <span class="preview-role">{{ msg.role === 'user' ? 'You' : selectedBot?.display_name || 'AI' }}:</span>
                  <span class="preview-content">{{ truncateContent(msg.content) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Admin Conversation Builder Mode -->
        <div v-else class="admin-builder-mode">
          <h3>Custom Conversation Builder</h3>
          <p class="admin-mode-description">
            Build a conversation message by message. Use + controls to insert messages; speakers are mapped above.
          </p>

          <!-- Speaker Mapping Toggle -->
          <div class="conversation-settings" v-if="builtMessages.length > 0">
            <div class="setting-group" style="display:flex; align-items:center; gap: var(--space-sm); margin-bottom: var(--space-sm)">
              <label class="setting-label" style="margin:0">Use Speaker Mapping</label>
              <input type="checkbox" v-model="speakerMappingEnabled" :disabled="isImporting" />
              <span class="setting-hint">Auto-on after transcription; off enables per-message author selection</span>
            </div>
          </div>

          <!-- Speaker Mapping (after audio transcription) -->
          <div v-if="builtMessages.length > 0 && showSpeakerMappingPanel" class="conversation-settings">
            <h4>Speaker Mapping</h4>
            <div class="setting-group">
              <div v-for="sid in uniqueSpeakerIds" :key="sid" style="display:flex; align-items:center; gap: var(--space-sm); margin-bottom: var(--space-sm)">
                <div style="min-width: 80px; font-weight:600; color: var(--color-primary)">Speaker {{ sid }}</div>
                <div style="flex:1; position:relative">
                  <input 
                    :placeholder="'Search user for speaker ' + sid + '...'"
                    class="author-input"
                    :value="speakerSearchQuery[sid] || ''"
                    @input="onSpeakerSearchInput(sid, $event)"
                    :disabled="isImporting"
                  />
                  <div v-if="speakerIsSearching[sid]" class="search-indicator" title="Searching...">
                    <div class="spinner"></div>
                  </div>
                  <div v-if="(speakerSearchResults[sid] || []).length > 0" class="author-search-results">
                    <div 
                      v-for="u in speakerSearchResults[sid]"
                      :key="u.uid"
                      class="author-search-result"
                      @click="selectSpeakerUser(sid, u)"
                    >
                      <span class="author-name">{{ u.display_name }}</span>
                      <span class="author-tag">@{{ u.user_tag }}</span>
                    </div>
                  </div>
                </div>
                <div style="min-width: 180px; color: var(--color-text-secondary)">
                  <span v-if="speakerRegistry[sid]">Assigned: {{ speakerRegistry[sid].display_name }} (@{{ speakerRegistry[sid].user_tag }})</span>
                  <span v-else>Not assigned</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Built Messages Preview -->
          <div v-if="builtMessages.length > 0" class="built-messages-preview">
            <div class="built-messages-header">
              <h4>Built Conversation ({{ builtMessages.length }} messages)</h4>
              <button 
                @click="clearBuiltMessages"
                class="clear-messages-button"
                :disabled="isImporting"
              >
                🗑️ Clear All
              </button>
            </div>
            
            <div class="built-messages-list">
              <!-- Insert at beginning -->
              <div style="display:flex; justify-content:center; margin-bottom: var(--space-xs)">
                <button class="add-inline-btn" :disabled="isImporting || builtMessages.length >= 50" @click="insertEmptyBuiltMessage(0)" title="Add message at start">+</button>
              </div>
              <div 
                v-for="(msg, index) in builtMessages" 
                :key="index" 
                class="built-message"
              >
                <div class="built-message-header">
                  <span class="built-message-author">
                    <template v-if="speakerMappingEnabled">
                      <template v-if="speakerRegistry[msg.speakerId]">
                        {{ speakerRegistry[msg.speakerId].display_name }} (@{{ speakerRegistry[msg.speakerId].user_tag }})
                      </template>
                      <template v-else>
                        Speaker {{ msg.speakerId }} (unassigned)
                      </template>
                    </template>
                    <template v-else>
                      <template v-if="msg.authorUid">
                        {{ msg.authorName }} (@{{ msg.authorTag }})
                      </template>
                      <template v-else>
                        Author (unassigned)
                      </template>
                    </template>
                  </span>
                  <button 
                    @click="removeBuiltMessage(index)"
                    class="remove-message-button"
                    :disabled="isImporting"
                  >
                    ×
                  </button>
                </div>
                
                <!-- Per-message chooser: speaker dropdown (mapping on) OR author search (mapping off) -->
                <div v-if="speakerMappingEnabled" style="display:flex; align-items:center; gap: var(--space-sm); margin: var(--space-xxs) 0 var(--space-xs) 0">
                  <label class="setting-label" style="margin:0">Speaker:</label>
                  <select v-model="msg.speakerId" class="author-input" :disabled="isImporting">
                    <option v-for="sid in uniqueSpeakerIds" :key="sid" :value="sid">
                      {{ sid }} — {{ (speakerRegistry[sid] && speakerRegistry[sid].display_name) ? speakerRegistry[sid].display_name : 'unassigned' }}
                    </option>
                  </select>
                </div>
                <div v-else class="author-input-wrapper" style="margin: var(--space-xxs) 0 var(--space-xs) 0">
                  <input 
                    :placeholder="'Search author...'"
                    class="author-input"
                    :value="msgAuthorSearchQuery[index] || ''"
                    @input="onMessageAuthorSearchInput(index, $event)"
                    :disabled="isImporting"
                  />
                  <div v-if="msgAuthorIsSearching[index]" class="search-indicator" title="Searching...">
                    <div class="spinner"></div>
                  </div>
                  <div v-if="(msgAuthorSearchResults[index] || []).length > 0" class="author-search-results">
                    <div 
                      v-for="u in msgAuthorSearchResults[index]"
                      :key="u.uid"
                      class="author-search-result"
                      @click="selectMessageAuthor(index, u)"
                    >
                      <span class="author-name">{{ u.display_name }}</span>
                      <span class="author-tag">@{{ u.user_tag }}</span>
                    </div>
                  </div>
                </div>
                <div class="built-message-content" style="background:transparent; padding:0">
                  <textarea 
                    v-model="msg.content"
                    class="message-content-textarea"
                    rows="3"
                    :disabled="isImporting"
                    placeholder="Edit message content..."
                  />
                </div>
                <!-- Insert between -->
                <div style="display:flex; justify-content:center; margin-top: var(--space-xxs)">
                  <button class="add-inline-btn" :disabled="isImporting || builtMessages.length >= 50" @click="insertEmptyBuiltMessage(index + 1)" title="Add message here">+</button>
                </div>
              </div>
            </div>

          </div>

          <!-- Conversation Settings for Admin Mode -->
          <div v-if="builtMessages.length > 0" class="conversation-settings">
            <h4>Conversation Settings</h4>
            
            <!-- Public/Private Toggle -->
            <div class="setting-group">
              <label class="setting-label">Visibility:</label>
              <div class="visibility-toggle">
                <button 
                  @click="isPublic = !isPublic"
                  class="visibility-toggle-button"
                  :class="{ 'public': isPublic, 'private': !isPublic }"
                  :disabled="isImporting"
                >
                  <span class="toggle-slider"></span>
                  <span class="toggle-label">{{ isPublic ? 'Public' : 'Private' }}</span>
                </button>
              </div>
            </div>

            <!-- Recipients -->
            <div class="setting-group">
              <label class="setting-label">Recipients:</label>
              <button 
                class="recipients-button" 
                @click="openRecipientSelector"
                :disabled="isImporting"
              >
                👥 Add Recipients ({{ recipients.length }})
              </button>
              <p class="setting-hint">
                Add users who should have access to this built conversation
              </p>
            </div>
          </div>
        </div>
        
        <!-- Import Errors -->
        <div v-if="importErrors.length > 0" class="import-errors">
          <p class="error-title">Please fix the following issues:</p>
          <ul>
            <li v-for="(error, index) in importErrors" :key="index">{{ error }}</li>
          </ul>
        </div>
        
        <!-- Import Button -->
        <div class="import-button-container">
          <button 
            @click="importConversation"
            :disabled="!canImport || isImporting"
            class="import-button"
            :class="{ 'importing': isImporting, 'disabled': !hasImportPermissions }"
          >
            <span v-if="!isImporting">{{ getImportButtonText() }}</span>
            <span v-else>Importing...</span>
          </button>
          <p v-if="!hasImportPermissions" class="permission-message">
            {{ importPermissionMessage }}
          </p>
        </div>
      </div>
    </div>
    
    <!-- Loading Overlay -->
    <div v-if="isImporting" class="loading-overlay">
      <div class="loading-content">
        <div v-if="importSuccess" class="success-animation">
          <svg class="checkmark" viewBox="0 0 52 52">
            <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
            <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
          <p class="success-message">Import Successful!</p>
          <p class="success-submessage">Redirecting to your imported conversation...</p>
        </div>
        <div v-else>
          <div class="loading-main-line">
            <p class="loading-message">{{ loadingMessage }}</p>
            <div class="import-spinner"></div>
          </div>
          <p class="loading-submessage">{{ loadingSubmessage }}</p>
        </div>
      </div>
    </div>

    <!-- Recipients Modal -->
    <RecipientsModal
      :is-visible="showRecipientSelector"
      :is-public="isPublic"
      :is-add-mode="false"
      @close="closeRecipientSelector"
      @done="closeRecipientSelector"
    />

    <!-- Global Notifications component -->
    <GlobalNotifications />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import FeaturedBotsService from '../../services/FeaturedBotsService.js';
import ImportService from '../../services/ImportService';
import RecipientsModal from '../../components/modals/RecipientsModal.vue';
import GlobalNotifications from '../../components/GlobalNotifications.vue';
import { useBrowserCapabilities } from '../../composables/useBrowserCapabilities.js';
import { dismissMobileKeyboard } from '../../utils/mobileKeyboard.js';
import TranscriptionService from '../../services/TranscriptionService.js';

// Setup store and routing
const store = useStore();
const router = useRouter();

// Browser capabilities detection
const { 
  capabilities, 
  isLowEnd, 
  shouldUseReducedAnimations, 
  getOptimalImageFormat,
  getRecommendedQuality 
} = useBrowserCapabilities();

// Refs
const fileInput = ref(null);
const authorInput = ref(null);
const audioInput = ref(null);

// UI State
const inputMethod = ref('text');
const importText = ref('');
const uploadedFileName = ref('');
const audioFileName = ref('');
const selectedAudioFile = ref(null);
const speakersExpected = ref(null);
const selectedBot = ref('');
const isPublic = ref(false);
const recipients = ref([]);
const showRecipientSelector = ref(false);

// Helper function to open recipient selector with keyboard dismissal
const openRecipientSelector = () => {
  dismissMobileKeyboard();
  showRecipientSelector.value = true;
};

// Admin Mode State
const adminMode = ref(false);
const speakerMappingEnabled = ref(false);

// Admin Builder State
const newMessageAuthor = ref('');
const newMessageContent = ref('');
const selectedAuthor = ref(null);
const builtMessages = ref([]);
const speakerRegistry = ref({});
const speakerSearchResults = ref({});
const speakerSearchQuery = ref({});
const speakerIsSearching = ref({});
// Per-message author search state when mapping is off
const msgAuthorSearchResults = ref({});
const msgAuthorSearchQuery = ref({});
const msgAuthorIsSearching = ref({});

// Author Search State
const authorSearchResults = ref([]);
const isSearchingAuthor = ref(false);
const showAuthorResults = ref(false);
const isAuthorValid = ref(null);
let authorSearchTimeout = null;

// Import State
const isImporting = ref(false);
const parsedMessages = ref([]);
const importErrors = ref([]);
const importSuccess = ref(false);
const loadingMessage = ref('Importing conversation...');
const loadingSubmessage = ref('This will only take a moment');
const formatDetection = ref({ format: 'unknown', confidence: 0, hint: '' });

// Computed properties from store
const user = computed(() => store.getters['auth/user']);
const featuredBots = ref([]);

// Computed property for admin status (scope-derived)
const isAdmin = computed(() => store.getters['auth/isAdmin']);

// Permission: require msg.write to enable import (route is admin-only)
const hasImportPermissions = computed(() => store.getters['auth/hasScope']('msg.write'));

// Computed property for import button state
const canImport = computed(() => {
  if (!hasImportPermissions.value) return false;
  
  if (adminMode.value) {
    // In admin mode, check built messages
    // Require all detected speakers to be assigned (mapping ON) or authors set per message (mapping OFF)
    if (speakerMappingEnabled.value) {
      const allAssigned = uniqueSpeakerIds.value.every(id => !!speakerRegistry.value[id]);
      return builtMessages.value.length > 0 && 
             builtMessages.value.length <= 50 &&
             importErrors.value.length === 0 &&
             allAssigned;
    } else {
      const allHaveAuthors = builtMessages.value.every(m => !!m.authorUid);
      return builtMessages.value.length > 0 && 
             builtMessages.value.length <= 50 &&
             importErrors.value.length === 0 &&
             allHaveAuthors;
    }
  } else {
    // In normal mode, check parsed messages
    return selectedBot.value && 
           parsedMessages.value.length > 0 && 
           parsedMessages.value.length <= 50 &&
           importErrors.value.length === 0;
  }
});

// Computed property for adding builder messages
const canAddBuilderMessage = computed(() => {
  return selectedAuthor.value && 
         newMessageContent.value.trim().length > 0 &&
         builtMessages.value.length < 50;
});

// Computed property for permission error message
const importPermissionMessage = computed(() => {
  if (!user.value) {
    return 'Log in with write permission to import';
  } else if (store.getters['auth/hasScope']('msg.write')) {
    return 'Write permission is already granted';
  } else {
    return 'Write permission required to import';
  }
});

// Methods

// Admin Mode Methods
const toggleAdminMode = () => {
  if (isImporting.value) return;
  
  adminMode.value = !adminMode.value;
  
  // Clear all state when switching modes
  clearAllState();

  // When entering admin mode manually, bootstrap with one empty message
  if (adminMode.value) {
    builtMessages.value = [{ content: '', speakerId: 'A' }];
    speakerRegistry.value = { 'A': null };
    speakerSearchResults.value = { 'A': [] };
    speakerSearchQuery.value = { 'A': '' };
    speakerIsSearching.value = { 'A': false };
    speakerMappingEnabled.value = false; // default OFF for manual mode
  }
};

const clearAllState = () => {
  // Clear normal mode state
  importText.value = '';
  uploadedFileName.value = '';
  audioFileName.value = '';
  selectedAudioFile.value = null;
  speakersExpected.value = null;
  selectedBot.value = '';
  parsedMessages.value = [];
  
  // Clear admin mode state
  newMessageAuthor.value = '';
  newMessageContent.value = '';
  selectedAuthor.value = null;
  builtMessages.value = [];
  clearAuthorSearch();
  speakerRegistry.value = {};
  speakerSearchResults.value = {};
  speakerSearchQuery.value = {};
  speakerIsSearching.value = {};
  
  // Clear common state
  importErrors.value = [];
  formatDetection.value = { format: 'unknown', confidence: 0, hint: '' };
  
  // Clear file input
  if (fileInput.value) {
    fileInput.value.value = '';
  }
  if (audioInput.value) {
    audioInput.value.value = '';
  }
};

// Per-message author search handlers (mapping OFF)
const onMessageAuthorSearchInput = (index, event) => {
  const query = (event.target.value || '').trim();
  msgAuthorSearchQuery.value = { ...msgAuthorSearchQuery.value, [index]: query };
  if (!query) {
    msgAuthorSearchResults.value = { ...msgAuthorSearchResults.value, [index]: [] };
    msgAuthorIsSearching.value = { ...msgAuthorIsSearching.value, [index]: false };
    return;
  }
  msgAuthorIsSearching.value = { ...msgAuthorIsSearching.value, [index]: true };
  setTimeout(async () => {
    try {
      const results = await store.dispatch('auth/searchUsers', query);
      msgAuthorSearchResults.value = { ...msgAuthorSearchResults.value, [index]: results || [] };
    } catch (e) {
      msgAuthorSearchResults.value = { ...msgAuthorSearchResults.value, [index]: [] };
    } finally {
      msgAuthorIsSearching.value = { ...msgAuthorIsSearching.value, [index]: false };
    }
  }, 250);
};

const selectMessageAuthor = (index, user) => {
  const msg = builtMessages.value[index];
  if (!msg) return;
  msg.authorUid = user.uid;
  msg.authorName = user.display_name;
  msg.authorTag = user.user_tag;
  msgAuthorSearchResults.value = { ...msgAuthorSearchResults.value, [index]: [] };
  msgAuthorIsSearching.value = { ...msgAuthorIsSearching.value, [index]: false };
  msgAuthorSearchQuery.value = { ...msgAuthorSearchQuery.value, [index]: `${user.display_name} (@${user.user_tag})` };
};

// Author Search Methods
const searchAuthors = (event) => {
  clearTimeout(authorSearchTimeout);
  const query = event.target.value.trim();
  
  // Clear previous search state
  isSearchingAuthor.value = query.length >= 1;
  
  if (query.length < 1) {
    isAuthorValid.value = null;
    authorSearchResults.value = [];
    showAuthorResults.value = false;
    selectedAuthor.value = null;
    return;
  }
  
  // Set up debounce
  authorSearchTimeout = setTimeout(async () => {
    try {
      isSearchingAuthor.value = true;
      
      // Call API to search users (same as RecipientsModal)
      const results = await store.dispatch('auth/searchUsers', query);
      
      if (!results || !Array.isArray(results)) {
        authorSearchResults.value = [];
        showAuthorResults.value = false;
        isAuthorValid.value = false;
        selectedAuthor.value = null;
      } else {
        authorSearchResults.value = results;
        showAuthorResults.value = results.length > 0;
        isAuthorValid.value = results.length > 0;
        
        // If there's an exact match, pre-select it
        const exactMatch = results.find(user => 
          user.user_tag.toLowerCase() === query.toLowerCase() ||
          user.display_name.toLowerCase() === query.toLowerCase()
        );
        if (exactMatch) {
          selectedAuthor.value = exactMatch;
        } else {
          selectedAuthor.value = null;
        }
      }
      
      isSearchingAuthor.value = false;
    } catch (error) {
      console.error('Error searching authors:', error);
      isAuthorValid.value = false;
      authorSearchResults.value = [];
      showAuthorResults.value = false;
      selectedAuthor.value = null;
      isSearchingAuthor.value = false;
    }
  }, 300); // 300ms debounce
};

const clearAuthorSearch = () => {
  newMessageAuthor.value = '';
  isAuthorValid.value = null;
  authorSearchResults.value = [];
  isSearchingAuthor.value = false;
  showAuthorResults.value = false;
  selectedAuthor.value = null;
};

const selectAuthor = (user) => {
  selectedAuthor.value = user;
  newMessageAuthor.value = `${user.display_name} (@${user.user_tag})`;
  isAuthorValid.value = true;
  
  // Clear search results
  authorSearchResults.value = [];
  showAuthorResults.value = false;
  isSearchingAuthor.value = false;
};

const selectFirstAuthor = () => {
  if (authorSearchResults.value.length > 0) {
    selectAuthor(authorSearchResults.value[0]);
  }
};

// Built Messages Methods
const addBuilderMessage = () => {
  if (!canAddBuilderMessage.value) return;
  
  const message = {
    content: newMessageContent.value.trim(),
    authorUid: selectedAuthor.value.uid,
    authorName: selectedAuthor.value.display_name,
    authorTag: selectedAuthor.value.user_tag
  };
  
  builtMessages.value.push(message);
  
  // Clear the form
  newMessageContent.value = '';
  clearAuthorSearch();
  
  // Clear any errors
  importErrors.value = [];
};

const removeBuiltMessage = (index) => {
  builtMessages.value.splice(index, 1);
};

const clearBuiltMessages = () => {
  builtMessages.value = [];
  importErrors.value = [];
};

const insertEmptyBuiltMessage = (index) => {
  if (isImporting.value || builtMessages.value.length >= 50) return;
  const newMsg = speakerMappingEnabled.value
    ? { content: '', speakerId: uniqueSpeakerIds.value[0] || 'A' }
    : { content: '', authorUid: null, authorName: null, authorTag: null };
  builtMessages.value.splice(index, 0, newMsg);
};

const convertBuiltMessagesToImportFormat = () => {
  if (speakerMappingEnabled.value) {
    return builtMessages.value.map((msg) => {
      const assigned = speakerRegistry.value[msg.speakerId] || null;
      return {
        role: 'user',
        content: msg.content,
        authorUid: assigned ? assigned.uid : null,
        authorName: assigned ? assigned.display_name : null,
        authorTag: assigned ? assigned.user_tag : null
      };
    });
  } else {
    return builtMessages.value.map((msg) => ({
      role: 'user',
      content: msg.content,
      authorUid: msg.authorUid || null,
      authorName: msg.authorName || null,
      authorTag: msg.authorTag || null
    }));
  }
};

// Import Button Text
const getImportButtonText = () => {
  if (adminMode.value) {
    return `Import ${builtMessages.value.length} Built Messages`;
  } else {
    return `Import ${parsedMessages.value.length} Messages`;
  }
};

const truncateContent = (content) => {
  // Clean up content first - remove extra whitespace and normalize line breaks
  const cleanContent = content.replace(/\s+/g, ' ').trim();
  
  // If content is short enough, return as-is
  if (cleanContent.length <= 120) return cleanContent;
  
  // Split into words for better truncation
  const words = cleanContent.split(' ');
  
  // If we have few words, just truncate by character
  if (words.length <= 8) {
    return cleanContent.substring(0, 100) + '...';
  }
  
  // Take first 6 words and last 4 words
  const firstWords = words.slice(0, 6).join(' ');
  const lastWords = words.slice(-4).join(' ');
  
  // Make sure we're not showing too much
  const maxFirstLength = 60;
  const maxLastLength = 40;
  
  const truncatedFirst = firstWords.length > maxFirstLength 
    ? firstWords.substring(0, maxFirstLength).trim() 
    : firstWords;
    
  const truncatedLast = lastWords.length > maxLastLength 
    ? lastWords.substring(-maxLastLength).trim() 
    : lastWords;
  
  return `${truncatedFirst}...${truncatedLast}`;
};

const getFormatIcon = () => {
  switch (formatDetection.value.format) {
    case 'cursor-markdown':
      return '✅';
    case 'chatgpt':
    case 'claude':
    case 'gemini':
      return '✅';
    case 'detected':
      return '✅';
    case 'no-bot-selected':
      return '⚠️';
    case 'generic':
      return '⚠️';
    case 'unknown':
      return '❓';
    default:
      return '💬';
  }
};

// Audio transcription helpers
const handleAudioFileSelect = (event) => {
  const file = event.target.files[0];
  selectedAudioFile.value = file || null;
  audioFileName.value = file ? file.name : '';
};

const transcribeAudio = async () => {
  if (!isAdmin.value || !selectedAudioFile.value || !(Number.isInteger(speakersExpected.value) && speakersExpected.value > 0)) return;
  try {
    isImporting.value = true;
    importSuccess.value = false;
    loadingMessage.value = 'Transcribing audio...';
    loadingSubmessage.value = 'This may take a few moments';

    const resp = await TranscriptionService.transcribe(selectedAudioFile.value, {
      speakers_expected: speakersExpected.value
    });

    const utterances = Array.isArray(resp.utterances) ? resp.utterances : [];
    // Build messages with speakerId clusters
    builtMessages.value = utterances.map(u => ({
      content: u.utterance || '',
      speakerId: u.speaker || 'A',
      authorUid: null,
      authorName: null,
      authorTag: null
    })).filter(m => m.content);

    // Initialize speaker registry for all detected speakers
    const ids = [...new Set(builtMessages.value.map(m => m.speakerId))];
    const initial = {};
    const q = {};
    const sr = {};
    const ss = {};
    ids.forEach(id => { initial[id] = null; q[id] = ''; sr[id] = []; ss[id] = false; });
    speakerRegistry.value = initial;
    speakerSearchQuery.value = q;
    speakerSearchResults.value = sr;
    speakerIsSearching.value = ss;

    // Switch to Admin Builder to replace the transcribe UI with the editor
    adminMode.value = true;
    speakerMappingEnabled.value = true;

    isImporting.value = false;
  } catch (error) {
    console.error('[ImportView] Transcription failed:', error);
    store.commit('ui/SET_ERROR', error?.response?.data?.detail || error.message || 'Transcription failed');
    isImporting.value = false;
  }
};

const uniqueSpeakerIds = computed(() => {
  // Only include defined speaker IDs
  const ids = builtMessages.value.map(m => m.speakerId).filter(id => !!id);
  return [...new Set(ids)];
});

const hasAudioSpeakers = computed(() => uniqueSpeakerIds.value.length > 0);
const showSpeakerMappingPanel = computed(() => speakerMappingEnabled.value && hasAudioSpeakers.value);

// Validate required speakers expected input
const isValidSpeakersExpected = computed(() => Number.isInteger(speakersExpected.value) && speakersExpected.value > 0);

const onSpeakerSearchInput = (sid, event) => {
  const query = (event.target.value || '').trim();
  speakerSearchQuery.value = { ...speakerSearchQuery.value, [sid]: query };
  if (!query) {
    speakerSearchResults.value = { ...speakerSearchResults.value, [sid]: [] };
    speakerIsSearching.value = { ...speakerIsSearching.value, [sid]: false };
    return;
  }
  speakerIsSearching.value = { ...speakerIsSearching.value, [sid]: true };
  // Debounce minimal
  setTimeout(async () => {
    try {
      const results = await store.dispatch('auth/searchUsers', query);
      speakerSearchResults.value = { ...speakerSearchResults.value, [sid]: results || [] };
      speakerIsSearching.value = { ...speakerIsSearching.value, [sid]: false };
    } catch (e) {
      speakerSearchResults.value = { ...speakerSearchResults.value, [sid]: [] };
      speakerIsSearching.value = { ...speakerIsSearching.value, [sid]: false };
    }
  }, 250);
};

const selectSpeakerUser = (sid, user) => {
  speakerRegistry.value = { ...speakerRegistry.value, [sid]: user };
  speakerSearchResults.value = { ...speakerSearchResults.value, [sid]: [] };
  speakerSearchQuery.value = { ...speakerSearchQuery.value, [sid]: `${user.display_name} (@${user.user_tag})` };
};

// Auto-detection and parsing logic
const parseConversation = (text) => {
  if (!text.trim()) {
    return { format: 'unknown', messages: [], hint: 'No text provided' };
  }

  if (!selectedBot.value) {
    return { 
      format: 'no-bot-selected', 
      messages: [], 
      hint: 'Please select an AI assistant first, then upload your conversation file.' 
    };
  }

  // Use the consolidated parsing method
  const botName = selectedBot.value.display_name || '';
  const messages = ImportService.parseConversation(text, botName);
  
  if (messages.length > 0) {
    return { 
      format: 'detected', 
      messages, 
      hint: `Conversation format detected (${messages.length} messages)` 
    };
  }

  return { 
    format: 'unknown', 
    messages: [], 
    hint: 'No conversation format detected. Please check your input.' 
  };
};

// File upload handler
const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) {
    uploadedFileName.value = '';
    importText.value = '';
    parsedMessages.value = [];
    importErrors.value = [];
    formatDetection.value = { format: 'unknown', confidence: 0, hint: '' };
    return;
  }
  
  // Clear text input when file is uploaded
  importText.value = '';
  
  // Validate file type
  const validExtensions = ['.md', '.txt', '.markdown'];
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  
  if (!validExtensions.includes(fileExtension)) {
    importErrors.value = ['Please select a .md, .txt, or .markdown file'];
    uploadedFileName.value = '';
    parsedMessages.value = [];
    formatDetection.value = { format: 'unknown', confidence: 0, hint: 'Invalid file type' };
    return;
  }
  
  // Validate file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    importErrors.value = ['File is too large (max 10MB)'];
    uploadedFileName.value = '';
    parsedMessages.value = [];
    formatDetection.value = { format: 'unknown', confidence: 0, hint: 'File too large' };
    return;
  }
  
  try {
    const content = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
    
    uploadedFileName.value = file.name;
    
    // Parse the file content
    const result = parseConversation(content);
    formatDetection.value = result;
    parsedMessages.value = result.messages;
    
    // Handle specific error cases
    if (result.format === 'no-bot-selected') {
      importErrors.value = ['Please select an AI assistant from the dropdown above before uploading your conversation file.'];
      return;
    }
    
    // Validate messages
    const validation = ImportService.validateMessages(result.messages);
    importErrors.value = validation.errors;
    
  } catch (error) {
    console.error('[DEBUG ImportView] Error reading file:', error);
    importErrors.value = ['Failed to read file'];
    uploadedFileName.value = '';
    parsedMessages.value = [];
    formatDetection.value = { format: 'unknown', confidence: 0, hint: 'Read error' };
  }
};

// Recipients modal handlers
const closeRecipientSelector = () => {
  showRecipientSelector.value = false;
};

// Main import function
const importConversation = async () => {
  if (!canImport.value || isImporting.value) return;
  
  try {
    isImporting.value = true;
    importSuccess.value = false;
    
    if (adminMode.value) {
      // In admin mode, convert built messages to import format
      const messagesToImport = convertBuiltMessagesToImportFormat();
      const messageCount = messagesToImport.length;
      loadingMessage.value = `Importing ${messageCount} built messages...`;
      
      if (capabilities.isLowBandwidth) {
        loadingSubmessage.value = 'Processing conversation (this may take longer on slow connections)';
      } else if (isLowEnd()) {
        loadingSubmessage.value = 'Processing your conversation (optimizing for your device)';
      } else if (messageCount > 20) {
        loadingSubmessage.value = 'Processing large conversation - this may take a moment';
      } else {
        loadingSubmessage.value = 'Processing your custom conversation';
      }
      
      // Use the unified import method (no selectedBot required for admin mode)
      const result = await ImportService.importConversation(
        messagesToImport,
        null, // selectedBot not required for admin mode
        recipients.value,
        isPublic.value
      );
      
      if (result.success && result.thread_id) {
        importSuccess.value = true;
        loadingMessage.value = 'Import Successful!';
        loadingSubmessage.value = 'Redirecting to your imported conversation...';
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        router.push({ path: `/messages/${result.thread_id}` });
        
        // Show appropriate success message
        if (result.partial_success) {
          store.commit('ui/SET_WARNING', 
            `Imported ${result.message_count} of ${result.total_requested} messages. Some messages failed to import.`
          );
        } else {
          store.commit('ui/SET_SUCCESS', 
            `Successfully imported ${result.message_count} messages`
          );
        }
      } else {
        throw new Error('Import returned unexpected result');
      }
    } else {
      // In normal mode, import parsed messages
      const messageCount = parsedMessages.value.length;
      loadingMessage.value = `Importing ${messageCount} messages...`;
      
      if (capabilities.isLowBandwidth) {
        loadingSubmessage.value = 'Processing conversation (this may take longer on slow connections)';
      } else if (isLowEnd()) {
        loadingSubmessage.value = 'Processing your conversation (optimizing for your device)';
      } else if (messageCount > 20) {
        loadingSubmessage.value = 'Processing large conversation - this may take a moment';
      } else {
        loadingSubmessage.value = `Processing your ${selectedBot.value.display_name} conversation`;
      }
      
      // Use the unified import method
      const result = await ImportService.importConversation(
        parsedMessages.value,
        selectedBot.value,
        recipients.value,
        isPublic.value
      );
      
      if (result.success && result.thread_id) {
        importSuccess.value = true;
        loadingMessage.value = 'Import Successful!';
        loadingSubmessage.value = 'Redirecting to your imported conversation...';
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        router.push({ path: `/messages/${result.thread_id}` });
        
        // Show appropriate success message
        if (result.partial_success) {
          store.commit('ui/SET_WARNING', 
            `Imported ${result.message_count} of ${result.total_requested} messages. Some messages failed to import.`
          );
        } else {
          store.commit('ui/SET_SUCCESS', 
            `Successfully imported ${result.message_count} messages`
          );
        }
      } else {
        throw new Error('Import returned unexpected result');
      }
    }
  } catch (error) {
    console.error('Import failed:', error);
    
    let errorMessage = 'Failed to import conversation';
    
    if (error.response?.status === 429) {
      errorMessage = error.response.data?.detail || 'You have exceeded the import rate limit. Please try again later.';
    } else if (error.response?.status === 403) {
      errorMessage = 'You do not have permission to import conversations. Only users with import permissions can import.';
    } else if (error.response?.status === 400) {
      errorMessage = error.response.data?.detail || 'Invalid conversation format.';
    } else if (error.response?.data?.detail) {
      errorMessage = error.response.data.detail;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    store.commit('ui/SET_ERROR', errorMessage);
    
    isImporting.value = false;
    importSuccess.value = false;
  }
};

// Watch for input changes
watch([importText, selectedBot], () => {
  if (importText.value.trim() && selectedBot.value) {
    // Clear file upload when typing
    if (uploadedFileName.value) {
      uploadedFileName.value = '';
      if (fileInput.value) {
        fileInput.value.value = '';
      }
    }
    
    const result = parseConversation(importText.value);
    formatDetection.value = result;
    parsedMessages.value = result.messages;
    
    const validation = ImportService.validateMessages(result.messages);
    importErrors.value = validation.errors;
  } else {
    parsedMessages.value = [];
    importErrors.value = [];
    formatDetection.value = { format: 'unknown', confidence: 0, hint: '' };
  }
});

// Load featured bots on mount
onMounted(async () => {
  try {
    featuredBots.value = await FeaturedBotsService.listFeaturedBots();
  } catch (e) {
    featuredBots.value = [];
  }
});

// Watch for input method changes
watch(inputMethod, () => {
  // Clear data when switching input methods
  importText.value = '';
  uploadedFileName.value = '';
  parsedMessages.value = [];
  importErrors.value = [];
  formatDetection.value = { format: 'unknown', confidence: 0, hint: '' };
  if (fileInput.value) {
    fileInput.value.value = '';
  }
});

// Connect recipients to store
watch(() => store.getters['navigation/replyRecipients'], (newRecipients) => {
  recipients.value = newRecipients;
}, { immediate: true });
</script>

<style scoped>
.import-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: relative;
  overflow-y: auto;
}

.import-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-sm);
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-surface);
  z-index: 5;
  position: sticky;
  top: 0;
}

.back-button {
  padding: var(--space-xs) var(--space-sm);
  background-color: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text);
  transition: background-color var(--transition-fast);
}

.back-button:hover {
  background-color: var(--color-hover-overlay);
}

.import-title {
  margin: 0;
  color: var(--color-primary);
  font-size: var(--font-size-lg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.service-selector-container {
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-surface-light);
}

.service-selector-label {
  display: block;
  margin-bottom: var(--space-xs);
  font-weight: 600;
  color: var(--color-text);
  font-size: var(--font-size-md);
}

.service-dropdown {
  width: 100%;
  max-width: 300px;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: border-color var(--transition-fast);
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
  background-position: right var(--space-sm) center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-right: calc(var(--space-xl) + var(--space-sm));
}

.service-dropdown:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
}

.service-dropdown:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: var(--color-border-light);
}

.import-content {
  flex: 1;
  padding: var(--space-lg);
  min-height: 0;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.import-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.import-panel h3 {
  color: var(--color-primary);
  margin: 0 0 var(--space-sm) 0;
  font-size: var(--font-size-xl);
  text-align: center;
}

.under-development {
  color: var(--color-text-secondary);
  font-style: italic;
  font-size: var(--font-size-md);
  text-align: center;
  padding: var(--space-xl);
}

.import-instructions {
  margin-bottom: var(--space-md);
  text-align: left;
}

.import-instructions ol {
  margin: var(--space-sm) 0;
  padding-left: var(--space-lg);
}

.import-instructions li {
  margin: var(--space-xs) 0;
  color: var(--color-text);
}

.import-warning {
  font-size: var(--font-size-sm);
  color: var(--color-warning);
  font-weight: 500;
  margin-top: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  background-color: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: var(--radius-xs);
  text-align: center;
}

.import-content-container {
  margin-bottom: var(--space-md);
}

.import-textarea {
  width: 100%;
  height: 250px;
  padding: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: monospace;
  font-size: var(--font-size-md);
  resize: vertical;
  background-color: var(--color-surface);
  color: var(--color-text);
  transition: border-color var(--transition-fast);
}

.import-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
}

.import-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.import-or-divider {
  display: flex;
  align-items: center;
  margin: var(--space-md) 0;
  text-align: center;
}

.import-or-divider::before,
.import-or-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.import-or-divider span {
  padding: 0 var(--space-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  background-color: var(--color-surface);
}

.file-upload-container {
  margin-bottom: var(--space-md);
  position: relative;
}

.file-input {
  display: none;
}

.file-upload-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-light);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: var(--font-size-md);
  color: var(--color-text);
  min-height: 60px;
}

.file-upload-label:hover:not(.disabled) {
  border-color: var(--color-primary);
  background-color: rgba(var(--color-primary-rgb), 0.05);
}

.file-upload-label.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.file-icon {
  font-size: var(--font-size-xl);
  opacity: 0.7;
}

.model-selection-container {
  margin-bottom: var(--space-md);
  padding: var(--space-sm);
  background-color: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.model-selection-label {
  display: block;
  margin-bottom: var(--space-xs);
  font-weight: 600;
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.add-inline-btn {
  font-size: var(--font-size-sm);
  cursor: pointer;
  padding: 0;
  transition: all var(--transition-fast);
  line-height: .6em;
  min-width: 1.4em;
  height: 1.4em;
}

.model-selection-dropdown {
  width: 100%;
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: border-color var(--transition-fast);
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
  background-position: right var(--space-sm) center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-right: calc(var(--space-xl) + var(--space-sm));
}

.model-selection-dropdown:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
}

.model-selection-dropdown:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: var(--color-border-light);
}

.import-preview {
  background-color: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-md);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.import-preview h4 {
  margin: 0;
  color: var(--color-primary);
  font-size: var(--font-size-md);
}

.preview-messages {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  max-height: 400px;
  overflow-y: auto;
  padding-right: var(--space-sm);
}

.preview-messages::-webkit-scrollbar {
  width: 8px;
}

.preview-messages::-webkit-scrollbar-track {
  background: var(--color-surface-light);
  border-radius: var(--radius-sm);
}

.preview-messages::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: var(--radius-sm);
}

.preview-messages::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-dark);
}

.preview-message {
  display: flex;
  gap: var(--space-xs);
  font-size: var(--font-size-sm);
  line-height: 1.4;
  padding: var(--space-xs);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
}

.preview-message:nth-child(even) {
  background-color: var(--color-surface-light);
}

.preview-role {
  font-weight: 600;
  color: var(--color-primary);
  min-width: 80px;
  flex-shrink: 0;
  text-align: right;
}

.preview-content {
  color: var(--color-text-secondary);
  word-break: break-word;
  text-align: left;
  flex: 1;
}

.import-errors {
  background-color: rgba(220, 38, 38, 0.1);
  border: 1px solid var(--color-error);
  border-radius: var(--radius-sm);
  padding: var(--space-md);
  margin-bottom: var(--space-md);
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
  20%, 40%, 60%, 80% { transform: translateX(2px); }
}

.error-title {
  margin: 0 0 var(--space-xs) 0;
  color: var(--color-error);
  font-weight: 600;
  font-size: var(--font-size-sm);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.error-title::before {
  content: "⚠️";
  font-size: var(--font-size-lg);
}

.import-errors ul {
  margin: 0;
  padding-left: var(--space-lg);
}

.import-errors li {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  margin: var(--space-xs) 0;
  line-height: 1.4;
}

.import-button {
  padding: var(--space-sm) var(--space-lg);
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-width: 160px;
}

.import-button:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.import-button:disabled {
  background-color: var(--color-border);
  color: var(--color-text-secondary);
  cursor: not-allowed;
  transform: none;
}

.import-button.importing {
  background-color: var(--color-accent);
  cursor: wait;
}

.import-button.disabled {
  background-color: var(--color-border);
  color: var(--color-text-secondary);
}

.import-button-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  align-items: center;
  margin-top: var(--space-md);
  margin-bottom: 50px;
}

.permission-message {
  text-align: center;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  margin: 0;
  padding: var(--space-xs) var(--space-sm);
  background-color: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  max-width: 300px;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--z-index-modal);
  backdrop-filter: blur(3px);
}

.loading-content {
  background-color: var(--color-surface);
  padding: var(--space-xl);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 400px;
  width: 90%;
  text-align: center;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.loading-main-line {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-xs);
  width: 100%;
}

.import-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border);
  border-top: 3px solid var(--color-accent);
  border-radius: 50%;
  animation: import-spin 1.2s linear infinite;
  margin-left: var(--space-sm);
}

.loading-message {
  font-size: var(--font-size-lg);
  font-weight: bold;
  margin: 0;
  color: var(--color-text);
}

.loading-submessage {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.success-animation {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.checkmark {
  width: 80px;
  height: 80px;
}

.checkmark-circle {
  stroke-dasharray: 166;
  stroke-dashoffset: 166;
  stroke-width: 2;
  stroke-miterlimit: 10;
  stroke: #10a37f;
  fill: none;
  animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
}

.checkmark-check {
  transform-origin: 50% 50%;
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  stroke: #10a37f;
  stroke-width: 3;
  animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
}

@keyframes stroke {
  100% {
    stroke-dashoffset: 0;
  }
}

@keyframes import-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.success-message {
  font-size: var(--font-size-xl);
  font-weight: bold;
  color: #10a37f;
  margin: 0;
}

.success-submessage {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.format-detection {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xxs) var(--space-xs);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
}

.format-detection.standalone {
  margin-bottom: var(--space-md);
}

.format-detection.standard,
.format-detection.openai,
.format-detection.anthropic,
.format-detection.chatgpt-web,
.format-detection.explicit-markers {
  background-color: rgba(16, 163, 127, 0.1);
  border: 1px solid rgba(16, 163, 127, 0.3);
  color: #10a37f;
}

.format-detection.partial {
  background-color: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  color: var(--color-warning);
}

.format-detection.unstructured,
.format-detection.unknown {
  background-color: rgba(108, 117, 125, 0.1);
  border: 1px solid rgba(108, 117, 125, 0.3);
  color: var(--color-text-secondary);
}

.format-icon {
  font-size: var(--font-size-lg);
}

.format-hint {
  flex: 1;
}

/* Bot Selection */
.bot-selection-container {
  margin-bottom: var(--space-lg);
  padding: var(--space-md);
  background-color: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.bot-selection-label {
  display: block;
  margin-bottom: var(--space-xs);
  font-weight: 600;
  color: var(--color-text);
  font-size: var(--font-size-md);
}

.bot-selection-dropdown {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: border-color var(--transition-fast);
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
  background-position: right var(--space-sm) center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-right: calc(var(--space-xl) + var(--space-sm));
}

.bot-selection-dropdown:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
}

.bot-selection-dropdown:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: var(--color-border-light);
}

.bot-selection-hint {
  margin-top: var(--space-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-style: italic;
}

/* Input Method Tabs */
.input-method-container {
  margin-bottom: var(--space-lg);
}

.input-method-tabs {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: var(--space-md);
  background-color: var(--color-surface);
}

.input-method-tab {
  flex: 1;
  padding: var(--space-sm) var(--space-md);
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
    font-size: var(--font-size-md);
  font-weight: 500;
  position: relative;
}

.input-method-tab:not(:last-child) {
  border-right: 1px solid var(--color-border);
}

.input-method-tab.active {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  font-weight: 600;
}

.input-method-tab:hover:not(.active) {
  background-color: var(--color-hover-overlay);
  color: var(--color-text);
}

/* Text Input Container */
.text-input-container {
  width: 100%;
}

/* File Upload Container */
.file-upload-container {
  width: 100%;
}

.file-upload-hint {
  margin-top: var(--space-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-align: center;
  font-style: italic;
}

/* Conversation Settings */
.conversation-settings {
  margin-bottom: var(--space-lg);
  padding: var(--space-md);
  background-color: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.conversation-settings h4 {
  margin: 0 0 var(--space-md) 0;
  color: var(--color-primary);
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.setting-group {
  margin-bottom: var(--space-md);
}

.setting-group:last-child {
  margin-bottom: 0;
}

.setting-label {
  display: block;
  margin-bottom: var(--space-xs);
  font-weight: 600;
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.setting-hint {
  margin-top: var(--space-xs);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-style: italic;
}

/* Visibility Toggle */
.visibility-toggle {
  display: flex;
  align-items: center;
}

.visibility-toggle-button {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: transparent;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-weight: 500;
  min-width: 120px;
  justify-content: center;
}

.visibility-toggle-button:hover:not(:disabled) {
  background-color: var(--color-hover-overlay);
  border-color: var(--color-border-hover);
}

.visibility-toggle-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.visibility-toggle-button.public {
  background-color: rgba(16, 163, 127, 0.1);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.visibility-toggle-button.private {
  background-color: rgba(108, 117, 125, 0.1);
  border-color: var(--color-border);
  color: var(--color-text-secondary);
}

.toggle-slider {
  position: relative;
  width: 20px;
  height: 12px;
  background-color: var(--color-border);
  border-radius: 6px;
  transition: all var(--transition-fast);
}

.toggle-slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 8px;
  height: 8px;
  background-color: var(--color-surface);
  border-radius: 50%;
  transition: all var(--transition-fast);
}

.visibility-toggle-button.public .toggle-slider {
  background-color: var(--color-primary);
}

.visibility-toggle-button.public .toggle-slider::before {
  transform: translateX(8px);
}

.toggle-label {
  font-weight: 600;
}

/* Recipients Button */
.recipients-button {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-weight: 500;
}

.recipients-button:hover:not(:disabled) {
  background-color: var(--color-hover-overlay);
  border-color: var(--color-border-hover);
}

.recipients-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}



/* Updated Import Button */
.import-button-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  align-items: center;
  margin-top: var(--space-lg);
  margin-bottom: 50px;
}

.import-button {
  padding: var(--space-md) var(--space-xl);
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
    font-size: var(--font-size-lg);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-width: 200px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.import-button:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.import-button:disabled {
  background-color: var(--color-border);
  color: var(--color-text-secondary);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.import-button.importing {
  background-color: var(--color-accent);
  cursor: wait;
}

.import-button.disabled {
  background-color: var(--color-border);
  color: var(--color-text-secondary);
}

/* Admin Mode Toggle */
.admin-mode-toggle {
  margin-left: auto;
}

.admin-toggle-button {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  background: transparent;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.admin-toggle-button:hover:not(:disabled) {
  background-color: var(--color-hover-overlay);
  border-color: var(--color-border-hover);
  color: var(--color-text);
}

.admin-toggle-button.active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.admin-toggle-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-icon {
  font-size: var(--font-size-md);
}

.toggle-text {
  white-space: nowrap;
}

/* Admin Builder Mode */
.admin-builder-mode {
  width: 100%;
}

.admin-mode-description {
  color: var(--color-text-secondary);
  font-style: italic;
  margin-bottom: var(--space-lg);
  text-align: center;
  padding: var(--space-sm);
  background-color: var(--color-surface-light);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

/* Message Builder */
.message-builder {
  background-color: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-md);
  margin-bottom: var(--space-lg);
}

.message-builder h4 {
  margin: 0 0 var(--space-md) 0;
  color: var(--color-primary);
  font-size: var(--font-size-lg);
  font-weight: 600;
}

/* Author Selection */
.author-selection-container {
  margin-bottom: var(--space-md);
}

.author-selection-label {
  display: block;
  margin-bottom: var(--space-xs);
  font-weight: 600;
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.author-input-wrapper {
  position: relative;
}

.author-input {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  padding-right: calc(var(--space-xl) + var(--space-sm));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-md);
  transition: border-color var(--transition-fast);
}

.author-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
}

.author-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: var(--color-border-light);
}

/* Author Search Results */
.author-search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-top: none;
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
  max-height: 200px;
  overflow-y: auto;
}

.author-search-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  border-bottom: 1px solid var(--color-border-light);
}

.author-search-result:last-child {
  border-bottom: none;
}

.author-search-result:hover {
  background-color: var(--color-hover-overlay);
}

.author-name {
  font-weight: 500;
  color: var(--color-text);
}

.author-tag {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

/* Message Content */
.message-content-container {
  margin-bottom: var(--space-md);
}

.message-content-label {
  display: block;
  margin-bottom: var(--space-xs);
  font-weight: 600;
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.message-content-textarea {
  width: 100%;
  padding: var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-family: inherit;
  resize: vertical;
  min-height: 100px;
  transition: border-color var(--transition-fast);
}

.message-content-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
}

.message-content-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: var(--color-border-light);
}

/* Add Message Button */
.add-message-container {
  display: flex;
  justify-content: center;
}

.add-message-button {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-lg);
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.add-message-button:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.add-message-button:disabled {
  background-color: var(--color-border);
  color: var(--color-text-secondary);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.add-icon {
  font-size: var(--font-size-lg);
}

/* Built Messages Preview */
.built-messages-preview {
  background-color: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-md);
  margin-bottom: var(--space-lg);
}

.built-messages-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
  gap: var(--space-sm);
}

.built-messages-header h4 {
  margin: 0;
  color: var(--color-primary);
  font-size: var(--font-size-md);
  font-weight: 600;
}

.clear-messages-button {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  background: transparent;
  border: 1px solid var(--color-error);
  border-radius: var(--radius-sm);
  color: var(--color-error);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.clear-messages-button:hover:not(:disabled) {
  background-color: rgba(220, 38, 38, 0.1);
}

.clear-messages-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Built Messages List */
.built-messages-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  max-height: 400px;
  overflow-y: auto;
  padding-right: var(--space-sm);
}

.built-messages-list::-webkit-scrollbar {
  width: 8px;
}

.built-messages-list::-webkit-scrollbar-track {
  background: var(--color-surface-light);
  border-radius: var(--radius-sm);
}

.built-messages-list::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: var(--radius-sm);
}

.built-messages-list::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-dark);
}

.built-message {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-sm);
}

.built-message-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-xs);
  gap: var(--space-sm);
}

.built-message-author {
  font-weight: 600;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
}

.remove-message-button {
  padding: var(--space-xxs) var(--space-xs);
  background: transparent;
  border: 1px solid var(--color-error);
  border-radius: var(--radius-xs);
  color: var(--color-error);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  line-height: 1;
  min-width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-message-button:hover:not(:disabled) {
  background-color: rgba(220, 38, 38, 0.1);
}

.remove-message-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.built-message-content {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  padding: var(--space-xs);
  background-color: var(--color-surface-light);
  border-radius: var(--radius-xs);
}

/* Normal Import Mode */
.normal-import-mode {
  width: 100%;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .input-method-tabs {
    flex-direction: column;
  }
  
  .input-method-tab:not(:last-child) {
    border-right: none;
    border-bottom: 1px solid var(--color-border);
  }
  
  .bot-selection-dropdown {
    font-size: var(--font-size-sm);
    padding: var(--space-xs) var(--space-sm);
    padding-right: calc(var(--space-lg) + var(--space-sm));
  }
  
  .conversation-settings {
    padding: var(--space-sm);
  }
  
  .import-button {
    width: 100%;
    font-size: var(--font-size-md);
    padding: var(--space-sm) var(--space-lg);
  }

  /* Admin Mode Mobile Responsive */
  .admin-mode-toggle {
    margin-left: 0;
    margin-top: var(--space-xs);
  }
  
  .import-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-xs);
  }
  
  .admin-toggle-button {
    font-size: var(--font-size-xs);
    padding: var(--space-xxs) var(--space-xs);
  }
  
  .built-messages-header {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-xs);
  }
  
  .built-messages-header h4 {
    text-align: center;
  }
  
  .clear-messages-button {
    align-self: center;
  }
  
  .built-message-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-xs);
  }
  
  .author-search-results {
    position: fixed;
    left: var(--space-sm);
    right: var(--space-sm);
    z-index: 100;
  }
}

@media (max-width: 480px) {
  .bot-selection-container {
    padding: var(--space-sm);
  }
  
  .conversation-settings {
    padding: var(--space-xs);
  }
  
  .setting-group {
    margin-bottom: var(--space-sm);
  }
  
  .recipients-button {
    width: 100%;
    justify-content: center;
    padding: var(--space-sm);
  }
  
  .import-button {
    font-size: var(--font-size-sm);
    padding: var(--space-xs) var(--space-md);
  }

  /* Admin Mode Mobile Responsive 480px */
  .message-builder {
    padding: var(--space-sm);
  }
  
  .built-messages-preview {
    padding: var(--space-sm);
  }
  
  .add-message-button {
    width: 100%;
    justify-content: center;
  }
  
  .author-input {
    font-size: var(--font-size-sm);
  }
  
  .message-content-textarea {
    font-size: var(--font-size-sm);
  }
}

/* Dark theme */
@media (prefers-color-scheme: dark) {
  .import-header {
    background-color: #000000;
  }
  
  .service-selector-container {
    background-color: #1a1a1a;
  }
  
  .loading-content {
    background-color: var(--surface-color-dark, #222);
    border: 1px solid var(--border-color-dark, #444);
  }
  
  .loading-message {
    color: var(--text-color-dark, #eee);
  }
  
  .loading-submessage {
    color: var(--text-color-light-dark, #aaa);
  }
  
  .import-spinner {
    border-color: rgba(255, 255, 255, 0.1);
    border-top-color: #10a37f;
  }
  
  .import-textarea {
    background-color: #1a1a1a;
    border-color: #333;
    color: #eee;
  }
  
  .import-textarea:focus {
    border-color: #10a37f;
    box-shadow: 0 0 0 2px rgba(16, 163, 127, 0.2);
  }
  
  .import-preview {
    background-color: #1a1a1a;
    border-color: #333;
  }
  
  .model-selection-container {
    background-color: #1a1a1a;
    border-color: #333;
  }
  
  .import-errors {
    background-color: rgba(220, 38, 38, 0.1);
    border-color: #dc2626;
  }
  
  .import-button:not(:disabled) {
    background-color: #10a37f;
  }
  
  .import-button:hover:not(:disabled) {
    background-color: #0e906e;
  }
  
  .import-button:disabled {
    background-color: #333;
    color: #666;
  }

  /* Admin Mode Dark Theme */
  .admin-mode-description {
    background-color: #1a1a1a;
    border-color: #333;
  }
  
  .message-builder {
    background-color: #1a1a1a;
    border-color: #333;
  }
  
  .author-input {
    background-color: #1a1a1a;
    border-color: #333;
    color: #eee;
  }
  
  .author-input:focus {
    border-color: #10a37f;
    box-shadow: 0 0 0 2px rgba(16, 163, 127, 0.2);
  }
  
  .author-search-results {
    background-color: #1a1a1a;
    border-color: #333;
  }
  
  .author-search-result:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .message-content-textarea {
    background-color: #1a1a1a;
    border-color: #333;
    color: #eee;
  }
  
  .message-content-textarea:focus {
    border-color: #10a37f;
    box-shadow: 0 0 0 2px rgba(16, 163, 127, 0.2);
  }
  
  .built-messages-preview {
    background-color: #1a1a1a;
    border-color: #333;
  }
  
  .built-message {
    background-color: #222;
    border-color: #444;
  }
  
  .built-message-content {
    background-color: #1a1a1a;
  }
  
  .add-message-button:not(:disabled) {
    background-color: #10a37f;
  }
  
  .add-message-button:hover:not(:disabled) {
    background-color: #0e906e;
  }
  
  .add-message-button:disabled {
    background-color: #333;
    color: #666;
  }
}
</style>
