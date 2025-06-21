<template>
  <div 
    class="message-node" 
    :class="{ 
      'selected': isSelected, 
      'list-view': inListView,
      'shake-animation': isShaking,
      'being-swiped': isBeingSwiped
    }"
    :data-message-id="message.id"
    :data-has-siblings="hasSiblings"
  >
    <!-- Add sibling navigator if message has a parent -->
    <sibling-navigator
      v-if="message.parent_id && !inListView"
      :message-id="message.id"
      :parent-id="message.parent_id"
      @navigate="handleSiblingNavigation"
    />
    
    <!-- Deck visualization - only show when siblings exist -->
    <div 
      v-if="hasSiblings && !inListView" 
      class="deck-visualization"
      :class="{ 'swiping-left': swipeDirection === 'left', 'swiping-right': swipeDirection === 'right' }"
    >
      <div 
        v-for="(_, index) in siblingCount" 
        :key="index" 
        class="deck-card"
        :style="{ 
          zIndex: index, 
          transform: `translateX(${index * 2}px)`,
          opacity: 1 - (index * 0.2)
        }"
      ></div>
    </div>
    
    <div class="message-content" ref="messageContentRef" :style="swipeStyle">
      <div class="message-header">
        <div class="author-section">
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
          
          <!-- Admin controls -->
          <div class="admin-controls" v-if="isAdmin">
            <span 
              @click.stop="openTitleDescriptionModal" 
              class="title-icon"
              title="Edit title and description"
            >T</span>
            
            <button 
              @click.stop="$emit('delete', message)" 
              class="delete-button"
              title="Admin: Delete this message and all replies"
            >
              Delete
            </button>
          </div>
          
          <!-- Non-admin author delete button -->
          <button 
            v-if="isUserAuthor && !isAdmin" 
            @click.stop="$emit('delete', message)" 
            class="delete-button"
            title="Delete this message and all replies"
          >
            Delete
          </button>
        </div>
        <span class="message-timestamp">{{ formatTimestamp(message.timestamp) }}</span>
      </div>
      
      <!-- Message body -->
      <div class="message-body">
        <formatted-content v-if="!inListView" :content="message.content" />
        <div v-else class="plaintext-content">{{ truncatedContent }}</div>
      </div>
      
      <div class="message-footer">
        <div class="message-actions">
          <div class="reply-count">
            {{ totalReplies }} {{ totalReplies === 1 ? 'reply' : 'replies' }}
          </div>
          
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
          
          <!-- Add reformat button -->
          <button 
            v-if="!inListView"
            @click.stop="handleReformat" 
            class="reformat-button"
            :class="{ 'loading': isReformatting }"
            :disabled="isReformatting"
            title="Reformat this message according to Stitch guidelines"
          >
            <span v-if="isReformatting" class="loading-indicator"></span>
            <span v-else class="reformat-icon">✨</span>
            Reformat
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
          
        </div>
      </div>
    </div>
    
    <!-- Next message preview (shown during left swipe) -->
    <div 
      v-if="showNextCard && nextSiblingMessage" 
      class="sibling-preview next-preview"
      :style="incomingCardStyle"
    >
      <div class="preview-content">
        <div class="preview-header">
          <div class="author-section">
            <div class="author-info">
              <span class="preview-author">{{ nextSiblingMessage.author_display_name || 'Unknown' }}</span>
              <span v-if="nextSiblingMessage.author_user_tag" class="preview-author-tag">@{{ nextSiblingMessage.author_user_tag }}</span>
            </div>
            
            <!-- Public badge -->
            <span v-if="nextSiblingMessage.public === 1 || nextSiblingMessage.public === true" class="visibility-indicator public">
              Public
            </span>
            
            <!-- Recipients badge -->
            <span v-if="nextSiblingMessage.recipients && typeof nextSiblingMessage.recipients === 'object' && nextSiblingMessage.recipients.length > 0" 
                  class="recipients-preview">
              Recipients ({{ nextSiblingMessage.recipients.length }})
            </span>
          </div>
          <div class="preview-timestamp">
            {{ formatTimestamp(nextSiblingMessage.timestamp) }}
          </div>
        </div>
        <div class="preview-body">
          {{ nextSiblingMessage.content ? (nextSiblingMessage.content.substring(0, 280) + (nextSiblingMessage.content.length > 280 ? '...' : '')) : '' }}
        </div>
        <div class="preview-footer">
          <div class="preview-actions">
            <div class="preview-reply-count">
              {{ nextSiblingMessage.child_ids && nextSiblingMessage.child_ids.length ? nextSiblingMessage.child_ids.length : 0 }} {{ nextSiblingMessage.child_ids && nextSiblingMessage.child_ids.length === 1 ? 'reply' : 'replies' }}
            </div>
            <div class="preview-buttons">
              <button class="preview-button">Reply</button>
              <button class="preview-button">Reformat</button>
              <button class="preview-button">Copy Text</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Previous message preview (shown during right swipe) -->
    <div 
      v-if="showPrevCard && prevSiblingMessage" 
      class="sibling-preview prev-preview"
      :style="incomingCardStyle"
    >
      <div class="preview-content">
        <div class="preview-header">
          <div class="author-section">
            <div class="author-info">
              <span class="preview-author">{{ prevSiblingMessage.author_display_name || 'Unknown' }}</span>
              <span v-if="prevSiblingMessage.author_user_tag" class="preview-author-tag">@{{ prevSiblingMessage.author_user_tag }}</span>
            </div>
            
            <!-- Public badge -->
            <span v-if="prevSiblingMessage.public === 1 || prevSiblingMessage.public === true" class="visibility-indicator public">
              Public
            </span>
            
            <!-- Recipients badge -->
            <span v-if="prevSiblingMessage.recipients && typeof prevSiblingMessage.recipients === 'object' && prevSiblingMessage.recipients.length > 0" 
                  class="recipients-preview">
              Recipients ({{ prevSiblingMessage.recipients.length }})
            </span>
          </div>
          <div class="preview-timestamp">
            {{ formatTimestamp(prevSiblingMessage.timestamp) }}
          </div>
        </div>
        <div class="preview-body">
          {{ prevSiblingMessage.content ? (prevSiblingMessage.content.substring(0, 280) + (prevSiblingMessage.content.length > 280 ? '...' : '')) : '' }}
        </div>
        <div class="preview-footer">
          <div class="preview-actions">
            <div class="preview-reply-count">
              {{ prevSiblingMessage.child_ids && prevSiblingMessage.child_ids.length ? prevSiblingMessage.child_ids.length : 0 }} {{ prevSiblingMessage.child_ids && prevSiblingMessage.child_ids.length === 1 ? 'reply' : 'replies' }}
            </div>
            <div class="preview-buttons">
              <button class="preview-button">Reply</button>
              <button class="preview-button">Reformat</button>
              <button class="preview-button">Copy Text</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Title/Description Edit Modal -->
    <div v-if="showTitleDescModal" class="modal-overlay" @click.stop="closeTitleDescModal">
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <h3>Edit Title & Description</h3>
          <button class="close-button" @click.stop="closeTitleDescModal">×</button>
        </div>
        
        <div class="modal-content">
          <div class="form-group">
            <label for="messageTitle">Title</label>
            <input 
              id="messageTitle" 
              v-model="editableTitle" 
              type="text" 
              placeholder="Message title"
              ref="titleInput"
            />
          </div>
          
          <div class="form-group">
            <label for="messageDescription">Description</label>
            <textarea 
              id="messageDescription" 
              v-model="editableDescription" 
              rows="3" 
              placeholder="Brief description of this message"
            ></textarea>
          </div>
          
          <div v-if="saveMessage" class="save-status" :class="{ 'error': saveError }">
            {{ saveMessage }}
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="cancel-btn" @click.stop="closeTitleDescModal">Cancel</button>
          <button 
            class="save-btn" 
            @click.stop="saveTitleAndDescription" 
            :disabled="isSaving"
          >
            {{ isSaving ? 'Saving...' : 'Save Changes' }}
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
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useStore } from 'vuex';
import { memoize } from 'lodash-es';

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
    isSelected: {
      type: Boolean,
      default: false
    },
    indentLevel: {
      type: Number,
      default: 0
    },
    loadedReplies: {
      type: Number,
      default: 0
    },
    totalReplies: {
      type: Number,
      default: 0
    },
    canReply: {
      type: Boolean,
      default: true
    },
    inListView: {
      type: Boolean,
      default: false
    },
    // Add prop for thread messages to calculate unread count
    threadMessages: {
      type: Array,
      default: () => []
    }
  },
  
  setup(props) {
    const store = useStore();
    const currentUser = computed(() => store.getters['auth/user']);
    const isAdmin = computed(() => store.getters['auth/isAdmin']);
    const showRecipientsDropdown = ref(false);
    
    // Title/Description Modal
    const showTitleDescModal = ref(false);
    const editableTitle = ref('');
    const editableDescription = ref('');
    const isSaving = ref(false);
    const saveMessage = ref('');
    const saveError = ref(false);
    const titleInput = ref(null);
    
    // For regular users, just use token info
    const isTogglingReadStatus = ref(false);
    
    const isReformatting = ref(false);
    
    // Add refs for copy button states
    const isJsonCopied = ref(false);
    const isTextCopied = ref(false);
    
    // Add new refs for swipe functionality
    const touchStartX = ref(0);
    const touchEndX = ref(0);
    const touchStartY = ref(0);
    const currentTouchX = ref(0); // Track current touch position for live effect
    const isShaking = ref(false);
    const messageContentRef = ref(null);
    const isMobile = ref(false);
    const isBeingSwiped = ref(false); // Track if currently being swiped
    const swipeProgress = ref(0); // Track swipe progress (-100 to 100)
    const swipeDirection = ref(null); // 'left' or 'right'
    
    // New references for next/previous sibling data
    const nextSiblingMessage = ref(null);
    const prevSiblingMessage = ref(null);
    const showNextCard = ref(false);
    const showPrevCard = ref(false);
    
    const openTitleDescriptionModal = () => {
      editableTitle.value = props.message.title || '';
      editableDescription.value = props.message.description || '';
      showTitleDescModal.value = true;
      
      // Clear any previous status message
      saveMessage.value = '';
      saveError.value = false;
      
      // Focus the title input after the modal is shown
      nextTick(() => {
        if (titleInput.value) {
          titleInput.value.focus();
        }
      });
    };
    
    const closeTitleDescModal = () => {
      showTitleDescModal.value = false;
      // Clear any status message
      saveMessage.value = '';
      saveError.value = false;
    };
    
    const saveTitleAndDescription = async () => {
      // For now just close the modal, since updateMessage action was removed
      isSaving.value = true;
      
      try {
        // Create update data object with only the fields that should be sent
        const updateData = {};
        
        // Always send both fields, with null for empty strings
        // This explicitly indicates we want to clear the field if it's empty
        updateData.title = editableTitle.value.trim() || null;
        updateData.description = editableDescription.value.trim() || null;
        
        // Call the store action to update title and description
        const success = await store.dispatch('messages/updateTitleDescription', {
          messageId: props.message.id,
          ...updateData
        });
        
        if (success) {
          closeTitleDescModal();
          saveMessage.value = 'Title and description saved successfully!';
        } else {
          // Handle error - could add error state here if needed
          console.error('Failed to save title and description');
          saveError.value = true;
          saveMessage.value = 'Failed to save title and description. Please try again later.';
        }
      } catch (error) {
        console.error('Error saving title and description:', error);
        saveError.value = true;
        saveMessage.value = 'An error occurred while saving title and description. Please try again later.';
      } finally {
        isSaving.value = false;
      }
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
      // No longer automatically select the new target sibling
      // Selection will be handled by the navigateToSibling action
      // based on whether the previous sibling was selected
      console.log(`[MessageNode] Sibling navigation: ${direction}, target: ${targetSiblingId}`);
    };
    
    // Check if this message has siblings that can be navigated to
    const hasSiblings = computed(() => {
      if (!props.message.parent_id) return false;
      
      const parent = store.getters['messages/getMessage'](props.message.parent_id);
      if (!parent || !parent.child_ids || !Array.isArray(parent.child_ids)) return false;
      
      return parent.child_ids.length > 1;
    });
    
    // Determine if message has siblings for swipe navigation
    const canNavigatePrev = computed(() => {
      if (!props.message.parent_id) return false;
      
      const parent = store.getters['messages/getMessage'](props.message.parent_id);
      if (!parent || !parent.child_ids || !Array.isArray(parent.child_ids)) return false;
      
      const siblings = parent.child_ids;
      if (siblings.length <= 1) return false;
      
      const branchChild = store.getters['messages/getBranchChild'](props.message.parent_id);
      const currentPosition = siblings.indexOf(branchChild);
      
      return currentPosition > 0;
    });
    
    const canNavigateNext = computed(() => {
      if (!props.message.parent_id) return false;
      
      const parent = store.getters['messages/getMessage'](props.message.parent_id);
      if (!parent || !parent.child_ids || !Array.isArray(parent.child_ids)) return false;
      
      const siblings = parent.child_ids;
      if (siblings.length <= 1) return false;
      
      const branchChild = store.getters['messages/getBranchChild'](props.message.parent_id);
      const currentPosition = siblings.indexOf(branchChild);
      
      return currentPosition >= 0 && currentPosition < siblings.length - 1;
    });
    
    // Method to handle touch start
    const handleTouchStart = (e) => {
      // Only process swipe if on mobile and there are siblings to navigate to
      if (!isMobile.value || !hasSiblings.value) return;
      
      // Store both X and Y positions
      touchStartX.value = e.touches[0].clientX;
      touchStartY.value = e.touches[0].clientY;
      currentTouchX.value = touchStartX.value;
      isBeingSwiped.value = true;
      swipeProgress.value = 0;
      swipeDirection.value = null;
    };
    
    // Enhanced version of handleTouchMove that triggers auto-swipe at edges
    const handleTouchMove = (e) => {
      if (!isBeingSwiped.value) return;
      
      const touchMoveX = e.touches[0].clientX;
      const touchMoveY = e.touches[0].clientY;
      currentTouchX.value = touchMoveX;
      
      // Calculate vertical movement to check if we should cancel the swipe
      const verticalMovement = Math.abs(touchMoveY - touchStartY.value);
      
      // If significant vertical movement, cancel swipe effect
      if (verticalMovement > 50) {
        resetSwipe();
        return;
      }
      
      // Calculate horizontal movement
      const horizontalMovement = touchMoveX - touchStartX.value;
      
      // Calculate swipe progress as percentage of screen width (max 50%)
      const screenWidth = window.innerWidth;
      swipeProgress.value = (horizontalMovement / screenWidth) * 200; // -100 to 100
      
      // Limit swipe progress to prevent excessive movement
      swipeProgress.value = Math.max(Math.min(swipeProgress.value, 100), -100);
      
      // Set swipe direction
      swipeDirection.value = swipeProgress.value > 0 ? 'right' : 'left';
      
      // Check if the direction is valid, if not, reduce the effect
      const canSwipeLeft = canNavigateNext.value;
      const canSwipeRight = canNavigatePrev.value;
      
      // Preload the next/previous message data for the page turning effect
      if (swipeDirection.value === 'right' && canSwipeRight && Math.abs(swipeProgress.value) > 15) {
        // Prepare to show previous (right swipe)
        preparePrevSibling();
        showPrevCard.value = true;
        showNextCard.value = false;
      } else if (swipeDirection.value === 'left' && canSwipeLeft && Math.abs(swipeProgress.value) > 15) {
        // Prepare to show next (left swipe)
        prepareNextSibling();
        showNextCard.value = true;
        showPrevCard.value = false;
      } else {
        showNextCard.value = false;
        showPrevCard.value = false;
      }
      
      if ((swipeDirection.value === 'left' && !canSwipeLeft) || 
          (swipeDirection.value === 'right' && !canSwipeRight)) {
        // Reduce the effect by 70% if swiping in invalid direction
        swipeProgress.value = swipeProgress.value * 0.3;
      }
      
      // Auto-swipe once the finger reaches near the edge of the text box
      const edgeThreshold = 85; // % of progress at which we auto-swipe
      
      if (Math.abs(swipeProgress.value) >= edgeThreshold) {
        // Check if we can navigate in that direction
        if ((swipeDirection.value === 'left' && canSwipeLeft) || 
            (swipeDirection.value === 'right' && canSwipeRight)) {
          // Stop tracking touch to prevent further updates
          isBeingSwiped.value = false;
          
          // Auto-complete the swipe animation and navigate
          messageContentRef.value?.classList.add('swipe-transition');
          swipeProgress.value = swipeDirection.value === 'right' ? 100 : -100;
          
          // Navigate after a short delay to allow animation to start
          setTimeout(() => {
            const direction = swipeDirection.value === 'right' ? 'prev' : 'next';
            navigateSibling(direction);
            
            // Reset after navigation
            if (messageContentRef.value) {
              messageContentRef.value.classList.remove('swipe-transition');
            }
            swipeProgress.value = 0;
            swipeDirection.value = null;
            showNextCard.value = false;
            showPrevCard.value = false;
            nextSiblingMessage.value = null;
            prevSiblingMessage.value = null;
          }, 300);
        }
      }
    };
    
    // Method to handle touch end
    const handleTouchEnd = (e) => {
      if (!isBeingSwiped.value) return;
      
      touchEndX.value = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      
      // Calculate vertical movement
      const verticalMovement = Math.abs(touchEndY - touchStartY.value);
      
      // Only process horizontal swipes with minimal vertical movement
      if (verticalMovement < 50) {
        completeSwipe();
      } else {
        resetSwipe();
      }
    };
    
    // Reset the swipe effect without navigation
    const resetSwipe = () => {
      // Add a transition class for smooth reset
      if (messageContentRef.value) {
        messageContentRef.value.classList.add('swipe-transition');
        
        // Reset the transforms after adding transition class
        setTimeout(() => {
          swipeProgress.value = 0;
          
          // Remove transition class after animation completes
          setTimeout(() => {
            if (messageContentRef.value) {
              messageContentRef.value.classList.remove('swipe-transition');
              isBeingSwiped.value = false;
              swipeDirection.value = null;
              
              // Clear sibling preview
              showNextCard.value = false;
              showPrevCard.value = false;
            }
          }, 300);
        }, 0);
      } else {
        // Fallback if ref is not available
        swipeProgress.value = 0;
        isBeingSwiped.value = false;
        swipeDirection.value = null;
        showNextCard.value = false;
        showPrevCard.value = false;
      }
    };
    
    // Complete the swipe with navigation if threshold is met
    const completeSwipe = () => {
      const swipeThreshold = 70; // % of progress needed to trigger action
      
      if (Math.abs(swipeProgress.value) >= swipeThreshold) {
        // Add a transition class for smooth completion
        if (messageContentRef.value) {
          messageContentRef.value.classList.add('swipe-transition');
          
          // Animate to full swipe
          setTimeout(() => {
            swipeProgress.value = swipeDirection.value === 'right' ? 100 : -100;
            
            // Navigate after animation completes
            setTimeout(() => {
              const direction = swipeDirection.value === 'right' ? 'prev' : 'next';
              navigateSibling(direction);
              
              // Reset after navigation
              if (messageContentRef.value) {
                messageContentRef.value.classList.remove('swipe-transition');
              }
              swipeProgress.value = 0;
              isBeingSwiped.value = false;
              swipeDirection.value = null;
              showNextCard.value = false;
              showPrevCard.value = false;
              nextSiblingMessage.value = null;
              prevSiblingMessage.value = null;
            }, 300);
          }, 0);
        } else {
          // Fallback navigation without animation
          const direction = swipeDirection.value === 'right' ? 'prev' : 'next';
          navigateSibling(direction);
          swipeProgress.value = 0;
          isBeingSwiped.value = false;
          swipeDirection.value = null;
          showNextCard.value = false;
          showPrevCard.value = false;
          nextSiblingMessage.value = null;
          prevSiblingMessage.value = null;
        }
      } else {
        // Not enough progress to trigger action, reset
        resetSwipe();
      }
    };
    
    // Method to navigate between siblings via swipe
    const navigateSibling = async (direction) => {
      // Only allow swipe navigation on mobile and when siblings exist
      if (!isMobile.value || !hasSiblings.value) return false;
      
      if (!props.message.parent_id) return false;
      
      try {
        // Check if navigation is possible
        if (direction === 'prev' && !canNavigatePrev.value) {
          triggerShakeAnimation();
          return false;
        }
        if (direction === 'next' && !canNavigateNext.value) {
          triggerShakeAnimation();
          return false;
        }
        
        // Call the central store action for sibling navigation
        const success = await store.dispatch('messages/navigateToSibling', {
          messageId: props.message.parent_id,
          direction: direction
        });
        
        if (success) {
          // Get the new branch child after navigation
          const newBranchChild = store.getters['messages/getBranchChild'](props.message.parent_id);
          
          // Handle navigation event
          handleSiblingNavigation({
            direction,
            targetSiblingId: newBranchChild,
            parentId: props.message.parent_id
          });
          
          return true;
        }
        return false;
      } catch (error) {
        console.error("Error swiping to sibling:", error);
        return false;
      }
    };
    
    // Process swipe gesture - used for handleTouchEnd
    const handleSwipe = () => {
      const swipeThreshold = 150; // Minimum swipe distance in pixels
      const swipeDistance = touchEndX.value - touchStartX.value;
      
      // Only trigger on significant horizontal swipes
      if (Math.abs(swipeDistance) < swipeThreshold) return;
      
      if (swipeDistance > 0) {
        // Swiped right (previous sibling)
        navigateSibling('prev');
      } else {
        // Swiped left (next sibling)
        navigateSibling('next');
      }
    };
    
    // Method to trigger shake animation
    const triggerShakeAnimation = () => {
      if (isShaking.value) return; // Prevent multiple shakes
      
      isShaking.value = true;
      setTimeout(() => {
        isShaking.value = false;
      }, 820); // Animation duration + small buffer
    };
    
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
        
        // Handle recipients field based on its type
        let recipientsText = 'Recipients: None';
        if (message.recipients) {
          if (typeof message.recipients === 'string') {
            recipientsText = `Recipients: ${message.recipients}`;
          } else if (Array.isArray(message.recipients) && message.recipients.length > 0) {
            recipientsText = `Recipients: ${message.recipients.map(r => r.display_name || r.user_tag).join(', ')}`;
          }
        }
        
        // Create a metadata header with important fields
        const metadata = [
          '[METADATA HEADER]',
          `ID: ${message.id || 'N/A'}`,
          `Author: ${message.author_display_name || 'Unknown'} ${message.author_user_tag ? `(@${message.author_user_tag})` : ''}`,
          `Timestamp: ${new Date(message.timestamp).toLocaleString()}`,
          `Visibility: ${message.public ? 'Public' : 'Private'}`,
          recipientsText,
          message.title ? `Title: ${message.title}` : '',
          message.description ? `Description: ${message.description}` : '',
          '[/METADATA HEADER]\n\n'
        ].filter(Boolean).join('\n');

        // Combine metadata with the actual message content
        const fullText = `${metadata}${message.content || ''}`;
        
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
    

    
    const truncatedContent = computed(() => {
      if (!props.message.content) return '';
      
      // Memoize the truncation logic based on the content
      return memoize((content) => {
        // Remove newlines and extra spaces
        const contentWithoutNewlines = content.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Truncate to 300 characters with ellipsis if needed
        if (contentWithoutNewlines.length > 200) {
          return contentWithoutNewlines.substring(0, 200) + '...';
        }
        
        return contentWithoutNewlines;
      })(props.message.content);
    });
    
    const handleReformat = async () => {
      if (isReformatting.value) return;
      
      isReformatting.value = true;
      try {
        await store.dispatch('messages/reformatMessage', props.message.id);
      } catch (error) {
        console.error('Error reformatting message:', error);
      } finally {
        isReformatting.value = false;
      }
    };
    
    // Check if device is mobile
    const checkMobileDevice = () => {
      isMobile.value = window.innerWidth <= 768;
    };
    
    // Computed style for swipe effect - horizontal deck-like movement
    const swipeStyle = computed(() => {
      if (!isBeingSwiped.value || swipeProgress.value === 0) {
        return {};
      }
      
      // Calculate X translation - pure horizontal movement
      const translateX = swipeProgress.value * 0.8; // 80% of swipe progress for more pronounced effect
      
      // Calculate opacity (fade out as it swipes away)
      const opacity = 1 - (Math.abs(swipeProgress.value) / 150); // Fade slightly
      
      // Simple horizontal slide without rotation
      return {
        transform: `translateX(${translateX}%)`,
        opacity: `${opacity + 0.3}`, // Min opacity 0.3
      };
    });
    
    // Computed style for the incoming card - horizontal sliding only
    const incomingCardStyle = computed(() => {
      if (!isBeingSwiped.value || swipeProgress.value === 0 || 
          (!showNextCard.value && !showPrevCard.value)) {
        return { 
          opacity: 0,
          transform: 'translateX(0)'
        };
      }
      
      // Calculate progress for incoming card (reversed)
      const incomingProgress = -swipeProgress.value; 
      
      // Calculate translation for incoming card
      // Start from off-screen (100% or -100%) and move toward center
      const startPos = incomingProgress < 0 ? -100 : 100;
      const endPos = 0;
      const progress = Math.abs(swipeProgress.value) / 100;
      const translateX = startPos + (endPos - startPos) * progress;
      
      // Calculate opacity based on progress
      const opacity = Math.min(progress * 1.5, 1); // Fade in faster than fade out
      
      return {
        transform: `translateX(${translateX}%)`,
        opacity: opacity,
        zIndex: 0 // Keep behind current card during animation
      };
    });
    
    // Function to prepare the next sibling message data
    const prepareNextSibling = async () => {
      if (!props.message.parent_id || nextSiblingMessage.value) return;
      
      const parentId = props.message.parent_id;
      const parent = store.getters['messages/getMessage'](parentId);
      
      if (!parent || !parent.child_ids || !Array.isArray(parent.child_ids)) return;
      
      const siblings = parent.child_ids;
      if (siblings.length <= 1) return;
      
      const branchChild = store.getters['messages/getBranchChild'](parentId);
      const currentPosition = siblings.indexOf(branchChild);
      
      if (currentPosition >= 0 && currentPosition < siblings.length - 1) {
        const nextSiblingId = siblings[currentPosition + 1];
        const nextMessage = store.getters['messages/getMessage'](nextSiblingId);
        
        if (nextMessage) {
          nextSiblingMessage.value = nextMessage;
        }
      }
    };
    
    // Function to prepare the previous sibling message data
    const preparePrevSibling = async () => {
      if (!props.message.parent_id || prevSiblingMessage.value) return;
      
      const parentId = props.message.parent_id;
      const parent = store.getters['messages/getMessage'](parentId);
      
      if (!parent || !parent.child_ids || !Array.isArray(parent.child_ids)) return;
      
      const siblings = parent.child_ids;
      if (siblings.length <= 1) return;
      
      const branchChild = store.getters['messages/getBranchChild'](parentId);
      const currentPosition = siblings.indexOf(branchChild);
      
      if (currentPosition > 0) {
        const prevSiblingId = siblings[currentPosition - 1];
        const prevMessage = store.getters['messages/getMessage'](prevSiblingId);
        
        if (prevMessage) {
          prevSiblingMessage.value = prevMessage;
        }
      }
    };
    
    // Add event listeners
    onMounted(() => {
      // Initialize formatters if not already done
      initFormatters();
      
      // Listen for clicks to handle dropdown closing
      document.addEventListener('click', handleClickOutside);
      
      // Check if we're on mobile
      checkMobileDevice();
      window.addEventListener('resize', checkMobileDevice);
      
      // Add touch events for mobile swipe navigation - only if we have siblings
      if (messageContentRef.value) {
        messageContentRef.value.addEventListener('touchstart', handleTouchStart, { passive: true });
        messageContentRef.value.addEventListener('touchmove', handleTouchMove, { passive: true });
        messageContentRef.value.addEventListener('touchend', handleTouchEnd, { passive: true });
      }
    });
    
    onBeforeUnmount(() => {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('resize', checkMobileDevice);
      
      // Clean up touch event listeners
      if (messageContentRef.value) {
        messageContentRef.value.removeEventListener('touchstart', handleTouchStart);
        messageContentRef.value.removeEventListener('touchmove', handleTouchMove);
        messageContentRef.value.removeEventListener('touchend', handleTouchEnd);
      }
    });
    
    // We've simplified the read/unread handling - each message now just shows its own status
    
    // Compute the total number of siblings for deck visualization
    const siblingCount = computed(() => {
      if (!props.message.parent_id) return 0;
      
      const parent = store.getters['messages/getMessage'](props.message.parent_id);
      if (!parent || !parent.child_ids || !Array.isArray(parent.child_ids)) return 0;
      
      // Return the total number of siblings (including current message)
      return parent.child_ids.length;
    });
    
    return {
      currentUser,
      isUserRecipient,
      isUserAuthor,
      isPublic,
      isAdmin,
      isMessageUnread,
      showTitleDescModal,
      editableTitle,
      editableDescription,
      isSaving,
      openTitleDescriptionModal,
      closeTitleDescModal,
      saveTitleAndDescription,
      hasReplies: computed(() => props.totalReplies > 0),
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
      saveMessage,
      saveError,
      titleInput,
      isTogglingReadStatus,
      toggleReadStatus,
      copyMessageJson,
      copyMessageText,
      truncatedContent,
      isReformatting,
      handleReformat,
      messageContentRef,
      isShaking,
      hasSiblings,
      isMobile,
      swipeStyle,
      incomingCardStyle,
      isBeingSwiped,
      swipeProgress,
      swipeDirection,
      showNextCard,
      showPrevCard,
      nextSiblingMessage,
      prevSiblingMessage,
      siblingCount,
      isJsonCopied,
      isTextCopied
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
  margin-bottom: var(--space-xs);
  transition: all var(--transition-fast);
  position: relative;
  contain: layout style;
}

/* Add styling for list view mode */
.message-node.list-view {
  width: 100%;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-normal);
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

/* Add extra horizontal margin for messages with siblings */
/* First selector uses :has() which isn't supported in all browsers */
.message-node:has(> .sibling-navigator) .message-content,
/* Fallback for browsers that don't support :has() */
.message-node > .sibling-navigator ~ .message-content {
  margin-left: 40px;
  margin-right: 40px;
  max-width: calc(100% - 80px);
}

.message-content {
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  padding: var(--space-lg) var(--space-xl);
  border: 1px solid var(--color-border);
  width: 100%;
  position: relative;
  z-index: 1;
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

.admin-controls {
  display: flex;
  align-items: center;
  gap: 6px;
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
  margin-bottom: var(--space-md);
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

.message-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  width: 100%;
}

.message-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
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

.reply-button, .reformat-button, .text-button, .json-button {
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

.reply-button:hover, .reformat-button:hover:not(:disabled), .text-button:hover, .json-button:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-hover);
  color: var(--color-primary);
}

.reply-icon {
  font-size: var(--font-size-sm);
  line-height: 1;
}

.reformat-icon {
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
}

@media (max-width: 768px) {
  .message-node {
    width: 100%;
    position: relative;
    perspective: 1000px;
  }
  
  .message-content {
    position: relative;
    width: 100%;
    touch-action: pan-y; /* Allow vertical scrolling but capture horizontal swipes */
    /* Default transition for smoother movement */
    transition: transform 0.02s linear, opacity 0.02s linear;
    z-index: 1;
    background-color: var(--color-surface);
  }
  
  .message-header {
    flex-wrap: wrap;
  }
  
  .author-section {
    flex-wrap: wrap;
    gap: 8px;
  }
  
  /* Make the action buttons more consistent and clean for mobile */
  .message-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    width: 100%;
    margin-top: 4px;  /* Reduced from 12px to move buttons up */
    gap: 8px;
  }
  
  /* Button container that holds all action buttons */
  .message-actions {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    align-items: start;  /* Align items to the top */
  }
  
  /* All action buttons share same consistent styling */
  .reply-button,
  .reformat-button,
  .text-button,
  .json-button {
    width: 100%;
    padding: 4px 2px;  /* Reduced padding */
    border-radius: var(--radius-sm);
    font-size: calc(var(--font-size-xs) - 1px);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    height: 28px;  /* Reduced from 32px */
  }
  
  /* Put reply count in its own row */
  .reply-count {
    grid-column: 1 / -1;
    margin-bottom: 0px;  /* Reduced from 5px to bring buttons closer */
    text-align: left;
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }
  
  /* Ensure message content takes full width */
  .message-node > .sibling-navigator ~ .message-content {
    margin-left: 0;
    margin-right: 0;
    max-width: 100%;
  }
  
  /* Add subtle visual indicator for swipeable messages - only when siblings exist */
  .message-node:not(.list-view)[data-has-siblings="true"] .message-content::after {
    content: '';
    position: absolute;
    bottom: 10px;
    right: 10px;
    width: 8px;
    height: 8px;
    background-color: var(--color-primary);
    border-radius: 50%;
    opacity: 0.5;
  }
}

/* Shake animation for invalid swipes */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

.shake-animation .message-content {
  animation: shake 0.8s cubic-bezier(.36,.07,.19,.97) both;
}

/* Swipe animation effects */
.swipe-transition {
  transition: transform 0.3s ease-out, opacity 0.3s ease-out !important;
}

.being-swiped .message-content {
  /* Use hardware acceleration */
  will-change: transform, opacity;
  /* Add a subtle shadow for depth */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Sibling preview styles */
.sibling-preview {
  display: none; /* Hide the sibling preview to prevent overlap issues */
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  will-change: transform, opacity;
}

.preview-content {
  padding: var(--space-md);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-xs);
}

.preview-author {
  font-weight: bold;
}

.preview-timestamp {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.preview-body {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: 1.4;
  max-height: 200px;
  overflow: hidden;
  word-break: break-word;
  text-overflow: ellipsis;
}

.preview-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-xs);
}

.preview-actions {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 8px;
}

.preview-reply-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.preview-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  width: 100%;
}

.preview-button {
  padding: 4px 2px;
  border-radius: var(--radius-sm);
  font-size: calc(var(--font-size-xs) - 1px);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  height: 28px;
}

.preview-author-tag {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-left: 4px;
}

.recipients-preview {
  font-size: var(--font-size-xs);
  padding: 2px 6px;
  border-radius: var(--radius-pill);
  background-color: var(--color-warning);
  color: var(--color-text-inverse);
  height: 22px;
  display: inline-flex;
  align-items: center;
}

/* Deck visualization styling */
.deck-visualization {
  display: none; /* Hide the deck visualization entirely to prevent stacking/overlapping */
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}

.deck-card {
  position: absolute;
  top: 8px;
  right: 8px;
  bottom: 8px;
  left: 8px;
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  pointer-events: none;
}

/* When swiping left, show the deck on the right side */
.deck-visualization.swiping-left .deck-card {
  right: 0;
  left: auto;
  width: 20px;
  transform-origin: right center;
}

/* When swiping right, show the deck on the left side */
.deck-visualization.swiping-right .deck-card {
  left: 0;
  right: auto;
  width: 20px;
  transform-origin: left center;
}

/* Mobile-specific deck visualization */
@media (max-width: 768px) {
  .deck-visualization {
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .deck-card {
    position: absolute;
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }
  
  /* Display deck indicator based on swipe direction */
  .deck-visualization.swiping-left .deck-card {
    right: -3px;
    left: auto;
    width: 8px;
    height: 80%;
    box-shadow: 1px 0 3px rgba(0, 0, 0, 0.1);
  }
  
  .deck-visualization.swiping-right .deck-card {
    left: -3px;
    right: auto;
    width: 8px;
    height: 80%;
    box-shadow: -1px 0 3px rgba(0, 0, 0, 0.1);
  }
}
</style>
