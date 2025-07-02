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
      recipients: []  // Will now store objects with {uid, display_name, user_tag} instead of strings
    },
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
      messageId: null,
      isRecipientRemovalDisabled: false
    }
  },
  
  mutations: {
    SET_REPLYING_TO_MESSAGE(state, id) {
      state.replyingToMessageId = id;
      // When setting a message to reply to, automatically set isReplying to true
      // when id is valid, or false when id is null
      state.isReplying = !!id;
    },
    
    SET_REPLY_MESSAGE_LOADING(state, isLoading) {
      state.isLoadingReplyMessage = isLoading;
    },
    
    SET_REPLYING(state, isReplying) {
      state.isReplying = isReplying;
      // Clear replyingToMessageId if not replying
      if (!isReplying) {
        state.replyingToMessageId = null;
      }
    },
    
    SET_PREVIOUS_ROUTE(state, route) {
      console.log(`[Navigation Store] SET_PREVIOUS_ROUTE mutation - storing: "${route}"`);
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
        state.replySettings.recipients.push(recipient);
      }
    },
    
    REMOVE_REPLY_RECIPIENT(state, index) {
      state.replySettings.recipients.splice(index, 1);
    },
    
    TOGGLE_RECIPIENT_VISIBILITY(state, index) {
      if (state.replySettings.recipients[index]) {
        const recipient = state.replySettings.recipients[index];
        recipient.visible = recipient.visible !== false ? false : true;
      }
    },
    
    CLEAR_REPLY_RECIPIENTS(state) {
      state.replySettings.recipients = [];
    },
    
    SET_ACTIVE_ACTION_BAR(state, messageId) {
      state.activeActionBarMessageId = messageId;
    },
    
    CLEAR_ACTIVE_ACTION_BAR(state) {
      state.activeActionBarMessageId = null;
    },
    
    // Selection mode mutations
    SET_SELECTION_MODE(state, isActive) {
      state.selectionMode = isActive;
      // Clear selected messages when exiting selection mode
      if (!isActive) {
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
    
    SET_ADD_RECIPIENTS_MODE(state, { messageId, existingRecipients }) {
      state.addRecipientsMode = true;
      state.addRecipientsMessageId = messageId;
      state.addRecipientsExisting = existingRecipients || [];
      // Also activate replying mode to show the ReplyBox
      state.isReplying = true;
      state.replyingToMessageId = messageId;
    },
    
    CLEAR_ADD_RECIPIENTS_MODE(state) {
      state.addRecipientsMode = false;
      state.addRecipientsMessageId = null;
      state.addRecipientsExisting = [];
    },
    
    // Global recipients modal mutations
    SHOW_RECIPIENTS_MODAL(state, { isPublic, isAddMode, existingRecipients, messageId, isRecipientRemovalDisabled }) {
      state.recipientsModal.isVisible = true;
      state.recipientsModal.isPublic = isPublic !== undefined ? isPublic : true;
      state.recipientsModal.isAddMode = isAddMode !== undefined ? isAddMode : false;
      state.recipientsModal.existingRecipients = existingRecipients || [];
      state.recipientsModal.messageId = messageId || null;
      state.recipientsModal.isRecipientRemovalDisabled = isRecipientRemovalDisabled !== undefined ? isRecipientRemovalDisabled : false;
    },
    
    HIDE_RECIPIENTS_MODAL(state) {
      state.recipientsModal.isVisible = false;
      state.recipientsModal.isPublic = true;
      state.recipientsModal.isAddMode = false;
      state.recipientsModal.existingRecipients = [];
      state.recipientsModal.messageId = null;
      state.recipientsModal.isRecipientRemovalDisabled = false;
    }
  },
  
  getters: {
    isAddRecipientsMode: (state) => state.addRecipientsMode,
    addRecipientsMessageId: (state) => state.addRecipientsMessageId,
    addRecipientsExisting: (state) => state.addRecipientsExisting,
    
    replyingToMessageId: state => state.replyingToMessageId,
    isReplying: state => state.isReplying,
    replyIsPublic: state => state.replySettings.isPublic,
    replyRecipients: state => state.replySettings.recipients,
    
    replyTargetId: state => state.replyingToMessageId,
    
    replyTargetAuthor: (state, getters, rootState, rootGetters) => {
      const messageId = state.replyingToMessageId;
      if (!messageId) return '';
      
      const message = rootGetters['messages/getMessage'](messageId);
      return message ? message.content_author : '';
    },
    
    isReplyMessageLoading: state => state.isLoadingReplyMessage,
    
    previousRoute: state => {
      console.log(`[Navigation Store] Getting previous route: "${state.previousRoute}"`);
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
    recipientsModalExistingRecipients: state => state.recipientsModal.existingRecipients,
    recipientsModalMessageId: state => state.recipientsModal.messageId,
    recipientsModalIsRecipientRemovalDisabled: state => state.recipientsModal.isRecipientRemovalDisabled
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
    
    addRecipient({ commit, state }, recipient) {
      // Convert string recipients to objects if needed (for backward compatibility)
      let recipientObject = recipient;
      
      if (typeof recipient === 'string') {
        // Create a basic recipient object
        // Note: In practice, this should be looked up from users
        recipientObject = {
          uid: recipient, // Temporary, will be replaced when sent to server
          display_name: recipient,
          user_tag: recipient
        };
      }
      
      commit('ADD_REPLY_RECIPIENT', recipientObject);
      return true;
    },
    
    removeRecipient({ commit }, index) {
      commit('REMOVE_REPLY_RECIPIENT', index);
    },
    
    toggleRecipientVisibility({ commit }, index) {
      commit('TOGGLE_RECIPIENT_VISIBILITY', index);
    },
    
    setPreviousRoute({ commit }, route) {
      console.log(`[Navigation Store] Setting previous route to: "${route}"`);
      commit('SET_PREVIOUS_ROUTE', route);
    },
    
    async setActiveTab({ commit, dispatch }, tab) {
      console.log(`[Navigation Store] Setting active tab to: "${tab}"`);
      commit('SET_ACTIVE_TAB', tab);
      // Clear message cache when switching tabs to trigger fresh load
      console.log('[Navigation Store] Clearing message cache for tab switch');
      await dispatch('messages/clearCache', {}, { root: true });
      console.log('[Navigation Store] Message cache cleared');
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
      
      // 3. Get unique recipients from the parent message
      const newRecipients = [];
      const addedUids = new Set();
      
      // Check if current user is the author of the message being replied to
      const isCurrentUserAuthor = currentUser && (
        message.content_author === currentUser.uid
      );
      
      // 4. Add the original author only if it's not the current user
      if (message.content_author && !isCurrentUserAuthor) {
        const authorInfo = {
          uid: message.content_author,
          display_name: message.author_display_name || message.author_user_tag || message.content_author,
          user_tag: message.author_user_tag
        };
        newRecipients.push(authorInfo);
        addedUids.add(message.content_author);
      }
      
      // 5. Add all recipients from the parent message except current user
      if (message.recipients && Array.isArray(message.recipients)) {
        message.recipients.forEach(recipient => {
          const recipientUid = recipient.uid;
          // Skip if:
          // - recipient is invalid
          // - recipient is already added
          // - recipient is the current user
          if (!recipientUid || 
              addedUids.has(recipientUid) || 
              (currentUser && (
                recipientUid === currentUser.uid ||
                recipient.user_tag === currentUser.user_tag ||
                recipient.email === currentUser.email
              ))) {
            return;
          }
          
          newRecipients.push(recipient);
          addedUids.add(recipientUid);
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
    
    setAddRecipientsMode({ commit, dispatch }, { messageId, existingRecipients }) {
      commit('SET_ADD_RECIPIENTS_MODE', { messageId, existingRecipients });
      // Clear existing recipients and set to add-only mode
      commit('CLEAR_REPLY_RECIPIENTS');
    },
    
    clearAddRecipientsMode({ commit }) {
      commit('CLEAR_ADD_RECIPIENTS_MODE');
      commit('SET_REPLYING', false);
    },
    
    // Global recipients modal actions
    showRecipientsModal({ commit }, modalConfig) {
      commit('SHOW_RECIPIENTS_MODAL', modalConfig);
    },
    
    hideRecipientsModal({ commit }) {
      commit('HIDE_RECIPIENTS_MODAL');
    }
  }
};
