import MessageService, { LOAD_RADIUS } from '../../services/MessageService'
import { mockMessages } from '../../utils/mock/stitchMockData.js'
console.log('[MOCK] mockMessages loaded, count:', Object.keys(mockMessages).length);
import UserService from '../../services/UserService'
import WebSocketService from '../../services/ws/WebSocketService'
import GraphLayoutService from '../../services/GraphLayoutService.js'
import { contentText, getAuthorDisplayName, getAuthorUid, getAuthorUserTag } from '../../utils/messageCompat.js'
import { withoutAnnotation } from '../../utils/annotations.js'

// Latest inbox list fetch. An older response must not commit after a newer one.
let inboxFetchSerial = 0

const annotationLoads = new Map()

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

function outgoingChildPool(message) {
  if (!message) return [];
  return [...new Set([...(message.child_ids || []), ...(message.stitch_child_ids || [])])];
}

// default_outgoing initializes branch_child only when it names a current outgoing child.
function explicitDefaultOutgoing(message) {
  const id = message && message.default_outgoing;
  if (!id) return null;
  return outgoingChildPool(message).includes(id) ? id : null;
}

// Helper: unread only when the user is a recipient and is_read is explicitly false.
function isMessageUnread(message, user) {
  if (!message || !user) return false;
  const isRecipient = Array.isArray(message.recipients)
    ? message.recipients.some(r => {
        if (!r) return false;
        if (typeof r === 'object') return (r.uid && r.uid === user.uid) || (r.user_tag && r.user_tag === user.user_tag);
        return r === user.uid || r === user.user_tag;
      })
    : false;
  return isRecipient && message.is_read === false;
}

function getIncomingMessageAudience(messageData, user) {
  if (!user || !messageData) {
    return { isFromCurrentUser: false, isToCurrentUser: false };
  }

  const authorUid = getAuthorUid(messageData);
  const authorTag = getAuthorUserTag(messageData);
  const isFromCurrentUser = authorUid === user.uid || authorTag === user.user_tag;

  const recipients = Array.isArray(messageData.recipients) ? messageData.recipients : [];
  const isToCurrentUser = recipients.some(r => {
    if (!r) return false;
    if (typeof r === 'object') return (r.uid && r.uid === user.uid) || (r.user_tag && r.user_tag === user.user_tag);
    if (typeof r === 'string') return r === user.uid || r === user.user_tag;
    return false;
  });

  return { isFromCurrentUser, isToCurrentUser };
}

// Helper function to check if a message is read (only true is considered read)
function isMessageRead(message) {
  return message && message.is_read === true;
}

function sameId(a, b) {
  return a != null && b != null && String(a) === String(b);
}

function openThreadAnchorId() {
  if (typeof window === 'undefined' || !window.location) return null;
  const match = String(window.location.pathname || '').match(/^\/messages\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch (_) {
    return match[1];
  }
}

function isOnOpenVisibleBranch(getters, messageId) {
  const anchorId = openThreadAnchorId();
  if (!anchorId || messageId == null) return false;
  const branch = getters.getFullVisibleBranch(anchorId);
  return Array.isArray(branch) && branch.some(message => sameId(message && message.id, messageId));
}

function rememberOutgoingChild(state, parentId, childId) {
  if (parentId == null || childId == null || sameId(parentId, childId)) return false;
  if (!state.childrenByParent) state.childrenByParent = {};
  const parentKey = String(parentId);
  const known = state.childrenByParent[parentKey] || [];
  if (known.some(id => sameId(id, childId))) return false;
  state.childrenByParent[parentKey] = [...known, childId];
  return true;
}

function forgetOutgoingChild(state, parentId, childId) {
  if (parentId == null || childId == null || !state.childrenByParent) return;
  const parentKey = String(parentId);
  const known = state.childrenByParent[parentKey];
  if (!known) return;
  const next = known.filter(id => !sameId(id, childId));
  if (next.length === known.length) return;
  if (next.length === 0) delete state.childrenByParent[parentKey];
  else state.childrenByParent[parentKey] = next;
}

// Append a reply onto its parent. Every store write goes through here so a
// websocket message and a fetched thread update the same child list.
// The side index is what the already-mounted sibling arrows read, including
// when the parent record itself is not replaced.
function linkReplyToParent(state, parentId, childId) {
  if (parentId == null || childId == null || sameId(parentId, childId)) return;
  const recorded = rememberOutgoingChild(state, parentId, childId);
  const parent = state.messages[parentId] || state.messages[String(parentId)];
  let linkedOnParent = false;
  if (parent) {
    const childIds = Array.isArray(parent.child_ids) ? parent.child_ids : [];
    if (!childIds.some(id => sameId(id, childId))) {
      const storeKey = state.messages[parentId] ? parentId : String(parentId);
      state.messages[storeKey] = {
        ...parent,
        child_ids: [...childIds, childId]
      };
      linkedOnParent = true;
    }
  }
  if (recorded || linkedOnParent) state.structureVersion += 1;
}

export default {
  namespaced: true,
  
  state: {
    // Flat storage of messages by ID
    messages: {},

    // parent id -> reply ids learned from stored messages. Sibling arrows read
    // this so a websocket reply lights up the navigator already on screen.
    childrenByParent: {},

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

    // Version counter incremented on any structural change (add/remove message, add/remove link)
    // to allow external views (like GraphView) to react without deep-watching the messages object.
    structureVersion: 0,

    // Annotation ids the viewer cannot read. The edge does not grant visibility.
    unavailableAnnotationIds: {},
  },
  
  mutations: {
    SET_MESSAGE(state, message) {
      if (!message || !message.id) return;
      
      if (String(message.id).startsWith('msg_')) {
        console.log('[MOCK] SET_MESSAGE mutation for', message.id);
      }

      // Check if message already exists in store - if so, merge it
      const existingMessage = state.messages[message.id];

      // Increment structure version if this is a new message or if structural fields changed
      const isNew = !existingMessage;
      let structureChanged = isNew;
      if (existingMessage) {
        if (message.parent_id !== undefined && message.parent_id !== existingMessage.parent_id) structureChanged = true;
        if (message.child_ids && JSON.stringify(message.child_ids) !== JSON.stringify(existingMessage.child_ids)) structureChanged = true;
        if (message.stitch_child_ids && JSON.stringify(message.stitch_child_ids) !== JSON.stringify(existingMessage.stitch_child_ids)) structureChanged = true;
        if (message.stitch_parent_ids && JSON.stringify(message.stitch_parent_ids) !== JSON.stringify(existingMessage.stitch_parent_ids)) structureChanged = true;
      }

      if (structureChanged) {
        state.structureVersion += 1;
      }

      // Normalize light payloads but avoid clobbering existing structure
      if (!Array.isArray(message.child_ids)) {
        message.child_ids = [];
      }

      if (existingMessage) {
        // Preserve branch_child if it exists
        const currentBranchChild = existingMessage.branch_child;
        
        // Handle merging child_ids from existing and new message
        let mergedChildIds = [...(message.child_ids || [])];
        if (existingMessage.child_ids && existingMessage.child_ids.length > 0) {
          mergedChildIds = [...new Set([...existingMessage.child_ids, ...mergedChildIds])];
        }

        // For branch validation, we must consider both replies AND stitch links.
        const stitchChildIds = message.stitch_child_ids || existingMessage.stitch_child_ids || [];
        const allPotentialChildren = [...new Set([...mergedChildIds, ...stitchChildIds])];

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
        
        // default_outgoing fills branch_child only when no selection exists yet.
        const hasChildren = allPotentialChildren.length > 0;
        const explicitDefault = explicitDefaultOutgoing(mergedMessage);
        if (hasChildren && currentBranchChild === undefined && explicitDefault) {
          mergedMessage.branch_child = explicitDefault;
        } else if (hasChildren && currentBranchChild === undefined) {
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
              if (aInOrder && !bInOrder) return 1;
              if (!aInOrder && bInOrder) return -1;
              const msgA = state.messages[a];
              const msgB = state.messages[b];
              if (msgA && msgB) return new Date(msgA.timestamp) - new Date(msgB.timestamp);
              return 0;
            });
            
            // Prefer the last reply, or fall back to the last stitch if no replies exist in this specific merge
            mergedMessage.branch_child = orderedIds.length > 0 ? orderedIds[orderedIds.length - 1] : stitchChildIds[stitchChildIds.length - 1];
          } else {
            // No custom order - use most recent by timestamp
            const childMessages = allPotentialChildren
              .map(childId => state.messages[childId])
              .filter(child => child)
              .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            mergedMessage.branch_child = childMessages.length > 0 ? 
              childMessages[childMessages.length - 1].id : 
              allPotentialChildren[allPotentialChildren.length - 1];
          }
        } else if (hasChildren) {
          // Keep existing selection if it's still valid (in replies OR stitches)
          const isBranchChildValid = allPotentialChildren.includes(currentBranchChild);
          if (isBranchChildValid) {
            mergedMessage.branch_child = currentBranchChild;
          } else if (explicitDefault) {
            mergedMessage.branch_child = explicitDefault;
          } else {
            // Re-select branch_child respecting pool
            const childMessages = allPotentialChildren
              .map(childId => state.messages[childId])
              .filter(child => child)
              .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            mergedMessage.branch_child = childMessages.length > 0 ? 
              childMessages[childMessages.length - 1].id : 
              allPotentialChildren[allPotentialChildren.length - 1];
          }
        } else {
          mergedMessage.branch_child = null;
        }
        
        // Update the store with merged message
        state.messages[message.id] = mergedMessage;
        
      } else {
        // New message, not in store yet.
        // default_outgoing wins when it names a current outgoing child; otherwise the previous fallback.
        const hasChildren = message.child_ids && message.child_ids.length > 0;
        const explicitDefault = explicitDefaultOutgoing(message);
        if (explicitDefault) {
          message.branch_child = explicitDefault;
        } else if (hasChildren) {
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

      const stored = state.messages[message.id];
      if (stored && stored.parent_id) {
        linkReplyToParent(state, stored.parent_id, stored.id);
      }
    },

    CACHE_ANNOTATION(state, message) {
      if (!message || !message.id) return;
      const existing = state.messages[message.id];
      state.messages[message.id] = {
        ...(existing || {}),
        ...message,
        parent_id: null,
        child_ids: Array.isArray(message.child_ids) ? message.child_ids : (existing?.child_ids || []),
        branch_child: existing?.branch_child ?? null
      };
    },

    ADD_ANNOTATION_REF(state, { hostId, id, part }) {
      const host = state.messages[hostId];
      if (!host || !id) return;
      const annotations = Array.isArray(host.annotations) ? host.annotations.filter(Boolean) : [];
      if (annotations.some((item) => item.id === id)) return;
      const ref = { id };
      if (Number.isInteger(part)) ref.part = part;
      state.messages[hostId] = { ...host, annotations: [...annotations, ref] };
    },

    MARK_ANNOTATION_UNAVAILABLE(state, id) {
      if (!id) return;
      state.unavailableAnnotationIds = { ...state.unavailableAnnotationIds, [id]: true };
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
      if (message.parent_id) {
        forgetOutgoingChild(state, message.parent_id, messageId);
        const parent = state.messages[message.parent_id];
        if (parent && parent.child_ids) {
          const newChildIds = parent.child_ids.filter(id => !sameId(id, messageId));
          if (newChildIds.length !== parent.child_ids.length) {
            state.messages[message.parent_id] = {
              ...parent,
              child_ids: newChildIds
            };
          }
        }
      }
      
      // Delete the message
      delete state.messages[messageId];
      state.structureVersion += 1;
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
        if (message && message.parent_id && !messagesToDelete.has(message.parent_id)) {
          forgetOutgoingChild(state, message.parent_id, msgId);
          if (state.messages[message.parent_id]) {
            // Only update parents that aren't being deleted themselves
            if (!parentUpdates.has(message.parent_id)) {
              parentUpdates.set(message.parent_id, new Set(state.messages[message.parent_id].child_ids || []));
            }
            // Remove this message from its parent's child_ids
            const pool = parentUpdates.get(message.parent_id);
            for (const id of [...pool]) {
              if (sameId(id, msgId)) pool.delete(id);
            }
          }
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

      // Annotation rows hang off a host's annotations list, not child_ids.
      for (const host of Object.values(state.messages)) {
        if (!host || !Array.isArray(host.annotations)) continue;
        let next = host.annotations;
        for (const id of messagesToDelete) next = withoutAnnotation(next, id);
        if (next.length === host.annotations.length) continue;
        state.messages[host.id] = { ...host, annotations: next };
      }
      state.structureVersion += 1;
    },
    
    // Restore REMOVE_TEMP_THREAD mutation

    
    UPDATE_PIN_STATUS(state, { messageId, isPinned }) {
      if (state.messages[messageId]) {
        state.messages[messageId].is_pinned = isPinned ? 1 : 0;
      }
    },
    
    // New mutation to change selected child and parent back-pointer for the visible branch
    SET_BRANCH_LINK(state, { parentId, childId }) {
      if (parentId && state.messages[parentId]) {
        state.messages[parentId] = {
          ...state.messages[parentId],
          branch_child: childId
        };
      }
      if (childId && state.messages[childId]) {
        state.messages[childId] = {
          ...state.messages[childId],
          branch_parent: parentId
        };
      }
    },
    SET_BRANCH_CHILD(state, { messageId, childId }) {
      // Deprecated in favor of SET_BRANCH_LINK, but kept for minimal compatibility
      const message = state.messages[messageId];
      if (!message) return;
      
      state.messages[messageId] = {
        ...message,
        branch_child: childId
      };
    },
    SET_BRANCH_PARENT(state, { messageId, parentId }) {
      // Deprecated in favor of SET_BRANCH_LINK, but kept for minimal compatibility
      console.log(`[SET_BRANCH_PARENT] ${messageId} -> ${parentId}`);
      const message = state.messages[messageId];
      if (!message) return;
      
      state.messages[messageId] = {
        ...message,
        branch_parent: parentId
      };
    },
    
    // New mutation for WebSocket updates
    ADD_CHILD_TO_PARENT(state, { parentId, childId }) {
      linkReplyToParent(state, parentId, childId);
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

    ADD_STITCH_LINK(state, { messageIdFrom, messageIdTo }) {
      const source = state.messages[messageIdFrom];
      if (source) {
        const nextIds = [...(source.stitch_child_ids || [])];
        if (!nextIds.includes(messageIdTo)) {
          nextIds.push(messageIdTo);
          state.messages[messageIdFrom] = { ...source, stitch_child_ids: nextIds };
        }
      }
      const target = state.messages[messageIdTo];
      if (target) {
        const nextIds = [...(target.stitch_parent_ids || [])];
        if (!nextIds.includes(messageIdFrom)) {
          nextIds.push(messageIdFrom);
          state.messages[messageIdTo] = { ...target, stitch_parent_ids: nextIds };
        }
      }
      state.structureVersion += 1;
    },

    REMOVE_STITCH_LINK(state, { messageIdFrom, messageIdTo }) {
      const source = state.messages[messageIdFrom];
      if (source && source.stitch_child_ids) {
        const nextIds = source.stitch_child_ids.filter(id => id !== messageIdTo);
        state.messages[messageIdFrom] = { ...source, stitch_child_ids: nextIds };
      }
      const target = state.messages[messageIdTo];
      if (target && target.stitch_parent_ids) {
        const nextIds = target.stitch_parent_ids.filter(id => id !== messageIdFrom);
        state.messages[messageIdTo] = { ...target, stitch_parent_ids: nextIds };
      }
      state.structureVersion += 1;
    },

    INCREMENT_STRUCTURE_VERSION(state) {
      state.structureVersion += 1;
    }
  },
  
  actions: {
    // Shared ingest for websocket, sibling catch-up, and thread refresh.
    // A recipient message that lands on the open thread's visible branch is
    // marked read. Silence and refresh suppress the toast only; a message
    // off that branch stays unread.
    async ingestIncomingMessage({ commit, getters, dispatch, rootState, state }, {
      messageData,
      writeToStore = true,
      autoMarkIfInBranch = true,
      notifyIfOffPath = true,
      source = 'unspecified',
      silent = false,
    } = {}) {
      try {
        if (!messageData || !messageData.id) return;

        if (!messageData.parent_id && messageData.parentId) {
          messageData.parent_id = messageData.parentId;
        }
        if (messageData.silent === true) silent = true;
        if (Object.prototype.hasOwnProperty.call(messageData, 'silent')) {
          messageData = { ...messageData };
          delete messageData.silent;
        }

        // Create payloads ship is_read: null. Keep a real read, and record every
        // other recipient message as unread so a later branch mark can see it.
        const stored = state.messages[messageData.id] || state.messages[String(messageData.id)];
        const alreadyRead = stored?.is_read === true || messageData.is_read === true;
        if (alreadyRead && messageData.is_read !== true) {
          messageData = { ...messageData, is_read: true };
        }

        if (writeToStore) {
          commit('SET_MESSAGE', messageData);
        }

        const user = rootState.auth?.user;
        const { isFromCurrentUser, isToCurrentUser } = getIncomingMessageAudience(messageData, user);

        const parentId = messageData.parent_id;
        const typingAuthorUid = getAuthorUid(messageData);
        if (!silent && parentId && typingAuthorUid) {
          dispatch('typing/clearAuthor', {
            authorUid: typingAuthorUid,
            targetMessageId: parentId
          }, { root: true });
        }
        if (parentId) {
          const parentInStore = getters.getMessage(parentId);
          if (parentInStore) {
            commit('ADD_CHILD_TO_PARENT', { parentId, childId: messageData.id });

            // If the parent currently has NO branch child selected, auto-select this one.
            // This ensures the first reply to a message appears 'live' in the thread.
            if (!parentInStore.branch_child) {
              console.log(`[messages store] Establishing first reply ${messageData.id} as branch child for ${parentId}`);
              commit('SET_BRANCH_CHILD', { messageId: parentId, childId: messageData.id });
            }
          }
        }

        if (isToCurrentUser && !isFromCurrentUser) {
          if (!alreadyRead) {
            commit('UPDATE_MESSAGE_READ_STATUS', { messageId: messageData.id, isRead: false });
          }

          const onVisibleBranch = isOnOpenVisibleBranch(getters, messageData.id);

          if (autoMarkIfInBranch && onVisibleBranch) {
            dispatch('batchMarkAsRead', [messageData.id]);
          } else if (!silent && notifyIfOffPath && !onVisibleBranch) {
            const authorName = getAuthorDisplayName(messageData) !== 'Unknown'
              ? getAuthorDisplayName(messageData)
              : (getAuthorUserTag(messageData) || 'Someone');

            const previewText = contentText(messageData.content)
            const contentPreview = previewText
              ? (previewText.length > 60 ? previewText.substring(0, 60) + '...' : previewText)
              : 'New message';
            dispatch('ui/setMessageNotification', {
              id: messageData.id,
              title: `New message from ${authorName}`,
              message: contentPreview,
              messageData,
              timestamp: new Date().toISOString()
            }, { root: true });
          }
        }
      } catch (e) {
        console.error('[messages store] ingestIncomingMessage error:', e);
      }
    },

    // Handle incoming message from WebSocket (transport-agnostic)
    async handleIncomingWsMessage({ dispatch }, messageData) {
      const silent = messageData?.silent === true;
      return dispatch('ingestIncomingMessage', { messageData, source: 'websocket', silent });
    },

    async ingestNewlyDiscoveredMessages({ state, dispatch }, {
      messages,
      previouslyKnownIds,
      autoMarkIfInBranch = true,
      notifyIfOffPath = false,
    } = {}) {
      if (!Array.isArray(messages) || messages.length === 0) return;

      const knownIds = previouslyKnownIds instanceof Set
        ? previouslyKnownIds
        : new Set((previouslyKnownIds || []).map(id => String(id)));

      for (const messageData of messages) {
        if (!messageData?.id) continue;
        if (knownIds.has(String(messageData.id))) continue;

        await dispatch('ingestIncomingMessage', {
          messageData,
          writeToStore: !state.messages[messageData.id],
          autoMarkIfInBranch,
          notifyIfOffPath,
          source: 'refresh',
        });
      }
      dispatch('refreshThreadUnreadCounts');
    },
    isTemporaryId(id) {
      return typeof id === 'string' && id.toString().startsWith('temp-');
    },
    
    // NEW ACTION: Prepare branch path by setting branch_child relationships
    prepareBranchPath({ commit, state }, threadRootId) {
      if (!threadRootId || !state.messages[threadRootId]) {
        return false;
      }
      
      // STEP 1: First trace UPWARD to find the highest ancestor in the store
      let startingMessage = state.messages[threadRootId];
      let highestAncestor = startingMessage;
      let childMessage = startingMessage;
      
      // Resolve parent using branch_parent (explicit stitch/history override) or standard parent_id
      const getParentId = (msg) => (msg.branch_parent !== undefined && msg.branch_parent !== null) ? msg.branch_parent : msg.parent_id;
      
      let currentParentId = getParentId(startingMessage);
      const visitedUp = new Set([startingMessage.id]);
      
      while (currentParentId && state.messages[currentParentId]) {
        if (visitedUp.has(currentParentId)) {
          console.warn('[prepareBranchPath] Circular parent reference detected at:', currentParentId);
          break;
        }
        visitedUp.add(currentParentId);

        const parentMessage = state.messages[currentParentId];
        // Ensure parent points to this child and child points to this parent
        commit('SET_BRANCH_LINK', { 
          parentId: currentParentId, 
          childId: childMessage.id 
        });
        
        highestAncestor = parentMessage;
        childMessage = parentMessage;
        currentParentId = getParentId(parentMessage);
      }
      
      
      // STEP 2: Now follow the branch path down, ensuring each node has branch_child set
      let currentMessage = highestAncestor;
      const visitedDown = new Set();
      
      // Trace downward, ensuring each node has a branch_child if it has children
      while (currentMessage) {
        if (visitedDown.has(currentMessage.id)) {
          console.warn('[prepareBranchPath] Circular child reference detected at:', currentMessage.id);
          break;
        }
        visitedDown.add(currentMessage.id);

        // pool of children (replies + stitches)
        const childPool = (currentMessage.child_ids || []).concat(currentMessage.stitch_child_ids || []);

        // If message has no branch child but has children in pool, set last child as branch_child
        if (!currentMessage.branch_child && childPool.length > 0) {
          // Get all child messages present in store
          const childMessages = childPool
            .map(childId => state.messages[childId])
            .filter(child => child)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          
          if (childMessages.length > 0) {
            // Always use last child (furthest right / newest) from complete pool
            const branchChild = childMessages[childMessages.length - 1];
            
            // Set link in both directions
            commit('SET_BRANCH_LINK', { 
              parentId: currentMessage.id, 
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
    
    // Network traversal with the HTTP result kept intact.
    // loadTraversal still returns the message array for older callers.
    async loadTraversalReport({ commit }, { messageId, up_depth = 0, down_depth = 0, get_replies = true, get_children = false, edge_type = 'replies' } = {}) {
      if (!messageId) {
        return { messages: [], ok: false, status: 0, detail: 'missing message id' };
      }
      try {
        const response = await MessageService.traverseFrom(messageId, { up_depth, down_depth, get_replies, get_children, edge_type });
        const data = response?.data || {};
        const messages = [];
        if (data.origin) messages.push(data.origin);
        if (Array.isArray(data.messages)) messages.push(...data.messages);
        if (messages.length > 0) {
          commit('SET_MESSAGES', messages);
        }
        return { messages, ok: true, status: response?.status || 200, detail: null };
      } catch (error) {
        const status = error?.response?.status || 0;
        const raw = error?.response?.data?.detail || error?.message || 'request failed';
        const detail = typeof raw === 'string' ? raw : JSON.stringify(raw);
        console.error('[messages store] traverse-from failed', { messageId, up_depth, down_depth, status, detail });
        return { messages: [], ok: false, status, detail };
      }
    },

    // Unified traversal loader
    async loadTraversal({ commit, dispatch }, { messageId, up_depth = 0, down_depth = 0, get_replies = true, get_children = false, edge_type = 'replies' }) {
      if (String(messageId).startsWith('msg_')) {
        console.log(`[MOCK] loadTraversal ${messageId} up:${up_depth} down:${down_depth} type:${edge_type}`);
        
        const toLoad = new Map(); // id -> depth info
        const queue = [{ id: messageId, du: 0, dd: 0 }];
        
        while (queue.length > 0) {
          const { id, du, dd } = queue.shift();
          if (!id || !mockMessages[id] || toLoad.has(id)) continue;
          
          const msg = mockMessages[id];
          toLoad.set(id, msg);
          
          // Upward traversal
          if (du < up_depth) {
            const parents = (edge_type === 'links') 
              ? (msg.stitch_parent_ids || []) 
              : (msg.parent_id ? [msg.parent_id] : []);
              
            parents.forEach(pid => queue.push({ id: pid, du: du + 1, dd }));
          }
          
          // Downward traversal
          if (dd < down_depth) {
            const children = (edge_type === 'links') 
              ? (msg.stitch_child_ids || []) 
              : (msg.child_ids || []);
              
            children.forEach(cid => queue.push({ id: cid, du, dd: dd + 1 }));
          }

          // Special case: get_children=true (one-hop children for all nodes)
          if (get_children && dd === 0) {
             const children = msg.child_ids || [];
             children.forEach(cid => queue.push({ id: cid, du, dd: 1 }));
          }
        }
        
        const results = Array.from(toLoad.values());
        results.forEach(m => commit('SET_MESSAGE', m));
        return results;
      }
      const report = await dispatch('loadTraversalReport', { messageId, up_depth, down_depth, get_replies, get_children, edge_type });
      return report.messages;
    },

    // Load a single message
    async loadMessage({ dispatch }, messageId) {
      return dispatch('loadTraversal', { messageId, up_depth: 0, down_depth: 0 });
    },
    
    // Load parent branch - delegate to unified traversal
    async loadMessageBranchUp({ dispatch }, { messageId, depth = 1, get_replies = true, get_children = true, edge_type = 'replies' }) {
      return dispatch('loadTraversal', { messageId, up_depth: depth, down_depth: 0, get_replies, get_children, edge_type });
    },
    
    // Load child branch - delegate to unified traversal
    async loadMessageBranchDown({ dispatch }, { messageId, depth = 1, get_replies = true, get_children = true, edge_type = 'replies' }) {
      return dispatch('loadTraversal', { messageId, up_depth: 0, down_depth: depth, get_replies, get_children, edge_type });
    },
    
    // Load radius - delegate to unified traversal
    async loadMessageRadius({ commit, dispatch }, { messageId, radius = LOAD_RADIUS, get_replies = true, get_children = true, edge_type = 'replies' }) {
      return dispatch('loadTraversal', { messageId, up_depth: radius, down_depth: radius, get_replies, get_children, edge_type });
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

    // Reload the loaded reply chain. The client graph cannot discover replies that
    // arrived while it was cached, so the server walks from the deepest loaded reply
    // on the visible spine. Stitch links are not part of that spine. up_depth is the
    // number of reply ancestors already in the store, capped at LOAD_RADIUS, plus one
    // hop of reply bodies past the leaf.
    async refreshLoadedReplyChain({ dispatch, state }, { messageId } = {}) {
      if (!messageId || !state.messages[messageId]) return [];

      let leaf = state.messages[messageId];
      const seenDown = new Set([String(leaf.id)]);
      while (leaf) {
        const nextId = leaf.branch_child;
        if (!nextId || !state.messages[nextId]) break;
        const replyIds = new Set((leaf.child_ids || []).map(id => String(id)));
        if (!replyIds.has(String(nextId))) break;
        if (seenDown.has(String(nextId))) break;
        seenDown.add(String(nextId));
        leaf = state.messages[nextId];
      }

      let upDepth = 0;
      let current = leaf;
      const seenUp = new Set([String(leaf.id)]);
      while (
        upDepth < LOAD_RADIUS &&
        current &&
        current.parent_id &&
        state.messages[current.parent_id] &&
        !seenUp.has(String(current.parent_id))
      ) {
        seenUp.add(String(current.parent_id));
        upDepth += 1;
        current = state.messages[current.parent_id];
      }

      return dispatch('loadTraversal', {
        messageId: leaf.id,
        up_depth: upDepth,
        down_depth: 1,
        get_replies: true,
        get_children: true,
        edge_type: 'replies',
      });
    },
    
    // Send a reply to a message
    async sendReply({ commit, dispatch, rootState, state, getters }, { parentId, content, isPrivate, recipients, content_author, tags, files, subject, channel_ids }) {
      try {
        console.log('[Messages Store] Starting sendReply', { 
          parentId, 
          isPrivate, 
          recipientsCount: recipients?.length || 0,
          hasAuthor: !!content_author,
          subject
        });

        // Resolve context (ancestors) for the bot
        let context = null;
        if (parentId) {
          try {
            // Get the visible branch leading up to AND INCLUDING the parent
            const branchMessages = getters.getAncestorPath(parentId);
            if (branchMessages && branchMessages.length > 0) {
              // Context should be chronological (oldest first)
              // getVisibleBranchMessages already returns them in order
              context = branchMessages;
              console.log(`[Messages Store] Resolved context for bot: ${context.length} messages`);
            }
          } catch (contextError) {
            console.warn('[Messages Store] Failed to resolve context for bot reply:', contextError);
          }
        }

        // Use the current user if content_author is not provided
        const effectiveAuthor = content_author || rootState.auth?.user?.uid;
        
        // Convert recipient UI selections into bot routing extras.
        // UI stores per-recipient `bot_version_id` on bot recipients.
        // Bots service expects `messageData.extras.bot_versions`.
        let extras = null;
        if (Array.isArray(recipients) && recipients.length > 0) {
          const botVersions = {};
          for (const r of recipients) {
            if (!r || typeof r !== 'object') continue;
            const botTag = r.user_tag || r.userTag;
            const versionId = r.bot_version_id ?? r.botVersionId;
            if (botTag && versionId) {
              botVersions[botTag] = versionId;
            }
          }

          if (Object.keys(botVersions).length > 0) {
            extras = { bot_versions: botVersions };
          }
        }

        // Process recipients - support both string and object formats
        // String format: "alice" or "@alice" or "uid:abc123" (defaults to notify=true)
        // Object format: {user_tag: "alice", public: true, notify: false}
        let processedRecipients = [];
        if (recipients && recipients.length > 0) {
          console.log('[Messages Store] Processing recipients:', recipients);
          
              processedRecipients = recipients.map(recipient => {
                // If recipient is an object, preserve it with notify flag
                if (typeof recipient === 'object' && recipient !== null) {
                  // Ensure it has user_tag or uid
                  if (!recipient.user_tag && !recipient.uid) {
                    console.log('[Messages Store] Invalid recipient object (no user_tag or uid):', recipient);
                    return null;
                  }
                  // Preserve the object format for per-recipient options (public, notify)
                  return {
                    user_tag: recipient.user_tag,
                    uid: recipient.uid,
                    public: recipient.public !== undefined ? recipient.public : true,
                    notify: recipient.notify !== undefined ? recipient.notify : true,
                    // Preserve per-recipient bot routing selection.
                    // Backend can merge this into message-level extras for webhook deliveries.
                    bot_version_id: recipient.bot_version_id ?? recipient.botVersionId ?? null,
                  };
                }
            // If recipient is a string, keep as is (defaults to notify=true on backend)
            else if (typeof recipient === 'string') {
              return recipient;
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
          tagsCount: Array.isArray(tags) ? tags.length : 0,
          contextCount: context?.length || 0
        });
        
        const response = await MessageService.sendReply(
          parentId, 
          content, 
          isPrivate, 
          processedRecipients, 
          effectiveAuthor, 
          tags, 
          files, 
          subject, 
          channel_ids,
          context,
          extras
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
            if (typeof r === 'string') return r === currentUserId || r === `uid:${currentUserId}`;
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

        if (!parentId && newMessage?.id) {
          const created = state.messages[newMessage.id] || newMessage;
          dispatch('navigation/prependCreatedRoot', created, { root: true });
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
    async deleteMessage({ commit, state, dispatch, getters }, { messageId, deleteDescendants = false }) {
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
        if (wasParentBranchChild && parentMessage) {
          // Get updated parent after REMOVE_MESSAGE_CASCADE might have modified it
          const updatedParent = state.messages[parentId];
          const remaining = outgoingChildPool(updatedParent).filter(id => id !== messageId);

          if (updatedParent && remaining.length > 0) {
            const explicitDefault = explicitDefaultOutgoing(updatedParent);
            const orderedChildIds = getters.getChildIds(parentId);
            const newBranchChildId = (explicitDefault && explicitDefault !== messageId)
              ? explicitDefault
              : (orderedChildIds.length > 0
                ? orderedChildIds[orderedChildIds.length - 1]
                : remaining[remaining.length - 1]);

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
        if (!rootGetters['auth/hasScope']('messages.write')) {
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
    
    // Universal fetch action that routes to appropriate service based on mode.
    // channelId: optional; when set (global channel selection), inbox/history/timeline are filtered to that channel.
    async fetchMessages({ commit, state, rootState }, { mode, skip = 0, limit = 15, sourceMessageId = null, showAllLinks = false, channelId = null }) {
      try {
        // Use global selected channel when channelId not explicitly passed (for list tabs)
        const effectiveChannelId = channelId ?? rootState.navigation?.selectedChannelId ?? null;

        // Check auth for modes that require it
        if ((mode === 'inbox') && !rootState.auth?.user) {
          console.log('[Store] fetchMessages called but no user authenticated for inbox mode, skipping');
          return { messages: [], has_more: false };
        }

        // Set loading state
        commit('SET_LOADING', { key: 'fetchingMessages', isLoading: true });
        
        console.log(`[Store] fetchMessages called with:`, {
          mode, skip, limit, sourceMessageId, showAllLinks, channelId: effectiveChannelId,
          user: rootState.auth?.user?.email || 'unauthenticated'
        });
        
        let response;
        let inboxFetchGen = null;
        
        // Route to appropriate service based on mode
        switch(mode) {
          case 'inbox': {
            inboxFetchGen = ++inboxFetchSerial;
            const unreadOnly = rootState.navigation?.inboxUnreadOnly === true;
            response = await UserService.fetchUserMessages(limit, skip, effectiveChannelId, unreadOnly);
            if (inboxFetchGen !== inboxFetchSerial) {
              return { messages: [], has_more: false, stale: true };
            }
            break;
          }
          
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
          case 'similar': {
            if (!sourceMessageId) throw new Error('sourceMessageId required for similar mode');
            const SimilarMessageService = (await import('../../services/MessageService')).default;
            const similarResponse = await SimilarMessageService.getSimilarMessages(sourceMessageId, { skip, limit });
            const similarData = similarResponse?.data || {};
            response = {
              messages: similarData.messages || [],
              has_more: similarData.has_more || false,
              total: similarData.total || 0
            };
            break;
          }
          case 'history':
            {
              const MessageService = (await import('../../services/MessageService')).default;
              const histResponse = await MessageService.getUserHistory(skip, limit, effectiveChannelId);
              response = {
                messages: histResponse.data.messages || [],
                has_more: histResponse.data.has_more || false,
                total: histResponse.data.total || 0
              };
            }
            break;
          case 'timeline':
            {
              const MessageService = (await import('../../services/MessageService')).default;
              const timelineResponse = await MessageService.getTimeline(skip, limit, effectiveChannelId);
              response = {
                messages: timelineResponse.data.messages || [],
                has_more: timelineResponse.data.has_more || false,
                total: timelineResponse.data.total || 0
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
        
        // Standard behavior: commit all fetched messages to store so they are available in the cache
        // for any view (Graph, Links, etc.)
        if (mode === 'inbox' && inboxFetchGen !== inboxFetchSerial) {
          return { messages: [], has_more: false, stale: true };
        }
        if (messages.length > 0) {
          // Loop through and commit individually to ensure full merge logic runs
          messages.forEach(m => commit('SET_MESSAGE', m));
          console.log(`[Store] ${mode} fetch committed ${messages.length} messages. Store total: ${Object.keys(state.messages).length}`);
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

      commit('INCREMENT_STRUCTURE_VERSION');
      try { GraphLayoutService.clearCache(); } catch (_) {}
      
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
    async markMessageAsRead({ commit, dispatch, state, rootState }, messageId) {
      console.log(`[Store] markMessageAsRead called for message ${messageId}`);
      
      try {
        const message = state.messages[messageId];
        const wasUnread = isMessageUnread(message, rootState?.auth?.user);
        
        if (wasUnread) {
          const resp = await UserService.markMessageAsRead(messageId);
          commit('UPDATE_MESSAGE_READ_STATUS', { messageId, isRead: true });
          dispatch('applyUnreadTotal', resp?.data?.unread_total);
          dispatch('refreshThreadUnreadCounts');
        }
        
        return true;
      } catch (error) {
        console.error(`[Store] Error marking message ${messageId} as read:`, error);
        return false;
      }
    },
    
    async markMessageAsUnread({ commit, dispatch, state }, messageId) {
      try {
        const message = state.messages[messageId];
        const wasRead = isMessageRead(message);
        
        const resp = await UserService.markMessageAsUnread(messageId);
        commit('UPDATE_MESSAGE_READ_STATUS', { messageId, isRead: false });
        dispatch('applyUnreadTotal', resp?.data?.unread_total);
        if (wasRead) {
          dispatch('refreshThreadUnreadCounts');
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
      
      // pool of children (replies + stitches)
      const childPool = (message.child_ids || []).concat(message.stitch_child_ids || []);

      // Return early if not a valid child
      if (!childPool.includes(childId)) {
        return false;
      }
      
      commit('SET_BRANCH_LINK', { parentId: messageId, childId });
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
      const currentIndex = orderedChildIds.findIndex(id => String(id) === String(currentChildId));
      
      if (currentIndex === -1) {
        // If no valid current child, use last child from ordered list (furthest right)
        if (message.reply_order && Array.isArray(message.reply_order) && message.reply_order.length > 0) {
          commit('SET_BRANCH_LINK', { 
            parentId: messageId, 
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
          
          commit('SET_BRANCH_LINK', { 
            parentId: messageId, 
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
        
        // Update the branch child and parent
        commit('SET_BRANCH_LINK', { 
          parentId: messageId, 
          childId: newChildId 
        });
        
        // Store the navigation direction for animations
        commit('navigation/SET_LAST_SIBLING_NAVIGATION', { 
          targetId: newChildId, 
          direction: direction 
        }, { root: true });

        
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
    async fetchUnreadMessageCount({ commit, state, rootState }) {
      if (state.loadingStates['fetchingUnreadCount'] === true) {
        return state.unreadMessageCount;
      }
      
      try {
        commit('SET_LOADING', { key: 'fetchingUnreadCount', isLoading: true });
        
        if (!rootState.auth?.user) {
          commit('SET_UNREAD_MESSAGE_COUNT', 0);
          return 0;
        }
        
        const response = await UserService.getUnreadMessageCount();
        const count = Number(response.data.unread_total);
        commit('SET_UNREAD_MESSAGE_COUNT', Number.isFinite(count) ? count : 0);
        return Number.isFinite(count) ? count : 0;
      } catch (error) {
        console.error('Error fetching unread message count:', error);
        return state.unreadMessageCount;
      } finally {
        commit('SET_LOADING', { key: 'fetchingUnreadCount', isLoading: false });
      }
    },

    applyUnreadTotal({ commit, dispatch }, unreadTotal) {
      const count = Number(unreadTotal);
      if (Number.isFinite(count) && count >= 0) {
        commit('SET_UNREAD_MESSAGE_COUNT', count);
        return count;
      }
      return dispatch('fetchUnreadMessageCount');
    },

    async refreshThreadUnreadCounts({ commit, state, rootState }) {
      if (!rootState.auth?.user) return;
      const leafIds = Object.values(state.messages)
        .filter(m => m && m.id && m.unread_count_in_thread !== undefined && m.unread_count_in_thread !== null)
        .map(m => m.id);
      if (leafIds.length === 0) return;
      try {
        const response = await UserService.getThreadUnreadCounts(leafIds);
        const counts = response?.data?.counts || [];
        counts.forEach(item => {
          if (!item?.id) return;
          commit('UPDATE_MESSAGE_THREAD_COUNT', {
            messageId: item.id,
            unreadCountInThread: item.unread_count_in_thread || 0,
          });
        });
      } catch (error) {
        console.error('Error refreshing thread unread counts:', error);
      }
    },

    async markAllMessagesAsRead({ dispatch, commit, rootState }) {
      try {
        if (!rootState.auth?.user) {
          commit('SET_UNREAD_MESSAGE_COUNT', 0)
          return { success: false, updated_count: 0, already_read_count: 0 }
        }

        commit('SET_LOADING', { key: 'markingAllAsRead', isLoading: true })
        const response = await UserService.markAllMessagesAsRead()
        const result = response?.data || {}
        await dispatch('applyUnreadTotal', result.unread_total)
        await dispatch('refreshThreadUnreadCounts')
        return result
      } catch (error) {
        console.error('Error marking all messages as read:', error)
        throw error
      } finally {
        commit('SET_LOADING', { key: 'markingAllAsRead', isLoading: false })
      }
    },

    async batchMarkAsRead({ commit, dispatch, state, rootState }, messageIds) {
      if (!state.threadViewMode) {
        console.log('[Store] Not in thread view mode, skipping auto-mark');
        return;
      }

      const user = rootState.auth?.user;
      if (!user) {
        console.log('[Store] No authenticated user, skipping auto-mark');
        return;
      }

      const eligibilityReasons = {};
      const eligibleIds = messageIds.filter(id => {
        const message = state.messages[id];
        if (!message) { eligibilityReasons[id] = 'not_in_store'; return false; }

        const unread = isMessageUnread(message, user);
        if (!unread) { eligibilityReasons[id] = 'already_read'; return false; }

        eligibilityReasons[id] = 'eligible';
        return true;
      });

      if (eligibleIds.length === 0) {
        return;
      }

      eligibleIds.forEach(id => commit('ADD_MARKING_AS_READ', id));

      try {
        const response = await UserService.batchMarkAsRead(eligibleIds);
        const result = response.data;

        eligibleIds.forEach(id => {
          commit('UPDATE_MESSAGE_READ_STATUS', { messageId: id, isRead: true });
        });

        await dispatch('applyUnreadTotal', result?.unread_total);
        dispatch('refreshThreadUnreadCounts');

      } catch (error) {
        console.error('[Store] Error in batch mark as read:', error);
      } finally {
        eligibleIds.forEach(id => commit('REMOVE_MARKING_AS_READ', id));
      }
    },

    // Helper action to mark visible branch messages as read
    async markVisibleBranchAsRead({ dispatch, getters }, messageId) {
      if (!messageId) return;
            
      // Get visible branch messages
      const visibleMessages = getters.getFullVisibleBranch(messageId);
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
        if (!rootGetters['auth/hasScope']('messages.write')) {
          throw new Error('Write permission required');
        }
        
        // Call the service to delete the link
        const success = await UserService.deleteLink(messageIdFrom, messageIdTo);
        
        if (success) {
          console.log('[Store] Link deleted successfully');
          commit('REMOVE_STITCH_LINK', { messageIdFrom, messageIdTo });
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
        if (!rootGetters['auth/hasScope']('messages.write')) {
          throw new Error('Write permission required');
        }
        
        // Call the service to create the link
        const success = await UserService.createLink(messageIdFrom, messageIdTo);
        
        if (success) {
          console.log('[Store] Link created successfully');
          commit('ADD_STITCH_LINK', { messageIdFrom, messageIdTo });
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
    },

    async ensureAnnotations({ state, commit }, ids) {
      const wanted = [...new Set((ids || []).filter((id) => typeof id === 'string' && id))];
      await Promise.all(wanted.map(async (id) => {
        if (state.messages[id] || state.unavailableAnnotationIds[id]) return;
        if (annotationLoads.has(id)) {
          await annotationLoads.get(id);
          return;
        }
        let finish = () => {};
        const gate = new Promise((resolve) => { finish = resolve; });
        annotationLoads.set(id, gate);
        try {
          const message = await MessageService.getMessage(id);
          if (message?.id) commit('CACHE_ANNOTATION', message);
        } catch (error) {
          const status = error?.response?.status;
          if (status === 403 || status === 404) {
            commit('MARK_ANNOTATION_UNAVAILABLE', id);
            return;
          }
          console.error('[messages] annotation load failed', id, error);
        } finally {
          finish();
          annotationLoads.delete(id);
        }
      }));
    },

    async createAnnotation({ commit }, { targetId, content, part = null }) {
      try {
        const result = await MessageService.sendAnnotation({
          targetId,
          content,
          part
        });
        const message = result.data;
        commit('CACHE_ANNOTATION', message);
        commit('ADD_ANNOTATION_REF', {
          hostId: targetId,
          id: message.id,
          part: Number.isInteger(part) ? part : null
        });
        return message;
      } catch (error) {
        const detail = error?.response?.data?.detail || error?.response?.data?.error;
        const message = typeof detail === 'string' ? detail : (error?.message || 'Could not save annotation');
        throw new Error(message);
      }
    }

  },
  
  getters: {
    getMessage: (state) => (id) => {
      return state.messages[id];
    },
    
    getChildIds: state => parentId => {
      const message = state.messages[parentId] || state.messages[String(parentId)];
      const knownChildren = state.childrenByParent?.[String(parentId)] || [];
      if (!message && knownChildren.length === 0) return [];

      const childIds = [];
      const seenChild = new Set();
      for (const id of [...(message?.child_ids || []), ...knownChildren]) {
        if (id == null) continue;
        const key = String(id);
        if (seenChild.has(key)) continue;
        seenChild.add(key);
        childIds.push(id);
      }
      const stitchChildIds = message?.stitch_child_ids || [];
      const replySet = new Set(childIds.map(id => String(id)));
      const order = Array.isArray(message?.reply_order) ? message.reply_order : [];
      const orderSet = new Set(order.map(id => String(id)));

      const byTime = (a, b) => {
        const msgA = state.messages[a];
        const msgB = state.messages[b];
        if (msgA && msgB) {
          return new Date(msgA.timestamp) - new Date(msgB.timestamp);
        }
        return 0;
      };

      // Frontend placement: unordered replies, then the partial order, then unordered stitches.
      const unorderedReplies = childIds.filter(id => !orderSet.has(String(id))).sort(byTime);
      const ordered = [];
      const seen = new Set();
      for (const id of order) {
        const key = String(id);
        if (seen.has(key)) continue;
        if (replySet.has(key) || stitchChildIds.some(stitchId => sameId(stitchId, id))) {
          seen.add(key);
          ordered.push(id);
        }
      }
      const unorderedStitches = stitchChildIds.filter(id => !orderSet.has(String(id)) && !replySet.has(String(id)));
      return [...unorderedReplies, ...ordered, ...unorderedStitches];
    },
    
    getParentId: state => childId => {
      const message = state.messages[childId];
      if (!message) return null;
    
      return message.parent_id || null;
    },
    
    getLoadedMessages: (state) => {
      const messages = Object.values(state.messages).filter((message) => message?.type !== 'annotation');
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
    
    // Get the path from root to the specified message
    getAncestorPath: (state) => (messageId) => {
      const result = [];
      let currentId = messageId;
      const visited = new Set();
      
      while (currentId && state.messages[currentId]) {
        if (visited.has(currentId)) {
          console.warn('[getAncestorPath] Circular reference detected at:', currentId);
          break;
        }
        visited.add(currentId);

        result.push(state.messages[currentId]);
        const msg = state.messages[currentId];
        currentId = msg.branch_parent !== undefined ? msg.branch_parent : msg.parent_id;
      }
      return result.reverse();
    },

    // Current "context" getter - returns the path up to but EXCLUDING the message
    getVisibleBranchMessages: (state, getters) => (messageId) => {
      const path = getters.getAncestorPath(messageId);
      return path.length > 0 ? path.slice(0, -1) : [];
    },

    // Modified getter - PURE GETTER with no state modifications
    // Get the FULL visible branch - follows the path from root down to the leaf
    getFullVisibleBranch: (state, getters) => (messageId) => {
      const result = [];
      const startingMessage = state.messages[messageId];
      
      if (!startingMessage) {
        return [];
      }
            
      // STEP 1: First trace UPWARD to find the highest ancestor that's in the store
      let highestAncestor = startingMessage;
      const getParentId = (msg) => (msg.branch_parent !== undefined && msg.branch_parent !== null) ? msg.branch_parent : msg.parent_id;
      
      let currentParentId = getParentId(startingMessage);
      const visitedUp = new Set([startingMessage.id]);
      
      while (currentParentId && state.messages[currentParentId]) {
        if (visitedUp.has(currentParentId)) {
          console.warn('[getFullVisibleBranch] Circular reference (up) at:', currentParentId);
          break;
        }
        visitedUp.add(currentParentId);

        highestAncestor = state.messages[currentParentId];
        currentParentId = getParentId(highestAncestor);
      }
      
      
      // STEP 2: Now build the chain from highest ancestor down - NO STATE MODIFICATIONS
      result.push(highestAncestor);
      let currentMessage = highestAncestor;
      const visitedDown = new Set();
      
      while (currentMessage) {
        if (visitedDown.has(currentMessage.id)) {
          console.warn('[getFullVisibleBranch] Circular reference (down) at:', currentMessage.id);
          break;
        }
        visitedDown.add(currentMessage.id);

        if (!currentMessage.branch_child) break;
        const childId = currentMessage.branch_child;
        if (!state.messages[childId]) break;
        
        result.push(state.messages[childId]);
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
      const activeTab = rootState.ui?.activeTab || 'history';
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
    // Consider unread if user is a recipient and is_read is false
    isMessageUnread: (state, getters, rootState) => messageId => {
      return isMessageUnread(state.messages[messageId], rootState?.auth?.user);
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
