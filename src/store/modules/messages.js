import MessageService from '../../services/MessageService'
import UserService from '../../services/UserService'
import WebSocketService from '../../services/ws/WebSocketService'

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

    // Thread view mode for auto-marking messages as read
    threadViewMode: false,

    // Track which messages are currently being marked as read
    markingAsReadIds: [],

  },
  
  mutations: {
    SET_MESSAGE(state, message) {
      // Normalize light payloads but avoid clobbering existing structure
      if (!Array.isArray(message.child_ids)) {
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

        // Preserve structural fields if missing on payload
        const nextRecipients = Array.isArray(message.recipients)
          ? message.recipients
          : (existingMessage.recipients || []);
        const nextTags = Array.isArray(message.tags)
          ? message.tags
          : (existingMessage.tags || []);
        const nextParentId = (message.parent_id !== undefined && message.parent_id !== null)
          ? message.parent_id
          : existingMessage.parent_id;
        const nextTimestamp = (message.timestamp !== undefined)
          ? message.timestamp
          : existingMessage.timestamp;

        // Create the merged message
        const mergedMessage = {
          ...existingMessage, // Start with existing message properties
          ...message,         // Override with new message properties
          child_ids: mergedChildIds, // Use combined child_ids
          recipients: nextRecipients,
          tags: nextTags,
          parent_id: nextParentId,
          timestamp: nextTimestamp,
        };
        
        // Default branch_child - always use last child (furthest right) in complete list
        const hasChildren = mergedChildIds.length > 0;
        if (hasChildren && currentBranchChild === undefined) {
          // If reply_order is set, use last child from ordered list
          if (mergedMessage.reply_order && Array.isArray(mergedMessage.reply_order) && mergedMessage.reply_order.length > 0) {
            // Get ordered child IDs (respects reply_order)
            const orderMap = new Map();
            mergedMessage.reply_order.forEach((id, index) => {
              orderMap.set(id, index);
            });
            const orderedIds = [...mergedChildIds].sort((a, b) => {
              const aInOrder = orderMap.has(a);
              const bInOrder = orderMap.has(b);
              if (aInOrder && bInOrder) return orderMap.get(a) - orderMap.get(b);
              if (aInOrder && !bInOrder) return 1; // b (unordered) comes first
              if (!aInOrder && bInOrder) return -1; // a (unordered) comes first
              const msgA = state.messages[a];
              const msgB = state.messages[b];
              if (msgA && msgB) return new Date(msgA.timestamp) - new Date(msgB.timestamp);
              return 0;
            });
            // Use last child (furthest right, last in complete list)
            mergedMessage.branch_child = orderedIds[orderedIds.length - 1];
          } else {
            // No custom order - use most recent by timestamp
            const childMessages = mergedChildIds
              .map(childId => state.messages[childId])
              .filter(child => child)
              .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            mergedMessage.branch_child = childMessages.length > 0 ? 
              childMessages[childMessages.length - 1].id : 
              mergedChildIds[mergedChildIds.length - 1];
          }
        } else if (hasChildren) {
          // Keep existing selection if it's still valid
          const isBranchChildValid = mergedChildIds.includes(currentBranchChild);
          if (isBranchChildValid) {
            mergedMessage.branch_child = currentBranchChild;
          } else {
            // Re-select branch_child respecting reply_order - use last child
            if (mergedMessage.reply_order && Array.isArray(mergedMessage.reply_order) && mergedMessage.reply_order.length > 0) {
              const orderMap = new Map();
              mergedMessage.reply_order.forEach((id, index) => {
                orderMap.set(id, index);
              });
              const orderedIds = [...mergedChildIds].sort((a, b) => {
                const aInOrder = orderMap.has(a);
                const bInOrder = orderMap.has(b);
                if (aInOrder && bInOrder) return orderMap.get(a) - orderMap.get(b);
                if (aInOrder && !bInOrder) return 1; // b (unordered) comes first
                if (!aInOrder && bInOrder) return -1; // a (unordered) comes first
                const msgA = state.messages[a];
                const msgB = state.messages[b];
                if (msgA && msgB) return new Date(msgA.timestamp) - new Date(msgB.timestamp);
                return 0;
              });
              // Use last child (furthest right, last in complete list)
              mergedMessage.branch_child = orderedIds[orderedIds.length - 1];
            } else {
              const childMessages = mergedChildIds
                .map(childId => state.messages[childId])
                .filter(child => child)
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
              mergedMessage.branch_child = childMessages.length > 0 ? 
                childMessages[childMessages.length - 1].id : 
                mergedChildIds[mergedChildIds.length - 1];
            }
          }
        } else {
          mergedMessage.branch_child = null;
        }
        
        // Update the store with merged message
        state.messages[message.id] = mergedMessage;
        
        // Log reply_order if present (structured logging)
        if (mergedMessage.reply_order && Array.isArray(mergedMessage.reply_order) && mergedMessage.reply_order.length > 0) {
          const orderedIds = mergedMessage.reply_order;
          const unorderedIds = mergedChildIds.filter(id => !orderedIds.includes(id));
          const unorderedWithTimestamps = unorderedIds.map(id => {
            const msg = state.messages[id];
            return { id, timestamp: msg?.timestamp || 'unknown' };
          }).sort((a, b) => {
            if (a.timestamp === 'unknown' || b.timestamp === 'unknown') return 0;
            return new Date(a.timestamp) - new Date(b.timestamp);
          });
          console.log(`[SET_MESSAGE] ${message.id}: reply_order active`, {
            replyOrder: orderedIds,
            childIds: mergedChildIds,
            replyOrderLength: orderedIds.length,
            childIdsLength: mergedChildIds.length,
            unordered: unorderedWithTimestamps.length > 0 ? unorderedWithTimestamps : undefined
          });
        }
      } else {
        // New message, not in store yet
        // Default branch_child - always use last child (furthest right) in complete list
        const hasChildren = message.child_ids && message.child_ids.length > 0;
        if (hasChildren) {
          if (message.reply_order && Array.isArray(message.reply_order) && message.reply_order.length > 0) {
            // Use last child from ordered list (last in complete merged list)
            const orderMap = new Map();
            message.reply_order.forEach((id, index) => {
              orderMap.set(id, index);
            });
            const orderedIds = [...message.child_ids].sort((a, b) => {
              const aInOrder = orderMap.has(a);
              const bInOrder = orderMap.has(b);
              if (aInOrder && bInOrder) return orderMap.get(a) - orderMap.get(b);
              if (aInOrder && !bInOrder) return 1; // b (unordered) comes first
              if (!aInOrder && bInOrder) return -1; // a (unordered) comes first
              return 0; // For new messages, timestamps may not be loaded yet
            });
            message.branch_child = orderedIds[orderedIds.length - 1];
          } else {
            // No custom order - use last child (most recent by timestamp, backend sends timestamp ASC)
            message.branch_child = message.child_ids[message.child_ids.length - 1];
          }
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

    UPDATE_MESSAGE_THREAD_COUNT(state, { messageId, unreadCountInThread }) {
      if (state.messages[messageId]) {
        state.messages[messageId] = {
          ...state.messages[messageId],
          unread_count_in_thread: unreadCountInThread
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

    // Thread view mode mutations
    SET_THREAD_VIEW_MODE(state, enabled) {
      state.threadViewMode = enabled;
    },

    // Mutations for tracking messages being marked as read
    ADD_MARKING_AS_READ(state, messageId) {
      if (!state.markingAsReadIds.includes(messageId)) {
        state.markingAsReadIds.push(messageId);
      }
    },

    REMOVE_MARKING_AS_READ(state, messageId) {
      const index = state.markingAsReadIds.indexOf(messageId);
      if (index > -1) {
        state.markingAsReadIds.splice(index, 1);
      }
    },

    CLEAR_MARKING_AS_READ(state) {
      state.markingAsReadIds = [];
    },
  },
  
  actions: {
    // Handle incoming message from WebSocket (transport-agnostic)
    async handleIncomingWsMessage({ commit, getters, dispatch, rootState }, messageData) {
      try {
        if (!messageData || !messageData.id) return;

        // Add/merge the message into store
        commit('SET_MESSAGE', messageData);

        // Determine current user for notification/read logic
        const user = rootState.auth?.user;
        let isFromCurrentUser = false;
        let isToCurrentUser = false;
        if (user) {
          isFromCurrentUser = messageData.content_author === user.uid || messageData.author_user_tag === user.user_tag;
          const recipients = Array.isArray(messageData.recipients) ? messageData.recipients : [];
          isToCurrentUser = recipients.some(r => {
            if (!r) return false;
            if (typeof r === 'object') return (r.uid && r.uid === user.uid) || (r.user_tag && r.user_tag === user.user_tag);
            if (typeof r === 'string') return r === user.uid || r === user.user_tag;
            return false;
          });
        }

        // Increment unread count for messages to current user (not authored by current user)
        if (isToCurrentUser && !isFromCurrentUser) {
          dispatch('incrementUnreadCount');

          // Skip notification if this is the next message in the visible branch
          // Determine visibility based on current route id if available
          let isNextInBranch = false;
          try {
            const path = typeof window !== 'undefined' ? window.location.pathname : '';
            const match = path && path.match(/\/([^\/\?]+)$/);
            const urlMessageId = match ? match[1] : null;
            if (urlMessageId) {
              const visibleMessages = getters.getVisibleBranchMessages(urlMessageId);
              if (visibleMessages && visibleMessages.length > 0) {
                const lastVisible = visibleMessages[visibleMessages.length - 1];
                isNextInBranch = messageData.parent_id === lastVisible?.id;
              }
            }
          } catch (_) {}

          if (isNextInBranch) {
            // Auto-mark as read if user is actively viewing the branch
            dispatch('batchMarkAsRead', [messageData.id]);
          } else {
            const authorName = messageData.author_display_name || messageData.author_user_tag || 'Someone';
            const contentPreview = messageData.content ? (messageData.content.length > 60 ? messageData.content.substring(0, 60) + '...' : messageData.content) : 'New message';
            const notificationData = {
              id: messageData.id,
              title: `New message from ${authorName}`,
              message: contentPreview,
              messageData,
              timestamp: new Date().toISOString()
            };
            // Delegate UI notification to ui module
            dispatch('ui/setMessageNotification', notificationData, { root: true });
          }
        }

        // Maintain parent-child relationships
        const parentId = messageData.parent_id;
        if (parentId) {
          const parentInStore = getters.getMessage(parentId);
          if (parentInStore) {
            commit('ADD_CHILD_TO_PARENT', { parentId, childId: messageData.id });
            const updatedParent = getters.getMessage(parentId);
            const parentChildren = updatedParent?.child_ids || [];
            if (parentChildren.length === 1) {
              commit('SET_BRANCH_CHILD', { messageId: parentId, childId: messageData.id });
            }
          }
        }
      } catch (e) {
        console.error('[messages store] handleIncomingWsMessage error:', e);
      }
    },
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

        // Set this parent's branch_child to point to the child we came from
        commit('SET_BRANCH_CHILD', { 
          messageId: currentParentId, 
          childId: childMessage.id 
        });
        
        // Move up one level
        highestAncestor = parentMessage;
        childMessage = parentMessage;
        currentParentId = parentMessage.parent_id;
      }
      
      
      // STEP 2: Now follow the branch path down, ensuring each node has branch_child set
      let currentMessage = highestAncestor;
      
      
      
      // Trace downward, ensuring each node has a branch_child if it has children
      while (true) {
        // If message has no branch child but has child_ids, set last child as branch_child
        if (!currentMessage.branch_child && currentMessage.child_ids && currentMessage.child_ids.length > 0) {
          // Get ordered child IDs (respects reply_order if set)
          let orderedChildIds = currentMessage.child_ids;
          if (currentMessage.reply_order && Array.isArray(currentMessage.reply_order) && currentMessage.reply_order.length > 0) {
            // Create a map for quick lookup
            const orderMap = new Map();
            currentMessage.reply_order.forEach((id, index) => {
              orderMap.set(id, index);
            });
            
            // Sort: items not in reply_order first (by timestamp), then items in reply_order (by their order)
            orderedChildIds = [...currentMessage.child_ids].sort((a, b) => {
              const aInOrder = orderMap.has(a);
              const bInOrder = orderMap.has(b);
              
              if (aInOrder && bInOrder) {
                return orderMap.get(a) - orderMap.get(b);
              } else if (aInOrder && !bInOrder) {
                return 1; // b (unordered) comes first
              } else if (!aInOrder && bInOrder) {
                return -1; // a (unordered) comes first
              } else {
                const msgA = state.messages[a];
                const msgB = state.messages[b];
                if (msgA && msgB) {
                  return new Date(msgA.timestamp) - new Date(msgB.timestamp);
                }
                return 0;
              }
            });
          }
          
          // Get all child messages
          const childMessages = orderedChildIds
            .map(childId => state.messages[childId])
            .filter(child => child); // Remove any undefined children
          
          if (childMessages.length > 0) {
            // Always use last child (furthest right) from complete list
            let branchChild;
            if (currentMessage.reply_order && Array.isArray(currentMessage.reply_order) && currentMessage.reply_order.length > 0) {
              // Use last child from ordered list (last in complete merged list)
              branchChild = childMessages[childMessages.length - 1];
            } else {
              // Sort by timestamp ascending (most recent = last)
              const sortedByTimestamp = [...childMessages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
              branchChild = sortedByTimestamp[sortedByTimestamp.length - 1];
            }
            
            commit('SET_BRANCH_CHILD', { 
              messageId: currentMessage.id, 
              childId: branchChild.id
            });
            
            // Get updated message reference
            currentMessage = state.messages[currentMessage.id];
          } else {
            break;
          }
        }
        
        // If message has no branch child (even after trying to set one), break
        if (!currentMessage.branch_child) {
          break;
        }
        
        const childId = currentMessage.branch_child;
        
        // If child doesn't exist in the store, break
        if (!state.messages[childId]) {
          break;
        }
        
        // Move to the next message
        currentMessage = state.messages[childId];
      }
      
      return true;
    },
    
    // REMOVED setBranchPath - no longer needed since in_branch_path flags are unused
    
    // Unified traversal loader
    async loadTraversal({ commit, state }, { messageId, up_depth = 0, down_depth = 0, get_replies = true, get_children = false }) {
      if (!messageId) return [];
      try {
        const response = await MessageService.traverseFrom(messageId, { up_depth, down_depth, get_replies, get_children });
        const data = response?.data || {};
        const combined = [];
        if (data.origin) combined.push(data.origin);
        if (Array.isArray(data.messages)) combined.push(...data.messages);
        if (combined.length > 0) {
          commit('SET_MESSAGES', combined);
        }
        return combined;
      } catch (error) {
        console.error('[messages store] loadTraversal error:', error);
        return [];
      }
    },
    
    // Load parent branch - delegate to unified traversal
    async loadMessageBranchUp({ dispatch }, { messageId, depth = 1, get_replies = true, get_children = true }) {
      return dispatch('loadTraversal', { messageId, up_depth: depth, down_depth: 0, get_replies, get_children });
    },
    
    // Load child branch - delegate to unified traversal
    async loadMessageBranchDown({ dispatch }, { messageId, depth = 1, get_replies = true, get_children = true }) {
      return dispatch('loadTraversal', { messageId, up_depth: 0, down_depth: depth, get_replies, get_children });
    },
    
    // Load radius - delegate to unified traversal
    async loadMessageRadius({ dispatch }, { messageId, radius, get_replies = true, get_children = true }) {
      return dispatch('loadTraversal', { messageId, up_depth: radius, down_depth: radius, get_replies, get_children });
    },
    
    // Refresh all loaded ancestors of a message (only up to those present in the store)
    async refreshLoadedAncestors({ dispatch, state }, { messageId, get_replies = true, get_children = true }) {
      if (!messageId) return [];
      let depth = 0;
      let current = state.messages[messageId];
      while (current && current.parent_id && state.messages[current.parent_id]) {
        depth += 1;
        current = state.messages[current.parent_id];
      }
      // If nothing loaded above, still reload origin to update its recipients
      const up_depth = depth;
      return dispatch('loadTraversal', { messageId, up_depth, down_depth: 0, get_replies, get_children });
    },
    
    // Send a reply to a message
    async sendReply({ commit, dispatch, rootState, state }, { parentId, content, isPrivate, recipients, content_author, tags, attachments }) {
      try {
        console.log('[Messages Store] Starting sendReply', { 
          parentId, 
          isPrivate, 
          recipientsCount: recipients?.length || 0,
          hasAuthor: !!content_author 
        });

        // Use the current user if content_author is not provided
        const effectiveAuthor = content_author || rootState.auth?.user?.uid;
        
        // Process recipients - keep full objects to preserve visibility settings
        let processedRecipients = [];
        if (recipients && recipients.length > 0) {
          console.log('[Messages Store] Processing recipients:', recipients);
          
          processedRecipients = recipients.map(recipient => {
            // If recipient is already an object with a uid - keep the full object
            if (typeof recipient === 'object' && recipient.uid) {
              console.log('[Messages Store] Using full recipient object:', recipient);
              return recipient; // Keep entire object
            }
            // If recipient is a string, convert to object (backward compatibility)
            else if (typeof recipient === 'string') {
              console.log('[Messages Store] Converting string recipient to object:', recipient);
              return { uid: recipient, public: true }; // Default public for string recipients
            }
            console.log('[Messages Store] Invalid recipient format:', recipient);
            return null;
          }).filter(recipient => recipient !== null); // Remove any nulls
          
          console.log('[Messages Store] Final processed recipients:', processedRecipients);
        }
        
        
        // Make API call to create the reply
        console.log('[Messages Store] Calling MessageService.sendReply with:', {
          parentId, 
          contentLength: content?.length || 0,
          isPrivate,
          processedRecipients,
          effectiveAuthor,
          tagsCount: Array.isArray(tags) ? tags.length : 0
        });
        
        const response = await MessageService.sendReply(
          parentId, 
          content, 
          isPrivate, 
          processedRecipients, 
          effectiveAuthor,
          tags,
          attachments
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
        
        // If the current user is a recipient of this new message, mark it as read for them immediately
        try {
          const currentUserId = rootState.auth?.user?.uid;
          const recipientsArray = Array.isArray(newMessage?.recipients) ? newMessage.recipients : processedRecipients;
          const isSelfRecipient = Array.isArray(recipientsArray) && !!currentUserId && recipientsArray.some(r => {
            if (!r) return false;
            if (typeof r === 'string') return r === currentUserId;
            if (typeof r === 'object') return r.uid === currentUserId;
            return false;
          });
          if (isSelfRecipient && newMessage?.id) {
            // Fire and await to ensure backend state is consistent; internal action will avoid count drift for self-authored
            await dispatch('markMessageAsRead', newMessage.id);
          }
        } catch (e) {
          console.warn('[Messages Store] Failed to auto-mark sent message as read:', e);
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

    // Update message tags (full replace)
    async updateMessageTags({ commit, state }, { id, tags }) {
      try {
        if (!id) throw new Error('id required')
        const resp = await MessageService.updateTags(id, Array.isArray(tags) ? tags : [])
        const updated = resp?.data
        if (updated && updated.id) {
          // Preserve relations if backend returns minimal doc
          const existing = state.messages[updated.id] || {}
          if (updated.parent_id === undefined) updated.parent_id = existing.parent_id
          if (!Array.isArray(updated.child_ids)) updated.child_ids = existing.child_ids || []
          commit('SET_MESSAGE', updated)
          return true
        }
        return false
      } catch (e) {
        console.error('[messages store] updateMessageTags error:', e)
        return false
      }
    },
    
    // Delete a message
    async deleteMessage({ commit, state, dispatch }, { messageId, deleteDescendants = false }) {
      try {
        console.log(`Deleting message: ${messageId}, deleteDescendants: ${deleteDescendants}`);
        
        // Save reference to the message before deletion
        const messageToDelete = state.messages[messageId];
        
        // If message doesn't exist in frontend state, check if it might have been cascade-deleted
        if (!messageToDelete) {
          console.log(`Message ${messageId} not found in frontend state - may have been cascade deleted`);
          return true;
        }
        
        // Get parent ID before deletion
        const parentId = messageToDelete.parent_id;
        
        try {
          // API call to delete the message with deleteDescendants flag
          await MessageService.deleteMessage(messageId, deleteDescendants);
          console.log(`Successfully deleted message ${messageId}`);
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
          
          // If parent has remaining children, set the last one as branch_child
          if (updatedParent && updatedParent.child_ids && updatedParent.child_ids.length > 0) {
            // Use getChildIds to respect reply_order
            const orderedChildIds = getters.getChildIds(parentId);
            const newBranchChildId = orderedChildIds.length > 0 ? 
              orderedChildIds[orderedChildIds.length - 1] : 
              updatedParent.child_ids[updatedParent.child_ids.length - 1]; // Fallback to array order
            
            commit('SET_BRANCH_CHILD', { 
              messageId: parentId, 
              childId: newBranchChildId
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

    // Toggle message public flag
    async togglePublicMessage({ commit, state, rootGetters }, { messageId, makePublic }) {
      try {
        if (!rootGetters['auth/hasScope']('msg.write')) {
          throw new Error('Write permission required');
        }
        const existing = state.messages[messageId];
        if (!existing) return false;
        const resp = await MessageService.setPublic(messageId, !!makePublic);
        const updated = resp?.data;
        if (updated && updated.id) {
          // Ensure we don't lose relational context if backend returns a minimal payload
          if (updated.parent_id === undefined || updated.parent_id === null) {
            updated.parent_id = existing.parent_id;
          }
          if (!Array.isArray(updated.child_ids)) {
            updated.child_ids = existing.child_ids || [];
          }
          commit('SET_MESSAGE', updated);
          return true;
        }
        return false;
      } catch (error) {
        console.error('[Store] togglePublicMessage error:', error);
        commit('ui/SET_ERROR', error.message || 'Failed to update visibility', { root: true });
        return false;
      }
    },
    
    // Removed: reformatMessage (no server endpoint)
    
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
          case 'history':
            {
              const MessageService = (await import('../../services/MessageService')).default;
              const histResponse = await MessageService.getUserHistory(skip, limit);
              response = {
                messages: histResponse.data.messages || [],
                has_more: histResponse.data.has_more || false,
                total: histResponse.data.total || 0
              };
            }
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
        if (mode === 'inbox') {
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
    async markMessageAsRead({ commit, state, rootState }, messageId) {
      console.log(`[Store] markMessageAsRead called for message ${messageId}`);
      
      try {
        // Check if message is currently unread before making API call
        const message = state.messages[messageId];
        const wasUnread = isMessageUnread(message);
        const isAuthoredByCurrentUser = !!(message && rootState?.auth?.user && message.content_author === rootState.auth.user.uid);
        
        console.log(`[Store] Message ${messageId} check:`, {
          exists: !!message,
          currentReadStatus: message?.is_read,
          wasUnread,
          willCallAPI: wasUnread,
          isAuthoredByCurrentUser
        });
        
        if (wasUnread) {
          console.log(`[Store] Calling UserService to mark message ${messageId} as read`);
          const resp = await UserService.markMessageAsRead(messageId);
          console.log('[Store] markMessageAsRead response:', { status: resp?.status, data: resp?.data });
          console.log(`[Store] UserService call successful, updating store`);
          commit('UPDATE_MESSAGE_READ_STATUS', { messageId, isRead: true });
          
          // If the message was previously unread, decrement the unread count
          // Skip decrement for self-authored messages to avoid count drift
          if (!isAuthoredByCurrentUser) {
            commit('SET_UNREAD_MESSAGE_COUNT', Math.max(0, state.unreadMessageCount - 1));
          }
          
          // Decrement unread_count_in_thread if it exists on this message and not self-authored
          if (!isAuthoredByCurrentUser) {
            if (message && message.unread_count_in_thread && message.unread_count_in_thread > 0) {
              commit('UPDATE_MESSAGE_THREAD_COUNT', { 
                messageId, 
                unreadCountInThread: message.unread_count_in_thread - 1 
              });
            }
          }
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
        const resp = await UserService.markMessageAsUnread(messageId);
        console.log('[Store] markMessageAsUnread response:', { status: resp?.status, data: resp?.data });
        commit('UPDATE_MESSAGE_READ_STATUS', { messageId, isRead: false });
        
        // If the message was previously read, increment the unread count
        if (wasRead) {
          commit('SET_UNREAD_MESSAGE_COUNT', state.unreadMessageCount + 1);
          
          // Increment unread_count_in_thread if it exists on this message
          if (message.unread_count_in_thread !== undefined && message.unread_count_in_thread !== null) {
            commit('UPDATE_MESSAGE_THREAD_COUNT', { 
              messageId, 
              unreadCountInThread: message.unread_count_in_thread + 1 
            });
          }
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
    async navigateToSibling({ commit, state, dispatch, rootState, getters }, { messageId, direction }) {
      const message = state.messages[messageId];
      if (!message) {
        return false;
      }
      
      // Use getChildIds to respect reply_order
      const orderedChildIds = getters.getChildIds(messageId);
      if (!orderedChildIds || orderedChildIds.length <= 1) {
        return false;
      }
      
      const currentChildId = message.branch_child;
      const currentIndex = orderedChildIds.indexOf(currentChildId);
      
      if (currentIndex === -1) {
        // If no valid current child, use last child from ordered list (furthest right)
        if (message.reply_order && Array.isArray(message.reply_order) && message.reply_order.length > 0) {
          commit('SET_BRANCH_CHILD', { 
            messageId: messageId, 
            childId: orderedChildIds[orderedChildIds.length - 1]
          });
        } else {
          // Default to most recent by timestamp
          const childMessages = orderedChildIds
            .map(childId => state.messages[childId])
            .filter(child => child)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          
          const mostRecentChildId = childMessages.length > 0 ? 
            childMessages[childMessages.length - 1].id : 
            orderedChildIds[orderedChildIds.length - 1];
          
          commit('SET_BRANCH_CHILD', { 
            messageId: messageId, 
            childId: mostRecentChildId
          });
        }
        return true;
      }
      
      let newIndex;
      if (direction === 'prev') {
        newIndex = Math.max(0, currentIndex - 1);
      } else {
        newIndex = Math.min(orderedChildIds.length - 1, currentIndex + 1);
      }
      
      // Only update if actually changing
      if (newIndex !== currentIndex) {
        const newChildId = orderedChildIds[newIndex];
        const oldChildId = currentChildId;
        
        // Check if the new sibling is loaded in the store
        const isNewChildLoaded = !!state.messages[newChildId];
        
        // If the sibling isn't loaded, load it before changing branch_child
        if (!isNewChildLoaded) {
          try {
            commit('SET_LOADING', { key: `sibling_${messageId}`, isLoading: true });
            await dispatch('loadMessage', newChildId);
            if (state.messages[newChildId]) {
              await dispatch('loadMessageBranchDown', {
                messageId: newChildId,
                depth: 2
              });
            }
            commit('SET_LOADING', { key: `sibling_${messageId}`, isLoading: false });
          } catch (error) {
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
          isSelectionDownstream = isDescendantOf(state, selectedMessageId, oldChildId);
        }
        
        // Handle selection state
        if (wasCurrentChildSelected) {
          dispatch('navigation/selectMessage', newChildId, { root: true });
        } else if (isSelectionDownstream) {
          dispatch('navigation/selectMessage', null, { root: true });
        }
        
        // Auto-mark the entire newly visible branch starting from the new sibling
        dispatch('markVisibleBranchAsRead', newChildId);
        
        return true;
      }
      
      return false;
    },

    // New action to fetch unread message count
    async fetchUnreadMessageCount({ commit, rootState }) {
      try {
        // Set loading state
        commit('SET_LOADING', { key: 'fetchingUnreadCount', isLoading: true });
        
        // Only proceed if user is logged in
        if (!rootState.auth?.user) {
          // Reset count to 0 if not logged in
          commit('SET_UNREAD_MESSAGE_COUNT', 0);
          return 0;
        }
        
        const response = await UserService.getUnreadMessageCount();
        const count = response.data.unread_total || 0;
        
        commit('SET_UNREAD_MESSAGE_COUNT', count);
        return count;
      } catch (error) {
        console.error('Error fetching unread message count:', error);
        commit('SET_UNREAD_MESSAGE_COUNT', 0);
        return 0;
      } finally {
        commit('SET_LOADING', { key: 'fetchingUnreadCount', isLoading: false });
      }
    },

    // Action to increment unread count (for WebSocket updates)
    incrementUnreadCount({ commit, state }) {
      commit('SET_UNREAD_MESSAGE_COUNT', state.unreadMessageCount + 1);
    },

    // Batch mark messages as read for thread view auto-marking
    async batchMarkAsRead({ commit, state, rootState }, messageIds) {
      console.log('[Store] batchMarkAsRead called with:', messageIds.length, 'messages: ids ', messageIds);
      console.log('[Store] threadViewMode:', state.threadViewMode, 'user present:', !!rootState.auth?.user);

      // Only proceed if in thread view mode
      if (!state.threadViewMode) {
        console.log('[Store] Not in thread view mode, skipping auto-mark');
        return;
      }

      // Filter to only eligible messages (user is recipient and message is unread)
      const user = rootState.auth?.user;
      if (!user) {
        console.log('[Store] No authenticated user, skipping auto-mark');
        return;
      }

      const eligibilityReasons = {};
      const eligibleIds = messageIds.filter(id => {
        const message = state.messages[id];
        if (!message) { eligibilityReasons[id] = 'not_in_store'; return false; }

        const isRecipient = message.recipients && message.recipients.some(r => 
          (typeof r === 'object' && r.uid === user.uid) || r === user.uid
        );
        if (!isRecipient) { eligibilityReasons[id] = 'not_recipient'; return false; }

        const unread = isMessageUnread(message);
        if (!unread) { eligibilityReasons[id] = 'already_read'; return false; }

        eligibilityReasons[id] = 'eligible';
        return true;
      });

      console.log('[Store] eligibility map:', eligibilityReasons);

      if (eligibleIds.length === 0) {
        console.log('[Store] No eligible messages to mark as read');
        return;
      }

      console.log('[Store] Marking', eligibleIds.length, 'eligible messages as read');

      // Add to loading state immediately for UI feedback
      eligibleIds.forEach(id => commit('ADD_MARKING_AS_READ', id));

      try {
        console.log('[Store] Calling UserService.batchMarkAsRead with ids:', eligibleIds);
        const response = await UserService.batchMarkAsRead(eligibleIds);
        const result = response.data;

        console.log('[Store] Batch mark complete, response:', { status: response?.status, data: result });

        // Update message read status in store for successfully marked messages
        eligibleIds.forEach(id => {
          commit('UPDATE_MESSAGE_READ_STATUS', { messageId: id, isRead: true });
        });

        // Decrement unread count by the number of messages actually updated
        const updatedCount = result?.updated_count ?? eligibleIds.length;
        const newUnreadCount = Math.max(0, state.unreadMessageCount - updatedCount);
        commit('SET_UNREAD_MESSAGE_COUNT', newUnreadCount);

      } catch (error) {
        console.error('[Store] Error in batch mark as read:', error);
        // Don't show user-facing errors for auto-marking - fail silently
      } finally {
        // Clear loading states
        eligibleIds.forEach(id => commit('REMOVE_MARKING_AS_READ', id));
      }
    },

    // Helper action to mark visible branch messages as read
    async markVisibleBranchAsRead({ dispatch, getters }, messageId) {
      if (!messageId) return;
            
      // Get visible branch messages
      const visibleMessages = getters.getVisibleBranchMessages(messageId);
      if (!visibleMessages || visibleMessages.length === 0) {
        return;
      }
      
      const messageIds = visibleMessages.map(msg => msg.id);
      
      // Fire batch mark action (async, don't await)
      dispatch('batchMarkAsRead', messageIds);
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

    async deleteLink({ commit, dispatch, rootGetters }, { messageIdFrom, messageIdTo, linkType, sourceMessageId }) {
      try {
        console.log('[Store] Deleting link:', { messageIdFrom, messageIdTo, linkType, sourceMessageId });
        // Gate on msg.write
        if (!rootGetters['auth/hasScope']('msg.write')) {
          throw new Error('Write permission required');
        }
        
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

    async createLink({ commit, dispatch, rootGetters }, { messageIdFrom, messageIdTo }) {
      try {
        console.log('[Store] Creating link:', { messageIdFrom, messageIdTo });
        // Gate on msg.write
        if (!rootGetters['auth/hasScope']('msg.write')) {
          throw new Error('Write permission required');
        }
        
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
      
      const childIds = message.child_ids || [];
      
      // If reply_order is set, use it to order child_ids
      if (message.reply_order && Array.isArray(message.reply_order) && message.reply_order.length > 0) {
        // Create a map for quick lookup
        const orderMap = new Map();
        message.reply_order.forEach((id, index) => {
          orderMap.set(id, index);
        });
        
        // Sort: items not in reply_order first (by timestamp), then items in reply_order (by their order)
        const ordered = [...childIds].sort((a, b) => {
          const aInOrder = orderMap.has(a);
          const bInOrder = orderMap.has(b);
          
          if (aInOrder && bInOrder) {
            // Both in order, use reply_order position
            return orderMap.get(a) - orderMap.get(b);
          } else if (aInOrder && !bInOrder) {
            // a in order, b not - b comes first (unordered first)
            return 1;
          } else if (!aInOrder && bInOrder) {
            // b in order, a not - a comes first (unordered first)
            return -1;
          } else {
            // Neither in order, sort by timestamp
            const msgA = state.messages[a];
            const msgB = state.messages[b];
            if (msgA && msgB) {
              return new Date(msgA.timestamp) - new Date(msgB.timestamp);
            }
            return 0;
          }
        });
        
        // Log unordered replies with timestamps
        const unorderedIds = childIds.filter(id => !orderMap.has(id));
        if (unorderedIds.length > 0) {
          const unorderedWithTimestamps = unorderedIds.map(id => {
            const msg = state.messages[id];
            return { id, timestamp: msg?.timestamp || 'unknown' };
          }).sort((a, b) => {
            if (a.timestamp === 'unknown' || b.timestamp === 'unknown') return 0;
            return new Date(a.timestamp) - new Date(b.timestamp);
          });
          console.log(`[getChildIds] ${parentId}: reply_order active`, {
            ordered: message.reply_order,
            unordered: unorderedWithTimestamps,
            finalOrder: ordered
          });
        }
        
        return ordered;
      }
      
      // No custom ordering, return as-is
      return childIds;
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
    getVisibleBranchMessages: (state) => (messageId) => {
      const result = [];
      
      // Get the starting message using the provided ID
      const startingMessage = state.messages[messageId];
      
      if (!startingMessage) {
        return [];
      }
            
      // STEP 1: First trace UPWARD to find the highest ancestor that's in the store
      let highestAncestor = startingMessage;
      let currentParentId = startingMessage.parent_id;
      
      // Trace up through parent_id as far as we can go
      while (currentParentId && state.messages[currentParentId]) {
        highestAncestor = state.messages[currentParentId];
        currentParentId = highestAncestor.parent_id;
      }
      
      
      // STEP 2: Now build the chain from highest ancestor down - NO STATE MODIFICATIONS
      // Start with the highest ancestor found
      result.push(highestAncestor);
      
      // Initialize currentMessage to highest ancestor to begin downward traversal
      let currentMessage = highestAncestor;
      
      // STEP 3: Recursively follow branch_child path downward - NO STATE MODIFICATIONS
      while (true) {
        // If message has no branch child, break
        if (!currentMessage.branch_child) {
          break;
        }
        
        const childId = currentMessage.branch_child;
        
        // If child doesn't exist in the store, break
        if (!state.messages[childId]) {
          break;
        }
        
        
        // Add the branch child to the result
        result.push(state.messages[childId]);
        
        // Move to the next message
        currentMessage = state.messages[childId];
      }
      
      
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
      const userUid = currentUser?.uid;
      
      // Filter messages by is_pinned property
      return Object.values(state.messages)
        .filter(message => {
          // First ensure it's a pinned message
          const isPinned = message.is_pinned === 1 || message.is_pinned === true;
          if (!isPinned) return false;
          
          // Then filter based on the active tab
          const isPublic = message.public === 1 || message.public === true;
          const recipients = Array.isArray(message.recipients) ? message.recipients : [];
          const isUserRecipient = recipients.some(r => {
            if (!r) return false;
            if (typeof r === 'string') {
              return (userUid && r === userUid) || (userEmail && r === userEmail);
            }
            if (typeof r === 'object') {
              const matchesUid = userUid && r.uid && r.uid === userUid;
              const matchesEmail = userEmail && r.email && r.email === userEmail;
              return !!(matchesUid || matchesEmail);
            }
            return false;
          });
            
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

    // Compatibility getters mapped to filters state
    getSelectedProfile: state => null,
    getPublicFilter: state => state.filters.isPublic,
    getSelectedRecipients: state => state.filters.recipients,

    // Consolidated filter getters
    getFilters: state => state.filters,
    getAuthors: state => state.filters.authors,
    getRecipients: state => state.filters.recipients,
    getIsPublic: state => state.filters.isPublic,
    getDateRange: state => state.filters.dateRange,
    getSortOrder: state => state.filters.sortOrder,
    
    // Read status getters using helper functions
    // Consider unread if user is a recipient and backend-provided is_read is false (all-edges semantics)
    isMessageUnread: (state, getters, rootState) => messageId => {
      const message = state.messages[messageId];
      if (!message) return false;
      const user = rootState?.auth?.user;
      const isRecipient = user && Array.isArray(message.recipients)
        ? message.recipients.some(r => (typeof r === 'object' && r.uid === user.uid) || r === user.uid)
        : false;
      if (!isRecipient) return false;
      return message.is_read === false;
    },
    
    isMessageRead: state => messageId => {
      const message = state.messages[messageId];
      return isMessageRead(message);
    },

    // Thread view mode getters
    isThreadViewMode: state => state.threadViewMode,
    
    // Marking as read state getters
    isMessageMarkingAsRead: state => messageId => {
      return state.markingAsReadIds.includes(messageId);
    },

    getMarkingAsReadIds: state => state.markingAsReadIds
  }
}

