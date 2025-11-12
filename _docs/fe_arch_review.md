## File/Folder/Function Architecture Review

Goal: review the codebase architecture on the level of file, folder, and function organization.
Questions: 
* Any excessively large files (e.g. message node, messages service on frontend)
* Any files that could be combined?
* Healthy separation of concerns?
* Best practices?

Scope: separate review for `frontend`, `backend`, and `bots`.

---

## MessageNode.vue Decomposition Plan

**Current State:** 2659 lines - excessively large monolithic component

### Phase 1: Extract UI Subcomponents

**1. MessageHeader.vue** (~200 lines)
- Author section with display name, user tag
- Unread thread badge
- Envelope icon (read/unread status)
- Recipients badge
- Tags badge
- Visibility indicator (globe emoji)
- Delete button
- Timestamp display
- Selection checkbox
- Props: `message`, `isUserRecipient`, `currentUser`, `canDelete`, `selectable`, `selected`, `inListView`
- Events: `toggleReadStatus`, `openRecipients`, `openTags`, `toggleVisibility`, `delete`, `selectionToggled`

**2. MessageActions.vue** (~300 lines)
- Desktop action buttons (visible actions)
- Desktop menu container with dropdown
- Mobile action buttons (visible actions)
- Mobile menu button
- Floating action bar (mobile)
- All action button logic and configuration
- Props: `message`, `isSelectionMode`, `inListView`, `isAdmin`, `isMobile`, `currentUser`
- Events: `reply`, `prompt`, `center`, `showLinks`, etc.

**3. MessageFooter.vue** (~100 lines)
- Reply count display
- Desktop actions layout
- SiblingNavigator integration
- Props: `message`, `isSelectionMode`, `inListView`, `actions`
- Events: forward action events from MessageActions

### Phase 2: Extract Composables

**1. useMessageActions.js** (~250 lines)
- Action definitions array (messageActions computed)
- Desktop/mobile/menu action filtering
- Action handlers:
  - `openPromptModal`
  - `openLinksModal`
  - `openAddRecipientsModal`
  - `copyMessageJson`
  - `copyMessageText`
  - `copyMessageLink`
  - `toggleSaveMessage`
- Action state (isJsonCopied, isTextCopied, isLinkCopied, isMessageSaved, isSavingMessage)
- Returns: all action methods and state

**2. useMessageState.js** (~150 lines)
- Selection mode logic
- Read/unread status management
- Visibility toggle logic
- Save state initialization
- Props: `message`, `store`
- Returns: state flags and toggle methods

**3. useMessageDisplay.js** (~100 lines)
- Author display logic
- Participants display logic
- Recipients deduplication
- Truncated content computation
- Markdown stripping utility
- Props: `message`, `displayMode`, `currentTab`, `inListView`
- Returns: display computed properties

**4. useMobileActionBar.js** (~100 lines)
- Action bar open/close state
- Touch event handlers (swipe to dismiss)
- Outside click handler
- Viewport change detection (keyboard detection)
- Props: `messageId`, `store`
- Returns: action bar methods and state

**5. useMessageNavigation.js** (~80 lines)
- Sibling navigation logic
- Parent/child relationship checks
- Navigation event handlers
- Loading states for navigation
- Props: `message`, `store`
- Returns: navigation methods and computed properties

**6. useDeviceDetection.js** (~50 lines) - Reusable across app
- Mobile device detection
- Responsive breakpoint checks
- Viewport monitoring
- Returns: `isMobile`, `checkMobileDevice`

### Phase 3: Extract Utility Functions

**1. utils/messageFormatters.js**
- `stripMarkdown(text)` - Remove markdown formatting
- `formatTimestamp(timestamp)` - Date formatting
- `deduplicateRecipients(recipientEdges)` - Recipient deduplication logic
- `buildParticipantsDisplay(message, recipients)` - Participants label logic

**2. utils/messagePermissions.js**
- `canToggleVisibility(message, user, isAdmin, context)` - Check visibility permissions
- `canDeleteMessage(message, user, isAdmin)` - Check delete permissions
- `isUserAuthorOfContent(message, recipient)` - Author check logic
- `isCurrentUserRecipient(message, currentUser)` - Recipient check logic

**3. utils/messageClipboard.js**
- Clipboard copy operations with error handling
- Flash effect state management
- Link generation logic

### Phase 4: Reorganize Component Structure

**New MessageNode.vue** (~300 lines)
```vue
<template>
  <div class="message-node" :class="computedClasses">
    <div class="message-content" ref="messageContentRef" @click="handleMessageClick">
      <MessageHeader
        :message="message"
        :is-user-recipient="isUserRecipient"
        :is-current-user="isCurrentUser"
        :can-delete="canDeleteMessage(message)"
        :can-toggle-visibility="canToggleVisibility"
        :is-unread="isMessageUnread"
        :selectable="selectable"
        :selected="inListView ? selected : isMessageSelected"
        :in-list-view="inListView"
        @toggle-read="toggleReadStatus"
        @open-recipients="openAddRecipientsModal"
        @open-tags="openTagsModal"
        @toggle-visibility="toggleVisibility"
        @delete="$emit('delete', message)"
        @selection-toggled="handleSelectionToggle"
      />
      
      <div class="message-body">
        <FormattedContent v-if="displayMode === 'full'" :content="message.content" />
        <div v-else class="plaintext-content">{{ truncatedContent }}</div>
      </div>
      
      <MessageFooter
        v-if="!inListView"
        :message="message"
        :actions="messageActions"
        :is-selection-mode="isSelectionMode"
        :is-mobile="isMobile"
        :show-action-bar="showActionBar"
        @reply="$emit('reply', message.id)"
        @prompt="openPromptModal"
        @center="$emit('center', message.id)"
        @show-links="openLinksModal"
      />
      
      <SiblingNavigator
        v-if="showSiblingNavDesktop"
        :message-id="message.id"
        :parent-id="message.parent_id"
        :mobile-mode="false"
        @navigate="handleSiblingNavigation"
      />
    </div>
    
    <TagsModal
      :is-visible="showTagsModal"
      :is-add-mode="true"
      :existing-tags="existingTags"
      @close="closeTagsModal"
      @done="handleTagsDone"
    />
  </div>
</template>

<script>
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import MessageHeader from './MessageNode/MessageHeader.vue';
import MessageFooter from './MessageNode/MessageFooter.vue';
import FormattedContent from './FormattedContent/index.vue';
import SiblingNavigator from './SiblingNavigator.vue';
import TagsModal from './modals/TagsModal.vue';

// Composables
import { useMessageActions } from '@/composables/useMessageActions';
import { useMessageState } from '@/composables/useMessageState';
import { useMessageDisplay } from '@/composables/useMessageDisplay';
import { useMobileActionBar } from '@/composables/useMobileActionBar';
import { useMessageNavigation } from '@/composables/useMessageNavigation';
import { useDeviceDetection } from '@/composables/useDeviceDetection';

export default {
  name: 'MessageNode',
  components: { MessageHeader, MessageFooter, FormattedContent, SiblingNavigator, TagsModal },
  props: { /* ... */ },
  setup(props, { emit }) {
    const store = useStore();
    
    // Composables
    const { isMobile } = useDeviceDetection();
    const { /* ... */ } = useMessageState(props.message, store);
    const { /* ... */ } = useMessageDisplay(props, store);
    const { /* ... */ } = useMessageActions(props.message, store, emit);
    const { /* ... */ } = useMobileActionBar(props.message.id, store);
    const { /* ... */ } = useMessageNavigation(props.message, store);
    
    return { /* ... */ };
  }
};
</script>

<style scoped src="./MessageNode/styles.css"></style>
```

### Phase 5: Extract Styles

**1. MessageNode/styles.css** - Base styles
**2. MessageNode/header-styles.css** - Header-specific styles
**3. MessageNode/footer-styles.css** - Footer and actions styles
**4. MessageNode/mobile-styles.css** - Mobile responsive styles

### Benefits of Decomposition

1. **Maintainability**: Each file has clear, focused responsibility
2. **Testability**: Composables and utilities can be unit tested independently
3. **Reusability**: Composables can be used in other message-related components
4. **Readability**: Reduced cognitive load, easier to navigate
5. **Performance**: Potential for better code splitting
6. **Collaboration**: Multiple developers can work on different sections without conflicts

### Migration Strategy

1. Start with utility functions (Phase 3) - lowest risk
2. Extract composables (Phase 2) - reuse logic without changing UI
3. Create subcomponents (Phase 1) - visible changes, test thoroughly
4. Reorganize main component (Phase 4) - final integration
5. Optimize styles (Phase 5) - polish

### Testing Checkpoints

- [ ] Message display in thread view
- [ ] Message display in list view (inbox)
- [ ] Selection mode functionality
- [ ] Read/unread status toggling
- [ ] All action buttons (reply, prompt, save, copy, etc.)
- [ ] Mobile floating action bar
- [ ] Sibling navigation
- [ ] Recipients modal integration
- [ ] Tags modal integration
- [ ] Visibility toggling
- [ ] Desktop vs mobile responsive behavior
- [ ] Compact mode styling

---

## messages.js Store Module Decomposition Plan

**Current State:** 1757 lines - excessively large monolithic Vuex store module

**Line Breakdown:**
- State: ~25 lines (fine)
- Mutations: ~311 lines (manageable)
- Actions: ~1145 lines (HUGE - needs splitting!)
- Getters: ~221 lines (manageable)

### Recommended Architecture: Split into Multiple Store Modules

Instead of one giant `messages.js` module, split into 5 focused modules under `store/modules/messages/`:

```
store/modules/messages/
├── index.js              (~100 lines) - Main module coordinator
├── state.js              (~50 lines)  - State definitions and helpers
├── mutations.js          (~350 lines) - All mutations
├── getters.js            (~250 lines) - All getters
└── actions/
    ├── loading.js        (~200 lines) - Fetch/load operations
    ├── crud.js           (~150 lines) - Create/update/delete
    ├── readStatus.js     (~250 lines) - Read/unread management
    ├── navigation.js     (~200 lines) - Branch/sibling navigation
    ├── links.js          (~100 lines) - Link operations
    ├── filters.js        (~80 lines)  - Filter management
    └── websocket.js      (~100 lines) - WebSocket handling
```

### Phase 1: Extract Action Modules

**1. actions/loading.js** (~200 lines)
```javascript
// Message loading and fetching operations
export default {
  loadTraversal          // Unified traversal loader
  loadMessageBranchUp    // Load parent branch
  loadMessageBranchDown  // Load child branch
  loadMessageRadius      // Load in radius
  refreshLoadedAncestors // Refresh ancestor chain
  fetchMessages          // Universal fetch router
  fetchUserMessages      // Chronological messages
  clearCache             // Clear message cache
}
```

**2. actions/crud.js** (~150 lines)
```javascript
// Message CRUD operations
export default {
  sendReply              // Create reply to message
  deleteMessage          // Delete message (with cascade)
  updateMessageTags      // Update message tags
  togglePublicMessage    // Toggle public/private
  pinMessage             // Pin message (admin)
  unpinMessage           // Unpin message (admin)
}
```

**3. actions/readStatus.js** (~250 lines)
```javascript
// Read status management
export default {
  markMessageAsRead        // Mark single message read
  markMessageAsUnread      // Mark single message unread
  batchMarkAsRead          // Batch mark (for thread view)
  markVisibleBranchAsRead  // Auto-mark visible branch
  fetchUnreadMessageCount  // Get unread count
  incrementUnreadCount     // Increment count (WS)
  toggleReadStatus         // Toggle read/unread
}
```

**4. actions/navigation.js** (~200 lines)
```javascript
// Branch navigation and path management
export default {
  prepareBranchPath      // Prepare branch for display
  setBranchChild         // Set selected child
  navigateToSibling      // Navigate prev/next sibling
}
```

**5. actions/links.js** (~100 lines)
```javascript
// Link operations between messages
export default {
  createLink    // Create message link
  deleteLink    // Delete message link
}
```

**6. actions/filters.js** (~80 lines)
```javascript
// Filter state management
export default {
  setFilters      // Set multiple filters
  setAuthors      // Set author filter
  setRecipients   // Set recipient filter
  setIsPublic     // Set public/private filter
  setDateRange    // Set date range filter
  setSortOrder    // Set sort order
}
```

**7. actions/websocket.js** (~100 lines)
```javascript
// WebSocket event handling
export default {
  handleIncomingWsMessage  // Process incoming WS message
  isTemporaryId            // Check if ID is temporary
}
```

### Phase 2: Create Module Index

**index.js** - Main coordinator (~100 lines)
```javascript
import state from './state'
import mutations from './mutations'
import getters from './getters'

// Import action modules
import loadingActions from './actions/loading'
import crudActions from './actions/crud'
import readStatusActions from './actions/readStatus'
import navigationActions from './actions/navigation'
import linksActions from './actions/links'
import filtersActions from './actions/filters'
import websocketActions from './actions/websocket'

export default {
  namespaced: true,
  state,
  mutations,
  getters,
  actions: {
    ...loadingActions,
    ...crudActions,
    ...readStatusActions,
    ...navigationActions,
    ...linksActions,
    ...filtersActions,
    ...websocketActions
  }
}
```

### Phase 3: Extract Helper Utilities

Create `store/modules/messages/utils/` for shared logic:

**1. utils/messageHelpers.js**
```javascript
// Pure helper functions used across actions
export function isDescendantOf(state, messageId, ancestorId)
export function isMessageUnread(message)
export function isMessageRead(message)
export function collectDescendants(state, messageId)
export function findMostRecentChild(state, childIds)
```

**2. utils/recipientHelpers.js**
```javascript
// Recipient processing and validation
export function processRecipients(recipients)
export function isUserRecipient(message, user)
export function deduplicateRecipients(recipients)
```

**3. utils/branchHelpers.js**
```javascript
// Branch path and navigation helpers
export function traceUpToRoot(state, messageId)
export function traceDownBranch(state, messageId)
export function validateBranchChild(message, childId)
```

### Phase 4: Shared State Helpers

**state.js** (~50 lines)
```javascript
// Centralized state definition with helper functions
export default {
  messages: {},
  filters: {
    authors: [],
    recipients: [],
    isPublic: 'all',
    dateRange: { start: null, end: null },
    sortOrder: 'newest'
  },
  unreadMessageCount: 0,
  loadingStates: {},
  threadViewMode: false,
  markingAsReadIds: []
}

// Module-level flags
export const initialUnreadCountFetched = { value: false }
```

### Benefits of Decomposition

1. **Maintainability**: Each action module has a single, clear responsibility
2. **Testability**: Individual action modules can be unit tested in isolation
3. **Discoverability**: Easier to find specific functionality by domain
4. **Cognitive Load**: Developers only need to load one concern at a time
5. **Code Review**: Smaller, focused PRs for changes to specific domains
6. **Parallel Development**: Multiple developers can work on different action modules
7. **Performance**: Potential for lazy-loading action modules if needed
8. **Documentation**: Easier to document with clear module boundaries

### Migration Strategy

**Phase 1: Preparation (No Breaking Changes)**
1. Create new directory structure: `store/modules/messages/`
2. Copy existing `messages.js` as `messages-legacy.js` backup
3. Create `state.js`, `mutations.js`, `getters.js` by extracting from original

**Phase 2: Extract Action Modules (One at a time)**
1. Start with **filters.js** (smallest, simplest)
2. Then **links.js** (isolated, few dependencies)
3. Then **websocket.js** (self-contained)
4. Then **crud.js** (medium complexity)
5. Then **loading.js** (medium complexity)
6. Then **navigation.js** (complex, dependencies)
7. Finally **readStatus.js** (most complex, many dependencies)

**Phase 3: Extract Utilities**
1. Create `utils/` folder
2. Move helper functions from top of file to utility modules
3. Update imports in action modules

**Phase 4: Create Index**
1. Create `index.js` that combines all modules
2. Update main store to import from new location
3. Test thoroughly - should be functionally identical

**Phase 5: Cleanup**
1. Remove `messages-legacy.js` backup
2. Update any imports throughout the app
3. Document new structure in README

### Testing Checkpoints

After each action module extraction:
- [ ] Existing functionality works identically
- [ ] No console errors
- [ ] WebSocket message handling still works
- [ ] Message loading (inbox, public, saved, history) works
- [ ] Message creation/reply works
- [ ] Message deletion (single and cascade) works
- [ ] Read/unread status toggling works
- [ ] Batch marking as read works (thread view)
- [ ] Sibling navigation works
- [ ] Branch path preparation works
- [ ] Link creation/deletion works
- [ ] Filter updates work
- [ ] Unread count updates correctly
- [ ] Pinning/unpinning works

### Additional Recommendations

**Consider Further Improvements:**

1. **TypeScript Migration**: With smaller modules, easier to add types incrementally
2. **Pinia Migration**: Modern alternative to Vuex with better TypeScript support and simpler API
3. **Service Layer**: Some action logic could move to service classes (e.g., `MessageNavigationService`)
4. **Computed State**: Consider moving some getters to composables for component-specific logic
5. **Action Composition**: Use action composition patterns to reduce duplication
6. **Error Handling**: Centralize error handling in a middleware or utility
7. **Loading States**: Consider a unified loading state management system
8. **Caching Strategy**: Implement a more sophisticated caching layer for message data

### Priority: High

The `messages.js` module is a critical bottleneck for:
- New developer onboarding (hard to understand)
- Bug fixing (hard to locate issues)
- Feature additions (risk of conflicts)
- Code review (too much context to load)

Recommend starting this decomposition soon, ideally in parallel with MessageNode.vue work.