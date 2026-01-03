# Stitch Replies — Original Implementation Spec (ARCHIVED)

> **Note**: This design was superseded by a simplified approach that folds stitch into the existing links feature with `link_type=stitch`. See `_docs/launch/stitch.md` for the current design.

---

## Original Big Picture

Create a reply edge between two existing messages without creating a new message. Support both single-message stitches and subtree stitches (entire thread branches). Stitched detection: `replies.uid` present (stitcher uid); absent = author reply. All stitched edges require `uid` (stitcher) and `stitch_group_id` (UUID for operation grouping). Allow multiple parents per child. UI: Add "Stitch" next to "Reply" and "Prompt". On mobile, keep Stitch visible; move "Save" to overflow. Modal searches by content; user selects the CHILD (or root of subtree). Thread shows "<Display Name> stitched:" between parent and child. Message node has different background color.

## Original Backend Implementation

### 1. Database Schema

**MESSAGE_INSTANCES Collection** (New):
```
{
  _key: string,           // Auto-generated instance ID
  canonical_id: string,   // Reference to original message in MESSAGES
  instance_parent_id: string | null,  // Parent for this instance
  created_at: datetime,
  created_by_uid: string  // User who created this instance
}
```

**instance_replies Edge Collection** (New):
```
{
  _from: "MESSAGE_INSTANCES/{instance_id}",
  _to: "MESSAGE_INSTANCES/{instance_id}" | "MESSAGES/{message_id}",
  stitch_group_id: string,  // UUID grouping stitched operations
  is_subtree_stitch: boolean
}
```

### 2. DB Functions

Create `app/db/message_instances.py`:
- `create_instance(canonical_id, instance_parent_id, created_by_uid)` -> instance_id
- `create_instance_reply_edge(from_id, to_id, stitch_group_id, is_subtree)` -> edge
- `get_instances_for_message(canonical_id)` -> list of instances
- `get_instance_parent(instance_id)` -> parent instance or message
- `delete_instance(instance_id)` -> bool
- `stitch_subtree(parent_id, root_child_id, created_by_uid)` -> stitch_group_id, count

### 3. API Endpoints

**POST /api/v1/messages/replies** — Single-message stitch
```json
Request: { "parent_id": "msg123", "child_id": "msg456" }
Response: { "stitched": true, "stitch_group_id": "uuid-here" }
```

**POST /api/v1/messages/replies/subtree** — Subtree stitch
```json
Request: { "parent_id": "msg123", "root_child_id": "msg456" }
Response: { "stitched": true, "stitch_group_id": "uuid-here", "message_count": 5 }
```

**POST /api/v1/messages/search** — Search for stitch candidates
```json
Request: { "q": "search query", "limit": 20 }
Response: { "messages": [{ "id": "msg456", "content_preview": "...", "author": {...} }] }
```

### 4. Traversal Updates

- Update `traverse_messages()` to handle instance-aware traversal
- When traversing: check if current message has instances
- Return instance metadata with edges: `{ stitched_by_uid, stitched_by_display_name, stitch_group_id, is_subtree_stitch }`

### 5. Message Operations

- Scope updates (visibility, delete) to either canonical message OR specific instance
- Delete instance: removes instance and its edges, NOT the canonical message
- Update canonical: affects all instances

### 6. WebSocket Events

**reply.stitched** event:
```json
{
  "type": "reply.stitched",
  "parent_id": "msg123",
  "child_id": "msg456",
  "stitched_by": { "uid": "user789", "display_name": "John Doe" },
  "stitch_group_id": "uuid-here",
  "is_subtree": false
}
```

## Original Frontend Implementation

### 1. Service Layer

**Update `src/services/MessageService.js`**:
- `stitchReply({ parentId, childId })` - Single-message stitch
- `stitchSubtree({ parentId, rootChildId })` - Subtree stitch
- `searchMessages({ q, limit })` - Search for messages to stitch

### 2. Component Updates

**Add Stitch Button**: Add "Stitch" button next to "Reply" and "Prompt" in message actions

**Create `src/components/modals/StitchModal.vue`**:
- Debounced search input for finding messages
- Display search results (lightweight previews)
- User selects the CHILD (or root of subtree)
- Toggle between single-message stitch and subtree stitch
- Show confirmation before stitching

**Update Thread Rendering**:
- Show "<Display Name> stitched:" between parent and child when edge meta present
- Apply different background color to stitched message nodes

### 3. State Management

**Update `src/store/modules/messages.js`**:
- Handle stitch operations in store
- Update message relationships when stitch succeeds
- Store stitched meta on edges
- Handle `handleReplyStitched` action for WebSocket events

### 4. WebSocket Integration

- Listen for `reply.stitched` events
- Dispatch to store: `store.dispatch('messages/handleReplyStitched', data)`

## Original Implementation Checklist

1. Backend: Create MESSAGE_INSTANCES collection
2. Backend: Create instance_replies edge collection
3. Backend: Implement message_instances.py DB functions
4. Backend: Add POST /messages/replies endpoint
5. Backend: Add POST /messages/replies/subtree endpoint
6. Backend: Add POST /messages/search endpoint (stitch search)
7. Backend: Update traversal to be instance-aware
8. Backend: Add reply.stitched WebSocket event
9. Frontend: Add Stitch button in message actions
10. Frontend: Create StitchModal.vue component
11. Frontend: Implement MessageService stitch methods
12. Frontend: Update thread rendering for stitched edges
13. Frontend: Add WebSocket handler for reply.stitched
14. Tests: All stitch-related functionality
