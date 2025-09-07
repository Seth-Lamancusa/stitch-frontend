<template>
  <div 
    class="message-node" 
    :class="{ 
      'list-view': inListView,
      'compact': compact,
      'selected': inListView ? selected : isMessageSelected
    }"
    :data-message-id="message.id"
    :data-has-siblings="!!message.parent_id"
  >
      <div 
    class="message-content" 
    ref="messageContentRef" 
    @click="handleMessageClick"
    :class="{ 'selectable': selectable }"
  >
    <div class="message-header">
      <div class="author-section">
        <!-- Sibling navigator - positioned left of display name on mobile only -->
        <div v-if="!inListView && message.parent_id && isMobile" class="header-sibling-nav-slot">
          <sibling-navigator
            :message-id="message.id"
            :parent-id="message.parent_id"
            :mobile-mode="isMobile"
            @navigate="handleSiblingNavigation"
            :data-debug-has-siblings="hasSiblings"
          />
        </div>
        
        <!-- Unread thread count badge - only shown in inbox/list view -->
        <span v-if="inListView && message.unread_count_in_thread && message.unread_count_in_thread > 0" class="unread-thread-badge">
          {{ message.unread_count_in_thread }}
        </span>
        
        <div class="author-info">
          <span class="message-author" :class="{ 'current-user-name': isCurrentUser }">{{ authorDisplayName }}</span>
          <span v-if="authorUserTag" class="author-user-tag">@{{ authorUserTag }}</span>
        </div>
        
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
          
          <!-- Public badge - shown for all public messages -->
          <span v-if="isPublic" class="visibility-indicator public">
            Public
          </span>
          
          <!-- Recipients badge -->
          <button 
            v-if="hasRecipients"
            @click.stop="openAddRecipientsModal" 
            class="recipients-toggle author-toggle"
            title="Add recipients to this message"
          >
            Recipients {{ typeof message.recipients === 'string' ? '' : `(${deduplicatedRecipients.length})` }}
          </button>
          
          <!-- Delete button - scope-based capability: admin or msg.write + author -->
          <button 
            v-if="canDeleteMessage(message) && !isSelectionMode && !inListView" 
            @click.stop="$emit('delete', message)" 
            class="delete-icon-button"
            :title="isAdmin ? 'Admin: Delete this message and all replies' : 'Delete this message and all replies'"
          >
            <svg class="delete-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5zm3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0z"/>
            </svg>
          </button>
          
          <!-- Edit button - only for admins -->
          <button
            v-if="isAdmin && !isSelectionMode && !inListView"
            @click.stop="openEditModal"
            class="edit-icon-button"
            title="Admin: Edit this message"
          >
            <svg class="edit-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor">
              <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3.172L5.828 12.5H3.5v-2.328L10.328 3.34z"/>
            </svg>
          </button>
        </div>
        
        <!-- Right section: timestamp + checkbox -->
        <div class="header-right">
          <span class="message-timestamp">{{ formatTimestamp(message.timestamp) }}</span>
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
      
      <!-- Message body -->
      <div class="message-body">
        <formatted-content v-if="displayMode === 'full'" :content="message.content" />
        <div v-else class="plaintext-content">{{ truncatedContent }}</div>
      </div>
      
      <div class="message-footer">
        <span class="message-id" :title="'Message ID: ' + message.id">ID: {{ message.id }}</span>
        
        <div class="reply-count" :class="{ 'mobile-hidden': isMobile && !inListView }">
          {{ message.child_ids?.length === 0 ? '🍃' : `${message.child_ids?.length} ${message.child_ids?.length === 1 ? 'reply' : 'replies'}` }}
        </div>
        
        <!-- Unified message actions - desktop layout -->
        <div v-if="!isSelectionMode" class="message-actions desktop-actions">
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
          <div v-if="shouldShowMenuButton" class="desktop-menu-container">
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
              class="desktop-action-menu"
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
      
      <!-- Desktop sibling navigator - absolutely positioned -->
      <sibling-navigator
        v-if="!inListView && message.parent_id && !isMobile"
        :message-id="message.id"
        :parent-id="message.parent_id"
        :mobile-mode="false"
        @navigate="handleSiblingNavigation"
        :data-debug-has-siblings="hasSiblings"
      />
      
      <!-- Unified mobile action controls -->
      <div v-if="!inListView && !isSelectionMode" class="mobile-action-controls">
        <!-- Reply count for mobile - positioned next to reply button -->
        <div v-if="isMobile" class="mobile-reply-count">
          {{ message.child_ids?.length === 0 ? '🍃' : `${message.child_ids?.length} ${message.child_ids?.length === 1 ? 'reply' : 'replies'}` }}
        </div>
        
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
          class="floating-action-bar" 
          :class="{ 'active': showActionBar }"
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
    FormattedContent
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
    
    // Add refs for save button state
    const isMessageSaved = ref(false);
    const isSavingMessage = ref(false);
    
    // Mobile floating action bar state - using global store
    const actionBarTouchStartY = ref(0);
    const actionBarTouchMoveY = ref(0);
    
    // Global action bar state from store
    const showActionBar = computed(() => store.getters['navigation/isActionBarOpen'](props.message.id));
    
    // Whether this message is currently the centered one in the URL
    const isCentered = computed(() => String(route.params.id) === String(props.message.id));

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
    const isMobile = ref(false);
    
    const openLinksModal = () => {
      // Close the ReplyBox if it's open
      store.dispatch('navigation/clearReplyingTo');
      
      // Emit event to parent to handle the modal
      emit('showLinks', props.message);
    };
    
    const openAddRecipientsModal = () => {
      dismissMobileKeyboard();
      console.log('[MessageNode] openAddRecipientsModal called for message', props.message.id);
      console.log('[MessageNode] hasRecipients computed value:', hasRecipients.value);
      console.log('[MessageNode] message.recipients:', props.message.recipients);
      console.log('[MessageNode] typeof message.recipients:', typeof props.message.recipients);
      
      // Add debug logging for existing recipients
      const existingRecipients = props.message.recipients && Array.isArray(props.message.recipients) 
        ? props.message.recipients 
        : [];
      console.log('[MessageNode] Existing recipients:', existingRecipients);
      
      // Show the global recipients modal
      const modalConfig = {
        isPublic: false, // Adding recipients is always for private messages
        isAddMode: true,
        existingRecipients: existingRecipients,
        messageId: props.message.id
      };
      console.log('[MessageNode] Opening recipients modal with config:', modalConfig);
      
      try {
        store.dispatch('navigation/showRecipientsModal', modalConfig);
        console.log('[MessageNode] Successfully dispatched showRecipientsModal action');
        
        // Check if modal state changed
        setTimeout(() => {
          const modalVisible = store.getters['navigation/recipientsModalVisible'];
          console.log('[MessageNode] Modal visibility after dispatch:', modalVisible);
        }, 100);
      } catch (error) {
        console.error('[MessageNode] Error dispatching showRecipientsModal:', error);
      }
    };
    
    const openEditModal = () => {
      store.dispatch('navigation/showEditMessageModal', props.message);
    };
    
    const isPublic = computed(() => {
      const publicValue = props.message.public;
      const result = publicValue === 1 || publicValue === true;
      return result;
    });
    
    // Insert openPromptModal here
    const openPromptModal = () => {
      store.dispatch('navigation/clearReplyingTo');
      dismissMobileKeyboard();
      store.dispatch('navigation/showBotPromptModal', { messageId: props.message.id });
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
      return props.message.author_display_name || '';
    });

    // Get author user tag
    const authorUserTag = computed(() => {
      return props.message.author_user_tag || null;
    });
    
    // Check if the current user is the author of the message
    const isUserAuthor = computed(() => {
      if (!currentUser.value) {
        return false;
      }
      
      // Check the UID
      if (currentUser.value.uid === props.message.content_author) {
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
      
      const hasSiblings = parent.child_ids.length > 1;
      return hasSiblings;
    });




    

    

    

    

    

    

    

    

    

    

    

    

    

    

    

    

    

    

    

    

    

    

    
    const isCurrentUser = computed(() => {
      if (!currentUser.value) return false;
      
      // Check if the author is the current user
      // First try to match by user tag
      if (authorUserTag.value && currentUser.value.user_tag === authorUserTag.value) {
        return true;
      }
      
      // Then check content_author for UID matching
      if (props.message.content_author === currentUser.value.uid) {
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
        
        // Remove newlines and extra spaces
        const contentWithoutNewlines = processedContent.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Truncate to 200 characters with ellipsis if needed
        if (contentWithoutNewlines.length > 200) {
          return contentWithoutNewlines.substring(0, 200) + '...';
        }
        
        return contentWithoutNewlines;
      })(props.message.content);
    });
    
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
    
    // Check if device is mobile
    const checkMobileDevice = () => {
      isMobile.value = window.innerWidth <= 768;
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
      

    });
    
    onBeforeUnmount(() => {
      document.removeEventListener('click', handleActionBarOutsideClick);
      window.removeEventListener('resize', checkMobileDevice);
      window.removeEventListener('resize', handleViewportChange);
      
      
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
    
    // Add debug computed property to help diagnose button visibility
    const shouldShowAddRecipientsButton = computed(() => {
      const conditions = {
        inListView: props.inListView,
        isSelectionMode: isSelectionMode.value,
        messageId: props.message.id,
        hasRecipients: hasRecipients.value
      };
      console.log('[MessageNode] Add Recipients button visibility conditions:', conditions);
      return !props.inListView && !isSelectionMode.value;
    });
    
    return {
      isCentered,
      // Props for template access
      message: toRef(props, 'message'),
      displayMode: toRef(props, 'displayMode'),
      selectable: toRef(props, 'selectable'),
      selected: toRef(props, 'selected'),
      inListView: toRef(props, 'inListView'),
      compact: toRef(props, 'compact'),
      // Computed and reactive values
      currentUser,
      isUserRecipient,
      isUserAuthor,
      isPublic,
      isAdmin,
      canDeleteMessage,
      isMessageUnread,
      hasReplies: computed(() => props.message.child_ids?.length > 0),
      isEndOfBranch,
      hasRecipients,
      deduplicatedRecipients,
      recipientsExcludingUser,
      authorDisplayName,
      authorUserTag,
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
      // isReformatting,
      // handleReformat,
      messageContentRef,
      hasSiblings,
      isMobile,
      isJsonCopied,
      isTextCopied,
      isMessageSaved,
      isSavingMessage,
      toggleSaveMessage,
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
      openEditModal,
    };
  },
  
  methods: {
    formatTimestamp(timestamp) {
      return new Date(timestamp).toLocaleString();
    }
  }
}
</script>

<style scoped>
.message-node {
  margin-bottom: 0; /* Further reduced vertical gap */
  margin-left: auto;
  margin-right: auto;
  max-width: 100%;
  padding: 0 8px; /* Add horizontal padding from screen edges */
  transition: all var(--transition-fast);
  position: relative;
  contain: layout style;
  display: flex;
  justify-content: center;
}

/* Root messages (without siblings) should expand to fill container */
.message-node:not([data-has-siblings="true"]) {
  width: 100%;
  justify-content: stretch;
}

.message-node:not([data-has-siblings="true"]) .message-content {
  width: 100%;
  max-width: none;
}

/* Elevate z-index when dropdown is open to ensure it appears above subsequent messages */
.message-node.dropdown-open {
  z-index: 10;
}

/* Add styling for list view mode */
.message-node.list-view {
  width: 100% !important;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
  transition: transform var(--transition-fast), box-shadow var(--transition-normal);
  justify-content: stretch !important;
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

/* Override root node expansion specifically in list view */
.message-node.list-view:not([data-has-siblings="true"]) {
  width: 100% !important;
  justify-content: stretch !important;
}

.message-node.list-view:not([data-has-siblings="true"]) .message-content {
  width: 100% !important;
  max-width: 100% !important;
}

/* Override sibling-specific styling in list view */
.message-node.list-view[data-has-siblings="true"] {
  width: 100% !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

.message-node.list-view:hover {
  transform: translateY(-2px);
  box-shadow: var(--color-card-shadow, 0 4px 6px rgba(0, 0, 0, 0.1));
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
  padding: var(--space-lg) var(--space-xl);
  border: 1px solid var(--color-border);
  width: 100%;
  position: relative;
  z-index: 1;
}

/* Add space and adjust positioning for sibling navigation on desktop */
@media (min-width: 769px) {
  .message-node[data-has-siblings="true"] {
    width: calc(100% - 76px); /* Subtract space for both nav buttons (38px * 2) */
    margin-left: auto;
    margin-right: auto;
  }

  .message-node[data-has-siblings="true"] .sibling-navigator {
    width: calc(100% + 76px); /* Add back the space for nav buttons */
    left: -38px; /* Move navigator back to align with full width */
  }
}

.message-node.selected .message-content {
  border: 2px solid var(--color-primary);
  background-color: var(--color-primary-light);
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-xs);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
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

.author-section {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-wrap: wrap;
  justify-content: flex-start;
  width: 100%;
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
  gap: 6px;
  justify-content: flex-start;
  min-width: 0; /* Ensures proper text truncation */
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

.visibility-indicator, .recipients-toggle {
  /* Apply consistent base styling to both types of indicators */
  font-size: var(--font-size-xs);
  padding: 2px 6px;
  border-radius: var(--radius-pill);
  height: 22px;
  display: inline-flex;
  align-items: center;
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
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.message-body {
  margin-bottom: var(--space-xs);
  white-space: normal;
  word-wrap: break-word;
  width: 100%;
  color: #ffffff; /* Force white text color */
}

.message-content p {
  color: #ffffff; /* Force white text color */
}

/* Add larger font size when not in list view */
.message-node .plaintext-content {
  font-size: 1.1rem;
  color: #ffffff; /* Force white text color in list view */
}

/* Compact mode - smaller font sizes and spacing */
.message-node.compact .message-content {
  padding: var(--space-md) var(--space-lg);
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
  gap: var(--space-sm);
  margin-top: var(--space-xs);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.reply-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-right: var(--space-sm);
  padding: 2px 6px;
  background-color: var(--color-surface-hover);
  border-radius: var(--radius-xs);
  cursor: help;
}

/* Header sibling navigation slot styling */
.header-sibling-nav-slot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: var(--space-sm);
}

/* Mobile footer layout */
@media (max-width: 768px) {
  .message-footer {
    justify-content: space-between;
    position: relative;
    align-items: center;
    flex-wrap: nowrap;
  }
  
  .message-footer .reply-count {
    flex: 1;
    text-align: left;
  }
}

.message-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  position: relative;
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
  overflow: hidden;
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
    padding: 0 5px; /* Slightly less padding on mobile */
  }
  
  .message-content {
    position: relative;
    width: 100%;
    touch-action: pan-y; /* Allow vertical scrolling but capture horizontal swipes */
    /* Default transition for smoother movement */
    transition: transform 0.02s linear, opacity 0.02s linear;
    z-index: 1;
    background-color: var(--color-surface);
    padding: var(--space-xs) var(--space-md); /* Reduce padding for mobile */
    margin: 0; /* Remove margins since parent now has padding */
  }
  
  /* No extra padding needed - navigation is now inline with action buttons */
  
  .message-body {
    word-break: break-word;
    overflow-wrap: break-word;
    max-width: 100%;
  }
  
  .author-info {
    flex-wrap: nowrap;
    max-width: 70%; /* Prevent username overflow */
  }
  
  .message-author, .author-user-tag {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .message-header {
    flex-wrap: wrap;
  }
  
  .author-section {
    flex-wrap: wrap;
    gap: 8px;
    flex: 1;
    min-width: 0; /* Allows proper text truncation */
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
    bottom: 8px;
    right: 8px;
    z-index: 10;
    gap: 8px;
    align-items: flex-end;
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
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 12;
    min-height: 36px;
    padding: 8px 12px;
  }
  
  .mobile-action-button:hover {
    transform: scale(1.05);
  }
  
  .mobile-action-button:active {
    transform: scale(0.95);
  }
  
  .mobile-action-button.menu-button {
    min-width: 36px;
    padding: 8px;
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
    bottom: 52px; /* Position above the reply button */
    right: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(10px);
    z-index: 10;
    
    /* Hide by default */
    opacity: 0;
    pointer-events: none;
    transform: translateY(8px) scale(0.95);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .floating-action-bar.active {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0) scale(1);
  }
  
  /* Floating Action Bar Buttons */
  .fab-button {
    min-width: 44px;
    min-height: 44px;
    background-color: transparent;
    color: var(--color-text);
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
  .message-content {
    padding: var(--space-xs) var(--space-sm); /* Further reduce padding */
    margin: 0 2px; /* Minimal margins */
  }
  
  /* Navigation buttons are inline - no special padding needed */
  
  .message-header {
    gap: 4px; /* Reduce header gaps */
  }
  
  .author-section {
    gap: 4px;
    max-width: 75%; /* More space for author info */
  }
  
  .message-author {
    font-size: calc(var(--font-size-sm) - 1px);
  }
  
  .author-user-tag {
    font-size: calc(var(--font-size-xs) - 1px);
  }
  
  .visibility-indicator, .recipients-toggle {
    font-size: calc(var(--font-size-xs) - 1px);
    padding: 1px 4px;
    height: 18px;
  }
  
  /* Adjust mobile action controls for very narrow screens */
  .mobile-action-controls {
    bottom: 6px;
    right: 6px;
    gap: 6px;
  }
  
  .mobile-reply-count {
    padding: 6px 10px;
    font-size: calc(var(--font-size-xs) - 1px);
    min-height: 32px;
  }
  
  .mobile-action-button {
    padding: 6px 10px;
    font-size: calc(var(--font-size-xs) - 1px);
    min-height: 32px;
  }
  
  .mobile-action-button.menu-button {
    padding: 6px;
    min-width: 32px;
    min-height: 32px;
  }
  
  .floating-action-bar {
    bottom: 48px; /* Adjust for smaller reply button */
    padding: 6px;
    gap: 6px;
  }
  
  .fab-button {
    min-width: 40px;
    min-height: 40px;
    font-size: 14px;
  }
  

}



.message-id {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-right: var(--space-sm);
  padding: 2px 6px;
  background-color: var(--color-surface-hover);
  border-radius: var(--radius-xs);
  cursor: help;
}

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

.message-body {
  margin-bottom: var(--space-xs);
  white-space: normal;
  word-wrap: break-word;
  width: 100%;
  color: #ffffff; /* Force white text color */
}

.message-content p {
  color: #ffffff; /* Force white text color */
}

/* Add larger font size when not in list view */
.message-node .plaintext-content {
  font-size: 1.1rem;
  color: #ffffff; /* Force white text color in list view */
}

/* Compact mode - smaller font sizes and spacing */
.message-node.compact .message-content {
  padding: var(--space-md) var(--space-lg);
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
  gap: var(--space-sm);
  margin-top: var(--space-xs);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.reply-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-right: var(--space-sm);
  padding: 2px 6px;
  background-color: var(--color-surface-hover);
  border-radius: var(--radius-xs);
  cursor: help;
}

/* Header sibling navigation slot styling */
.header-sibling-nav-slot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: var(--space-sm);
}

</style>