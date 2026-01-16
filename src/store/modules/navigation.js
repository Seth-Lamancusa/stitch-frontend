const TAG_PATTERN = /^[A-Za-z0-9-]{1,32}$/;
const MAX_DRAFT_TAGS = 20;

function normalizeTagValue(tag) {
  if (typeof tag !== 'string') return null;
  const trimmed = tag.trim().toLowerCase();
  if (!trimmed || trimmed.length > 32) return null;
  if (!TAG_PATTERN.test(trimmed)) return null;
  return trimmed;
}

function normalizeTagList(tags) {
  if (!Array.isArray(tags)) return [];
  const normalized = [];
  const seen = new Set();
  for (const tag of tags) {
    const normalizedTag = normalizeTagValue(typeof tag === 'string' ? tag : tag?.name);
    if (!normalizedTag) continue;
    if (seen.has(normalizedTag)) continue;
    normalized.push(normalizedTag);
    seen.add(normalizedTag);
    if (normalized.length >= MAX_DRAFT_TAGS) break;
  }
  return normalized;
}

export default {
  namespaced: true,
  
  state: {
    replyingToMessageId: null,
    isLoadingReplyMessage: false,
    isReplying: false,
    previousRoute: '/history', // Default to history as fallback
    activeTab: 'history', // Track which navigation tab is active
    // List scroll position per tab (for restoring when navigating back)
    listScrollPositions: {}, // { 'inbox': 150, 'public': 0, ... }
    // Cached list state per tab (messages, pagination) for preserving across navigation
    listCache: {}, // { 'public': { messages: [...], currentSkip: 30, isAllLoaded: false }, ... }
    replySettings: {
      isPublic: true,
      recipients: [],  // Recipients for new message drafts
      addToAncestors: true, // Default: add staged recipients to all ancestors when sending
      tags: [], // Draft tags staged for the pending reply
      channel_ids: [], // Channel IDs inherited from parent message (matching bot service logic)
    },
    // Separate state for add mode recipients
    addModeRecipients: [], // Recipients being staged for adding to existing message
    // Global state for mobile floating action bars
    activeActionBarMessageId: null, // Only one action bar can be open at a time
    // Selection mode state
    selectionMode: false,
    selectedMessageIds: [],
    // Add recipients mode state
    addRecipientsMode: false,
    addRecipientsMessageId: null,
    addRecipientsExisting: [],
    // Global recipients modal state
    recipientsModal: {
      isVisible: false,
      isPublic: true,
      isAddMode: false,
      existingRecipients: [],
      messageId: null
    },
    recipientsModalConfig: null, // Holds { isPublic, isAddMode, existingRecipients, messageId }
    linksModalVisible: false,
    messageForLinks: null,
    // Global Speed Dial modal state
    speedDialModalVisible: false,
    speedDialTargetMessageId: null,
    // Refresh trigger for message lists
    refreshTrigger: 0, // Timestamp that increments when refresh is requested
  },
  
  mutations: {
    SET_REPLYING_TO_MESSAGE(state, id) {
      state.replyingToMessageId = id;
      // When setting a message to reply to, automatically set isReplying to true
      // when id is valid, or false when id is null
      state.isReplying = !!id;
    },
    
    SET_REPLY_MESSAGE_LOADING(state, loading) {
      state.isLoadingReplyMessage = loading;
    },
    
    SET_REPLYING(state, isReplying) {
      state.isReplying = isReplying;
    },
    
    SET_PREVIOUS_ROUTE(state, route) {
      state.previousRoute = route;
    },
    
    SET_ACTIVE_TAB(state, tab) {
      state.activeTab = tab;
    },
    
    SET_LIST_SCROLL_POSITION(state, { tab, position }) {
      state.listScrollPositions[tab] = position;
    },
    
    CLEAR_LIST_SCROLL_POSITION(state, tab) {
      delete state.listScrollPositions[tab];
    },
    
    SET_LIST_CACHE(state, { tab, messages, currentSkip, isAllLoaded }) {
      state.listCache[tab] = { messages, currentSkip, isAllLoaded };
    },
    
    CLEAR_LIST_CACHE(state, tab) {
      if (tab) {
        delete state.listCache[tab];
      } else {
        state.listCache = {};
      }
    },
    
    SET_REPLY_PUBLIC(state, isPublic) {
      state.replySettings.isPublic = isPublic;
    },

    SET_REPLY_ADD_TO_ANCESTORS(state, value) {
      state.replySettings.addToAncestors = !!value;
    },
    
    SET_REPLY_RECIPIENTS(state, recipients) {
      state.replySettings.recipients = recipients;
    },
    
    SET_REPLY_TAGS(state, tags) {
      state.replySettings.tags = normalizeTagList(tags);
    },
    
    ADD_REPLY_TAG(state, tag) {
      const normalized = normalizeTagValue(tag);
      if (!normalized) return;
      if (state.replySettings.tags.includes(normalized)) return;
      if (state.replySettings.tags.length >= MAX_DRAFT_TAGS) return;
      state.replySettings.tags = [...state.replySettings.tags, normalized];
    },
    
    REMOVE_REPLY_TAG(state, tag) {
      if (!tag) return;
      const normalized = tag.toLowerCase();
      state.replySettings.tags = state.replySettings.tags.filter(t => t !== normalized);
    },
    
    CLEAR_REPLY_TAGS(state) {
      state.replySettings.tags = [];
    },
    
    SET_REPLY_CHANNEL_IDS(state, channelIds) {
      state.replySettings.channel_ids = Array.isArray(channelIds) ? channelIds : [];
    },
    
    CLEAR_REPLY_CHANNEL_IDS(state) {
      state.replySettings.channel_ids = [];
    },
    
    ADD_REPLY_RECIPIENT(state, recipient) {
      // Check if recipient already exists by UID
      const exists = state.replySettings.recipients.some(r => r.uid === recipient.uid);
      if (!exists) {
        // Mark as new/staged recipient with default notify=true
        state.replySettings.recipients.push({ 
          ...recipient, 
          isNew: true, 
          isExisting: false,
          notify: recipient.notify !== undefined ? recipient.notify : true
        });
      }
    },
    
    REMOVE_REPLY_RECIPIENT(state, index) {
      state.replySettings.recipients.splice(index, 1);
    },
    
    TOGGLE_REPLY_RECIPIENT_VISIBILITY(state, index) {
      if (state.replySettings.recipients[index]) {
        const recipient = state.replySettings.recipients[index];
        const next = recipient.public !== false ? false : true;
        recipient.public = next;
      }
    },
    
    TOGGLE_REPLY_RECIPIENT_NOTIFY(state, index) {
      if (state.replySettings.recipients[index]) {
        const recipient = state.replySettings.recipients[index];
        // Toggle notify flag (default to true if not set)
        recipient.notify = recipient.notify !== undefined ? !recipient.notify : false;
      }
    },
    
    CLEAR_REPLY_RECIPIENTS(state) {
      state.replySettings.recipients = [];
    },
    
    // Add mode recipient mutations
    SET_ADD_MODE_RECIPIENTS(state, recipients) {
      state.addModeRecipients = recipients;
    },
    
    ADD_ADD_MODE_RECIPIENT(state, recipient) {
      // Check if recipient already exists by UID
      const exists = state.addModeRecipients.some(r => r.uid === recipient.uid);
      if (!exists) {
        // Mark as new/staged recipient with default notify=true
        state.addModeRecipients.push({ 
          ...recipient, 
          isNew: true, 
          isExisting: false,
          notify: recipient.notify !== undefined ? recipient.notify : true
        });
      }
    },
    
    REMOVE_ADD_MODE_RECIPIENT(state, index) {
      state.addModeRecipients.splice(index, 1);
    },
    
    TOGGLE_ADD_MODE_RECIPIENT_VISIBILITY(state, index) {
      if (state.addModeRecipients[index]) {
        const recipient = state.addModeRecipients[index];
        const next = recipient.public !== false ? false : true;
        recipient.public = next;
      }
    },
    
    TOGGLE_ADD_MODE_RECIPIENT_NOTIFY(state, index) {
      if (state.addModeRecipients[index]) {
        const recipient = state.addModeRecipients[index];
        recipient.notify = !recipient.notify;
      }
    },
    
    CLEAR_ADD_MODE_RECIPIENTS(state) {
      state.addModeRecipients = [];
    },
    
    SET_ACTIVE_ACTION_BAR(state, messageId) {
      state.activeActionBarMessageId = messageId;
    },
    
    CLEAR_ACTIVE_ACTION_BAR(state) {
      state.activeActionBarMessageId = null;
    },
    
    // Selection mode mutations
    SET_SELECTION_MODE(state, enabled) {
      state.selectionMode = enabled;
      // Clear selected messages when exiting selection mode
      if (!enabled) {
        state.selectedMessageIds = [];
      }
    },
    
    ADD_SELECTED_MESSAGE(state, messageId) {
      if (!state.selectedMessageIds.includes(messageId)) {
        state.selectedMessageIds.push(messageId);
      }
    },
    
    REMOVE_SELECTED_MESSAGE(state, messageId) {
      const index = state.selectedMessageIds.indexOf(messageId);
      if (index !== -1) {
        state.selectedMessageIds.splice(index, 1);
      }
    },
    
    CLEAR_SELECTED_MESSAGES(state) {
      state.selectedMessageIds = [];
    },
    
    // Add recipients mode mutations
    SET_ADD_RECIPIENTS_MODE(state, { messageId, existingRecipients }) {
      state.addRecipientsMode = true;
      state.addRecipientsMessageId = messageId;
      state.addRecipientsExisting = existingRecipients;
    },
    
    CLEAR_ADD_RECIPIENTS_MODE(state) {
      state.addRecipientsMode = false;
      state.addRecipientsMessageId = null;
      state.addRecipientsExisting = [];
    },
    
    // Global recipients modal mutations
    SHOW_RECIPIENTS_MODAL(state, { isPublic, isAddMode, existingRecipients, messageId }) {
      state.recipientsModal.isVisible = true;
      state.recipientsModal.isPublic = isPublic;
      state.recipientsModal.isAddMode = isAddMode;
      state.recipientsModal.existingRecipients = existingRecipients;
      state.recipientsModal.messageId = messageId;
    },
    
    HIDE_RECIPIENTS_MODAL(state) {
      state.recipientsModal.isVisible = false;
      state.recipientsModal.isPublic = true;
      state.recipientsModal.isAddMode = false;
      state.recipientsModal.existingRecipients = [];
      state.recipientsModal.messageId = null;
    },
    SET_LINKS_MODAL_VISIBLE(state, visible) {
      state.linksModalVisible = visible;
    },
    SET_MESSAGE_FOR_LINKS(state, message) {
      state.messageForLinks = message;
    },
    // Global Speed Dial modal mutations
    SHOW_SPEED_DIAL_MODAL(state, { messageId }) {
      state.speedDialModalVisible = true;
      state.speedDialTargetMessageId = messageId;
    },
    HIDE_SPEED_DIAL_MODAL(state) {
      state.speedDialModalVisible = false;
      state.speedDialTargetMessageId = null;
    },
    TRIGGER_REFRESH(state) {
      state.refreshTrigger = Date.now();
    },
  },
  
  getters: {
    isAddRecipientsMode: (state) => state.addRecipientsMode,
    addRecipientsMessageId: (state) => state.addRecipientsMessageId,
    addRecipientsExisting: (state) => state.addRecipientsExisting,
    
    replyingToMessageId: state => state.replyingToMessageId,
    isReplying: state => state.isReplying,
    replyIsPublic: state => state.replySettings.isPublic,
    replyRecipients: state => state.replySettings.recipients,
    replyTags: state => state.replySettings.tags,
    replyChannelIds: state => state.replySettings.channel_ids || [],
    replyAddToAncestors: state => state.replySettings.addToAncestors,
    
    // Add mode recipients getters
    addModeRecipients: state => state.addModeRecipients,
    
    replyTargetId: state => state.replyingToMessageId,
    
    replyTargetAuthor: (state, getters, rootState, rootGetters) => {
      const messageId = state.replyingToMessageId;
      if (!messageId) return '';
      
      const message = rootGetters['messages/getMessage'](messageId);
      return message ? message.content_author : '';
    },
    
    isReplyMessageLoading: state => state.isLoadingReplyMessage,
    
    previousRoute: state => {
      return state.previousRoute;
    },
    
    activeTab: state => state.activeTab,
    
    // List scroll position getter
    getListScrollPosition: state => tab => state.listScrollPositions[tab] || 0,
    
    // List cache getter
    getListCache: state => tab => state.listCache[tab] || null,
    
    // Global action bar getters
    activeActionBarMessageId: state => state.activeActionBarMessageId,
    isActionBarOpen: state => messageId => state.activeActionBarMessageId === messageId,
    
    // Selection mode getters
    isSelectionMode: state => state.selectionMode,
    selectedMessageIds: state => state.selectedMessageIds,
    selectedMessageCount: state => state.selectedMessageIds.length,
    isMessageSelected: state => messageId => state.selectedMessageIds.includes(messageId),
    
    // Global recipients modal getters
    recipientsModalVisible: state => state.recipientsModal.isVisible,
    recipientsModalIsPublic: state => state.recipientsModal.isPublic,
    recipientsModalIsAddMode: state => state.recipientsModal.isAddMode,
    recipientsModalExistingRecipients: (state, getters, rootState, rootGetters) => {
      // Make this getter dynamic - always return current recipients from the message data
      const messageId = state.recipientsModal.messageId;
      
      if (!messageId) {
        return state.recipientsModal.existingRecipients;
      }
      
      const message = rootGetters['messages/getMessage'](messageId);
      const recipients = message && message.recipients ? message.recipients : state.recipientsModal.existingRecipients;
      return recipients;
    },
    recipientsModalMessageId: state => state.recipientsModal.messageId,
    linksModalVisible: (state) => state.linksModalVisible,
    messageForLinks: (state) => state.messageForLinks,
    // Speed Dial modal getters
    speedDialModalVisible: (state) => state.speedDialModalVisible,
    speedDialTargetMessageId: (state) => state.speedDialTargetMessageId,
    // Refresh trigger getter
    refreshTrigger: (state) => state.refreshTrigger,
  },
  
  actions: {
    setReplyingTo({ commit, dispatch }, messageId) {
      if (!messageId) {
        commit('SET_REPLYING_TO_MESSAGE', null);
        return;
      }
      
      commit('SET_REPLYING_TO_MESSAGE', messageId);
      
      dispatch('syncReplySettings', messageId);
    },
    
    resetReplySettings({ dispatch }, messageId) {
      dispatch('syncReplySettings', messageId);
    },
    
    toggleReply({ commit, state }, isReplying) {
      commit('SET_REPLYING', isReplying);
      
      // If toggling off replying, also clear the replying to message
      if (!isReplying && state.replyingToMessageId) {
        commit('SET_REPLYING_TO_MESSAGE', null);
      }
    },
    
    // Clear reply when scrolled too far or branch changed
    clearReplyingTo({ commit }) {
      commit('SET_REPLYING_TO_MESSAGE', null);
    },
    
    updateReplyVisibility({ commit }, isPublic) {
      commit('SET_REPLY_PUBLIC', isPublic);
    },

    updateReplyAddToAncestors({ commit }, value) {
      commit('SET_REPLY_ADD_TO_ANCESTORS', value);
    },
    
    // New unified action to update both visibility and recipients together
    setVisibilitySettings({ commit }, { isPublic, recipients }) {
      if (isPublic !== undefined) {
        commit('SET_REPLY_PUBLIC', isPublic);
      }
      if (recipients !== undefined) {
        commit('SET_REPLY_RECIPIENTS', recipients);
      }
    },
    
    // Reply recipient actions (for new messages)
    addRecipient({ commit, state }, recipient) {      
      // Check if we're in add mode or new message mode
      const isAddMode = state.recipientsModal.isAddMode;
      
      if (isAddMode) {
        commit('ADD_ADD_MODE_RECIPIENT', recipient);
      } else {
        commit('ADD_REPLY_RECIPIENT', recipient);
      }
    },
    
    removeRecipient({ commit, state }, index) {
      // Check if we're in add mode or new message mode
      const isAddMode = state.recipientsModal.isAddMode;
            
      if (isAddMode) {
        commit('REMOVE_ADD_MODE_RECIPIENT', index);
      } else {
        commit('REMOVE_REPLY_RECIPIENT', index);
      }
    },
    
    toggleRecipientVisibility({ commit, state }, index) {      
      // Check if we're in add mode or new message mode
      const isAddMode = state.recipientsModal.isAddMode;
      
      if (isAddMode) {
        commit('TOGGLE_ADD_MODE_RECIPIENT_VISIBILITY', index);
      } else {
        commit('TOGGLE_REPLY_RECIPIENT_VISIBILITY', index);
      }
    },
    
    toggleRecipientNotify({ commit, state }, index) {
      // Available in both add mode (staged recipients) and new message mode (draft recipients)
      const isAddMode = state.recipientsModal.isAddMode;
      
      if (isAddMode) {
        commit('TOGGLE_ADD_MODE_RECIPIENT_NOTIFY', index);
      } else {
        commit('TOGGLE_REPLY_RECIPIENT_NOTIFY', index);
      }
    },
    
    clearRecipients({ commit, state }) {
      // Check if we're in add mode or new message mode
      const isAddMode = state.recipientsModal.isAddMode;
      
      if (isAddMode) {
        commit('CLEAR_ADD_MODE_RECIPIENTS');
      } else {
        commit('CLEAR_REPLY_RECIPIENTS');
      }
    },
    
    setReplyTags({ commit }, tags) {
      commit('SET_REPLY_TAGS', tags);
    },
    
    addReplyTag({ commit }, tag) {
      commit('ADD_REPLY_TAG', tag);
    },
    
    removeReplyTag({ commit }, tag) {
      commit('REMOVE_REPLY_TAG', tag);
    },
    
    clearReplyTags({ commit }) {
      commit('CLEAR_REPLY_TAGS');
    },
    
    setPreviousRoute({ commit }, route) {
      commit('SET_PREVIOUS_ROUTE', route);
    },
    
    saveListScrollPosition({ commit }, { tab, position }) {
      commit('SET_LIST_SCROLL_POSITION', { tab, position });
    },
    
    clearListScrollPosition({ commit }, tab) {
      commit('CLEAR_LIST_SCROLL_POSITION', tab);
    },
    
    saveListCache({ commit }, { tab, messages, currentSkip, isAllLoaded }) {
      console.log(`[Navigation] Saving list cache for "${tab}" - ${messages?.length} messages`);
      commit('SET_LIST_CACHE', { tab, messages, currentSkip, isAllLoaded });
    },
    
    clearListCache({ commit }, tab) {
      console.log(`[Navigation] Clearing list cache${tab ? ` for "${tab}"` : ' (all)'}`);
      commit('CLEAR_LIST_CACHE', tab);
    },
    
    async setActiveTab({ commit, state, dispatch }, tab) {
      // Only clear caches if the tab is actually changing
      const previousTab = state.activeTab;
      const isTabChange = previousTab !== tab;
      
      // Set the tab immediately for responsive UI
      commit('SET_ACTIVE_TAB', tab);
     
      // Only clear caches when explicitly switching to a different tab
      if (isTabChange) {
        console.log(`[Navigation] Tab changed from "${previousTab}" to "${tab}" - clearing caches`);
        // Clear the list cache for all tabs when switching (so we get fresh data)
        commit('CLEAR_LIST_CACHE', null);
        
        // Clear message cache when switching tabs to trigger fresh load
        await dispatch('messages/clearCache', {}, { root: true });
      } else {
        console.log(`[Navigation] Tab "${tab}" re-activated (same tab) - preserving caches`);
      }
    },
    
    syncReplySettings({ commit, state, rootGetters, rootState }, messageId) {
      const targetId = messageId || state.replyingToMessageId;
      if (!targetId) return;
      
      const message = rootGetters['messages/getMessage'](targetId);
      if (!message) return;
      
      const currentUser = rootGetters['auth/user'];
      
      // Clear existing reply settings (will be repopulated from parent)
      commit('CLEAR_REPLY_RECIPIENTS');
      commit('CLEAR_REPLY_TAGS');
      commit('CLEAR_REPLY_CHANNEL_IDS');
      
      // 1. Set visibility to match parent message (inherited from parent)
      const isPublic = message.public === 1 || message.public === true;
      commit('SET_REPLY_PUBLIC', isPublic);
      
      // 2. Inherit tags from parent message (matching bot service logic)
      const parentTags = message.tags || [];
      const normalizedTags = parentTags.map(tag => {
        if (typeof tag === 'string') return tag;
        if (typeof tag === 'object' && tag?.name) return tag.name;
        return null;
      }).filter(tag => tag !== null);
      commit('SET_REPLY_TAGS', normalizedTags);
      
      // 3. Inherit channel_ids from parent message (matching bot service logic)
      const parentChannelIds = message.channel_ids || [];
      const normalizedChannelIds = parentChannelIds.map(ch => {
        if (typeof ch === 'string') return ch;
        if (typeof ch === 'number') return String(ch);
        return null;
      }).filter(ch => ch !== null);
      commit('SET_REPLY_CHANNEL_IDS', normalizedChannelIds);
      
      // 4. Build recipients list for new message based on parent
      // Matching bot service logic: original sender (including bots) + all recipients (bots included with notify: false, excluding current user)
      const newRecipients = [];
      const addedUids = new Set();
      const addedTags = new Set();
      
      // Track current user to exclude
      if (currentUser?.uid) {
        addedUids.add(currentUser.uid);
      }
      if (currentUser?.user_tag) {
        addedTags.add(currentUser.user_tag.toLowerCase());
      }
      
      // 5. Add the original sender (if not current user)
      // Include bots if they are the sender (don't filter them out)
      // This matches bot service: include_original_sender = True
      const authorUid = message.content_author || message.author?.uid;
      const authorTag = message.author_user_tag || message.author?.user_tag;
      const authorIsBot = message.author?.is_bot === true;
      
      if (authorUid) {
        // Check if not current user
        const isCurrentUser = currentUser && (
          authorUid === currentUser.uid ||
          (authorTag && currentUser.user_tag && authorTag.toLowerCase() === currentUser.user_tag.toLowerCase())
        );
        
        if (!isCurrentUser && !addedUids.has(authorUid)) {
          const authorRecipient = {
            uid: authorUid,
            display_name: message.author_display_name || message.author?.display_name,
            user_tag: authorTag,
            public: true,
            notify: true
          };
          newRecipients.push(authorRecipient);
          addedUids.add(authorUid);
          if (authorTag) {
            addedTags.add(authorTag.toLowerCase());
          }
        }
      }
      
      // 6. Add all recipients from the parent message (including bots with notify: false)
      // Bots that are recipients should be included but with notify: false
      // This matches bot service: include_original_recipients = True
      if (message.recipients && Array.isArray(message.recipients)) {
        message.recipients.forEach(recipient => {
          const recipientUid = recipient.uid;
          const recipientTag = recipient.user_tag;
          const recipientIsBot = recipient.is_bot === true;
          
          // Skip if:
          // - recipient is invalid
          // - recipient is already added
          // - recipient is current user
          // Note: Bots are NOT skipped - they are included with notify: false
          if (!recipientUid) return;
          if (addedUids.has(recipientUid)) return;
          if (currentUser && recipientUid === currentUser.uid) return;
          if (recipientTag && currentUser?.user_tag && 
              recipientTag.toLowerCase() === currentUser.user_tag.toLowerCase()) return;
          
          // Strip metadata when copying for new message staging
          // Only keep essential fields needed for staging
          // Bots that are recipients get notify: false
          const stagedRecipient = {
            uid: recipient.uid,
            display_name: recipient.display_name,
            user_tag: recipient.user_tag,
            // keep whatever backend provides; email may be absent
            email: recipient.email,
            public: (recipient.public !== false),
            // Bots that are recipients should not be notified
            notify: recipientIsBot ? false : (recipient.notify !== false)
          };
          newRecipients.push(stagedRecipient);
          addedUids.add(recipientUid);
          if (recipientTag) {
            addedTags.add(recipientTag.toLowerCase());
          }
        });
      }
      
      // 7. Set the final recipients list
      commit('SET_REPLY_RECIPIENTS', newRecipients);
    },
    
    // Global action bar management
    toggleActionBar({ commit, state }, messageId) {
      if (state.activeActionBarMessageId === messageId) {
        // Same message - close the action bar
        commit('CLEAR_ACTIVE_ACTION_BAR');
      } else {
        // Different message (or no current action bar) - open for this message
        commit('SET_ACTIVE_ACTION_BAR', messageId);
      }
    },
    
    closeActiveActionBar({ commit }) {
      commit('CLEAR_ACTIVE_ACTION_BAR');
    },
    
    showActionBar({ commit }, messageId) {
      commit('SET_ACTIVE_ACTION_BAR', messageId);
    },
    
    hideActionBar({ commit, state }, messageId) {
      // Only hide if this is the currently active action bar
      if (messageId && state.activeActionBarMessageId === messageId) {
        commit('CLEAR_ACTIVE_ACTION_BAR');
      } else if (!messageId) {
        // No specific message - clear any active action bar
        commit('CLEAR_ACTIVE_ACTION_BAR');
      }
    },
    
    // Refresh message list action
    triggerRefresh({ commit }) {
      commit('TRIGGER_REFRESH');
    },
    
    // Selection mode actions
    toggleMessageSelection({ commit, state }, messageId) {
      if (state.selectedMessageIds.includes(messageId)) {
        // Remove from selection
        commit('REMOVE_SELECTED_MESSAGE', messageId);
        
        // If no messages left selected, exit selection mode
        if (state.selectedMessageIds.length === 0) {
          commit('SET_SELECTION_MODE', false);
        }
      } else {
        // Add to selection
        commit('ADD_SELECTED_MESSAGE', messageId);
        
        // If this is the first selection, enter selection mode
        if (!state.selectionMode) {
          commit('SET_SELECTION_MODE', true);
        }
      }
    },
    
    exitSelectionMode({ commit }) {
      commit('SET_SELECTION_MODE', false);
    },
    
    clearSelectedMessages({ commit }) {
      commit('CLEAR_SELECTED_MESSAGES');
    },
    
    // Add recipients mode actions
    enterAddRecipientsMode({ commit }, { messageId, existingRecipients }) {
      commit('SET_ADD_RECIPIENTS_MODE', { messageId, existingRecipients });
    },
    
    clearAddRecipientsMode({ commit }) {
      commit('CLEAR_ADD_RECIPIENTS_MODE');
    },
    
    // Global recipients modal actions
    showRecipientsModal({ commit }, { isPublic, isAddMode, existingRecipients, messageId }) {
      commit('SHOW_RECIPIENTS_MODAL', { isPublic, isAddMode, existingRecipients, messageId });
    },
    
    hideRecipientsModal({ commit }) {
      commit('HIDE_RECIPIENTS_MODAL');
    },
    showLinksModal({ commit }, message) {
      commit('SET_MESSAGE_FOR_LINKS', message);
      commit('SET_LINKS_MODAL_VISIBLE', true);
    },
    hideLinksModal({ commit }) {
      commit('SET_LINKS_MODAL_VISIBLE', false);
      commit('SET_MESSAGE_FOR_LINKS', null);
    },
    // Speed Dial modal actions
    showSpeedDialModal({ commit }, { messageId }) {
      commit('SHOW_SPEED_DIAL_MODAL', { messageId });
    },
    hideSpeedDialModal({ commit }) {
      commit('HIDE_SPEED_DIAL_MODAL');
    },
  }
};



