import GraphLayoutService from '../../services/GraphLayoutService.js';
import { calculateTreeLayout, calculateBounds } from '../../utils/graph/layoutAlgorithms.js';

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
    showingFilters: false
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
  selectedMessageForPanel: (state) => {
    if (!state.selection.lastSelectedId) return null;
    return state.messages.find(msg => msg.id === state.selection.lastSelectedId);
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
        msg.content && msg.content.toLowerCase().includes(query)
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
  },

  DESELECT_MESSAGE(state, messageId) {
    const index = state.selection.selectedIds.indexOf(messageId);
    if (index > -1) {
      state.selection.selectedIds.splice(index, 1);
    }
    
    if (state.selection.lastSelectedId === messageId) {
      state.selection.lastSelectedId = state.selection.selectedIds.length > 0 
        ? state.selection.selectedIds[state.selection.selectedIds.length - 1]
        : null;
    }

    if (state.selection.selectedIds.length === 0) {
      state.ui.sidePanelOpen = false;
    }
  },

  CLEAR_SELECTION(state) {
    state.selection.selectedIds = [];
    state.selection.lastSelectedId = null;
    state.ui.sidePanelOpen = false;
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

  TOGGLE_FILTERS(state) {
    state.ui.showingFilters = !state.ui.showingFilters;
  },

  // Filter mutations
  SET_FILTER(state, { key, value }) {
    state.filters[key] = value;
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
  }
};

const actions = {
  // Initialize graph view with message data
  async initializeGraph({ commit, dispatch }, { messageId, messages }) {
    commit('SET_CURRENT_MESSAGE_ID', messageId);
    commit('SET_MESSAGES', messages);
    
    // Calculate initial layout
    await dispatch('calculateLayout');
    
    // Fit view to content
    dispatch('fitToContent');
  },

  // Calculate layout for current messages
  async calculateLayout({ state, commit, getters }) {
    commit('SET_LAYOUT_CALCULATING', true);
    
    try {
      const messages = getters.filteredMessages;
      // Use matplotlib-inspired tree layout
      const positions = calculateTreeLayout(messages, state.layout.treeOptions);
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
      // Single selection - clear others first
      commit('CLEAR_SELECTION');
      commit('SELECT_MESSAGE', messageId);
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
};

// Helper functions
function calculateEdges(messages) {
  const edges = [];
  
  messages.forEach(message => {
    if (message.parent_id) {
      edges.push({
        id: `${message.parent_id}-${message.id}`,
        source: message.parent_id,
        target: message.id
      });
    }
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