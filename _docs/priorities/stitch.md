# Stitch Replies — Frontend Implementation

---

## Now

### Big Picture
Create a reply edge between two existing messages without creating a new message. Support both single-message stitches and subtree stitches (entire thread branches). Stitched detection: `replies.uid` present (stitcher uid); absent = author reply. All stitched edges require `uid` (stitcher) and `stitch_group_id` (UUID for operation grouping). Allow multiple parents per child. UI: Add "Stitch" next to "Reply" and "Prompt". On mobile, keep Stitch visible; move "Save" to overflow. Modal searches by content; user selects the CHILD (or root of subtree). Thread shows "<Display Name> stitched:" between parent and child. Message node has different background color.

### Frontend Implementation

### 1. Service Layer

**Update `src/services/MessageService.js`**:
- `stitchReply({ parentId, childId })` - Single-message stitch
  - POST to `/api/v1/messages/replies`
  - Body: `{ parent_id, child_id }`
  - Returns: `{ stitched: true, stitch_group_id }`
- `stitchSubtree({ parentId, rootChildId })` - Subtree stitch
  - POST to `/api/v1/messages/replies/subtree`
  - Body: `{ parent_id, root_child_id }`
  - Returns: `{ stitched: true, stitch_group_id, message_count }`
- `searchMessages({ q, limit })` - Search for messages to stitch
  - POST to `/api/v1/messages/search`
  - Returns lightweight previews for child selection

### 2. Component Updates

**Add Stitch Button**:
- Add "Stitch" button next to "Reply" and "Prompt" in message actions
- On mobile: keep Stitch visible; move "Save" to overflow menu
- Open `StitchModal` on click

**Create `src/components/modals/StitchModal.vue`**:
- Debounced search input for finding messages (calls `MessageService.searchMessages()`)
- Display search results (lightweight previews, visibility-aware)
- User selects the CHILD (or root of subtree)
- Toggle between single-message stitch and subtree stitch
- Show confirmation before stitching
- Handle loading states and errors
- Call `MessageService.stitchReply({ parentId, childId })` or `MessageService.stitchSubtree({ parentId, rootChildId })`

**Update Thread Rendering**:
- Show "<Display Name> stitched:" between parent and child when edge meta present
- Use stitched meta from backend: `{ stitched_by_uid, stitched_by_display_name, stitch_group_id, is_subtree_stitch }`
- Apply different background color to stitched message nodes
- Visual indicator for subtree stitches (e.g., collapsible group, different styling)

### 3. State Management

**Update `src/store/modules/messages.js`**:
- Handle stitch operations in store
- Update message relationships when stitch succeeds
- Store stitched meta on edges: `{ stitched_by_uid, stitched_by_display_name, stitch_group_id, is_subtree_stitch }`
- Handle `handleReplyStitched` action for WebSocket events
- For subtree stitches: update all affected message relationships

### 4. WebSocket Integration

**Add WebSocket Handler** (Consumer - frontend):
- Listen for `reply.stitched` events
- Payload: `{ parent_id, child_id, stitched_by: { uid, display_name }, stitch_group_id, is_subtree }`
- Dispatch to store: `store.dispatch('messages/handleReplyStitched', data)`
- Store attaches stitched meta to `{ parentId, childId }` and refreshes visible thread if needed
- For subtree stitches: update all affected message relationships

### 5. UI/UX Considerations

- Show loading state during stitch operation
- Display success/error messages
- Update thread view immediately after stitch
- Handle edge cases (message not found, permission denied)
- Visual feedback for stitched messages
- Distinguish between single and subtree stitches visually

## Backend API Contract

### POST /api/v1/messages/replies
Single-message stitch.

**Request:**
```json
{
  "parent_id": "msg123",
  "child_id": "msg456"
}
```

**Response:**
```json
{
  "stitched": true,
  "stitch_group_id": "uuid-here"
}
```

### POST /api/v1/messages/replies/subtree
Subtree stitch.

**Request:**
```json
{
  "parent_id": "msg123",
  "root_child_id": "msg456"
}
```

**Response:**
```json
{
  "stitched": true,
  "stitch_group_id": "uuid-here",
  "message_count": 5
}
```

### POST /api/v1/messages/search
Search for messages to stitch.

**Request:**
```json
{
  "q": "search query",
  "limit": 20
}
```

**Response:**
```json
{
  "messages": [
    {
      "id": "msg456",
      "content_preview": "...",
      "author": { "uid": "...", "display_name": "..." }
    }
  ]
}
```

### Message Traversal Response
Includes stitched meta when present:
```json
{
  "edges": [
    {
      "from": "msg123",
      "to": "msg456",
      "stitched_by_uid": "user789",
      "stitched_by_display_name": "John Doe",
      "stitch_group_id": "uuid-here",
      "is_subtree_stitch": false
    }
  ]
}
```

## Files to Create/Modify

### Frontend Files
- `src/services/MessageService.js` - Add stitch methods
- `src/components/modals/StitchModal.vue` - New stitch modal component
- `src/components/MessageNode.vue` - Add stitch button, render stitched indicator
- `src/components/ThreadView.vue` - Show "stitched:" label between nodes
- `src/store/modules/messages.js` - Handle stitch operations and WS events
- WebSocket handler - Listen for `reply.stitched` events

## Implementation Checklist

1. Frontend: Add Stitch button next to "Reply" and "Prompt" in message actions (mobile: keep visible, move "Save" to overflow)
2. Frontend: Create `StitchModal.vue` with debounced search and selection (support single/subtree toggle)
3. Frontend: Implement `MessageService.stitchReply({ parentId, childId })` and `MessageService.stitchSubtree({ parentId, rootChildId })`
4. Frontend: Implement `MessageService.searchMessages({ q, limit })` for modal search
5. Frontend: Update thread rendering to show "<Display Name> stitched:" between nodes when edge meta present
6. Frontend: Apply different background color to stitched message nodes
7. Frontend: Visual indicator for subtree stitches (e.g., collapsible group, different background)
8. Frontend: Add WebSocket handler for `reply.stitched` events → `store.dispatch('messages/handleReplyStitched', data)`
9. Frontend: Handle visual distinction for stitched messages
10. Tests: Test stitch flow (single and subtree)
11. Tests: Test WebSocket event handling
12. Tests: Test thread rendering with stitched edges

---

## Later

### User-Facing Notifications (Phase 2)
- Toast notifications when stitch affects user's messages
  - Show when current user authored or is recipient of either message
  - Skip if both parent and child already visible and updated inline
  - Payload: `{ title: "<Display Name> stitched a reply", messageId: child_id, parentId: parent_id }`
  - Delivered via `ui/setMessageNotification`
  - WS-only (no email/SMS for stitch events)

### Frontend Enhancements
- Bulk stitch operations UI
- Stitch wizard for complex thread reorganization
- Undo stitch group functionality
- Stitch analytics visualization

