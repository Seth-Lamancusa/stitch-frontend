export default {
  namespaced: true,
  
  state: {
    replyingToMessageId: null,
    isLoadingReplyMessage: false,
    isReplying: false,
    previousRoute: '/feed', // Default to feed as fallback
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
      
      dispatch('resetReplySettings', messageId);
    },
    
    resetReplySettings({ commit, state, rootGetters }, messageId) {
      commit('SET_REPLY_PUBLIC', true);
      commit('CLEAR_REPLY_RECIPIENTS');
      
      if (messageId) {
        const message = rootGetters['messages/getMessage'](messageId);
        if (message) {
          // Add message author as recipient
          if (message.author_user_tag && message.content_author) {
            // Create a recipient object with the available info
            const authorRecipient = {
              uid: message.content_author,
              display_name: message.author_display_name || message.author_user_tag,
              user_tag: message.author_user_tag
            };
            commit('ADD_REPLY_RECIPIENT', authorRecipient);
          }
        }
      }
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
    
    // Sync reply settings with a message
    syncReplySettingsWithSelectedMessage({ commit, state, rootGetters }) {
      if (!state.replyingToMessageId) return;
      
      const message = rootGetters['messages/getMessage'](state.replyingToMessageId);
      if (message) {
        // Copy settings from the message
        const isPublic = message.public === 1 || message.public === true;
        commit('SET_REPLY_PUBLIC', isPublic);
      }
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
