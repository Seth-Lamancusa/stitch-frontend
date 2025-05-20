import MessageService from '../../services/MessageService'
import WebSocketService from '../../services/WebSocketService'

// Helper function to check if a message is a descendant of another
function isDescendantOf(state, messageId, ancestorId) {
  if (!messageId || !ancestorId || messageId === ancestorId) return false;
  
  let currentId = messageId;
  
  // Traverse up the parent chain
  while (currentId) {
    const message = state.messages[currentId];
    if (!message) break;
    
    // If this message's parent is the ancestor, it's a direct descendant
    if (message.parent_id === ancestorId) {
      return true;
    }
    
    // Move up to the parent
    currentId = message.parent_id;
  }
  
  return false;
}

export default {
  namespaced: true,
  
  state: {
    // Flat storage of messages by ID
    messages: {},
    
    // Track total unread message count
    unreadMessageCount: 0,
    
    // Track loading states for various operations
    loadingStates: {},
    
    // Store the selected profile for profile filtering
    selectedProfile: null
  },
  
  mutations: {
    SET_MESSAGE(state, message) {
      console.log('[DEBUG] messages.js - SET_MESSAGE received message:', {
        id: message.id,
        author_display_name: message.author_display_name,
        author_user_tag: message.author_user_tag,
        content_author: message.content_author,
        for_tab: message.for_tab
      });
      
      // Ensure child_ids is always an array
      if (!message.child_ids) {
        message.child_ids = [];
      }

      // Convert single for_tab to array if it's a string
      if (message.for_tab && typeof message.for_tab === 'string') {
        message.for_tabs = [message.for_tab];
        // Keep for_tab for backward compatibility
        message.for_tab = message.for_tab;
      } else if (message.for_tab && Array.isArray(message.for_tab)) {
        message.for_tabs = [...message.for_tab];
        // Set for_tab to the first element for backward compatibility
        message.for_tab = message.for_tab[0];
      } else if (message.for_tabs && Array.isArray(message.for_tabs)) {
        // Already using for_tabs array, keep it
        // Set for_tab to the first element for backward compatibility if not empty
        if (message.for_tabs.length > 0) {
          message.for_tab = message.for_tabs[0];
        }
      } else {
        message.for_tabs = [];
      }
      
      // Check if message already exists in store - if so, merge it
      const existingMessage = state.messages[message.id];
      if (existingMessage) {
        // Preserve branch_child if it exists
        const currentBranchChild = existingMessage.branch_child;
        
        // Handle merging child_ids from existing and new message
        let mergedChildIds = [...message.child_ids];
        if (existingMessage.child_ids && existingMessage.child_ids.length > 0) {
          // Combine child IDs without duplicates
          mergedChildIds = [...new Set([...existingMessage.child_ids, ...message.child_ids])];
        }
        
        // Merge for_tabs arrays without duplicates
        let mergedForTabs = [...(message.for_tabs || [])];
        if (existingMessage.for_tabs && existingMessage.for_tabs.length > 0) {
          mergedForTabs = [...new Set([...existingMessage.for_tabs, ...(message.for_tabs || [])])];
        }

        // Create the merged message
        const mergedMessage = {
          ...existingMessage, // Start with existing message properties
          ...message,         // Override with new message properties
          for_tabs: mergedForTabs, // Use the merged for_tabs array
          child_ids: mergedChildIds // Use combined child_ids
        };
        
        // Set for_tab to the first element of for_tabs for backward compatibility
        if (mergedForTabs.length > 0) {
          mergedMessage.for_tab = mergedForTabs[0];
        }
        
        // Default branch_child to first child if there are children and no previous selection
        const hasChildren = mergedChildIds.length > 0;
        if (hasChildren && currentBranchChild === undefined) {
          mergedMessage.branch_child = mergedChildIds[0];
        } else if (hasChildren) {
          // Keep existing selection if it's still valid
          const isBranchChildValid = mergedChildIds.includes(currentBranchChild);
          mergedMessage.branch_child = isBranchChildValid ? currentBranchChild : mergedChildIds[0];
        } else {
          mergedMessage.branch_child = null;
        }
        
        // Update the store with merged message
        state.messages[message.id] = mergedMessage;
      } else {
        // New message, not in store yet
        // Default branch_child to first child if there are children
        const hasChildren = message.child_ids && message.child_ids.length > 0;
        if (hasChildren) {
          message.branch_child = message.child_ids[0];
        } else {
          message.branch_child = null;
        }
        
        // Add to store
        state.messages[message.id] = { 
          ...message,
          for_tabs: message.for_tabs || [] // Ensure for_tabs is set
        };
      }
    },
    
    SET_MESSAGES(state, messages) {
      for (const message of messages) {
        // Use SET_MESSAGE mutation to handle each message individually
        // This ensures consistent logic for merging messages
        if (message && message.id) {
          this.commit('messages/SET_MESSAGE', message);
        }
      }
    },
    
    // Consolidated branch path mutation
    SET_BRANCH_PATH(state, messageId) {
      // First ensure the message exists
      if (!state.messages[messageId]) return;
      
      // Set this message's branch path flag to true
      state.messages[messageId] = {
        ...state.messages[messageId],
        in_branch_path: true
      };
      
      // If the message has a parent, remove all siblings from branch path
      const parentId = state.messages[messageId].parent_id;
      if (parentId && state.messages[parentId] && state.messages[parentId].child_ids) {
        state.messages[parentId].child_ids.forEach(childId => {
          if (childId !== messageId && state.messages[childId]) {
            state.messages[childId] = {
              ...state.messages[childId],
              in_branch_path: false
            };
          }
        });
      }
    },
    
    // Restore REMOVE_MESSAGE mutation
    REMOVE_MESSAGE(state, messageId) {
      // First check if message exists
      if (!state.messages[messageId]) return;
      
      // If this message has a parent, remove it from parent's child_ids
      const message = state.messages[messageId];
      if (message.parent_id && state.messages[message.parent_id]) {
        const parent = state.messages[message.parent_id];
        if (parent.child_ids) {
          const index = parent.child_ids.indexOf(messageId);
          if (index !== -1) {
            // Create a new array without the deleted message ID
            const newChildIds = [...parent.child_ids];
            newChildIds.splice(index, 1);
            
            // Update the parent with new child_ids array
            state.messages[message.parent_id] = {
              ...parent,
              child_ids: newChildIds
            };
          }
        }
      }
      
      // Delete the message
      delete state.messages[messageId];
    },
    
    // Restore REMOVE_TEMP_THREAD mutation
    REMOVE_TEMP_THREAD(state, threadId) {
      if (state.messages[threadId]) {
        delete state.messages[threadId];
      }
    },
    
    UPDATE_PIN_STATUS(state, { messageId, isPinned }) {
      if (state.messages[messageId]) {
        state.messages[messageId].is_pinned = isPinned ? 1 : 0;
      }
    },
    
    // New mutation to change selected child
    SET_BRANCH_CHILD(state, { messageId, childId }) {
      const message = state.messages[messageId];
      if (!message) return;
      
      // Verify childId is a valid child
      if (message.child_ids && message.child_ids.includes(childId)) {
        state.messages[messageId] = {
          ...message,
          branch_child: childId
        };
      }
    },
    
    // New mutation for WebSocket updates
    ADD_CHILD_TO_PARENT(state, { parentId, childId }) {
      const parent = state.messages[parentId];
      if (parent && !parent.child_ids.includes(childId)) {
        state.messages[parentId] = {
          ...parent,
          child_ids: [...(parent.child_ids || []), childId]
        };
      }
    },
    
    // Add a new mutation to update the read status of a message
    UPDATE_MESSAGE_READ_STATUS(state, { messageId, isRead }) {
      if (state.messages[messageId]) {
        state.messages[messageId] = {
          ...state.messages[messageId],
          is_read: isRead
        };
      }
    },

    // Add a new mutation to update the unread message count
    SET_UNREAD_MESSAGE_COUNT(state, count) {
      state.unreadMessageCount = count;
    },

    // Add a new mutation to track loading states
    SET_LOADING(state, { key, isLoading }) {
      state.loadingStates[key] = isLoading;
    },

    // Add new mutation for setting selected profile
    SET_SELECTED_PROFILE(state, profile) {
      state.selectedProfile = profile;
    }
  },
  
  actions: {
    isTemporaryId(id) {
      return typeof id === 'string' && id.toString().startsWith('temp-');
    },
    
    // Simplified message loading - single message only
    async loadMessage({ commit, state }, messageId) {
      // Return cached message if available
      if (state.messages[messageId]) {
        return state.messages[messageId];
      }
      
      try {
        const response = await MessageService.getMessage(messageId);
        const message = response.data;
        
        if (message) {
          commit('SET_MESSAGE', message);
          return message;
        } else {
          return null;
        }
      } catch (error) {
        console.error(`Error loading message ${messageId}:`, error);
        return null;
      }
    },
    
    // NEW ACTION: Prepare branch path by setting branch_child relationships
    // This should be called before using getVisibleBranchMessages
    prepareBranchPath({ commit, state }, threadRootId) {
      if (!threadRootId || !state.messages[threadRootId]) {
        console.log(`[prepareBranchPath] ⚠️ Cannot prepare path: message ${threadRootId} not found`);
        return false;
      }
      
      console.log(`[prepareBranchPath] 🌳 PREPARE_PATH starting for message ID: ${threadRootId}, called by:`, new Error().stack);
      
      // STEP 1: First trace UPWARD to find the highest ancestor in the store
      let startingMessage = state.messages[threadRootId];
      let highestAncestor = startingMessage;
      let childMessage = startingMessage;
      let currentParentId = startingMessage.parent_id;
      
      // Trace up through parent_id as far as we can go
      while (currentParentId && state.messages[currentParentId]) {
        const parentMessage = state.messages[currentParentId];
        console.log(`[prepareBranchPath] 🌳 PREPARE_PATH tracing upward: found parent ${currentParentId} for child ${childMessage.id}`);
        
        // Set this parent's branch_child to point to the child we came from
        console.log(`[prepareBranchPath] 🌳 PREPARE_PATH setting branch_child of ${currentParentId} to ${childMessage.id}`);
        commit('SET_BRANCH_CHILD', { 
          messageId: currentParentId, 
          childId: childMessage.id 
        });
        
        // Move up one level
        highestAncestor = parentMessage;
        childMessage = parentMessage;
        currentParentId = parentMessage.parent_id;
      }
      
      console.log(`[prepareBranchPath] 🌳 PREPARE_PATH highest ancestor found: ${highestAncestor.id}`);
      
      // STEP 2: Now follow the branch path down, ensuring each node has branch_child set
      let currentMessage = highestAncestor;
      
      // Log the downward path that will be created
      console.log(`[prepareBranchPath] 🌳 PREPARE_PATH beginning downward traversal from ${highestAncestor.id}`);
      
      // Trace downward, ensuring each node has a branch_child if it has children
      while (true) {
        // If message has no branch child but has child_ids, set first child as branch_child
        if (!currentMessage.branch_child && currentMessage.child_ids && currentMessage.child_ids.length > 0) {
          console.log(`[prepareBranchPath] 🌳 PREPARE_PATH setting branch_child for ${currentMessage.id} to first child ${currentMessage.child_ids[0]}`);
          
          commit('SET_BRANCH_CHILD', { 
            messageId: currentMessage.id, 
            childId: currentMessage.child_ids[0] 
          });
          
          // Get updated message reference
          currentMessage = state.messages[currentMessage.id];
        }
        
        // If message has no branch child (even after trying to set one), break
        if (!currentMessage.branch_child) {
          console.log(`[prepareBranchPath] 🌳 PREPARE_PATH no branch_child for ${currentMessage.id}, ending traversal`);
          break;
        }
        
        const childId = currentMessage.branch_child;
        
        // If child doesn't exist in the store, break
        if (!state.messages[childId]) {
          console.log(`[prepareBranchPath] 🌳 PREPARE_PATH child ${childId} not found in store, ending traversal`);
          break;
        }
        
        // Move to the next message
        console.log(`[prepareBranchPath] 🌳 PREPARE_PATH traversing to child ${childId}`);
        currentMessage = state.messages[childId];
      }
      
      console.log(`[prepareBranchPath] 🌳 PREPARE_PATH complete for message ID: ${threadRootId}`);
      return true;
    },
    
    // Consolidated branch path management
    setBranchPath({ commit, state }, messageId) {
      if (!messageId || !state.messages[messageId]) return;
      
      // Ensure this message is in branch path
      commit('SET_BRANCH_PATH', messageId);
      
      // If message has parent in store, add parent to branch path
      const message = state.messages[messageId];
      if (message.parent_id && state.messages[message.parent_id]) {
        commit('SET_BRANCH_PATH', message.parent_id);
      }
      
      console.log(`[DEBUG] Set branch path for message ${messageId}`);
      return true;
    },
    
    // Load parent branch
    async loadMessageBranchUp({ commit, dispatch, state }, { messageId, depth = 1 }) {
      if (!messageId) return [];
      
      try {
        // Call the backend endpoint for efficient branch loading
        const response = await MessageService.loadBranchUp(messageId, depth);
        const messages = response.data || [];
        
        if (messages.length > 0) {
          // Add messages to store
          commit('SET_MESSAGES', messages);
          
          // Add all messages to branch path
          for (const message of messages) {
            dispatch('setBranchPath', message.id);
          }
          
          console.log(`[DEBUG] Loaded ${messages.length} messages in parent branch for ${messageId}`);
        }
        
        return messages;
      } catch (error) {
        console.error(`Error loading parent branch for ${messageId}:`, error);
        return [];
      }
    },
    
    // Load child branch
    async loadMessageBranchDown({ commit, dispatch, state }, { messageId, depth = 1 }) {
      if (!messageId) return [];
      
      try {
        // Call the backend endpoint for efficient branch loading
        const response = await MessageService.loadBranchDown(messageId, depth);
        const messages = response.data || [];
        
        if (messages.length > 0) {
          // Add messages to store
          commit('SET_MESSAGES', messages);
          
          // Add first message in each level to branch path
          // First message is guaranteed to be the start message
          dispatch('setBranchPath', messages[0].id);
          
          // For each subsequent message, if it's a direct child of a previous message
          // in the branch path, add it to the branch path as well
          for (let i = 1; i < messages.length; i++) {
            const message = messages[i];
            const parent = message.parent_id ? state.messages[message.parent_id] : null;
            
            if (parent && parent.in_branch_path) {
              // Only add first child of each parent to branch path
              const siblings = messages.filter(m => m.parent_id === parent.id);
              if (siblings.length > 0 && siblings[0].id === message.id) {
                dispatch('setBranchPath', message.id);
              }
            }
          }
          
          console.log(`[DEBUG] Loaded ${messages.length} messages in child branch for ${messageId}`);
        }
        
        return messages;
      } catch (error) {
        console.error(`Error loading children branch for ${messageId}:`, error);
        return [];
      }
    },
    
    // Send a reply to a message
    async sendReply({ commit, dispatch, rootState, state }, { parentId, content, isPrivate, recipients, content_author }) {
      try {
        // Use the current user if content_author is not provided
        const effectiveAuthor = content_author || rootState.user?.email;
        
        // Process recipients to extract UIDs
        let recipientUids = [];
        if (recipients && recipients.length > 0) {
          recipientUids = recipients.map(recipient => {
            // If recipient is already an object with a uid
            if (typeof recipient === 'object' && recipient.uid) {
              return recipient.uid;
            }
            // If recipient is a string (backward compatibility)
            else if (typeof recipient === 'string') {
              return recipient; // Will be resolved by server
            }
            return null;
          }).filter(uid => uid !== null); // Remove any nulls
        }
        
        // Only add the author as recipient in private messages with no recipients
        // to ensure they can see their own message
        if (isPrivate && recipientUids.length === 0 && effectiveAuthor) {
          // If effectiveAuthor is an email, it will be resolved to UID by server
          recipientUids.push(effectiveAuthor);
        }
        
        // Make API call to create the reply
        const response = await MessageService.sendReply(
          parentId, 
          content, 
          isPrivate, 
          recipientUids, 
          effectiveAuthor
        );
        
        const newMessage = response.data;
        
        // Add to store
        commit('SET_MESSAGE', newMessage);
        
        // Set the new message as the branch child of the parent if parent exists
        if (parentId && state.messages[parentId]) {
          dispatch('setBranchChild', {
            messageId: parentId,
            childId: newMessage.id
          });
        }
        
        // No need to subscribe here, ThreadView handles WebSocket subscriptions
        
        return newMessage;
      } catch (error) {
        console.error("Error sending reply:", error);
        throw error;
      }
    },
    
    // Delete a message
    async deleteMessage({ commit, state, dispatch }, messageId) {
      try {
        console.log(`Deleting message: ${messageId}`);
        
        // Save reference to the message before deletion
        const messageToDelete = state.messages[messageId];
        
        // If message doesn't exist, just return
        if (!messageToDelete) {
          return true;
        }
        
        // Get parent ID before deletion
        const parentId = messageToDelete.parent_id;
        
        // API call to delete the message
        await MessageService.deleteMessage(messageId);
        
        // Check if this message was the branch_child of its parent
        let wasParentBranchChild = false;
        let parentMessage = null;
        
        if (parentId && state.messages[parentId]) {
          parentMessage = state.messages[parentId];
          wasParentBranchChild = parentMessage.branch_child === messageId;
        }
        
        // Remove from store
        commit('REMOVE_MESSAGE', messageId);
        
        // If this was the parent's branch_child, set a new one
        if (wasParentBranchChild && parentMessage && parentMessage.child_ids && parentMessage.child_ids.length > 0) {
          // Get updated parent after REMOVE_MESSAGE might have modified it
          const updatedParent = state.messages[parentId];
          
          // If parent has remaining children, set the first one as branch_child
          if (updatedParent && updatedParent.child_ids && updatedParent.child_ids.length > 0) {
            commit('SET_BRANCH_CHILD', { 
              messageId: parentId, 
              childId: updatedParent.child_ids[0] 
            });
            
            // Prepare branch path with the new branch_child
            dispatch('prepareBranchPath', parentId);
          }
        }
        
        return true;
      } catch (error) {
        console.error('Error deleting message:', error);
        throw error;
      }
    },
    
    // Fetch threads based on active tab
    async fetchThreads({ commit, rootState, dispatch }) {
      try {
        // Set loading state in UI
        commit('ui/SET_LOADING', { key: 'threads', value: true }, { root: true });
        
        const response = await MessageService.getPinnedMessages(50);
        const messages = response.data || [];
        
        // Process messages to get reply counts
        const messagesWithChildCounts = [];
        for (let message of messages) {
          // Add to list
          messagesWithChildCounts.push(message);
        }
        
        // Commit all messages to store
        commit('SET_MESSAGES', messagesWithChildCounts);
        
        // Clear loading state
        commit('ui/SET_LOADING', { key: 'threads', value: false }, { root: true });
        return messagesWithChildCounts;
      } catch (error) {
        commit('ui/SET_LOADING', { key: 'threads', value: false }, { root: true });
        commit('ui/SET_ERROR', error.message || 'Failed to load messages', { root: true });
        console.error('Error fetching threads:', error);
        return [];
      }
    },
    
    // Fetch feed messages (Feed tab)
    async fetchFeedMessages({ commit, rootState, dispatch }, { cursor = null } = {}) {
      try {
        // Set loading state in UI
        commit('ui/SET_LOADING', { key: 'threads', value: true }, { root: true });
        
        // For Feed tab, special behavior:
        // - First call (cursor = null): get ALL pinned messages
        // - Second call (cursor = "PINNED_DONE"): get first batch of regular public messages
        // - Subsequent calls (cursor = timestamp string): get next batch of regular messages
        
        console.log(`[DEBUG] Fetching feed messages - cursor: ${cursor}`);
        
        const response = await MessageService.getPublicMessages(10, cursor);
        const messages = response.data.messages || [];
        const exhausted = response.data.exhausted || false;
        const nextCursor = response.data.next_cursor;
        
        console.log(`[DEBUG] Feed response - messages: ${messages.length}, exhausted: ${exhausted}, nextCursor: ${nextCursor}`);
        
        // Commit all messages to store
        commit('SET_MESSAGES', messages);
        
        // Clear loading state
        commit('ui/SET_LOADING', { key: 'threads', value: false }, { root: true });
        
        // Return the response data with exhausted flag and next cursor
        return {
          messages,
          exhausted,
          nextCursor
        };
      } catch (error) {
        commit('ui/SET_LOADING', { key: 'threads', value: false }, { root: true });
        commit('ui/SET_ERROR', error.message || 'Failed to load feed messages', { root: true });
        console.error('Error fetching feed messages:', error);
        return {
          messages: [],
          exhausted: true,
          nextCursor: null
        };
      }
    },
    
    // Fetch curated messages (Curated tab)
    async fetchCuratedMessages({ commit, rootState, dispatch }, { cursor = null } = {}) {
      try {
        // Set loading state in UI
        commit('ui/SET_LOADING', { key: 'threads', value: true }, { root: true });
        
        console.log(`[DEBUG] Fetching curated messages - cursor: ${cursor}`);
        
        const response = await MessageService.getCuratedMessages(10, cursor);
        const messages = response.data.messages || [];
        const exhausted = response.data.exhausted || false;
        const nextCursor = response.data.next_cursor;
        
        // Commit all messages to store
        commit('SET_MESSAGES', messages);
        
        // Clear loading state
        commit('ui/SET_LOADING', { key: 'threads', value: false }, { root: true });
        
        // Return the response data with exhausted flag and next cursor
        return {
          messages,
          exhausted,
          nextCursor
        };
      } catch (error) {
        commit('ui/SET_LOADING', { key: 'threads', value: false }, { root: true });
        commit('ui/SET_ERROR', error.message || 'Failed to load curated messages', { root: true });
        console.error('Error fetching curated messages:', error);
        return {
          messages: [],
          exhausted: true,
          nextCursor: null
        };
      }
    },
    
    // Fetch direct messages (Direct tab)
    async fetchDirectMessages({ commit, rootState, dispatch }, { cursor = null } = {}) {
      try {
        // Set loading state in UI
        commit('ui/SET_LOADING', { key: 'threads', value: true }, { root: true });
        
        console.log(`[DEBUG] Fetching direct messages - cursor: ${cursor}`);
        
        const response = await MessageService.getDirectMessages(10, cursor);
        const messages = response.data.messages || [];
        const exhausted = response.data.exhausted || false;
        const nextCursor = response.data.next_cursor;
        
        // Commit all messages to store
        commit('SET_MESSAGES', messages);
        
        // Clear loading state
        commit('ui/SET_LOADING', { key: 'threads', value: false }, { root: true });
        
        // Return the response data with exhausted flag and next cursor
        return {
          messages,
          exhausted,
          nextCursor
        };
      } catch (error) {
        commit('ui/SET_LOADING', { key: 'threads', value: false }, { root: true });
        commit('ui/SET_ERROR', error.message || 'Failed to load direct messages', { root: true });
        console.error('Error fetching direct messages:', error);
        return {
          messages: [],
          exhausted: true,
          nextCursor: null
        };
      }
    },
    
    // Fetch user's own messages (Profile tab)
    async fetchUserMessages({ commit, rootState, dispatch, state }, { cursor = null, userId = null } = {}) {
      try {
        // Set loading state in UI
        commit('ui/SET_LOADING', { key: 'threads', value: true }, { root: true });
        
        console.log(`[DEBUG] Fetching user messages - cursor: ${cursor}, userId: ${userId}`);
        
        // Use the dedicated by-user endpoint
        const response = await MessageService.getUserMessages(10, cursor, userId);
        const messages = response.data.messages || [];
        const exhausted = response.data.exhausted || false;
        const nextCursor = response.data.next_cursor;
        
        // Commit all messages to store
        commit('SET_MESSAGES', messages);
        
        // Clear loading state
        commit('ui/SET_LOADING', { key: 'threads', value: false }, { root: true });
        
        // Return the response data with exhausted flag and next cursor
        return {
          messages,
          exhausted,
          nextCursor
        };
      } catch (error) {
        commit('ui/SET_LOADING', { key: 'threads', value: false }, { root: true });
        commit('ui/SET_ERROR', error.message || 'Failed to load user messages', { root: true });
        console.error('Error fetching user messages:', error);
        return {
          messages: [],
          exhausted: true,
          nextCursor: null
        };
      }
    },
    
    removeTemporaryThread({ commit }, threadId) {
      commit('REMOVE_TEMP_THREAD', threadId);
    },
    
    // Clear cache of all loaded messages (except thread preview messages needed for list view)
    async clearCache({ commit, state, rootState }) {
      console.log('[DEBUG] Clearing messages cache');
      
      // Keep a record of thread preview messages (those shown in list view)
      // This is more efficient than reloading them when returning to list view
      const threadsToKeep = {};
      
      // Find top-level thread messages (those with no parent or parent not loaded)
      Object.values(state.messages).forEach(message => {
        // If message has no parent or parent isn't loaded, it's likely a thread root
        const isThreadRoot = !message.parent_id || !state.messages[message.parent_id];
        
        if (isThreadRoot) {
          // Keep the minimal info needed for list view
          threadsToKeep[message.id] = {
            ...message,
            // Clear branch path information
            in_branch_path: false,
          };
        }
      });
      
      // Clear the state and re-add only the thread previews
      state.messages = { ...threadsToKeep };
      
      return true;
    },
    
    // Pin a message (admin only)
    async pinMessage({ commit }, messageId) {
      try {
        await MessageService.pinMessage(messageId);
        
        // Update the message in the store
        commit('UPDATE_PIN_STATUS', { messageId, isPinned: true });
        
        return true;
      } catch (error) {
        console.error('Error pinning message:', error);
        throw error;
      }
    },
    
    // Unpin a message (admin only)
    async unpinMessage({ commit }, messageId) {
      try {
        await MessageService.unpinMessage(messageId);
        commit('UPDATE_PIN_STATUS', { messageId, isPinned: false });
        return true;
      } catch (error) {
        console.error(`Error unpinning message ${messageId}:`, error);
        return false;
      }
    },
    
    // New action for updating title and description
    async updateTitleDescription({ commit, state }, { messageId, title, description }) {
      try {
        await MessageService.updateTitleDescription(messageId, { title, description });
        
        // Update the message in the store
        const message = state.messages[messageId];
        if (message) {
          commit('SET_MESSAGE', {
            ...message,
            title,
            description
          });
        }
        
        return true;
      } catch (error) {
        console.error(`Error updating title/description for message ${messageId}:`, error);
        return false;
      }
    },
    
    // Mark a message as read and update unread count
    async markMessageAsRead({ commit, state }, messageId) {
      try {
        // Check if message is currently unread before making API call
        const message = state.messages[messageId];
        const wasUnread = message && message.is_read === false;
        
        await MessageService.markMessageAsRead(messageId);
        commit('UPDATE_MESSAGE_READ_STATUS', { messageId, isRead: true });
        
        // If the message was previously unread, decrement the unread count
        if (wasUnread) {
          commit('SET_UNREAD_MESSAGE_COUNT', Math.max(0, state.unreadMessageCount - 1));
        }
        
        return true;
      } catch (error) {
        console.error(`Error marking message ${messageId} as read:`, error);
        return false;
      }
    },
    
    // Mark a message as unread and update unread count
    async markMessageAsUnread({ commit, state }, messageId) {
      try {
        // Check if message is currently read before making API call
        const message = state.messages[messageId];
        const wasRead = message && message.is_read !== false;
        
        await MessageService.markMessageAsUnread(messageId);
        commit('UPDATE_MESSAGE_READ_STATUS', { messageId, isRead: false });
        
        // If the message was previously read, increment the unread count
        if (wasRead) {
          commit('SET_UNREAD_MESSAGE_COUNT', state.unreadMessageCount + 1);
        }
        
        return true;
      } catch (error) {
        console.error(`Error marking message ${messageId} as unread:`, error);
        return false;
      }
    },
    
    // New action to set selected child
    setBranchChild({ commit, state }, { messageId, childId }) {
      // Return early if message doesn't exist
      if (!state.messages[messageId]) return false;
      
      const message = state.messages[messageId];
      
      // Return early if not a valid child
      if (!message.child_ids || !message.child_ids.includes(childId)) {
        return false;
      }
      
      commit('SET_BRANCH_CHILD', { messageId, childId });
      return true;
    },
    
    // New action to handle sibling navigation
    async navigateToSibling({ commit, state, dispatch, rootState }, { messageId, direction }) {
      const message = state.messages[messageId];
      if (!message || !message.child_ids || message.child_ids.length <= 1) {
        return false;
      }
      
      const currentChildId = message.branch_child;
      const currentIndex = message.child_ids.indexOf(currentChildId);
      
      if (currentIndex === -1) {
        // If no valid current child, default to first
        commit('SET_BRANCH_CHILD', { 
          messageId: messageId, 
          childId: message.child_ids[0] 
        });
        return true;
      }
      
      let newIndex;
      if (direction === 'prev') {
        newIndex = Math.max(0, currentIndex - 1);
      } else {
        newIndex = Math.min(message.child_ids.length - 1, currentIndex + 1);
      }
      
      // Only update if actually changing
      if (newIndex !== currentIndex) {
        const newChildId = message.child_ids[newIndex];
        const oldChildId = currentChildId;
        
        // Check if the new sibling is loaded in the store
        const isNewChildLoaded = !!state.messages[newChildId];
        
        // If the sibling isn't loaded, load it before changing branch_child
        if (!isNewChildLoaded) {
          console.log(`[navigateToSibling] Target sibling ${newChildId} not loaded, loading it first`);
          
          // We need to load this message before we can navigate to it
          try {
            // Show loading state
            commit('SET_LOADING', { key: `sibling_${messageId}`, isLoading: true });
            
            // Load the message
            await dispatch('loadMessage', newChildId);
            
            // If this loaded successfully, load its children too
            if (state.messages[newChildId]) {
              // Load its children to populate branch
              await dispatch('loadMessageBranchDown', {
                messageId: newChildId,
                depth: 2
              });
            }
            
            // End loading state
            commit('SET_LOADING', { key: `sibling_${messageId}`, isLoading: false });
          } catch (error) {
            console.error(`[navigateToSibling] Failed to load sibling ${newChildId}:`, error);
            commit('SET_LOADING', { key: `sibling_${messageId}`, isLoading: false });
            return false;
          }
        }
        
        // Update the branch child
        commit('SET_BRANCH_CHILD', { 
          messageId: messageId, 
          childId: newChildId 
        });
        
        // Get current selected message ID
        const selectedMessageId = rootState.navigation?.selectedMessageId;
        
        // Check if the previous sibling was selected
        const wasCurrentChildSelected = selectedMessageId === oldChildId;
        
        // Check if the current selection is downstream of the old sibling
        let isSelectionDownstream = false;
        if (selectedMessageId && selectedMessageId !== oldChildId) {
          // Check if the selected message is a descendant of the old child
          isSelectionDownstream = isDescendantOf(state, selectedMessageId, oldChildId);
        }
        
        // Handle selection state
        if (wasCurrentChildSelected) {
          // If previous sibling was selected, select the new sibling
          console.log(`[navigateToSibling] Auto-selecting new sibling ${newChildId} because previous sibling was selected`);
          dispatch('navigation/selectMessage', newChildId, { root: true });
        } else if (isSelectionDownstream) {
          // If selection is downstream of old sibling, clear selection
          console.log(`[navigateToSibling] Clearing selection because selected message ${selectedMessageId} is downstream of old sibling ${oldChildId}`);
          dispatch('navigation/selectMessage', null, { root: true });
        } else {
          console.log(`[navigateToSibling] Not changing selection state`);
        }
        
        return true;
      }
      
      return false;
    },
    
    // Import a ChatGPT conversation
    async importChatGPT({ commit, dispatch }, { content, isPublic, recipients }) {
      try {
        console.log(`Importing ChatGPT conversation (public: ${isPublic}, recipients: ${recipients.length})`);
        
        // Make API call to import the conversation
        const response = await MessageService.importChatGPT(content, isPublic, recipients);
        
        // Get the root message (first message of the thread)
        const rootMessage = response.data;
        
        // Add to store - the message will be a thread root
        if (rootMessage) {
          commit('SET_MESSAGE', rootMessage);
        }
        
        return rootMessage;
      } catch (error) {
        console.error('Error importing ChatGPT conversation:', error);
        throw error;
      }
    },

    // New action to fetch unread message count
    async fetchUnreadMessageCount({ commit }) {
      try {
        const response = await MessageService.getUnreadMessageCount();
        const count = response.data.count || 0;
        
        commit('SET_UNREAD_MESSAGE_COUNT', count);
        return count;
      } catch (error) {
        console.error('Error fetching unread message count:', error);
        return 0;
      }
    },

    // Add new action to set the selected profile
    setSelectedProfile({ commit, dispatch }, profile) {
      commit('SET_SELECTED_PROFILE', profile);
      
      // If we have a profile selected, fetch their messages
      if (profile) {
        dispatch('fetchUserMessages', { 
          cursor: null,
          userId: profile.uid
        });
      } else {
        // No profile selected, fetch default messages
        dispatch('fetchUserMessages', { cursor: null });
      }
      
      return profile;
    }
  },
  
  getters: {
    getMessage: (state) => (id) => {
      return state.messages[id];
    },
    
    getChildIds: state => parentId => {
      const message = state.messages[parentId];
      if (!message) return [];
      
      return message.child_ids || [];
    },
    
    getParentId: state => childId => {
      const message = state.messages[childId];
      if (!message) return null;
    
      return message.parent_id || null;
    },
    
    getLoadedMessages: state => {
      return Object.values(state.messages);
    },
    
    // Get all messages in the branch path
    getBranchPathMessages: (state) => {
      return Object.values(state.messages)
        .filter(message => message.in_branch_path);
    },
    
    // Modified getter - PURE GETTER with no state modifications
    // Get the visible branch - follows the path from root where each message is in branch_path
    getVisibleBranchMessages: (state) => (threadRootId = null) => {
      const result = [];
      
      // First try to use the explicitly provided threadRootId if available
      let startingMessage = threadRootId ? state.messages[threadRootId] : null;
      
      // If no explicit ID provided or message not found, fall back to finding the first root
      if (!startingMessage) {
        startingMessage = Object.values(state.messages)
          .find(msg => !msg.parent_id || (msg.parent_id && !state.messages[msg.parent_id]));
      }
      
      if (!startingMessage) return [];
      
      console.log(`[getVisibleBranchMessages] Starting with message ID: ${startingMessage.id}`);
      
      // STEP 1: First trace UPWARD to find the highest ancestor that's in the store
      let highestAncestor = startingMessage;
      let currentParentId = startingMessage.parent_id;
      
      // Trace up through parent_id as far as we can go
      while (currentParentId && state.messages[currentParentId]) {
        console.log(`[getVisibleBranchMessages] Tracing upward: found parent ${currentParentId}`);
        highestAncestor = state.messages[currentParentId];
        currentParentId = highestAncestor.parent_id;
      }
      
      console.log(`[getVisibleBranchMessages] Highest ancestor found: ${highestAncestor.id}`);
      
      // STEP 2: Now build the chain from highest ancestor down - NO STATE MODIFICATIONS
      // Start with the highest ancestor found
      result.push(highestAncestor);
      
      // Initialize currentMessage to highest ancestor to begin downward traversal
      let currentMessage = highestAncestor;
      
      // STEP 3: Recursively follow branch_child path downward - NO STATE MODIFICATIONS
      while (true) {
        // If message has no branch child, break
        if (!currentMessage.branch_child) {
          console.log(`[getVisibleBranchMessages] No branch_child found for ${currentMessage.id}, ending traversal`);
          break;
        }
        
        const childId = currentMessage.branch_child;
        
        // If child doesn't exist in the store, break
        if (!state.messages[childId]) {
          console.log(`[getVisibleBranchMessages] Child ${childId} not found in store, ending traversal`);
          break;
        }
        
        console.log(`[getVisibleBranchMessages] Adding branch_child ${childId} to result`);
        
        // Add the branch child to the result
        result.push(state.messages[childId]);
        
        // Move to the next message
        currentMessage = state.messages[childId];
      }
      
      console.log(`[getVisibleBranchMessages] Final chain length: ${result.length}, from ${result[0].id} to ${result[result.length-1].id}`);
      
      return result;
    },
    
    getReplyCount: state => (messageId) => {
      const message = state.messages[messageId];
      if (!message) return 0;
      
      // First check child_ids which should be most accurate
      if (message.child_ids && Array.isArray(message.child_ids)) {
        return message.child_ids.length;
      }
      
      // Fallback (will be deprecated)
      return 0;
    },
    
    // Get message branch (all messages in the current path)
    getMessageBranch: (state) => (messageId) => {
      const branch = [];
      let currentId = messageId;
      
      // Add self
      if (state.messages[currentId]) {
        branch.push(state.messages[currentId]);
      }
      
      // Add all ancestors
      while (true) {
        const message = state.messages[currentId];
        if (!message || !message.parent_id) break;
        
        const parentId = message.parent_id;
        const parent = state.messages[parentId];
        if (!parent) break;
        
        branch.unshift(parent);
        currentId = parentId;
      }
      
      return branch;
    },
    
    getPinnedMessages: (state, getters, rootState) => {
      const activeTab = rootState.ui?.activeTab || 'public';
      const currentUser = rootState.auth?.user;
      const userEmail = currentUser?.email;
      
      // Filter messages by is_pinned property
      return Object.values(state.messages)
        .filter(message => {
          // First ensure it's a pinned message
          const isPinned = message.is_pinned === 1 || message.is_pinned === true;
          if (!isPinned) return false;
          
          // Then filter based on the active tab
          const isPublic = message.public === 1 || message.public === true;
          const isUserRecipient = userEmail && message.recipients && 
            Array.isArray(message.recipients) && message.recipients.includes(userEmail);
            
          if (activeTab === 'public') {
            // Public tab: show pinned public messages
            return isPublic;
          } else {
            // Private tab: show pinned private messages OR public pinned messages where user is explicitly a recipient
            return !isPublic || isUserRecipient;
          }
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort by timestamp (newest first)
    },
    
    // Check if a message is in the branch path
    isInBranchPath: state => (messageId) => {
      return state.messages[messageId]?.in_branch_path === true;
    },
    
    // New getter to get the selected child of a message
    getBranchChild: (state) => (messageId) => {
      const message = state.messages[messageId];
      if (!message) return null;
      return message.branch_child;
    },
    
    isAtEndOfBranch: (state) => (messageId) => {
      const message = state.messages[messageId];
      if (!message) return false;
      
      // We're at the end if:
      // 1. There are no child_ids array
      // 2. The child_ids array is empty
      // 3. All child_ids are loaded in the store
      if (!message.child_ids || message.child_ids.length === 0) {
        return true;
      }
      
      // Check if all children are loaded
      return message.child_ids.every(childId => state.messages[childId]);
    },

    // Getter for unread message count
    getUnreadMessageCount: state => state.unreadMessageCount,

    // Add a getter to check loading state
    isLoading: state => key => {
      return state.loadingStates[key] === true;
    },

    // Add new getter for selected profile
    getSelectedProfile: state => state.selectedProfile
  }
}

