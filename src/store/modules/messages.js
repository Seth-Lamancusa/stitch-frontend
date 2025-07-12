import MessageService from '../../services/MessageService'
import UserService from '../../services/UserService'
import WebSocketService from '../../services/WebSocketService'

// Add a flag to track if initial fetch has been done
let initialUnreadCountFetched = false;

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

// Helper function to check if a message is unread (treats null and false as unread)
function isMessageUnread(message) {
  return message && (message.is_read === false || message.is_read === null);
}

// Helper function to check if a message is read (only true is considered read)
function isMessageRead(message) {
  return message && message.is_read === true;
}

export default {
  namespaced: true,
  
  state: {
    // Flat storage of messages by ID
    messages: {},

    // Simplified filters object that includes sorting
    filters: {
      authors: [],
      recipients: [],
      isPublic: 'all', // Changed from boolean to string: 'public', 'private', 'all'
      dateRange: { start: null, end: null },
      sortOrder: 'newest' // 'newest' or 'oldest'
    },
    
    // Track total unread message count
    unreadMessageCount: 0,

    // Track loading states for various operations
    loadingStates: {},

  },
  
  mutations: {
    SET_MESSAGE(state, message) {
      console.log('[DEBUG] messages.js - SET_MESSAGE received message:', {
        id: message.id,
        author_display_name: message.author_display_name,
        author_user_tag: message.author_user_tag,
        content_author: message.content_author,
        parent_id: message.parent_id,
        child_ids: message.child_ids
      });
      
      // Ensure child_ids is always an array
      if (!message.child_ids) {
        message.child_ids = [];
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

        // Create the merged message
        const mergedMessage = {
          ...existingMessage, // Start with existing message properties
          ...message,         // Override with new message properties
          child_ids: mergedChildIds // Use combined child_ids
        };
        
        // Default branch_child to last child if there are children and no previous selection (most recent)
        const hasChildren = mergedChildIds.length > 0;
        if (hasChildren && currentBranchChild === undefined) {
          mergedMessage.branch_child = mergedChildIds[mergedChildIds.length - 1];
        } else if (hasChildren) {
          // Keep existing selection if it's still valid
          const isBranchChildValid = mergedChildIds.includes(currentBranchChild);
          mergedMessage.branch_child = isBranchChildValid ? currentBranchChild : mergedChildIds[mergedChildIds.length - 1];
        } else {
          mergedMessage.branch_child = null;
        }
        
        // Update the store with merged message
        state.messages[message.id] = mergedMessage;
      } else {
        // New message, not in store yet
        // Default branch_child to last child if there are children (most recent)
        const hasChildren = message.child_ids && message.child_ids.length > 0;
        if (hasChildren) {
          message.branch_child = message.child_ids[message.child_ids.length - 1];
        } else {
          message.branch_child = null;
        }
        
        // Add to store
        state.messages[message.id] = { ...message };
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
    
    // Optimized cascade delete (matches backend behavior)
    REMOVE_MESSAGE_CASCADE(state, messageId) {
      // Helper function to recursively collect all descendants
      const collectDescendants = (msgId, collected = new Set()) => {
        if (collected.has(msgId)) return collected; // Prevent infinite loops
        
        const message = state.messages[msgId];
        if (!message) return collected;
        
        collected.add(msgId);
        
        // Recursively collect all children
        if (message.child_ids && message.child_ids.length > 0) {
          for (const childId of message.child_ids) {
            collectDescendants(childId, collected);
          }
        }
        
        return collected;
      };

      // Get all messages that need to be deleted (including descendants)
      const messagesToDelete = collectDescendants(messageId);
      
      console.log(`[REMOVE_MESSAGE_CASCADE] Deleting ${messagesToDelete.size} messages:`, Array.from(messagesToDelete));
      
      // Optimized deletion: collect all parent updates first, then delete all messages
      const parentUpdates = new Map();
      
      // First pass: collect all parent updates needed
      for (const msgId of messagesToDelete) {
        const message = state.messages[msgId];
        if (message && message.parent_id && state.messages[message.parent_id] && !messagesToDelete.has(message.parent_id)) {
          // Only update parents that aren't being deleted themselves
          if (!parentUpdates.has(message.parent_id)) {
            parentUpdates.set(message.parent_id, new Set(state.messages[message.parent_id].child_ids || []));
          }
          // Remove this message from its parent's child_ids
          parentUpdates.get(message.parent_id).delete(msgId);
        }
      }
      
      // Apply all parent updates
      for (const [parentId, newChildIds] of parentUpdates) {
        if (state.messages[parentId]) {
          state.messages[parentId] = {
            ...state.messages[parentId],
            child_ids: Array.from(newChildIds)
          };
        }
      }
      
      // Second pass: delete all messages
      for (const msgId of messagesToDelete) {
        if (state.messages[msgId]) {
          delete state.messages[msgId];
        }
      }
    },
    
    // Restore REMOVE_TEMP_THREAD mutation

    
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

    // Consolidated filter mutations
    SET_FILTERS(state, filters) {
      state.filters = {
        ...state.filters,
        ...filters
      };
    },

    SET_AUTHORS(state, authors) {
      state.filters.authors = authors;
    },

    SET_RECIPIENTS(state, recipients) {
      state.filters.recipients = recipients;
    },

    SET_IS_PUBLIC(state, isPublic) {
      console.log('[Store mutation] SET_IS_PUBLIC called with value:', isPublic);
      state.filters.isPublic = isPublic;
      console.log('[Store mutation] isPublic filter updated in state to:', state.filters.isPublic);
    },

    SET_DATE_RANGE(state, { start, end }) {
      state.filters.dateRange = { start, end };
    },

    SET_SORT_ORDER(state, order) {
      state.filters.sortOrder = order;
    },
  },
  
  actions: {
    isTemporaryId(id) {
      return typeof id === 'string' && id.toString().startsWith('temp-');
    },
    
    // NEW ACTION: Prepare branch path by setting branch_child relationships
    // This should be called before using getVisibleBranchMessages
    prepareBranchPath({ commit, state }, threadRootId) {
      if (!threadRootId || !state.messages[threadRootId]) {
        console.log(`[prepareBranchPath] ⚠️ Cannot prepare path: message ${threadRootId} not found`);
        return false;
      }
      
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
        // If message has no branch child but has child_ids, set last child as branch_child (most recent)
        if (!currentMessage.branch_child && currentMessage.child_ids && currentMessage.child_ids.length > 0) {
          console.log(`[prepareBranchPath] 🌳 PREPARE_PATH setting branch_child for ${currentMessage.id} to last child ${currentMessage.child_ids[currentMessage.child_ids.length - 1]} (most recent)`);
          
          commit('SET_BRANCH_CHILD', { 
            messageId: currentMessage.id, 
            childId: currentMessage.child_ids[currentMessage.child_ids.length - 1] 
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
    
    // REMOVED setBranchPath - no longer needed since in_branch_path flags are unused
    
    // Load parent branch - FIXED: Now consistent with loadMessageBranchDown
    async loadMessageBranchUp({ commit, dispatch, state }, { messageId, depth = 1, get_replies = true }) {
      if (!messageId) return [];
      
      try {
        // Call the backend endpoint for efficient branch loading
        const response = await MessageService.loadBranchUp(messageId, depth, get_replies);
        const messages = response.data || [];
        
        if (messages.length > 0) {
          // Add messages to store
          commit('SET_MESSAGES', messages);
          
          // Use prepareBranchPath to establish branch_child relationships
          // This will establish upward links from the messageId to the newly loaded parents
          // without resetting any existing sibling relationships
          dispatch('prepareBranchPath', messageId);
          
          console.log(`[DEBUG] Loaded ${messages.length} messages in parent branch for ${messageId}`);
        }
        
        return messages;
      } catch (error) {
        console.error(`Error loading parent branch for ${messageId}:`, error);
        return [];
      }
    },
    
    // Load child branch
    async loadMessageBranchDown({ commit, dispatch, state }, { messageId, depth = 1, get_replies = true }) {
      if (!messageId) return [];
      
      try {
        // Call the backend endpoint for efficient branch loading
        const response = await MessageService.loadBranchDown(messageId, depth, get_replies);
        const messages = response.data || [];
        
        if (messages.length > 0) {
          // Add messages to store
          commit('SET_MESSAGES', messages);
          
          // Use prepareBranchPath to establish the branch path
          // Since we're loading from a visible message, the upward path is already correct
          // This will only set branch_child for newly loaded messages going downward
          dispatch('prepareBranchPath', messageId);
          
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
        console.log('[Messages Store] Starting sendReply', { 
          parentId, 
          isPrivate, 
          recipientsCount: recipients?.length || 0,
          hasAuthor: !!content_author 
        });

        // Use the current user if content_author is not provided
        const effectiveAuthor = content_author || rootState.user?.email;
        
        // Process recipients to extract UIDs
        let recipientUids = [];
        if (recipients && recipients.length > 0) {
          console.log('[Messages Store] Processing recipients:', recipients);
          
          recipientUids = recipients.map(recipient => {
            // If recipient is already an object with a uid
            if (typeof recipient === 'object' && recipient.uid) {
              console.log('[Messages Store] Using recipient UID from object:', recipient.uid);
              return recipient.uid;
            }
            // If recipient is a string (backward compatibility)
            else if (typeof recipient === 'string') {
              console.log('[Messages Store] Using recipient as string:', recipient);
              return recipient; // Will be resolved by server
            }
            console.log('[Messages Store] Invalid recipient format:', recipient);
            return null;
          }).filter(uid => uid !== null); // Remove any nulls
          
          console.log('[Messages Store] Final recipient UIDs:', recipientUids);
        }
        
        // Only add the author as recipient in private messages with no recipients
        // to ensure they can see their own message
        if (isPrivate && recipientUids.length === 0 && effectiveAuthor) {
          // If effectiveAuthor is an email, it will be resolved to UID by server
          recipientUids.push(effectiveAuthor);
          console.log('[Messages Store] Added author as recipient:', effectiveAuthor);
        }
        
        // Make API call to create the reply
        console.log('[Messages Store] Calling MessageService.sendReply with:', {
          parentId, 
          contentLength: content?.length || 0,
          isPrivate,
          recipientUids,
          effectiveAuthor 
        });
        
        const response = await MessageService.sendReply(
          parentId, 
          content, 
          isPrivate, 
          recipientUids, 
          effectiveAuthor
        );
        
        console.log('[Messages Store] sendReply response:', response?.data?.id ? {
          messageId: response.data.id,
          hasMessage: !!response.data,
          responseStatus: response.status,
        } : 'No message ID in response');
        
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
        console.error("[Messages Store] Error sending reply:", error);
        console.error("[Messages Store] Error details:", {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
        throw error;
      }
    },
    
    // Delete a message
    async deleteMessage({ commit, state, dispatch }, messageId) {
      try {
        console.log(`Deleting message: ${messageId}`);
        
        // Save reference to the message before deletion
        const messageToDelete = state.messages[messageId];
        
        // If message doesn't exist in frontend state, check if it might have been cascade-deleted
        if (!messageToDelete) {
          console.log(`[deleteMessage] Message ${messageId} not found in frontend state - may have been cascade deleted`);
          return true;
        }
        
        // Get parent ID before deletion
        const parentId = messageToDelete.parent_id;
        
        try {
          // API call to delete the message
          await MessageService.deleteMessage(messageId);
          console.log(`[deleteMessage] Successfully deleted message ${messageId} via API`);
        } catch (error) {
          // Handle 404 case - message might have been cascade deleted already
          if (error.response && error.response.status === 404) {
            console.log(`[deleteMessage] Message ${messageId} returned 404 - already deleted via cascade, cleaning up frontend state`);
            // Continue with frontend cleanup even though backend returned 404
          } else {
            // For other errors, rethrow
            throw error;
          }
        }
        
        // Check if this message was the branch_child of its parent
        let wasParentBranchChild = false;
        let parentMessage = null;
        
        if (parentId && state.messages[parentId]) {
          parentMessage = state.messages[parentId];
          wasParentBranchChild = parentMessage.branch_child === messageId;
        }
        
        // Remove from store (handles cascade delete of descendants)
        commit('REMOVE_MESSAGE_CASCADE', messageId);
        
        // If this was the parent's branch_child, set a new one
        if (wasParentBranchChild && parentMessage && parentMessage.child_ids && parentMessage.child_ids.length > 0) {
          // Get updated parent after REMOVE_MESSAGE_CASCADE might have modified it
          const updatedParent = state.messages[parentId];
          
          // If parent has remaining children, set the last one as branch_child (most recent)
          if (updatedParent && updatedParent.child_ids && updatedParent.child_ids.length > 0) {
            commit('SET_BRANCH_CHILD', { 
              messageId: parentId, 
              childId: updatedParent.child_ids[updatedParent.child_ids.length - 1] 
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
    
    // Reformat a message
    async reformatMessage({ commit, state }, messageId) {
      try {
        console.log(`[Store] Reformatting message: ${messageId}`);
        
        // Call the API to reformat the message
        const response = await MessageService.reformatMessage(messageId);
        
        // Update the message in the store with the reformatted content
        if (response.data) {
          commit('SET_MESSAGE', response.data);
        }
        
        return true;
      } catch (error) {
        console.error('[Store] Error reformatting message:', error);
        throw error;
      }
    },
    
    // Universal fetch action that routes to appropriate service based on mode
    async fetchMessages({ commit, state, rootState }, { mode, skip = 0, limit = 15, sourceMessageId = null, showAllLinks = false }) {
      try {
        // Check auth for modes that require it
        if ((mode === 'inbox') && !rootState.auth?.user) {
          console.log('[Store] fetchMessages called but no user authenticated for inbox mode, skipping');
          return { messages: [], has_more: false };
        }

        // Set loading state
        commit('SET_LOADING', { key: 'fetchingMessages', isLoading: true });
        
        console.log(`[Store] fetchMessages called with:`, {
          mode, skip, limit, sourceMessageId, showAllLinks,
          user: rootState.auth?.user?.email || 'unauthenticated'
        });
        
        let response;
        
        // Route to appropriate service based on mode
        switch(mode) {
          case 'inbox':
            response = await UserService.fetchUserMessages(limit, skip);
            break;
          case 'admin':
            // Import AdminService when needed
            const AdminService = (await import('../../services/AdminService')).default;
            const adminResponse = await AdminService.getMessages({ skip, limit });
            if (adminResponse.success) {
              response = {
                messages: adminResponse.messages,
                has_more: adminResponse.has_more,
                total: adminResponse.total
              };
            } else {
              throw new Error(adminResponse.error || 'Failed to load admin messages');
            }
            break;
          case 'public':
            // Import MessageService when needed
            const MessageService = (await import('../../services/MessageService')).default;
            const publicResponse = await MessageService.getPublicMessages(skip, limit);
            response = {
              messages: publicResponse.data.messages || [],
              has_more: publicResponse.data.has_more || false,
              total: publicResponse.data.total || 0
            };
            break;
          case 'saved':
            // Use existing UserService.getSavedMessages (which already handles pagination properly)
            response = await UserService.getSavedMessages(skip, limit);
            break;
          case 'incoming-links':
            if (!sourceMessageId) throw new Error('sourceMessageId required for incoming-links mode');
            response = await UserService.getUserIncomingLinks(sourceMessageId, skip, limit, showAllLinks);
            break;
          case 'outgoing-links':
            if (!sourceMessageId) throw new Error('sourceMessageId required for outgoing-links mode');
            response = await UserService.getUserOutgoingLinks(sourceMessageId, skip, limit, showAllLinks);
            break;
          case 'custom':
            // Custom mode doesn't fetch - just return empty
            return { messages: [], has_more: false };
          default:
            throw new Error(`Unknown fetch mode: ${mode}`);
        }

        console.log('messages from fetchMessages', response.messages);
        
        const rawMessages = response.messages || response.data?.messages || response.data || response || [];
        const has_more = response.has_more !== undefined ? response.has_more : (response.data?.has_more || false);
        const total = response.total || response.data?.total || 0;
        
        // Ensure rawMessages is always an array
        const messagesArray = Array.isArray(rawMessages) ? rawMessages : [];
        
        // Transform messages from ArangoDB format to expected format
        const messages = messagesArray.map(message => {
          if (!message.id && message._key) {
            message.id = message._key;
          }
          return message;
        });
        
        console.log(`[Store] ${mode} API response:`, {
          rawResponse: response,
          rawMessages: rawMessages,
          rawMessagesType: typeof rawMessages,
          rawMessagesIsArray: Array.isArray(rawMessages),
          messagesArrayCount: messagesArray.length,
          messagesCount: messages.length,
          has_more,
          total,
          firstMessageId: messages[0]?.id || 'none'
        });
        
        // For modes other than inbox, don't automatically commit to store
        // (they might want to handle messages differently)
        if (mode === 'inbox' || mode === 'admin') {
          if (messages.length > 0) {
            if (skip === 0) {
              // First page - replace messages
              await this.dispatch('messages/clearCache');
              commit('SET_MESSAGES', messages);
            } else {
              // Subsequent pages - append messages
              commit('SET_MESSAGES', messages);
            }
            console.log(`[Store] Store now has ${Object.keys(state.messages).length} total messages`);
          }
        }
        
        return { messages, has_more, total };
        
      } catch (error) {
        console.error(`[Store] Error in fetchMessages (${mode}):`, error);
        commit('ui/SET_ERROR', error.message || `Failed to load ${mode} messages`, { root: true });
        return { messages: [], has_more: false };
      } finally {
        commit('SET_LOADING', { key: 'fetchingMessages', isLoading: false });
      }
    },
    
    // Fetch chronological messages (for inbox tab main list)
    async fetchUserMessages({ commit, state, rootState }, { page = 1 } = {}) {
      try {
        // Check if user is authenticated first
        if (!rootState.auth?.user) {
          console.log('[Store] fetchUserMessages called but no user authenticated, skipping');
          return {
            messages: [],
            has_more: false
          };
        }

        // Set loading state
        commit('SET_LOADING', { key: 'fetchingMessages', isLoading: true });
        
        console.log(`[Store] fetchUserMessages called with:`, {
          page,
          user: rootState.auth.user.email
        });
        
        const response = await UserService.fetchUserMessages(15, page);
        const rawMessages = response.messages || response.data?.messages || response.data || response || [];
        const has_more = response.has_more !== undefined ? response.has_more : (response.data?.has_more || false);
        const total = response.total || response.data?.total || 0;
        const currentPage = response.data?.page || page;
        
        // Ensure rawMessages is always an array
        const messagesArray = Array.isArray(rawMessages) ? rawMessages : [];
        
        // Transform messages from ArangoDB format to expected format
        const messages = messagesArray.map(message => {
          // If message already has id, use it; otherwise use _key
          if (!message.id && message._key) {
            message.id = message._key;
          }
          return message;
        });
        
        console.log(`[Store] API response:`, {
          rawMessagesCount: messagesArray.length,
          messagesCount: messages.length,
          has_more,
          total,
          currentPage,
          firstMessageId: messages[0]?.id || 'none',
          firstRawMessage: messagesArray[0] ? { _key: messagesArray[0]._key, _id: messagesArray[0]._id, id: messagesArray[0].id } : 'none'
        });
        
        // Commit all messages to store
        if (messages.length > 0) {
          console.log(`[Store] Committing ${messages.length} messages to store`);
          commit('SET_MESSAGES', messages);
          console.log(`[Store] Store now has ${Object.keys(state.messages).length} total messages`);
        } else {
          console.log(`[Store] No messages to commit`);
        }
        
        // Return the response data with has_more flag
        return {
          messages,
          has_more,
          total
        };
      } catch (error) {
        console.error('[Store] Error in fetchUserMessages:', error);
        commit('ui/SET_ERROR', error.message || 'Failed to load user messages', { root: true });
        return {
          messages: [],
          has_more: false
        };
      } finally {
        // Always clear loading state
        commit('SET_LOADING', { key: 'fetchingMessages', isLoading: false });
      }
    },
    
    // Clear cache of all loaded messages
    async clearCache({ commit, state, rootState }, options = {}) {
      console.log('[Store] clearCache called with options:', options);
      console.log('[Store] Current message count before clear:', Object.keys(state.messages).length);
      
      if (options.excludePinned) {
        // Preserve pinned messages while clearing the rest
        const pinnedMessages = {};
        Object.values(state.messages).forEach(message => {
          if (message.is_pinned === 1 || message.is_pinned === true) {
            pinnedMessages[message.id] = message;
          }
        });
        
        // Replace state with only pinned messages
        state.messages = pinnedMessages;
        console.log(`[Store] Preserved ${Object.keys(pinnedMessages).length} pinned messages`);
      } else {
        // Clear all messages from state
        state.messages = {};
        console.log('[Store] Cleared all messages from cache');
      }
      
      console.log('[Store] Message count after clear:', Object.keys(state.messages).length);
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
    
    // Mark a message as read and update unread count
    async markMessageAsRead({ commit, state }, messageId) {
      console.log(`[Store] markMessageAsRead called for message ${messageId}`);
      
      try {
        // Check if message is currently unread before making API call
        const message = state.messages[messageId];
        const wasUnread = isMessageUnread(message);
        
        console.log(`[Store] Message ${messageId} check:`, {
          exists: !!message,
          currentReadStatus: message?.is_read,
          wasUnread,
          willCallAPI: wasUnread
        });
        
        if (wasUnread) {
          console.log(`[Store] Calling UserService to mark message ${messageId} as read`);
          await UserService.markMessageAsRead(messageId);
          console.log(`[Store] UserService call successful, updating store`);
          commit('UPDATE_MESSAGE_READ_STATUS', { messageId, isRead: true });
          
          // If the message was previously unread, decrement the unread count
          commit('SET_UNREAD_MESSAGE_COUNT', Math.max(0, state.unreadMessageCount - 1));
        } else {
          console.log(`[Store] Skipping API call for message ${messageId} - already read or not found`);
        }
        
        return true;
      } catch (error) {
        console.error(`[Store] Error marking message ${messageId} as read:`, error);
        return false;
      }
    },
    
    // Mark a message as unread and update unread count
    async markMessageAsUnread({ commit, state }, messageId) {
      try {
        // Check if message is currently read before making API call
        const message = state.messages[messageId];
        const wasRead = isMessageRead(message);
        
        console.log(`[Store] Calling UserService to mark message ${messageId} as unread`);
        await UserService.markMessageAsUnread(messageId);
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
        // If no valid current child, default to last (most recent)
        commit('SET_BRANCH_CHILD', { 
          messageId: messageId, 
          childId: message.child_ids[message.child_ids.length - 1] 
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

    // New action to fetch unread message count
    async fetchUnreadMessageCount({ commit, rootState }) {
      try {
        // Only proceed if user is logged in
        if (!rootState.auth?.user) {
          // Reset count to 0 if not logged in
          commit('SET_UNREAD_MESSAGE_COUNT', 0);
          return 0;
        }
        
        const response = await UserService.getUnreadMessageCount();
        const count = response.data.count || 0;
        
        commit('SET_UNREAD_MESSAGE_COUNT', count);
        return count;
      } catch (error) {
        console.error('Error fetching unread message count:', error);
        return 0;
      }
    },

    // Consolidated filter actions
    setFilters({ commit }, filters) {
      commit('SET_FILTERS', filters);
    },

    setAuthors({ commit }, authors) {
      commit('SET_AUTHORS', authors);
    },

    setRecipients({ commit }, recipients) {
      commit('SET_RECIPIENTS', recipients);
    },

    setIsPublic({ commit }, isPublic) {
      console.log('[Store action] setIsPublic called with value:', isPublic);
      commit('SET_IS_PUBLIC', isPublic);
      console.log('[Store action] setIsPublic completed');
    },

    setDateRange({ commit }, { start, end }) {
      commit('SET_DATE_RANGE', { start, end });
    },

    setSortOrder({ commit }, order) {
      commit('SET_SORT_ORDER', order);
    },

    // Remove old filter actions
    // setPublicFilter
    // setSelectedRecipients
    // setSelectedAuthor

    async loadMessageRadius({ commit, state }, { messageId, radius, get_replies = true }) {
      try {
        console.log('[Messages Store] loadMessageRadius called with:', { messageId, radius, get_replies });
        
        // Check current message state before API call
        const currentMessage = state.messages[messageId];
        const currentRecipients = currentMessage?.recipients || [];
        console.log('[Messages Store] Current message recipients BEFORE API call:', {
          messageId,
          hasMessage: !!currentMessage,
          recipientsCount: currentRecipients.length,
          recipients: currentRecipients
        });
        
        const response = await MessageService.loadMessageRadius(messageId, radius, get_replies);
        console.log('[Messages Store] loadMessageRadius API response:', {
          messageId,
          dataLength: response.data?.length || 0,
          data: response.data
        });
        
        // Commit all loaded messages to the store
        if (response.data && response.data.length > 0) {
          response.data.forEach(message => {
            console.log('[Messages Store] Committing message to store:', {
              id: message.id,
              recipientsCount: message.recipients?.length || 0,
              recipients: message.recipients
            });
            commit('SET_MESSAGE', message);
          });
        }
        
        // Check message state after update
        const updatedMessage = state.messages[messageId];
        const updatedRecipients = updatedMessage?.recipients || [];
        console.log('[Messages Store] Message recipients AFTER update:', {
          messageId,
          hasMessage: !!updatedMessage,
          recipientsCount: updatedRecipients.length,
          recipients: updatedRecipients,
          changed: updatedRecipients.length !== currentRecipients.length
        });
        
        return response.data;
      } catch (error) {
        console.error('Error loading message radius:', error);
        throw error;
      }
    },

    async deleteLink({ commit, dispatch }, { messageIdFrom, messageIdTo, linkType, sourceMessageId }) {
      try {
        console.log('[Store] Deleting link:', { messageIdFrom, messageIdTo, linkType, sourceMessageId });
        
        // Call the service to delete the link
        const success = await UserService.deleteLink(messageIdFrom, messageIdTo);
        
        if (success) {
          console.log('[Store] Link deleted successfully');
          
          // Refresh the appropriate link list
          // We'll need to refresh the messages for the LinksModal
          // This will be handled by the component watching for changes
          
          return true;
        } else {
          console.error('[Store] Failed to delete link');
          return false;
        }
      } catch (error) {
        console.error('[Store] Error deleting link:', error);
        throw error;
      }
    },

    async createLink({ commit, dispatch }, { messageIdFrom, messageIdTo }) {
      try {
        console.log('[Store] Creating link:', { messageIdFrom, messageIdTo });
        
        // Call the service to create the link
        const success = await UserService.createLink(messageIdFrom, messageIdTo);
        
        if (success) {
          console.log('[Store] Link created successfully');
          return true;
        } else {
          console.error('[Store] Failed to create link');
          return false;
        }
      } catch (error) {
        console.error('[Store] Error creating link:', error);
        throw error;
      }
    },

    async toggleReadStatus({ commit, state }, { messageId, currentUserId }) {
      try {
        const message = state.messages[messageId];
        if (!message) {
          console.error(`Message ${messageId} not found in store`);
          return false;
        }
        
        const newReadStatus = !message.is_read;
        await MessageService.updateReadStatus(messageId, newReadStatus);
        
        // Update the message in the store
        commit('SET_MESSAGE', {
          ...message,
          is_read: newReadStatus
        });
        
        return true;
      } catch (error) {
        console.error(`Error toggling read status for message ${messageId}:`, error);
        return false;
      }
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
    
    getLoadedMessages: (state) => {
      const messages = Object.values(state.messages);
      // Sort messages by timestamp with newest first by default
      return messages.sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        
        // Use the sort order from filters, defaulting to 'newest'
        const sortOrder = state.filters.sortOrder || 'newest';
        if (sortOrder === 'newest') {
          return dateB - dateA; // Newest first
        } else {
          return dateA - dateB; // Oldest first
        }
      });
    },
    
    // REMOVED getBranchPathMessages - no longer needed since in_branch_path flags are unused
    
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
    
    // REMOVED isInBranchPath - no longer needed since in_branch_path flags are unused
    
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
    getSelectedProfile: state => state.selectedProfile,

    // Add new getter for public filter
    getPublicFilter: state => state.publicFilter,  // Renamed from getVisibilityFilter

    // Add new getter for selected recipients
    getSelectedRecipients: state => state.selectedRecipients,

    // Consolidated filter getters
    getFilters: state => state.filters,
    getAuthors: state => state.filters.authors,
    getRecipients: state => state.filters.recipients,
    getIsPublic: state => state.filters.isPublic,
    getDateRange: state => state.filters.dateRange,
    getSortOrder: state => state.filters.sortOrder,
    
    // Read status getters using helper functions
    isMessageUnread: state => messageId => {
      const message = state.messages[messageId];
      return isMessageUnread(message);
    },
    
    isMessageRead: state => messageId => {
      const message = state.messages[messageId];
      return isMessageRead(message);
    }
  }
}

