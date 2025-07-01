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
    
    CLEAR_REPLY_RECIPIENTS(state) {
      state.replySettings.recipients = [];
    }
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
    }
  },
  
  getters: {
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
    
    activeTab: state => state.activeTab
  }
}
