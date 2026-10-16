<template>
  <div
    class="message-preview"
    :class="{
      compact,
      selected,
      selectable: isSelectable,
      'single-line-mode': displayMode === 'single-line'
    }"
    :data-message-id="message.id"
  >
    <!-- Single line mode layout -->
    <div v-if="displayMode === 'single-line'" class="single-line-content" @click="handleMessageClick">
      <span class="author-prefix">{{ authorDisplayName }}:</span>
      <span class="content-text" :style="messageBodyStyle">{{ truncatedContent }}</span>
    </div>

    <!-- Standard preview layout -->
    <div
      v-else
      class="message-preview-content"
      @click="handleMessageClick"
      :class="{ selectable: isSelectable }"
    >
      <div class="message-header">
        <div class="author-section">
          <span
            v-if="message.unread_count_in_thread && message.unread_count_in_thread > 0"
            class="unread-thread-badge"
          >
            {{ message.unread_count_in_thread }}
          </span>

          <div class="author-info">
            <template v-if="showParticipantsLabel">
              <template v-for="(participant, index) in participantItems" :key="participant.key">
                <UserDisplay
                  :display-name="participant.displayName"
                  :user-tag="participant.userTag"
                  :show-tag="false"
                  :is-bot="participant.isBot"
                  :is-imported="participant.isImported"
                  name-class="message-author"
                  variant="message"
                />
                <span
                  v-if="index < participantItems.length - 1"
                  class="participants-separator"
                >
                  ,&nbsp;
                </span>
              </template>
            </template>
            <UserDisplay
              v-else
              :display-name="authorDisplayName"
              :user-tag="authorUserTag"
              :show-tag="!!authorUserTag"
              :is-current-user="isCurrentUser"
              :is-bot="isBot"
              :is-imported="isImported"
              name-class="message-author"
              tag-class="author-user-tag"
              variant="message"
            />

            <span
              v-if="isImported"
              class="imported-badge"
              :title="importedBadgeTitle"
            >
              via <UserDisplay
                :display-name="props.message.import_info?.importer_user_tag"
                :user-tag="props.message.import_info?.importer_user_tag"
                :show-tag="false"
                variant="badge"
                size="xs"
              />
              <a
                v-if="props.message.import_info?.source_url"
                :href="props.message.import_info.source_url"
                target="_blank"
                rel="noopener noreferrer"
                class="import-source-link"
              >
                🔗
              </a>
            </span>
          </div>

          <button
            v-if="isUserRecipient"
            @click.stop="toggleReadStatus"
            class="envelope-icon-button"
            :disabled="isTogglingReadStatus || isAutoMarkingAsRead"
            :class="{ loading: isTogglingReadStatus || isAutoMarkingAsRead }"
            :title="isAutoMarkingAsRead ? 'Auto-marking as read...' : (isMessageUnread ? 'Click to mark as read' : 'Click to mark as unread')"
          >
            <span
              v-if="isTogglingReadStatus || isAutoMarkingAsRead"
              class="loading-indicator"
            ></span>
            <svg
              v-else-if="isMessageUnread"
              class="envelope-icon unread"
              viewBox="0 0 100 100"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="m84.965 16.363h-69.93c-6.5664 0-11.91 5.3438-11.91 11.91v43.453c0 6.5664 5.3438 11.91 11.91 11.91h69.93c6.5664 0 11.91-5.3438 11.91-11.91v-43.453c0-6.5664-5.3438-11.91-11.91-11.91zm5.6602 11.91v43.453c0 0.55078-0.10547 1.0742-0.25 1.5781l-26.02-23.309 26.02-23.305c0.14844 0.50391 0.25391 1.0273 0.25391 1.5781zm-5.6602-5.6602c0.18359 0 0.35547 0.039063 0.53125 0.054688l-28.926 25.91c-3.75 3.3516-9.3984 3.3516-13.148-0.003906l-28.922-25.906c0.17969-0.015625 0.35156-0.054688 0.53125-0.054688zm-75.34 50.691c-0.14844-0.50391-0.25-1.0273-0.25-1.5781v-43.453c0-0.55078 0.10547-1.0742 0.25-1.5781l26.016 23.309-26.016 23.305zm5.4102 4.082c-0.18359 0-0.35547-0.039063-0.53516-0.054688l25.879-23.184c2.8516 2.1289 6.2344 3.1992 9.6211 3.1992s6.7656-1.0703 9.6172-3.1992l25.879 23.184c-0.17969 0.015625-0.35156 0.054688-0.53516 0.054688z"
              />
            </svg>
            <svg
              v-else
              class="envelope-icon read"
              viewBox="0 0 100 100"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="m91.656 35.066c-0.089844-0.085937-31.234-27.965-31.234-27.965-5.9414-5.3164-14.898-5.3203-20.832-0.003906 0 0-31.391 28.109-31.441 28.164-2.1875 2.1875-3.3906 5.0977-3.3906 8.1914v41.836c0 6.3867 5.1953 11.582 11.582 11.582h67.332c6.3867 0 11.582-5.1953 11.582-11.582v-41.836c0-3.1562-1.3086-6.2109-3.5938-8.3867zm-2.6562 8.3867v41.836c0 0.45703-0.074219 0.89063-0.18359 1.3125l-24.82-22.234 24.82-22.234c0.10938 0.42578 0.18359 0.86328 0.18359 1.3164zm-46.23-30.816 0.98047-0.875c3.5625-3.1914 8.9375-3.1875 12.504 0.003906l28.555 25.574-25.551 22.891c-5.5-4.0586-13.016-4.0586-18.516 0l-25.551-22.891 27.574-24.703zm-31.582 73.969c-0.10938-0.42188-0.18359-0.85938-0.18359-1.3125v-41.836c0-0.45312 0.074219-0.88672 0.18359-1.3164l24.82 22.234zm5.1484 4.0195c-0.082032 0-0.16016-0.019531-0.24219-0.023438l26.676-23.895 0.98047-0.875c3.5625-3.1914 8.9375-3.1875 12.504 0.003907l27.652 24.77c-0.082031 0.003906-0.15625 0.023437-0.24219 0.023437z"
              />
            </svg>
          </button>

          <button
            v-if="hasRecipients"
            @click.stop="openAddRecipientsModal"
            class="recipients-toggle author-toggle"
            title="Add recipients to this message"
          >
            Recipients {{ typeof message.recipients === 'string' ? '' : `(${deduplicatedRecipients.length})` }}
          </button>

          <button
            @click.stop="openTagsModal"
            class="tags-toggle"
            title="Manage tags for this message"
          >
            Tags ({{ existingTags.length }})
          </button>

          <button
            @click.stop="openChannelsModal"
            class="channels-toggle"
            title="Manage channels for this message"
          >
            Channels ({{ existingChannels.length }})
          </button>

          <span
            @click.stop="canToggleVisibility && toggleVisibility()"
            class="globe-emoji"
            :class="[isPublic ? 'visible' : 'hidden', canToggleVisibility ? 'interactive' : 'non-interactive']"
            :title="canToggleVisibility ? (isPublic ? 'Make private' : 'Make public') : (isPublic ? 'Public' : 'Private')"
            :role="canToggleVisibility ? 'button' : null"
            :tabindex="canToggleVisibility ? 0 : -1"
          >
            🌍
          </span>
        </div>

        <div class="header-right">
          <span class="message-timestamp">{{ formatTimestamp(message.timestamp) }}</span>
          <input
            v-if="isSelectable"
            type="checkbox"
            :checked="selected"
            @change="handleSelectionToggle"
            @click.stop
            class="selection-checkbox"
          />
        </div>
      </div>

      <div class="message-body" :style="messageBodyStyle">
        <div v-if="message.subject" class="message-subject">{{ message.subject }}</div>
        <formatted-content
          v-if="displayMode === 'full'"
          :content="displayContent"
          :options="formattedContentOptions"
        />
        <div v-else-if="!message.subject" class="plaintext-content">{{ truncatedContent }}</div>
      </div>

      <message-attachments :attachments="message.files" />
    </div>

    <teleport to="body">
      <TagsModal
        :is-visible="showTagsModal"
        :is-add-mode="true"
        :existing-tags="existingTags"
        :message-id="message?.id"
        @close="closeTagsModal"
        @update="handleTagsUpdate"
        @done="closeTagsModal"
      />
      <ChannelsModal
        :is-visible="showChannelsModal"
        :is-add-mode="true"
        :existing-channels="existingChannels"
        :message-id="message?.id"
        @close="closeChannelsModal"
        @update="handleChannelsUpdate"
        @done="closeChannelsModal"
      />
    </teleport>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import FormattedContent from './FormattedContent/index.vue';
import TagsModal from './modals/TagsModal.vue';
import ChannelsModal from './modals/ChannelsModal.vue';
import MessageAttachments from './MessageAttachments.vue';
import UserDisplay from './common/UserDisplay.vue';
import { memoize } from 'lodash-es';
import { dismissMobileKeyboard } from '../utils/mobileKeyboard.js';
import ChannelsService from '../services/ChannelsService.js';
import { messageFontStyle } from '../config/fonts.js';
import { contentText, getAuthorDisplayName, getAuthorUserTag, getAuthorUid, isAuthorBot } from '../utils/messageCompat.js';

const props = defineProps({
  message: {
    type: Object,
    required: true
  },
  selectable: {
    type: Boolean,
    default: false
  },
  selected: {
    type: Boolean,
    default: false
  },
  compact: {
    type: Boolean,
    default: false
  },
    displayMode: {
      type: String,
      default: 'preview',
      validator: (value) => ['preview', 'full', 'single-line'].includes(value)
    },

  currentTab: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['navigate', 'selectionToggled', 'delete']);

const store = useStore();
const showTagsModal = ref(false);
const showChannelsModal = ref(false);
const isTogglingReadStatus = ref(false);

const currentUser = computed(() => store.getters['auth/user']);
const isAdmin = computed(() => store.getters['auth/isAdmin']);
const canDeleteMessage = (message) => store.getters['auth/canDeleteMessage'](message);

const isAutoMarkingAsRead = computed(() => store.getters['messages/isMessageMarkingAsRead'](props.message.id));
const isMessageUnread = computed(() => store.getters['messages/isMessageUnread'](props.message.id));
const isSelectionMode = computed(() => store.getters['navigation/isSelectionMode']);

const isPublic = computed(() => {
  const publicValue = props.message.public;
  return publicValue === 1 || publicValue === true;
});

const messageBodyStyle = computed(() => messageFontStyle(props.message?.font));

const canToggleVisibility = computed(() => {
  if (!currentUser.value) return false;
  return store.getters['auth/canUpdateMessagePublicity'](props.message);
});

const isImported = computed(() => {
  return !!props.message.import_info?.display_name;
});

const importedBadgeTitle = computed(() => {
  const info = props.message.import_info || {};
  const importer = info.importer_user_tag || 'user';
  const platform = typeof info.source_platform === 'string' ? info.source_platform.trim() : '';
  if (platform) {
    return `Imported by ${importer} from ${platform}`;
  }
  return `Imported by ${importer}`;
});

const authorDisplayName = computed(() => {
  if (isImported.value && props.message.import_info?.display_name) {
    return props.message.import_info.display_name;
  }
  return getAuthorDisplayName(props.message);
});

const authorUserTag = computed(() => {
  if (isImported.value) return null;
  return getAuthorUserTag(props.message);
});

const authorUid = computed(() => getAuthorUid(props.message));

const isBot = computed(() => isAuthorBot(props.message));

const isCurrentUser = computed(() => {
  if (!currentUser.value) return false;
  if (authorUserTag.value && currentUser.value.user_tag === authorUserTag.value) {
    return true;
  }
  return authorUid.value === currentUser.value.uid;
});

const isUserRecipient = computed(() => {
  if (!currentUser.value) return false;
  if (!props.message.recipients) return false;
  if (typeof props.message.recipients === 'string') return false;

  return props.message.recipients.some((recipient) => {
    if (recipient.uid === currentUser.value.uid) return true;
    if (recipient.user_tag && currentUser.value.user_tag && recipient.user_tag === currentUser.value.user_tag) {
      return true;
    }
    return false;
  });
});

const deduplicateRecipients = (recipientEdges) => {
  if (!recipientEdges || !Array.isArray(recipientEdges)) return [];

  const recipientGroups = {};
  recipientEdges.forEach((edge) => {
    if (!recipientGroups[edge.uid]) {
      recipientGroups[edge.uid] = [];
    }
    recipientGroups[edge.uid].push(edge);
  });

  return Object.keys(recipientGroups).map((uid) => recipientGroups[uid][0]);
};

const deduplicatedRecipients = computed(() => {
  if (typeof props.message.recipients === 'string') {
    return [];
  }
  return deduplicateRecipients(props.message.recipients || []);
});

const hasRecipients = computed(() => true);

const showParticipantsLabel = computed(() => props.currentTab === 'inbox');

const participantItems = computed(() => {
  if (!showParticipantsLabel.value) return [];

  const items = [];
  const seen = new Set();
  const addParticipant = ({
    displayName,
    userTag = null,
    isBot = false,
    isImported: participantIsImported = false
  }) => {
    const keySource = displayName || userTag || '';
    const key = String(keySource).trim().toLowerCase();
    if (!key) return;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      key: `${key}-${items.length}`,
      displayName: displayName || userTag || 'Unknown',
      userTag,
      isBot: !!isBot,
      isImported: !!participantIsImported
    });
  };

  const authorName = authorDisplayName.value || '';
  if (authorName || authorUserTag.value) {
    addParticipant({
      displayName: authorName || authorUserTag.value || '',
      userTag: authorUserTag.value,
      isBot: isBot.value,
      isImported: isImported.value
    });
  }

  if (typeof props.message.recipients !== 'string' && Array.isArray(props.message.recipients)) {
    deduplicatedRecipients.value.forEach((recipient) => {
      const name = recipient.display_name || recipient.user_tag;
      addParticipant({
        displayName: name,
        userTag: recipient.user_tag || null,
        isBot: recipient.is_bot
      });
    });
  }

  return items;
});

const stripMarkdown = (text) => {
  if (!text) return '';

  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '[code block]')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/^(---|\*\*\*)\s*$/gm, '')
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const displayContent = computed(() => contentText(props.message?.content));

const truncatedContent = computed(() => {
  const text = displayContent.value;
  if (!text) return '';

  return memoize((content) => {
    let processedContent = content;
    if (props.displayMode === 'preview' || props.displayMode === 'single-line') {
      processedContent = stripMarkdown(content);
    }
    return processedContent;
  })(text);
});

const renderTagSet = computed(() => {
  const tags = props.message?.tags;
  if (!Array.isArray(tags)) return new Set();
  const set = new Set();
  tags.forEach((tag) => {
    const value = typeof tag === 'string' ? tag : tag?.name;
    if (typeof value === 'string' && value.trim()) {
      set.add(value.toLowerCase());
    }
  });
  return set;
});

const renderMentionSet = computed(() => {
  const recipients = props.message?.recipients;
  if (!Array.isArray(recipients)) return new Set();
  const set = new Set();
  recipients.forEach((recipient) => {
    const tag = (typeof recipient === 'object' ? recipient?.user_tag : recipient) || '';
    if (typeof tag === 'string' && tag.trim()) {
      set.add(tag.toLowerCase());
    }
  });
  return set;
});

const formattedContentOptions = computed(() => ({
  validTags: renderTagSet.value,
  validMentions: renderMentionSet.value
}));

const existingTags = computed(() => {
  const tags = props.message && Array.isArray(props.message.tags) ? props.message.tags : [];
  const seen = new Set();
  const deduplicated = [];
  for (const tag of tags) {
    if (!tag) continue;
    const tagName = typeof tag === 'string' ? tag.toLowerCase() : (tag.name || '').toLowerCase();
    if (tagName && !seen.has(tagName)) {
      seen.add(tagName);
      deduplicated.push(tag);
    }
  }
  return deduplicated;
});

const existingChannels = computed(() => {
  // Messages now always have channels as array of full channel objects
  const msg = props.message;
  if (!msg) return [];
  
  if (Array.isArray(msg.channels) && msg.channels.length > 0) {
    return msg.channels.filter(ch => ch && ch.id);
  }
  
  return [];
});

const hasChannels = computed(() => {
  return existingChannels.value.length > 0;
});

const openTagsModal = () => {
  dismissMobileKeyboard();
  showTagsModal.value = true;
};

const closeTagsModal = () => {
  showTagsModal.value = false;
};

const openChannelsModal = () => {
  dismissMobileKeyboard();
  showChannelsModal.value = true;
};

const closeChannelsModal = () => {
  showChannelsModal.value = false;
};

const handleTagsUpdate = async ({ messageId, tags }) => {
  try {
    if (!messageId) return;
    const tagArray = Array.isArray(tags) ? tags : [];
    await store.dispatch('messages/updateMessageTags', { id: messageId, tags: tagArray });
  } catch (error) {
    console.error('[MessagePreview] Failed to update tags', error);
    store.commit('ui/SET_ERROR', 'Failed to update tags');
  }
};

const handleChannelsUpdate = async ({ messageId, channel_ids }) => {
  try {
    if (!messageId) return;
    const channelIdsArray = Array.isArray(channel_ids) ? channel_ids : [];
    
    // Call API to update message channels
    const response = await ChannelsService.updateMessageChannels(messageId, channelIdsArray);
    
    // Update the message in the store with the new channels data
    if (response && response.success && response.channels) {
      const existing = store.getters['messages/getMessage'](messageId) || {};
      const updated = {
        ...existing,
        channels: response.channels || []
      };
      store.commit('messages/SET_MESSAGE', updated);
    }
    
    console.log('[MessagePreview] Updated channels:', { messageId, channel_ids: channelIdsArray });
  } catch (error) {
    console.error('[MessagePreview] Failed to update channels', error);
    let errorMessage = 'Failed to update channels';
    if (error.response && error.response.data && error.response.data.detail) {
      errorMessage = error.response.data.detail;
    } else if (error.message) {
      errorMessage = error.message;
    }
    store.commit('ui/SET_ERROR', errorMessage);
  }
};

const openAddRecipientsModal = () => {
  dismissMobileKeyboard();
  const existingRecipients =
    props.message.recipients && Array.isArray(props.message.recipients) ? props.message.recipients : [];

  const modalConfig = {
    isPublic: false,
    isAddMode: true,
    existingRecipients,
    messageId: props.message.id
  };

  store.dispatch('navigation/showRecipientsModal', modalConfig);
};

const toggleVisibility = async () => {
  try {
    const target = !isPublic.value;
    const ok = await store.dispatch('messages/togglePublicMessage', {
      messageId: props.message.id,
      makePublic: target
    });
    if (!ok) {
      console.warn('[MessagePreview] Failed to toggle visibility');
    }
  } catch (error) {
    console.error('[MessagePreview] toggleVisibility error', error);
  }
};

const toggleReadStatus = async () => {
  if (isTogglingReadStatus.value) return;

  isTogglingReadStatus.value = true;
  try {
    if (isMessageUnread.value) {
      await store.dispatch('messages/markMessageAsRead', props.message.id);
    } else {
      await store.dispatch('messages/markMessageAsUnread', props.message.id);
    }
  } catch (error) {
    console.error('[MessagePreview] Error toggling read status:', error);
  } finally {
    isTogglingReadStatus.value = false;
  }
};

const isSelectable = computed(() => props.selectable && !isSelectionMode.value);

const handleMessageClick = () => {
  if (!isSelectable.value) {
    emit('navigate', props.message.id);
  }
};

const handleSelectionToggle = () => {
  emit('selectionToggled', props.message.id);
};

const formatTimestamp = (timestamp) => {
  return new Date(timestamp).toLocaleString();
};
</script>

<style scoped>
.message-preview {
  width: 100%;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
  padding: 0 8px;
  transition: box-shadow var(--transition-normal);
}

.message-preview.selected .message-preview-content {
  border: 2px solid var(--color-primary);
  background-color: var(--color-primary-light);
}

.message-preview.single-line-mode {
  max-width: 100%;
  padding: 0;
  margin: 0;
}

.single-line-content {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 4px 8px;
  background-color: transparent;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  overflow: hidden;
}

.single-line-content:hover {
  background-color: var(--color-hover-overlay);
  color: var(--color-text);
}

.single-line-content .author-prefix {
  font-weight: 700;
  flex-shrink: 0;
  color: var(--color-primary);
}

.single-line-content .content-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--author-font, var(--font-family-base));
}

.message-preview-content {
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  padding: var(--space-lg) var(--space-xl);
  border: 1px solid var(--color-border);
  width: 100%;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
  cursor: pointer;
}

.message-preview-content.selectable {
  cursor: default;
}

.message-preview:hover .message-preview-content {
  box-shadow: var(--color-card-shadow, 0 4px 6px rgba(0, 0, 0, 0.1));
  background-color: var(--color-hover-overlay, rgba(0, 0, 0, 0.02));
  border-color: var(--color-primary-light, rgba(0, 123, 255, 0.3));
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-xs);
  gap: var(--space-sm);
}

.author-section {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-wrap: wrap;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.message-author {
  font-weight: bold;
}

.message-author.current-user-name {
  font-weight: 800;
  color: var(--color-primary);
}

.author-user-tag {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.message-timestamp {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.message-subject {
  font-weight: 700;
  font-size: 1.1em;
  margin-bottom: 4px;
  color: var(--color-text);
  line-height: 1.3;
}

.selection-checkbox {
  cursor: pointer;
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
  appearance: none;
  background-color: transparent;
  border: 2px solid var(--color-border);
  border-radius: 4px;
  position: relative;
  transition: all var(--transition-fast);
  margin: 0;
}

.selection-checkbox:hover {
  border-color: var(--color-primary);
  background-color: var(--color-hover-overlay);
}

.selection-checkbox:checked {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

.selection-checkbox:checked::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 2px;
  width: 4px;
  height: 8px;
  border: solid var(--color-text-inverse);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.message-body {
  margin-bottom: var(--space-xs);
  white-space: normal;
  word-wrap: break-word;
  width: 100%;
  color: #ffffff;
  font-family: var(--author-font, var(--font-family-base));
}

.message-preview .plaintext-content {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.5;
  font-size: 0.9rem;
  color: #ffffff;
}

.unread-thread-badge {
  background-color: #dc3545;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  line-height: 1;
}

.recipients-toggle,
.tags-toggle,
.channels-toggle {
  font-size: var(--font-size-xs);
  padding: 2px 6px;
  border-radius: var(--radius-pill);
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.recipients-toggle {
  background-color: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.recipients-toggle.author-toggle {
  background-color: var(--color-warning);
  color: var(--color-text-inverse);
  border: none;
}

.tags-toggle {
  background-color: rgba(79, 140, 255, 0.12);
  border: 1px solid rgba(79, 140, 255, 0.45);
  color: #4f8cff;
}

.tags-toggle:hover {
  background-color: rgba(79, 140, 255, 0.18);
  border-color: rgba(79, 140, 255, 0.75);
}

.channels-toggle {
  background-color: rgba(255, 165, 0, 0.12);
  border: 1px solid rgba(255, 165, 0, 0.45);
  color: #FFA500;
}

.channels-toggle:hover {
  background-color: rgba(255, 165, 0, 0.18);
  border-color: rgba(255, 165, 0, 0.75);
}

.globe-emoji {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 24px;
  font-size: 16px;
  cursor: pointer;
  transition: all var(--transition-fast);
  opacity: 0.8;
}

.globe-emoji.visible {
  opacity: 1;
}

.globe-emoji.hidden {
  opacity: 0.4;
}

.globe-emoji.non-interactive {
  cursor: default;
}

.envelope-icon-button {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  border-radius: var(--radius-xs);
  width: 24px;
  height: 24px;
}

.envelope-icon-button:hover:not(:disabled) {
  background-color: var(--color-hover-overlay);
  transform: scale(1.1);
}

.envelope-icon-button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.envelope-icon {
  width: 16px;
  height: 16px;
  transition: all var(--transition-fast);
}

.envelope-icon.unread {
  fill: var(--color-error);
}

.envelope-icon.read {
  fill: var(--color-text-secondary);
}

.loading-indicator {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.message-preview.compact .message-preview-content {
  padding: var(--space-md) var(--space-lg);
}

.message-preview.compact .plaintext-content {
  font-size: 0.85rem;
}

.message-preview.compact .message-author {
  font-size: var(--font-size-sm);
}

.message-preview.compact .author-user-tag {
  font-size: calc(var(--font-size-xs) - 1px);
}

.message-preview.compact .message-timestamp {
  font-size: calc(var(--font-size-xs) - 1px);
}

.imported-badge {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--color-hover-overlay);
  padding: 1px 6px;
  border-radius: 4px;
  margin-left: 4px;
  cursor: help;
}

.import-source-link {
  text-decoration: none;
  font-size: 0.8rem;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.import-source-link:hover {
  opacity: 1;
}

.message-preview.compact .recipients-toggle,
.message-preview.compact .tags-toggle,
.message-preview.compact .channels-toggle {
  font-size: calc(var(--font-size-xs) - 1px);
  padding: 1px 5px;
  height: 20px;
}

@media (max-width: 768px) {
  .message-preview {
    padding: 0 5px;
  }

  .message-preview-content {
    padding: var(--space-xs) var(--space-md);
  }

  .header-right .message-timestamp {
    display: none;
  }

  .author-section {
    gap: 8px;
    flex: 1;
    min-width: 0;
  }
}

@media (max-width: 480px) {
  .message-preview-content {
    padding: var(--space-xs) var(--space-sm);
    margin: 0 2px;
  }

  .author-section {
    gap: 4px;
  }

  .message-author {
    font-size: calc(var(--font-size-sm) - 1px);
  }

  .author-user-tag {
    font-size: calc(var(--font-size-xs) - 1px);
  }
}
</style>
