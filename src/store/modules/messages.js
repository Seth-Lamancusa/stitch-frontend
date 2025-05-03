import MessageService from '../../services/MessageService'
import WebSocketService from '../../services/WebSocketService'

export default {
  namespaced: true,
  
  state: {
    // Flat storage of messages by ID
    messages: {},
    
    // Track parent-child relationships
    relationships: {
      // parentId: [childId1, childId2, ...]
      parents: {},
      // childId: parentId
      children: {}
    },
    
    // Track loading states
    loadingStates: {
      // messageId: 'loading' | 'loaded' | 'error'
      messages: {},
      // messageId: 'loading' | 'loaded' | 'error'
      children: {},
      // messageId: 'loading' | 'loaded' | 'error'
      parents: {},
      // messageId: 'loading' | 'loaded' | 'error'
      chain: {}
    },
    
    // Track currently viewed message
    currentMessageId: null,
    
    // Track reply counts
    replyCounts: {},
    
    // Loading state for pinned messages
    isPinnedMessagesLoading: false,
    
    // Store recommended message IDs
    recommendedMessageIds: []
  },
  
  mutations: {
    SET_MESSAGE(state, message) {
      state.messages = {
        ...state.messages,
        [message.id]: message
      };
    },
    
    SET_MESSAGES(state, messages) {
      const newMessages = {};
      messages.forEach(message => {
        newMessages[message.id] = message;
      });
      
      state.messages = {
        ...state.messages,
        ...newMessages
      };
    },
    
    SET_RELATIONSHIP(state, { parentId, childId }) {
      // Set parent-child relationship
      if (!state.relationships.parents[parentId]) {
        state.relationships.parents[parentId] = [];
      }
      
      if (!state.relationships.parents[parentId].includes(childId)) {
        state.relationships.parents[parentId].push(childId);
      }
      
      // Set child-parent relationship
      state.relationships.children[childId] = parentId;
    },
    
    SET_LOADING_STATE(state, { id, type, status }) {
      if (!state.loadingStates[type]) {
        state.loadingStates[type] = {};
      }
      state.loadingStates[type][id] = status;
    },
    
    SET_CURRENT_MESSAGE(state, messageId) {
      state.currentMessageId = messageId;
    },
    
    REMOVE_MESSAGE(state, messageId) {
      // First, recursively collect all descendant message IDs to remove
      const collectDescendants = (parentId, collected = []) => {
        if (state.relationships.parents[parentId]) {
          // Get all child IDs
          const childIds = [...state.relationships.parents[parentId]];
          // Add each child and its descendants
          childIds.forEach(childId => {
            collected.push(childId);
            collectDescendants(childId, collected);
          });
        }
        return collected;
      };
      
      // Get all descendants to remove
      const descendantIds = collectDescendants(messageId);
      console.log(`Removing message ${messageId} and ${descendantIds.length} descendants`);
      
      // Create a copy of the messages object
      const messages = { ...state.messages };
      
      // Remove the parent message
      delete messages[messageId];
      
      // Remove all descendants
      descendantIds.forEach(id => {
        delete messages[id];
      });
      
      // Update state with the filtered messages
      state.messages = messages;
      
      // Remove from parent-child relationships
      const parents = { ...state.relationships.parents };
      const children = { ...state.relationships.children };
      
      // Remove parent relationship (parent → this message)
      if (children[messageId]) {
        const parentId = children[messageId];
        if (parents[parentId]) {
          parents[parentId] = parents[parentId].filter(id => id !== messageId);
        }
        delete children[messageId];
      }
      
      // Remove child relationships (this message → all children)
      delete parents[messageId];
      
      // Remove all descendant relationships
      descendantIds.forEach(id => {
        delete parents[id];
        delete children[id];
      });
      
      // Update the relationship state
      state.relationships.parents = parents;
      state.relationships.children = children;
    },
    
    SET_REPLY_COUNT(state, { messageId, count }) {
      state.replyCounts = {
        ...state.replyCounts,
        [messageId]: count
      };
    },
    
    REMOVE_TEMP_THREAD(state, threadId) {
      // Create a copy of the messages without the temp thread
      const messages = { ...state.messages };
      
      // Remove the specified temp thread
      if (messages[threadId]) {
        delete messages[threadId];
      }
      
      // Also check through all messages to find any with matching temp ID
      Object.keys(messages).forEach(id => {
        if (typeof id === 'string' && id.startsWith('temp-')) {
          delete messages[id];
        }
      });
      
      state.messages = messages;
    },
    
    SET_PINNED_MESSAGES_LOADING(state, isLoading) {
      state.isPinnedMessagesLoading = isLoading;
    },
    
    UPDATE_MESSAGE_PIN_STATUS(state, { messageId, isPinned }) {
      if (state.messages[messageId]) {
        state.messages[messageId] = {
          ...state.messages[messageId],
          is_pinned: isPinned ? 1 : 0
        };
      }
    },
    
    SET_RECOMMENDED_MESSAGE_IDS(state, ids) {
      state.recommendedMessageIds = ids;
    }
  },
  
  actions: {
    isTemporaryId(id) {
      return typeof id === 'string' && id.toString().startsWith('temp-');
    },
    
    // Helper function to load a message and all its replies to specified depth
    async loadMessageBranchDown({ commit, dispatch }, { messageId, depth, currentDepth = 0 }) {
      
      if (currentDepth > depth) {
        return [];
      }
      
      // Load the message itself if not already loaded
      const message = await dispatch('loadMessageIfNeeded', messageId);
      if (!message) {
        return []; // Skip if message couldn't be loaded
      }
      
      // Load all replies using our getAllReplies endpoint
      let replyMessages = [];
      try {
        // Use the new loadAllReplies action to get all replies at once
        replyMessages = await dispatch('loadAllReplies', messageId);
      } catch (error) {
        return [message]; // Return just the message if replies can't be loaded
      }
      
      // If no replies, return just the message
      if (replyMessages.length === 0) {
        return [message];
      }
      
      // If at max depth, return the message but also fetch reply counts for all replies
      // to ensure navigation UI is accurate even without loading actual content
      if (currentDepth === depth) {
        
        // Ensure we have reply counts for all replies at the edge of our depth
        for (const reply of replyMessages) {
          // Fetch the reply count but don't await, let it happen in the background
          dispatch('fetchReplyCount', reply.id);
        }
        
        return [message];
      }
      
      // For each reply, continue loading its branch if we haven't reached max depth
      if (currentDepth < depth) {
        let childBranches = [];
        // Process replies sequentially to avoid overwhelming the server
        for (const reply of replyMessages) {
          const childBranch = await dispatch('loadMessageBranchDown', {
            messageId: reply.id,
            depth,
            currentDepth: currentDepth + 1
          });
          childBranches = [...childBranches, ...childBranch];
        }
        
        return [message, ...childBranches];
      }
      
      return [message, ...replyMessages];
    },
    
    // Helper function to load a message and all its parents to specified depth
    async loadMessageBranchUp({ commit, dispatch }, { messageId, depth, currentDepth = 0 }) {
      if (currentDepth > depth) return [];
      
      // Load the message itself if not already loaded
      const message = await dispatch('loadMessageIfNeeded', messageId);
      if (!message) return []; // Skip if message couldn't be loaded
      
      // If no parent or at max depth, return just the message
      if (!message.parent_id || currentDepth === depth) {
        return [message];
      }
      
      // Recursively load parent branch
      const parentBranch = await dispatch('loadMessageBranchUp', {
        messageId: message.parent_id,
        depth,
        currentDepth: currentDepth + 1
      });
      
      // Set up relationship
      if (parentBranch.length > 0) {
            commit('SET_RELATIONSHIP', {
          parentId: message.parent_id,
          childId: message.id
        });
      }
      
      return [...parentBranch, message];
    },
    
    // Load a message if it's not already in the store
    async loadMessageIfNeeded({ commit, state, getters, dispatch }, messageId) {
      // Check if message is already loaded
      const existingMessage = getters.getMessage(messageId);
      
      if (existingMessage && 
          state.loadingStates.messages && 
          state.loadingStates.messages[messageId] === 'loaded') {
        // Always fetch the reply count to ensure navigation state is correct
        if (state.replyCounts[messageId] === undefined) {
          dispatch('fetchReplyCount', messageId);
        }
        
        // Even though the message is loaded, ensure all its replies are loaded too
        if (!state.loadingStates.children || state.loadingStates.children[messageId] !== 'loaded') {
          dispatch('loadAllReplies', messageId);
        }
        
        return existingMessage;
      }
      
      commit('SET_LOADING_STATE', { id: messageId, type: 'messages', status: 'loading' });
      
      try {
        const response = await MessageService.getMessage(messageId);
        const message = response.data;
        
        if (message) {
          commit('SET_MESSAGE', message);
          commit('SET_LOADING_STATE', { id: messageId, type: 'messages', status: 'loaded' });
          
          // Always fetch the reply count first
          await dispatch('fetchReplyCount', messageId);
          
          // Always load all replies when a message is loaded
          dispatch('loadAllReplies', messageId);
        } else {
          commit('SET_LOADING_STATE', { id: messageId, type: 'messages', status: 'error' });
        }
        
        return message;
      } catch (error) {
        commit('SET_LOADING_STATE', { id: messageId, type: 'messages', status: 'error' });
        return null;
      }
    },
    
    // Load multiple messages if they're not already in the store
    async loadMessagesIfNeeded({ commit, dispatch, state, getters }, messageIds) {
      if (!messageIds || messageIds.length === 0) return [];
      
      // Filter to only messages not already loaded
      const idsToLoad = messageIds.filter(id => 
        !getters.getMessage(id) || 
        !state.loadingStates.messages || 
        state.loadingStates.messages[id] !== 'loaded'
      );
      
      if (idsToLoad.length === 0) {
        // All messages already loaded
        const loadedMessages = messageIds.map(id => getters.getMessage(id)).filter(Boolean);
        
        // Make sure we have reply counts for all messages
        for (const messageId of messageIds) {
          // Always fetch the reply count to ensure navigation state is correct
          if (state.replyCounts[messageId] === undefined) {
            dispatch('fetchReplyCount', messageId);
          }
          
          // Even though the messages are loaded, ensure all their replies are loaded too
          if (!state.loadingStates.children || state.loadingStates.children[messageId] !== 'loaded') {
            dispatch('loadAllReplies', messageId);
          }
        }
        
        return loadedMessages;
      }
      
      // Set loading state for all messages
      idsToLoad.forEach(id => {
        commit('SET_LOADING_STATE', { id, type: 'messages', status: 'loading' });
      });
      
      try {
        const response = await MessageService.getMessagesBatch(idsToLoad);
        const messages = response.data;
        
        // Add messages to store
        commit('SET_MESSAGES', messages);
        
        // Set loading state for loaded messages, fetch reply counts and load replies
        for (const message of messages) {
          commit('SET_LOADING_STATE', { id: message.id, type: 'messages', status: 'loaded' });
          
          // First fetch the reply count
          await dispatch('fetchReplyCount', message.id);
          
          // Then load all replies for this message
          dispatch('loadAllReplies', message.id);
        }
        
        // Handle any messages that weren't returned (not found, no permission, etc.)
        const loadedIds = messages.map(m => m.id);
        const failedIds = idsToLoad.filter(id => !loadedIds.includes(id));
        
        failedIds.forEach(id => {
          commit('SET_LOADING_STATE', { id, type: 'messages', status: 'error' });
        });
        
        // Return all successfully loaded messages (including ones that were already loaded)
        return messageIds
          .map(id => getters.getMessage(id))
          .filter(Boolean);
      } catch (error) {
        console.error(`Error loading messages batch:`, error);
        idsToLoad.forEach(id => {
          commit('SET_LOADING_STATE', { id, type: 'messages', status: 'error' });
        });
        
        // Return any messages that were already loaded
        return messageIds
          .map(id => getters.getMessage(id))
          .filter(Boolean);
      }
    },
    
    // Load initial message with its parent and child branches
    async loadInitialMessage({ commit, dispatch, getters }, messageId) {
      commit('SET_LOADING_STATE', { id: messageId, type: 'message', status: 'loading' });
      
      try {
        // First load the message itself
        const message = await dispatch('loadMessageIfNeeded', messageId);
        
        if (!message) {
          console.error(`[DEBUG] Could not load message ${messageId}, message not found or error occurred`);
          throw new Error(`Could not load message ${messageId}`);
        }
        
        // Load parent branch (upward)
        const parentDepth = 2; // Changed from 1 to 2
        const parentBranch = await dispatch('loadMessageBranchUp', {
          messageId,
          depth: parentDepth
        });
        
        // Load child branch (downward)
        const childDepth = 2; // Changed from 1 to 2
        const childBranch = await dispatch('loadMessageBranchDown', {
          messageId,
          depth: childDepth
        });
        
        // Mark as loaded
        commit('SET_LOADING_STATE', { id: messageId, type: 'message', status: 'loaded' });
        
        return message;
      } catch (error) {
        console.error(`Error loading initial message ${messageId}:`, error);
        commit('SET_LOADING_STATE', { id: messageId, type: 'message', status: 'error' });
        throw error;
      }
    },
    
    // Load parent messages
    async loadParents({ commit, dispatch, state }, { messageId, limit }) {
      commit('SET_LOADING_STATE', { id: messageId, type: 'parents', status: 'loading' });
      
      try {
        const message = await dispatch('loadMessageIfNeeded', messageId);
        if (!message || !message.parent_id) {
          commit('SET_LOADING_STATE', { id: messageId, type: 'parents', status: 'loaded' });
          return [];
        }
        
        // Load parent branch
        const parents = await dispatch('loadMessageBranchUp', {
          messageId: message.parent_id,  // Start from parent
          depth: limit - 1              // Adjust depth since we're starting from parent
        });
        
        commit('SET_LOADING_STATE', { id: messageId, type: 'parents', status: 'loaded' });
        return parents;
      } catch (error) {
        commit('SET_LOADING_STATE', { id: messageId, type: 'parents', status: 'error' });
        throw error;
      }
    },
    
    // Send a reply to a message
    async sendReply({ commit, dispatch, rootState }, { parentId, content, isPrivate, recipients, content_author }) {
      try {
        // Use the current user if content_author is not provided
        const effectiveAuthor = content_author || rootState.user?.email;
        
        // Use recipients as provided without automatically adding current user
        let updatedRecipients = [...(recipients || [])];
        
        // Only add the author as recipient in private messages with no recipients
        // to ensure they can see their own message
        if (isPrivate && updatedRecipients.length === 0 && effectiveAuthor) {
          updatedRecipients.push(effectiveAuthor);
        }
        
        // Log if ChatGPT is included as a recipient for debugging
        const isChatGPTMessage = updatedRecipients.includes('chatgpt');
        if (isChatGPTMessage) {
          console.log('Sending message with ChatGPT as recipient, ensuring subscriptions');
        }
        
        // Make API call to create the reply
        const response = await MessageService.sendReply(
          parentId, 
          content, 
          isPrivate, 
          updatedRecipients, 
          effectiveAuthor
        );
        
        const newMessage = response.data;
        
        // Add to store
        commit('SET_MESSAGE', newMessage);
        
        // Set the relationship
        if (parentId) {
          commit('SET_RELATIONSHIP', {
            parentId: parentId,
            childId: newMessage.id
          });
          
          // Update reply count
          await dispatch('fetchReplyCount', parentId);
        }
        
        // IMPORTANT: Always subscribe to the new message AND its parent
        // This ensures we'll receive any ChatGPT responses to our messages
        WebSocketService.subscribeToMessage(newMessage.id); // Subscribe to the new message
        
        if (parentId) {
          // Also subscribe to parent in case it wasn't already subscribed
          WebSocketService.subscribeToMessage(parentId);
        }
        
        // For ChatGPT messages, ensure we update subscriptions right away
        if (isChatGPTMessage) {
          const viewId = `view_${Date.now()}`;
          let visibleMessageIds = WebSocketService.visibleMessageIds || [];
          
          // Ensure both new message and parent are in the list
          if (!visibleMessageIds.includes(newMessage.id)) {
            visibleMessageIds.push(newMessage.id);
          }
          
          if (parentId && !visibleMessageIds.includes(parentId)) {
            visibleMessageIds.push(parentId);
          }
          
          // Force update subscriptions
          WebSocketService.updateVisibleMessages(visibleMessageIds, newMessage.id);
          console.log(`Subscribed to messages for ChatGPT interaction: ${visibleMessageIds.join(', ')}`);
        }
        
        return newMessage;
      } catch (error) {
        console.error("Error sending reply:", error);
        throw error;
      }
    },
    
    // Subscribe to end-of-branch messages for real-time updates
    subscribeToEndOfBranchMessages({ commit, state, getters, dispatch, rootGetters }) {
      
      // Generate a unique view ID
      const viewId = `view_${Date.now()}`;
      
      // Get all visible messages from the current branch
      const visibleMessages = getters.getVisibleBranchMessages || [];
      const visibleMessageIds = visibleMessages.map(message => message.id);
      
      // Find the last message in the branch (for special handling)
      const lastVisibleMessageId = visibleMessages.length > 0 
        ? visibleMessages[visibleMessages.length - 1].id 
        : null;
      
      console.log(`[DEBUG WSCallback] Setting up WebSocket subscription for messages: ${visibleMessageIds.join(', ')}`);
      
      // Subscribe to updates
      const unsubscribe = WebSocketService.subscribeToVisibleMessages(
        viewId,
        visibleMessageIds,
        lastVisibleMessageId,
        (data) => {
          if (data.type === 'new_reply' && data.data) {
            console.log(`[DEBUG WSCallback] WebSocket received new_reply event. Message ID: ${data.data.id}, Parent ID: ${data.data.parent_id}`);
            const message = data.data;
            
            // Check if this is a reply to a visible message
            if (data.isParentVisible) {
              console.log(`[DEBUG WSCallback] Parent is visible, adding message to store`);
              
              // Add to store
              commit('SET_MESSAGE', message);
              
              // Set relationship
              if (message.parent_id) {
                console.log(`[DEBUG WSCallback] Setting relationship: parent=${message.parent_id}, child=${message.id}`);
                commit('SET_RELATIONSHIP', {
                  parentId: message.parent_id,
                  childId: message.id
                });
                
                // Update parent has_children flag to true since it now has a child
                const parentMessage = getters.getMessage(message.parent_id);
                if (parentMessage) {
                  console.log(`[DEBUG WSCallback] Updating parent message has_children flag`);
                  parentMessage.has_children = true;
                  commit('SET_MESSAGE', parentMessage);
                  
                  // Update reply count
                  const currentCount = getters.getReplyCount(message.parent_id) || 0;
                  console.log(`[DEBUG WSCallback] Updating reply count for parent ${message.parent_id} from ${currentCount} to ${currentCount + 1}`);
                  commit('SET_REPLY_COUNT', { 
                    messageId: message.parent_id, 
                    count: currentCount + 1 
                  });
                } else {
                  console.log(`[DEBUG WSCallback] Parent message ${message.parent_id} not found in store, relationship may be incomplete`);
                }
                
                // Check if we need to update the selected message
                const selectedId = rootGetters['navigation/selectedMessageId'];
                
                // If the parent is the selected message, update navigation to show the new reply
                if (selectedId === message.parent_id) {
                  console.log(`[DEBUG WSCallback] Parent is selected message - refreshing navigation`);
                  
                  // Update the current child in navigation to show this message
                  dispatch('navigation/setCurrentChildId', {
                    parentId: message.parent_id,
                    childId: message.id
                  }, { root: true });
                  
                  // Force refresh of the displayed messages by re-selecting the parent message
                  setTimeout(() => {
                    console.log(`[DEBUG WSCallback] Refreshing message selection to show ${message.id}`);
                    dispatch('navigation/selectMessage', message.parent_id, { root: true });
                    
                    // Then select the new message
                    setTimeout(() => {
                      dispatch('navigation/selectMessage', message.id, { root: true });
                    }, 50);
                  }, 50);
                }
              }
            } else {
              console.log(`[DEBUG WSCallback] Parent message ${message.parent_id} not in visible messages list, not processing`);
            }
          }
        }
      );
      
      return unsubscribe;
    },
    
    // Delete a message
    async deleteMessage({ commit, state }, messageId) {
      try {
        console.log(`Deleting message: ${messageId}`);
        
        // API call to delete the message
        await MessageService.deleteMessage(messageId);
        
        // Before removing, log what we know about descendants
        if (state.relationships.parents[messageId]) {
          const childIds = state.relationships.parents[messageId];
        }
        
        // Remove from store
        commit('REMOVE_MESSAGE', messageId);
        
        return true;
      } catch (error) {
        console.error('Error deleting message:', error);
        throw error;
      }
    },
    
    // Import a ChatGPT conversation
    async importChatGPT({ commit, dispatch }, { content, isPublic, recipients }) {
      try {
        // Make API call to import conversation
        const response = await MessageService.importChatGPT(content, isPublic, recipients);
        
        const rootMessage = response.data;
        
        // Add to store
        commit('SET_MESSAGE', rootMessage);
        
        // Subscribe to the new message for real-time updates
        WebSocketService.subscribeToMessage(rootMessage.id);
        
        return rootMessage;
      } catch (error) {
        console.error('Error importing ChatGPT conversation:', error);
        throw error;
      }
    },
    
    // Fetch threads based on active tab
    async fetchThreads({ commit, rootState, dispatch }) {
      try {
        commit('SET_LOADING_STATE', { id: 'threads', type: 'messages', status: 'loading' });
        
        // Get active tab from UI store
        const activeTab = rootState.ui?.activeTab || 'public';
        
        let threads = [];
        let response;
        
        // Fetch regular messages based on tab
        if (activeTab === 'private') {
          response = await MessageService.getPrivateMessages(10);
          threads = response.data || [];
        } else {
          // For public tab, fetch recommended messages
          response = await MessageService.getRecommendedMessages(1000);
          threads = response.data || [];
          
          // Additionally fetch any pinned messages that might not be in the recommended list
          try {
            const pinnedResponse = await MessageService.getPinnedMessages();
            if (pinnedResponse.data && pinnedResponse.data.length) {
              // Merge pinned messages with threads
              const pinnedMessages = pinnedResponse.data;
              
              // Check for duplicates before adding
              const existingIds = new Set(threads.map(msg => msg.id));
              const newPinnedMessages = pinnedMessages.filter(msg => !existingIds.has(msg.id));
              
              // Add any non-duplicate pinned messages
              if (newPinnedMessages.length > 0) {
                threads = [...newPinnedMessages, ...threads];
              }
            }
          } catch (error) {
            console.error('Error fetching pinned messages:', error);
          }
        }
        
        // Extract and store the message IDs for filtering in the UI
        const messageIds = threads.map(msg => msg.id);
        commit('SET_RECOMMENDED_MESSAGE_IDS', messageIds);
        
        // Log unique parent_ids to see thread structure
        const uniqueParentIds = new Set();
        const rootMessages = [];
        threads.forEach(msg => {
          if (msg.parent_id) {
            uniqueParentIds.add(msg.parent_id);
          } else {
            rootMessages.push(msg);
          }
        });
        
        // Store threads in the state
        commit('SET_MESSAGES', threads);
        
        commit('SET_LOADING_STATE', { id: 'threads', type: 'messages', status: 'loaded' });
        return threads;
      } catch (error) {
        commit('SET_LOADING_STATE', { id: 'threads', type: 'messages', status: 'error' });
        console.error('Error fetching threads:', error);
        return [];
      }
    },
    
    // Update a message's fields
    async updateMessage({ commit, state }, updateData) {
      try {
        // Get ID and remove from update data
        const { id, ...fields } = updateData;
        
        if (!id) {
          throw new Error('Message ID is required for updates');
        }
        
        // Get existing message
        const message = state.messages[id];
        if (!message) {
          throw new Error(`Message with ID ${id} not found`);
        }
        
        // Create updated message
        const updatedMessage = {
          ...message,
          ...fields
        };
        
        // Update in store immediately for responsive UI
        commit('SET_MESSAGE', updatedMessage);
        
        // Call API to persist changes in the backend
        await MessageService.updateMessageDetails(id, fields);
        
        return updatedMessage;
      } catch (error) {
        console.error('Error updating message:', error);
        throw error;
      }
    },
    
    // Fetch reply count for a message
    async fetchReplyCount({ commit, state }, messageId) {
      // Skip for temporary thread IDs
      if (typeof messageId === 'string' && messageId.startsWith('temp-')) {
        return 0;
      }
      
      // Skip if we already have the count
      if (state.replyCounts[messageId] !== undefined) {
        return state.replyCounts[messageId];
      }
      
      try {
        const response = await MessageService.getReplyCount(messageId);
        const count = response.data.count;
        
        commit('SET_REPLY_COUNT', { messageId, count });
        return count;
      } catch (error) {
        console.error('Error fetching reply count:', error);
        return 0;
      }
    },
    
    // Load all replies for a message using the getAllReplies endpoint
    async loadAllReplies({ commit, state, dispatch }, messageId) {
      // Skip for temporary thread IDs
      if (typeof messageId === 'string' && messageId.startsWith('temp-')) {
        return [];
      }
      
      try {
        commit('SET_LOADING_STATE', { id: messageId, type: 'children', status: 'loading' });
        
        // Get all replies from the API
        const response = await MessageService.getAllReplies(messageId);
        const replies = response.data || [];
        
        if (replies.length > 0) {
          // Store all replies in the state
          commit('SET_MESSAGES', replies);
          
          // Set up parent-child relationships for all replies
          replies.forEach(reply => {
            if (reply.id && reply.parent_id) {
              commit('SET_RELATIONSHIP', {
                parentId: reply.parent_id,
                childId: reply.id
              });
            }
          });
          
          // Set reply count
          commit('SET_REPLY_COUNT', {
            messageId,
            count: replies.length
          });
        }
        
        commit('SET_LOADING_STATE', { id: messageId, type: 'children', status: 'loaded' });
        return replies;
      } catch (error) {
        console.error(`loadAllReplies: Error loading replies for message ${messageId}:`, error);
        commit('SET_LOADING_STATE', { id: messageId, type: 'children', status: 'error' });
        return [];
      }
    },
    
    // Remove a temporary thread from the store
    removeTemporaryThread({ commit }, threadId) {
      commit('REMOVE_TEMP_THREAD', threadId);
    },
    
    // Add this helper method
    updateSubscriptions({ state, getters }) {
      const viewId = `view_${Date.now()}`;
      const visibleMessages = getters.getVisibleBranchMessages || [];
      const visibleMessageIds = visibleMessages.map(message => message.id);
      const lastVisibleMessageId = visibleMessages.length > 0 
        ? visibleMessages[visibleMessages.length - 1].id 
        : null;
      
      // Update visible messages in WebSocketService
      WebSocketService.updateVisibleMessages(visibleMessageIds, lastVisibleMessageId);
    },
    
    async pinMessage({ commit }, messageId) {
      try {
        await MessageService.pinMessage(messageId);
        commit('UPDATE_MESSAGE_PIN_STATUS', { messageId, isPinned: true });
        return true;
      } catch (error) {
        console.error('Error pinning message:', error);
        return false;
      }
    },
    
    async unpinMessage({ commit }, messageId) {
      try {
        await MessageService.unpinMessage(messageId);
        commit('UPDATE_MESSAGE_PIN_STATUS', { messageId, isPinned: false });
        return true;
      } catch (error) {
        console.error('Error unpinning message:', error);
        return false;
      }
    }
  },
  
  getters: {
    getMessage: (state) => (id) => {
      const message = state.messages[id];
      return message;
    },
    
    getCurrentMessage: state => state.messages[state.currentMessageId],
    
    getChildIds: state => parentId => {
      return state.relationships.parents[parentId] || [];
    },
    
    getParentId: state => childId => {
      return state.relationships.children[childId];
    },
    
    isLoading: state => (id, type) => {
      return state.loadingStates[type]?.[id] === 'loading';
    },
    
    getLoadedMessages: state => {
      return Object.values(state.messages);
    },
    
    getVisibleThreadMessages: state => {
      // If no current message, return empty array
      if (!state.currentMessageId) return [];
      
      const result = [];
      const visited = new Set();
      
      // Add current message
      if (state.messages[state.currentMessageId]) {
        result.push(state.messages[state.currentMessageId]);
        visited.add(state.currentMessageId);
      }
      
      // Add parents (ancestors)
      let currentId = state.currentMessageId;
      while (state.relationships.children[currentId]) {
        const parentId = state.relationships.children[currentId];
        
        if (visited.has(parentId)) break; // Avoid cycles
        
        if (state.messages[parentId]) {
          result.unshift(state.messages[parentId]); // Add at beginning
          visited.add(parentId);
        }
        
        currentId = parentId;
      }
      
      // Add children (descendants), up to what we've loaded
      const addChildren = (parentId) => {
        const childIds = state.relationships.parents[parentId] || [];
        
        for (const childId of childIds) {
          if (visited.has(childId)) continue; // Avoid cycles
          
          if (state.messages[childId]) {
            result.push(state.messages[childId]);
            visited.add(childId);
            
            // Recursively add children of this child
            addChildren(childId);
          }
        }
      };
      
      addChildren(state.currentMessageId);
      
      return result;
    },
    
    // New getter for single branch view
    getVisibleBranchMessages: (state, getters, rootState, rootGetters) => {
      const result = [];
      const visited = new Set();
      
      // Start from selected message (this is just to identify which branch we're in)
      let currentId = rootGetters['navigation/selectedMessageId'];
      if (!currentId) return [];
      
      // For debugging
      console.log(`[DEBUG] getVisibleBranchMessages called with selected ID: ${currentId}`);
      
      // For temporary threads that have no messages yet, just return empty array
      if (typeof currentId === 'string' && currentId.startsWith('temp-') && !state.messages[currentId]) {
        return [];
      }
      
      // Add current message
      if (state.messages[currentId]) {
        result.push(state.messages[currentId]);
        visited.add(currentId);
      }
      
      // Add parents (traverse upward to find the root of this branch)
      let rootMessageId = currentId;
      while (state.relationships.children[currentId]) {
        const parentId = state.relationships.children[currentId];
        if (visited.has(parentId)) break;
        
        if (state.messages[parentId]) {
          result.unshift(state.messages[parentId]);
          visited.add(parentId);
          rootMessageId = parentId; // Keep track of the root message
        }
        
        currentId = parentId;
      }
      
      // Now follow the branch from root to leaf, adding all messages
      // This builds the full branch regardless of which message is selected
      const buildFullBranch = (fromId, branch = []) => {
        if (visited.has(fromId)) return branch;
        
        // Add this message
        if (state.messages[fromId]) {
          branch.push(state.messages[fromId]);
          visited.add(fromId);
        } else {
          return branch; // Message not found, stop here
        }
        
        // Get child IDs
        const childIds = getters.getChildIds(fromId);
        if (!childIds || childIds.length === 0) {
          return branch; // End of branch
        }
        
        // Log available children for debugging
        console.log(`[DEBUG] Message ${fromId} has children: ${childIds.join(', ')}`);
        
        // We need to find which child continues the main branch
        // First check if there's a current child set for this parent
        let nextChildId = rootGetters['navigation/getCurrentChildId'](fromId);
        
        // If no specific child is selected, default to the first one
        if (!nextChildId || !state.messages[nextChildId]) {
          nextChildId = childIds[0];
        }
        
        // Follow this child to continue the branch
        if (nextChildId) {
          console.log(`[DEBUG] Following child ${nextChildId} from parent ${fromId}`);
          return buildFullBranch(nextChildId, branch);
        }
        
        return branch;
      };
      
      // Reset result and visited sets before rebuilding the full branch
      result.length = 0;
      visited.clear();
      
      // Build the full branch from the root message
      const fullBranch = buildFullBranch(rootMessageId);
      
      // Log full branch contents for debugging
      console.log(`[DEBUG] Visible branch messages: ${fullBranch.map(m => m.id).join(', ')}`);
      
      return fullBranch;
    },
    
    getReplyCount: state => (messageId) => {
      // If we have the count in store, return it
      if (state.replyCounts[messageId] !== undefined) {
        return state.replyCounts[messageId];
      }
      
      // Otherwise return the number of loaded children
      const childIds = state.relationships.parents[messageId] || [];
      return childIds.length;
    },
    
    // Get end-of-branch status
    isEndOfBranch: (state) => (messageId) => {
      const message = state.messages[messageId];
      if (!message) return false;
      
      // Only show end-of-branch if message has no children
      return !message.has_children;
    },
    
    // Get message branch (all messages in the current path)
    getMessageBranch: (state, getters) => (messageId) => {
      const branch = [];
      let currentId = messageId;
      
      // Add self
      if (state.messages[currentId]) {
        branch.push(state.messages[currentId]);
      }
      
      // Add all ancestors
      while (true) {
        const parentId = getters.getParentId(currentId);
        if (!parentId) break;
        
        const parent = state.messages[parentId];
        if (!parent) break;
        
        branch.unshift(parent);
        currentId = parentId;
      }
      
      return branch;
    },
    
    getPinnedMessages: state => {
      // Filter messages by is_pinned property
      return Object.values(state.messages)
        .filter(message => message.is_pinned === 1)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort by timestamp (newest first)
    },
    
    isPinnedMessagesLoading: state => state.isPinnedMessagesLoading,
    
    isMessagePinned: state => id => {
      return state.messages[id] && state.messages[id].is_pinned === 1;
    },
    
    getRecommendedMessageIds: state => {
      return state.recommendedMessageIds;
    }
  }
}

