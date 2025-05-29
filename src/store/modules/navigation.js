export default {
  namespaced: true,
  
  state: {
    replyingToMessageId: null,
    isLoadingReplyMessage: false,
    isReplying: false,
    previousRoute: '/cloud', // Default to cloud as fallback
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
      state.previousRoute = route;
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
      commit('SET_PREVIOUS_ROUTE', route);
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
      const isCurrentUserAuthor = currentUser && 
                                message.content_author === currentUser.uid;
      
      // 4. Always add the original author 
      // (include current user only if they authored the message being replied to)
      if (message.content_author) {
        if (isCurrentUserAuthor || message.content_author !== currentUser?.uid) {
          const authorInfo = {
            uid: message.content_author,
            display_name: message.author_display_name || message.author_user_tag || message.content_author,
            user_tag: message.author_user_tag
          };
          newRecipients.push(authorInfo);
          addedUids.add(message.content_author);
        }
      }
      
      // 5. Add all recipients from the parent
      // (include current user only if they authored the message being replied to)
      if (message.recipients && Array.isArray(message.recipients)) {
        message.recipients.forEach(recipient => {
          const recipientUid = recipient.uid;
          // Skip if this recipient is already added
          // or is the current user (unless current user is the author)
          if (!recipientUid || 
              addedUids.has(recipientUid) || 
              (!isCurrentUserAuthor && currentUser && recipientUid === currentUser.uid)) {
            return;
          }
          
          newRecipients.push({
            uid: recipientUid,
            display_name: recipient.display_name || recipient.user_tag || recipientUid,
            user_tag: recipient.user_tag
          });
          addedUids.add(recipientUid);
        });
      }
      
      // 6. Set the full list of compiled recipients
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
    
    previousRoute: state => state.previousRoute
  }
}
