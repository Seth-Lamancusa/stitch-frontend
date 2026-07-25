# Inline Mentions (@) and Tags (#) — Implementation Reference

**Status:** ✅ Implemented  
**Last Updated:** 2024

This document describes the current implementation of inline mentions and tags in the Stitch frontend. It serves as the source of truth for how the system works, what components are involved, and how data flows through the system.

---

## Architecture Overview

The system follows an **immutable content, lists-as-source-of-truth** pattern:

- **Message content never changes** due to tag/recipient adds/removals (draft or existing messages)
- **Lists are authoritative**: highlights derive from `tags` and `recipients` arrays, not from parsing content
- **Draft state** lives in `navigation.replySettings` (tags + recipients)
- **Existing messages** use `message.tags` and `message.recipients` from the store

### Core Principle

> Visual highlights are computed by matching content tokens against authoritative lists. If a token isn't in the list, it renders as plain text—even if it looks like a valid `#tag` or `@mention`.

---

## Data Flow

### Draft State (ReplyBox)

```
User types "#test" → autoStageTagsFromContent() scans textarea
  → Finds committed tokens (with boundary)
  → Normalizes to lowercase
  → Adds to navigation.replySettings.tags
  → Overlay highlights token (because it's now in the list)
  → User deletes "#test" → reconcileInlineTagsWithContent()
  → Removes from navigation.replySettings.tags
  → Highlight disappears
```

### Send Pipeline

```
ReplyBox.sendReply()
  → autoStageTagsFromContent(true) // Capture terminal tags
  → store.dispatch('messages/sendReply', { tags, recipients, content })
  → MessageService.sendReply() includes tags in payload
  → Backend stores tags + recipients separately from content
  → Message returns with tags[] and recipients[] arrays
```

### Render Pipeline

```
MessageNode renders message.content
  → Builds validTags Set from message.tags
  → Builds validMentions Set from message.recipients[].user_tag
  → Passes to FormattedContent as options
  → mentions_hashtags formatter walks DOM
  → Wraps only tokens present in valid* sets
  → Leaves others as plain text
```

---

## Component Breakdown

### 1. ReplyBox.vue — Draft Editor

**Location:** `src/components/ReplyBox.vue`

**Responsibilities:**
- Manages draft content in a transparent textarea
- Renders non-interactive overlay with token highlights
- Auto-stages tags from typed content
- Provides mention autocomplete dropdown
- Syncs overlay scroll/height with textarea

**Key State:**
```javascript
const content = ref('');                    // Raw textarea content
const overlayHtml = ref('');                // Highlighted HTML for overlay
const suppressedTags = ref(new Set());      // Tags removed via modal (prevent re-add)
const inlineTrackedTags = ref(new Set());  // Tags auto-staged from typing
const mentionDropdown = reactive({          // Autocomplete UI state
  visible: false,
  query: '',
  results: [],
  highlightedIndex: 0,
  position: { top, left },
  anchorStart: null,  // Text position where @ started
  anchorEnd: null
});
```

**Key Functions:**

- `autoStageTagsFromContent(allowTerminalBoundary)` — Scans content for committed `#tags`, stages them into `navigation.replyTags`, tracks in `inlineTrackedTags`
- `reconcileInlineTagsWithContent(activeTokenSet)` — Removes tags from staged list if they disappear from content
- `detectMentionTrigger(textarea)` — Detects `@` at caret, extracts query, schedules user search
- `insertMentionResult(user)` — Replaces `@query` with `@user_tag `, adds user to recipients, closes dropdown
- `buildHighlightedHtml(rawText)` — Builds overlay HTML with spans for tokens present in `normalizedReplyTagSet` / `mentionableUserTagSet`
- `updateOverlayHtml()` — Recomputes overlay HTML when content/tags/recipients change
- `syncOverlayScroll()` — Keeps overlay scroll position in sync with textarea

**Tag Auto-Staging Logic:**

1. On content change, `autoStageTagsFromContent()` runs
2. Scans for `#tag` tokens matching `TAG_TOKEN_RE` with a boundary character after
3. Normalizes to lowercase, checks against `suppressedTags` (skip if suppressed)
4. Adds new tags to `navigation.replyTags` (max 20)
5. Tracks newly added tags in `inlineTrackedTags`
6. Calls `reconcileInlineTagsWithContent()` to remove tags that disappeared

**Mention Autocomplete:**

1. User types `@` → `detectMentionTrigger()` fires on input/keyup/click
2. Extracts query from text before caret: `/@([A-Za-z0-9_]{0,32})$/`
3. If match found, shows dropdown, schedules debounced `auth/searchUsers(query)`
4. Positions dropdown at caret using `calculateCaretCoordinates()`
5. User navigates with ↑/↓, selects with Enter, dismisses with Escape
6. On select, `insertMentionResult()` replaces `@query` with `@user_tag `, adds to recipients

**Overlay Rendering:**

- Overlay div mirrors textarea content with highlighted spans
- Only tokens in `normalizedReplyTagSet` or `mentionableUserTagSet` get spans
- Overlay is `aria-hidden="true"`, textarea remains focusable
- Scroll/height synced via `syncOverlayScroll()` and shared resize logic

### 2. Navigation Store — Draft State

**Location:** `src/store/modules/navigation.js`

**State:**
```javascript
replySettings: {
  isPublic: true,
  recipients: [],  // Array of { uid, display_name, user_tag, email, public }
  addToAncestors: true,
  tags: []        // Array of lowercase strings
}
```

**Mutations:**
- `SET_REPLY_TAGS(tags)` — Normalizes and sets tag list
- `ADD_REPLY_TAG(tag)` — Adds single tag (normalized, deduped)
- `REMOVE_REPLY_TAG(tag)` — Removes tag by normalized value
- `CLEAR_REPLY_TAGS()` — Clears all tags
- `SET_REPLY_RECIPIENTS(recipients)` — Sets recipient list
- `ADD_REPLY_RECIPIENT(recipient)` — Adds recipient (deduped by uid)

**Actions:**
- `setReplyTags(tags)` — Normalizes and commits tag list
- `addRecipient(recipient)` — Adds recipient to draft list

**Tag Normalization:**
- Pattern: `^[A-Za-z0-9-]{1,32}$` (no underscores)
- Always lowercased
- Deduplicated, maintains first-occurrence order
- Max 20 tags enforced

### 3. Mentions/Hashtags Formatter Plugin

**Location:** `src/components/FormattedContent/plugins/mentions_hashtags.js`

**Purpose:** Wraps valid tokens in styled spans during message rendering

**Input:**
- `content` — HTML string (already processed by markdown/latex/code formatters)
- `options.validTags` — `Set<string>` of lowercase tag names
- `options.validMentions` — `Set<string>` of lowercase user_tags

**Process:**
1. Normalizes `validTags` and `validMentions` into Sets
2. Creates temporary DOM container, sets innerHTML to content
3. Walks text nodes recursively (skips `CODE`, `PRE`, `KBD`, `SAMP` elements)
4. For each text node, collects tag/mention matches using regex patterns
5. Filters matches: only highlight if normalized token exists in respective Set
6. Replaces text node with DocumentFragment containing spans + plain text
7. Returns container.innerHTML

**Output:** HTML with `<span class="fc-inline-token fc-inline-token--tag">#tag</span>` for valid tokens

**Regex Patterns:**
```javascript
TAG_TOKEN_RE = /(^|[\s([{])#([A-Za-z0-9-]{1,32})(?![A-Za-z0-9-])/gm
MENTION_TOKEN_RE = /(^|[\s([{])@([A-Za-z0-9_]{1,32})(?![A-Za-z0-9_])(?=[^\w@.]|$)/gm
```

**Styling:** Defined in `src/components/FormattedContent/styles.css`
- `.fc-inline-token--tag` — Yellow highlight (rgba(255, 196, 76, 0.28))
- `.fc-inline-token--mention` — Blue highlight (rgba(92, 192, 255, 0.28))

### 4. MessageNode.vue — Render Integration

**Location:** `src/components/MessageNode.vue`

**Responsibilities:**
- Builds `validTags` and `validMentions` Sets from message data
- Passes options to `FormattedContent` component

**Computed Properties:**
```javascript
const renderTagSet = computed(() => {
  // Extracts tag names from message.tags (handles string or object format)
  // Returns Set<string> of lowercase tag names
});

const renderMentionSet = computed(() => {
  // Extracts user_tag from message.recipients[]
  // Returns Set<string> of lowercase user_tags
});

const formattedContentOptions = computed(() => ({
  validTags: renderTagSet.value,
  validMentions: renderMentionSet.value
}));
```

**Template:**
```vue
<formatted-content 
  v-if="displayMode === 'full'" 
  :content="message.content" 
  :options="formattedContentOptions"
/>
```

### 5. FormattedContent System

**Location:** `src/components/FormattedContent/`

**Plugin Registration:** `init.js` registers `mentions_hashtags` formatter with priority 120 (runs after markdown/latex/code)

**Processing Order:**
1. `html_links` (priority 30)
2. `mcp_examples` (priority 35)
3. `markdown` (priority 40)
4. `latex` (priority 50)
5. `code` (priority 60)
6. `mentions_hashtags` (priority 120) ← Runs last, operates on final HTML

---

## API Contracts

### Store Actions

**Navigation Store:**
```javascript
// Set draft tags (normalizes, dedupes, enforces max 20)
store.dispatch('navigation/setReplyTags', ['tag1', 'tag2'])

// Add recipient to draft
store.dispatch('navigation/addRecipient', {
  uid: 'user-123',
  display_name: 'John Doe',
  user_tag: 'johndoe',
  email: 'john@example.com',
  public: true
})
```

**Messages Store:**
```javascript
// Send reply with tags
store.dispatch('messages/sendReply', {
  parentId: 123,
  content: 'Hello #test @user',
  isPrivate: false,
  recipients: [{ uid: 'user-123', ... }],
  tags: ['test'],
  content_author: 'current-user-uid'
})
```

**Auth Store:**
```javascript
// Search users for mention autocomplete
store.dispatch('auth/searchUsers', 'query')
// Returns: Array<{ uid, display_name, user_tag, email, ... }>
```

### Service Layer

**MessageService.sendReply():**
```javascript
MessageService.sendReply(
  parentId,
  content,
  isPrivate,
  recipients,
  content_author,
  tags,  // Array<string>
  attachments
)
```

**Backend Payload:**
```json
{
  "content": "Hello #test @user",
  "public": true,
  "recipients": [{ "uid": "user-123", ... }],
  "tags": ["test"],  // Backend normalizes/stores separately
  "parent_id": 123,
  "content_author": "current-user-uid"
}
```

---

## Edge Cases & Behaviors

### Tag Auto-Staging

**Boundary Detection:**
- Tags are only staged when followed by a boundary character: `[\s.,!?;:)\]}'"`]`
- Terminal tags (end of content) are staged only at send time (`allowTerminalBoundary=true`)
- Prevents partial matches: typing `#test` doesn't stage `#t`, `#te`, `#tes`

**Suppression Logic:**
- When user removes tag via `TagsModal`, it's added to `suppressedTags`
- Suppressed tags won't auto-stage even if they reappear in content
- Suppression persists until tag is removed from content (then cleaned up)

**Inline Tracking:**
- Tags auto-staged from typing are tracked in `inlineTrackedTags`
- If tracked tag disappears from content, it's automatically removed from staged list
- Tags added via modal are NOT tracked, so they won't auto-remove if deleted from text

**Limits:**
- Max 20 tags enforced (ignores additional tags when auto-staging)
- Duplicates prevented (normalized, deduped)

### Mention Autocomplete

**Trigger Detection:**
- Detects `@` followed by 0-32 alphanumeric/underscore characters
- Must be preceded by start-of-line or boundary: `[\s([{>]`
- Query extracted from text before caret position

**Positioning:**
- Dropdown positioned at caret using `calculateCaretCoordinates()`
- Clones textarea styles to measure text metrics
- Falls back to textarea top-left if calculation fails
- Constrained to wrapper bounds, max height 200px

**Keyboard Navigation:**
- ↑/↓ — Navigate results
- Enter — Select highlighted result
- Escape — Close dropdown
- Tab/Click outside — Close dropdown

**User Selection:**
- Replaces `@query` with `@user_tag ` (adds trailing space)
- Adds user to `navigation.replyRecipients` if not already present
- Restores caret position after insertion
- Closes dropdown

### Rendering

**Token Matching:**
- Tags normalized to lowercase before comparison
- Mentions normalized to lowercase (user_tag typically lowercase)
- Only tokens present in respective Sets get highlighted
- Plain `@text` or `#tag` without list membership render as plain text

**Protected Zones:**
- Formatter skips `CODE`, `PRE`, `KBD`, `SAMP` elements
- Tokens inside code blocks won't be highlighted
- Future: Could add protect/restore for inline code and LaTeX

**Case Sensitivity:**
- Tags: Always normalized to lowercase (stored and compared)
- Mentions: Normalized to lowercase for comparison, but display keeps original `user_tag` case

### Content Immutability

**Draft:**
- Removing tag via modal updates `replyTags` list only
- Content remains unchanged
- Highlight disappears because token no longer in list
- Same behavior for recipients

**Existing Messages:**
- Removing tag/recipient via modal updates database lists only
- Content field never modified
- Re-render shows updated highlights based on new lists

---

## Styling

### Draft Overlay (ReplyBox)

**Classes:**
- `.reply-overlay` — Mirror div (transparent text, positioned absolutely)
- `.reply-overlay-token` — Base token span
- `.reply-overlay-token--tag` — Yellow highlight for tags
- `.reply-overlay-token--mention` — Blue highlight for mentions

**Styles:** Defined in `ReplyBox.vue` scoped styles

### Rendered Messages

**Classes:**
- `.fc-inline-token` — Base token span
- `.fc-inline-token--tag` — Yellow highlight for tags
- `.fc-inline-token--mention` — Blue highlight for mentions

**Styles:** Defined in `src/components/FormattedContent/styles.css`

**Visual Design:**
- Tags: `rgba(255, 196, 76, 0.28)` background, `rgba(255, 196, 76, 0.35)` border
- Mentions: `rgba(92, 192, 255, 0.28)` background, `rgba(92, 192, 255, 0.35)` border
- Border radius: 4px
- Padding: 0 2-3px
- Font weight: 600

---

## Accessibility

**Draft Editor:**
- Overlay is `aria-hidden="true"` (non-interactive)
- Single focusable textarea for all input
- Mention dropdown is keyboard navigable (↑/↓/Enter/Escape)
- Dropdown positioned near caret (best-effort on mobile)

**Rendered Messages:**
- Token spans are semantic (could add `role="tag"` / `role="mention"` in future)
- Styling uses sufficient contrast (inherits from `--color-text`)
- No interactive behavior yet (future: click to search/view profile)

---

## Future Enhancements

### Planned (Not Yet Implemented)

**Click Actions:**
- Click `#tag` → Search messages with that tag
- Click `@mention` → View user profile or send DM

**Protected Zones:**
- Skip highlighting inside inline code (`` `code` ``)
- Skip highlighting inside LaTeX blocks (`$$...$$`)
- Ensure highlights don't break syntax highlighting

**Advanced Autocomplete:**
- Show recent mentions/tags in dropdown
- Suggest relevant users based on message context
- Fuzzy matching for tag search
- Tag autocomplete (similar to mention autocomplete)

**Performance:**
- Debounce overlay HTML updates on rapid typing
- Virtualize mention dropdown for large result sets
- Cache user search results

---

## Testing Considerations

**Manual Test Cases:**

1. **Tag Auto-Staging:**
   - Type `#test ` → Should stage "test"
   - Type `#test` at end, send → Should stage "test"
   - Type `#test` without space → Should NOT stage until boundary
   - Remove tag via modal → Should disappear from list and highlight
   - Re-type removed tag → Should NOT auto-stage (suppressed)

2. **Mention Autocomplete:**
   - Type `@` → Dropdown appears
   - Type `@j` → Shows users matching "j"
   - Navigate with ↑/↓ → Highlights change
   - Press Enter → Inserts `@user_tag `, adds to recipients
   - Press Escape → Closes dropdown
   - Type `@invalid` → No highlight (not in recipients)

3. **Content Immutability:**
   - Add tag via modal → Content unchanged, highlight appears
   - Remove tag via modal → Content unchanged, highlight disappears
   - Delete tag from text → Tag removed from staged list

4. **Rendering:**
   - Message with `#tag` but tag not in `message.tags` → No highlight
   - Message with `@user` but user not in `message.recipients` → No highlight
   - Message with valid tags/mentions → Highlights appear

---

## File Reference

| Component | File | Purpose |
|-----------|------|---------|
| Draft Editor | `src/components/ReplyBox.vue` | Main reply composer with overlay + autocomplete |
| Draft State | `src/store/modules/navigation.js` | Manages `replyTags` and `replyRecipients` |
| Send Action | `src/store/modules/messages.js` | `sendReply` action includes tags |
| Service | `src/services/MessageService.js` | API call includes tags in payload |
| Formatter Plugin | `src/components/FormattedContent/plugins/mentions_hashtags.js` | Renders token highlights |
| Plugin Init | `src/components/FormattedContent/init.js` | Registers formatter |
| Render Integration | `src/components/MessageNode.vue` | Builds options, passes to FormattedContent |
| Styles | `src/components/FormattedContent/styles.css` | Token highlight styles |

---

## Notes

- **Content is never mutated** — All tag/recipient changes update lists only
- **Highlights derive from lists** — Visual state always matches authoritative data
- **Draft and render use same logic** — Consistent behavior across contexts
- **Suppression prevents loops** — Removed tags won't re-stage until user edits token
- **Inline tracking enables cleanup** — Tags auto-staged from typing auto-remove when deleted

This implementation ensures consistency, prevents data loss, and maintains a clear separation between content (immutable) and metadata (mutable lists).

