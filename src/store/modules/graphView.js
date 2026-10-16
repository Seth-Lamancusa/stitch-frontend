import GraphLayoutService from '../../services/GraphLayoutService.js';
import { calculateTreeLayout, calculateBounds } from '../../utils/graph/layoutAlgorithms.js';
import { contentText } from '../../utils/messageCompat.js';

/**
 * Vuex store module for graph view state management
 * Manages layout, selection, viewport, and UI state for thread graph visualization
 */

const state = {
  // Layout state
  layout: {
    positions: new Map(),
    bounds: null,
    isCalculating: false,
    lastCalculated: null,
    // Layout mode: 'tree' (matplotlib-style circles)
    mode: 'tree',
    options: {
      layerHeight: 240,
      nodeSpacing: 240,
      rootSpacing: 240,
      maxWidth: 1600
    },
    // Tree layout specific options (matplotlib-inspired)
    treeOptions: {
      verticalGap: 120,     // Vertical spacing between layers
      horizontalGap: 60,    // Horizontal gap between sibling subtrees
      nodeWidth: 50         // Base width for leaf nodes
    }
  },

  // Viewport state
  viewport: {
    scale: 1,
    translateX: 0,
    translateY: 0,
    width: 800,
    height: 600
  },

  // Selection state
  selection: {
    selectedIds: [],
    lastSelectedId: null,
    selectionMode: false // true when in multi-select mode
  },

  // UI state
  ui: {
    sidePanelOpen: false,
    minimapVisible: true,
    toolbarExpanded: false,
    showingFilters: false,
    isStitchDrawingMode: false,
    stitchSourceId: null
  },

  // Filter state
  filters: {
    showUnreadOnly: false,
    showPublicOnly: false,
    authorFilter: null,
    searchQuery: ''
  },

  // Current graph data
  currentMessageId: null,
  extraSeedIds: [],
  messages: [],
  edges: []
};

const getters = {
  // Layout getters
  nodePosition: (state) => (messageId) => {
    return state.layout.positions.get(messageId) || null;
  },

  layoutBounds: (state) => {
    return state.layout.bounds;
  },

  isLayoutCalculating: (state) => {
    return state.layout.isCalculating;
  },

  layoutMode: (state) => {
    return state.layout.mode;
  },

  isTreeMode: (state) => {
    return state.layout.mode === 'tree';
  },

  // Selection getters
  isMessageSelected: (state) => (messageId) => {
    return state.selection.selectedIds.includes(messageId);
  },

  selectedMessages: (state) => {
    return state.messages.filter(msg => 
      state.selection.selectedIds.includes(msg.id)
    );
  },

  selectionCount: (state) => {
    return state.selection.selectedIds.length;
  },

  // Viewport getters
  viewportTransform: (state) => {
    return `translate(${state.viewport.translateX}, ${state.viewport.translateY}) scale(${state.viewport.scale})`;
  },

  // UI getters
  selectedMessageForPanel: (state, getters, rootState, rootGetters) => {
    const selectedId = state.selection.lastSelectedId;
    if (!selectedId) return null;

    // Prefer the locally-rendered subgraph, but fall back to the global
    // messages store to avoid empty panel flickers when the subgraph refreshes.
    const local = state.messages.find(msg => msg.id === selectedId);
    if (local) return local;

    try {
      const resolved = rootGetters?.['messages/getMessage']?.(selectedId) ?? null;
      if (!resolved) {
        console.debug('[GRAPH SIDE PANEL] selectedMessageForPanel resolved null', {
          selectedId,
          hasLocal: !!local,
        });
      }
      return resolved;
    } catch (e) {
      return null;
    }
  },

  // Filter getters
  filteredMessages: (state) => {
    let filtered = [...state.messages];

    if (state.filters.showUnreadOnly) {
      filtered = filtered.filter(msg => {
        // Check if message is unread for current user
        return msg.read_status && !msg.read_status[getCurrentUserId()];
      });
    }

    if (state.filters.showPublicOnly) {
      filtered = filtered.filter(msg => msg.public);
    }

    if (state.filters.authorFilter) {
      filtered = filtered.filter(msg => 
        msg.author && msg.author.uid === state.filters.authorFilter
      );
    }

    if (state.filters.searchQuery) {
      const query = state.filters.searchQuery.toLowerCase();
      filtered = filtered.filter(msg => 
        contentText(msg.content).toLowerCase().includes(query)
      );
    }

    return filtered;
  },

  // Edge calculations
  visibleEdges: (state, getters) => {
    const filteredMessages = getters.filteredMessages;
    const messageIds = new Set(filteredMessages.map(m => m.id));
    
    return state.edges.filter(edge => 
      messageIds.has(edge.source) && messageIds.has(edge.target)
    );
  }
};

const mutations = {
  // Layout mutations
  SET_LAYOUT_CALCULATING(state, isCalculating) {
    state.layout.isCalculating = isCalculating;
  },

  SET_LAYOUT_RESULT(state, { positions, bounds }) {
    state.layout.positions = positions;
    state.layout.bounds = bounds;
    state.layout.lastCalculated = Date.now();
  },

  SET_LAYOUT_OPTIONS(state, options) {
    state.layout.options = { ...state.layout.options, ...options };
  },

  SET_LAYOUT_MODE(state, mode) {
    state.layout.mode = mode;
  },

  SET_TREE_LAYOUT_OPTIONS(state, options) {
    state.layout.treeOptions = { ...state.layout.treeOptions, ...options };
  },

  // Viewport mutations
  SET_VIEWPORT_SCALE(state, scale) {
    state.viewport.scale = Math.max(0.1, Math.min(4, scale));
  },

  SET_VIEWPORT_TRANSLATE(state, { x, y }) {
    state.viewport.translateX = x;
    state.viewport.translateY = y;
  },

  SET_VIEWPORT_SIZE(state, { width, height }) {
    state.viewport.width = width;
    state.viewport.height = height;
  },

  // Selection mutations
  SELECT_MESSAGE(state, messageId) {
    if (!state.selection.selectedIds.includes(messageId)) {
      state.selection.selectedIds.push(messageId);
    }
    state.selection.lastSelectedId = messageId;
    state.ui.sidePanelOpen = true;

    console.debug('[GRAPH SIDE PANEL] open via SELECT_MESSAGE', {
      messageId,
      lastSelectedId: state.selection.lastSelectedId,
      sidePanelOpen: state.ui.sidePanelOpen,
      selectedIds: [...state.selection.selectedIds]
    });
  },

  DESELECT_MESSAGE(state, messageId) {
    const index = state.selection.selectedIds.indexOf(messageId);
    if (index > -1) {
      state.selection.selectedIds.splice(index, 1);
    }
    
    if (state.selection.lastSelectedId === messageId) {
      // Keep panel content stable even when multi-select toggling clears
      // the last selected node. The panel close should be explicit.
      state.selection.lastSelectedId = state.selection.selectedIds.length > 0
        ? state.selection.selectedIds[state.selection.selectedIds.length - 1]
        : messageId;

      console.debug('[GRAPH SIDE PANEL] deselect (keep panel stable)', {
        messageId,
        lastSelectedId: state.selection.lastSelectedId,
        sidePanelOpen: state.ui.sidePanelOpen,
        selectedIds: [...state.selection.selectedIds]
      });
    }
  },

  CLEAR_SELECTION(state) {
    state.selection.selectedIds = [];
    state.selection.lastSelectedId = null;
    state.ui.sidePanelOpen = false;

    console.debug('[GRAPH SIDE PANEL] closed via CLEAR_SELECTION', {
      lastSelectedId: state.selection.lastSelectedId,
      sidePanelOpen: state.ui.sidePanelOpen
    });
  },

  // Single-select replacement in one commit to avoid intermediate
  // empty-selection renders that make the side panel feel buggy.
  SET_SINGLE_SELECTION(state, messageId) {
    state.selection.selectedIds = [messageId];
    state.selection.lastSelectedId = messageId;
    state.ui.sidePanelOpen = true;

    console.debug('[GRAPH SIDE PANEL] open via SET_SINGLE_SELECTION', {
      messageId,
      lastSelectedId: state.selection.lastSelectedId,
      sidePanelOpen: state.ui.sidePanelOpen
    });
  },

  TOGGLE_SELECTION_MODE(state) {
    state.selection.selectionMode = !state.selection.selectionMode;
  },

  // UI mutations
  SET_SIDE_PANEL_OPEN(state, isOpen) {
    state.ui.sidePanelOpen = isOpen;
  },

  SET_MINIMAP_VISIBLE(state, isVisible) {
    state.ui.minimapVisible = isVisible;
  },

  SET_TOOLBAR_EXPANDED(state, isExpanded) {
    state.ui.toolbarExpanded = isExpanded;
  },

  UPDATE_LAYOUT_POSITIONS(state, { positions, bounds }) {
    state.layout.positions = positions;
    state.layout.bounds = bounds;
    state.layout.lastCalculated = Date.now();
  },

  TOGGLE_FILTERS(state) {
    state.ui.showingFilters = !state.ui.showingFilters;
  },

  // Filter mutations
  SET_FILTER(state, { key, value }) {
    state.filters[key] = value;
  },

  SET_SIDE_PANEL_OPEN(state, isOpen) {
    state.ui.sidePanelOpen = isOpen;
  },

  SET_STITCH_DRAWING_MODE(state, { isDrawing, sourceId = null }) {
    state.ui.isStitchDrawingMode = isDrawing;
    state.ui.stitchSourceId = sourceId;
  },

  ADD_STITCH_ADJACENCY(state, { sourceId, targetId }) {
    // Find messages in local state and update their stitch adjacency
    const sourceMsg = state.messages.find(m => m.id === sourceId);
    if (sourceMsg) {
      if (!sourceMsg.stitch_child_ids) sourceMsg.stitch_child_ids = [];
      if (!sourceMsg.stitch_child_ids.includes(targetId)) {
        sourceMsg.stitch_child_ids.push(targetId);
      }
    }

    const targetMsg = state.messages.find(m => m.id === targetId);
    if (targetMsg) {
      if (!targetMsg.stitch_parent_ids) targetMsg.stitch_parent_ids = [];
      if (!targetMsg.stitch_parent_ids.includes(sourceId)) {
        targetMsg.stitch_parent_ids.push(sourceId);
      }
    }

    // Recalculate edges to include the new stitch
    state.edges = calculateEdges(state.messages);
  },

  CLEAR_FILTERS(state) {
    state.filters = {
      showUnreadOnly: false,
      showPublicOnly: false,
      authorFilter: null,
      searchQuery: ''
    };
  },

  // Data mutations
  SET_CURRENT_MESSAGE_ID(state, messageId) {
    state.currentMessageId = messageId;
  },

  SET_MESSAGES(state, messages) {
    state.messages = messages;
    // Recalculate edges when messages change
    state.edges = calculateEdges(messages);
  },

  UPDATE_MESSAGE(state, updatedMessage) {
    const index = state.messages.findIndex(msg => msg.id === updatedMessage.id);
    if (index > -1) {
      state.messages.splice(index, 1, updatedMessage);
    }
  },

  ADD_MESSAGE(state, newMessage) {
    state.messages.push(newMessage);
    // Recalculate edges
    state.edges = calculateEdges(state.messages);
  },

  ADD_EXTRA_SEED_ID(state, messageId) {
    if (!state.extraSeedIds.includes(messageId)) {
      state.extraSeedIds.push(messageId);
    }
  },

  CLEAR_EXTRA_SEEDS(state) {
    state.extraSeedIds = [];
  }
};

const actions = {
  // Initialize graph view with message data
  async initializeGraph({ commit, dispatch }, { messageId, messages }) {
    commit('SET_CURRENT_MESSAGE_ID', messageId);
    commit('CLEAR_EXTRA_SEEDS');
    commit('SET_MESSAGES', messages);
    
    // Calculate initial layout
    await dispatch('calculateLayout');
    
    // Fit view to content
    dispatch('fitToContent');
  },

  // Update messages and update layout without disturbing existing trees.
  // Rule of thumb:
  // - Keep `anchorId` node at its previous coordinates.
  // - Preserve coordinates for `lockedNodeIds` (typically nodes in other reply trees).
  // - Recompute positions only for everything else.
  async updateGraphMessages({ commit, dispatch, state }, { messageId, messages, fitToContent = false, anchorId = null, rootPriorityMap = null, lockedNodeIds = null }) {
    const prevPositions = new Map(state.layout.positions);
    const prevAnchorPos = anchorId ? prevPositions.get(anchorId) : null;

    commit('SET_CURRENT_MESSAGE_ID', messageId);
    commit('SET_MESSAGES', messages);

    commit('SET_LAYOUT_CALCULATING', true);
    try {
      const positions = calculateTreeLayout(messages, {
        ...state.layout.treeOptions,
        rootPriorityMap
      });

      if (anchorId && prevAnchorPos && positions.has(anchorId)) {
        const computedAnchorPos = positions.get(anchorId);
        const dx = prevAnchorPos.x - computedAnchorPos.x;
        const dy = prevAnchorPos.y - computedAnchorPos.y;

        if (dx !== 0 || dy !== 0) {
          for (const [id, p] of positions.entries()) {
            positions.set(id, {
              ...p,
              x: p.x + dx,
              y: p.y + dy
            });
          }
        }
      }

      if (lockedNodeIds && lockedNodeIds.size > 0) {
        for (const id of lockedNodeIds) {
          if (!prevPositions.has(id)) continue;
          // Preserve full position object for stable rendering.
          positions.set(id, prevPositions.get(id));
        }
      }

      const bounds = calculateBounds(positions);
      commit('SET_LAYOUT_RESULT', { positions, bounds });
    } finally {
      commit('SET_LAYOUT_CALCULATING', false);
    }

    if (fitToContent) {
      dispatch('fitToContent');
    }
  },

  clearSelection({ commit }) {
    commit('CLEAR_SELECTION');
  },

  // Calculate layout for current messages
  async calculateLayout({ state, commit, getters }, { anchorId = null, rootPriorityMap = null } = {}) {
    commit('SET_LAYOUT_CALCULATING', true);
    
    try {
      const messages = getters.filteredMessages;
      // Use matplotlib-inspired tree layout

      // Preserve previous anchor coordinates so incremental loads don't shift whole trees.
      const prevAnchorPos = anchorId ? state.layout.positions.get(anchorId) : null;

      const positions = calculateTreeLayout(messages, {
        ...state.layout.treeOptions,
        rootPriorityMap
      });

      if (anchorId && prevAnchorPos && positions.has(anchorId)) {
        const nextAnchorPos = positions.get(anchorId);
        const dx = prevAnchorPos.x - nextAnchorPos.x;
        const dy = prevAnchorPos.y - nextAnchorPos.y;

        if (dx !== 0 || dy !== 0) {
          for (const [id, p] of positions.entries()) {
            positions.set(id, {
              ...p,
              x: p.x + dx,
              y: p.y + dy
            });
          }
        }
      }

      const bounds = calculateBounds(positions);
      
      commit('SET_LAYOUT_RESULT', { positions, bounds });
    } catch (error) {
      console.error('[GraphView] Layout calculation failed:', error);
    } finally {
      commit('SET_LAYOUT_CALCULATING', false);
    }
  },

  // Toggle layout mode between 'default' and 'tree'
  toggleLayoutMode({ state, commit, dispatch }) {
    const newMode = state.layout.mode === 'tree' ? 'default' : 'tree';
    commit('SET_LAYOUT_MODE', newMode);
    dispatch('calculateLayout');
    dispatch('fitToContent');
  },

  // Set layout mode directly
  setLayoutMode({ commit, dispatch }, mode) {
    commit('SET_LAYOUT_MODE', mode);
    dispatch('calculateLayout');
    dispatch('fitToContent');
  },

  // Handle message selection
  selectMessage({ commit, state }, { messageId, multiSelect = false }) {
    if (multiSelect || state.selection.selectionMode) {
      // Toggle selection in multi-select mode
      if (state.selection.selectedIds.includes(messageId)) {
        commit('DESELECT_MESSAGE', messageId);
      } else {
        commit('SELECT_MESSAGE', messageId);
      }
    } else {
      // Single selection - replace selection deterministically.
      commit('SET_SINGLE_SELECTION', messageId);
    }
  },

  // Viewport operations
  setViewportScale({ commit }, scale) {
    commit('SET_VIEWPORT_SCALE', scale);
  },

  setViewportTranslate({ commit }, { x, y }) {
    commit('SET_VIEWPORT_TRANSLATE', { x, y });
  },

  zoomToFit({ commit, state }) {
    if (!state.layout.bounds) return;

    const padding = 50;
    const bounds = state.layout.bounds;
    const viewport = state.viewport;

    const scaleX = (viewport.width - padding * 2) / bounds.width;
    const scaleY = (viewport.height - padding * 2) / bounds.height;
    const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 1:1

    const centerX = bounds.minX + bounds.width / 2;
    const centerY = bounds.minY + bounds.height / 2;
    
    const translateX = (viewport.width / 2) - (centerX * scale);
    const translateY = (viewport.height / 2) - (centerY * scale);

    commit('SET_VIEWPORT_SCALE', scale);
    commit('SET_VIEWPORT_TRANSLATE', { x: translateX, y: translateY });
  },

  fitToContent({ dispatch }) {
    dispatch('zoomToFit');
  },

  // Filter operations
  setFilter({ commit, dispatch }, { key, value }) {
    commit('SET_FILTER', { key, value });
    // Recalculate layout when filters change
    dispatch('calculateLayout');
  },

  clearAllFilters({ commit, dispatch }) {
    commit('CLEAR_FILTERS');
    dispatch('calculateLayout');
  }
  ,

  // Translate a reply-tree component by a graph-space delta.
  // Used to let users drag dotted reply-tree boundaries.
  dragReplyTree({ state, commit }, { nodeIds, dx, dy }) {
    if (!Array.isArray(nodeIds) || nodeIds.length === 0) return;

    const positions = new Map(state.layout.positions);
    nodeIds.forEach((id) => {
      const p = positions.get(id);
      if (!p) return;
      positions.set(id, {
        ...p,
        x: p.x + dx,
        y: p.y + dy
      });
    });

    const bounds = calculateBounds(positions);
    commit('UPDATE_LAYOUT_POSITIONS', { positions, bounds });
  },

  startStitchDrawing({ commit, state }) {
    // Clear selection so the panel closes and we start fresh for source selection.
    commit('CLEAR_SELECTION');
    commit('SET_STITCH_DRAWING_MODE', { isDrawing: true });
  },

  cancelStitchDrawing({ commit }) {
    commit('SET_STITCH_DRAWING_MODE', { isDrawing: false });
  },

  addStitchLink({ commit }, { sourceId, targetId }) {
    commit('ADD_STITCH_ADJACENCY', { sourceId, targetId });
    commit('SET_STITCH_DRAWING_MODE', { isDrawing: false });
  }
};

// Helper functions
function calculateEdges(messages) {
  const edges = [];
  
  messages.forEach(message => {
    if (message.parent_id) {
      edges.push({
        id: `reply-${message.parent_id}-${message.id}`,
        source: message.parent_id,
        target: message.id,
        edgeType: 'reply'
      });
    }

     // Stitch links: draw directed edges from message -> stitch_child
     const stitchChildren = Array.isArray(message.stitch_child_ids) ? message.stitch_child_ids : [];
     stitchChildren.forEach(childId => {
       if (!childId) return;
       edges.push({
         id: `stitch-${message.id}-${childId}`,
         source: message.id,
         target: childId,
         edgeType: 'stitch'
       });
     });
  });
  
  return edges;
}

function getCurrentUserId() {
  // Get current user ID from auth module or Firebase
  // This is a placeholder - implement based on your auth system
  return 'current-user-id';
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
}; 
