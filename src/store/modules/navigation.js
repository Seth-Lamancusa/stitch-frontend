export default {
  namespaced: true,
  
  state: {
    selectedMessageId: null,
    isReplying: false,
    replySettings: {
      isPublic: true,
      recipients: []
    },
    // Track which child is currently visible for each parent
    currentChildren: {},
    // Track if selected message is still loading
    isSelectedMessageLoading: false
  },
  
  mutations: {
    SET_SELECTED_MESSAGE(state, messageId) {
      state.selectedMessageId = messageId;
    },
    
    SET_SELECTED_MESSAGE_LOADING(state, isLoading) {
      state.isSelectedMessageLoading = isLoading;
    },
    
    SET_REPLYING(state, isReplying) {
      state.isReplying = isReplying;
    },
    
    SET_REPLY_SETTINGS(state, { isPublic, recipients }) {
      state.replySettings.isPublic = isPublic;
      
      if (recipients) {
        state.replySettings.recipients = [...recipients];
      }
    },
    
    SYNC_REPLY_SETTINGS_WITH_MESSAGE(state, { message, currentUser }) {
      if (message) {
        
        // Save initial state for debugging
        const initialSettings = {
          isPublic: state.replySettings.isPublic,
          recipients: [...state.replySettings.recipients]
        };
        
        // 1. Set public/private toggle to match the selected message
        // Convert numeric 1/0 to boolean true/false if needed
        const isPublic = message.public === 1 || message.public === true;
        state.replySettings.isPublic = isPublic;
        
        // Get current user tag for filtering
        const currentUserTag = currentUser ? currentUser.user_tag : null;
        
        // Get the author's tag (prefer author_user_tag over other fields)
        let authorTag;
        if (message.content_author === 'chatgpt') {
          // Special case for ChatGPT
          authorTag = 'chatgpt';
        } else if (message.author_user_tag) {
          // Use user tag when available (preferred)
          authorTag = message.author_user_tag;
        } else if (message.author_email) {
          // Fall back to email only for backward compatibility
          authorTag = message.author_email;
        }
        
        // Completely different handling for public vs private messages
        if (isPublic) {
          // PUBLIC MESSAGE CASE:
          // For public messages, start with either existing recipients or empty list
          // We want to preserve user customizations when possible
          if (state.replySettings.recipients.length === 0) {
            // If empty, initialize with author
            state.replySettings.recipients = [];
            
            // Add the message author if available
            if (authorTag) {
              state.replySettings.recipients.push(authorTag);
            }
          } else {
            // If user has customized recipients, ensure author is included
            if (authorTag && !state.replySettings.recipients.includes(authorTag)) {
              state.replySettings.recipients.push(authorTag);
            }
          }
        } else {
          // PRIVATE MESSAGE CASE:
          // For private messages, copy all recipients from the original message
          if (message.recipients) {
            // For existing recipients, try to convert emails to tags if possible
            // This would require a lookup from backend, but we don't have that
            // capability here, so we'll keep the existing values for now
            state.replySettings.recipients = [...message.recipients];
          } else {
            state.replySettings.recipients = [];
          }
          
          // Add the message author if not already in the list
          if (authorTag) {
            if (!state.replySettings.recipients.includes(authorTag)) {
              state.replySettings.recipients.push(authorTag);
            }
          }
        }
      } else {
        console.warn("SYNC_REPLY_SETTINGS_WITH_MESSAGE called with null or undefined message");
      }
    },
    
    ADD_RECIPIENT(state, recipient) {
      if (!state.replySettings.recipients.includes(recipient)) {
        state.replySettings.recipients.push(recipient);
      }
    },
    
    REMOVE_RECIPIENT(state, index) {
      state.replySettings.recipients.splice(index, 1);
    },
    
    // New mutation to set current child for a parent
    SET_CURRENT_CHILD(state, { parentId, childId }) {
      state.currentChildren = {
        ...state.currentChildren,
        [parentId]: childId
      };
    }
  },
  
  actions: {
    async selectMessage({ commit, rootGetters, dispatch, rootState }, messageId) {
      // Set loading state to true while we check/load the message
      commit('SET_SELECTED_MESSAGE_LOADING', true);
      
      console.log('DEBUG: selectMessage called with messageId:', messageId);
      
      // Handle an empty or temporary thread message ID
      if (!messageId || (typeof messageId === 'string' && messageId.startsWith('temp-'))) {
        // For temporary threads, we don't need to load anything from the API
        commit('SET_SELECTED_MESSAGE', messageId || null);
        commit('SET_SELECTED_MESSAGE_LOADING', false);
        return;
      }
      
      // Check if the message exists in the store
      const message = rootGetters['messages/getMessage'](messageId);
      
      // If message exists in the store, just select it without loading
      // loadInitialMessage should only be called when loading from route changes
      if (message) {
        commit('SET_SELECTED_MESSAGE', messageId);
        commit('SET_SELECTED_MESSAGE_LOADING', false);
        
        // Call syncReplySettingsWithSelectedMessage to ensure author is added to recipients
        dispatch('syncReplySettingsWithSelectedMessage');
        return;
      }
      
      // Message doesn't exist - this should only happen when loading a thread initially
      // not during normal message selection within a thread
      try {
        console.log('DEBUG: Message not found in store, loading from API');
        await dispatch('messages/loadInitialMessage', messageId, { root: true });
      } catch (error) {
        console.error('Error loading message:', error);
        commit('SET_SELECTED_MESSAGE_LOADING', false);
        return;
      }
      
      // Now set the selected message
      commit('SET_SELECTED_MESSAGE', messageId);
      commit('SET_SELECTED_MESSAGE_LOADING', false);
      
      // Call syncReplySettingsWithSelectedMessage to ensure author is added to recipients
      dispatch('syncReplySettingsWithSelectedMessage');
    },
    
    // Simplified function to toggle reply state
    toggleReply({ commit, state, dispatch }, shouldReply = !state.isReplying) {
      commit('SET_REPLYING', shouldReply);
      
      // If we're turning on reply mode, sync reply settings with selected message
      if (shouldReply) {
        dispatch('syncReplySettingsWithSelectedMessage');
      }
    },
    
    updateReplyVisibility({ commit, state }, isPublic) {
      // Just update visibility setting directly without re-syncing
      commit('SET_REPLY_SETTINGS', { isPublic });
    },
    
    addRecipient({ commit }, recipient) {
      commit('ADD_RECIPIENT', recipient);
    },
    
    removeRecipient({ commit }, index) {
      commit('REMOVE_RECIPIENT', index);
    },
    
    // Add ChatGPT to recipients list
    addChatGPT({ commit, state }) {
      const chatgptRecipient = 'chatgpt';
      console.log('[CHATGPT] Adding ChatGPT to recipients list');
      
      if (!state.replySettings.recipients.includes(chatgptRecipient)) {
        commit('ADD_RECIPIENT', chatgptRecipient);
        console.log('[CHATGPT] ChatGPT successfully added to recipients');
        return true; // Indicates ChatGPT was added
      }
      
      console.log('[CHATGPT] ChatGPT was already in recipients list');
      return false; // Indicates ChatGPT was already in the list
    },
    
    // Sync reply settings with selected message
    syncReplySettingsWithSelectedMessage({ commit, rootGetters }) {
      const messageId = rootGetters['navigation/selectedMessageId'];
      if (!messageId) return;
      
      const message = rootGetters['messages/getMessage'](messageId);
      if (!message) return;
      
      const currentUser = rootGetters['auth/user'];
      commit('SYNC_REPLY_SETTINGS_WITH_MESSAGE', { message, currentUser });
    },
    
    // New action for sibling navigation
    navigateToSibling({ commit, dispatch, rootGetters }, { parentId, direction }) {
      const childIds = rootGetters['messages/getChildIds'](parentId);
      const currentChildId = rootGetters['navigation/getCurrentChildId'](parentId);
      const currentIndex = childIds.indexOf(currentChildId);
      
      let newIndex;
      if (currentIndex === -1) {
        // If no current child or not found, use first or last depending on direction
        newIndex = direction === 'prev' ? 0 : childIds.length - 1;
      } else {
        if (direction === 'prev') {
          newIndex = Math.max(0, currentIndex - 1);
        } else {
          newIndex = Math.min(childIds.length - 1, currentIndex + 1);
        }
      }
      
      if (childIds.length > 0 && newIndex >= 0 && newIndex < childIds.length) {
        const newChildId = childIds[newIndex];
        commit('SET_CURRENT_CHILD', { parentId, childId: newChildId });
        dispatch('selectMessage', newChildId);
      }
    },
    
    // Set initial child for a parent (typically the oldest)
    setInitialChild({ commit, rootGetters, state }, parentId) {
      const childIds = rootGetters['messages/getChildIds'](parentId);
      
      // If there are no children, we can't set an initial child
      if (!childIds || childIds.length === 0) {
        console.warn(`setInitialChild: No children found for parent ${parentId}`);
        return;
      }
      
      // Check if we already have a current child set
      const currentChild = state.currentChildren[parentId];
      
      // If we already have a current child and it's valid, keep it
      if (currentChild && childIds.includes(currentChild)) {
        return;
      }
      
      // Find the selected message in the children
      const selectedInChildren = state.selectedMessageId && childIds.includes(state.selectedMessageId);
      if (selectedInChildren) {
        // If the selected message is one of the children, use that
        commit('SET_CURRENT_CHILD', { parentId, childId: state.selectedMessageId });
      } else {
        // Otherwise use the first child
        commit('SET_CURRENT_CHILD', { parentId, childId: childIds[0] });
      }
    }
  },
  
  getters: {
    selectedMessageId: state => state.selectedMessageId,
    isReplying: state => state.isReplying,
    replyIsPublic: state => state.replySettings.isPublic,
    replyRecipients: state => state.replySettings.recipients,
    
    // Add replyTargetId getter to return the selected message ID
    replyTargetId: state => state.selectedMessageId,
    
    // Get the author of the message being replied to
    replyTargetAuthor: (state, getters, rootState, rootGetters) => {
      const messageId = state.selectedMessageId;
      if (!messageId) return '';
      
      const message = rootGetters['messages/getMessage'](messageId);
      return message ? message.content_author : '';
    },
    
    // New getter to get current child for a parent
    getCurrentChildId: state => parentId => {
      return state.currentChildren[parentId];
    },
    
    // Get sibling position info
    getSiblingInfo: (state, getters, rootState, rootGetters) => parentId => {
      const childIds = rootGetters['messages/getChildIds'](parentId);
      const totalCount = rootGetters['messages/getReplyCount'](parentId);
      const currentChildId = state.currentChildren[parentId];
      const position = childIds.indexOf(currentChildId);
      
      // If we have children but no valid position, default to position 1
      const validPosition = position >= 0 ? position + 1 : 
                           (childIds.length > 0 ? 1 : 0);
      
      return {
        position: validPosition,
        totalCount: totalCount || childIds.length,  // Use total count from API if available
        loadedCount: childIds.length,
        isFirst: position === 0,
        isLast: position >= 0 && position + 1 === totalCount, // Based on total count
        isLastLoaded: position === childIds.length - 1 // Based only on loaded children
      };
    },
    
    isSelectedMessageLoading: state => state.isSelectedMessageLoading
  }
}
