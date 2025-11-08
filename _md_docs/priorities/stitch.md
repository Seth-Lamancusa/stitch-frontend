# Stitch Replies — Frontend Implementation

---

## Now

### Big Picture
Create a reply edge between two existing messages without creating a new message. Support both single-message stitches and subtree stitches (entire thread branches). UI: Add "Stitch" next to "Reply" and "Prompt". On mobile, keep Stitch visible; move "Save" to overflow. Modal searches by content; user selects the CHILD (or root of subtree). Thread shows "<Display Name> stitched:" between parent and child. Message node has different background color.

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
- Debounced search input for finding messages
- Display search results (lightweight previews)
- User selects the CHILD (or root of subtree)
- Toggle between single-message stitch and subtree stitch
- Show confirmation before stitching
- Handle loading states and errors
- Call `MessageService.stitchReply()` or `MessageService.stitchSubtree()`

**Update Thread Rendering**:
- Show "<Display Name> stitched:" between parent and child when edge meta present
- Use stitched meta from backend: `{ stitched_by_uid, stitched_by_display_name, stitch_group_id, is_subtree_stitch }`
- Apply different background color to stitched message nodes
- Visual indicator for subtree stitches (e.g., collapsible group, different styling)

### 3. State Management

**Update `src/store/modules/messages.js`**:
- Handle stitch operations in store
- Update message relationships when stitch succeeds
- Store stitched meta on edges
- Handle `handleReplyStitched` action for WebSocket events

### 4. WebSocket Integration

**Add WebSocket Handler**:
- Listen for `reply.stitched` events
- Payload: `{ parent_id, child_id, stitched_by: { uid, display_name }, stitch_group_id, is_subtree }`
- Dispatch to store: `store.dispatch('messages/handleReplyStitched', data)`
- Update visible thread if affected messages are displayed
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

1. Frontend: Add Stitch button to message actions
2. Frontend: Create `StitchModal.vue` with search and selection
3. Frontend: Implement `MessageService.stitchReply()` and `MessageService.stitchSubtree()`
4. Frontend: Update thread rendering to show stitched indicator
5. Frontend: Add WebSocket handler for `reply.stitched` events
6. Frontend: Handle visual distinction for stitched messages
7. Tests: Test stitch flow (single and subtree)
8. Tests: Test WebSocket event handling
9. Tests: Test thread rendering with stitched edges

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

