<template>
  <div v-if="isVisible" class="modal-overlay" :class="{ 'closing': isClosing }" @click.self="closeModal">
    <div class="recipient-modal">
      <div class="modal-header">
        <h3>{{ isActuallyAddingToExisting ? 'Add Recipients' : 'Recipients (new message)' }}</h3>
        <button class="close-button" @click.stop="closeModal">×</button>
      </div>
      
      <div class="modal-content">


          <!-- Existing Recipients Section -->
          <div v-if="isAddMode && existingRecipients && existingRecipients.length > 0" class="existing-recipients-section">
            <p class="section-header">Visible recipients</p>
            <div class="recipients-list">
              <div  
              v-for="(recipient, index) in deduplicatedExistingRecipients" 
              :key="recipient.uid" 
              class="recipient-tag existing-recipient"
              :class="{
                'original': !recipient.timestamp,
                'added-later': recipient.timestamp
              }"
              :title="getRecipientTitle({ ...recipient, isExisting: true })"
            >
              <div class="recipient-info">
                <div class="recipient-name-line">
                  <span class="recipient-name">{{ recipient.display_name || recipient.user_tag }}</span>
                  <span v-if="recipient.user_tag" class="recipient-tag-name">@{{ recipient.user_tag }}</span>
                </div>
                <div class="recipient-metadata">
                <span class="recipient-timestamp">{{ recipient.timestamp ? new Date(recipient.timestamp).toLocaleString() : 'creation' }}</span>
                  <span class="recipient-added-by">Added by: {{ recipient.added_by_display }}</span>
                </div>
              </div>
              <div class="recipient-controls">
                <div class="visibility-indicators" :title="getVisibilityTitle(recipient)">
                  <span v-if="recipient.has_visible" class="visibility-indicator visible">👁️</span>
                  <span v-if="recipient.has_hidden" class="visibility-indicator hidden">🙈</span>
                </div>
                <button 
                  v-if="canRemoveExistingRecipient(recipient)"
                  @click.stop="() => removeExistingRecipient(index, recipient)" 
                  class="remove-recipient-btn"
                  :class="{ 'removing': removingRecipientIds.has(recipient.uid) }"
                  :disabled="removingRecipientIds.has(recipient.uid)"
                >
                  <div v-if="removingRecipientIds.has(recipient.uid)" class="spinner-small"></div>
                  <span v-else>×</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Search and Add Section -->
        <div class="search-and-add-section">
          <p class="modal-description" v-if="!isAddMode && !isPublic">Private replies require at least one recipient</p>
          <p class="modal-description" v-else-if="!isAddMode">Recipients for public replies (optional)</p>
          <p class="section-header" v-else-if="isActuallyAddingToExisting">Add new recipients</p>
          <p class="section-header" v-else>Recipients</p>
          
          <!-- Add message for guest users -->
          <p v-if="isGuestUser" class="guest-message">Please sign in to add recipients</p>
          
          <div class="recipient-input-container" v-if="!isGuestUser">
            <div class="input-wrapper" :class="{ 'valid': isTagValid === true, 'invalid': isTagValid === false, 'searching': isSearching }">
              <input 
                v-model="newRecipient" 
                @input="searchUsers"
                @keydown.enter.prevent="addRecipient" 
                @keydown.escape="clearSearch"
                placeholder="Search by username or tag" 
                class="recipient-input"
                ref="recipientInput"
              />
              <div v-if="isSearching" class="search-indicator" title="Searching...">
                <div class="spinner"></div>
              </div>
              <div v-else-if="isTagValid === true" class="valid-indicator" title="Valid user tag">✓</div>
              <div v-else-if="isTagValid === false" class="invalid-indicator" title="Invalid user tag">✗</div>
            </div>
            <button 
              @click.stop="addRecipient" 
              class="add-recipient-btn"
              :disabled="!canAddRecipient"
            >Stage</button>
          </div>
          
          <!-- Featured Bots section -->
          <div v-if="!isGuestUser" class="chatbots-section">
            <p class="chatbots-header">Featured Bots</p>
            
            <!-- Main featured bots -->
            <div class="chatbots-list">
              <div 
                v-for="bot in mainFeaturedBots" 
                :key="bot.uid" 
                class="chatbot-card"
                :class="{ 'chatbot-selected': isFeaturedBotSelected(bot) }"
                @click="toggleFeaturedBot(bot)"
              >
                <div class="chatbot-info">
                  <span class="chatbot-name">{{ bot.display_name }}</span>
                  <span class="chatbot-tag">@{{ bot.user_tag }}</span>
                </div>
                <div class="chatbot-toggle">
                  <input 
                    type="checkbox" 
                    :checked="isFeaturedBotSelected(bot)"
                    @click.stop="toggleFeaturedBot(bot)"
                  />
                </div>
              </div>
            </div>
            
            <!-- Advanced featured bots dropdown -->
            <div v-if="advancedFeaturedBots.length > 0" class="advanced-chatbots">
              <span class="advanced-toggle-inline">
                <button 
                  class="advanced-toggle-button"
                  @click="showAdvancedBots = !showAdvancedBots"
                  :aria-expanded="showAdvancedBots"
                >
                  <span class="advanced-toggle-text">Advanced ({{ advancedFeaturedBots.length }})</span>
                  <span class="advanced-toggle-icon" :class="{ 'expanded': showAdvancedBots }">▼</span>
                </button>
              </span>
              
              <div v-if="showAdvancedBots" class="advanced-chatbots-list">
                <div 
                  v-for="bot in advancedFeaturedBots" 
                  :key="bot.uid" 
                  class="chatbot-card advanced-chatbot-card"
                  :class="{ 'chatbot-selected': isFeaturedBotSelected(bot) }"
                  @click="toggleFeaturedBot(bot)"
                >
                  <div class="chatbot-info">
                    <span class="chatbot-name">{{ bot.display_name }}</span>
                    <span class="chatbot-tag">@{{ bot.user_tag }}</span>
                  </div>
                  <div class="chatbot-toggle">
                    <input 
                      type="checkbox" 
                      :checked="isFeaturedBotSelected(bot)"
                      @click.stop="toggleFeaturedBot(bot)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        
          <div class="search-results-container">
            <div v-if="showSearchResults && searchResults && searchResults.length > 0" class="search-results-list">
              <div 
                v-for="(user, index) in searchResults" 
                :key="user.uid" 
                class="search-result-item"
                @click.stop="selectSearchResult(user)"
              >
                <div class="search-result-content">
                  <span class="search-result-name">{{ user.display_name || 'User' }}</span>
                  <span class="search-result-tag">@{{ user.user_tag }}</span>
                </div>
              </div>
            </div>

            <div v-else-if="searchResults.length === 0 && hasSearched && !isSearching" class="no-search-results">
              No users found. Try a different search term.
            </div>
          </div>

          <!-- New Recipients Section -->
          <div v-if="isAddMode" class="new-recipients-section">
            <div class="recipients-list">
              <div 
                v-for="(recipient, index) in recipients" 
                :key="recipient.uid || index" 
                class="recipient-tag new-recipient"
                :title="getRecipientTitle({ ...recipient, isNew: true })"
              >
                <div class="recipient-info">
                  <div class="recipient-name-line">
                    <span class="recipient-name">{{ recipient.display_name || recipient.user_tag }}</span>
                    <span v-if="recipient.user_tag" class="recipient-tag-name">@{{ recipient.user_tag }}</span>
                  </div>
                  <div class="recipient-metadata">
                    <span class="recipient-timestamp">staged</span>
                  </div>
                </div>
                <div class="recipient-controls">
                  <button 
                    @click.stop="() => toggleRecipientVisibility(index)"
                    class="visibility-toggle-btn"
                    :class="{ 'visible': recipient.public !== false, 'invisible': recipient.public === false }"
                    :title="recipient.public !== false ? 'Visible (CC)' : 'Hidden (BCC)'"
                  >
                    <span class="visibility-emoji visible-emoji">👁️</span>
                    <span class="visibility-emoji hidden-emoji">🙈</span>
                    <div class="visibility-slider" :class="{ 'is-visible': recipient.public !== false }"></div>
                  </button>
                  <button 
                    @click.stop="() => removeRecipient(index, recipient)" 
                    class="remove-recipient-btn"
                  >×</button>
                </div>
              </div>
              
              <div v-if="!recipients || recipients.length === 0" class="no-recipients">
                No new recipients added yet
              </div>
            </div>
          </div>
        </div>
        
        <!-- Non-Add Mode Recipients List -->
        <div v-if="!isAddMode" class="recipients-list">
          <div 
            v-for="(recipient, index) in recipients" 
            :key="recipient.uid || index" 
            class="recipient-tag"
            :class="{
              'original': !recipient.timestamp,
              'added-later': recipient.timestamp
            }"
            :title="getRecipientTitle(recipient)"
          >
            <div class="recipient-info">
              <div class="recipient-name-line">
                <span class="recipient-name">{{ recipient.display_name || recipient.user_tag }}</span>
                <span v-if="recipient.user_tag" class="recipient-tag-name">@{{ recipient.user_tag }}</span>
              </div>
              <div class="recipient-metadata">
                <span class="recipient-timestamp">{{ !props.messageId ? 'now' : (recipient.timestamp ? new Date(recipient.timestamp).toLocaleString() : 'creation') }}</span>
                <span v-if="props.messageId" class="recipient-added-by">Added by: {{ getAddedByText(recipient) }}</span>
              </div>
            </div>
            <div class="recipient-controls">
              <button 
                @click.stop="() => toggleRecipientVisibility(index)"
                class="visibility-toggle-btn"
                :class="{ 'visible': recipient.public !== false, 'invisible': recipient.public === false }"
                :title="recipient.public !== false ? 'Visible (CC)' : 'Hidden (BCC)'"
              >
                <span class="visibility-emoji visible-emoji">👁️</span>
                <span class="visibility-emoji hidden-emoji">🙈</span>
                <div class="visibility-slider" :class="{ 'is-visible': recipient.public !== false }"></div>
              </button>
              <button 
                v-if="canRemoveRecipient(recipient)"
                @click.stop="() => removeRecipient(index, recipient)" 
                class="remove-recipient-btn"
              >×</button>
            </div>
          </div>
          
          <div v-if="!recipients || recipients.length === 0" class="no-recipients">
            No recipients {{ isPublic ? '(public reply)' : '' }}
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <!-- Add mode: Show "Add Recipients" button (disabled if no staged recipients) + "Cancel" button -->
        <div v-if="!isNewMessageMode">
          <!-- Ancestor propagation toggle -->
          <div class="descendants-toggle-container">
            <label class="descendants-toggle">
              <input 
                type="checkbox" 
                v-model="addToAncestors"
                :disabled="isAddingRecipients"
              />
              <span class="descendants-toggle-text">Add to all ancestors</span>
              <span class="descendants-toggle-hint" title="Also add recipients to all visible parents up to the visible root">ⓘ</span>
            </label>
          </div>
          
          <div class="modal-actions">
            <button 
              @click.stop="handleDone" 
              class="add-button" 
              :disabled="isAddingRecipients || !hasNewRecipients"
            >
              <div v-if="isAddingRecipients" class="button-loading">
                <div class="spinner-small"></div>
                <span>Adding...</span>
              </div>
              <span v-else>Add Recipients</span>
            </button>
            <button 
              @click.stop="handleDoneOrCancel" 
              class="cancel-button" 
              :disabled="isAddingRecipients"
            >
              Cancel
            </button>
          </div>
        </div>
        
        <!-- New message mode: Only show "Done" button -->
        <div v-else>
          <button 
            @click.stop="handleDoneOrCancel" 
            class="done-button" 
            :disabled="isAddingRecipients"
          >
            Done
          </button>
        </div>
      </div>
    </div>
    
    <!-- Remove recipient confirmation dialog -->
    <div v-if="showRemoveConfirm" class="modal-overlay remove-confirm-overlay" @click.self="handleOverlayClick">
      <div class="remove-confirm-modal">
        <div class="remove-confirm-header">
          <h4>Remove Recipient</h4>
        </div>
        
        <div class="remove-confirm-content">
          <p>Remove <strong>{{ recipientToRemove?.recipient?.display_name || recipientToRemove?.recipient?.user_tag }}</strong> from this message?</p>
          
          <div class="remove-options">
            <button 
              @click="confirmRemoveRecipient(false)"
              class="remove-option-btn remove-single"
              :disabled="isRemovingFromSingle || isRemovingFromDescendants"
              :class="{ 'removing': isRemovingFromSingle }"
            >
              <div v-if="isRemovingFromSingle" class="button-loading">
                <div class="spinner-small"></div>
                <span>Removing...</span>
              </div>
              <span v-else>Remove from this message only</span>
            </button>
            
            <button 
              @click="confirmRemoveRecipient(true)"
              class="remove-option-btn remove-descendants"
              :disabled="isRemovingFromSingle || isRemovingFromDescendants"
              :class="{ 'removing': isRemovingFromDescendants }"
            >
              <div v-if="isRemovingFromDescendants" class="button-loading">
                <div class="spinner-small"></div>
                <span>Removing from all...</span>
              </div>
              <span v-else>Remove from this message and all descendants</span>
            </button>
          </div>
        </div>
        
        <div class="remove-confirm-footer">
          <button 
            @click="cancelRemoveRecipient"
            class="cancel-remove-btn"
            :disabled="isRemovingFromSingle || isRemovingFromDescendants"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useStore } from 'vuex';
import MessageService from '../../services/MessageService.js';
import FeaturedBotsService from '../../services/FeaturedBotsService.js';

const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  isAddMode: {
    type: Boolean,
    default: false
  },
  existingRecipients: {
    type: Array,
    default: () => []
  },
  messageId: {
    type: [String, Number],
    default: null
  }
});

const emit = defineEmits(['close', 'done', 'add-recipients', 'recipient-removed']);

// Setup store
const store = useStore();

// Refs
const recipientInput = ref(null);
const newRecipient = ref('');
const searchResults = ref([]);
const isSearching = ref(false);
const hasSearched = ref(false);
const showSearchResults = ref(false);
const isTagValid = ref(null);
const removingRecipientIds = ref(new Set()); // Track which recipients are being removed
const isAddingRecipients = ref(false); // Track if we're adding recipients
const addToAncestors = ref(true); // Default ON per requirement
const showRemoveConfirm = ref(false); // Track remove confirmation dialog
const recipientToRemove = ref(null); // Track which recipient is being removed
const isRemovingFromSingle = ref(false); // Track if removing from single message
const isRemovingFromDescendants = ref(false); // Track if removing from descendants
let searchTimeout = null;
const isClosing = ref(false); // Quick closing fade-out state


// Helper function to deduplicate and reconcile recipient data
const deduplicateRecipients = (recipientEdges, currentUserUid) => {
  if (!recipientEdges || !Array.isArray(recipientEdges)) return [];
  
  // Group edges by recipient UID
  const recipientGroups = {};
  recipientEdges.forEach(recipient => {
    const uid = recipient.uid;
    if (!recipientGroups[uid]) {
      recipientGroups[uid] = [];
    }
    recipientGroups[uid].push(recipient);
  });
  
  // Reconcile each group into a single recipient entry
  return Object.entries(recipientGroups).map(([uid, edges]) => {
    // Get basic user info from first edge
    const firstEdge = edges[0];
    const reconciled = {
      uid: uid,
      display_name: firstEdge.display_name,
      user_tag: firstEdge.user_tag
    };
    
    // Reconcile added_by: collect all unique adders
    const adders = [...new Set(edges.map(e => e.added_by).filter(Boolean))];
    const addedByTags = [...new Set(edges.map(e => e.added_by_tag).filter(Boolean))];
    reconciled.added_by_list = adders;
    reconciled.added_by_tags = addedByTags;
    reconciled.added_by_display = addedByTags.length > 0 
      ? addedByTags.map(tag => `@${tag}`).join(', ')
      : (adders.length > 0 ? adders.join(', ') : 'Unknown');
    
    // Reconcile timestamp: use most recent non-null timestamp
    const timestamps = edges.map(e => e.timestamp).filter(t => t !== null && t !== undefined);
    reconciled.timestamp = timestamps.length > 0 
      ? timestamps.reduce((latest, current) => {
          return new Date(current) > new Date(latest) ? current : latest;
        })
      : null;
    
    // Reconcile visibility: determine what symbols to show
    const visibleEdges = edges.filter(e => (e.public ?? e.visible) === true || (e.public ?? e.visible) === null);
    const hiddenEdges = edges.filter(e => (e.public ?? e.visible) === false);
    
    // Check if current user can see hidden edges (they added them or they are the recipient)
    const canSeeHidden = currentUserUid && (
      hiddenEdges.some(e => e.added_by === currentUserUid) || 
      uid === currentUserUid
    );
    
    reconciled.has_visible = visibleEdges.length > 0;
    reconciled.has_hidden = hiddenEdges.length > 0 && canSeeHidden;
    reconciled.visible = reconciled.has_visible; // For backwards compatibility
    
    // Keep original first edge data for backwards compatibility
    reconciled.added_by = firstEdge.added_by;
    reconciled.added_by_tag = firstEdge.added_by_tag;
    
    return reconciled;
  });
};

// Computed
const recipients = computed(() => {
  console.log('[RecipientsModal] recipients computed - debug:', {
    propsIsAddMode: props.isAddMode,
    storeIsAddMode: store.getters['navigation/recipientsModalIsAddMode'],
    addModeRecipients: store.getters['navigation/addModeRecipients'],
    replyRecipients: store.getters['navigation/replyRecipients']
  });
  
  if (props.isAddMode) {
    // In add mode, show only the staged recipients for adding to existing message
    return store.getters['navigation/addModeRecipients'];
  } else {
    // In new message mode, show the recipients for the new message draft
    return store.getters['navigation/replyRecipients'];
  }
});

// Computed property for deduplicated existing recipients
const deduplicatedExistingRecipients = computed(() => {
  if (!props.isAddMode || !props.existingRecipients) return [];
  
  const deduplicated = deduplicateRecipients(props.existingRecipients, currentUser.value?.uid);
  
  console.log('[RecipientsModal] Recipient deduplication:', {
    original: props.existingRecipients.length,
    deduplicated: deduplicated.length,
    originalData: props.existingRecipients,
    deduplicatedData: deduplicated
  });
  
  return deduplicated;
});

// New computed property for unified display in add mode
const allRecipientsUnified = computed(() => {
  if (!props.isAddMode) return recipients.value;
  
  // In add mode, combine existing recipients with staged ones
  const existing = props.existingRecipients || [];
  const staged = store.getters['navigation/addModeRecipients'] || [];
  
  // Create a map to avoid duplicates (by uid)
  const recipientMap = new Map();
  
  // Add existing recipients first
  existing.forEach(recipient => {
    if (recipient.uid) {
      recipientMap.set(recipient.uid, { ...recipient, isExisting: true });
    }
  });
  
  // Add staged recipients, marking them as new
  staged.forEach(recipient => {
    if (recipient.uid) {
      recipientMap.set(recipient.uid, { ...recipient, isExisting: false, isNew: true });
    }
  });
  
  return Array.from(recipientMap.values());
});

const canAddRecipient = computed(() => {
  return newRecipient.value.trim() !== '' && isTagValid.value;
});

const currentUser = computed(() => store.getters['auth/user']);

// Add new computed property to check if user is a guest
const isGuestUser = computed(() => {
  return !currentUser.value;
});

const currentMessage = computed(() => {
  if (!props.messageId) return null;
  return store.getters['messages/getMessage'](props.messageId);
});

// Determine if we're actually adding to an existing message or just managing staged recipients
const isActuallyAddingToExisting = computed(() => {
  return props.isAddMode && props.existingRecipients && props.existingRecipients.length > 0;
});

// New computed to distinguish between new message drafts vs existing message additions
const isNewMessageMode = computed(() => {
  // New message mode is when we're not in add mode
  // ReplyBox opens with isAddMode: false (new message mode)
  // MessageNode opens with isAddMode: true (add mode)
  const result = !props.isAddMode;
  console.log('[RecipientsModal] isNewMessageMode:', result, {
    isAddMode: props.isAddMode,
    messageId: props.messageId,
    existingRecipientsLength: props.existingRecipients?.length
  });
  return result;
});

const canRemoveRecipient = computed(() => {
  return (recipient) => {
    if (!currentUser.value) return false;
    
    // In add mode, check if it's a staged recipient or existing one
    if (props.isAddMode) {
      // If it's a staged recipient being added, always allow removal
      if (recipient.isNew) {
        return true;
      }
      // If it's an existing recipient, use existing logic
      return canRemoveExistingRecipient.value(recipient);
    }
    
    // In new message mode, ALL recipients are staged by current user, so always allow removal
    return true;
  };
});

const canRemoveExistingRecipient = computed(() => {
  return (recipient) => {
    if (!currentUser.value) return false;
    
    const currentUserUid = currentUser.value.uid;
    
    // For deduplicated recipients, check if current user has any removable edges
    // Either they added the recipient themselves, or they're the message author for original recipients
    const hasRemovableEdge = recipient.added_by_list && recipient.added_by_list.includes(currentUserUid);
    const isMessageAuthor = currentMessage.value && currentMessage.value.content_author === currentUserUid;
    const hasOriginalRecipient = recipient.timestamp === null; // Has original recipient edge
    
    return hasRemovableEdge || (isMessageAuthor && hasOriginalRecipient);
  };
});

// New computed property to check if there are new recipients staged
const hasNewRecipients = computed(() => {
  const newRecipients = props.isAddMode 
    ? store.getters['navigation/addModeRecipients'] 
    : store.getters['navigation/replyRecipients'];
  const result = newRecipients.length > 0;
  console.log('[RecipientsModal] hasNewRecipients:', result, {
    isAddMode: props.isAddMode,
    newRecipientsLength: newRecipients.length,
    newRecipients: newRecipients,
    isNewMessageMode: isNewMessageMode.value
  });
  return result;
});

// Computed property to check if any removal operation is in progress
const isAnyRemovalInProgress = computed(() => {
  return isRemovingFromSingle.value || isRemovingFromDescendants.value;
});

// Methods
const getRecipientTitle = (recipient) => {
  // In new message mode, all recipients are staged (no "original" recipients yet)
  if (isNewMessageMode.value) {
    return 'Staged recipient for new message';
  }
  
  // In add mode, distinguish between new and existing recipients
  if (recipient.isNew) {
    return 'New recipient being added';
  } else if (recipient.isExisting) {
    // For deduplicated existing recipients, show combined info
    const parts = [];
    if (!recipient.timestamp) {
      parts.push('Original recipient (added when message was created)');
    } else {
      parts.push('Added after message creation');
    }
    
    if (recipient.added_by_list && recipient.added_by_list.length > 1) {
      parts.push(`Added by ${recipient.added_by_list.length} different users`);
    }
    
    return parts.join(' • ');
  } else if (!recipient.timestamp) {
    return 'Original recipient (added when message was created)';
  } else {
    return 'Added after message creation';
  }
};

// New method to get the added_by display text
const getAddedByText = (recipient) => {
  if (!recipient.added_by) {
    return 'Message author';
  }
  
  // Try to find the user who added this recipient
  const currentUser = store.getters['auth/user'];
  if (currentUser && recipient.added_by === currentUser.uid) {
    return 'You';
  }
  
  // Use the resolved user tag from backend if available
  if (recipient.added_by_tag) {
    return `@${recipient.added_by_tag}`;
  }
  
  // Fallback to UID if user tag is not available
  return `User ${recipient.added_by}`;
};

// Method to get visibility tooltip text
const getVisibilityTitle = (recipient) => {
  const parts = [];
  
  if (recipient.has_visible && recipient.has_hidden) {
    parts.push('Mixed visibility: Some additions are visible (CC), others are hidden (BCC)');
  } else if (recipient.has_visible) {
    parts.push('Visible (CC)');
  } else if (recipient.has_hidden) {
    parts.push('Hidden (BCC) - visible to you');
  }
  
  return parts.join('. ');
};

const closeModal = () => {
  console.log('[RecipientsModal] closeModal called');
  clearSearch();
  // Reset any loading states
  isAddingRecipients.value = false;
  isRemovingFromSingle.value = false;
  isRemovingFromDescendants.value = false;
  showRemoveConfirm.value = false;
  recipientToRemove.value = null;
  emit('close');
};

// Trigger a brief fade-out before closing
const closeWithFade = () => {
  isClosing.value = true;
  setTimeout(() => {
    isClosing.value = false;
    closeModal();
  }, 150);
};

const handleDone = async () => {
  console.log('[RecipientsModal] handleDone called');
  console.log('[RecipientsModal] Current recipients:', recipients.value);
  console.log('[RecipientsModal] Add to ancestors:', addToAncestors.value);
  
  // Set loading state
  isAddingRecipients.value = true;
  
  try {
    // Emit add-recipients event with current recipients and ancestor flag (UI always notifies of origin)
    const recipientsToAdd = [...recipients.value];
    emit('add-recipients', recipientsToAdd, addToAncestors.value);
    
    // Note: The parent component should call onAddRecipientsComplete() when done
    // The loading state will be cleared by the parent via that method
    
  } catch (error) {
    console.error('[RecipientsModal] Error adding recipients:', error);
    // Show user-friendly error message
    alert('Failed to add recipients. Please try again.');
    // Reset loading state on error
    isAddingRecipients.value = false;
  }
};

const handleDoneOrCancel = () => {
  console.log('[RecipientsModal] handleDoneOrCancel called');
  
  // Only clear recipients if in add mode (not new message mode)
  if (!isNewMessageMode.value && props.isAddMode) {
    // Clear any staged recipients
    store.dispatch('navigation/clearRecipients');
  }
  
  closeModal();
};

// Methods that parent component can call to signal completion
const onAddRecipientsComplete = async () => {
  console.log('[RecipientsModal] onAddRecipientsComplete called');
  console.log('[RecipientsModal] Current existing recipients at completion:', {
    count: props.existingRecipients?.length || 0,
    recipients: props.existingRecipients
  });
  
  try {
    // Clear the new recipients list after successful addition
    await store.dispatch('navigation/clearRecipients');
    console.log('[RecipientsModal] Add operation complete - modal stays open');
    
    // Force a re-check of existing recipients
    console.log('[RecipientsModal] Existing recipients after clearing staged:', {
      count: props.existingRecipients?.length || 0,
      recipients: props.existingRecipients
    });
    // Brief success flash before closing
    isAddingRecipients.value = false;
    const doneButton = document.querySelector('.add-button');
    if (doneButton) {
      doneButton.classList.add('success');
      setTimeout(() => {
        doneButton.classList.remove('success');
        // Close with quick fade-out after success
        closeWithFade();
      }, 300);
    } else {
      closeWithFade();
    }
  } catch (error) {
    console.error('[RecipientsModal] Error clearing recipients:', error);
  } finally {
    // Reset loading state
    isAddingRecipients.value = false;
  }
};

const onAddRecipientsError = (error) => {
  console.error('[RecipientsModal] onAddRecipientsError called:', error);
  // Show user-friendly error message
  const errorMessage = error?.message || 'Failed to add recipients. Please try again.';
  alert(errorMessage);
  // Reset loading state
  isAddingRecipients.value = false;
};

// Expose methods for parent component to call
defineExpose({
  onAddRecipientsComplete,
  onAddRecipientsError
});

// Debounce function for search
const searchUsers = (event) => {
  clearTimeout(searchTimeout);
  const query = event.target.value.trim();
  
  // Clear previous search state
  isSearching.value = query.length >= 1;
  
  if (query.length < 1) {
    isTagValid.value = null;
    searchResults.value = [];
    showSearchResults.value = false;
    return;
  }
  
  // Set up debounce
  searchTimeout = setTimeout(async () => {
    try {
      isSearching.value = true;
      hasSearched.value = true;
      
      // Call API to search users
      const results = await store.dispatch('auth/searchUsers', query);
      
      if (!results) {
        searchResults.value = [];
        showSearchResults.value = false;
      } else if (!Array.isArray(results)) {
        searchResults.value = [];
        showSearchResults.value = false;
      } else {
        searchResults.value = results;
        
        // Only show dropdown if we have actual results
        showSearchResults.value = results.length > 0;
      }
      
      // Update validation state based on search results
      isTagValid.value = results && results.length > 0;
      
      isSearching.value = false;
    } catch (error) {
      console.error('Error searching users:', error);
      isTagValid.value = false;
      searchResults.value = [];
      isSearching.value = false;
    }
  }, 300); // 300ms debounce
};

const clearSearch = () => {
  newRecipient.value = '';
  isTagValid.value = null;
  searchResults.value = [];
  isSearching.value = false;
  hasSearched.value = false;
  showSearchResults.value = false;
};

const selectSearchResult = (user) => {
  console.log('[RecipientsModal] selectSearchResult called with user:', user);
  
  if (user && user.user_tag) {
    // Use the full user object
    isTagValid.value = true;
    
    const recipientToAdd = {
      uid: user.uid,
      display_name: user.display_name,
      user_tag: user.user_tag,
      public: true, // Default to public (CC)
      visible: true
    };
    
    console.log('[RecipientsModal] Adding recipient to store:', recipientToAdd);
    
    // Add the recipient right away with default visibility
    store.dispatch('navigation/addRecipient', recipientToAdd);
    
    // Clear the input
    newRecipient.value = '';
  }
  
  // Clean up search state
  searchResults.value = [];
  isSearching.value = false;
  hasSearched.value = false;
  showSearchResults.value = false;
};

const addRecipient = async () => {
  const tag = newRecipient.value.trim();
  
  if (!tag) return;
  
  // Only allow adding recipients from search results
  if (searchResults.value.length > 0) {
    selectSearchResult(searchResults.value[0]);
    return;
  }
  
  // If no search results, show that the tag is invalid
  isTagValid.value = false;
};

const removeRecipient = async (index, recipient) => {
  console.log('[RecipientsModal] removeRecipient called with:', {
    index,
    recipient,
    'props.messageId': props.messageId,
    'props.isAddMode': props.isAddMode,
    'recipient.isNew': recipient.isNew,
    'recipient.isExisting': recipient.isExisting
  });
  
  try {
    // For staged recipients in new message mode
    if (!props.messageId) {
      console.log('[RecipientsModal] ✅ PATH: Removing staged recipient in new message mode');
      // Simply remove from navigation store
      store.dispatch('navigation/removeRecipient', index);
      return;
    }

    // For staged recipients in add mode
    if (props.isAddMode && recipient.isNew) {
      console.log('[RecipientsModal] ✅ PATH: Removing staged recipient in add mode');
      // Remove from navigation store - the action will handle add mode vs new message mode
      const addModeRecipients = store.getters['navigation/addModeRecipients'];
      const newIndex = addModeRecipients.findIndex(r => r.uid === recipient.uid);
      console.log('[RecipientsModal] Found staged recipient at index:', newIndex, 'in addModeRecipients');
      if (newIndex !== -1) {
        store.dispatch('navigation/removeRecipient', newIndex);
      }
      return;
    }

    // For existing recipients, use the API removal logic
    console.log('[RecipientsModal] ❌ PATH: Removing existing recipient via API - THIS SHOULD NOT HAPPEN FOR STAGED RECIPIENTS!');
    await removeExistingRecipient(index, recipient);
  } catch (error) {
    console.error('Error removing recipient:', error);
    
    // Show user-friendly error message
    const errorMessage = error.response?.data?.detail || 'Failed to remove recipient';
    alert(errorMessage);
  }
};

const removeExistingRecipient = async (index, recipient) => {
  if (!props.messageId || !recipient.uid) {
    console.error('Cannot remove existing recipient: missing messageId or recipient uid');
    return;
  }
  
  // Store recipient to remove and show confirmation dialog
  recipientToRemove.value = { index, recipient };
  showRemoveConfirm.value = true;
};

const confirmRemoveRecipient = async (propagateToDescendants) => {
  const { index, recipient } = recipientToRemove.value;
  
  // Set specific loading states
  removingRecipientIds.value.add(recipient.uid);
  if (propagateToDescendants) {
    isRemovingFromDescendants.value = true;
  } else {
    isRemovingFromSingle.value = true;
  }
  
  try {
    console.log('[RecipientsModal] Removing recipient with propagation:', propagateToDescendants);
    
    // Call API to remove recipient from the actual message
    await MessageService.removeRecipientFromMessage(props.messageId, recipient.uid, propagateToDescendants);
    
    // Refresh the message data to get updated recipients list
    await store.dispatch('messages/loadMessageRadius', { 
      messageId: props.messageId, 
      radius: 1 
    });
    
    // Also remove from the navigation store if it exists there
    // This ensures the display updates immediately
    const currentRecipients = store.getters['navigation/replyRecipients'];
    const recipientIndex = currentRecipients.findIndex(r => r.uid === recipient.uid);
    if (recipientIndex !== -1) {
      store.dispatch('navigation/removeRecipient', recipientIndex);
    }
    
    // Emit update event to parent to refresh existing recipients display
    emit('recipient-removed', recipient.uid);
    
  } catch (error) {
    console.error('Error removing existing recipient:', error);
    
    // Show user-friendly error message
    const errorMessage = error.response?.data?.detail || 'Failed to remove recipient';
    alert(errorMessage);
  } finally {
    // Reset loading states
    removingRecipientIds.value.delete(recipient.uid);
    isRemovingFromSingle.value = false;
    isRemovingFromDescendants.value = false;
    // Close confirmation dialog
    showRemoveConfirm.value = false;
    recipientToRemove.value = null;
  }
};

const cancelRemoveRecipient = () => {
  // Reset loading states
  isRemovingFromSingle.value = false;
  isRemovingFromDescendants.value = false;
  showRemoveConfirm.value = false;
  recipientToRemove.value = null;
};

const handleOverlayClick = () => {
  // Only allow closing if no removal is in progress
  if (!isAnyRemovalInProgress.value) {
    cancelRemoveRecipient();
  }
};

const toggleRecipientVisibility = (index) => {
  // Since we're now iterating directly over the navigation store recipients,
  // we can pass the index directly
  store.dispatch('navigation/toggleRecipientVisibility', index);
};

// Featured bots state and methods
const featuredBots = ref([]);
const mainFeaturedBots = computed(() => featuredBots.value.filter(bot => !bot?.advanced));
const advancedFeaturedBots = computed(() => featuredBots.value.filter(bot => bot?.advanced));
const showAdvancedBots = ref(false);

const isFeaturedBotSelected = (bot) => {
  return recipients.value.some(recipient => recipient.uid === bot.uid);
};

const toggleFeaturedBot = (bot) => {
  if (isFeaturedBotSelected(bot)) {
    const index = recipients.value.findIndex(recipient => recipient.uid === bot.uid);
    if (index !== -1) {
      store.dispatch('navigation/removeRecipient', index);
    }
  } else {
    store.dispatch('navigation/addRecipient', {
      uid: bot.uid,
      display_name: bot.display_name,
      user_tag: bot.user_tag
    });
  }
};

// Handle clicks outside search results
const handleClickOutside = (event) => {
  const searchResults = document.querySelector('.search-results-list');
  if (showSearchResults.value &&
      searchResults &&
      !searchResults.contains(event.target) &&
      !recipientInput.value?.contains(event.target)) {
    showSearchResults.value = false;
  }
};

// Auto-focus input when modal opens - DISABLED to prevent mobile keyboard
// watch(() => props.isVisible, (newVal) => {
//   if (newVal) {
//     nextTick(() => {
//       if (recipientInput.value) {
//         recipientInput.value.focus();
//       }
//     });
//   }
// });

// Lifecycle hooks
onMounted(async () => {
  document.addEventListener('click', handleClickOutside);
  // Load featured bots (mocked service for now)
  try {
    featuredBots.value = await FeaturedBotsService.listFeaturedBots();
  } catch (e) {
    featuredBots.value = [];
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
  clearTimeout(searchTimeout);
});

// Add logging to watch existing recipients
watch(() => props.existingRecipients, (newVal, oldVal) => {
  console.log('[RecipientsModal] existingRecipients prop changed:', {
    old: oldVal?.length || 0,
    new: newVal?.length || 0,
    oldRecipients: oldVal,
    newRecipients: newVal,
    isAddMode: props.isAddMode,
    messageId: props.messageId
  });
}, { deep: true, immediate: true });
</script>

<style scoped>
/* Modal overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1001;
  padding: 20px;
}

.modal-overlay.closing {
  animation: quick-fade-out 150ms ease forwards;
}

/* Recipient modal */
.recipient-modal {
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 0;
  min-width: 400px;
  max-width: 600px;
  width: 100%;
  height: 75vh;
  max-height: 75vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

/* Modal header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
}

.close-button {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 24px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  transition: color 0.2s ease;
}

.close-button:hover {
  color: var(--color-error);
}

/* Modal content */
.modal-content {
  padding: 20px 24px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.modal-description {
  margin: 0 0 16px 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.section-header {
  margin: 0 0 8px 0;
  color: var(--color-text-tertiary, #666);
  font-size: var(--font-size-sm);
  font-weight: 400;
  line-height: 1.4;
  text-align: left;
  opacity: 0.8;
}

/* Existing recipients section */
.existing-recipients {
  margin-bottom: 10px;
}

/* Recipient input container */
.recipient-input-container {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.input-wrapper {
  flex: 1;
  position: relative;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-input-bg, var(--color-surface));
  transition: all 0.2s ease;
}

.input-wrapper:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb, 79, 140, 255), 0.2);
}

.input-wrapper.valid {
  border-color: var(--color-success);
}

.input-wrapper.invalid {
  border-color: var(--color-error);
}

.input-wrapper.searching {
  border-color: var(--color-primary);
}

.recipient-input {
  width: 100%;
  padding: 12px 40px 12px 12px;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  outline: none;
}

.recipient-input::placeholder {
  color: var(--color-text-secondary);
}

/* Input indicators */
.search-indicator,
.valid-indicator,
.invalid-indicator {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.valid-indicator {
  color: var(--color-success);
  font-weight: bold;
}

.invalid-indicator {
  color: var(--color-error);
  font-weight: bold;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top: 2px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes quick-fade-out {
  0% { opacity: 1; }
  100% { opacity: 0; }
}

.spinner-small {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(220, 38, 38, 0.2);
  border-top: 2px solid var(--color-error);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Add recipient button */
.add-recipient-btn {
  padding: 12px 16px;
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.add-recipient-btn:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.add-recipient-btn:disabled {
  background-color: var(--color-border);
  color: var(--color-text-secondary);
  cursor: not-allowed;
  transform: none;
}

/* Search results */
.search-results-container {
  position: relative;
  margin-bottom: 16px;
}

.search-results-list {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  max-height: 200px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.search-result-item {
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
  transition: background-color 0.2s ease;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background-color: var(--color-hover-overlay);
}

.search-result-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.search-result-name {
  font-weight: 500;
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.search-result-tag {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.no-search-results {
  padding: 16px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-style: italic;
}

/* Recipients list */
.recipients-list {
  min-height: 60px;
}

.recipients-list.read-only .recipient-tag {
  background-color: var(--color-surface-light, var(--color-surface));
  border: 1px solid var(--color-border);
}

.recipient-tag {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  margin-bottom: 8px;
  transition: all 0.2s ease;
  background-color: var(--color-primary-light, rgba(var(--color-primary-rgb, 79, 140, 255), 0.05));
  border: 1px solid var(--color-primary-light, rgba(var(--color-primary-rgb, 79, 140, 255), 0.2));
}

.recipient-tag.original {
  background-color: var(--color-surface-light, var(--color-surface));
  border: 2px solid var(--color-primary-light, rgba(var(--color-primary-rgb, 79, 140, 255), 0.3));
}

.recipient-tag.original {
  background-color: var(--color-surface-light, var(--color-surface));
  border: 2px solid var(--color-primary-light, rgba(var(--color-primary-rgb, 79, 140, 255), 0.3));
}

.recipient-tag.existing {
  opacity: 0.8;
}

.recipient-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.recipient-name-line {
  display: flex;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recipient-name {
  font-weight: 500;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.recipient-tag-name {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  white-space: nowrap;
  flex-shrink: 0;
}

.recipient-metadata {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
}

.recipient-timestamp {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recipient-added-by {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recipient-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.visibility-toggle-btn {
  position: relative;
  background: var(--color-primary-light);
  border: 1px solid var(--color-border);
  cursor: pointer;
  padding: 0;
  border-radius: 12px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  width: 56px;
  height: 24px;
  overflow: hidden;
}

.visibility-toggle-btn:hover {
  border-color: var(--color-border-hover);
  background-color: var(--color-hover-overlay);
}

.visibility-emoji {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 14px;
  transition: opacity 0.2s ease;
}

.visible-emoji {
  left: 2px;
  opacity: 0.4;
}

.hidden-emoji {
  right: 2px;
  opacity: 0.1;
}

.visibility-slider {
  position: absolute;
  width: 20px;
  height: 20px;
  background-color: var(--color-primary-rgb);
  border-radius: 10px;
  transition: transform 0.2s ease;
  left: 2px;
  transform: translateX(0);
}

.visibility-slider.is-visible {
  transform: translateX(32px);
}

.visibility-toggle-btn.visible .visible-emoji {
  opacity: 1;
}

.visibility-toggle-btn.invisible .hidden-emoji {
  opacity: 1;
}

.visibility-indicators {
  display: flex;
  gap: 2px;
  align-items: center;
}

.visibility-indicator {
  font-size: 16px;
  opacity: 0.7;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 28px;
  cursor: default;
}

.visibility-indicator.visible {
  opacity: 0.8;
}

.visibility-indicator.hidden {
  opacity: 0.6;
}

.remove-recipient-btn {
  background: none;
  border: none;
  color: var(--color-error);
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-weight: bold;
  line-height: 1;
}

.remove-recipient-btn:hover:not(:disabled) {
  background-color: var(--color-error-light, rgba(220, 38, 38, 0.1));
}

.remove-recipient-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.remove-recipient-btn.removing {
  background-color: var(--color-error-light, rgba(220, 38, 38, 0.1));
}

.no-recipients {
  text-align: center;
  color: var(--color-text-secondary);
  font-style: italic;
  padding: 20px;
  font-size: var(--font-size-sm);
}

/* Section styling */
.existing-recipients-section,
.new-recipients-section {
  margin-bottom: 0;
}

.existing-recipients-section {
  background-color: var(--color-background-light);
  border-radius: var(--radius-md);
  padding: 8px;
}

.search-and-add-section {
  padding: 8px;
}

.new-recipients-section {
  margin-top: 20px;
}

  /* New recipient styling */
  .recipient-tag.new-recipient {
    background-color: var(--color-primary-light, rgba(var(--color-primary-rgb, 79, 140, 255), 0.05));
    border: 1px solid var(--color-primary-light, rgba(var(--color-primary-rgb, 79, 140, 255), 0.2));
  }

  .recipient-tag.existing-recipient,
.recipient-tag.new-recipient {
  opacity: 0.7;
}

/* Add styles for guest message */
.guest-message {
  text-align: center;
  color: var(--color-text-secondary);
  font-style: italic;
  padding: 12px;
  background-color: var(--color-surface-light);
  border-radius: var(--radius-md);
  margin-bottom: 16px;
  font-size: var(--font-size-sm);
}

/* Modal footer */
.modal-footer {
  padding: 16px 24px 20px;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.descendants-toggle-container {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}

.descendants-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: var(--font-size-sm);
}

.descendants-toggle input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.descendants-toggle-text {
  color: var(--color-text);
  font-weight: 500;
}

.descendants-toggle-hint {
  color: var(--color-text-secondary);
  font-size: 14px;
  cursor: help;
  opacity: 0.7;
}

.descendants-toggle-hint:hover {
  opacity: 1;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
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

.done-button {
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

.done-button:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.done-button:disabled {
  background-color: var(--color-border);
  color: var(--color-text-secondary);
  cursor: not-allowed;
  transform: none;
}

.button-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}

.cancel-button {
  padding: 10px 20px;
  background-color: var(--color-border);
  color: var(--color-text);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-button:hover:not(:disabled) {
  background-color: var(--color-hover-overlay);
}

.cancel-button:disabled {
  background-color: var(--color-border);
  color: var(--color-text-secondary);
  cursor: not-allowed;
  transform: none;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .modal-overlay {
    padding: 10px;
  }
  
  .recipient-modal {
    min-width: unset;
    max-height: 90vh;
  }
  
  .modal-header {
    padding: 16px 20px 12px;
  }
  
  .modal-header h3 {
    font-size: var(--font-size-md);
  }
  
  .modal-content {
    padding: 16px 20px;
  }
  
  .modal-footer {
    padding: 12px 20px 16px;
  }
  
  .recipient-input-container {
    flex-direction: column;
    gap: 12px;
  }
  
  .add-recipient-btn {
    width: 100%;
  }
  
  .chatbots-section {
    margin-bottom: 12px;
  }
  
  .chatbots-list {
    flex-direction: column;
    gap: 8px;
  }
  
  .chatbot-card {
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    margin-bottom: 4px;
  }
  
  .chatbot-card.chatbot-selected {
    background-color: var(--color-primary-light);
    border: 1px solid var(--color-primary);
  }
  
  .chatbot-info {
    flex-direction: column;
    gap: 2px;
  }
  
  .chatbot-name {
    font-size: var(--font-size-sm);
  }
  
  .chatbot-tag {
    font-size: var(--font-size-xs);
  }
}

/* Chatbots section */
.chatbots-section {
  margin-bottom: 16px;
}

.chatbots-header {
  margin: 0 0 8px 0;
  color: var(--color-text-tertiary, #666);
  font-size: var(--font-size-sm);
  font-weight: 400;
  line-height: 1.4;
  text-align: left;
  opacity: 0.8;
}

.chatbots-list {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
}

.chatbot-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: var(--color-surface);
  min-width: 120px;
}

.chatbot-card:hover {
  background-color: var(--color-hover-overlay);
  border-color: var(--color-border-hover);
}

.chatbot-card.chatbot-selected {
  background-color: var(--color-primary-light);
  border-color: var(--color-primary);
}

.chatbot-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.chatbot-name {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
}

.chatbot-tag {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.chatbot-toggle {
  display: flex;
  align-items: center;
  margin-left: 8px;
}

.chatbot-toggle input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  position: relative;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  border: 2px solid var(--color-border);
  border-radius: 3px;
  background-color: var(--color-surface);
  transition: all 0.2s ease;
  margin: 0;
  padding: 0;
  outline: none;
}

.chatbot-toggle input[type="checkbox"]:checked {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

.chatbot-toggle input[type="checkbox"]:checked::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: rgb(0, 0, 0);
  font-size: 12px;
  font-weight: bold;
  line-height: 1;
  display: block;
}

.chatbot-toggle input[type="checkbox"]:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Advanced chatbots dropdown styles */
.advanced-chatbots {
  margin-top: 8px;
}

.advanced-toggle-inline {
  display: inline-block;
}

.advanced-toggle-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0.7;
}

.advanced-toggle-button:hover {
  background-color: var(--color-hover-overlay);
  border-radius: var(--radius-sm);
  opacity: 1;
}

.advanced-toggle-text {
  font-weight: 400;
}

.advanced-toggle-icon {
  font-size: 9px;
  transition: transform 0.2s ease;
}

.advanced-toggle-icon.expanded {
  transform: rotate(180deg);
}

.advanced-chatbots-list {
  margin-top: 6px;
  padding-left: 0;
}

.advanced-chatbot-card {
  margin-bottom: 6px;
  opacity: 0.8;
  transform: scale(0.95);
}

.advanced-chatbot-card:last-child {
  margin-bottom: 0;
}

/* Remove confirmation dialog */
.remove-confirm-overlay {
  z-index: 1002; /* Above the main modal */
}

.remove-confirm-modal {
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 0;
  min-width: 400px;
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}

.remove-confirm-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.remove-confirm-header h4 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
}

.remove-confirm-content {
  padding: 20px 24px;
  flex: 1;
}

.remove-confirm-content p {
  margin: 0 0 20px 0;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.remove-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.remove-option-btn {
  padding: 12px 16px;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.remove-option-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  background-color: var(--color-primary-light, rgba(var(--color-primary-rgb, 79, 140, 255), 0.05));
}

.remove-option-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.remove-option-btn.removing {
  border-color: var(--color-primary);
  background-color: var(--color-primary-light, rgba(var(--color-primary-rgb, 79, 140, 255), 0.1));
}

.remove-option-btn .button-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}

.remove-option-btn.remove-single {
  border-color: var(--color-warning, #f59e0b);
}

.remove-option-btn.remove-single:hover:not(:disabled) {
  border-color: var(--color-warning, #f59e0b);
  background-color: rgba(245, 158, 11, 0.1);
}

.remove-option-btn.remove-descendants {
  border-color: var(--color-error);
}

.remove-option-btn.remove-descendants:hover:not(:disabled) {
  border-color: var(--color-error);
  background-color: var(--color-error-light, rgba(220, 38, 38, 0.1));
}

.remove-confirm-footer {
  padding: 12px 24px 20px;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.cancel-remove-btn {
  padding: 10px 20px;
  background-color: var(--color-border);
  color: var(--color-text);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-remove-btn:hover:not(:disabled) {
  background-color: var(--color-hover-overlay);
}

.cancel-remove-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .remove-confirm-modal {
    min-width: unset;
    max-width: 90vw;
  }
  
  .descendants-toggle-container {
    margin-bottom: 8px;
    padding-bottom: 8px;
  }
  
  .modal-actions {
    flex-direction: column;
    gap: 8px;
  }
  
  .add-button, .cancel-button {
    width: 100%;
  }
}
</style>