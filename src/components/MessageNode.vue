<template>
  <div 
     class="message-node" 
   :class="{ 
       'list-view': inListView,
       'compact': compact,
       'selected': inListView ? selected : isMessageSelected,
       'dropdown-open': showActionBar,
       'collapsed': isCollapsed
     }"
   :data-message-id="message.id"
   :data-has-siblings="shouldReserveSiblingNavSpace"
    ref="messageNodeRef"
  >
    <!-- Desktop sibling navigator - absolutely positioned outside the rotating card -->
    <sibling-navigator
      v-if="showSiblingNavDesktop"
      :message-id="message.id"
      :parent-id="message.parent_id"
      :mobile-mode="false"
      @navigate="handleSiblingNavigation"
      :data-debug-has-siblings="hasSiblings"
    />

    <!-- Mobile sibling navigator is rendered outside the rotating card. -->
    <div v-if="showSiblingNavMobile" class="mobile-sibling-nav-slot">
      <sibling-navigator
        :message-id="message.id"
        :parent-id="message.parent_id"
        :mobile-mode="isMobile"
        @navigate="handleSiblingNavigation"
        :data-debug-has-siblings="hasSiblings"
      />
    </div>

    <div 
      class="message-content" 
      ref="messageContentRef" 
      @click="handleMessageClick"
      :class="[{ 'selectable': selectable }, navAnimationClass]"
    >
      <div class="message-header">
        <!-- Row 1: Author info + datetime -->
        <div class="header-row header-row--author">
          <div class="author-row-left">
            <!-- Unread thread count badge - only shown in inbox/list view -->
            <span v-if="inListView && message.unread_count_in_thread && message.unread_count_in_thread > 0" class="unread-thread-badge">
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
              :display-name="isImported ? message.import_info.display_name : authorDisplayName"
              :user-tag="isImported ? null : authorUserTag"
              :show-tag="!isImported && !!authorUserTag"
              :is-current-user="isCurrentUser"
              :is-bot="isBot"
              :is-imported="isImported"
              name-class="message-author"
              tag-class="author-user-tag"
              variant="message"
               :title="isBot ? botVersionTooltip : undefined"
             />
            <span v-if="isImported" class="imported-badge" :title="'Imported by ' + message.import_info.importer_user_tag">
              via <UserDisplay 
                :display-name="message.import_info.importer_user_tag"
                :user-tag="message.import_info.importer_user_tag"
                :show-tag="false"
                variant="badge"
                size="xs"
              />
              <a v-if="message.import_info.source_url" :href="message.import_info.source_url" target="_blank" rel="noopener noreferrer" class="import-source-link">
                🔗
              </a>
            </span>
          </div>
        </div>
        
        <!-- Datetime on the right -->
        <div v-if="!inListView" class="header-row-right">
          <span class="message-timestamp">{{ formatTimestamp(message.timestamp) }}</span>
        </div>
        
        <!-- Mobile-only timestamp below username/buttons -->
        <span v-if="inListView" class="message-timestamp mobile-inline-timestamp">{{ formatTimestamp(message.timestamp) }}</span>
      </div>
      
      <!-- Row 2: Badges + collapse/checkbox -->
      <div class="header-row header-row--badges">
        <div class="badges-row-left">
          <!-- Recipients badge -->
          <button 
            v-if="hasRecipients"
            @click.stop="openAddRecipientsModal" 
            class="recipients-toggle author-toggle"
            title="Add recipients to this message"
          >
            Recipients {{ typeof message.recipients === 'string' ? '' : `(${deduplicatedRecipients.length})` }}
          </button>
          
          <!-- Tags badge -->
          <button 
            @click.stop="openTagsModal"
            class="tags-toggle"
            title="Manage tags for this message"
          >
            Tags ({{ existingTags.length }})
          </button>
          
          <!-- Channels badge -->
          <button 
            @click.stop="openChannelsModal"
            class="channels-toggle"
            title="Manage channels for this message"
          >
            Channels ({{ existingChannels.length }})
          </button>
          
          <!-- Envelope icon for recipients - unread (closed) / read (open) -->
          <button 
            v-if="isUserRecipient"
            @click.stop="toggleReadStatus" 
            class="envelope-icon-button"
            :title="isAutoMarkingAsRead ? 'Auto-marking as read...' : (isMessageUnread ? 'Click to mark as read' : 'Click to mark as unread')"
            :disabled="isTogglingReadStatus || isAutoMarkingAsRead"
            :class="{ 'loading': isTogglingReadStatus || isAutoMarkingAsRead }"
          >
            <span v-if="isTogglingReadStatus || isAutoMarkingAsRead" class="loading-indicator"></span>
            <svg v-else-if="isMessageUnread" class="envelope-icon unread" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <path d="m84.965 16.363h-69.93c-6.5664 0-11.91 5.3438-11.91 11.91v43.453c0 6.5664 5.3438 11.91 11.91 11.91h69.93c6.5664 0 11.91-5.3438 11.91-11.91v-43.453c0-6.5664-5.3438-11.91-11.91-11.91zm5.6602 11.91v43.453c0 0.55078-0.10547 1.0742-0.25 1.5781l-26.02-23.309 26.02-23.305c0.14844 0.50391 0.25391 1.0273 0.25391 1.5781zm-5.6602-5.6602c0.18359 0 0.35547 0.039063 0.53125 0.054688l-28.926 25.91c-3.75 3.3516-9.3984 3.3516-13.148-0.003906l-28.922-25.906c0.17969-0.015625 0.35156-0.054688 0.53125-0.054688zm-75.34 50.691c-0.14844-0.50391-0.25-1.0273-0.25-1.5781v-43.453c0-0.55078 0.10547-1.0742 0.25-1.5781l26.016 23.309-26.016 23.305zm5.4102 4.082c-0.18359 0-0.35547-0.039063-0.53516-0.054688l25.879-23.184c2.8516 2.1289 6.2344 3.1992 9.6211 3.1992s6.7656-1.0703 9.6172-3.1992l25.879 23.184c-0.17969 0.015625-0.35156 0.054688-0.53516 0.054688z"/>
            </svg>
            <svg v-else class="envelope-icon read" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <path d="m91.656 35.066c-0.089844-0.085937-31.234-27.965-31.234-27.965-5.9414-5.3164-14.898-5.3203-20.832-0.003906 0 0-31.391 28.109-31.441 28.164-2.1875 2.1875-3.3906 5.0977-3.3906 8.1914v41.836c0 6.3867 5.1953 11.582 11.582 11.582h67.332c6.3867 0 11.582-5.1953 11.582-11.582v-41.836c0-3.1562-1.3086-6.2109-3.5938-8.3867zm-2.6562 8.3867v41.836c0 0.45703-0.074219 0.89063-0.18359 1.3125l-24.82-22.234 24.82-22.234c0.10938 0.42578 0.18359 0.86328 0.18359 1.3164zm-46.23-30.816 0.98047-0.875c3.5625-3.1914 8.9375-3.1875 12.504 0.003906l28.555 25.574-25.551 22.891c-5.5-4.0586-13.016-4.0586-18.516 0l-25.551-22.891 27.574-24.703zm-31.582 73.969c-0.10938-0.42188-0.18359-0.85938-0.18359-1.3125v-41.836c0-0.45312 0.074219-0.88672 0.18359-1.3164l24.82 22.234zm5.1484 4.0195c-0.082032 0-0.16016-0.019531-0.24219-0.023438l26.676-23.895 0.98047-0.875c3.5625-3.1914 8.9375-3.1875 12.504 0.003907l27.652 24.77c-0.082031 0.003906-0.15625 0.023437-0.24219 0.023437z"/>
            </svg>
          </button>
          
          <!-- Visibility indicator - always shown; toggles only when allowed -->
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

          <!-- Delete button - scope-based capability: msg.write + author only (no admin UI in public SPA) -->
          <button 
            v-if="canDeleteMessage(message) && !isSelectionMode && !inListView" 
            @click.stop="$emit('delete', message)" 
            class="delete-icon-button"
            :title="'Delete this message and all replies'"
          >
            <svg class="delete-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5zm3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0z"/>
            </svg>
          </button>
        </div>
        
        <!-- Right section: collapse button + checkbox -->
        <div v-if="!inListView" class="header-row-right">
          <!-- Top collapse button -->
          <button 
            v-if="canCollapse"
            class="collapse-button collapse-button--top"
            @click.stop="toggleCollapse('top')"
            :aria-label="isCollapsed ? 'Expand message' : 'Collapse message'"
            :title="isCollapsed ? 'Expand' : 'Collapse'"
          >
            <span class="collapse-icon">{{ isCollapsed ? '▼' : '▲' }}</span>
          </button>
          <input 
            v-if="selectable || !inListView"
            type="checkbox"
            :checked="inListView ? selected : isMessageSelected"
            @change="handleSelectionToggle"
            @click.stop
            class="selection-checkbox"
          />
        </div>
      </div>
      
      <!-- Row 3: Add subject (if applicable) -->
      <div v-if="!inListView && !message.subject && !isAddingSubject && canAddSubject" class="header-row header-row--subject">
        <button 
          @click.stop="startAddingSubject"
          class="add-subject-button"
          title="Add subject to this message"
        >
          + Add Subject
        </button>
      </div>
    </div>
      
      <!-- Message body -->
      <div class="message-body">
        <div v-if="message.subject" class="message-subject">{{ message.subject }}</div>
        <div v-if="isAddingSubject" class="add-subject-input-container">
          <input
            ref="subjectInputRef"
            v-model="newSubject"
            @keydown.enter.prevent="saveSubject"
            @keydown.escape="cancelAddingSubject"
            @blur="cancelAddingSubject"
            class="add-subject-input"
            placeholder="Subject (max 72 characters)"
            maxlength="72"
            :class="{ 'subject-input--error': newSubject.length > 72 }"
          />
          <span class="subject-char-count" :class="{ 'subject-char-count--error': newSubject.length > 72 }">
            {{ newSubject.length }}/72
          </span>
          <button @click.stop="saveSubject" class="save-subject-button" :disabled="newSubject.length > 72 || !newSubject.trim()">
            Save
          </button>
          <button @click.stop="cancelAddingSubject" class="cancel-subject-button">
            Cancel
          </button>
        </div>
        <formatted-content 
          v-if="displayMode === 'full'" 
          :content="message.content" 
          :options="formattedContentOptions"
        />
        <div v-else-if="!message.subject" class="plaintext-content">{{ truncatedContent }}</div>
      </div>
      
      <!-- Files -->
      <message-attachments :attachments="message.files" />
      
      <!-- Message footer - hidden in list view -->
      <div v-if="!inListView" class="message-footer">
        <div class="reply-count">{{ message.child_ids?.length || 0 }} 💬</div>
        
        <!-- Right side: collapse button + actions -->
        <div v-if="!isSelectionMode" class="footer-right-actions">
          <!-- Bottom collapse button for desktop -->
          <button 
            v-if="canCollapse"
            class="collapse-button collapse-button--bottom collapse-button--desktop"
            @click.stop="toggleCollapse('bottom')"
            :aria-label="isCollapsed ? 'Expand message' : 'Collapse message'"
            :title="isCollapsed ? 'Expand' : 'Collapse'"
          >
            <span class="collapse-icon">{{ isCollapsed ? '▼' : '▲' }}</span>
          </button>
          
          <!-- Unified message actions - desktop layout -->
          <div class="message-actions desktop-actions">
          <!-- Desktop visible actions -->
          <button 
            v-for="action in desktopVisibleActions"
            :key="action.id"
            @click.stop="action.handler()"
            class="action-button"
            :class="[
              { 
                'active': action.active?.(),
                'disabled': action.disabled?.()
              },
              action.customClass?.()
            ]"
            :disabled="action.disabled?.()"
            :title="action.text"
          >
            <span v-if="action.loading?.()" class="loading-indicator"></span>
            <span v-else class="action-emoji">{{ action.emoji }}</span>
            <span class="action-text">{{ action.text }}</span>
          </button>
          
          <!-- Menu button for desktop with relative positioning for menu -->
          <div v-if="shouldShowMenuButton" ref="desktopMenuContainerRef" class="desktop-menu-container">
            <button 
              @click.stop="toggleActionBar"
              class="action-button menu-button"
              :class="{ 'active': showActionBar }"
              title="More actions"
            >
              <span class="action-emoji">⋯</span>
            </button>
            
            <!-- Desktop dropdown menu -->
            <div 
              v-if="showActionBar && !isMobile"
              ref="desktopActionMenuRef"
              class="desktop-action-menu"
              :class="{ 'menu-below': menuPositionBelow }"
              @click.stop
            >
              <button 
                v-for="action in menuActions"
                :key="action.id"
                @click.stop="action.handler()"
                class="desktop-menu-button"
                :class="[
                  { 'active': action.active?.() },
                  action.customClass?.()
                ]"
                :title="action.text"
                :disabled="action.disabled?.()"
              >
                <span v-if="action.loading?.()" class="loading-indicator"></span>
                <span v-else class="action-emoji">{{ action.emoji }}</span>
                <span class="action-text">{{ action.text }}</span>
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
      
      <!-- Tags Modal (teleported to body to avoid local stacking/highlight issues) -->
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
      
      <!-- Reply Order Modal -->
      <teleport to="body">
        <ReplyOrderModal
          :is-visible="showReplyOrderModal"
          :message-id="message?.id"
          :child-ids="message?.child_ids || []"
          :existing-reply-order="message?.reply_order || []"
          @close="closeReplyOrderModal"
          @update="handleReplyOrderUpdate"
        />
      </teleport>
      
      <!-- Unified mobile action controls -->
      <div v-if="!inListView && !isSelectionMode" ref="mobileActionControlsRef" class="mobile-action-controls">
        
        <!-- Bottom collapse button for mobile -->
        <button 
          v-if="canCollapse"
          class="collapse-button collapse-button--bottom collapse-button--mobile"
          @click.stop="toggleCollapse('bottom')"
          :aria-label="isCollapsed ? 'Expand message' : 'Collapse message'"
          :title="isCollapsed ? 'Expand' : 'Collapse'"
        >
          <span class="collapse-icon">{{ isCollapsed ? '▼' : '▲' }}</span>
        </button>
        
        <!-- Mobile visible actions -->
        <button 
          v-for="action in mobileVisibleActions"
          :key="action.id"
          @click.stop="action.handler()"
          class="mobile-action-button"
          :class="[
            { 
              'active': action.active?.(),
              'disabled': action.disabled?.()
            },
            action.customClass?.()
          ]"
          :disabled="action.disabled?.()"
          :title="action.text"
        >
          <span v-if="action.loading?.()" class="loading-indicator"></span>
          <span v-else class="action-emoji">{{ action.emoji }}</span>
          <span class="action-text">{{ action.text }}</span>
        </button>
        
        <!-- Menu button for mobile -->
        <button 
          v-if="shouldShowMenuButton"
          @click.stop="toggleActionBar"
          class="mobile-action-button menu-button"
          :class="{ 'active': showActionBar }"
          title="More actions"
        >
          <span class="action-emoji">⋯</span>
        </button>
        
        <!-- Unified floating action menu -->
        <div 
          v-if="shouldShowMenuButton"
          ref="floatingActionBarRef"
          class="floating-action-bar" 
          :class="{ 'active': showActionBar, 'position-below': mobileMenuPositionBelow }"
          @click.stop
          @touchstart.stop="handleActionBarTouchStart"
          @touchmove.stop="handleActionBarTouchMove"
          @touchend.stop="handleActionBarTouchEnd"
        >
          <button 
            v-for="action in menuActions"
            :key="action.id"
            @click.stop="action.handler()"
            class="fab-button"
            :class="[
              { 'active': action.active?.() },
              action.customClass?.()
            ]"
            :title="action.text"
            :disabled="action.disabled?.()"
          >
            <span class="action-emoji">{{ action.emoji }}</span>
            <span class="action-text">{{ action.text }}</span>
          </button>
        </div>
       </div>
     </div>
   </div>

</template>

<script>
import AdaptiveMarker from './AdaptiveMarker.vue';
import SiblingNavigator from './SiblingNavigator.vue';
import FormattedContent from './FormattedContent/index.vue';
import { initFormatters } from './FormattedContent/init';
import TagsModal from './modals/TagsModal.vue';
import ChannelsModal from './modals/ChannelsModal.vue';
import ReplyOrderModal from './modals/ReplyOrderModal.vue';
import MessageAttachments from './MessageAttachments.vue';
import UserDisplay from './common/UserDisplay.vue';
import ChannelsService from '../services/ChannelsService.js';
import { computed, ref, onMounted, onBeforeUnmount, nextTick, watch, toRef } from 'vue';
import { useStore } from 'vuex';
import { useRoute } from 'vue-router';
import { memoize } from 'lodash-es';
import MessageService from '../services/MessageService.js';
import UserService from '../services/UserService.js';
import { dismissMobileKeyboard } from '../utils/mobileKeyboard.js';

export default {
  name: 'MessageNode',
  
  components: {
    AdaptiveMarker,
    SiblingNavigator,
    FormattedContent,
    TagsModal,
    ChannelsModal,
    ReplyOrderModal,
    MessageAttachments,
    UserDisplay
  },
  
  props: {
    message: {
      type: Object,
      required: true
    },
    // Display format - preview (truncated) or full content
    displayMode: {
      type: String,
      default: 'full',
      validator: value => ['preview', 'full'].includes(value)
    },
    // Interaction mode - if true, clicking selects instead of navigating
    selectable: {
      type: Boolean,
      default: false
    },
    // Current selection state (when selectable=true)
    selected: {
      type: Boolean,
      default: false
    },
    // Visual sizing - affects font size and spacing
    compact: {
      type: Boolean,
      default: false
    },
    inListView: {
      type: Boolean,
      default: false
    },
    // Current tab context for conditional rendering
    currentTab: {
      type: String,
      default: null
    }
  },
  
  setup(props, { emit }) {
    const store = useStore();
    const route = useRoute();
    const currentUser = computed(() => store.getters['auth/user']);
    const isAdmin = computed(() => store.getters['auth/isAdmin']);
    const canDeleteMessage = (message) => store.getters['auth/canDeleteMessage'](message);
    
    // Removed read-out-loud audio playback feature
    const isPlaying = computed(() => false);
    const isLoading = computed(() => false);


    // Selection mode state
    const isSelectionMode = computed(() => store.getters['navigation/isSelectionMode']);
    const isMessageSelected = computed(() => store.getters['navigation/isMessageSelected'](props.message.id));
    
    // For regular users, just use token info
    const isTogglingReadStatus = ref(false);
    
    // Check if message is being auto-marked as read (from store)
    const isAutoMarkingAsRead = computed(() => {
      return store.getters['messages/isMessageMarkingAsRead'](props.message.id);
    });
    
    // Add refs for copy button states
    const isJsonCopied = ref(false);
    const isTextCopied = ref(false);
    const isLinkCopied = ref(false);
    
    // Add refs for save button state
    const isMessageSaved = ref(false);
    const isSavingMessage = ref(false);

    // Import status
    const isImported = computed(() => !!props.message.import_info);
    
    // Subject addition state
    const isAddingSubject = ref(false);
    const newSubject = ref('');
    const subjectInputRef = ref(null);
    const isSavingSubject = ref(false);
    
    // Check if user can add subject - only message author can add subject
    const canAddSubject = computed(() => {
      return currentUser.value && isUserAuthor.value && store.getters['auth/canInteract'];
    });
    
    // Mobile floating action bar state - using global store
    const actionBarTouchStartY = ref(0);
    const actionBarTouchMoveY = ref(0);
    
    // Desktop menu positioning refs
    const desktopMenuContainerRef = ref(null);
    const desktopActionMenuRef = ref(null);
    const menuPositionBelow = ref(false);
    let menuPositionRecalcHandler = null;
    
    // Mobile floating action bar positioning refs
    const mobileActionControlsRef = ref(null);
    const floatingActionBarRef = ref(null);
    const mobileMenuPositionBelow = ref(false);
    
    // Global action bar state from store
    const showActionBar = computed(() => store.getters['navigation/isActionBarOpen'](props.message.id));
    
    // Whether this message is currently the centered one in the URL
    const isCentered = computed(() => String(route.params.id) === String(props.message.id));

    const navAnimationClass = ref('');
    const navAnimationTimeout = ref(null);

    const lastSiblingNavigation = computed(
      () => store.state?.navigation?.lastSiblingNavigation ?? null
    );

    watch(
      lastSiblingNavigation,
      (lastNav) => {
        if (!lastNav || lastNav.targetId !== props.message.id) return;

        const ageMs = Date.now() - (lastNav.timestamp || 0);
        if (ageMs > 1500) return;

        navAnimationClass.value =
          lastNav.direction === 'prev' ? 'animate-nav-prev' : 'animate-nav-next';

        if (navAnimationTimeout.value) clearTimeout(navAnimationTimeout.value);
        navAnimationTimeout.value = setTimeout(() => {
          navAnimationClass.value = '';
          navAnimationTimeout.value = null;
        }, 360);
      },
      { immediate: true }
    );

    const refreshReplies = () => {
      emit('refreshReplies', props.message.id);
    };
    
    // Define unified message actions with standardized attributes
    const messageActions = computed(() => [
      {
        id: 'reply',
        emoji: '↩️',
        text: 'Reply',
        desktopVisible: true,
        mobileVisible: true,
        adminOnly: false,
        handler: () => emit('reply', props.message.id),
        condition: () => !props.inListView,
        disabled: () => !currentUser.value
      },
      {
        id: 'prompt',
        emoji: '🤖',
        text: 'Prompt',
        desktopVisible: true,
        mobileVisible: true,
        adminOnly: false,
        handler: openPromptModal,
        condition: () => !props.inListView,
        disabled: () => !currentUser.value
      },
      {
        id: 'save',
        emoji: '🔖',
        text: isMessageSaved.value ? 'Saved' : 'Save',
        desktopVisible: true,
        mobileVisible: true,
        adminOnly: false,
        handler: toggleSaveMessage,
        condition: () => !props.inListView,
        disabled: () => isSavingMessage.value || !currentUser.value,
        loading: () => isSavingMessage.value,
        active: () => isMessageSaved.value,
        customClass: () => isMessageSaved.value ? 'save-active' : ''
      },
      {
        id: 'copy-text',
        emoji: '📝',
        text: isTextCopied.value ? 'Copied!' : 'Copy',
        desktopVisible: false,
        mobileVisible: false,
        adminOnly: false,
        handler: copyMessageText,
        condition: () => !props.inListView,
        active: () => isTextCopied.value
      },
      
      {
        id: 'copy-link',
        emoji: isLinkCopied.value ? '✅' : '📋',
        text: isLinkCopied.value ? 'Copied' : 'Copy link',
        desktopVisible: false,
        mobileVisible: false,
        adminOnly: false,
        handler: copyMessageLink,
        condition: () => !props.inListView,
        active: () => isLinkCopied.value
      },
      {
        id: 'refresh-replies',
        emoji: '🔄',
        text: 'Refresh replies',
        desktopVisible: false,
        mobileVisible: false,
        adminOnly: false,
        handler: refreshReplies,
        condition: () => !props.inListView
      },
      {
        id: 'links',
        emoji: '🔗',
        text: 'Links',
        desktopVisible: false,
        mobileVisible: false,
        adminOnly: false,
        handler: openLinksModal,
        condition: () => !props.inListView
      },
      {
        id: 'copy-json',
        emoji: '📋',
        text: isJsonCopied.value ? 'Copied!' : 'JSON',
        desktopVisible: false,
        mobileVisible: false,
        adminOnly: true,
        handler: copyMessageJson,
        condition: () => !props.inListView,
        active: () => isJsonCopied.value
      }
      
      ,
      {
        id: 'center',
        emoji: '🎯',
        text: isCentered.value ? 'Centered' : 'Center',
        desktopVisible: false,
        mobileVisible: false,
        adminOnly: false,
        handler: () => { if (!isCentered.value) emit('center', props.message.id); },
        condition: () => !props.inListView,
        disabled: () => isCentered.value,
        active: () => isCentered.value
      },
      {
        id: 'reply-order',
        emoji: '📋',
        text: 'Order',
        desktopVisible: false,
        mobileVisible: false,
        adminOnly: false,
        handler: openReplyOrderModal,
        condition: () => {
          // Only show if user can update reply order and message has replies
          return !props.inListView && 
                 store.getters['auth/canUpdateReplyOrder'](props.message) && 
                 props.message.child_ids && 
                 props.message.child_ids.length > 0;
        }
      }
    ]);
    
    // Get visible actions for desktop
    const desktopVisibleActions = computed(() => 
      messageActions.value.filter(action => 
        action.desktopVisible && 
        (!action.adminOnly || isAdmin.value) &&
        (!action.condition || action.condition())
      )
    );
    
    // Get visible actions for mobile
    const mobileVisibleActions = computed(() => 
      messageActions.value.filter(action => 
        action.mobileVisible && 
        (!action.adminOnly || isAdmin.value) &&
        (!action.condition || action.condition())
      )
    );
    
    // Get menu actions (not visible on desktop/mobile)
    const menuActions = computed(() => 
      messageActions.value.filter(action => 
        !action.desktopVisible && 
        !action.mobileVisible &&
        (!action.adminOnly || isAdmin.value) &&
        (!action.condition || action.condition())
      )
    );
    
    // Check if we need to show menu button
    const shouldShowMenuButton = computed(() => 
      menuActions.value.length > 0 && !props.inListView && !isSelectionMode.value
    );
    
    // Message click handler - only handles navigation in preview mode
    const handleMessageClick = () => {
      if (props.displayMode === 'preview' && !props.selectable) {
        // Preview mode without selection - emit navigation
        emit('navigate', props.message.id);
      }
      // Full mode or selection mode - do nothing (selection only via checkbox)
    };
    
    // Handle checkbox selection changes
    const handleSelectionToggle = (event) => {
      if (props.inListView) {
        // In list view, use the existing prop-based system
        emit('selectionToggled', props.message.id);
      } else {
        // In thread view, use the store-based selection system
        store.dispatch('navigation/toggleMessageSelection', props.message.id);
      }
    };
    
    // Initialize save state from message data
    const initializeSaveState = () => {
      // Set initial state based on message.is_saved
      isMessageSaved.value = props.message.is_saved === true;
    };
    
    // Watch for changes in message prop to update save state
    watch(() => props.message.is_saved, (newValue) => {
      isMessageSaved.value = newValue === true;
    }, { immediate: true });
    
    const messageContentRef = ref(null);
    const messageNodeRef = ref(null);
    const isMobile = ref(false);
    
    // Collapse state
    const isCollapsed = ref(false);
    const canCollapse = computed(() => {
      // Enable collapse for messages with content longer than a threshold
      const contentLength = props.message?.content?.length || 0;
      return contentLength > 200 || (props.message?.content?.includes('\n'));
    });
    
    // Toggle collapse with scroll-follow animation
    const toggleCollapse = async (position) => {
      const nodeEl = messageNodeRef.value;
      if (!nodeEl) return;
      
      // Get the current position of the collapse button relative to viewport
      const buttonSelector = position === 'top' ? '.collapse-button--top' : '.collapse-button--bottom';
      const buttonEl = nodeEl.querySelector(buttonSelector);
      const buttonRect = buttonEl?.getBoundingClientRect();
      const buttonViewportY = buttonRect ? buttonRect.top + buttonRect.height / 2 : null;
      
      // Toggle collapse state
      isCollapsed.value = !isCollapsed.value;
      
      // Wait for DOM to update
      await nextTick();
      
      // After animation, adjust scroll to keep the button at same viewport position
      if (buttonViewportY !== null && buttonEl) {
        requestAnimationFrame(() => {
          const newButtonRect = buttonEl.getBoundingClientRect();
          const newButtonViewportY = newButtonRect.top + newButtonRect.height / 2;
          const scrollDelta = newButtonViewportY - buttonViewportY;
          
          if (Math.abs(scrollDelta) > 1) {
            window.scrollBy({
              top: scrollDelta,
              behavior: 'smooth'
            });
          }
        });
      }
    };
    
    const openLinksModal = () => {
      // Close the ReplyBox if it's open
      store.dispatch('navigation/clearReplyingTo');
      
      // Emit event to parent to handle the modal
      emit('showLinks', props.message);
    };
    
    const openAddRecipientsModal = () => {
      dismissMobileKeyboard();

      const existingRecipients = props.message.recipients && Array.isArray(props.message.recipients) 
        ? props.message.recipients 
        : [];

      // Show the global recipients modal
      const modalConfig = {
        isPublic: false, // Adding recipients is always for private messages
        isAddMode: true,
        existingRecipients: existingRecipients,
        messageId: props.message.id
      };
       
      try {
        store.dispatch('navigation/showRecipientsModal', modalConfig);
      } catch (error) {
        console.error('[MessageNode] Error dispatching showRecipientsModal:', error);
      }
    };
    
    const startAddingSubject = () => {
      isAddingSubject.value = true;
      newSubject.value = '';
      nextTick(() => {
        if (subjectInputRef.value) {
          subjectInputRef.value.focus();
        }
      });
    };
    
    const cancelAddingSubject = () => {
      isAddingSubject.value = false;
      newSubject.value = '';
    };
    
    const saveSubject = async () => {
      const subject = newSubject.value.trim();
      if (!subject || subject.length > 72) {
        return;
      }
      
      if (isSavingSubject.value) return;
      
      try {
        isSavingSubject.value = true;
        const response = await MessageService.addSubject(props.message.id, subject);
        
        // Update the message in the store
        if (response.data) {
          store.commit('messages/SET_MESSAGE', response.data);
        }
        
        isAddingSubject.value = false;
        newSubject.value = '';
      } catch (error) {
        console.error('[MessageNode] Error adding subject:', error);
        const errorMessage = error.response?.data?.detail || error.message || 'Failed to add subject';
        store.commit('ui/SET_ERROR', errorMessage);
      } finally {
        isSavingSubject.value = false;
      }
    };
    
    const isPublic = computed(() => {
      const publicValue = props.message.public;
      const result = publicValue === 1 || publicValue === true;
      return result;
    });
    
    // Whether the globe can toggle visibility (always visible; only interactive when true)
    const canToggleVisibility = computed(() => {
      if (!currentUser.value) return false;
      return store.getters['auth/canUpdateMessagePublicity'](props.message);
    });
    
    // Insert openPromptModal here
    const openPromptModal = () => {
      store.dispatch('navigation/clearReplyingTo');
      dismissMobileKeyboard();
      store.dispatch('navigation/showSpeedDialModal', { messageId: props.message.id });
    };
    
    const isUserRecipient = computed(() => {
      if (!currentUser.value) return false;
      
      // Check if recipients array exists
      if (!props.message.recipients) return false;
      
      // If recipients is a string message, this user doesn't have access
      if (typeof props.message.recipients === 'string') return false;
      
      // Check if the current user is in the recipients list
      return props.message.recipients.some(recipient => {
        // Check by UID first (most reliable)
        if (recipient.uid === currentUser.value.uid) {
          return true;
        }
        
        // Fallback check by user_tag
        if (recipient.user_tag && currentUser.value.user_tag && 
            recipient.user_tag === currentUser.value.user_tag) {
          return true;
        }
        
        return false;
      });
    });
    
    // Check if message is unread (treating null and false as unread)
    const isMessageUnread = computed(() => {
      return store.getters['messages/isMessageUnread'](props.message.id);
    });
    
    // Get recipients excluding the current user
    const recipientsExcludingUser = computed(() => {
      if (!currentUser.value || !props.message.recipients) {
        return [];
      }
      
      // If recipients is a string message, return empty array
      if (typeof props.message.recipients === 'string') {
        return [];
      }
      
      return props.message.recipients.filter(recipient => {
        // First check by UID
        if (recipient.uid && currentUser.value.uid && 
            recipient.uid === currentUser.value.uid) {
          return false;
        }
        
        // Then check by user_tag
        if (recipient.user_tag && currentUser.value.user_tag && 
            recipient.user_tag === currentUser.value.user_tag) {
          return false;
        }
        
        return true;
      });
    });
    
    // Get author display name
    const authorDisplayName = computed(() => {
      if (props.message.author?.display_name) return props.message.author.display_name;
      return props.message.author_display_name || '';
    });

    // Get author user tag
    const authorUserTag = computed(() => {
      if (props.message.author?.user_tag) return props.message.author.user_tag;
      return props.message.author_user_tag || null;
    });
    
    // Get author UID
    const authorUid = computed(() => {
      if (props.message.author?.uid) return props.message.author.uid;
      return props.message.content_author || null;
    });
    
    // Get bot status
    const isBot = computed(() => {
      return !!props.message.author?.is_bot;
    });

    const authorBotVersionId = computed(() => {
      return props.message.author?.bot_version_id || null;
    });

    const authorAvailableVersions = computed(() => {
      return props.message.author?.available_versions || null;
    });

    const botVersionTooltip = computed(() => {
      if (!isBot.value) return '';

      // If the sender-edge field isn't present, we should not guess.
      if (!authorBotVersionId.value) return 'No version available';

      const versions = Array.isArray(authorAvailableVersions.value)
        ? authorAvailableVersions.value
        : [];
      const mv = authorBotVersionId.value;
      if (mv && versions.length) {
        const match = versions.find(v => v && v.id === mv);
        if (match?.label) return `Bot version: ${match.label}`;
      }

      const def = versions.find(v => v && v.default === true);
      if (def?.label) return `Bot version: ${def.label}`;
      return `Bot version: ${mv}`;
    });

    // Show participants label only for inbox list previews
    const showParticipantsLabel = computed(() => {
      return props.inListView === true && props.currentTab === 'inbox';
    });

    // Build a deduped list of participant display names (author + recipients)
    const participantItems = computed(() => {
      if (!showParticipantsLabel.value) return [];

      const items = [];
      const seen = new Set();
      const addParticipant = ({ displayName, userTag = null, isBot = false }) => {
        const keySource = displayName || userTag || '';
        const key = String(keySource).trim().toLowerCase();
        if (!key) return;
        if (seen.has(key)) return;
        seen.add(key);
        items.push({
          key: `${key}-${items.length}`,
          displayName: displayName || userTag || 'Unknown',
          userTag,
          isBot: !!isBot
        });
      };

      const authorName = authorDisplayName.value || '';
      if (authorName || authorUserTag.value) {
        addParticipant({
          displayName: authorName || authorUserTag.value || '',
          userTag: authorUserTag.value,
          isBot: isBot.value
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
    
    // Check if the current user is the author of the message
    const isUserAuthor = computed(() => {
      if (!currentUser.value) {
        return false;
      }
      
      // Check the UID using robust accessor
      if (currentUser.value.uid && authorUid.value && 
          currentUser.value.uid === authorUid.value) {
        return true;
      }
      
      return false;
    });
    
    // Utility function to check if a recipient is the author
    const isUserAuthorOfContent = (recipient) => {
      if (!props.message || !recipient) return false;
      
      // The message author UID should match the recipient UID
      if (props.message.content_author && recipient.uid && 
          props.message.content_author === recipient.uid) {
        return true;
      }
      
      // Or the message author user_tag should match the recipient user_tag
      if (props.message.author_user_tag && recipient.user_tag && 
          props.message.author_user_tag === recipient.user_tag) {
        return true;
      }
      
      return false;
    };
    
    const isEndOfBranch = computed(() => {
      return store.getters['messages/isEndOfBranch'](props.message.id);
    });
    
    const isLoadingSiblings = computed(() => {
      // Check if parent exists
      if (!props.message.parent_id) return false;
      
      const parentMessage = store.getters['messages/getMessage'](props.message.parent_id);
      
      // If parent doesn't exist in the store, show loading
      if (!parentMessage) return true;
      
      // Check if parent is loading its children
      return store.getters['messages/isLoading'](props.message.parent_id, 'children');
    });
    
    // Helper function to deduplicate recipients (same logic as RecipientsModal)
    const deduplicateRecipients = (recipientEdges) => {
      if (!recipientEdges || !Array.isArray(recipientEdges)) return [];
      
      // Group recipients by UID
      const recipientGroups = {};
      recipientEdges.forEach(edge => {
        if (!recipientGroups[edge.uid]) {
          recipientGroups[edge.uid] = [];
        }
        recipientGroups[edge.uid].push(edge);
      });
      
      // Return one entry per unique recipient UID
      return Object.keys(recipientGroups).map(uid => recipientGroups[uid][0]);
    };
    
    const deduplicatedRecipients = computed(() => {
      if (typeof props.message.recipients === 'string') {
        return []; // Can't deduplicate string message
      }
      return deduplicateRecipients(props.message.recipients || []);
    });
    
    const hasRecipients = computed(() => {
      // Always show the recipients badge
      return true;
    });
    
    // Tags support
    const showTagsModal = ref(false);
    const existingTags = computed(() => {
      const tags = props.message && Array.isArray(props.message.tags) ? props.message.tags : [];
      // Deduplicate by tag name (normalized) while preserving tag objects with metadata
      const seen = new Set();
      const deduplicated = [];
      for (const tag of tags) {
        if (!tag) continue;
        // Get normalized tag name for deduplication
        const tagName = typeof tag === 'string' ? tag.toLowerCase() : (tag.name || '').toLowerCase();
        if (tagName && !seen.has(tagName)) {
          seen.add(tagName);
          deduplicated.push(tag);
        }
      }
      return deduplicated;
    });
    const openTagsModal = () => {
      // Do NOT clear replying/close reply UI; just open the modal
      dismissMobileKeyboard();
      showTagsModal.value = true;
    };
    const closeTagsModal = () => { showTagsModal.value = false; };
    
    const handleTagsUpdate = async ({ messageId, tags }) => {
      try {
        if (!messageId) return;
        const tagArray = Array.isArray(tags) ? tags : [];
        await store.dispatch('messages/updateMessageTags', { id: messageId, tags: tagArray });
      } catch (e) {
        console.error('[MessageNode] Failed to update tags', e);
        store.commit('ui/SET_ERROR', 'Failed to update tags');
      }
    };
    
    const handleTagsDone = async (newTags) => {
      // In the new flow, updates happen immediately on Add/Remove
      // Done just closes the modal
      closeTagsModal();
    };

    // Channels support
    const showChannelsModal = ref(false);
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
      const msg = props.message;
      if (!msg) return false;
      return Array.isArray(msg.channels) && msg.channels.length > 0;
    });
    const openChannelsModal = () => {
      // Do NOT clear replying/close reply UI; just open the modal
      dismissMobileKeyboard();
      showChannelsModal.value = true;
    };
    const closeChannelsModal = () => { showChannelsModal.value = false; };
    
    const handleChannelsUpdate = async ({ messageId, channel_ids }) => {
      try {
        if (!messageId) return;
        const channelIdsArray = Array.isArray(channel_ids) ? channel_ids : [];
        console.log('[MessageNode] handleChannelsUpdate called', { messageId, channel_ids: channelIdsArray });
        
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
        
        console.log('[MessageNode] Updated channels:', { messageId, channel_ids: channelIdsArray });
        // Don't close modal - let user continue selecting channels
        // Modal will close when user clicks Done or clicks outside
      } catch (e) {
        console.error('[MessageNode] Failed to update channels', e);
        let errorMessage = 'Failed to update channels';
        if (e.response && e.response.data && e.response.data.detail) {
          errorMessage = e.response.data.detail;
        } else if (e.message) {
          errorMessage = e.message;
        }
        store.commit('ui/SET_ERROR', errorMessage);
      }
    };
    
    const handleChannelsDone = async (channelIds) => {
      // In the new flow, updates happen immediately on Add/Remove
      // Done just closes the modal
      closeChannelsModal();
    };

    // Reply order support
    const showReplyOrderModal = ref(false);
    const openReplyOrderModal = () => {
      dismissMobileKeyboard();
      showReplyOrderModal.value = true;
    };
    const closeReplyOrderModal = () => { showReplyOrderModal.value = false; };
    
    const handleReplyOrderUpdate = async ({ messageId, replyOrder }) => {
      try {
        if (!messageId) return;
        const response = await MessageService.updateReplyOrder(messageId, replyOrder);
        // Update the message in store with the response
        if (response?.data?.id) {
          const updated = response.data;
          // Preserve relations if backend returns minimal doc
          const existing = store.getters['messages/getMessage'](messageId) || {};
          if (updated.parent_id === undefined) updated.parent_id = existing.parent_id;
          if (!Array.isArray(updated.child_ids)) updated.child_ids = existing.child_ids || [];
          store.commit('messages/SET_MESSAGE', updated);
        }
        closeReplyOrderModal();
      } catch (e) {
        console.error('[MessageNode] Failed to update reply order', e);
        store.commit('ui/SET_ERROR', 'Failed to update reply order');
      }
    };

    
    
    // New method to handle swipe navigation
    const handleSiblingNavigation = ({ direction, targetSiblingId, parentId }) => {
      // Don't navigate if in selection mode
      if (isSelectionMode.value) {
        return;
      }
      
      // No longer automatically select the new target sibling
      // Selection will be handled by the navigateToSibling action
      // based on whether the previous sibling was selected
    };
    
    // Check if this message has siblings that can be navigated to
    const hasSiblings = computed(() => {
      if (!props.message.parent_id) {
        return false;
      }
      
      const parent = store.getters['messages/getMessage'](props.message.parent_id);
      if (!parent || !parent.child_ids || !Array.isArray(parent.child_ids)) {
        return false;
      }
      
      // Use getChildIds to respect reply_order
      const orderedChildIds = store.getters['messages/getChildIds'](props.message.parent_id);
      return orderedChildIds.length > 1;
    });

    // Reserve layout space for sibling navigation buttons.
    // Only nodes that have a parent in the thread graph should reserve space.
    // Root nodes (no parent_id) stay full width.
    const shouldReserveSiblingNavSpace = computed(() => {
      return !!props.message?.parent_id;
    });


    
    const isCurrentUser = computed(() => {
      if (!currentUser.value) return false;
      
      // Check if the author is the current user
      // First try to match by user tag
      if (authorUserTag.value && currentUser.value.user_tag === authorUserTag.value) {
        return true;
      }
      
      // Then check content_author for UID matching
      if (authorUid.value === currentUser.value.uid) {
        return true;
      }
      
      return false;
    });
    
    // Add new helper method to check if current user is a recipient
    const isCurrentUserRecipient = (recipient) => {
      if (!currentUser.value || !recipient) return false;
      
      // Check by UID
      if (recipient.uid && currentUser.value.uid && 
          recipient.uid === currentUser.value.uid) {
        return true;
      }
      
      // Check by user_tag
      if (recipient.user_tag && currentUser.value.user_tag && 
          recipient.user_tag === currentUser.value.user_tag) {
        return true;
      }
      
      return false;
    };
    
    const toggleReadStatus = async () => {
      if (isTogglingReadStatus.value) return;
      
      isTogglingReadStatus.value = true;
      try {
        // Explicitly call mark as read or mark as unread based on current state
        if (isMessageUnread.value) {
          // Message is unread, mark it as read
          await store.dispatch('messages/markMessageAsRead', props.message.id);
        } else {
          // Message is read, mark it as unread
          await store.dispatch('messages/markMessageAsUnread', props.message.id);
        }
      } catch (error) {
        console.error('Error toggling read status:', error);
      } finally {
        isTogglingReadStatus.value = false;
      }
    };
    
    // Add method to copy JSON to clipboard
    const copyMessageJson = () => {
      try {
        // Get the full message object from the store
        const messageJson = JSON.stringify(props.message, null, 2);
        navigator.clipboard.writeText(messageJson)
          .then(() => {
            // Show flash effect
            isJsonCopied.value = true;
            setTimeout(() => {
              isJsonCopied.value = false;
            }, 1500);
          })
          .catch(err => {
            console.error('Failed to copy JSON: ', err);
          });
      } catch (error) {
        console.error('Error copying message JSON:', error);
      }
    };
    
    // Add method to copy formatted text to clipboard
    const copyMessageText = () => {
      try {
        // Combine header with the message content
        const fullText = `${props.message.content || ''}`;
        
        navigator.clipboard.writeText(fullText)
          .then(() => {
            // Show flash effect
            isTextCopied.value = true;
            setTimeout(() => {
              isTextCopied.value = false;
            }, 1500);
          })
          .catch(err => {
            console.error('Failed to copy text: ', err);
          });
      } catch (error) {
        console.error('Error copying message text:', error);
      }
    };
    
    // Copy public message link (hide numeric id in UI)
    const copyMessageLink = () => {
      try {
        const link = `stitch.fyi/messages/${props.message.id}`;
        navigator.clipboard.writeText(link)
          .then(() => {
            isLinkCopied.value = true;
            setTimeout(() => {
              isLinkCopied.value = false;
            }, 1000);
          })
          .catch(err => {
            console.error('Failed to copy link: ', err);
          });
      } catch (error) {
        console.error('Error copying message link:', error);
      }
    };
    

    
    // Function to strip basic markdown formatting
    const stripMarkdown = (text) => {
      if (!text) return '';
      
      return text
        // Remove headers (# ## ###)
        .replace(/^#{1,6}\s+/gm, '')
        // Remove bold/italic (**text** __text__ *text* _text_)
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/(\*|_)(.*?)\1/g, '$2')
        // Remove strikethrough (~~text~~)
        .replace(/~~(.*?)~~/g, '$1')
        // Remove inline code (`text`)
        .replace(/`([^`]+)`/g, '$1')
        // Remove code blocks (```text```)
        .replace(/```[\s\S]*?```/g, '[code block]')
        // Remove links [text](url)
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Remove images ![alt](url)
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        // Remove blockquotes (> text)
        .replace(/^>\s+/gm, '')
        // Remove horizontal rules (--- or ***)
        .replace(/^(---|\*\*\*)\s*$/gm, '')
        // Remove list markers (- * + 1.)
        .replace(/^[\s]*[-*+]\s+/gm, '')
        .replace(/^[\s]*\d+\.\s+/gm, '')
        // Clean up extra whitespace
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const truncatedContent = computed(() => {
      if (!props.message.content) return '';
      
      // Memoize the truncation logic based on the content
      return memoize((content) => {
        let processedContent = content;
        
        // Strip markdown formatting in preview mode
        if (props.displayMode === 'preview') {
          processedContent = stripMarkdown(content);
        }
        
        // For preview mode, return the full processed content
        // Visual truncation is handled by CSS line-clamp
        return processedContent;
      })(props.message.content);
    });

    const renderTagSet = computed(() => {
      const tags = props.message?.tags;
      if (!Array.isArray(tags)) return new Set();
      const set = new Set();
      tags.forEach(tag => {
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
      recipients.forEach(recipient => {
        const tag = (typeof recipient === 'object' ? recipient?.user_tag : recipient) || '';
        if (typeof tag === 'string' && tag.trim()) {
          set.add(tag.toLowerCase());
        }
      });
      return set;
    });

    const formattedContentOptions = computed(() => ({
      validTags: renderTagSet.value,
      validMentions: renderMentionSet.value,
      debugMermaid: true
    }));
    
    // const handleReformat = async () => {
    //   if (isReformatting.value) return;
    //   
    //   isReformatting.value = true;
    //   try {
    //     await store.dispatch('messages/reformatMessage', props.message.id);
    //   } catch (error) {
    //     console.error('Error reformatting message:', error);
    //   } finally {
    //     isReformatting.value = false;
    //   }
    // };
    
    const toggleSaveMessage = async () => {
      if (isSavingMessage.value) return;
      
      isSavingMessage.value = true;
      try {
        if (isMessageSaved.value) {
          await UserService.unsaveMessage(props.message.id);
          isMessageSaved.value = false;
        } else {
          await UserService.saveMessage(props.message.id);
          isMessageSaved.value = true;
        }
      } catch (error) {
        console.error('Error toggling save status:', error);
      } finally {
        isSavingMessage.value = false;
      }
    };

    const toggleVisibility = async () => {
      try {
        const target = !isPublic.value;
        try {
          console.log('[MessageNode] toggleVisibility dispatch', {
            messageId: props.message.id,
            fromPublic: isPublic.value,
            toPublic: target
          });
        } catch (e) {}
        const ok = await store.dispatch('messages/togglePublicMessage', { messageId: props.message.id, makePublic: target });
        if (!ok) {
          console.warn('[MessageNode] Failed to toggle visibility');
        }
        try {
          console.log('[MessageNode] toggleVisibility result', {
            messageId: props.message.id,
            nowPublic: isPublic.value,
            ok
          });
        } catch (e) {}
      } catch (e) {
        console.error('[MessageNode] toggleVisibility error:', e);
      }
    };
    
    // Check if device is mobile
    const checkMobileDevice = () => {
      const nextIsMobile = window.innerWidth <= 768;
      isMobile.value = nextIsMobile;
    };
    
    // Handle viewport changes for keyboard detection
    const handleViewportChange = () => {
      if (!isMobile.value) return;
      
      // If action bar is open and viewport height decreased significantly, 
      // it's likely the keyboard opened - hide the action bar
      const currentHeight = window.innerHeight;
      const expectedHeight = window.screen.height;
      const heightDifference = expectedHeight - currentHeight;
      
      // If height difference is more than 150px, likely keyboard is open
      if (heightDifference > 150 && showActionBar.value) {
        hideActionBar();
      }
    };
    
    // Mobile floating action bar methods
    const toggleActionBar = () => {
      // Use the global store action to toggle this message's action bar
      store.dispatch('navigation/toggleActionBar', props.message.id);
    };
    
    const hideActionBar = () => {
      // Use the global store action to hide this message's action bar
      store.dispatch('navigation/hideActionBar', props.message.id);
    };
    
    // Calculate mobile floating action bar position to prevent overflow
    const calculateMobileMenuPosition = () => {
      if (!isMobile.value || !showActionBar.value || !mobileActionControlsRef.value) {
        mobileMenuPositionBelow.value = false;
        return;
      }
      
      const updatePosition = () => {
        try {
          // Measure the container (button area) position, not the floating bar
          // This way we get the stable position before CSS changes
          const containerRect = mobileActionControlsRef.value.getBoundingClientRect();
          const viewportTop = 0;
          
          // Get the floating bar height if available, otherwise estimate
          let barHeight = 313; // Default estimate
          if (floatingActionBarRef.value) {
            const barRect = floatingActionBarRef.value.getBoundingClientRect();
            if (barRect.height > 0) {
              barHeight = barRect.height;
            }
          }
          
          // Calculate where the bar WOULD be positioned above the container
          const barTopIfAbove = containerRect.top - barHeight - 8; // 8px gap
          const spaceAbove = containerRect.top - viewportTop;
          const spaceNeeded = barHeight + 8;
          
          // If the bar would overflow the top, position it below the button instead
          const wouldOverflowTop = barTopIfAbove < viewportTop || spaceAbove < spaceNeeded;
          
          mobileMenuPositionBelow.value = wouldOverflowTop;
        } catch (e) {
          mobileMenuPositionBelow.value = false;
        }
      };
      
      // Only calculate once after layout is ready
      requestAnimationFrame(() => {
        updatePosition();
      });
    };
    
    // Calculate desktop menu position to prevent overflow
    const calculateMenuPosition = () => {
      if (isMobile.value || !showActionBar.value || !desktopMenuContainerRef.value) {
        menuPositionBelow.value = false;
        return;
      }
      
      const updatePosition = () => {
        try {
          const containerRect = desktopMenuContainerRef.value.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const viewportTop = 0;
          
          // Get actual menu height if available, otherwise estimate
          let menuHeight = 200; // Default estimate
          if (desktopActionMenuRef.value) {
            const menuRect = desktopActionMenuRef.value.getBoundingClientRect();
            if (menuRect.height > 0) {
              menuHeight = menuRect.height;
            }
          }
          
          // Calculate available space above and below
          const spaceAbove = containerRect.top - viewportTop;
          const spaceBelow = viewportHeight - containerRect.bottom;
          const spaceNeeded = menuHeight + 8; // 8px gap
          
          // Check if menu would overflow the top of the viewport
          const wouldOverflowTop = spaceAbove < spaceNeeded;
          const wouldOverflowBottom = spaceBelow < spaceNeeded;
          
          // Position below if not enough space above
          // If both would overflow, pick the one with MORE space
          if (wouldOverflowTop && wouldOverflowBottom) {
             menuPositionBelow.value = spaceBelow > spaceAbove;
          } else {
             menuPositionBelow.value = wouldOverflowTop;
          }
        } catch (e) {
          // Fallback to default (above) if calculation fails
          menuPositionBelow.value = false;
        }
      };

      // Use requestAnimationFrame to ensure we measure after layout
      requestAnimationFrame(() => {
        updatePosition();
        // Double check in next frame in case of transitions
        requestAnimationFrame(() => {
          updatePosition();
        });
      });
    };
    
    // Resize observer for the menu element
    let menuResizeObserver = null;
    
    // Watch for action bar state changes to recalculate position
    watch(showActionBar, (isOpen) => {
      if (isOpen && !isMobile.value) {
        // Desktop menu positioning
        calculateMenuPosition();
        
        // Setup resize observer when menu opens
        nextTick(() => {
          if (desktopActionMenuRef.value) {
            if (menuResizeObserver) menuResizeObserver.disconnect();
            
            menuResizeObserver = new ResizeObserver(() => {
               calculateMenuPosition();
            });
            menuResizeObserver.observe(desktopActionMenuRef.value);
          }
        });
      } else if (isOpen && isMobile.value) {
        // Mobile floating action bar positioning
        calculateMobileMenuPosition();
      } else {
        // Don't reset mobileMenuPositionBelow - keep it during close animation to avoid flash
        // It will be recalculated when menu opens again
        menuPositionBelow.value = false; // Desktop can reset since it doesn't have same issue
        if (menuResizeObserver) {
          menuResizeObserver.disconnect();
          menuResizeObserver = null;
        }
      }
    });
    
    // Handle touch events for swipe down to dismiss
    const handleActionBarTouchStart = (e) => {
      actionBarTouchStartY.value = e.touches[0].clientY;
    };
    
    const handleActionBarTouchMove = (e) => {
      actionBarTouchMoveY.value = e.touches[0].clientY;
    };
    
    const handleActionBarTouchEnd = (e) => {
      const swipeDistance = actionBarTouchMoveY.value - actionBarTouchStartY.value;
      const swipeThreshold = 30; // pixels
      
      // If swiped down more than threshold, hide action bar
      if (swipeDistance > swipeThreshold) {
        hideActionBar();
      }
    };
    
    // Handle outside clicks to hide action bar
    const handleActionBarOutsideClick = (event) => {
      if (!showActionBar.value) return;
      
      // Check if the click is outside the action bar and hint button
      const actionBarElement = event.target.closest('.floating-action-bar');
      const hintButtonElement = event.target.closest('.action-hint-button');
      const replyButtonElement = event.target.closest('.mobile-reply-button');
      
      if (!actionBarElement && !hintButtonElement && !replyButtonElement) {
        hideActionBar();
      }
    };
    

    

    
    // Add event listeners
    onMounted(() => {
      // Initialize formatters if not already done
      initFormatters();
      
      // Initialize save state from message data
      initializeSaveState();
      
      document.addEventListener('click', handleActionBarOutsideClick);
      
      // Check if we're on mobile
      checkMobileDevice();
      window.addEventListener('resize', checkMobileDevice);
      window.addEventListener('resize', handleViewportChange);
      
      // Recalculate menu position on scroll/resize when menu is open
      menuPositionRecalcHandler = () => {
        if (showActionBar.value && !isMobile.value) {
          calculateMenuPosition();
        }
      };
      window.addEventListener('scroll', menuPositionRecalcHandler, true);
      window.addEventListener('resize', menuPositionRecalcHandler);


      // Observe DOM mutations inside message content to catch late appends
      try {
        if (messageContentRef.value && typeof MutationObserver !== 'undefined') {
          domObserver.value = new MutationObserver((records) => {
            try {
              const el = messageContentRef.value;
              if (!el) return;
              const text = el.innerText || '';
              if (text.includes('[object Promise]')) {
                const changes = records.map(r => ({
                  type: r.type,
                  addedNodes: Array.from(r.addedNodes || []).map(n => ({ nodeType: n.nodeType, text: n.textContent?.slice?.(0, 80) })),
                  removedNodes: Array.from(r.removedNodes || []).map(n => ({ nodeType: n.nodeType, text: n.textContent?.slice?.(0, 80) }))
                }));
                debugLog('Detected "[object Promise]" in message content', {
                  messageId: props.message.id,
                  displayMode: props.displayMode,
                  changes
                });
              }
            } catch (e) {}
          });
          domObserver.value.observe(messageContentRef.value, { childList: true, subtree: true, characterData: true });
        }
      } catch (e) {}

    });
    
    onBeforeUnmount(() => {
      if (navAnimationTimeout.value) {
        clearTimeout(navAnimationTimeout.value);
        navAnimationTimeout.value = null;
      }

      document.removeEventListener('click', handleActionBarOutsideClick);
      window.removeEventListener('resize', checkMobileDevice);
      window.removeEventListener('resize', handleViewportChange);
      
      // Remove menu position recalculation listeners
      if (menuPositionRecalcHandler) {
        window.removeEventListener('scroll', menuPositionRecalcHandler, true);
        window.removeEventListener('resize', menuPositionRecalcHandler);
        menuPositionRecalcHandler = null;
      }
      
      if (menuResizeObserver) {
        menuResizeObserver.disconnect();
        menuResizeObserver = null;
      }
      
      // Disconnect observer
      try { if (domObserver.value) { domObserver.value.disconnect(); domObserver.value = null; } } catch (e) {}

      
      // Close this message's action bar if it's open
      if (showActionBar.value) {
        store.dispatch('navigation/hideActionBar', props.message.id);
      }
      

    });
    
    // We've simplified the read/unread handling - each message now just shows its own status
    

    
    // Loading state for navigation buttons (similar to SiblingNavigator)
    const isParentLoading = computed(() => {
      if (!props.message.parent_id) return false;
      const parent = store.getters['messages/getMessage'](props.message.parent_id);
      return !parent;
    });
    
    // Sibling navigator visibility flags (mirror original template conditions)
    const showSiblingNavMobile = computed(() => {
      const val = !props.inListView && shouldReserveSiblingNavSpace.value && isMobile.value;
      return val;
    });

    const showSiblingNavDesktop = computed(() => {
      const val = !props.inListView && shouldReserveSiblingNavSpace.value && !isMobile.value;
      return val;
    });

    // (debug logging removed)
    
    return {
      isCentered,
      // Props for template access
      message: toRef(props, 'message'),
      displayMode: toRef(props, 'displayMode'),
      selectable: toRef(props, 'selectable'),
      selected: toRef(props, 'selected'),
      inListView: toRef(props, 'inListView'),
      compact: toRef(props, 'compact'),
      navAnimationClass,
      // Used for desktop sizing / sibling navigator layout
      shouldReserveSiblingNavSpace,
      // Sibling-navigation animation
      // Computed and reactive values
      currentUser,
      isUserRecipient,
      isUserAuthor,
      isBot,
      botVersionTooltip,
      isImported,
      authorUid,
      isPublic,
      isAdmin,
      canDeleteMessage,
      canToggleVisibility,
      isMessageUnread,
      hasReplies: computed(() => props.message.child_ids?.length > 0),
      isEndOfBranch,
      hasRecipients,
      deduplicatedRecipients,
      existingTags,
      showTagsModal,
      handleTagsUpdate,
      handleTagsDone,
      closeTagsModal,
      existingChannels,
      hasChannels,
      showChannelsModal,
      handleChannelsUpdate,
      handleChannelsDone,
      closeChannelsModal,
      openChannelsModal,
      showReplyOrderModal,
      openReplyOrderModal,
      closeReplyOrderModal,
      handleReplyOrderUpdate,
      recipientsExcludingUser,
      authorDisplayName,
      authorUserTag,
      showParticipantsLabel,
      participantItems,
      openTagsModal,
      isUserAuthorOfContent,
      handleSiblingNavigation,
      isCurrentUser,
      isCurrentUserRecipient,
      isTogglingReadStatus,
      isAutoMarkingAsRead,
      toggleReadStatus,
      copyMessageJson,
      copyMessageText,
      truncatedContent,
      formattedContentOptions,
      // isReformatting,
      // handleReformat,
      messageContentRef,
      messageNodeRef,
      isCollapsed,
      canCollapse,
      toggleCollapse,
      hasSiblings,
      showSiblingNavMobile,
      showSiblingNavDesktop,
      isMobile,
      isJsonCopied,
      isTextCopied,
      isLinkCopied,
      copyMessageLink,
      isMessageSaved,
      isSavingMessage,
      toggleSaveMessage,
      toggleVisibility,
      openLinksModal,
      openAddRecipientsModal,
      handleMessageClick,
      handleSelectionToggle,
      // Mobile floating action bar
      showActionBar,
      toggleActionBar,
      hideActionBar,
      handleActionBarTouchStart,
      handleActionBarTouchMove,
      handleActionBarTouchEnd,
      handleViewportChange,
      // Selection mode
      isSelectionMode,
      isMessageSelected,
      // Unified message actions
      messageActions,
      desktopVisibleActions,
      mobileVisibleActions,
      menuActions,
      shouldShowMenuButton,
      isPlaying,
      isLoading,
      // Menu positioning
      desktopMenuContainerRef,
      desktopActionMenuRef,
      menuPositionBelow,
      mobileActionControlsRef,
      floatingActionBarRef,
      mobileMenuPositionBelow,
      // Subject addition
      isAddingSubject,
      canAddSubject,
      newSubject,
      subjectInputRef,
      startAddingSubject,
      cancelAddingSubject,
      saveSubject,
      
    };
  },
  
  methods: {
    formatTimestamp(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const daysDiff = Math.floor((today - messageDate) / (1000 * 60 * 60 * 24));
      
      // Format: "Jan 17, 2:30 PM" or "Jan 17, 2024, 2:30 PM" if not this year
      const month = date.toLocaleString('en-US', { month: 'short' });
      const day = date.getDate();
      const year = date.getFullYear() !== now.getFullYear() ? `, ${date.getFullYear()}` : '';
      const time = date.toLocaleString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      
      return `${month} ${day}${year}, ${time}`;
    }
  }
}
</script>

<style scoped>
.message-node {
  margin-bottom: 0;
  margin-left: auto;
  margin-right: auto;
  max-width: 100%;
  width: 100%; /* Ensure it spans the full available container space */
  padding: 0 4px; /* Reduced horizontal padding */
  transition: all var(--transition-fast);
  position: relative;
  contain: layout style;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Collapse buttons */
.collapse-button {
  width: auto;
  min-width: 24px;
  height: 24px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
  transition: all 0.2s ease;
  padding: 0;
  margin: 0;
  flex-shrink: 0;
  z-index: 2;
}

.collapse-button:hover {
  opacity: 1;
  background: var(--color-hover-overlay);
  border-color: var(--color-border-hover);
}

.collapse-button--top {
  margin-left: var(--space-xs, 8px);
}

.collapse-button--bottom {
  /* Bottom button styling handled by desktop/mobile variants */
}

.collapse-button--desktop {
  margin-left: var(--space-xs, 8px);
}

.collapse-icon {
  font-size: 10px;
  color: var(--color-text-secondary);
  transition: transform 0.2s ease;
  line-height: 1;
}

.message-node.collapsed .collapse-icon {
  transform: rotate(180deg);
}

/* Collapsed state */
.message-node.collapsed .message-content {
  max-height: 60px;
  overflow: hidden;
  position: relative;
}

.message-node.collapsed .message-content::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 30px;
  background: linear-gradient(to bottom, transparent, var(--color-surface));
  pointer-events: none;
}

.message-node.collapsed .message-body {
  max-height: 30px;
  overflow: hidden;
}

.message-node.collapsed .message-footer,
.message-node.collapsed .mobile-action-controls,
.message-node.collapsed .message-attachments {
  display: none;
}

/* Ensure all content stretches out nicely */
.message-node .message-content {
  width: 100%;
  max-width: none;
}

/* Elevate z-index when dropdown is open to ensure it appears above subsequent messages */
.message-node.dropdown-open {
  z-index: 100; /* Increased to match floating action bar z-index */
  position: relative; /* Ensure stacking context */
}

/* Add styling for list view mode */
.message-node.list-view {
  width: 100% !important;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
  transition: box-shadow var(--transition-normal);
  justify-content: stretch !important;
}

/* List view: truncate plaintext content to 3 visual lines using line-clamp */
.message-node.list-view .plaintext-content {
  display: -webkit-box;
  -webkit-line-clamp: 3; /* Show max 3 rendered lines */
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.5; /* Consistent line height for predictable truncation */
}

/* Only show pointer cursor in list view when not in selection mode */
.message-node.list-view .message-content:not(.selectable) {
  cursor: pointer;
}

/* Ensure consistent width in list view by overriding sibling-specific styling */
.message-node.list-view .message-content {
  margin-left: 0 !important;
  margin-right: 0 !important;
  max-width: 100% !important;
  width: 100% !important;
  z-index: 1;
}

/* Override sibling-specific styling in list view */
.message-node.list-view[data-has-siblings="true"] {
  width: 100% !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

.message-node.list-view:hover {
  box-shadow: var(--color-card-shadow, 0 4px 6px rgba(0, 0, 0, 0.1));
}

.message-node.list-view:hover .message-content {
  background-color: var(--color-hover-overlay, rgba(0, 0, 0, 0.02));
  border-color: var(--color-primary-light, rgba(0, 123, 255, 0.3));
}

.message-node.list-view .message-body {
  max-height: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Sibling navigator is now in the footer, so no extra margins needed */

.message-content {
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md); /* Reduced padding: sm/md instead of md/lg */
  border: 1px solid var(--color-border);
  width: 100%;
  position: relative;
  z-index: 1;
  transition: background-color var(--transition-fast), border-color var(--transition-fast), max-height 0.3s ease-out, padding 0.2s ease;
  box-sizing: border-box;
}

/* Sibling navigation card animation (message node only) */
.message-content.animate-nav-next,
.message-content.animate-nav-prev {
  will-change: transform;
}

.message-content.animate-nav-next {
  /* Snap into place without overshoot; fast “drop” then lock. */
  animation: nav-next 1s cubic-bezier(0.2, 0.95, 0.2, 1) forwards;
}

.message-content.animate-nav-prev {
  /* Snap into place without overshoot; fast “drop” then lock. */
  animation: nav-prev 1s cubic-bezier(0.2, 0.95, 0.2, 1) forwards;
}

@keyframes nav-next {
  0% {
    transform: perspective(1000px) rotateY(14deg) rotateX(14deg);
  }
  35% {
    transform: perspective(1000px) rotateY(0.6deg) rotateX(0deg);
  }
  100% {
    transform: perspective(1000px) rotateY(0deg) rotateX(0deg);
  }
}

@keyframes nav-prev {
  0% {
    transform: perspective(1000px) rotateY(-14deg) rotateX(14deg);
  }
  35% {
    transform: perspective(1000px) rotateY(-0.6deg) rotateX(0deg);
  }
  100% {
    transform: perspective(1000px) rotateY(0deg) rotateX(0deg);
  }
}

/* Add space and adjust positioning for sibling navigation on desktop */
@media (min-width: 769px) {
  .message-node:not([data-has-siblings="true"]) {
    width: 100%;
  }

  .message-node[data-has-siblings="true"] {
    /* Non-root nodes reserve space for the desktop sibling navigator buttons. */
    width: calc(100% - 64px); /* Subtract space for both nav buttons (32px * 2) */
    margin-left: auto;
    margin-right: auto;
  }

  .message-node[data-has-siblings="true"] .sibling-navigator {
    /* Allow the absolutely-positioned navigator buttons to still render in the reserved area. */
    width: calc(100% + 64px); /* Add back the space for nav buttons */
    left: -32px; /* Move navigator back to align with full width */
  }
}

.message-node.selected .message-content {
  border: 2px solid var(--color-primary);
  background-color: var(--color-primary-light);
}

.message-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-xxs, 4px);
  margin-bottom: var(--space-xxs, 4px);
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: var(--space-xs, 8px);
}

.header-row-left,
.badges-row-left {
  display: flex;
  align-items: center;
  gap: var(--space-xxs, 4px);
  flex: 1;
  min-width: 0;
}

.header-row-right {
  display: flex;
  align-items: center;
  gap: var(--space-xs, 6px);
  flex-shrink: 0;
}

.author-row-left {
  display: flex;
  align-items: center;
  gap: var(--space-xxs, 4px);
  flex: 1;
  min-width: 0;
}

.selection-checkbox {
  cursor: pointer;
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
  flex-shrink: 0;
  appearance: none;
  -webkit-appearance: none;
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

.selection-checkbox:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

/* Old author-section - now using header-row structure */

/* Prevent delete button and other icon buttons from wrapping unnecessarily */
.delete-icon-button,
.envelope-icon-button {
  flex-shrink: 0;
  flex-grow: 0;
  white-space: nowrap;
  flex-basis: auto;
}

/* Ensure delete button stays on first line when there's space - give it lower wrap priority */
.delete-icon-button {
  order: 1; /* Place delete button after badges but before wrapping */
}

/* Badges should wrap before icon buttons */
.recipients-toggle,
.tags-toggle,
.channels-toggle,
.globe-emoji {
  order: 0; /* Badges wrap first */
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
  box-sizing: border-box;
  flex-shrink: 0;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-start;
  min-width: 0; /* Ensures proper text truncation */
}

.message-author {
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.message-author.current-user-name {
  font-weight: 800;
  color: var(--color-primary);
}

.author-user-tag {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.visibility-indicator, .recipients-toggle {
  /* Apply consistent base styling to both types of indicators */
  font-size: calc(var(--font-size-xs) - 1px);
  padding: 1px 5px;
  border-radius: var(--radius-pill);
  height: 20px;
  display: inline-flex;
  align-items: center;
  line-height: 1.2;
}

.visibility-indicator {
  background-color: var(--color-success);
  color: var(--color-text-inverse);
}

.visibility-indicator.private {
  background-color: var(--color-warning);
}

.recipients-toggle {
  /* Base styling for all recipient toggles */
  font-size: var(--font-size-xs);
  padding: 2px 6px;
  cursor: pointer;
  border-radius: var(--radius-pill);
  transition: all var(--transition-fast);
  margin-left: 0;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Tags toggle (blue tone) */
.tags-toggle {
  font-size: calc(var(--font-size-xs) - 1px);
  padding: 1px 5px;
  cursor: pointer;
  border-radius: var(--radius-pill);
  transition: all var(--transition-fast);
  margin-left: 0;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1.2;
  background-color: rgba(79, 140, 255, 0.12);
  border: 1px solid rgba(79, 140, 255, 0.45);
  color: #4F8CFF;
}

.tags-toggle:hover {
  background-color: rgba(79, 140, 255, 0.18);
  border-color: rgba(79, 140, 255, 0.75);
}

/* Channels toggle (similar to tags but with different color) */
.channels-toggle {
  font-size: calc(var(--font-size-xs) - 1px);
  padding: 1px 5px;
  cursor: pointer;
  border-radius: var(--radius-pill);
  transition: all var(--transition-fast);
  margin-left: 0;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1.2;
  background-color: rgba(255, 165, 0, 0.12);
  border: 1px solid rgba(255, 165, 0, 0.45);
  color: #FFA500;
}

.channels-toggle:hover {
  background-color: rgba(255, 165, 0, 0.18);
  border-color: rgba(255, 165, 0, 0.75);
}

.recipients-toggle:not(.to-you):not(.author-toggle) {
  /* Only apply these styles to the default toggle (not author or to-you) */
  background-color: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

/* Envelope icon button for read/unread status */
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

.envelope-icon-button.loading {
  opacity: 0.7;
  cursor: wait;
}

/* Envelope SVG icon styling */
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

.envelope-icon-button:hover .envelope-icon {
  transform: scale(1.1);
}

/* Globe emoji visibility indicator (modeled after RecipientsModal indicators) */
.globe-emoji {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 24px;
  font-size: 16px;
  cursor: pointer;
  transition: all var(--transition-fast);
  opacity: 0.8; /* default */
}

.globe-emoji.visible {
  opacity: 1;
}

.globe-emoji.hidden {
  opacity: 0.4; /* more transparent when private */
}

.globe-emoji.non-interactive {
  cursor: default;
}

.globe-emoji:hover {
  transform: scale(1.1);
}

.globe-emoji.non-interactive:hover {
  transform: none;
}

.recipients-toggle.author-toggle {
  background-color: var(--color-warning);
  color: var(--color-text-inverse);
  border: none;
}





.delete-button, .title-button {
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  background-color: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all var(--transition-fast);
}

.delete-button:hover, .title-button:hover {
  background-color: var(--color-hover-overlay);
}

.title-icon {
  font-family: "Times New Roman", serif;
  font-style: italic;
  font-weight: bold;
  font-size: 1.3em;
  color: #b01b2e; /* Closer to the dark red in the image */
  cursor: pointer;
  transition: color var(--transition-fast);
  margin: 0 8px 0 0;
  display: inline-block;
  transform: skewX(-5deg); /* Slight slant */
  position: relative;
  top: 1px;
}

.title-icon:hover {
  color: #d84156; /* Lighter red for hover state */
}

/* Delete icon button styling */
.delete-icon-button {
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
  flex-shrink: 0; /* Prevent wrapping when there's space */
  white-space: nowrap;
}

.delete-icon-button:hover {
  background-color: #fff0f0;
  transform: scale(1.1);
}

.delete-icon {
  width: 16px;
  height: 16px;
  fill: var(--color-error);
  transition: all var(--transition-fast);
}

.delete-icon-button:hover .delete-icon {
  fill: #d32f2f;
}

.message-timestamp {
  font-size: calc(var(--font-size-xs) - 1px);
  color: var(--color-text-secondary);
  white-space: nowrap;
  line-height: 1.2;
}

/* Timestamp container removed - now in header-row */

.message-subject {
  font-weight: 700;
  font-size: 1.05em;
  margin-bottom: 6px;
  color: var(--color-text);
  line-height: 1.3;
}

/* Hidden by default; shown on mobile under username/buttons */
.mobile-inline-timestamp {
  display: none;
}

.message-body {
  margin-bottom: var(--space-sm, 12px); /* Increased space before footer */
  white-space: normal;
  word-wrap: break-word;
  width: 100%;
  color: #ffffff; /* Force white text color */
  transition: max-height 0.3s ease-out, opacity 0.2s ease;
  line-height: 1.5;
}

.message-content p {
  color: #ffffff; /* Force white text color */
  margin-bottom: .5rem;
}

/* Add larger font size when not in list view */
.message-node .plaintext-content {
  font-size: .9rem;
  color: #ffffff; /* Force white text color in list view */
}

/* Compact mode - smaller font sizes and spacing */
.message-node.compact .message-content {
  padding: var(--space-sm) var(--space-md);
}

.message-node.compact .plaintext-content {
  font-size: 0.9rem;
}

.message-node.compact .message-author {
  font-size: var(--font-size-sm);
}

.message-node.compact .author-user-tag {
  font-size: calc(var(--font-size-xs) - 1px);
}

.message-node.compact .message-timestamp {
  font-size: calc(var(--font-size-xs) - 1px);
}

.message-node.compact .visibility-indicator,
.message-node.compact .recipients-toggle {
  font-size: calc(var(--font-size-xs) - 1px);
  padding: 1px 5px;
  height: 20px;
}

.message-node.compact .message-actions {
  gap: 12px;
}

  .message-node.compact .action-button,
  .message-node.compact .mobile-action-button,
  .message-node.compact .desktop-menu-button {
    font-size: calc(var(--font-size-xs) - 1px);
    padding: 4px 6px;
  }

.message-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-xxs, 4px);
  gap: var(--space-xs, 6px);
}

.footer-right-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs, 8px);
}

.reply-count {
  font-size: calc(var(--font-size-xs) - 1px);
  color: var(--color-text-secondary);
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  line-height: 1.2;
}

/* copy-id-button removed (moved into actions menu) */

/* Header sibling navigation slot styling */
.header-sibling-nav-slot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: var(--space-sm);
}

/* Mobile sibling navigator overlay (rendered outside the rotating card). */
.mobile-sibling-nav-slot {
  display: none;
}

/* Mobile footer layout */
@media (max-width: 768px) {
  .message-footer {
    justify-content: space-between;
    position: relative;
    align-items: center;
    flex-wrap: nowrap;
  }

  /* Hide desktop timestamp on mobile - but show it on desktop */
  @media (max-width: 768px) {
    .header-row--author .header-row-right {
      display: none;
    }
  }

  /* Show mobile timestamp beneath the username/buttons, full width */
  .header-row--author .mobile-inline-timestamp {
    display: block;
    flex-basis: 100%;
    width: 100%;
    margin-top: 2px;
  }
  
  .message-footer .reply-count {
    flex: 0;
    text-align: left;
  }
}

.message-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  position: relative;
  margin-left: auto;
}

/* Mobile action controls - hidden on desktop */
.mobile-action-controls {
  display: none;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background-color: var(--card-background);
  border-radius: 12px;
  width: 90%;
  max-width: 450px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  color: var(--text-color);
  font-size: 18px;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-color);
  opacity: 0.7;
}

.close-button:hover {
  opacity: 1;
}

.modal-content {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--input-background, #fff);
  color: var(--text-color);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  gap: 12px;
}

.cancel-btn {
  background-color: transparent;
  color: var(--text-color);
  border: 1px solid var(--border-color);
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.save-btn {
  background-color: var(--primary-color);
  color: black;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  min-width: 120px;
  height: 38px;
}

.save-btn:hover:not(:disabled) {
  background-color: var(--primary-color-dark, #0069d9);
}

.save-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.save-status {
  margin-top: 12px;
  padding: 8px;
  border-radius: 4px;
  background-color: var(--card-background-active, #f0f0f0);
  color: var(--text-color);
  font-size: 0.85em;
}

.save-status.error {
  background-color: var(--card-background-error, #ffcccc);
}

/* Unified action button styling */
.action-button,
.mobile-action-button,
.desktop-menu-button {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xs);
  padding: 5px 8px;
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--color-text-secondary);
}

.action-button:hover,
.mobile-action-button:hover,
.desktop-menu-button:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-hover);
  color: var(--color-primary);
}

.action-button.active,
.mobile-action-button.active,
.desktop-menu-button.active {
  background-color: #bdbdbd;
  border-color: #bdbdbd;
  color: var(--color-text-inverse);
  transform: scale(1.05);
}

.action-button.disabled,
.mobile-action-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-button.disabled:hover,
.mobile-action-button.disabled:hover {
  background-color: transparent;
  border-color: var(--color-border);
  color: var(--color-text-secondary);
  transform: none;
}

.action-emoji {
  font-size: var(--font-size-sm);
  line-height: 1;
}

.action-text {
  font-size: var(--font-size-xs);
}



@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Desktop menu container for relative positioning */
.desktop-menu-container {
  position: relative;
}

/* Desktop action menu styling */
.desktop-action-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
  z-index: 20;
  min-width: 120px;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: calc(100vh - 20px); /* Prevent overflow beyond viewport */
}

/* Position menu below button when not enough space above */
.desktop-action-menu.menu-below {
  bottom: auto;
  top: calc(100% + 8px);
  max-height: calc(100vh - 20px); /* Ensure it doesn't overflow bottom either */
}

.desktop-menu-button {
  width: 100%;
  justify-content: flex-start;
  border: none;
  border-radius: 0;
  padding: 8px 12px;
}

.desktop-menu-button:hover {
  background-color: var(--color-hover-overlay);
  border: none;
}

/* Suppress hover/animation for disabled desktop menu entries */
.desktop-menu-button:disabled,
.desktop-menu-button:disabled:hover {
  background-color: transparent;
  color: var(--color-text-secondary);
  opacity: 0.7;
  cursor: default;
  transform: none;
}

/* .reformat-icon {
  font-size: var(--font-size-sm);
  line-height: 1;
}

.reformat-button.loading {
  opacity: 0.7;
  cursor: wait;
}

.reformat-button .loading-indicator {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
} */

/* Save button special styling for active state */
.action-button.save-active,
.mobile-action-button.save-active {
  background-color: #6a5942;
  border-color: black;
  color: var(--color-text-inverse);
}

.action-button.save-active:hover,
.mobile-action-button.save-active:hover {
  background-color: #6a5942;
  border-color: rgb(180, 180, 180);
  color: var(--color-text-inverse);
}

@media (max-width: 768px) {
  .message-node {
    width: 100%;
    position: relative;
    perspective: 1000px;
    padding: 0 3px; /* Reduced padding on mobile */
  }

  /* Reserve space for the overlayed sibling navigator so text doesn't overlap it. */
  .message-node[data-has-siblings="true"] .author-row-left {
    padding-left: 44px;
  }

  .mobile-sibling-nav-slot {
    display: flex;
    position: absolute;
    top: 10px;
    left: 3px;
    z-index: 20;
  }

  .message-content.animate-nav-next,
  .message-content.animate-nav-prev {
    transition: none !important;
  }
  
  .message-content {
    position: relative;
    width: 100%;
    touch-action: pan-y; /* Allow vertical scrolling but capture horizontal swipes */
    /* Default transition for smoother movement */
    transition: transform 0.02s linear, opacity 0.02s linear;
    z-index: 1;
    background-color: var(--color-surface);
    padding: var(--space-xxs, 6px) var(--space-sm, 10px); /* More compact padding */
    margin: 0; /* Remove margins since parent now has padding */
  }
  
  .message-body {
    word-break: break-word;
    overflow-wrap: break-word;
    max-width: 100%;
    font-size: 0.9rem; /* Slightly smaller text on mobile */
    line-height: 1.4;
  }
  
  .message-subject {
    font-size: 1em;
    margin-bottom: 4px;
  }
  
  .author-info {
    flex-wrap: nowrap;
    max-width: 65%; /* More space for author info */
    gap: 3px;
  }
  
  .message-author {
    font-size: calc(var(--font-size-sm) - 1px);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .author-user-tag {
    font-size: calc(var(--font-size-xs) - 2px);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .message-header {
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 3px;
  }
  
  .header-right {
    gap: 4px;
  }
  
  .message-timestamp {
    font-size: calc(var(--font-size-xs) - 2px);
  }
  
  .header-row {
    flex-wrap: wrap;
    gap: 4px;
  }
  
  .author-row-left,
  .badges-row-left {
    flex-wrap: wrap;
    gap: 4px;
  }
  
  .visibility-indicator, .recipients-toggle, .tags-toggle, .channels-toggle {
    font-size: calc(var(--font-size-xs) - 2px);
    padding: 1px 4px;
    height: 18px;
  }
  
  .envelope-icon-button {
    width: 20px;
    height: 20px;
    padding: 2px;
  }
  
  .envelope-icon {
    width: 14px;
    height: 14px;
  }
  
  .delete-icon-button {
    width: 20px;
    height: 20px;
    padding: 2px;
  }
  
  .delete-icon {
    width: 14px;
    height: 14px;
  }
  
  .selection-checkbox {
    width: 16px;
    height: 16px;
  }
  
  /* Hide desktop actions on mobile */
  .desktop-actions,
  .desktop-action-menu,
  .desktop-menu-container {
    display: none !important;
  }
  
  /* Hide reply count in footer on mobile when not in list view */
  .mobile-hidden {
    display: none !important;
  }
  
  /* Mobile action controls container */
  .mobile-action-controls {
    display: flex !important; /* Override desktop display: none */
    position: absolute;
    bottom: 6px;
    right: 6px;
    z-index: 10;
    gap: 6px;
    align-items: flex-end;
  }
  
  /* Hide desktop collapse button on mobile */
  .collapse-button--desktop {
    display: none !important;
  }
  
  /* Hide timestamp container on mobile (already shown inline) */
  /* Mobile collapse button styling - smaller */
  .collapse-button--mobile {
    min-width: 20px;
    height: 20px;
    padding: 2px;
  }
  
  .collapse-button--mobile .collapse-icon {
    font-size: 8px;
  }
  
  /* Top collapse button on mobile - smaller */
  .collapse-button--top {
    min-width: 20px;
    height: 20px;
    padding: 2px;
    margin-left: 4px;
  }
  
  .collapse-button--top .collapse-icon {
    font-size: 8px;
  }
  
  /* Mobile reply count - positioned next to reply button */
  .mobile-reply-count {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    padding: 8px 12px;
    background: transparent;
    z-index: 12;
    min-height: 36px;
    white-space: nowrap;
  }
  

  
  /* Mobile action button specific styling */
  .mobile-action-button {
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
    z-index: 12;
    min-height: 32px;
    padding: 6px 10px;
    font-size: calc(var(--font-size-xs) - 1px);
  }
  
  .mobile-action-button:hover {
    transform: scale(1.05);
  }
  
  .mobile-action-button:active {
    transform: scale(0.95);
  }
  
  .mobile-action-button.menu-button {
    min-width: 32px;
    min-height: 32px;
    padding: 6px;
    opacity: 0.7;
  }
  
  .mobile-action-button.menu-button:hover {
    opacity: 1;
    transform: scale(1.1);
  }
  
  .mobile-action-button.menu-button.active {
    background-color: var(--color-primary);
    color: var(--color-text-inverse);
    border-color: var(--color-primary);
    opacity: 1;
    transform: rotate(90deg);
  }
  
  /* Floating Action Bar */
  .floating-action-bar {
    position: absolute;
    bottom: 46px; /* Position above the reply button */
    right: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px;
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(10px);
    z-index: 100; /* High z-index to appear above other message nodes */
    max-height: calc(100vh - 60px); /* Prevent overflow beyond viewport */
    overflow-y: auto;
    
    /* Hide by default */
    opacity: 0;
    pointer-events: none;
    transform: translateY(8px) scale(0.95);
    transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    /* Note: Don't transition top/bottom to avoid flash when position changes */
  }
  
  .floating-action-bar.active {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0) scale(1);
  }
  
  /* Position mobile menu below button when not enough space above */
  .floating-action-bar.position-below {
    bottom: auto;
    top: 46px; /* Position below the menu button */
    max-height: calc(100vh - 60px); /* Ensure it doesn't overflow bottom either */
  }
  
  /* Floating Action Bar Buttons */
  .fab-button {
    min-width: 40px;
    min-height: 40px;
    background-color: transparent;
    color: var(--color-text);
    font-size: calc(var(--font-size-xs) - 1px);
    border: none;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all var(--transition-fast);
    font-size: 16px;
    position: relative;
  }
  
  .fab-button:hover {
    background-color: var(--color-hover-overlay);
    transform: scale(1.05);
  }
  
  .fab-button:active {
    transform: scale(0.95);
  }
  
  .fab-button.copied,
  .fab-button.saved {
    background-color: var(--color-success);
    color: var(--color-text-inverse);
    transform: scale(1.1);
  }
  
  .fab-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  
  /* Suppress hover/animation for disabled floating menu entries */
  .fab-button:disabled:hover,
  .fab-button:disabled:active {
    background-color: transparent;
    transform: none;
    opacity: 0.6;
    cursor: default;
  }
  
  /* Add loading indicator for save button */
  .fab-button .loading-indicator {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid var(--color-text);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  /* Ensure message content takes full width */
  .message-content {
    margin-left: 0;
    margin-right: 0;
    max-width: 100%;
  }
  

}

/* Loading indicator styling */
.loading-indicator {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Minimal styling for the new button */
 


@media (max-width: 480px) {
  .message-node {
    padding: 0 2px; /* Minimal padding on very small screens */
  }
  
  .message-content {
    padding: 5px 8px; /* Very compact padding */
    margin: 0;
  }
  
  .message-body {
    font-size: 0.85rem; /* Smaller text on very small screens */
    line-height: 1.35;
  }
  
  .message-subject {
    font-size: 0.95em;
    margin-bottom: 3px;
  }
  
  .message-header {
    gap: 3px;
    margin-bottom: 2px;
  }
  
  .header-right {
    gap: 3px;
  }
  
  .author-row-left,
  .badges-row-left {
    gap: 3px;
  }
  
  .header-row--author .author-row-left {
    max-width: 70%; /* Balance between author info and controls */
  }
  
  .author-info {
    gap: 2px;
  }
  
  .message-author {
    font-size: calc(var(--font-size-sm) - 2px);
  }
  
  .author-user-tag {
    font-size: calc(var(--font-size-xs) - 3px);
  }
  
  .message-timestamp {
    font-size: calc(var(--font-size-xs) - 3px);
  }
  
  .visibility-indicator, .recipients-toggle, .tags-toggle, .channels-toggle {
    font-size: calc(var(--font-size-xs) - 3px);
    padding: 1px 3px;
    height: 16px;
  }
  
  .envelope-icon-button, .delete-icon-button {
    width: 18px;
    height: 18px;
    padding: 1px;
  }
  
  .envelope-icon, .delete-icon {
    width: 12px;
    height: 12px;
  }
  
  .selection-checkbox {
    width: 14px;
    height: 14px;
  }
  
  /* Adjust mobile action controls for very narrow screens */
  .mobile-action-controls {
    bottom: 4px;
    right: 4px;
    gap: 4px;
  }
  
  .mobile-reply-count {
    padding: 5px 8px;
    font-size: calc(var(--font-size-xs) - 2px);
    min-height: 28px;
  }
  
  .mobile-action-button {
    padding: 5px 8px;
    font-size: calc(var(--font-size-xs) - 2px);
    min-height: 28px;
  }
  
  .mobile-action-button.menu-button {
    padding: 5px;
    min-width: 28px;
    min-height: 28px;
  }
  
  .floating-action-bar {
    bottom: 40px;
    padding: 5px;
    gap: 5px;
    border-radius: 10px;
  }
  
  .fab-button {
    min-width: 36px;
    min-height: 36px;
    font-size: calc(var(--font-size-xs) - 2px);
  }
  
  .collapse-button--top, .collapse-button--mobile {
    min-width: 18px;
    height: 18px;
    padding: 1px;
  }
  
  .collapse-button--top .collapse-icon, .collapse-button--mobile .collapse-icon {
    font-size: 7px;
  }
}



/* message-id removed */

.edit-icon-button {
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
  margin-left: 4px; /* Space between delete and edit */
}

.edit-icon-button:hover {
  background-color: #f0f5ff; /* Light blue on hover */
  transform: scale(1.1);
}

.edit-icon {
  width: 15px;
  height: 15px;
  fill: var(--color-primary);
  transition: all var(--transition-fast);
}

.edit-icon-button:hover .edit-icon {
  fill: #2962ff; /* Darker blue on hover */
}

.message-timestamp {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.message-subject {
  font-weight: 600;
  font-size: var(--font-size-md);
  margin-bottom: var(--space-xs);
  color: var(--color-text);
}

.add-subject-container {
  margin-bottom: var(--space-xs);
}

.add-subject-button {
  background: transparent;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.add-subject-button:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: var(--color-hover-overlay);
}

.add-subject-input-container {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--space-xs);
  padding: 4px 0;
}

.add-subject-input {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  padding: 4px 50px 4px 4px;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: 600;
}

.add-subject-input:focus {
  outline: none;
  border-bottom-color: var(--color-primary);
}

.add-subject-input.subject-input--error {
  border-bottom-color: var(--color-error);
}

.add-subject-input::placeholder {
  color: var(--color-text-secondary);
  font-weight: 400;
}

.subject-char-count {
  position: absolute;
  right: 100px;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-weight: 400;
  pointer-events: none;
}

.subject-char-count--error {
  color: var(--color-error);
}

.save-subject-button,
.cancel-subject-button {
  padding: 4px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.save-subject-button {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-primary);
}

.save-subject-button:hover:not(:disabled) {
  background: var(--color-primary-dark);
  border-color: var(--color-primary-dark);
}

.save-subject-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-subject-button:hover {
  background: var(--color-hover-overlay);
  border-color: var(--color-border-hover);
}

.message-content p {
  color: #ffffff; /* Force white text color */
  margin-bottom: .5rem;
}

/* Add larger font size when not in list view */
.message-node .plaintext-content {
  font-size: .9rem;
  color: #ffffff; /* Force white text color in list view */
}

/* Compact mode - smaller font sizes and spacing */
.message-node.compact .message-content {
  padding: var(--space-sm) var(--space-md); /* More compact */
}

.message-node.compact .plaintext-content {
  font-size: 0.85rem;
}

.message-node.compact .message-author {
  font-size: calc(var(--font-size-sm) - 1px);
}

.message-node.compact .author-user-tag {
  font-size: calc(var(--font-size-xs) - 2px);
}

.message-node.compact .message-timestamp {
  font-size: calc(var(--font-size-xs) - 2px);
}

.message-node.compact .visibility-indicator,
.message-node.compact .recipients-toggle {
  font-size: calc(var(--font-size-xs) - 2px);
  padding: 1px 4px;
  height: 18px;
}

.message-node.compact .message-actions {
  gap: 8px;
}

  .message-node.compact .action-button,
  .message-node.compact .mobile-action-button,
  .message-node.compact .desktop-menu-button {
    font-size: calc(var(--font-size-xs) - 2px);
    padding: 3px 5px;
  }

.message-footer {
  display: flex;
  align-items: center;
  gap: var(--space-xs, 6px);
}

.reply-count {
  font-size: calc(var(--font-size-xs) - 1px);
  color: var(--color-text-secondary);
  padding: 2px 6px;
  background-color: var(--color-surface-hover);
  border-radius: var(--radius-xs);
  cursor: help;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
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
</style>
