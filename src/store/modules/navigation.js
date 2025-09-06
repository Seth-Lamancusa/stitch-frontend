export default {
  namespaced: true,
  
  state: {
    replyingToMessageId: null,
    isLoadingReplyMessage: false,
    isReplying: false,
    previousRoute: '/public', // Default to public as fallback
    activeTab: 'public', // Track which navigation tab is active
    replySettings: {
      isPublic: true,
      recipients: []  // Recipients for new message drafts
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
    editMessageModalVisible: false,
    messageToEdit: null,
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
    
    SET_REPLY_PUBLIC(state, isPublic) {
      state.replySettings.isPublic = isPublic;
    },
    
    SET_REPLY_RECIPIENTS(state, recipients) {
      state.replySettings.recipients = recipients;
    },
    
    ADD_REPLY_RECIPIENT(state, recipient) {
      // Check if recipient already exists by UID
      const exists = state.replySettings.recipients.some(r => r.uid === recipient.uid);
      if (!exists) {
        // Mark as new/staged recipient
        state.replySettings.recipients.push({ ...recipient, isNew: true, isExisting: false });
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
        // Mark as new/staged recipient
        state.addModeRecipients.push({ ...recipient, isNew: true, isExisting: false });
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
    SET_EDIT_MESSAGE_MODAL_VISIBLE(state, visible) {
      state.editMessageModalVisible = visible;
    },
    SET_MESSAGE_TO_EDIT(state, message) {
      state.messageToEdit = message;
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
    editMessageModalVisible: (state) => state.editMessageModalVisible,
    messageToEdit: (state) => state.messageToEdit,
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
    
    clearRecipients({ commit, state }) {
      // Check if we're in add mode or new message mode
      const isAddMode = state.recipientsModal.isAddMode;
      
      if (isAddMode) {
        commit('CLEAR_ADD_MODE_RECIPIENTS');
      } else {
        commit('CLEAR_REPLY_RECIPIENTS');
      }
    },
    
    setPreviousRoute({ commit }, route) {
      commit('SET_PREVIOUS_ROUTE', route);
    },
    
    async setActiveTab({ commit, dispatch }, tab) {
      // Set the tab immediately for responsive UI
      commit('SET_ACTIVE_TAB', tab);
     
      // Clear message cache when switching tabs to trigger fresh load
      await dispatch('messages/clearCache', {}, { root: true });
    },
    
    syncReplySettings({ commit, state, rootGetters, rootState }, messageId) {
      const targetId = messageId || state.replyingToMessageId;
      if (!targetId) return;
      
      const message = rootGetters['messages/getMessage'](targetId);
      if (!message) return;
      
      const currentUser = rootGetters['auth/user'];
      
      // 1. Set visibility to match parent message
      const isPublic = message.public === 1 || message.public === true;
      commit('SET_REPLY_PUBLIC', isPublic);
      
      // 2. Start with empty recipients
      commit('CLEAR_REPLY_RECIPIENTS');
      
      // 3. Build recipients list for new message based on parent
      const newRecipients = [];
      const addedUids = new Set();
      
      // Check if current user is the author of the message being replied to
      const isCurrentUserAuthor = currentUser && (
        message.content_author === currentUser.uid
      );
      
      // 4. Add the author of the message being replied to (if not current user)
      if (!isCurrentUserAuthor) {
        const authorRecipient = {
          uid: message.content_author,
          display_name: message.author_display_name,
          user_tag: message.author_user_tag
        };
        newRecipients.push(authorRecipient);
        addedUids.add(message.content_author);
      }
      
      // 5. Add all recipients from the parent message except current user
      if (message.recipients && Array.isArray(message.recipients)) {
        message.recipients.forEach(recipient => {
          const recipientUid = recipient.uid;
          // Skip if:
          // - recipient is invalid
          // - recipient is already added
          // - recipient is current user
          if (recipientUid && 
              !addedUids.has(recipientUid) && 
              (!currentUser || recipientUid !== currentUser.uid)) {
            // Strip metadata when copying for new message staging
            // Only keep essential fields needed for staging
            const stagedRecipient = {
              uid: recipient.uid,
              display_name: recipient.display_name,
              user_tag: recipient.user_tag,
              // keep whatever backend provides; email may be absent
              email: recipient.email,
              public: (recipient.public !== false)
            };
            newRecipients.push(stagedRecipient);
            addedUids.add(recipientUid);
          }
        });
      }
      
      // 6. Set the final recipients list
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
    showEditMessageModal({ commit }, message) {
      commit('SET_MESSAGE_TO_EDIT', message);
      commit('SET_EDIT_MESSAGE_MODAL_VISIBLE', true);
    },
    hideEditMessageModal({ commit }) {
      commit('SET_EDIT_MESSAGE_MODAL_VISIBLE', false);
      commit('SET_MESSAGE_TO_EDIT', null);
    },
  }
};



