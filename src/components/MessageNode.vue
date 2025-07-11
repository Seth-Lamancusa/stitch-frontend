<template>
  <div 
    class="message-node" 
    :class="{ 
      'list-view': inListView,
      'compact': compact,
      'dropdown-open': showRecipientsDropdown,
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
            :class="{ 'selection-mode-disabled': isSelectionMode }"
            @navigate="handleSiblingNavigation"
            :data-debug-has-siblings="hasSiblings"
          />
        </div>
        
        <div class="author-info">
          <span class="message-author" :class="{ 'current-user-name': isCurrentUser }">{{ authorDisplayName }}</span>
          <span v-if="authorUserTag" class="author-user-tag">@{{ authorUserTag }}</span>
        </div>
          
          <!-- Public badge - shown for all public messages -->
          <span v-if="isPublic" class="visibility-indicator public">
            Public
          </span>
          
          <!-- To You badge (for recipients) with read/unread circle indicator -->
          <div v-if="isUserRecipient" class="recipients-dropdown-container">
            <div class="recipients-toggle to-you" :class="{ 'loading': isTogglingReadStatus }">
              <!-- Read status toggle hitbox (red dot area) -->
              <button 
                @click.stop="toggleReadStatus" 
                class="read-status-button"
                :title="isMessageUnread ? 'Click to mark as read' : 'Click to mark as unread'"
                :disabled="isTogglingReadStatus"
              >
                <span v-if="isTogglingReadStatus" class="loading-indicator"></span>
                <span v-else class="read-status-indicator" :class="{ 'unread': isMessageUnread }"></span>
              </button>
              
              <!-- Recipients dropdown hitbox (text area) -->
              <button 
                @click.stop="toggleRecipientsDropdown" 
                class="recipients-text-button"
                :title="'Click to see all recipients'"
              >
                <!-- If only the user is recipient -->
                <span v-if="recipientsExcludingUser.length === 0">
                  To You
                </span>
                <!-- If there are other recipients -->
                <span v-else>
                  To You and {{ recipientsExcludingUser.length }} other{{ recipientsExcludingUser.length > 1 ? 's' : '' }}
                </span>
              </button>
            </div>
            
            <!-- Recipients dropdown for to-you badge -->
            <div v-if="showRecipientsDropdown" class="recipients-dropdown" @click.stop>
              <div class="dropdown-header">
                Recipients
                <button @click.stop="showRecipientsDropdown = false" class="close-dropdown">×</button>
              </div>
              <ul class="recipients-list">
                <li 
                  v-if="typeof message.recipients === 'object' && message.recipients !== null"
                  v-for="(recipient, index) in message.recipients" 
                  :key="recipient.uid || index" 
                  class="recipient-item"
                >
                  <span class="recipient-name">{{ recipient.display_name || recipient.user_tag }}</span>
                  <span class="recipient-tag">@{{ recipient.user_tag }}</span>
                </li>
                <li v-else-if="typeof message.recipients === 'string'" class="no-recipients">
                  {{ message.recipients }}
                </li>
                <li v-else class="no-recipients">
                  No specific recipients
                </li>
              </ul>
            </div>
          </div>
          
          <!-- Recipients badge (for authors) -->
          <div v-if="isUserAuthor && hasRecipients" class="recipients-dropdown-container author-container">
            <button 
              @click.stop="toggleRecipientsDropdown" 
              class="recipients-toggle author-toggle"
            >
              Recipients {{ typeof message.recipients === 'object' ? `(${message.recipients.length})` : '' }}
            </button>
            
            <!-- Recipients dropdown for author badge -->
            <div v-if="showRecipientsDropdown" class="recipients-dropdown" @click.stop>
              <div class="dropdown-header">
                Recipients
                <button @click.stop="showRecipientsDropdown = false" class="close-dropdown">×</button>
              </div>
              <ul class="recipients-list">
                <li 
                  v-if="typeof message.recipients === 'object' && message.recipients !== null"
                  v-for="(recipient, index) in message.recipients" 
                  :key="recipient.uid || index" 
                  class="recipient-item"
                >
                  <span class="recipient-name">{{ recipient.display_name || recipient.user_tag }}</span>
                  <span class="recipient-tag">@{{ recipient.user_tag }}</span>
                </li>
                <li v-else-if="typeof message.recipients === 'string'" class="no-recipients">
                  {{ message.recipients }}
                </li>
                <li v-else class="no-recipients">
                  No specific recipients
                </li>
              </ul>
            </div>
          </div>
          
          <!-- Delete button - shows for admins (all messages) or authors (own messages), but not in list view -->
          <button 
            v-if="(isAdmin || isUserAuthor) && !isSelectionMode && !inListView" 
            @click.stop="$emit('delete', message)" 
            class="delete-button"
            :title="isAdmin ? 'Admin: Delete this message and all replies' : 'Delete this message and all replies'"
          >
            Delete
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
        
        <!-- Desktop message actions - hidden on mobile and in selection mode -->
        <div v-if="!isSelectionMode" class="message-actions desktop-actions">
          <!-- Add reply button, but hide it in list view -->
          <button 
            v-if="!inListView"
            @click.stop="$emit('reply', message.id)" 
            class="reply-button"
            title="Reply to this message"
          >
            <span class="reply-icon">↩️</span>
            Reply
          </button>
          
          <!-- Copy JSON Button - Admin only -->
          <button 
            v-if="isAdmin"
            @click.stop="copyMessageJson" 
            class="json-button"
            :class="{ 'copied': isJsonCopied }"
            title="Copy message JSON to clipboard"
          >
            <span v-if="isJsonCopied" class="copied-icon">✓</span>
            <span v-else class="json-icon">{ }</span>
            <span v-if="isJsonCopied">Copied!</span>
            <span v-else>Copy JSON</span>
          </button>
          
          <!-- Copy Text Button -->
          <button 
            v-if="!inListView"
            @click.stop="copyMessageText" 
            class="text-button"
            :class="{ 'copied': isTextCopied }"
            title="Copy message text with metadata to clipboard"
          >
            <span v-if="isTextCopied" class="copied-icon">✓</span>
            <span v-else class="text-icon">📝</span>
            <span v-if="isTextCopied">Copied!</span>
            <span v-else>Copy Text</span>
          </button>
          
          <!-- Save/Bookmark Button -->
          <button 
            v-if="!inListView || currentTab === 'saved'"
            @click.stop="toggleSaveMessage" 
            class="save-button"
            :class="{ 'saved': isMessageSaved }"
            :disabled="isSavingMessage"
            :title="isMessageSaved ? 'Remove bookmark' : 'Bookmark this message'"
          >
            <span v-if="isSavingMessage" class="loading-indicator"></span>
            <span v-else class="bookmark-icon">🔖</span>
            <span>{{ isMessageSaved ? 'Saved' : 'Save' }}</span>
          </button>
          
          <!-- Links Button -->
          <button 
            v-if="!inListView"
            @click.stop="openLinksModal" 
            class="links-button"
            title="View links in this message"
          >
            <span class="links-icon">🔗</span>
            Links
          </button>
          
          <!-- Add Recipients Button - available to all users -->
          <button 
            v-if="shouldShowAddRecipientsButton"
            @click.stop="openAddRecipientsModal" 
            class="fab-button add-recipients-button"
            title="Add recipients to this message"
          >
            <span class="add-recipients-icon">👥</span>
          </button>
        </div>
      </div>
      
      <!-- Desktop sibling navigator - absolutely positioned -->
      <sibling-navigator
        v-if="!inListView && message.parent_id && !isMobile"
        :message-id="message.id"
        :parent-id="message.parent_id"
        :mobile-mode="false"
        :class="{ 'selection-mode-disabled': isSelectionMode }"
        @navigate="handleSiblingNavigation"
        :data-debug-has-siblings="hasSiblings"
      />
      
      <!-- Mobile floating action controls - only shown on mobile and not in selection mode -->
      <div v-if="!inListView && !isSelectionMode" class="mobile-action-controls">
        <!-- Reply count for mobile - positioned next to reply button -->
        <div v-if="isMobile" class="mobile-reply-count">
          {{ message.child_ids?.length === 0 ? '🍃' : `${message.child_ids?.length} ${message.child_ids?.length === 1 ? 'reply' : 'replies'}` }}
        </div>
        
        <!-- Persistent Reply Button -->
        <button 
          @click.stop="$emit('reply', message.id)"
          class="mobile-reply-button"
          title="Reply to this message"
        >
          Reply
        </button>
        
        <!-- Save/Bookmark Button - moved from floating action bar -->
        <button 
          @click.stop="toggleSaveMessage" 
          class="mobile-save-button"
          :class="{ 'saved': isMessageSaved }"
          :disabled="isSavingMessage"
          :title="isMessageSaved ? 'Remove bookmark' : 'Bookmark this message'"
        >
          <span v-if="isSavingMessage" class="loading-indicator"></span>
          <span v-else class="bookmark-icon">🔖</span>
        </button>
        
        <!-- Visual Discovery Hint -->
        <button 
          @click.stop="toggleActionBar"
          class="action-hint-button"
          :class="{ 'active': showActionBar }"
          title="More actions"
        >
          <span class="hint-icon">⋯</span>
        </button>
        
        <!-- Floating Action Bar -->
        <div 
          class="floating-action-bar" 
          :class="{ 'active': showActionBar }"
          @click.stop
          @touchstart.stop="handleActionBarTouchStart"
          @touchmove.stop="handleActionBarTouchMove"
          @touchend.stop="handleActionBarTouchEnd"
        >
          <!-- Copy Text Button -->
          <button 
            @click.stop="copyMessageText" 
            class="fab-button text-button"
            :class="{ 'copied': isTextCopied }"
            title="Copy message text with metadata to clipboard"
          >
            <span v-if="isTextCopied" class="copied-icon">✓</span>
            <span v-else class="text-icon">📝</span>
          </button>
          
          <!-- Links Button -->
          <button 
            @click.stop="openLinksModal" 
            class="fab-button links-button"
            title="View links in this message"
          >
            <span class="links-icon">🔗</span>
          </button>
          
          <!-- Copy JSON Button - Admin only -->
          <button 
            v-if="isAdmin"
            @click.stop="copyMessageJson" 
            class="fab-button json-button"
            :class="{ 'copied': isJsonCopied }"
            title="Copy message JSON to clipboard"
          >
            <span v-if="isJsonCopied" class="copied-icon">✓</span>
            <span v-else class="json-icon">{ }</span>
          </button>
          
          <!-- Add Recipients Button - available to all users -->
          <button 
            @click.stop="openAddRecipientsModal" 
            class="fab-button add-recipients-button"
            title="Add recipients to this message"
          >
            <span class="add-recipients-icon">👥</span>
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
import { memoize } from 'lodash-es';
import MessageService from '../services/MessageService.js';
import UserService from '../services/UserService.js';

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
    const currentUser = computed(() => store.getters['auth/user']);
    const isAdmin = computed(() => store.getters['auth/isAdmin']);
    const showRecipientsDropdown = ref(false);
    
    // Selection mode state
    const isSelectionMode = computed(() => store.getters['navigation/isSelectionMode']);
    const isMessageSelected = computed(() => store.getters['navigation/isMessageSelected'](props.message.id));
    

    
    // For regular users, just use token info
    const isTogglingReadStatus = ref(false);
    
    // const isReformatting = ref(false);
    
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
      console.log('[MessageNode] openAddRecipientsModal called for message', props.message.id);
      
      // Add debug logging for existing recipients
      const existingRecipients = props.message.recipients && Array.isArray(props.message.recipients) 
        ? props.message.recipients 
        : [];
      console.log('[MessageNode] Existing recipients:', existingRecipients);
      
      // Clear the navigation store - we want a fresh start for new recipients
      store.commit('navigation/CLEAR_REPLY_RECIPIENTS');
      console.log('[MessageNode] Cleared navigation store recipients');
      
      // Show the global recipients modal
      const modalConfig = {
        isPublic: false, // Adding recipients is always for private messages
        isAddMode: true,
        existingRecipients: existingRecipients,
        messageId: props.message.id
      };
      console.log('[MessageNode] Opening recipients modal with config:', modalConfig);
      store.dispatch('navigation/showRecipientsModal', modalConfig);
    };
    
    const isPublic = computed(() => {
      const publicValue = props.message.public;
      const result = publicValue === 1 || publicValue === true;
      return result;
    });
    
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
    
    const hasRecipients = computed(() => {
      // If recipients is a string (access message), display it anyway
      if (typeof props.message.recipients === 'string') {
        return true;
      }
      // Otherwise check if we have recipients array with items
      return props.message.recipients && props.message.recipients.length > 0;
    });
    
    // Toggle recipients dropdown
    const toggleRecipientsDropdown = () => {
      showRecipientsDropdown.value = !showRecipientsDropdown.value;
    };
    
    // Click outside handler to close dropdown
    const handleClickOutside = (event) => {
      // Check if click is inside any recipients dropdown container
      const dropdownContainers = document.querySelectorAll('.recipients-dropdown-container');
      let clickedInside = false;
      
      for (const container of dropdownContainers) {
        if (container.contains(event.target)) {
          clickedInside = true;
          break;
        }
      }
      
      if (!clickedInside && showRecipientsDropdown.value) {
        showRecipientsDropdown.value = false;
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
      console.log(`[MessageNode] Sibling navigation: ${direction}, target: ${targetSiblingId}`);
    };
    
    // Check if this message has siblings that can be navigated to
    const hasSiblings = computed(() => {
      console.log(`[MessageNode] Checking hasSiblings for message ${props.message.id}:`, {
        parentId: props.message.parent_id,
        hasParentId: !!props.message.parent_id
      });

      if (!props.message.parent_id) {
        console.log(`[MessageNode] No parent_id for message ${props.message.id}`);
        return false;
      }
      
      const parent = store.getters['messages/getMessage'](props.message.parent_id);
      console.log(`[MessageNode] Parent message for ${props.message.id}:`, {
        parentFound: !!parent,
        parentChildIds: parent?.child_ids,
        isArray: parent?.child_ids && Array.isArray(parent.child_ids)
      });

      if (!parent || !parent.child_ids || !Array.isArray(parent.child_ids)) {
        console.log(`[MessageNode] Invalid parent data for message ${props.message.id}`);
        return false;
      }
      
      const hasSiblings = parent.child_ids.length > 1;
      console.log(`[MessageNode] Message ${props.message.id} has siblings: ${hasSiblings} (${parent.child_ids.length} total children)`);
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
        const message = props.message;
        
        // Create header line with display name, user tag, and timestamp
        const userTag = message.author_user_tag ? `(@${message.author_user_tag})` : '';
        const header = `${message.author_display_name || 'Unknown'} ${userTag}, ${new Date(message.timestamp).toLocaleString()}`;
        
        // Combine header with the message content
        const fullText = `${header}\n${message.content || ''}`;
        
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
      
      // Listen for clicks to handle dropdown closing and action bar outside clicks
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('click', handleActionBarOutsideClick);
      
      // Check if we're on mobile
      checkMobileDevice();
      window.addEventListener('resize', checkMobileDevice);
      window.addEventListener('resize', handleViewportChange);
      

    });
    
    onBeforeUnmount(() => {
      document.removeEventListener('click', handleClickOutside);
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
    
    const isSiblingLoading = computed(() => {
      return store.getters['messages/isLoading'](`sibling_${props.message.parent_id}`);
    });
    
    const isLoading = computed(() => {
      return isParentLoading.value || isSiblingLoading.value;
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
      isMessageUnread,
      hasReplies: computed(() => props.message.child_ids?.length > 0),
      isEndOfBranch,
      hasRecipients,
      showRecipientsDropdown,
      toggleRecipientsDropdown,
      recipientsExcludingUser,
      authorDisplayName,
      authorUserTag,
      isUserAuthorOfContent,
      handleSiblingNavigation,
      isCurrentUser,
      isCurrentUserRecipient,
      isTogglingReadStatus,
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
      shouldShowAddRecipientsButton,
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
  width: 100%;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
  transition: transform var(--transition-fast), box-shadow var(--transition-normal);
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
  z-index: 1;
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

.recipients-toggle.to-you {
  background-color: var(--color-info);
  color: var(--color-text-inverse);
  border: none;
  position: relative;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0;
  border-radius: var(--radius-pill);
  overflow: hidden;
}

/* Read status button - left side of the badge */
.read-status-button {
  background: none;
  border: none;
  padding: 2px 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  border-radius: var(--radius-pill) 0 0 var(--radius-pill);
  min-width: 24px;
  height: 22px;
}

.read-status-button:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.1);
}

.read-status-button:disabled {
  cursor: wait;
  opacity: 0.7;
}

/* Recipients text button - right side of the badge */
.recipients-text-button {
  background: none;
  border: none;
  padding: 2px 8px 2px 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  border-radius: 0 var(--radius-pill) var(--radius-pill) 0;
  flex: 1;
  height: 22px;
  color: inherit;
  font-size: inherit;
}

.recipients-text-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

/* Read status indicator - circle that shows if message is read/unread */
.read-status-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid var(--color-text-inverse);
  background-color: transparent;
  flex-shrink: 0;
}

/* Unread state - filled red circle */
.read-status-indicator.unread {
  background-color: var(--color-error);
  border-color: var(--color-error);
}

.recipients-toggle.author-toggle {
  background-color: var(--color-warning);
  color: var(--color-text-inverse);
  border: none;
}

.recipients-dropdown-container {
  position: relative;
}

.recipients-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: var(--z-index-dropdown, 1000);
  min-width: 180px;
  max-width: 250px;
  margin-top: 2px;
}

.author-container {
  position: relative;
}

.dropdown-header {
  padding: 6px 10px;
  border-bottom: 1px solid var(--color-border);
  font-weight: bold;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-sm);
}

.close-dropdown {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: var(--color-text-secondary);
}

.recipients-list {
  list-style: none;
  padding: 4px 0;
  margin: 0;
  max-height: 100px;
  overflow-y: auto;
  scrollbar-width: thin; /* For Firefox */
  scrollbar-color: var(--color-border) transparent; /* For Firefox */
  z-index: 1000;
}

/* Webkit scrollbar styles */
.recipients-list::-webkit-scrollbar {
  width: 6px;
}

.recipients-list::-webkit-scrollbar-track {
  background: transparent;
}

.recipients-list::-webkit-scrollbar-thumb {
  background-color: var(--color-border);
  border-radius: 3px;
}

.recipients-list::-webkit-scrollbar-thumb:hover {
  background-color: var(--color-border-hover);
}

.recipient-item {
  padding: 4px 10px;
  line-height: 1.3;
  display: flex;
  flex-direction: column;
}

.recipient-name {
  font-weight: 500;
  margin-bottom: 0;
  font-size: var(--font-size-sm);
}

.recipient-tag {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  opacity: 0.8;
}

.no-recipients {
  padding: 4px 10px;
  color: var(--color-text-secondary);
  font-style: italic;
  font-size: var(--font-size-xs);
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

.delete-button {
  color: var(--color-error);
  border-color: #ffcccc;
}

.delete-button:hover {
  background-color: #fff0f0;
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

  .message-node.compact .reply-button,
  /* .message-node.compact .reformat-button, */
  .message-node.compact .text-button,
  .message-node.compact .json-button,
  .message-node.compact .save-button,
  .message-node.compact .links-button {
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

.json-button, .text-button {
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

.json-button:hover, .text-button:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-hover);
}

.json-button.copied, .text-button.copied {
  background-color: var(--color-success);
  border-color: var(--color-success);
  color: var(--color-text-inverse);
  transform: scale(1.05);
}

.json-icon, .text-icon {
  font-size: var(--font-size-sm);
  line-height: 1;
}

.copied-icon {
  font-size: var(--font-size-sm);
  font-weight: bold;
  line-height: 1;
}

.recipients-toggle.to-you.loading {
  opacity: 0.7;
  cursor: wait;
}

.recipients-toggle .loading-indicator {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 4px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* .reply-button, .reformat-button, .text-button, .json-button { */
.reply-button, .text-button, .json-button {
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

/* .reply-button:hover, .reformat-button:hover:not(:disabled), .text-button:hover, .json-button:hover { */
.reply-button:hover, .text-button:hover, .json-button:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-hover);
  color: var(--color-primary);
}

.reply-icon {
  font-size: var(--font-size-sm);
  line-height: 1;
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

.save-button {
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

.save-button:hover:not(:disabled) {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-hover);
}

.save-button.saved {
  background-color: #6a5942;
  border-color: black;
  color: var(--color-text-inverse);
  transform: scale(1.05);
}

.save-button.saved:hover {
  background-color: #6a5942;
  border-color: rgb(180, 180, 180);
  color: var(--color-text-inverse);
  transform: scale(1.05);
}

.save-button.loading {
  opacity: 0.7;
  cursor: wait;
}

.save-button .loading-indicator {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.bookmark-icon {
  font-size: var(--font-size-sm);
  line-height: 1;
}

.links-button {
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

.links-button:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-hover);
  color: var(--color-primary);
}

.links-icon {
  font-size: var(--font-size-sm);
  line-height: 1;
}

.add-recipients-button {
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

.add-recipients-button:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-hover);
  color: var(--color-primary);
}

.add-recipients-icon {
  font-size: var(--font-size-sm);
  line-height: 1;
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
  .desktop-actions {
    display: none;
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
  

  
  /* Persistent Reply Button - Desktop style without emoji */
  .mobile-reply-button {
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xs);
    padding: 8px 12px;
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: all var(--transition-fast);
    color: var(--color-text-secondary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 12;
    min-height: 36px;
  }
  
  .mobile-reply-button:hover {
    background-color: var(--color-surface-hover);
    border-color: var(--color-border-hover);
    color: var(--color-primary);
    transform: scale(1.05);
  }
  
  .mobile-reply-button:active {
    transform: scale(0.95);
  }
  
  /* Mobile Save Button - Similar styling to reply button */
  .mobile-save-button {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xs);
    padding: 8px 12px;
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: all var(--transition-fast);
    color: var(--color-text-secondary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 12;
    min-height: 36px;
    min-width: 36px;
  }
  
  .mobile-save-button:hover:not(:disabled) {
    background-color: var(--color-surface-hover);
    border-color: var(--color-border-hover);
    color: var(--color-primary);
    transform: scale(1.05);
  }
  
  .mobile-save-button:active {
    transform: scale(0.95);
  }
  
  .mobile-save-button.saved {
    background-color: #6a5942;
    border-color: black;
    color: var(--color-text-inverse);
    transform: scale(1.05);
  }
  
  .mobile-save-button.saved:hover {
    background-color: #6a5942;
    border-color: rgb(180, 180, 180);
    color: var(--color-text-inverse);
    transform: scale(1.05);
  }
  
  .mobile-save-button:disabled {
    opacity: 0.7;
    cursor: wait;
  }
  
  .mobile-save-button .loading-indicator {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  /* Visual Discovery Hint Button - Desktop style square */
  .action-hint-button {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xs);
    padding: 8px;
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: all var(--transition-fast);
    color: var(--color-text-secondary);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    z-index: 11;
    opacity: 0.7;
    min-width: 36px;
    min-height: 36px;
  }
  
  .action-hint-button:hover {
    opacity: 1;
    background-color: var(--color-surface-hover);
    border-color: var(--color-border-hover);
    color: var(--color-primary);
    transform: scale(1.1);
  }
  
  .action-hint-button.active {
    background-color: var(--color-primary);
    color: var(--color-text-inverse);
    border-color: var(--color-primary);
    opacity: 1;
    transform: rotate(90deg);
  }
  
  .action-hint-button .hint-icon {
    line-height: 1;
    transform: rotate(90deg);
    transition: transform var(--transition-fast);
  }
  
  .action-hint-button.active .hint-icon {
    transform: rotate(0deg);
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
  
  .mobile-reply-button {
    padding: 6px 10px;
    font-size: calc(var(--font-size-xs) - 1px);
    min-height: 32px;
  }
  
  .mobile-save-button {
    padding: 6px 10px;
    font-size: calc(var(--font-size-xs) - 1px);
    min-height: 32px;
    min-width: 32px;
  }
  
  .action-hint-button {
    padding: 6px;
    font-size: calc(var(--font-size-xs) - 1px);
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

/* Selection mode disabled styling for sibling navigator */
.selection-mode-disabled {
  opacity: 0.1 !important;
  pointer-events: none !important;
  user-select: none !important;
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
</style>
