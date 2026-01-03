# Stitch Feature — Simplified Design (Link-Based)

---

## Summary

Stitch is now **folded into the existing links feature** as a link with `link_type=stitch`. This removes the need for separate `MESSAGE_INSTANCES` collections, new endpoints, or complex traversal logic.

### Key Differences from Original Plan
- **No new collections**: Uses existing `links` edge collection with a `link_type` field
- **No new endpoints**: Extends existing link create/delete endpoints
- **Simpler traversal**: Backend traversal already handles links via `up/down_depth` and `radius`

---

## Implementation Checklist

### Backend Changes (Minimal)

| Item | Status | Notes |
|------|--------|-------|
| Add `link_type` field to links | ❓ TBD | Check if already exists; add enum: `link` (default), `stitch` |
| Accept `link_type` param in `POST /links/messages/{from}/{to}` | ❓ TBD | Pass through to edge creation |
| Return `link_type` in link edge metadata | ❓ TBD | Include in traversal responses |
| **Verify**: Does `traverse-from` already include linked messages? | ❓ Needs Check | If yes, stitch "just works" for display |

### Frontend Changes

| Item | Status | Notes |
|------|--------|-------|
| 1. Update `createLink` to accept `linkType` | ⬜ Pending | `UserService.createLink(from, to, linkType)` |
| 2. Add "Stitch" button in message menu | ⬜ Pending | Opens existing LinksModal in stitch mode |
| 3. Show stitch indicator between messages | ⬜ Pending | Small visual marker when edge has `link_type=stitch` |
| 4. Order by stitch datetime (not message creation) | ⬜ Pending | For stitched messages, sort by link timestamp |
| 5. Parent selector for multi-parent messages | ⬜ Pending | Button in message menu to switch parent branch |
| 6. Update LinksModal for stitch mode | ⬜ Pending | Optional: differentiate stitch links in UI |

---

## Current Frontend Integration Points

### Services

**UserService.js** (link operations):
```javascript
createLink(messageIdFrom, messageIdTo)  // → needs linkType param
deleteLink(messageIdFrom, messageIdTo)
getUserIncomingLinks(messageId, skip, limit, showAllLinks)
getUserOutgoingLinks(messageId, skip, limit, showAllLinks)
```

**MessageService.js** (traversal):
```javascript
traverseFrom(messageId, { up_depth, down_depth, get_replies, get_children })
// Backend check needed: does this return linked messages?
```

### Components

**MessageNode.vue**:
- Already has `openLinksModal()` action in menu
- Add "Stitch" action (similar flow to Links)
- Add stitch indicator rendering in template

**LinksModal.vue**:
- Currently shows incoming/outgoing tabs
- Add mode for stitch-specific link creation
- Show `link_type` badge on link items

**ThreadView.vue**:
- Uses `getVisibleBranchMessages` getter
- May need adjustment for stitch-ordered messages
- Add parent selector UI when message has multiple incoming stitch links

### Store

**messages.js**:
```javascript
createLink({ messageIdFrom, messageIdTo })  // → extend with linkType
deleteLink({ messageIdFrom, messageIdTo, linkType, sourceMessageId })
```

---

## Questions for Backend

1. **Does `GET /messages/traverse-from/{id}` include linked messages in results?**
   - If yes: stitch display works automatically
   - If no: may need a flag like `include_links=true`

2. **Does the links edge collection have a `link_type` field?**
   - If not: add it with values `link` | `stitch`
   - Include in all link edge responses

3. **Does link creation timestamp exist?**
   - Needed for ordering stitched messages by stitch time
   - Field: `linked_at` or similar on the edge

4. **Can a message have multiple "parents" via stitch links?**
   - Yes by design — the parent selector UI handles this

---

## Frontend UI/UX Details

### Stitch Indicator
- Small visual marker between parent and stitched child
- Show stitcher's display name: "Stitched by @user"
- Subtle background color change or left border on stitched message

### Parent Selector
- Only shows when message has >1 incoming stitch link
- Menu option: "Switch Parent Branch" or similar
- Opens modal/dropdown to select which parent to follow

### Message Ordering
- Default: most recent reply at bottom (current behavior)
- Stitched messages: ordered by `linked_at` timestamp instead of `created_at`
- This ensures stitched content appears in conversation flow order

---

## Files to Modify

### Frontend
- `src/services/UserService.js` — add `linkType` param to `createLink`
- `src/store/modules/messages.js` — extend `createLink` action
- `src/components/MessageNode.vue` — add Stitch button, stitch indicator
- `src/components/modals/LinksModal.vue` — stitch mode support
- `src/views/app_views/ThreadView.vue` — parent selector, stitch ordering

### Backend (verify/extend)
- Link edge schema — add `link_type` field if missing
- Link create endpoint — accept `link_type` param
- Traversal endpoint — confirm linked messages included

---

## Migration

No data migration needed — existing links remain as `link_type=link` (or null treated as default).

---

## Later Enhancements

- Visual distinction for subtree stitches (entire branches)
- Stitch notifications (toast when someone stitches your message)
- Stitch analytics / visualization
- Bulk stitch operations
