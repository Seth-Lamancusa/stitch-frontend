import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useStore } from 'vuex';

/**
 * Composable for enhanced graph interaction handling
 * Provides keyboard navigation, search highlighting, and accessibility features
 */
export function useGraphInteraction() {
  const store = useStore();
  
  // Reactive state
  const hoveredNodeId = ref(null);
  const focusedNodeId = ref(null);
  const searchResults = ref([]);
  const searchHighlights = ref(new Set());
  const isKeyboardNavigating = ref(false);
  const lastInteractionType = ref('mouse'); // 'mouse' | 'keyboard'
  
  // Keyboard navigation state
  const navigationHistory = ref([]);
  const currentNavigationIndex = ref(-1);
  
  // Search state
  const searchQuery = ref('');
  const searchOptions = ref({
    caseSensitive: false,
    wholeWords: false,
    includeAuthors: true,
    includeContent: true
  });
  
  // Computed properties
  const currentMessages = computed(() => store.getters['graphView/filteredMessages']);
  const selectedMessageIds = computed(() => store.state.graphView.selection.selectedIds);
  const nodePositions = computed(() => store.state.graphView.layout.positions);
  
  // Get currently focused/hovered message
  const currentMessage = computed(() => {
    const targetId = focusedNodeId.value || hoveredNodeId.value;
    return currentMessages.value.find(m => m.id === targetId);
  });
  
  // Calculate navigable nodes (sorted by position for logical navigation)
  const navigableNodes = computed(() => {
    return [...currentMessages.value]
      .sort((a, b) => {
        const posA = nodePositions.value.get(a.id);
        const posB = nodePositions.value.get(b.id);
        if (!posA || !posB) return 0;
        
        // Sort by layer first (Y position), then by X position
        if (Math.abs(posA.y - posB.y) > 50) {
          return posA.y - posB.y;
        }
        return posA.x - posB.x;
      })
      .map(m => m.id);
  });
  
  // Find current node index for navigation
  const currentNodeIndex = computed(() => {
    if (!focusedNodeId.value) return -1;
    return navigableNodes.value.indexOf(focusedNodeId.value);
  });
  
  /**
   * Keyboard Navigation Functions
   */
  
  // Navigate to next/previous node
  function navigateNext() {
    if (navigableNodes.value.length === 0) return;
    
    const currentIndex = currentNodeIndex.value;
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < navigableNodes.value.length) {
      focusNode(navigableNodes.value[nextIndex]);
    } else {
      // Wrap to first
      focusNode(navigableNodes.value[0]);
    }
  }
  
  function navigatePrevious() {
    if (navigableNodes.value.length === 0) return;
    
    const currentIndex = currentNodeIndex.value;
    const prevIndex = currentIndex - 1;
    
    if (prevIndex >= 0) {
      focusNode(navigableNodes.value[prevIndex]);
    } else {
      // Wrap to last
      focusNode(navigableNodes.value[navigableNodes.value.length - 1]);
    }
  }
  
  // Navigate by conversation flow (parent/child relationships)
  function navigateToParent() {
    if (!currentMessage.value?.parent_id) return;
    
    const parentExists = currentMessages.value.find(m => m.id === currentMessage.value.parent_id);
    if (parentExists) {
      focusNode(currentMessage.value.parent_id);
    }
  }
  
  function navigateToFirstChild() {
    if (!currentMessage.value) return;
    
    const children = currentMessages.value
      .filter(m => m.parent_id === currentMessage.value.id)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    if (children.length > 0) {
      focusNode(children[0].id);
    }
  }
  
  function navigateToNextSibling() {
    if (!currentMessage.value?.parent_id) return;
    
    const siblings = currentMessages.value
      .filter(m => m.parent_id === currentMessage.value.parent_id)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    const currentIndex = siblings.findIndex(m => m.id === currentMessage.value.id);
    if (currentIndex >= 0 && currentIndex < siblings.length - 1) {
      focusNode(siblings[currentIndex + 1].id);
    }
  }
  
  function navigateToPreviousSibling() {
    if (!currentMessage.value?.parent_id) return;
    
    const siblings = currentMessages.value
      .filter(m => m.parent_id === currentMessage.value.parent_id)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    const currentIndex = siblings.findIndex(m => m.id === currentMessage.value.id);
    if (currentIndex > 0) {
      focusNode(siblings[currentIndex - 1].id);
    }
  }
  
  // Focus management
  function focusNode(nodeId) {
    if (!nodeId) return;
    
    lastInteractionType.value = 'keyboard';
    isKeyboardNavigating.value = true;
    
    // Update focus
    focusedNodeId.value = nodeId;
    
    // Add to navigation history
    if (navigationHistory.value[navigationHistory.value.length - 1] !== nodeId) {
      navigationHistory.value.push(nodeId);
      currentNavigationIndex.value = navigationHistory.value.length - 1;
      
      // Limit history size
      if (navigationHistory.value.length > 50) {
        navigationHistory.value.shift();
        currentNavigationIndex.value--;
      }
    }
    
    // Announce for screen readers
    announceNodeFocus(nodeId);
    
    // Ensure node is visible in viewport
    ensureNodeVisible(nodeId);
  }
  
  function clearFocus() {
    focusedNodeId.value = null;
    isKeyboardNavigating.value = false;
  }
  
  /**
   * Search Functions
   */
  
  function performSearch(query = searchQuery.value) {
    if (!query.trim()) {
      clearSearch();
      return;
    }
    
    const options = searchOptions.value;
    const results = [];
    const highlights = new Set();
    
    const searchTerm = options.caseSensitive ? query : query.toLowerCase();
    
    currentMessages.value.forEach(message => {
      const matches = [];
      
      // Search in content
      if (options.includeContent && message.content) {
        const content = options.caseSensitive ? message.content : message.content.toLowerCase();
        
        if (options.wholeWords) {
          const regex = new RegExp(`\\b${escapeRegExp(searchTerm)}\\b`, options.caseSensitive ? 'g' : 'gi');
          const wordMatches = content.match(regex);
          if (wordMatches) {
            matches.push({ type: 'content', count: wordMatches.length });
          }
        } else {
          const index = content.indexOf(searchTerm);
          if (index !== -1) {
            const count = (content.match(new RegExp(escapeRegExp(searchTerm), 'g')) || []).length;
            matches.push({ type: 'content', count });
          }
        }
      }
      
      // Search in author name
      if (options.includeAuthors && message.author) {
        const authorName = message.author.display_name || message.author.username || '';
        const searchableAuthor = options.caseSensitive ? authorName : authorName.toLowerCase();
        
        if (searchableAuthor.includes(searchTerm)) {
          matches.push({ type: 'author', count: 1 });
        }
      }
      
      if (matches.length > 0) {
        results.push({
          messageId: message.id,
          message,
          matches,
          totalMatches: matches.reduce((sum, match) => sum + match.count, 0)
        });
        highlights.add(message.id);
      }
    });
    
    // Sort by relevance (total matches, then by timestamp)
    results.sort((a, b) => {
      if (a.totalMatches !== b.totalMatches) {
        return b.totalMatches - a.totalMatches;
      }
      return new Date(b.message.timestamp) - new Date(a.message.timestamp);
    });
    
    searchResults.value = results;
    searchHighlights.value = highlights;
    
    // Focus first result if available
    if (results.length > 0) {
      focusNode(results[0].messageId);
    }
    
    return results;
  }
  
  function clearSearch() {
    searchQuery.value = '';
    searchResults.value = [];
    searchHighlights.value.clear();
  }
  
  function navigateToNextSearchResult() {
    if (searchResults.value.length === 0) return;
    
    const currentIndex = searchResults.value.findIndex(r => r.messageId === focusedNodeId.value);
    const nextIndex = (currentIndex + 1) % searchResults.value.length;
    focusNode(searchResults.value[nextIndex].messageId);
  }
  
  function navigateToPreviousSearchResult() {
    if (searchResults.value.length === 0) return;
    
    const currentIndex = searchResults.value.findIndex(r => r.messageId === focusedNodeId.value);
    const prevIndex = currentIndex <= 0 ? searchResults.value.length - 1 : currentIndex - 1;
    focusNode(searchResults.value[prevIndex].messageId);
  }
  
  /**
   * Selection Functions
   */
  
  function selectFocusedNode() {
    if (!focusedNodeId.value) return;
    
    store.dispatch('graphView/selectMessage', {
      messageId: focusedNodeId.value,
      multiSelect: false
    });
  }
  
  function toggleFocusedNodeSelection() {
    if (!focusedNodeId.value) return;
    
    const isSelected = selectedMessageIds.value.includes(focusedNodeId.value);
    
    if (isSelected) {
      store.commit('graphView/DESELECT_MESSAGE', focusedNodeId.value);
    } else {
      store.commit('graphView/SELECT_MESSAGE', focusedNodeId.value);
    }
  }
  
  function selectAll() {
    currentMessages.value.forEach(message => {
      if (!selectedMessageIds.value.includes(message.id)) {
        store.commit('graphView/SELECT_MESSAGE', message.id);
      }
    });
  }
  
  function clearSelection() {
    store.commit('graphView/CLEAR_SELECTION');
  }
  
  /**
   * Accessibility Functions
   */
  
  function announceNodeFocus(nodeId) {
    const message = currentMessages.value.find(m => m.id === nodeId);
    if (!message) return;
    
    const author = message.author?.display_name || message.author?.username || 'Unknown';
    const visibility = message.public ? 'public' : 'private';
    const preview = message.content ? message.content.substring(0, 100) + '...' : 'No content';
    
    const announcement = `Focused on ${visibility} message from ${author}. ${preview}`;
    announceToScreenReader(announcement);
  }
  
  function announceToScreenReader(message) {
    // Create a temporary element for screen reader announcements
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';
    
    document.body.appendChild(announcement);
    announcement.textContent = message;
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }
  
  function ensureNodeVisible(nodeId) {
    // Get node position
    const position = nodePositions.value.get(nodeId);
    if (!position) return;
    
    // Center viewport on node
    store.dispatch('graphView/setViewportTranslate', {
      x: (store.state.graphView.viewport.width / 2) - (position.x * store.state.graphView.viewport.scale),
      y: (store.state.graphView.viewport.height / 2) - (position.y * store.state.graphView.viewport.scale)
    });
  }
  
  /**
   * Event Handlers
   */
  
  function handleKeyDown(event) {
    lastInteractionType.value = 'keyboard';
    
    // Don't handle if user is typing in an input
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return;
    }
    
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        navigateNext();
        break;
        
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        navigatePrevious();
        break;
        
      case 'Enter':
      case ' ':
        event.preventDefault();
        selectFocusedNode();
        break;
        
      case 'Tab':
        if (event.shiftKey) {
          event.preventDefault();
          navigatePrevious();
        } else {
          event.preventDefault();
          navigateNext();
        }
        break;
        
      case 'Home':
        event.preventDefault();
        if (navigableNodes.value.length > 0) {
          focusNode(navigableNodes.value[0]);
        }
        break;
        
      case 'End':
        event.preventDefault();
        if (navigableNodes.value.length > 0) {
          focusNode(navigableNodes.value[navigableNodes.value.length - 1]);
        }
        break;
        
      case 'Escape':
        event.preventDefault();
        clearFocus();
        clearSelection();
        break;
        
      case 'a':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          selectAll();
        }
        break;
        
      case 'f':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          // Trigger search focus
          const searchInput = document.querySelector('.search-input');
          if (searchInput) {
            searchInput.focus();
          }
        }
        break;
        
      // Navigation by relationship
      case 'w': // Parent (up in tree)
        event.preventDefault();
        navigateToParent();
        break;
        
      case 's': // First child (down in tree)
        event.preventDefault();
        navigateToFirstChild();
        break;
        
      case 'a': // Previous sibling
        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          navigateToPreviousSibling();
        }
        break;
        
      case 'd': // Next sibling
        event.preventDefault();
        navigateToNextSibling();
        break;
        
      // Search navigation
      case 'F3':
      case 'n':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          navigateToNextSearchResult();
        }
        break;
        
      case 'N':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          navigateToPreviousSearchResult();
        }
        break;
    }
  }
  
  function handleMouseEnter(nodeId) {
    if (lastInteractionType.value === 'mouse') {
      hoveredNodeId.value = nodeId;
    }
  }
  
  function handleMouseLeave() {
    hoveredNodeId.value = null;
  }
  
  function handleMouseMove() {
    lastInteractionType.value = 'mouse';
    isKeyboardNavigating.value = false;
  }
  
  /**
   * Utility Functions
   */
  
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * Lifecycle
   */
  
  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousemove', handleMouseMove);
  });
  
  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('mousemove', handleMouseMove);
  });
  
  // Return public interface
  return {
    // State
    hoveredNodeId,
    focusedNodeId,
    searchResults,
    searchHighlights,
    isKeyboardNavigating,
    searchQuery,
    searchOptions,
    currentMessage,
    
    // Navigation
    navigateNext,
    navigatePrevious,
    navigateToParent,
    navigateToFirstChild,
    navigateToNextSibling,
    navigateToPreviousSibling,
    focusNode,
    clearFocus,
    
    // Search
    performSearch,
    clearSearch,
    navigateToNextSearchResult,
    navigateToPreviousSearchResult,
    
    // Selection
    selectFocusedNode,
    toggleFocusedNodeSelection,
    selectAll,
    clearSelection,
    
    // Events
    handleMouseEnter,
    handleMouseLeave,
    
    // Accessibility
    announceToScreenReader,
    ensureNodeVisible
  };
} 