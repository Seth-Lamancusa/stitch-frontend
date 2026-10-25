<template>
  <div class="reply-box-wrapper">
    <!-- Backdrop overlay -->
    <div 
      v-if="isReplying || isNewThread" 
      class="reply-backdrop"
    ></div>
    
    <!-- Bottom sheet -->
    <div 
      v-if="isReplying || isNewThread" 
      class="reply-sheet"
      :class="{ 
        'reply-sheet--raised': isKeyboardVisible,
        'reply-sheet--visible': isReplying || isNewThread,
        'reply-sheet--closing': isReplyBoxClosing
      }"
      :style="replySheetStyle"
      ref="replySheet"
      role="dialog"
      aria-labelledby="reply-header"
      aria-modal="true"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      
      <!-- Header row -->
      <div class="reply-sheet__header" id="reply-header">
        <div class="reply-sheet__header-left">
          <span class="reply-sheet__title">{{ replyHeaderText }}</span>
        </div>
        <div class="reply-sheet__header-right">
          <!-- Close button (hidden in new thread view - reply box is not closable there) -->
          <button 
            v-if="!isNewThread"
            class="reply-sheet__close-button"
            @click.stop="hideBottomSheet"
            :aria-label="'Close reply box'"
          >
            ×
          </button>
        </div>
      </div>
      
      <!-- Controls toolbar above input -->
      <div class="reply-sheet__toolbar">
        <!-- Left side controls -->
        <div class="toolbar-left">
          <!-- Public visibility globe toggle -->
          <button 
            class="toolbar-control meta-pill visibility-globe-toggle no-drag" 
            @pointerdown.stop.prevent="handleVisibilityToggle('pointer')"
            @click.capture.stop
            @mousedown.stop.prevent
            @touchend.stop.prevent
            @keydown.enter.prevent="handleVisibilityToggle('kbd')"
            @keydown.space.prevent="handleVisibilityToggle('kbd')"
            :class="{ 'active': isPublic }"
            :disabled="!canInteract"
            :aria-pressed="isPublic"
            aria-label="Toggle public visibility"
            title="Public"
          >
            <span class="meta-pill__icon">🌐</span>
            <span class="meta-pill__text">Public</span>
          </button>
          
          <!-- Draft Tags button -->
          <button 
            class="toolbar-control meta-pill" 
            @click="toggleTagsModal"
            :disabled="!canInteract"
            :aria-expanded="showTagsModal"
            aria-label="Manage draft tags"
            title="Tags"
          >
            <span class="meta-pill__icon"><strong>#</strong></span>
            <span class="meta-pill__text">Tags ({{ replyTags.length }})</span>
          </button>
          
          <!-- Recipients button -->
          <button 
            class="toolbar-control meta-pill" 
            @click="toggleRecipientSelector"
            :disabled="!canInteract"
            :aria-expanded="showRecipientSelector"
            aria-label="Manage recipients"
          >
            <span class="meta-pill__icon">👥</span>
            <span class="meta-pill__text">Recipients ({{ recipients.length }})</span>
          </button>
          
          <!-- Channels button -->
          <button 
            class="toolbar-control meta-pill" 
            @click="toggleChannelsModal"
            :disabled="!canInteract"
            :aria-expanded="showChannelsModal"
            aria-label="Manage channels"
            title="Channels"
          >
            <span class="meta-pill__icon">📢</span>
            <span class="meta-pill__text">Channels ({{ replyChannels.length }})</span>
          </button>
          
          <!-- Attachment button -->
          <input 
            ref="fileInput"
            type="file" 
            accept="application/pdf,image/*,text/plain,audio/*,.txt,.py,.pdf,.jpg,.jpeg,.png,.gif,.webp,.mp3,.wav,.ogg,.flac,.aac,.mp4,.m4a"
            multiple
            style="display: none"
            @change="handleFileSelect"
          />
          <button 
            class="toolbar-control meta-pill"
            @click="fileInput?.click()"
            :disabled="!canInteract || uploading"
            aria-label="Attach files"
            title="Attach files"
          >
            <span class="meta-pill__icon">📎</span>
            <span class="meta-pill__text">{{ uploading ? 'Uploading...' : `Attach (${attachments.length})` }}</span>
          </button>
          
          <!-- Prompt moved to MessageNode. Keeping spacing consistent. -->
        </div>


      </div>
      
      <!-- Attachment preview -->
      <div v-if="attachments.length > 0" class="attachment-preview">
        <div v-for="(att, index) in attachments" :key="att.id || att.gcs_path || att.url || att.name || index" class="attachment-item">
          <span class="attachment-preview-icon" aria-hidden="true">{{ getIcon(att) }}</span>
          <div class="attachment-info">
            <span class="attachment-name">{{ att.name || att.filename }}</span>

            <div v-if="att.isUploading" class="attachment-progress">
              <span class="attachment-progress-text">
                {{ typeof att.progress === 'number' ? `${att.progress}%` : 'Uploading...' }}
              </span>
              <div class="attachment-progress-bar" role="progressbar" :aria-valuenow="att.progress || 0" aria-valuemin="0" aria-valuemax="100">
                <div class="attachment-progress-fill" :style="{ width: `${att.progress || 0}%` }"></div>
              </div>
            </div>

            <span v-else-if="att.size" class="attachment-size">{{ formatFileSize(att.size) }}</span>
          </div>
          <button 
            type="button" 
            @click="removeAttachment(index)"
            class="attachment-remove"
            aria-label="Remove attachment"
          >
            ✕
          </button>
        </div>
      </div>
      
      <!-- Text area - hidden in add recipients mode -->
      <div v-if="!isAddRecipientsMode" class="reply-sheet__textarea-container">
        
        <!-- Subject Input -->
        <div v-if="!showVerifyCTA && showSubject" class="subject-input-wrapper">
          <input 
            ref="subjectInput"
            v-model="subject" 
            placeholder="Subject" 
            class="reply-sheet__subject-input"
            :class="{ 'subject-input--error': subject.length > 72 }"
            maxlength="72"
            aria-label="Message subject"
          />
          <span class="subject-char-count" :class="{ 'subject-char-count--error': subject.length > 72 }">
            {{ subject.length }}/72
          </span>
        </div>

        <div class="reply-input-row">
          <div v-if="showVerifyCTA" class="verify-cta" role="button" tabindex="0" @click.stop.prevent="handleVerifyClick" aria-label="Verify your email to get started">
            <span class="verify-cta__text">Verify your email to get started!</span>
          </div>
          <div v-else class="textarea-wrapper" ref="textareaWrapper">
            <div
              class="reply-overlay"
              aria-hidden="true"
              ref="highlightOverlay"
              v-html="overlayHtml"
            ></div>
            <textarea 
              v-model="content" 
              :placeholder="placeholderText" 
              class="reply-sheet__textarea"
              ref="replyTextarea"
              :maxlength="MAX_MESSAGE_CONTENT_LENGTH"
              @keydown="handleTextareaKeyDown"
              @keyup="handleTextareaKeyUp"
              @click="handleTextareaClick"
              @focus="handleTextareaFocus"
              @blur="handleTextareaBlur"
              @input="handleTextareaInput"
              @scroll="syncOverlayScroll"
              :disabled="!canInteract"
              :class="{ 'disabled': !canInteract }"
              aria-label="Message content"
              rows="1"
            ></textarea>
            <div
              v-if="mentionDropdown.visible"
              class="mention-dropdown"
              :style="mentionDropdownStyle"
              ref="mentionDropdownElement"
            >
              <div v-if="mentionDropdown.loading" class="mention-dropdown__status">
                Searching…
              </div>
              <div
                v-else-if="mentionDropdown.results.length === 0"
                class="mention-dropdown__status"
              >
                {{ mentionDropdown.query.length > 0 ? 'No matches' : 'Type to search' }}
              </div>
              <ul v-else class="mention-dropdown__list">
                <li
                  v-for="(result, index) in mentionDropdown.results"
                  :key="result.uid"
                  class="mention-dropdown__item"
                  :class="{ 'is-active': index === mentionDropdown.highlightedIndex }"
                  @mousedown.prevent="selectMentionResult(index)"
                >
                  <span class="mention-dropdown__name">
                    {{ result.display_name || result.user_tag }}
                  </span>
                  <span class="mention-dropdown__tag">@{{ result.user_tag }}</span>
                </li>
              </ul>
            </div>
          </div>
          
          <!-- Send button -->
          <button 
            v-if="!showVerifyCTA"
            class="textarea-send-button"
            :class="{ 
              'textarea-send-button--disabled': !canSendReply,
              'textarea-send-button--loading': isSending,
              'textarea-send-button--success': showSendSuccess
            }"
            @click.stop="sendReply" 
            :disabled="!canSendReply"
            :aria-label="isSending ? 'Sending message' : 'Send message'"
          >
            <span v-if="showSendSuccess" class="send-button__icon">✓</span>
            <span v-else-if="isSending" class="send-button__spinner" aria-hidden="true"></span>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 11.5 20 4.5 13 20l-2.2-6.3L4.5 11.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10.8 13.7 20 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>

        <div v-if="!showVerifyCTA" class="md-controls" aria-label="Formatting">
          <button type="button" class="md-control" aria-label="Bold" :disabled="!canInteract" @mousedown.prevent @click="applyFormatting('bold')"><strong>B</strong></button>
          <button type="button" class="md-control md-control--italic" aria-label="Italic" :disabled="!canInteract" @mousedown.prevent @click="applyFormatting('italic')"><em>I</em></button>
          <button type="button" class="md-control" aria-label="Link" :disabled="!canInteract" @mousedown.prevent @click="applyFormatting('link')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 13.5a4 4 0 0 0 5.7.2l2.3-2.3a4 4 0 0 0-5.7-5.6L11.5 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M13.5 10.5a4 4 0 0 0-5.7-.2l-2.3 2.3a4 4 0 0 0 5.7 5.6L12.5 17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
          <button type="button" class="md-control md-control--code" aria-label="Code" :disabled="!canInteract" @mousedown.prevent @click="applyFormatting('code')">&lt;/&gt;</button>
          <button type="button" class="md-control" aria-label="Quote" :disabled="!canInteract" @mousedown.prevent @click="applyFormatting('quote')">❝</button>
          <button type="button" class="md-control" aria-label="Bulleted list" :disabled="!canInteract" @mousedown.prevent @click="applyFormatting('bullet')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="7" r="1.4" fill="currentColor"/><circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="5" cy="17" r="1.4" fill="currentColor"/><path d="M9 7h10M9 12h10M9 17h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
          <button type="button" class="md-control" aria-label="Numbered list" :disabled="!canInteract" @mousedown.prevent @click="applyFormatting('number')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5.5L6.2 5M4 12h2.4c.6 0 .6 1.2 0 1.6L4 16h2.6M9 7h10M9 12h10M9 17h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <span
            class="content-char-count"
            :class="{ 'content-char-count--error': content.length > MAX_MESSAGE_CONTENT_LENGTH }"
          >
            {{ content.length }}/{{ MAX_MESSAGE_CONTENT_LENGTH }}
          </span>
        </div>
      </div>
      
      <!-- Add recipients info - shown only in add recipients mode.
           NOTE: `navigation.addRecipientsMode` appears to have no call sites in the current frontend, so this block is likely legacy/dead code (kept for safety). -->
      <div v-if="isAddRecipientsMode" class="add-recipients-info">
        <p class="add-recipients-description">
          Add new recipients to this message. Only you (the author) can see this list.
        </p>
        <div v-if="addRecipientsExisting.length > 0" class="existing-recipients">
          <h4>Current Recipients:</h4>
          <div class="existing-recipients-list">
            <span 
              v-for="recipient in addRecipientsExisting" 
              :key="recipient.uid"
              class="existing-recipient-tag"
            >
              {{ recipient.display_name || recipient.user_tag }}
            </span>
          </div>
        </div>
      </div>
      

    </div>

    <!-- Recipients modal -->
    <RecipientsModal
      :is-visible="showRecipientSelector"
      :is-public="isPublic"
      :is-add-mode="false"
      @close="closeRecipientSelector"
      @done="closeRecipientSelector"
    />
    
    <!-- Tags modal -->
    <TagsModal
      :is-visible="showTagsModal"
      :is-add-mode="false"
      :existing-tags="replyTags"
      @close="closeTagsModal"
      @change="handleTagsChange"
      @done="handleTagsDone"
    />
    
    <!-- Channels modal -->
    <ChannelsModal
      :is-visible="showChannelsModal"
      :is-add-mode="false"
      :existing-channels="replyChannels"
      @close="closeChannelsModal"
      @change="handleChannelsChange"
      @done="handleChannelsDone"
    />
    
    <!-- Bot Prompt Modal moved to global component -->
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, reactive } from 'vue';
import { useStore } from 'vuex';
import RecipientsModal from './modals/RecipientsModal.vue';
import TagsModal from './modals/TagsModal.vue';
import ChannelsModal from './modals/ChannelsModal.vue';
import { dismissMobileKeyboard } from '../utils/mobileKeyboard.js';
import MessageService from '../services/MessageService.js';
import { addRecipientsToAncestorsExcludingAuthoredMessages } from '../utils/recipientPropagation.js';
import { getAuthorDisplayName, getAuthorUserTag, getAuthorUid } from '../utils/messageCompat.js';
import AttachmentService from '../services/AttachmentService.js';

const props = defineProps({
  targetId: {
    type: [Number, String],
    default: null
  },
  placeholder: {
    type: String,
    default: 'Type your reply...'
  },
  canInteract: {
    type: Boolean,
    default: true
  },
  isNewThread: {
    type: Boolean,
    default: false
  },
  isMessageSelected: {
    type: Boolean,
    default: false
  },
  isAuthenticated: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['send', 'cancel', 'send-success', 'send-error', 'open-profile']);

// Setup store
const store = useStore();

const TAG_TOKEN_RE = /(^|[\s([{])#([A-Za-z0-9-]{1,32})(?![A-Za-z0-9-])/gm;
const MENTION_TOKEN_RE = /(^|[\s([{])@([A-Za-z0-9-]{2,24})(?![A-Za-z0-9-])(?=[^\w@.]|$)/gm;
const BOUNDARY_REGEX = /[\s.,!?;:)\]}'"`]/;
const MAX_DRAFT_TAGS = 20;
const MAX_MESSAGE_CONTENT_LENGTH = 10000;

// Refs
const replyTextarea = ref(null);
const subjectInput = ref(null);
const replySheet = ref(null);
const fileInput = ref(null);
const textareaWrapper = ref(null);
const content = ref('');
const subject = ref('');
const showSubject = ref(false); // Controls visibility of subject field
const isSending = ref(false);
const showSearchResults = ref(false);
const highlightOverlay = ref(null);
const mentionDropdownElement = ref(null);
const overlayHtml = ref('&nbsp;');
const suppressedTags = ref(new Set());

// Attachment state
const attachments = ref([]);
const uploading = ref(false);

// Bottom sheet state
const isKeyboardVisible = ref(false);
const keyboardHeight = ref(0); // Track actual keyboard height for proper positioning
const showSendSuccess = ref(false);
const isReplyBoxClosing = ref(false);

// Touch gesture state
const touchStartY = ref(0);
const isDragging = ref(false);
const dragDistance = ref(0);

// UI state
const showRecipientSelector = ref(false);
const showBotModal = ref(false);
const showTagsModal = ref(false);
const showChannelsModal = ref(false);

// Channels state
const replyChannels = ref([]);
const replyChannelIds = computed(() => replyChannels.value.map(ch => ch.id).filter(Boolean));

// Featured bots for prompt modal
// Prompt bot response moved to global modal; remove local states

// Add recipients mode
const isAddRecipientsMode = computed(() => store.getters['navigation/isAddRecipientsMode']);
const addRecipientsMessageId = computed(() => store.getters['navigation/addRecipientsMessageId']);
const addRecipientsExisting = computed(() => store.getters['navigation/addRecipientsExisting']);



// Computed properties from store
const user = computed(() => store.getters['auth/user']);
const isEmailVerified = computed(() => !!(user.value && user.value.is_email_verified));
const isPublic = computed({
  get: () => store.getters['navigation/replyIsPublic'],
  set: (value) => store.dispatch('navigation/updateReplyVisibility', value)
});
const recipients = computed(() => store.getters['navigation/replyRecipients']);
const normalizedReplyTagSet = computed(() => {
  const set = new Set();
  (replyTags.value || []).forEach(tag => {
    if (typeof tag === 'string') {
      set.add(tag.toLowerCase());
    }
  });
  return set;
});
const inlineTrackedTags = ref(new Set());
const inlineTrackedRecipients = ref(new Set()); // Track user_tags of recipients added via inline mentions
const mentionableUserTagSet = computed(() => {
  const set = new Set();
  const list = recipients.value || [];
  list.forEach(recipient => {
    const rawTag = (typeof recipient === 'object' ? recipient?.user_tag : recipient) || '';
    if (typeof rawTag === 'string' && rawTag.trim()) {
      set.add(rawTag.toLowerCase());
    }
  });
  return set;
});
const replyAddToAncestors = computed(() => store.getters['navigation/replyAddToAncestors']);
const isReplying = computed(() => store.getters['navigation/isReplying']);
const speedDialModalVisible = computed(() => store.getters['navigation/speedDialModalVisible']);
const showVerifyCTA = computed(() => !props.canInteract && props.isAuthenticated && !isEmailVerified.value);

// Draft tags sourced from navigation store
const replyTags = computed(() => store.getters['navigation/replyTags'] || []);

const mentionDropdown = reactive({
  visible: false,
  query: '',
  position: { top: 0, left: 0, bottom: null },
  maxHeight: 240,
  results: [],
  highlightedIndex: 0,
  loading: false,
  anchorStart: null,
  anchorEnd: null
});
let mentionSearchTimeout = null;

// Positioning constants - adjust these to fine-tune dropdown placement
const MENTION_DROPDOWN_WIDTH = 260;        // Width of the dropdown (px)
const DROPDOWN_VERTICAL_GAP = 42;           // Gap between caret and dropdown (px) - increase for more space
const MIN_DROPDOWN_HEIGHT = 140;           // Minimum height when space is limited (px)
const MAX_DROPDOWN_HEIGHT = 320;           // Maximum height when there's plenty of space (px)
let suppressNextMentionDetection = false;

// Centralized validation logic
const canSendReply = computed(() => {
  const subjectValid = !subject.value || subject.value.length <= 72;
  const contentValid = content.value.length <= MAX_MESSAGE_CONTENT_LENGTH;
  const hasFiles = Array.isArray(attachments.value) && attachments.value.length > 0;
  return props.canInteract && (content.value.trim() !== '' || hasFiles) && subjectValid && contentValid && !isSending.value && !uploading.value;
});

// Generate placeholder text
const placeholderText = computed(() => {
  // First priority: check if we're creating a new thread
  if (props.isNewThread) {
    return "Type your message to create a new thread...";
  }
  
  // Second: check if no message is selected
  if (!props.isMessageSelected) {
    return "Click 'Reply' on a message to respond";
  }
  
  // If user can't interact, show a message explaining why
  if (!props.canInteract) {
    if (!props.isAuthenticated) {
      return "You need to log in to send messages";
    }
    if (!isEmailVerified.value) {
      return "Verify your email to get started!";
    }
    return "You need write permission to send messages";
  }
  
  return "Type your message...";
});

const mentionDropdownStyle = computed(() => {
  const style = {
    left: `${mentionDropdown.position.left || 0}px`,
    maxHeight: `${mentionDropdown.maxHeight || MAX_DROPDOWN_HEIGHT}px`
  };
  if (typeof mentionDropdown.position.bottom === 'number') {
    style.bottom = `${mentionDropdown.position.bottom}px`;
  } else {
    style.top = `${mentionDropdown.position.top || 0}px`;
  }
  return style;
});

// Compute dynamic style for reply sheet to handle keyboard offset
const replySheetStyle = computed(() => {
  // When keyboard is visible, translate the sheet up by the keyboard height
  // This ensures the textarea and send button remain visible and clickable
  if (isKeyboardVisible.value && keyboardHeight.value > 0) {
    return {
      '--keyboard-offset': `${keyboardHeight.value}px`
    };
  }
  return {
    '--keyboard-offset': '0px'
  };
});

// Generate reply header text
const replyHeaderText = computed(() => {
  if (isAddRecipientsMode.value) {
    return "Add Recipients";
  }
  
  if (props.isNewThread) {
    return "New Message";
  }
  
  if (props.targetId) {
    const targetMessage = store.getters['messages/getMessage'](props.targetId);
    if (targetMessage) {
      const displayName = getAuthorDisplayName(targetMessage);
      const userTag = getAuthorUserTag(targetMessage);
      
      if (userTag) {
        return `Replying to @${userTag}`;
      }
      return `Replying to ${displayName}`;
    }
  }
  
  return "Reply";
});

// Methods
const emitOpenProfile = () => {
  emit('open-profile');
};

const handleVerifyClick = () => {
  emitOpenProfile();
  // Auto-close the reply box
  hideBottomSheet();
};


const handleVisibilityPointerDown = (event) => {
  // Prevent focus from leaving the textarea (keeps mobile keyboard open)
  event.preventDefault();
};

const handleVisibilityToggle = (source) => {
  if (!props.canInteract) return;

  // Suppress outside-click close during this toggle to avoid mobile re-render race
  suppressOutsideClose.value = true;
  setTimeout(() => { suppressOutsideClose.value = false; }, 350);

  isPublic.value = !isPublic.value;

  // Maintain keyboard visibility by restoring textarea focus on mobile
  if (typeof window !== 'undefined' && window.innerWidth <= 768 && replyTextarea.value) {
    try {
      replyTextarea.value.focus({ preventScroll: true });
    } catch (e) {
      replyTextarea.value.focus();
    }
    isKeyboardVisible.value = true;
  }
};

const ensureReplyingActive = () => {
  if (!isReplying.value && props.targetId) {
    store.dispatch('navigation/toggleReply', true);
  }
};

// Bottom sheet methods
const focusTextarea = () => {
  // Always focus the message textarea when opening (never start in subject)
  const delay = props.isNewThread ? 450 : 350;
  const tryFocus = () => {
    if (replyTextarea.value) {
      replyTextarea.value.focus();
      return true;
    }
    if (!props.isNewThread && showSubject.value && subjectInput.value) {
      subjectInput.value.focus();
      return true;
    }
    return false;
  };
  setTimeout(() => {
    if (!tryFocus() && props.isNewThread) {
      setTimeout(tryFocus, 100);
    }
  }, delay);
};

const TYPING_HEARTBEAT_MS = 7000
let typingTargetId = null
let typingTimer = null

const postTypingCue = (targetMessageId, typing) => {
  if (!targetMessageId) return
  MessageService.postTypingCue(targetMessageId, typing).catch(() => {})
}

const stopTypingCue = () => {
  if (typingTimer != null) {
    clearInterval(typingTimer)
    typingTimer = null
  }
  const target = typingTargetId
  typingTargetId = null
  if (target) postTypingCue(target, false)
}

const typingCueShouldRun = () => (
  !!props.targetId
  && isReplying.value
  && !isAddRecipientsMode.value
  && !isSending.value
  && String(content.value || '').trim().length > 0
)

const syncTypingCue = () => {
  if (!typingCueShouldRun()) {
    stopTypingCue()
    return
  }
  const target = props.targetId
  if (typingTargetId === target) return
  if (typingTargetId) stopTypingCue()
  typingTargetId = target
  postTypingCue(target, true)
  typingTimer = setInterval(() => {
    if (typingTargetId) postTypingCue(typingTargetId, true)
  }, TYPING_HEARTBEAT_MS)
}

watch(
  () => [
    props.targetId,
    isReplying.value,
    isAddRecipientsMode.value,
    isSending.value,
    content.value,
  ],
  () => syncTypingCue(),
)

const hideBottomSheet = () => {
  // In new thread view the reply box cannot be closed (no X, no outside click)
  if (props.isNewThread) return;
  isKeyboardVisible.value = false;

  if (isReplying.value) {
    isReplyBoxClosing.value = true;
    setTimeout(() => {
      isReplyBoxClosing.value = false;
      store.dispatch('navigation/clearReplyingTo');
    }, 150);
  } else {
    store.dispatch('navigation/clearReplyingTo');
  }
};

// Touch gesture handlers
const skipDragFromControl = ref(false);
const suppressOutsideClose = ref(false);

const handleTouchStart = (event) => {
  // Ignore drag gestures that originate from controls like visibility toggle
  try {
    const target = event.target;
    skipDragFromControl.value = !!(target && target.closest && target.closest('.no-drag'));
  } catch (e) {
    skipDragFromControl.value = false;
  }
  if (skipDragFromControl.value) {
    return;
  }
  const touch = event.touches[0];
  touchStartY.value = touch.clientY;
  isDragging.value = false;
  dragDistance.value = 0;
};

const handleTouchMove = (event) => {
  if (skipDragFromControl.value) {
    return;
  }
  if (!isDragging.value) {
    const touch = event.touches[0];
    const deltaY = touch.clientY - touchStartY.value;
    
    // Only start dragging if moving down and near the top of the sheet
    if (deltaY > 5 && touchStartY.value < 100) {
      isDragging.value = true;
    }
  }
  
  if (isDragging.value) {
    const touch = event.touches[0];
    dragDistance.value = Math.max(0, touch.clientY - touchStartY.value);
    
    // Apply visual feedback
    if (replySheet.value) {
      replySheet.value.style.transform = `translateY(${dragDistance.value}px)`;
    }
  }
};

const handleTouchEnd = () => {
  if (skipDragFromControl.value) {
    skipDragFromControl.value = false;
    return;
  }
  if (isDragging.value) {
    // Reset visual transform
    if (replySheet.value) {
      replySheet.value.style.transform = '';
    }
    
    // If dragged down more than 60px, close the sheet
    if (dragDistance.value > 60) {
      hideBottomSheet();
    }
  }
  
  isDragging.value = false;
  dragDistance.value = 0;
};

const closeMentionDropdown = () => {
  mentionDropdown.visible = false;
  mentionDropdown.query = '';
  mentionDropdown.results = [];
  mentionDropdown.highlightedIndex = 0;
  mentionDropdown.loading = false;
  mentionDropdown.anchorStart = null;
  mentionDropdown.anchorEnd = null;
};

const scheduleMentionSearch = (query) => {
  if (mentionSearchTimeout) {
    clearTimeout(mentionSearchTimeout);
    mentionSearchTimeout = null;
  }
  if (!query || query.length < 1) {
    mentionDropdown.results = [];
    mentionDropdown.loading = false;
    mentionDropdown.highlightedIndex = -1;
    return;
  }
  mentionDropdown.loading = true;
  mentionDropdown.highlightedIndex = 0;
  mentionSearchTimeout = setTimeout(async () => {
    try {
      const results = await store.dispatch('auth/searchUsers', query);
      const resultArray = Array.isArray(results) ? results : [];
      mentionDropdown.results = resultArray;
      // Update position when results arrive
      if (mentionDropdown.visible && replyTextarea.value) {
        updateMentionDropdownPosition(replyTextarea.value.selectionStart ?? 0);
      }
    } catch (e) {
      console.error('[MentionDropdown] Search error:', e);
      mentionDropdown.results = [];
    } finally {
      mentionDropdown.loading = false;
      if (mentionDropdown.results.length === 0) {
        mentionDropdown.highlightedIndex = -1;
      } else if (mentionDropdown.highlightedIndex < 0) {
        mentionDropdown.highlightedIndex = 0;
      }
    }
  }, 200);
};

// Keyboard handling
const handleTextareaFocus = () => {
  ensureReplyingActive();
  
  // Detect mobile keyboard on focus
  // The main detection is handled by the visualViewport resize listener,
  // but we also check here as a fallback for initial focus
  if (window.innerWidth <= 768 && window.visualViewport) {
    // Use a timeout to allow keyboard to fully appear
    setTimeout(() => {
      const currentHeight = window.visualViewport.height;
      const fullHeight = window.innerHeight;
      const heightDiff = fullHeight - currentHeight;
      
      if (heightDiff > 150) {
        isKeyboardVisible.value = true;
        // Set keyboard height with a small buffer
        keyboardHeight.value = Math.max(0, heightDiff + 10);
      }
    }, 300);
  }
};

const handleTextareaBlur = () => {
  // Delay closing dropdown to allow clicks on dropdown items
  setTimeout(() => {
    // Check if dropdown is still supposed to be visible (user might have clicked on it)
    const activeElement = document.activeElement;
    const isClickingDropdown = activeElement?.closest('.mention-dropdown');
    if (!isClickingDropdown) {
      closeMentionDropdown();
    }
  }, 150);
  // Reset keyboard state - delay to allow for clicks on send button etc.
  setTimeout(() => {
    isKeyboardVisible.value = false;
    keyboardHeight.value = 0;
  }, 100);
};

const handleTextareaKeyDown = (event) => {
  if (mentionDropdown.visible) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      suppressNextMentionDetection = true;
      moveMentionHighlight(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      suppressNextMentionDetection = true;
      moveMentionHighlight(-1);
      return;
    }
    if (event.key === 'Enter') {
      const hasSelection = mentionDropdown.results.length > 0 && mentionDropdown.highlightedIndex >= 0;
      if (hasSelection) {
        event.preventDefault();
        suppressNextMentionDetection = true;
        selectMentionResult(mentionDropdown.highlightedIndex);
        return;
      }
    }
    if (event.key === 'Tab') {
      if (mentionDropdown.results.length > 0) {
        event.preventDefault();
        suppressNextMentionDetection = true;
        const targetIndex = mentionDropdown.highlightedIndex >= 0
          ? mentionDropdown.highlightedIndex
          : 0;
        selectMentionResult(targetIndex);
        return;
      }
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMentionDropdown();
      suppressNextMentionDetection = true;
      return;
    }
  }
  if (event.key === 'Enter') {
    const isMobile = window.innerWidth <= 768;
    // Mobile: Enter should create a newline; Shift+Enter also newline (default)
    if (isMobile) {
      return;
    }

    // Desktop behavior:
    // - Shift+Enter inserts a newline (default)
    if (event.shiftKey) {
      return;
    }

    // - Enter alone sends (when allowed), otherwise fall back to newline
    if (canSendReply.value) {
      event.preventDefault();
      sendReply();
    }
    return;
  }
};

const autoResizeTextarea = () => {
  const textarea = replyTextarea.value;
  if (!textarea) return;
  
  // Check if there's actual content
  const hasContent = content.value.trim().length > 0; 
  
  if (!hasContent) {
    textarea.style.height = '32px';
    textarea.style.overflowY = 'hidden';
    return;
  }
  
  // Reset height to get natural content height (no need for padding manipulation)
  textarea.style.height = 'auto';
  
  const minHeight = 32; // Compact single line
  const maxHeight = window.innerHeight * 0.4; // 40vh
  const naturalHeight = textarea.scrollHeight;
  const newHeight = Math.min(Math.max(naturalHeight, minHeight), maxHeight);
  
  textarea.style.height = `${newHeight}px`;
  
  // Show scrollbar only when content actually overflows
  if (newHeight >= maxHeight) {
    textarea.style.overflowY = 'auto';
  } else {
    textarea.style.overflowY = 'hidden';
  }
  
  syncOverlayScroll();
  if (mentionDropdown.visible) {
    updateMentionDropdownPosition(mentionDropdown.anchorEnd ?? replyTextarea.value?.selectionStart ?? 0);
  }
};

const calculateCaretCoordinates = (selectionEnd) => {
  const textarea = replyTextarea.value;
  const wrapper = textareaWrapper.value;
  if (!textarea || !wrapper) return null;
  const computed = window.getComputedStyle(textarea);
  const div = document.createElement('div');
  const properties = [
    'boxSizing', 'width', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
    'letterSpacing', 'textTransform', 'textAlign', 'lineHeight',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'whiteSpace'
  ];
  properties.forEach(prop => {
    div.style[prop] = computed[prop];
  });
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  div.style.overflow = 'hidden';
  div.style.width = `${textarea.clientWidth}px`;
  const text = textarea.value.substring(0, selectionEnd);
  div.textContent = text.endsWith('\n') ? `${text}\u200b` : text;
  const span = document.createElement('span');
  span.textContent = textarea.value.substring(selectionEnd) || '.';
  div.appendChild(span);
  document.body.appendChild(div);
  const spanRect = span.getBoundingClientRect();
  const wrapperRect = wrapper.getBoundingClientRect();
  const top = spanRect.top - wrapperRect.top - textarea.scrollTop;
  const left = spanRect.left - wrapperRect.left - textarea.scrollLeft;
  document.body.removeChild(div);
  return { top, left };
};

// Check for overflow clipping on parent elements
const checkOverflowClipping = (element) => {
  const parents = [];
  let current = element.parentElement;
  while (current && current !== document.body) {
    const styles = window.getComputedStyle(current);
    const overflow = styles.overflow + styles.overflowX + styles.overflowY;
    if (overflow.includes('hidden') || overflow.includes('auto') || overflow.includes('scroll')) {
      const rect = current.getBoundingClientRect();
      parents.push({
        element: current,
        className: current.className,
        overflow: overflow,
        boundingRect: rect,
        clipsDropdown: (() => {
          const dropdownRect = element.getBoundingClientRect();
          return (
            dropdownRect.top < rect.top ||
            dropdownRect.bottom > rect.bottom ||
            dropdownRect.left < rect.left ||
            dropdownRect.right > rect.right
          );
        })()
      });
    }
    current = current.parentElement;
  }
  return parents;
};

const updateMentionDropdownPosition = (caretIndex) => {
  if (!mentionDropdown.visible) {
    return;
  }
  const textarea = replyTextarea.value;
  if (!textarea) {
    return;
  }
  const coords = calculateCaretCoordinates(caretIndex ?? textarea.selectionStart ?? 0);
  if (!coords) {
    return;
  }
  const wrapper = textareaWrapper.value;
  const wrapperHeight = wrapper?.clientHeight || 0;
  
  // Horizontal positioning: align with caret, but keep dropdown within wrapper bounds
  const maxLeft = Math.max(((wrapper?.clientWidth || 0) - MENTION_DROPDOWN_WIDTH), 0);
  const nextLeft = Math.min(Math.max(coords.left, 0), maxLeft);
  
  // Vertical positioning: calculate how much space is available above the caret
  // This determines the max height the dropdown can grow to
  const availableAbove = Math.max(coords.top - DROPDOWN_VERTICAL_GAP, MIN_DROPDOWN_HEIGHT);
  const clampedMaxHeight = Math.min(Math.max(availableAbove, MIN_DROPDOWN_HEIGHT), MAX_DROPDOWN_HEIGHT);
  
  // Bottom offset: distance from bottom of wrapper to caret position + gap
  // This positions the dropdown above the textarea, anchored to the bottom
  const bottomOffset = Math.max(wrapperHeight - coords.top + DROPDOWN_VERTICAL_GAP, DROPDOWN_VERTICAL_GAP);

  mentionDropdown.maxHeight = clampedMaxHeight;
  mentionDropdown.position = {
    top: null,
    bottom: bottomOffset,
    left: nextLeft
  };
  
  // Verify position after Vue renders the element
  nextTick(() => {
    const el = mentionDropdownElement.value;
    if (el) {
      const finalRect = el.getBoundingClientRect();
      const wrapperRect = wrapper?.getBoundingClientRect();
      const clippingParents = checkOverflowClipping(el);
      
      if (finalRect.width === 0 || finalRect.height === 0) {
        console.warn('[MentionDropdown] ⚠️ Dropdown has zero dimensions!');
      }
      
      if (finalRect.top < 0 || finalRect.left < 0 || 
          finalRect.bottom > window.innerHeight || 
          finalRect.right > window.innerWidth) {
        console.warn('[MentionDropdown] ⚠️ Dropdown is outside viewport!', {
          offTop: finalRect.top < 0 ? finalRect.top : 0,
          offLeft: finalRect.left < 0 ? finalRect.left : 0,
          offBottom: finalRect.bottom > window.innerHeight ? finalRect.bottom - window.innerHeight : 0,
          offRight: finalRect.right > window.innerWidth ? finalRect.right - window.innerWidth : 0
        });
      }
    } else {
      console.warn('[MentionDropdown] ⚠️ Element not found after render!');
    }
  });
};

const detectMentionTrigger = (textarea) => {
  if (!textarea) return;
  const caretIndex = textarea.selectionStart ?? 0;
  const textBeforeCaret = textarea.value.slice(0, caretIndex);
  const mentionMatch = textBeforeCaret.match(/(^|[\s([{>])@([A-Za-z0-9-]{0,24})$/);
  if (!mentionMatch) {
    closeMentionDropdown();
    return;
  }
  const query = mentionMatch[2] || '';
  const mentionStart = caretIndex - query.length - 1;
  mentionDropdown.visible = true;
  mentionDropdown.query = query;
  mentionDropdown.anchorStart = mentionStart >= 0 ? mentionStart : 0;
  mentionDropdown.anchorEnd = caretIndex;
  mentionDropdown.highlightedIndex = mentionDropdown.results.length ? Math.min(mentionDropdown.highlightedIndex, mentionDropdown.results.length - 1) : (query.length > 0 ? 0 : -1);
  updateMentionDropdownPosition(caretIndex);
  scheduleMentionSearch(query);
};

const handleTextareaInput = (event) => {
  detectMentionTrigger(event.target);
};

const handleTextareaKeyUp = (event) => {
  if (suppressNextMentionDetection) {
    suppressNextMentionDetection = false;
    return;
  }
  detectMentionTrigger(event.target);
};

const handleTextareaClick = (event) => {
  detectMentionTrigger(event.target);
};

const moveMentionHighlight = (delta) => {
  if (!mentionDropdown.results.length) return;
  const total = mentionDropdown.results.length;
  let next = mentionDropdown.highlightedIndex;
  if (next < 0) next = 0;
  next = (next + delta + total) % total;
  mentionDropdown.highlightedIndex = next;
};

const ensureMentionRecipient = (user) => {
  if (!user || !user.uid) return;
  const current = recipients.value || [];
  const exists = current.some(recipient => recipient && recipient.uid === user.uid);
  
  // Get parent message to identify parent author (if replying)
  let parentAuthorUid = null;
  let parentAuthorTag = null;
  if (props.targetId) {
    const parentMessage = store.getters['messages/getMessage'](props.targetId);
    if (parentMessage) {
      parentAuthorUid = getAuthorUid(parentMessage);
      parentAuthorTag = getAuthorUserTag(parentMessage);
    }
  }
  
  if (!exists) {
    store.dispatch('navigation/addRecipient', {
      uid: user.uid,
      display_name: user.display_name,
      user_tag: user.user_tag,
      is_bot: !!(user.is_bot ?? user.isBot),
      available_versions: user.available_versions ?? user.availableVersions ?? null,
      email: user.email,
      public: true,
      notify: true  // Tagged users get notify: true (they replace parent author as notification recipient)
    });
    
    // After adding tagged user, update parent author's notify flag to false
    if (parentAuthorUid || parentAuthorTag) {
      nextTick(() => {
        const updatedRecipients = (recipients.value || []).map(recipient => {
          if (!recipient || typeof recipient !== 'object') return recipient;
          const recipientUid = recipient.uid;
          const recipientTag = recipient.user_tag;
          const isParentAuthor = (parentAuthorUid && recipientUid === parentAuthorUid) ||
                                  (parentAuthorTag && recipientTag && 
                                   parentAuthorTag.toLowerCase() === recipientTag.toLowerCase());
          if (isParentAuthor) {
            return { ...recipient, notify: false };
          }
          return recipient;
        });
        store.commit('navigation/SET_REPLY_RECIPIENTS', updatedRecipients);
      });
    }
  } else {
    // If user already exists, update their notify flag to true and parent author to false
    const updatedRecipients = current.map(recipient => {
      if (!recipient || typeof recipient !== 'object') return recipient;
      const recipientUid = recipient.uid;
      const recipientTag = recipient.user_tag;
      
      // Check if this is the tagged user
      if (recipientUid === user.uid) {
        return {
          ...recipient,
          notify: true,
          is_bot: !!(user.is_bot ?? user.isBot),
          available_versions: user.available_versions ?? user.availableVersions ?? null,
        };
      }
      
      // Check if this is the parent author
      const isParentAuthor = (parentAuthorUid && recipientUid === parentAuthorUid) ||
                              (parentAuthorTag && recipientTag && 
                               parentAuthorTag.toLowerCase() === recipientTag.toLowerCase());
      if (isParentAuthor) {
        return { ...recipient, notify: false };
      }
      
      return recipient;
    });
    store.commit('navigation/SET_REPLY_RECIPIENTS', updatedRecipients);
  }
};

// A single * next to the selection is italic. ** is bold, so don't treat one of those stars as an italic wrap.
const selectionIsWrapped = (text, start, end, open, close) => {
  if (start < open.length || end + close.length > text.length) return false;
  if (text.slice(start - open.length, start) !== open) return false;
  if (text.slice(end, end + close.length) !== close) return false;
  if (open.length === 1 && start - open.length > 0 && text[start - open.length - 1] === open) return false;
  if (close.length === 1 && end + close.length < text.length && text[end + close.length] === close) return false;
  return true;
};

const applyWrap = (text, start, end, open, close) => {
  const selected = text.slice(start, end);
  if (selected && selectionIsWrapped(text, start, end, open, close)) {
    const next = text.slice(0, start - open.length) + selected + text.slice(end + close.length);
    const selStart = start - open.length;
    return { text: next, selStart, selEnd: selStart + selected.length };
  }
  const next = text.slice(0, start) + open + selected + close + text.slice(end);
  const selStart = start + open.length;
  return { text: next, selStart, selEnd: selStart + selected.length };
};

const applyLink = (text, start, end) => {
  const label = text.slice(start, end) || 'text';
  const url = 'url';
  const next = `${text.slice(0, start)}[${label}](${url})${text.slice(end)}`;
  const urlStart = start + label.length + 3;
  return { text: next, selStart: urlStart, selEnd: urlStart + url.length };
};

const applyCode = (text, start, end) => {
  const selected = text.slice(start, end);
  if (!selected.includes('\n')) {
    return applyWrap(text, start, end, '`', '`');
  }
  const open = '```\n';
  const close = '\n```';
  if (selected && selectionIsWrapped(text, start, end, open, close)) {
    const next = text.slice(0, start - open.length) + selected + text.slice(end + close.length);
    const selStart = start - open.length;
    return { text: next, selStart, selEnd: selStart + selected.length };
  }
  const next = text.slice(0, start) + open + selected + close + text.slice(end);
  const selStart = start + open.length;
  return { text: next, selStart, selEnd: selStart + selected.length };
};

const lineRange = (text, start, end) => {
  const from = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  let probe = end;
  if (probe > start && text[probe - 1] === '\n') probe -= 1;
  const newline = text.indexOf('\n', probe);
  return { from, to: newline === -1 ? text.length : newline };
};

const applyFixedPrefix = (text, start, end, prefix) => {
  const { from, to } = lineRange(text, start, end);
  const lines = text.slice(from, to).split('\n');
  const allPrefixed = lines.every((line) => line.startsWith(prefix));
  const nextLines = allPrefixed
    ? lines.map((line) => line.slice(prefix.length))
    : lines.map((line) => (line.startsWith(prefix) ? line : prefix + line));
  const block = nextLines.join('\n');
  return { text: text.slice(0, from) + block + text.slice(to), selStart: from, selEnd: from + block.length };
};

const applyNumbered = (text, start, end) => {
  const { from, to } = lineRange(text, start, end);
  const numbered = /^\d+\. /;
  const lines = text.slice(from, to).split('\n');
  const allNumbered = lines.every((line) => numbered.test(line));
  const nextLines = allNumbered
    ? lines.map((line) => line.replace(numbered, ''))
    : lines.map((line, index) => (numbered.test(line) ? line : `${index + 1}. ${line}`));
  const block = nextLines.join('\n');
  return { text: text.slice(0, from) + block + text.slice(to), selStart: from, selEnd: from + block.length };
};

const applyFormatting = (kind) => {
  if (!props.canInteract) return;
  const textarea = replyTextarea.value;
  if (!textarea) return;
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? start;
  const value = content.value || '';
  let result = null;
  if (kind === 'bold') result = applyWrap(value, start, end, '**', '**');
  else if (kind === 'italic') result = applyWrap(value, start, end, '*', '*');
  else if (kind === 'link') result = applyLink(value, start, end);
  else if (kind === 'code') result = applyCode(value, start, end);
  else if (kind === 'quote') result = applyFixedPrefix(value, start, end, '> ');
  else if (kind === 'bullet') result = applyFixedPrefix(value, start, end, '- ');
  else if (kind === 'number') result = applyNumbered(value, start, end);
  if (!result || result.text === value) return;
  if (result.text.length > MAX_MESSAGE_CONTENT_LENGTH) {
    store.commit('ui/SET_ERROR', `Message must be ${MAX_MESSAGE_CONTENT_LENGTH} characters or less.`);
    return;
  }
  content.value = result.text;
  nextTick(() => {
    const el = replyTextarea.value;
    if (el) {
      el.focus();
      el.setSelectionRange(result.selStart, result.selEnd);
      detectMentionTrigger(el);
    }
    autoResizeTextarea();
    updateOverlayHtml();
  });
};

const insertMentionResult = (user) => {
  const textarea = replyTextarea.value;
  if (!textarea || mentionDropdown.anchorStart === null) return;
  const start = mentionDropdown.anchorStart;
  const end = mentionDropdown.anchorEnd ?? textarea.selectionStart ?? start;
  const mentionText = `@${user.user_tag}`;
  const before = content.value.slice(0, start);
  const after = content.value.slice(end);
  const insertion = `${mentionText} `;
  const nextContent = `${before}${insertion}${after}`;
  if (nextContent.length > MAX_MESSAGE_CONTENT_LENGTH) {
    store.commit('ui/SET_ERROR', `Message must be ${MAX_MESSAGE_CONTENT_LENGTH} characters or less.`);
    closeMentionDropdown();
    return;
  }
  content.value = nextContent;
  nextTick(() => {
    const caretPosition = before.length + insertion.length;
    if (replyTextarea.value) {
      replyTextarea.value.setSelectionRange(caretPosition, caretPosition);
    }
    autoResizeTextarea();
    updateOverlayHtml();
    detectMentionTrigger(replyTextarea.value);
  });
  ensureMentionRecipient(user);
  // Track this recipient as added via inline mention
  if (user.user_tag) {
    inlineTrackedRecipients.value.add(user.user_tag.toLowerCase());
  }
  closeMentionDropdown();
};

const selectMentionResult = (index) => {
  const user = mentionDropdown.results[index];
  if (!user) return;
  insertMentionResult(user);
};

const makeAttachmentId = () => {
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

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

// Handle file upload
const handleFileSelect = async (event) => {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;
  
  uploading.value = true;
  const errors = [];
  
  // Upload files sequentially to avoid overwhelming the server
  for (const file of files) {
    const id = makeAttachmentId();
    attachments.value.push({
      id,
      name: file.name,
      size: file.size,
      type: file.type,
      isUploading: true,
      progress: null,
    });

    try {
      const metadata = await AttachmentService.uploadFile(file, {
        onUploadProgress: ({ progress }) => {
          const idx = attachments.value.findIndex((a) => a?.id === id);
          if (idx !== -1) {
            attachments.value[idx].progress = typeof progress === 'number' ? progress : null;
          }
        }
      });

      const idx = attachments.value.findIndex((a) => a?.id === id);
      if (idx !== -1) {
        attachments.value[idx] = {
          ...metadata,
          id,
          isUploading: false,
          progress: undefined,
        };
      }
    } catch (error) {
      console.error('Upload failed for file:', file.name, error);

      const idx = attachments.value.findIndex((a) => a?.id === id);
      if (idx !== -1) {
        attachments.value.splice(idx, 1);
      }

      // If the user removed this attachment before upload completed,
      // don't show an error for it.
      if (idx === -1) continue;

      const errorMessage = error.message || 'Failed to upload file. Please try again.';
      errors.push(`${file.name}: ${errorMessage}`);
    }
  }
  
  // Show error message if any uploads failed
  if (errors.length > 0) {
    const errorMessage = errors.length === 1 
      ? errors[0] 
      : `${errors.length} files failed to upload:\n${errors.join('\n')}`;
    store.commit('ui/SET_ERROR', errorMessage);
  }
  
  uploading.value = false;
  if (fileInput.value) fileInput.value.value = '';
};

const removeAttachment = (index) => {
  attachments.value.splice(index, 1);
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const escapeHtml = (text = '') => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const escapeAttribute = (text = '') => escapeHtml(text);

const collectTokenMatches = (text, baseRegex, tokenPrefix, shouldHighlight, type) => {
  const matches = [];
  const regex = new RegExp(baseRegex.source, baseRegex.flags);
  let match;
  while ((match = regex.exec(text)) !== null) {
    const prefix = match[1] || '';
    const body = match[2] || '';
    const normalized = body.toLowerCase();
    if (!shouldHighlight(normalized)) {
      continue;
    }
    const tokenText = `${tokenPrefix}${body}`;
    const start = match.index + prefix.length;
    const end = start + tokenText.length;
    matches.push({ start, end, text: tokenText, normalized, type });
  }
  return matches;
};

const buildHighlightedHtml = (rawText = '') => {
  if (!rawText) {
    return '&nbsp;';
  }
  const tagMatches = collectTokenMatches(
    rawText,
    TAG_TOKEN_RE,
    '#',
    (token) => normalizedReplyTagSet.value.has(token),
    'tag'
  );
  const mentionMatches = collectTokenMatches(
    rawText,
    MENTION_TOKEN_RE,
    '@',
    (token) => mentionableUserTagSet.value.has(token),
    'mention'
  );
  const matches = [...tagMatches, ...mentionMatches].sort((a, b) => a.start - b.start);
  let cursor = 0;
  let html = '';
  for (const match of matches) {
    if (match.start < cursor) {
      continue;
    }
    html += escapeHtml(rawText.slice(cursor, match.start));
    const className = match.type === 'tag'
      ? 'reply-overlay-token reply-overlay-token--tag'
      : 'reply-overlay-token reply-overlay-token--mention';
    html += `<span class="${className}" data-token="${escapeAttribute(match.normalized)}">${escapeHtml(match.text)}</span>`;
    cursor = match.end;
  }
  html += escapeHtml(rawText.slice(cursor));
  const processed = html.replace(/\n/g, '<br />');
  return processed || '&nbsp;';
};

const updateOverlayHtml = () => {
  const html = buildHighlightedHtml(content.value || '');
  overlayHtml.value = html;
};

const syncOverlayScroll = () => {
  if (!replyTextarea.value || !highlightOverlay.value) return;
  highlightOverlay.value.scrollTop = replyTextarea.value.scrollTop;
  highlightOverlay.value.scrollLeft = replyTextarea.value.scrollLeft;
  if (mentionDropdown.visible) {
    updateMentionDropdownPosition(mentionDropdown.anchorEnd ?? replyTextarea.value.selectionStart ?? 0);
  }
};

const normalizeTagValueLocal = (tag) => {
  if (typeof tag !== 'string') return null;
  const trimmed = tag.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.length > 32) return null;
  if (!/^[a-z0-9-]+$/.test(trimmed)) return null;
  return trimmed;
};

const normalizeTagListInput = (tags) => {
  if (!Array.isArray(tags)) return [];
  const normalized = [];
  const seen = new Set();
  for (const tag of tags) {
    const normalizedTag = normalizeTagValueLocal(tag);
    if (!normalizedTag || seen.has(normalizedTag)) continue;
    normalized.push(normalizedTag);
    seen.add(normalizedTag);
    if (normalized.length >= MAX_DRAFT_TAGS) break;
  }
  return normalized;
};

const setReplyTagsList = (tags) => {
  const normalized = normalizeTagListInput(tags);
  const current = replyTags.value || [];
  let changed = normalized.length !== current.length;
  if (!changed) {
    for (let i = 0; i < normalized.length; i += 1) {
      if (normalized[i] !== current[i]) {
        changed = true;
        break;
      }
    }
  }
  if (!changed) {
    return;
  }
  store.dispatch('navigation/setReplyTags', normalized);
  const tracker = inlineTrackedTags.value;
  const nextTracker = new Set();
  normalized.forEach(tag => {
    if (tracker.has(tag)) {
      nextTracker.add(tag);
    }
  });
  inlineTrackedTags.value = nextTracker;
};

const applyModalTags = (tags, shouldClose) => {
  if (!Array.isArray(tags)) {
    if (shouldClose) {
      showTagsModal.value = false;
    }
    return;
  }
  const normalized = normalizeTagListInput(tags);
  const previous = replyTags.value.slice();
  setReplyTagsList(normalized);
  const removed = previous.filter(tag => !normalized.includes(tag));
  if (removed.length > 0) {
    const nextSuppressed = new Set(suppressedTags.value);
    removed.forEach(tag => nextSuppressed.add(tag));
    suppressedTags.value = nextSuppressed;
  }
  if (shouldClose) {
    showTagsModal.value = false;
  }
};

const collectCommittedTagTokens = (text, allowTerminalBoundary = false) => {
  const regex = new RegExp(TAG_TOKEN_RE.source, TAG_TOKEN_RE.flags);
  const ordered = [];
  const set = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    const normalized = (match[2] || '').toLowerCase();
    if (!normalized) continue;
    const prefix = match[1] || '';
    const tokenText = `#${match[2] || ''}`;
    const tokenStart = match.index + prefix.length;
    const tokenEnd = tokenStart + tokenText.length;
    const nextChar = text[tokenEnd];
    const hasBoundary = typeof nextChar === 'string'
      ? BOUNDARY_REGEX.test(nextChar)
      : allowTerminalBoundary;
    if (!hasBoundary || set.has(normalized)) {
      continue;
    }
    set.add(normalized);
    ordered.push(normalized);
  }
  return { ordered, set };
};

const reconcileInlineTagsWithContent = (activeTokenSet) => {
  const tracker = inlineTrackedTags.value;
  if (!tracker.size) return;
  const tagsToRemove = new Set();
  tracker.forEach(tag => {
    if (!activeTokenSet.has(tag)) {
      tagsToRemove.add(tag);
    }
  });
  if (!tagsToRemove.size) return;
  tagsToRemove.forEach(tag => tracker.delete(tag));
  const filtered = replyTags.value.filter(tag => !tagsToRemove.has(tag));
  setReplyTagsList(filtered);
};

const collectCommittedMentionTokens = (text) => {
  const regex = new RegExp(MENTION_TOKEN_RE.source, MENTION_TOKEN_RE.flags);
  const set = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    const normalized = (match[2] || '').toLowerCase();
    if (!normalized) continue;
    set.add(normalized);
  }
  return set;
};

const reconcileInlineRecipientsWithContent = (activeMentionSet) => {
  const tracker = inlineTrackedRecipients.value;
  if (!tracker.size) return;
  const recipientsToRemove = new Set();
  tracker.forEach(userTag => {
    if (!activeMentionSet.has(userTag)) {
      recipientsToRemove.add(userTag);
    }
  });
  if (!recipientsToRemove.size) return;
  recipientsToRemove.forEach(userTag => tracker.delete(userTag));
  const current = recipients.value || [];
  const filtered = current.filter(recipient => {
    const recipientTag = (typeof recipient === 'object' ? recipient?.user_tag : recipient) || '';
    const normalizedTag = typeof recipientTag === 'string' ? recipientTag.toLowerCase() : '';
    return !recipientsToRemove.has(normalizedTag);
  });
  
  // If all tagged users are removed, restore parent author's notify flag to true
  const hasRemainingTaggedUsers = inlineTrackedRecipients.value.size > 0;
  if (!hasRemainingTaggedUsers && props.targetId) {
    // Get parent message to identify parent author
    const parentMessage = store.getters['messages/getMessage'](props.targetId);
    if (parentMessage) {
      const parentAuthorUid = getAuthorUid(parentMessage);
      const parentAuthorTag = getAuthorUserTag(parentMessage);
      
      // Restore parent author's notify flag to true
      const updatedRecipients = filtered.map(recipient => {
        if (!recipient || typeof recipient !== 'object') return recipient;
        const recipientUid = recipient.uid;
        const recipientTag = recipient.user_tag;
        const isParentAuthor = (parentAuthorUid && recipientUid === parentAuthorUid) ||
                                (parentAuthorTag && recipientTag && 
                                 parentAuthorTag.toLowerCase() === recipientTag.toLowerCase());
        if (isParentAuthor) {
          return { ...recipient, notify: true };
        }
        return recipient;
      });
      store.commit('navigation/SET_REPLY_RECIPIENTS', updatedRecipients);
      return;
    }
  }
  
  store.commit('navigation/SET_REPLY_RECIPIENTS', filtered);
};

const autoStageTagsFromContent = (allowTerminalBoundary = false) => {
  const text = content.value || '';
  const { ordered, set } = collectCommittedTagTokens(text, allowTerminalBoundary);
  const presentSet = set;
  // Cleanup suppressed tags that are no longer present
  const nextSuppressed = new Set();
  suppressedTags.value.forEach(tag => {
    if (presentSet.has(tag)) {
      nextSuppressed.add(tag);
    }
  });
  if (nextSuppressed.size !== suppressedTags.value.size) {
    suppressedTags.value = nextSuppressed;
  }
  if (ordered.length === 0) {
    reconcileInlineTagsWithContent(presentSet);
    return;
  }
  const staged = replyTags.value.slice();
  let changed = false;
  for (const tag of ordered) {
    if (suppressedTags.value.has(tag)) continue;
    if (staged.includes(tag)) continue;
    if (staged.length >= MAX_DRAFT_TAGS) break;
    staged.push(tag);
    inlineTrackedTags.value.add(tag);
    changed = true;
  }
  if (changed) {
    setReplyTagsList(staged);
  }
  reconcileInlineTagsWithContent(presentSet);
};

const sendReply = async () => {
  if (!canSendReply.value) return;
  
  // Validate subject length before sending
  if (subject.value && subject.value.length > 72) {
    store.commit('ui/SET_ERROR', 'Subject line must be 72 characters or less.');
    return;
  }

  if (content.value.length > MAX_MESSAGE_CONTENT_LENGTH) {
    store.commit('ui/SET_ERROR', `Message must be ${MAX_MESSAGE_CONTENT_LENGTH} characters or less.`);
    return;
  }
  
  autoStageTagsFromContent(true);
  
  // Make sure we have a user (and email for non-managed users)
  const currentUser = store.getters['auth/user'];
  if (!currentUser || (!currentUser.email && !currentUser.is_managed)) {
    store.commit('ui/SET_ERROR', 'You need to be logged in to send messages.');
    return;
  }
  
  try {
    isSending.value = true;
    stopTypingCue();
    
    // Handle add recipients mode
    if (isAddRecipientsMode.value) {
      if (!addRecipientsMessageId.value || recipients.value.length === 0) {
        throw new Error('No message or recipients to add');
      }
      await addRecipientsToAncestorsExcludingAuthoredMessages({
        originMessageId: addRecipientsMessageId.value,
        recipients: recipients.value,
        addToAncestors: true,
      });
      // Refresh origin and loaded ancestors
      await store.dispatch('messages/refreshLoadedAncestors', {
        messageId: addRecipientsMessageId.value,
        get_replies: true,
        get_children: true,
      });
      // Clear the form and exit add recipients mode
      content.value = '';
      store.dispatch('navigation/clearAddRecipientsMode');
      // No need to radius reload; ancestors refresh already updated data
      // Show success message
      showSendSuccess.value = true;
      setTimeout(() => {
        showSendSuccess.value = false;
      }, 2000);
      return;
    }
    
    // DRAFT REPLY FLOW: If configured, bulk add draft recipients to ancestors of parent first (notify only for reply later)
    if (props.targetId && recipients.value.length > 0 && replyAddToAncestors.value) {
      // Set notify: false on each recipient for bulk ancestor add (notify only when reply is sent)
      const recipientsWithoutNotification = recipients.value.map(recipient => {
        if (typeof recipient === 'string') {
          // String format: convert to object with notify: false
          return { user_tag: recipient, notify: false };
        } else if (typeof recipient === 'object') {
          // Object format: ensure notify: false is set
          return { ...recipient, notify: false };
        }
        return recipient;
      });
      if (replyAddToAncestors.value) {
        await addRecipientsToAncestorsExcludingAuthoredMessages({
          originMessageId: props.targetId,
          recipients: recipientsWithoutNotification,
          addToAncestors: true,
        });
      } else {
        await MessageService.addRecipientsToMessage(props.targetId, recipientsWithoutNotification, false);
      }
      // Refresh origin and loaded ancestors (no notify path)
      await store.dispatch('messages/refreshLoadedAncestors', {
        messageId: props.targetId,
        get_replies: true,
        get_children: true,
      });
    }
    
    // Create a new message using the store action (normal notification for new reply)
    // Inherit channel_ids from parent (matching bot service logic)
    
    // Process recipients: Preserve user's notify toggle settings
    // Users can toggle notify on/off for any recipient (parent author defaults to true, others default to false)
    // Convert string recipients to objects to ensure notify flag is explicit
    let processedRecipientsForReply = recipients.value.map(recipient => {
      if (typeof recipient === 'string') {
        // Convert string recipient to object format
        // Default to notify: false for string recipients (they're likely not the parent author)
        return {
          user_tag: recipient.startsWith('@') ? recipient.substring(1) : recipient,
          notify: false
        };
      }
      // Preserve object recipients as-is (including their notify flag from user toggles)
      return recipient;
    });
    
    // NEW BEHAVIOR: If user has tagged someone, tagged users replace parent author as notification recipient
    // Check if there are any tagged users (users added via inline mentions)
    const hasTaggedUsers = inlineTrackedRecipients.value.size > 0;
    
    if (hasTaggedUsers && props.targetId) {
      // Get parent message to identify parent author
      const parentMessage = store.getters['messages/getMessage'](props.targetId);
      if (parentMessage) {
        const parentAuthorUid = getAuthorUid(parentMessage);
        const parentAuthorTag = getAuthorUserTag(parentMessage);
        
        // Update recipients: tagged users get notify: true, parent author gets notify: false
        processedRecipientsForReply = processedRecipientsForReply.map(recipient => {
          const recipientUid = typeof recipient === 'object' ? recipient.uid : null;
          const recipientTag = typeof recipient === 'object' ? recipient.user_tag : null;
          
          // Check if this is a tagged user (added via inline mention)
          const isTaggedUser = recipientTag && inlineTrackedRecipients.value.has(recipientTag.toLowerCase());
          
          // Check if this is the parent author
          const isParentAuthor = (parentAuthorUid && recipientUid === parentAuthorUid) ||
                                  (parentAuthorTag && recipientTag && 
                                   parentAuthorTag.toLowerCase() === recipientTag.toLowerCase());
          
          if (isTaggedUser) {
            // Tagged users get notify: true (they replace parent author as notification recipient)
            return { ...recipient, notify: true };
          } else if (isParentAuthor) {
            // Parent author gets notify: false when there are tagged users
            return { ...recipient, notify: false };
          }
          
          // Other recipients keep their existing notify flag
          return recipient;
        });
      }
    }
    
    // Channel IDs: from reply draft, or for new threads fall back to global selected channel
    let channelIdsToSend = replyChannelIds.value;
    if (channelIdsToSend.length === 0 && !props.targetId) {
      const globalChannelId = store.getters['navigation/selectedChannelId'];
      if (globalChannelId) channelIdsToSend = [globalChannelId];
    }
    const newMessage = await store.dispatch('messages/sendReply', {
      parentId: props.targetId, // Will be null for new threads
      content: content.value,
      subject: subject.value,
      isPrivate: !isPublic.value,
      recipients: processedRecipientsForReply,
      content_author: currentUser.uid,
      tags: replyTags.value,
      files: attachments.value,
      ...(channelIdsToSend.length > 0 && { channel_ids: channelIdsToSend })
    });
    
    
    // Clear the input and files
    content.value = '';
    subject.value = '';
    attachments.value = [];
    replyChannels.value = [];
    setReplyTagsList([]);
    suppressedTags.value = new Set();
    inlineTrackedTags.value = new Set();
    inlineTrackedRecipients.value = new Set();
    
    // Resize the textarea
    autoResizeTextarea();
    
    // Show success feedback
    showSendSuccess.value = true;
    setTimeout(() => {
      showSendSuccess.value = false;
    }, 2000);
    
    // Only emit send-success for new threads
    // WebSockets will handle updates for replies to existing messages
    if (props.isNewThread) {
      emit('send-success', newMessage);
    } else if (newMessage && props.targetId) {
      // For replies to existing messages, manually add to UI
      // This ensures the message appears immediately without waiting for WebSocket
      
      // 1. Add the message to the store if not already there
      if (!store.getters['messages/getMessage'](newMessage.id)) {
        store.commit('messages/SET_MESSAGE', newMessage);
        console.log('[ReplyBox] Added new message to store:', newMessage.id);
      }
      
      // 2. Get the parent message and add child relationship if needed
      const parentMessage = store.getters['messages/getMessage'](props.targetId);
      if (parentMessage) {
        // Check if child relationship already exists
        const childExists = parentMessage.child_ids && 
                          parentMessage.child_ids.includes(newMessage.id);
        
        if (!childExists) {
          // Add child to parent
          store.commit('messages/ADD_CHILD_TO_PARENT', {
            parentId: props.targetId,
            childId: newMessage.id
          });
          
          // Always set this as branch_child, regardless of whether it's the first reply
          // Set immediately without rechecking child_ids to avoid race conditions
          store.commit('messages/SET_BRANCH_CHILD', {
            messageId: props.targetId,
            childId: newMessage.id
          });
        }
        
        // 5. Force reload the branch path in case it's not already updated
        // This needs to be done after a short delay to ensure store is updated
        setTimeout(() => {
          if (store.state.navigation && store.state.navigation.currentRoute) {
            const currentThreadId = store.state.navigation.currentRoute.params.id;
            if (currentThreadId) {
              store.dispatch('messages/prepareBranchPath', parseInt(currentThreadId, 10));
            }
          }
          
          // 6. Only hide the reply box after ensuring all UI updates are processed
          // This prevents prematurely closing the reply box before the UI updates
          if (!props.isNewThread) {
            setTimeout(() => {
              store.dispatch('navigation/clearReplyingTo');
            }, 150); // Short delay to ensure UI updates complete
          }
        }, 100);
      } else {
        // Only hide the reply box if we didn't find the parent message
        if (!props.isNewThread) {
          console.log('[ReplyBox] Hiding reply box after successful send (no parent found)');
          store.dispatch('navigation/clearReplyingTo');
        }
      }
    }
    
    return newMessage;
  } catch (error) {
    console.error('[ReplyBox] Error sending message:', error);
    console.error('[ReplyBox] Error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    store.commit('ui/SET_ERROR', 'Failed to send message. Please try again.');
    emit('send-error', error);
    throw error;
  } finally {
    isSending.value = false;
    syncTypingCue();
  }
};

// Bot prompt add moved to global modal

// Toggle recipient selector visibility
const toggleRecipientSelector = () => {
  if (!showRecipientSelector.value) {
    // Only dismiss keyboard when opening the modal
    dismissMobileKeyboard();
  }
  showRecipientSelector.value = !showRecipientSelector.value;
};

// Close recipient selector
const closeRecipientSelector = (event) => {
  if (event) {
    event.stopPropagation();
  }
  showRecipientSelector.value = false;
};

// Tags modal handlers
const toggleTagsModal = () => {
  if (!showTagsModal.value) {
    // Only dismiss keyboard when opening the modal
    dismissMobileKeyboard();
  }
  showTagsModal.value = !showTagsModal.value;
};

const closeTagsModal = () => {
  showTagsModal.value = false;
};

const handleTagsDone = (newTags) => {
  applyModalTags(newTags, true);
};

const handleTagsChange = (newTags) => {
  applyModalTags(newTags, false);
};

// Channels modal handlers
const toggleChannelsModal = () => {
  if (!showChannelsModal.value) {
    dismissMobileKeyboard();
  }
  showChannelsModal.value = !showChannelsModal.value;
};

const closeChannelsModal = () => {
  showChannelsModal.value = false;
};

const handleChannelsChange = (channelIds) => {
  // Store channel IDs for sending with the message and keep store in sync (for NewThreadView inline panel)
  const list = Array.isArray(channelIds) ? channelIds.map(id => ({ id })) : [];
  replyChannels.value = list;
  store.commit('navigation/SET_REPLY_CHANNEL_IDS', list.map(ch => ch.id).filter(Boolean));
};

const handleChannelsDone = (channelIds) => {
  handleChannelsChange(channelIds);
  closeChannelsModal();
};

// Bot prompt methods removed (handled by global modal)

// Handle clicks outside reply box
const handleClickOutside = (event) => {
  // In new thread view the reply box is not closable (avoids flicker from outside-click close)
  if (props.isNewThread) return;
  // Guard: if we just toggled a control inside the sheet, skip this close once
  if (suppressOutsideClose.value) {
    suppressOutsideClose.value = false;
    return;
  }
  // Don't close if any modal is open
  if (showRecipientSelector.value || speedDialModalVisible.value || showTagsModal.value || showChannelsModal.value) {
    return;
  }
  
  const replySheetElement = replySheet.value;
  const replyButtons = document.querySelectorAll('.reply-button, .mobile-reply-button');
  
  // Use composedPath when available to robustly detect clicks originating inside the sheet
  const path = typeof event.composedPath === 'function' ? event.composedPath() : null;
  const clickedInsideSheet = !!(
    replySheetElement && (
      replySheetElement.contains(event.target) || (path && path.includes(replySheetElement))
    )
  );
  // If a Tags modal is open anywhere (teleported), don't close when clicking inside it
  let clickedInsideTagsModal = false;
  try {
    const tagsModalEl = document.querySelector('.tags-modal');
    if (tagsModalEl) {
      clickedInsideTagsModal = tagsModalEl.contains(event.target) || (path && path.includes(tagsModalEl));
    }
  } catch (e) {}
  // If a Channels modal is open anywhere (teleported), don't close when clicking inside it
  let clickedInsideChannelsModal = false;
  try {
    const channelsModalEl = document.querySelector('.channels-modal');
    if (channelsModalEl) {
      clickedInsideChannelsModal = channelsModalEl.contains(event.target) || (path && path.includes(channelsModalEl));
    }
  } catch (e) {}
  const clickedReplyButton = Array.from(replyButtons).some(btn => btn.contains(event.target));
  
  if (clickedInsideSheet || clickedReplyButton || clickedInsideTagsModal || clickedInsideChannelsModal) {
    return;
  }
  
  hideBottomSheet();
};

// Close search results when clicking outside
onMounted(async () => {
  document.addEventListener('click', handleClickOutsideSearch);
  document.addEventListener('click', handleClickOutside);
  
  // Initialize textarea sizing
   autoStageTagsFromContent();
  nextTick(() => {
    autoResizeTextarea();
    updateOverlayHtml();
  });
});

// Watch content changes to ensure textarea resizes properly
watch(content, () => {
  autoStageTagsFromContent();
  // Reconcile inline recipients with content
  const text = content.value || '';
  const activeMentionSet = collectCommittedMentionTokens(text);
  reconcileInlineRecipientsWithContent(activeMentionSet);
  nextTick(() => {
    autoResizeTextarea();
    updateOverlayHtml();
  });
});

watch(replyTags, () => {
  nextTick(() => {
    updateOverlayHtml();
  });
}, { deep: true });

watch(recipients, (newRecipients) => {
  // Clean up tracker: remove any tracked recipients that are no longer in the list
  const currentTags = new Set();
  (newRecipients || []).forEach(recipient => {
    const tag = (typeof recipient === 'object' ? recipient?.user_tag : recipient) || '';
    if (typeof tag === 'string' && tag.trim()) {
      currentTags.add(tag.toLowerCase());
    }
  });
  const tracker = inlineTrackedRecipients.value;
  const toRemove = [];
  tracker.forEach(userTag => {
    if (!currentTags.has(userTag)) {
      toRemove.push(userTag);
    }
  });
  toRemove.forEach(userTag => tracker.delete(userTag));
  nextTick(() => {
    updateOverlayHtml();
  });
}, { deep: true });

// Inherit channels from parent message when replying (matching recipients behavior)
watch(() => props.targetId, (targetId) => {
  console.log('[ReplyBox] Channel inheritance watch fired, targetId:', targetId);
  if (targetId) {
    try {
      const parentMessage = store.getters['messages/getMessage'](targetId);
      console.log('[ReplyBox] Parent message:', parentMessage ? {
        id: parentMessage.id,
        channel_ids: parentMessage.channel_ids,
        channels: parentMessage.channels,
        hasChannelIds: !!parentMessage.channel_ids,
        hasChannels: !!parentMessage.channels,
        channelIdsType: typeof parentMessage.channel_ids,
        channelsType: typeof parentMessage.channels,
        isChannelIdsArray: Array.isArray(parentMessage.channel_ids),
        isChannelsArray: Array.isArray(parentMessage.channels)
      } : 'null');
      
      let channelsToInherit = [];
      
      // Check for full channel objects first (preferred format)
      if (parentMessage && Array.isArray(parentMessage.channels) && parentMessage.channels.length > 0) {
        channelsToInherit = parentMessage.channels
          .filter(ch => ch && ch.id)
          .map(ch => ({ id: typeof ch.id === 'string' ? ch.id : String(ch.id) }));
        console.log('[ReplyBox] Inheriting channels (full objects) from parent:', channelsToInherit);
      }
      // Fallback to channel_ids array (IDs only)
      else if (parentMessage && Array.isArray(parentMessage.channel_ids) && parentMessage.channel_ids.length > 0) {
        channelsToInherit = parentMessage.channel_ids
          .filter(id => id !== null && id !== undefined)
          .map(id => ({ id: typeof id === 'string' ? id : String(id) }));
        console.log('[ReplyBox] Inheriting channel_ids (IDs only) from parent:', channelsToInherit);
      }
      
      if (channelsToInherit.length > 0) {
        replyChannels.value = channelsToInherit;
        console.log('[ReplyBox] Set replyChannels to:', replyChannels.value);
      } else {
        console.log('[ReplyBox] No channels to inherit, clearing replyChannels');
        replyChannels.value = [];
      }
    } catch (e) {
      // Parent message might not be loaded yet, clear channels
      console.error('[ReplyBox] Error inheriting channels:', e);
      replyChannels.value = [];
    }
  } else {
    // New thread: prefer store (e.g. set by NewThreadView inline panel), else global selected channel
    const storedIds = store.getters['navigation/replyChannelIds'] || [];
    if (storedIds.length > 0) {
      replyChannels.value = storedIds.map(id => ({ id: typeof id === 'string' ? id : String(id) }));
    } else {
      const globalChannelId = store.getters['navigation/selectedChannelId'];
      if (globalChannelId) {
        const list = [{ id: globalChannelId }];
        replyChannels.value = list;
        // Keep store in sync so NewThreadView background and ReplyBox share one source of truth
        store.commit('navigation/SET_REPLY_CHANNEL_IDS', [globalChannelId]);
      } else {
        replyChannels.value = [];
      }
    }
  }
}, { immediate: true });

// When on new-thread view, keep replyChannels in sync with store (e.g. inline channels panel)
watch(() => store.getters['navigation/replyChannelIds'], (channelIds) => {
  if (!props.targetId && props.isNewThread && Array.isArray(channelIds)) {
    replyChannels.value = channelIds.map(id => ({ id: typeof id === 'string' ? id : String(id) }));
  }
}, { deep: true });

onBeforeUnmount(() => {
  stopTypingCue();
  document.removeEventListener('click', handleClickOutsideSearch);
  document.removeEventListener('click', handleClickOutside);
  if (mentionSearchTimeout) {
    clearTimeout(mentionSearchTimeout);
    mentionSearchTimeout = null;
  }
});

const handleClickOutsideSearch = (event) => {
  const searchContainer = document.querySelector('.recipient-input-container');
  const searchResults = document.querySelector('.search-results-dropdown');
  
  if (showSearchResults.value && 
      searchContainer && 
      !searchContainer.contains(event.target) &&
      searchResults && 
      !searchResults.contains(event.target)) {
    showSearchResults.value = false;
  }
};

// Watchers
watch(() => isReplying.value || props.isNewThread, (shouldShow) => {
  if (shouldShow) {
    // Reset showSubject based on mode
    showSubject.value = props.isNewThread;
    focusTextarea();
  } else {
    hideBottomSheet();
  }
}, { immediate: true });

// Handle viewport changes for keyboard detection
if (typeof window !== 'undefined' && window.visualViewport) {
  // Store initial viewport height to detect keyboard
  let initialViewportHeight = window.visualViewport.height;
  
  const handleViewportChange = () => {
    if (window.innerWidth <= 768) {
      // Calculate the difference between initial viewport and current visual viewport
      // This gives us the keyboard height more accurately than using screen.height
      const currentHeight = window.visualViewport.height;
      const heightDiff = initialViewportHeight - currentHeight;
      
      // Keyboard is visible if the viewport shrunk by more than 150px
      const keyboardIsVisible = heightDiff > 150;
      isKeyboardVisible.value = keyboardIsVisible;
      
      // Store the actual keyboard height for positioning
      // Add a small buffer (10px) to ensure content isn't cut off
      keyboardHeight.value = keyboardIsVisible ? Math.max(0, heightDiff + 10) : 0;
    } else {
      isKeyboardVisible.value = false;
      keyboardHeight.value = 0;
    }
  };
  
  // Update initial height on orientation change or significant resize
  const handleOrientationChange = () => {
    // Only update initial height when keyboard is not visible
    if (!isKeyboardVisible.value) {
      initialViewportHeight = window.visualViewport.height;
    }
  };
  
  window.visualViewport.addEventListener('resize', handleViewportChange);
  window.addEventListener('orientationchange', handleOrientationChange);
  
  // Cleanup
  onBeforeUnmount(() => {
    window.visualViewport.removeEventListener('resize', handleViewportChange);
    window.removeEventListener('orientationchange', handleOrientationChange);
  });
}

// Expose methods and properties that parent components might need
defineExpose({
  content,
  isSending,
  focus: () => {
    // Prefer message box; only fall back to subject when not new-thread and no textarea
    if (replyTextarea.value) {
      replyTextarea.value.focus();
    } else if (!props.isNewThread && showSubject.value && subjectInput.value) {
      subjectInput.value.focus();
    }
  },
  clear: () => {
    content.value = '';
    subject.value = '';
    nextTick(() => {
      autoResizeTextarea();
    });
  }
});
</script>

<style scoped>
/* Bottom sheet wrapper */
.reply-box-wrapper {
  display: contents;
}

/* Backdrop overlay */
.reply-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: transparent;
  z-index: 999;
  pointer-events: none; /* Allow clicks to pass through */
}

/* Bottom sheet: dark panel, a step above the canvas, with the same weave */
.reply-sheet {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: -20px; /* Position slightly below the viewport */
  isolation: isolate;
  background-color: #1c211f;
  background-image: linear-gradient(180deg, #242a27 0%, #1a1f1d 100%);
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  padding-bottom: calc(env(safe-area-inset-bottom) + 20px); /* Keep safe area padding */
  display: flex;
  flex-direction: column;
  max-height: calc(50vh + 20px); /* Account for the extended bottom */
  min-height: auto; /* Let it size to content */
  height: auto; /* Auto-size to content */
  transform: translateY(100%);
  transition: transform 0.3s ease-out;
}

.reply-sheet::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-image: url("/textures/texture.jpeg");
  background-repeat: repeat;
  background-size: 420px;
  opacity: 0.28;
  mix-blend-mode: multiply;
  pointer-events: none;
  z-index: 0;
}

.reply-sheet > * {
  position: relative;
  z-index: 1;
}

.reply-sheet--visible {
  transform: translateY(0);
}

.reply-sheet--raised {
  /* Use the dynamically calculated keyboard offset to move the sheet above the keyboard */
  transform: translateY(calc(-1 * var(--keyboard-offset, 0px)));
}

.reply-sheet--closing {
  animation: reply-sheet-fade-out 150ms ease forwards;
}

/* Sheet handle */
.reply-sheet__handle {
  width: 40px;
  height: 4px;
  background-color: var(--color-border);
  border-radius: 2px;
  margin: 8px auto 0;
  opacity: 0.6;
  flex-shrink: 0;
}

/* Header row */
.reply-sheet__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid #2a312d;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  flex-shrink: 0;
  background: transparent;
  position: relative;
}

.reply-sheet__header-left {
  flex: 1;
}

.reply-sheet__title {
  display: inline-block;
  margin-top: 6px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
}

.reply-sheet__header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

/* Controls toolbar */
.reply-sheet__toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  padding: 8px 16px;
  flex-shrink: 0;
  border-bottom: 1px solid #2a312d;
  background: transparent;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Toolbar controls */
.toolbar-control {
  flex-shrink: 0;
}

/* Visibility toggle switch */
.visibility-toggle {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--color-surface);
  min-height: 36px;
}

.visibility-toggle.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.visibility-option {
  flex: 1;
  background: transparent;
  border: none;
  padding: 8px 12px;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.visibility-option:first-child {
  border-right: 1px solid var(--color-border);
}

.visibility-option.active {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  font-weight: 600;
}

.visibility-option:disabled {
  cursor: not-allowed;
}

.visibility-toggle.disabled .visibility-option {
  cursor: not-allowed;
}

/* Toolbar pills: solid, a step brighter than the panel */
.meta-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #2c332f;
  border: 1px solid #3a423d;
  border-radius: var(--radius-pill);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease;
  min-height: 36px;
}

@media (hover: hover) and (pointer: fine) {
  .meta-pill:hover:not(:disabled) {
    background-color: #343c37;
    border-color: #454e48;
    color: var(--color-text);
  }
}

.meta-pill:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.meta-pill__icon {
  font-size: var(--font-size-md);
  line-height: 1;
}

.meta-pill__text {
  font-weight: 500;
}

/* Globe toggle styling */
.visibility-globe-toggle {
  position: relative;
}

.visibility-globe-toggle.active {
  background-color: #3c453f;
  border-color: #4a534c;
  color: var(--color-text);
}

.visibility-globe-toggle.active .meta-pill__icon {
  filter: none;
}
/* Stabilize active state styles and avoid sticky hover color on touch */
.visibility-globe-toggle:focus { outline: none; }
.visibility-globe-toggle:focus-visible {
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb, 79, 140, 255), 0.2);
}
@media (hover: hover) and (pointer: fine) {
  .visibility-globe-toggle.active:hover {
    background-color: #454f48;
    border-color: #545e56;
    color: var(--color-text);
  }
}

/* Textarea container - compact design */
.reply-sheet__textarea-container {
  flex: none; /* Don't expand to fill space */
  padding: 0 12px 24px 12px;
  position: relative;
  min-height: 0;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}

.reply-input-row {
  display: flex;
  align-items: stretch;
  gap: 6px;
}

.subject-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.reply-sheet__subject-input {
  flex: 1;
  min-width: 0;
  min-height: 32px;
  padding: 10px 44px 10px 10px;
  border: 1px solid #343c38;
  border-radius: 10px;
  background-color: #161815;
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--font-size-sm);
  line-height: 1.4;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}

.reply-sheet__subject-input:focus {
  outline: none;
  border-color: #4a534c;
  box-shadow: none;
}

.reply-sheet__subject-input.subject-input--error {
  border-color: var(--color-error);
}

.reply-sheet__subject-input::placeholder {
  color: var(--color-text-secondary);
}

.subject-char-count {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  pointer-events: none;
}

.subject-char-count--error {
  color: var(--color-error);
}

/* Verify CTA (shown when user lacks write perms due to unverified email) */
.verify-cta {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  margin-bottom: 10px;
  transition: background-color var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.verify-cta:hover {
  background-color: var(--color-hover-overlay);
  border-color: var(--color-border-hover);
}

.verify-cta:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb, 79, 140, 255), 0.2);
}

.verify-cta__text {
  font-size: var(--font-size-sm);
}

.verify-link-inline {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 600;
}

.verify-link-inline:hover { text-decoration: underline; }

/* Textarea wrapper - compact design */
.textarea-wrapper {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: visible;
}

.reply-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 13px 10px 10px;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  pointer-events: none;
  color: transparent;
  font-family: inherit;
  font-size: var(--font-size-sm);
  line-height: 1.4;
  letter-spacing: inherit;
  font-weight: inherit;
  font-style: inherit;
  font-variant: inherit;
  font-feature-settings: inherit;
  tab-size: inherit;
  box-sizing: border-box;
  z-index: 3;
  border-radius: 10px;
  min-height: 47px;
  border: 1px solid transparent;
}

:deep(.reply-overlay-token) {
  --reply-overlay-token-bg: transparent;
  --reply-overlay-token-border: transparent;
  position: relative;
  border-radius: 2px;
  padding: 0;
  display: inline;
  min-height: 0;
  min-width: 0;
  color: var(--color-text);
  line-height: inherit;
  z-index: 0;
}

:deep(.reply-overlay-token::before) {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -2px;
  right: -2px;
  border-radius: 2px;
  background-color: var(--reply-overlay-token-bg);
  box-shadow: inset 0 0 0 1px var(--reply-overlay-token-border);
  z-index: -1;
  pointer-events: none;
}

:deep(.reply-overlay-token--tag) {
  --reply-overlay-token-bg: rgba(255, 196, 76, 0.28);
  --reply-overlay-token-border: rgba(255, 196, 76, 0.35);
}

:deep(.reply-overlay-token--mention) {
  --reply-overlay-token-bg: rgba(92, 192, 255, 0.28);
  --reply-overlay-token-border: rgba(92, 192, 255, 0.35);
}

.mention-dropdown {
  position: absolute;
  z-index: 1000;
  min-width: 220px;
  max-width: 320px;
  max-height: 320px;
  background: var(--color-surface);
  border: 2px solid var(--color-primary);
  border-radius: 10px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
  padding: 6px 0;
  color: var(--color-text);
  overflow-y: auto;
  /* Ensure visibility */
  opacity: 1 !important;
  visibility: visible !important;
  display: block !important;
}

.mention-dropdown__status {
  padding: 8px 14px;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.mention-dropdown__list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
}

.mention-dropdown__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  cursor: pointer;
  gap: 12px;
}

.mention-dropdown__item.is-active,
.mention-dropdown__item:hover {
  background-color: var(--color-hover-overlay);
}

.mention-dropdown__name {
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.mention-dropdown__tag {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.reply-sheet__textarea {
  flex: 1;
  min-height: 47px; /* Fits top and bottom padding without clipping */
  max-height: 40vh;
  padding-top: 13px;
  padding-bottom: 10px;
  padding-left: 10px;
  padding-right: 10px;
  margin: 0;
  border: 1px solid #343c38;
  border-radius: 10px;
  background-color: #161815;
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--font-size-sm);
  line-height: 1.4;
  resize: none;
  transition: border-color 0.15s ease, height 0.15s ease;
  box-sizing: border-box;
  overflow-y: hidden; /* Will be controlled by autoResizeTextarea */
  position: relative;
  z-index: 1;
  caret-color: var(--color-text);
}

.reply-sheet__textarea:focus {
  outline: none;
  border-color: #4a534c;
  box-shadow: none;
}

.reply-sheet__textarea::placeholder {
  color: var(--color-text-secondary);
}

.md-controls {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 18px;
  margin-top: 8px;
  margin-bottom: 14px;
  padding: 0 4px;
}

.content-char-count {
  margin-left: auto;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  pointer-events: none;
}

.content-char-count--error {
  color: var(--color-error);
}

.md-control {
  width: 36px;
  height: 36px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 36px;
  border: 1px solid #3a423d;
  border-radius: 12px;
  background: #2c332f;
  color: var(--color-text);
  font-family: inherit;
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
}

.md-control:hover:not(:disabled) {
  background: #3a423d;
  border-color: #545e56;
}

.md-control:focus {
  outline: none;
}

.md-control:focus-visible {
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb, 79, 140, 255), 0.35);
}

.md-control:disabled {
  background: var(--color-surface-light);
  color: var(--color-text-disabled);
  cursor: not-allowed;
}

.md-control svg {
  width: 18px;
  height: 18px;
  display: block;
}

.md-control--italic {
  font-style: italic;
  font-weight: 500;
}

.md-control--code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: -0.03em;
}

.reply-sheet__textarea.disabled {
  background-color: var(--color-surface-light);
  color: var(--color-text-disabled);
  cursor: not-allowed;
}

/* Send: same chip as the formatting controls, with a send mark */
.textarea-send-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: auto;
  min-height: 100%;
  padding: 0;
  background: #3c453f;
  color: var(--color-text);
  border: 1px solid #545e56;
  border-radius: 10px;
  cursor: pointer;
  align-self: stretch;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.textarea-send-button svg {
  width: 18px;
  height: 18px;
  display: block;
}

.textarea-send-button:focus { outline: none; }

.textarea-send-button:focus-visible {
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb, 79, 140, 255), 0.35), 0 3px 12px rgba(0, 0, 0, 0.2);
}

.textarea-send-button:hover:not(:disabled):not(.textarea-send-button--loading):not(.textarea-send-button--success) {
  background-color: #454f48;
  color: var(--color-text);
  border-color: #626c64;
}

.textarea-send-button:active:not(:disabled):not(.textarea-send-button--loading):not(.textarea-send-button--success) {
  background-color: #343c37;
}

.textarea-send-button--disabled {
  background-color: var(--color-surface-light);
  color: var(--color-text-disabled);
  cursor: not-allowed;
  transform: none;
}

.textarea-send-button--disabled:hover {
  background-color: var(--color-surface-light);
  transform: none;
}

.textarea-send-button--loading {
  cursor: wait;
}

.textarea-send-button--success {
  background-color: var(--color-success);
  border-color: var(--color-success);
}

/* Stabilize hover while loading/success */
.textarea-send-button--loading:hover,
.textarea-send-button--success:hover {
  background-color: inherit;
  transform: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}




/* Close button */
.reply-sheet__close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: 16px;
  font-weight: bold;
  transition: color 0.2s ease;
  padding: 0;
}

.reply-sheet__close-button:hover {
  color: var(--color-error);
}

/* Mobile responsive styles */
@media (max-width: 768px) {
  /* Hide desktop reply container on mobile */
  .reply-container {
    display: none !important;
  }
  
  /* Mobile optimizations */
  
  .reply-sheet {
    left: 12px;
    right: 12px;
    border-radius: 16px 16px 0 0;
    bottom: -30px; /* Position even further below on mobile */
    max-height: calc(50vh + 30px); /* Account for the extended bottom */
    min-height: auto; /* Let it size to content */
    height: auto; /* Auto-size to content */
  }
  
  .reply-sheet__header {
    padding: 8px 16px;
  }
  
  .reply-sheet__header-right {
    gap: 8px;
  }
  
  .reply-sheet__meta {
    padding: 0 16px 16px;
  }
  
  .reply-sheet__textarea-container {
    flex: none; /* Don't expand to fill space on mobile */
    padding: 0 16px 32px 16px;
  }
  
  .toolbar-left {
    flex-wrap: wrap;
  }
}

@media (max-width: 480px) {
  .reply-sheet__title {
    font-size: var(--font-size-sm);
  }
  
  .reply-sheet__toolbar {
    padding: 4px 12px 4px;
    gap: 8px;
    flex-wrap: wrap;
  }
  
  .toolbar-left {
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .visibility-toggle {
    min-height: 32px;
  }
  
  .visibility-option {
    font-size: var(--font-size-xs);
    padding: 6px 8px;
  }
  
  .meta-pill {
    padding: 6px 8px;
    font-size: var(--font-size-xs);
    min-height: 32px;
  }
  
  .textarea-send-button {
    width: 44px;
  }
  
  .reply-sheet__close-button {
    width: 28px;
    height: 28px;
    font-size: 20px;
  }
  
  .reply-sheet__textarea {
    min-height: 47px;
    padding-top: 13px;
    padding-bottom: 10px;
  }
}

/* Desktop optimizations - keep mobile design but improve desktop UX */
@media (min-width: 769px) {
  .reply-sheet {
    left: 40px;
    right: 40px;
    width: auto;
    border-radius: 16px 16px 0 0;
    max-height: 60vh;
    padding: 0;
  }
  
  .reply-sheet--visible {
    transform: translateY(0);
  }
  
  .reply-sheet--raised {
    /* Use the dynamically calculated keyboard offset on desktop as well */
    transform: translateY(calc(-1 * var(--keyboard-offset, 0px)));
  }
  
  /* Hide mobile touch handle on desktop */
  .reply-sheet__handle {
    display: none;
  }
}

/* Common styles */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000; /* Higher explicit z-index */
}

.modal-overlay.closing {
  animation: quick-fade-out 150ms ease forwards;
}

.recipient-modal {
  position: relative; /* Change from fixed to relative */
  max-width: 450px;
  width: 95%;
  background-color: var(--color-surface);
  padding: var(--space-lg);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  z-index: 1001; /* Higher than overlay */
  max-height: 80vh; /* Prevent from being too tall on smaller screens */
  overflow-y: auto; /* Allow scrolling if needed */
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.modal-content {
  flex: 1;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-lg);
}

.add-button {
  padding: 10px 20px;
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-button:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.add-button:disabled {
  background-color: var(--color-border);
  color: var(--color-text-secondary);
  cursor: not-allowed;
  transform: none;
}

.add-button.success {
  background-color: var(--color-success);
  color: rgba(255, 255, 255, 0.9);
}

/* Keep success state stable on hover */
.add-button.success:hover {
  background-color: var(--color-success);
  transform: none;
}

.modal-footer .add-button {
  margin-right: 8px;
}

.close-button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.5rem;
  color: var(--color-text);
}

.modal-description {
  margin-bottom: 0;
  color: var(--color-text);
}

.input-wrapper {
  position: relative;
}

.search-indicator {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--font-size-xs);
  z-index: 5;
  opacity: 0.7;
  background-color: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}

.search-indicator .spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(0, 0, 0, 0.05);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.valid-indicator, .invalid-indicator {
  position: absolute;
  top: 100%;
  right: 40px;
  color: var(--color-text);
  font-size: var(--font-size-xs);
}

.valid-indicator {
  color: var(--color-success);
}

.invalid-indicator {
  color: var(--color-error);
}

.recipient-selector {
  position: absolute;
  right: unset; /* Remove right positioning */
  bottom: 40px; /* Position above the button */
  left: 50%; /* Center it on its parent */
  transform: translateX(-50%); /* Center it on its parent */
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  min-width: 280px;
  z-index: 20;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.recipient-input-row {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-xs);
}

.recipient-input {
  flex: 1;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.add-recipient-btn {
  padding: 6px 10px;
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.recipients-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.recipient-tag {
  background-color: var(--color-primary-light);
  padding: 6px 10px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.recipient-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.recipient-name {
  font-weight: 500;
}

.recipient-tag-name {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.recipient-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.visibility-toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: background-color var(--transition-fast);
}

.visibility-toggle-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.visibility-toggle-btn.invisible {
  opacity: 0.6;
}

.remove-recipient-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.no-recipients {
  color: var(--color-text-secondary);
  font-style: italic;
  font-size: var(--font-size-xs);
  padding: 4px 0;
}

.recipient-input-container {
  position: relative;
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.input-wrapper {
  position: relative;
  flex: 1;
}

.input-wrapper.valid .recipient-input {
  border-color: var(--color-success);
}

.input-wrapper.invalid .recipient-input {
  border-color: var(--color-error);
}

.recipient-input {
  width: 100%;
  padding: var(--space-xs) var(--space-md);
  padding-right: 30px; /* Space for indicators */
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
  color: var(--color-text);
  transition: border-color var(--transition-fast);
}

.search-indicator,
.valid-indicator,
.invalid-indicator {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--font-size-xs);
}

.search-indicator .spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.search-results-container {
  margin-top: 10px;
  width: 100%;
}

.search-results-list {
  width: 100%;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 10px;
}

.search-result-item {
  padding: var(--space-xs) var(--space-md);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  border-bottom: 1px solid var(--color-border-light);
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background-color: var(--color-primary-light);
}

.search-result-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.search-result-name {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
}

.search-result-tag {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.no-search-results {
  padding: var(--space-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  text-align: center;
  font-style: italic;
}

.input-wrapper.searching .recipient-input {
  padding-right: 35px; /* Extra space for the spinner */
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes quick-fade-out {
  0% { opacity: 1; }
  100% { opacity: 0; }
}

@keyframes reply-sheet-fade-out {
  0% { 
    opacity: 1;
    transform: translateY(0);
  }
  100% { 
    opacity: 0;
    transform: translateY(20px);
  }
}

/* Make scrollbar invisible until in use */
.reply-input::-webkit-scrollbar {
  width: 8px;
}

.reply-input::-webkit-scrollbar-track {
  background: transparent;
}

.reply-input::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 4px;
}

.reply-input:hover::-webkit-scrollbar-thumb {
  background: var(--color-border-dark);
}

.reply-input {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.reply-input:hover {
  scrollbar-color: var(--color-border-dark) transparent;
}



.send-button__text {
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.send-button__icon {
  font-size: var(--font-size-lg);
  font-weight: bold;
}

.send-button__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid var(--color-text-inverse);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* OLD MOBILE STYLES MOVED TO DESKTOP-ONLY SECTION ABOVE */
/* These styles are now only active on desktop (min-width: 769px) to avoid conflicts with the new bottom sheet */



/* Speed dial modal styles */
.quick-prompt-modal {
  position: relative;
  max-width: 450px;
  width: 95%;
  height: 75vh;
  max-height: 75vh;
  background-color: var(--color-surface);
  padding: var(--space-lg);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  z-index: 1001;
  overflow-y: auto;
}

/* Small, subtle toggle for "Add to all ancestors" in bot modal */
.ancestors-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  margin-bottom: 6px;
  opacity: 0.8;
}

.ancestors-toggle label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.ancestors-toggle input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: var(--color-primary);
  position: relative;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background-color: var(--color-surface);
}
.ancestors-toggle input[type="checkbox"]:checked::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -55%);
  color: rgba(255, 255, 255, 0.95);
  font-size: 12px;
  font-weight: bold;
  line-height: 1;
}
.ancestors-toggle input[type="checkbox"]:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.ancestors-toggle span {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.bot-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: var(--space-md);
}

.bot-option-button {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: var(--font-size-md);
  width: 100%;
  text-align: left;
  margin-bottom: 6px;
}

.bot-option-button:hover:not(:disabled) {
  background-color: var(--color-hover-overlay);
  border-color: var(--color-border-hover);
}

.bot-option-button:disabled {
  opacity: 0.7;
  cursor: wait;
}

.bot-option-button.confirm-state {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.bot-option-button.confirm-state:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  border-color: var(--color-primary-dark);
}

.bot-option-button.loading {
  background-color: var(--color-surface-light);
  border-color: var(--color-border);
  color: var(--color-text-secondary);
  cursor: wait;
}

.bot-option-button.success {
  background-color: var(--color-success);
  border-color: var(--color-success);
  color: var(--color-text-inverse);
}

.bot-option-button.error {
  background-color: var(--color-error);
  border-color: var(--color-error);
  color: var(--color-text-inverse);
}

/* Advanced bots dropdown styles */
.advanced-bot-options {
  margin-top: 8px;
}

.advanced-bots-inline {
  display: inline-block;
}

.advanced-bots-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: var(--font-size-xs);
  opacity: 0.7;
}

.advanced-bots-toggle:hover {
  background-color: var(--color-hover-overlay);
  border-radius: var(--radius-sm);
  opacity: 1;
}

.advanced-bots-text {
  font-weight: 400;
}

.advanced-bots-icon {
  font-size: 9px;
  transition: transform var(--transition-fast);
}

.advanced-bots-icon.expanded {
  transform: rotate(180deg);
}

.advanced-bot-list {
  margin-top: 6px;
  padding-left: 0;
}

.advanced-bot-button {
  margin-bottom: 6px;
  opacity: 0.8;
  transform: scale(0.95);
}

.advanced-bot-button:last-child {
  margin-bottom: 0;
}

.bot-option-icon {
  font-size: var(--font-size-lg);
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
}

.bot-option-text {
  font-weight: 500;
  flex: 1;
}

.bot-loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Mobile responsive adjustments for speed dial modal */
@media (max-width: 768px) {
  .quick-prompt-modal {
    max-width: 95%;
    padding: var(--space-md);
  }
  
  .bot-option-button {
    padding: 10px 12px;
    font-size: var(--font-size-sm);
  }
  
  .bot-option-icon {
    font-size: var(--font-size-md);
    min-width: 18px;
  }
}

@media (max-width: 480px) {
  .quick-prompt-modal {
    padding: var(--space-sm);
  }
  
  .bot-option-button {
    padding: 8px 10px;
    gap: 8px;
  }
}

/* Attachment preview */
.attachment-preview {
  padding: 0 16px 6px;
  margin-top: -4px;
  background: transparent;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.attachment-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 13px;
}

.attachment-preview-icon {
  font-size: 16px;
  flex-shrink: 0;
  line-height: 1;
  margin-top: 2px;
}

.attachment-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 2px;
}

.attachment-name {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.attachment-size {
  font-size: 11px;
  color: var(--color-text-secondary, rgba(0, 0, 0, 0.6));
  opacity: 0.7;
}

.attachment-progress {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.attachment-progress-text {
  font-size: 11px;
  color: var(--color-text-secondary, rgba(0, 0, 0, 0.6));
  opacity: 0.85;
}

.attachment-progress-bar {
  width: 100%;
  height: 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.attachment-progress-fill {
  height: 100%;
  width: 0;
  background: var(--color-secondary);
  transition: width 0.08s linear;
}

.attachment-remove {
  background: none;
  border: none;
  color: var(--color-text-3);
  cursor: pointer;
  padding: 0;
  font-size: 16px;
  line-height: 1;
}

.attachment-remove:hover {
  color: var(--color-error);
}
</style> 
