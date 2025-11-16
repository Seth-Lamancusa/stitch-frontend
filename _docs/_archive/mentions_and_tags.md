# Inline Mentions (@) and Tags (#) — Draft/Render Pipeline

Goal: Allow optional inline `#tags` and `@mentions` in message content while keeping message content immutable. Lists (`tags`, `recipients`) are the source of truth; highlights derive from lists.

---

## Now

### Principles
- Content never changes due to tag/recipient adds/removals (draft and existing).
- Source of truth:
  - Draft: `replyTags` and draft `recipients` (navigation store).
  - Existing: `message.tags` and `message.recipients`.
- Highlight only those tokens that are present in the respective lists.

## Behaviors
- Tags (draft):
  - Typing: when a valid standalone `#tag` is committed (boundary reached), auto-stage into `replyTags` (normalize lowercase, dedupe).
  - Modal removal: removing a tag in `TagsModal` updates `replyTags` immediately. No content edits. Highlight disappears because it's no longer in the list.
  - Loop prevention: if a tag was just removed but still appears in text, suppress re-auto-stage until the user edits that token (transient `suppressedTags`).

- Mentions (draft):
  - Typing: `@` triggers autocomplete; stage only when a real user is selected. Plain `@text` never stages.
  - Modal/store removal: removing a recipient updates draft recipients. No content edits. Highlight disappears because the user left the list.

- Existing messages:
  - Removing tags/recipients via modals only updates lists; content remains unchanged.
  - Rendering highlights only tokens present in lists (resolved recipients via `user_tag`).

## Validation (parity across draft and render)
- Tags: `^[A-Za-z0-9-]{1,32}$`, lowercase (no underscores)
- Mentions: only highlight if resolved and in list; plain `@text` stays unhighlighted.

Suggested detection patterns (standalone/boundary-like, avoid emails/URLs):

```text
TAG TOKEN (match candidate):
/(^|[\s([{])#([A-Za-z0-9-]{1,32})(?![A-Za-z0-9-])/g

MENTION TOKEN (match candidate):
/(^|[\s([{])@([A-Za-z0-9_]{1,32})(?![A-Za-z0-9_])(?=[^\w@.]|$)/g
```

Notes:
- "Candidate" matches are filtered by presence in the list prior to highlight.
- For mentions in draft, candidates only propose autocomplete; staging happens on selection.

## Draft typing UX (Reply overlay)
- Single real `textarea` for editing.
- Non-interactive overlay `div` mirrors text with visual spans for valid tokens (from lists only). The `textarea` has transparent background.
- Sync height and scroll with existing auto-resize logic; overlay is aria-hidden.

## Modal interactions
- `TagsModal`:
  - Emits `change` live as tags are added/removed.
  - `ReplyBox` handles `@change` by diffing previous vs new `replyTags`, updating the list only (no text edits). If needed, update `suppressedTags` to prevent auto-restage of still-present tokens.
- `RecipientsModal`:
  - Updates staged recipients in store as the user adds/removes.
  - `ReplyBox` watches the recipients list and re-renders overlay; no text edits.

## Send pipeline
- Store action `messages/sendReply({ parentId, content, isPrivate, recipients, tags, content_author })`.
- Service `MessageService.sendReply(...)` includes `tags` in `messageData` (alongside `recipients`).
- Backend accepts `tags` per existing tags feature plan.

## Render pipeline
- New formatter plugin `mentions_hashtags` in `components/FormattedContent/plugins`:
  - Input: `content` string.
  - Options:
    - `validTags: Set<string>` (e.g., `message.tags`)
    - `validMentions: Set<string>` (e.g., `message.recipients[].user_tag`)
  - Replace only tokens that exist in the respective sets with styled spans/links; leave others as plain text.
- Registered in `components/FormattedContent/init.js` after base plugins.

## Edge cases
- Emails/URLs: regex guards avoid "@" inside emails and `#` in URLs.
- Code blocks: optional later—add a protect/restore pass if we need to skip highlighting inside fenced code. Current pipeline already supports protect/restore in formatter registry.
- Duplicates: dedupe tags list, maintain order of first occurrence.
- Limits: cap 20 tags; ignore beyond cap when auto-staging.
- Case: tags normalize to lowercase; mentions keep `user_tag` case conventions (typically lowercase).

## Accessibility & Mobile
- Overlay is aria-hidden; single focusable textarea.
- Autocomplete dropdown is keyboard navigable; positioned at caret (best-effort) or anchored near textarea on mobile.

## Implementation Table

| Area | File(s) | Action | Notes |
|---|---|---|---|
| Draft overlay | `src/components/ReplyBox.vue` | Add overlay div, transparent textarea, scroll/height sync | No content mutation; aria-hidden overlay |
| Tag auto-stage | `src/components/ReplyBox.vue` | On content change, collect valid tags and update `replyTags` | Maintain `suppressedTags` to prevent loop after removal |
| Mention autocomplete | `src/components/ReplyBox.vue` | Detect `@partial` at caret; show dropdown; stage on select | Reuse `auth/searchUsers`; no auto-stage on plain typing |
| Tags modal live sync | `src/components/ReplyBox.vue` + `TagsModal.vue` | Handle `@change(newTags)` to update `replyTags` | No text edits; update suppression map if needed |
| Recipients live sync | `RecipientsModal.vue` + store | Store updates recipients; `ReplyBox` reacts | No text edits |
| Send payload | `src/store/modules/messages.js` | Pass `tags` to service in `sendReply` | Add `tags` param |
| API call | `src/services/MessageService.js` | Include `tags` on `messageData` | Align with backend |
| Formatter plugin | `src/components/FormattedContent/plugins/mentions_hashtags.js` | Implement plugin | Highlight only tokens present in `options.valid*` |
| Plugin registration | `src/components/FormattedContent/init.js` | Register plugin | After base plugins |
| Render wiring | `src/components/MessageNode.vue` | Pass `validTags`/`validMentions` into `FormattedContent` options | Build from `message.tags` and `message.recipients[].user_tag` |

---

## Later

### Click Actions
- Click on `#tag` to search messages with that tag
- Click on `@mention` to view user profile or send direct message

### Protected Zones
- Add protect/restore for code blocks, inline code, LaTeX in formatter plugin
- Ensure highlights don't break syntax highlighting or code execution

### Advanced Autocomplete
- Show recent mentions/tags
- Suggest relevant users based on message context
- Fuzzy matching for tag search

---

**Note:** This document encodes the immutable-content, lists-as-source-of-truth approach. Draft and render both use the same screening rules; visuals derive strictly from lists, ensuring consistency and avoiding destructive edits.

