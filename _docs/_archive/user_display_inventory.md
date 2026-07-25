# User Display Name & Tag Inventory

This document inventories all locations where user display names and/or tags are displayed in the frontend, to support abstraction into a reusable component for badge implementation.

## Components & Locations

### 1. Message Preview (`MessagePreview.vue`)
**Location:** `src/components/MessagePreview.vue`

**Display Pattern:**
- Lines 25-29: Author display name and tag in message header
  ```vue
  <div class="author-info">
    <span class="message-author" :class="{ 'current-user-name': isCurrentUser }">
      {{ showParticipantsLabel ? participantsDisplay : authorDisplayName }}
    </span>
    <span v-if="!showParticipantsLabel && authorUserTag" class="author-user-tag">@{{ authorUserTag }}</span>
  </div>
  ```

**Computed Properties:**
- `authorDisplayName` (line 195): `props.message.author_display_name || ''`
- `authorUserTag` (line 196): `props.message.author_user_tag || null`
- `participantsDisplay` (lines 245-283): Comma-separated list of participant names (author + recipients)

**Styling Classes:**
- `.author-info` - container
- `.message-author` - display name
- `.message-author.current-user-name` - when current user
- `.author-user-tag` - user tag with @ prefix

---

### 2. Message Node (`MessageNode.vue`)
**Location:** `src/components/MessageNode.vue`

**Display Pattern:**
- Lines 36-38: Author display name and tag in message header
  ```vue
  <div class="author-info">
    <span class="message-author" :class="{ 'current-user-name': isCurrentUser }}">{{ showParticipantsLabel ? participantsDisplay : authorDisplayName }}</span>
    <span v-if="!showParticipantsLabel && authorUserTag" class="author-user-tag">@{{ authorUserTag }}</span>
  </div>
  ```

**Computed Properties:**
- `authorDisplayName` (line 742): `props.message.author_display_name || ''`
- `authorUserTag` (line 747): `props.message.author_user_tag || null`
- `participantsDisplay` (lines 757-795): Comma-separated list of participant names (author + recipients)

**Styling Classes:**
- `.author-section` - outer container
- `.author-info` - container
- `.message-author` - display name
- `.message-author.current-user-name` - when current user
- `.author-user-tag` - user tag with @ prefix

---

### 3. Graph Node (`GraphNode.vue`)
**Location:** `src/components/graph/GraphNode.vue`

**Display Pattern:**
- Lines 29-31: Author display name and tag in graph node header
  ```vue
  <div class="author-info">
    <span class="message-author" :class="{ 'current-user-name': isOwnMessage }">{{ authorDisplay }}</span>
    <span v-if="authorTag" class="author-user-tag">@{{ authorTag }}</span>
  </div>
  ```

**Computed Properties:**
- `authorDisplay` (line 227): `this.message.author_display_name || this.message.author?.display_name || this.message.author?.username || this.message.author?.email || 'Unknown'`
- `authorTag` (line 230): `this.message.author_user_tag || null`

**Styling Classes:**
- `.author-info` - container
- `.message-author` - display name
- `.message-author.current-user-name` - when own message
- `.author-user-tag` - user tag with @ prefix

---

### 4. List View Header (`TabViewLayout.vue`)
**Location:** `src/components/layouts/TabViewLayout.vue`

**Display Pattern:**
- Lines 79-80: Principal display name and tag in header
  ```vue
  <span class="username">{{ displayedPrincipalName }}</span>
  <span v-if="displayedPrincipalTag" class="user-tag">@{{ displayedPrincipalTag }}</span>
  ```

**Computed Properties:**
- `displayedPrincipalName` (line 359): `getUserDisplayName(displayedPrincipal.value)`
- `displayedPrincipalTag` (line 360): `(displayedPrincipal.value && displayedPrincipal.value.user_tag) ? displayedPrincipal.value.user_tag : null`
- `getUserDisplayName` helper (line 322): `u.displayName || u.display_name || (u.user_tag ? \`@${u.user_tag}\` : (u.email || 'Unknown'))`

**Menu Items:**
- Lines 120-121: Manager display name and tag in menu
  ```vue
  <span class="menu-item-name">{{ managerDisplayName }}</span>
  <span v-if="managerTag" class="menu-item-tag">@{{ managerTag }}</span>
  ```
- Lines 151-152: Managed user display names and tags in menu
  ```vue
  <span class="menu-item-name">{{ getUserDisplayName(m) }}</span>
  <span v-if="m && m.user_tag" class="menu-item-tag">@{{ m.user_tag }}</span>
  ```

**Styling Classes:**
- `.username-container` - outer container
- `.username` - display name
- `.user-tag` - user tag with @ prefix
- `.menu-item-name` - menu item display name
- `.menu-item-tag` - menu item user tag with @ prefix

---

### 5. Thread Header (`ThreadHeader.vue`)
**Location:** `src/components/ThreadHeader.vue`

**Display Pattern:**
- Lines 37-38: User display name and tag
  ```vue
  <span class="username">{{ userDisplayName }}</span>
  <span v-if="userTag" class="user-tag">@{{ userTag }}</span>
  ```

**Props:**
- `userDisplayName` (line 59): String prop, default 'Guest'
- `userTag` (line 60): String prop, default null

**Styling Classes:**
- `.username-container` - outer container
- `.username` - display name
- `.user-tag` - user tag with @ prefix

---

### 6. New Thread View (`NewThreadView.vue`)
**Location:** `src/views/app_views/NewThreadView.vue`

**Display Pattern:**
- Lines 19-20: User display name and tag
  ```vue
  <span class="username">{{ userDisplayName }}</span>
  <span v-if="userTag" class="user-tag">@{{ userTag }}</span>
  ```

**Computed Properties:**
- `userDisplayName` (line 113): `user.value.displayName || user.value.email || 'Unknown User'`
- `userTag` (line 118): `user.value.user_tag || null`

**Styling Classes:**
- `.username-container` - outer container
- `.username` - display name
- `.user-tag` - user tag with @ prefix

---

### 7. Profile Edit Modal (`ProfileEditModal.vue`)
**Location:** `src/components/modals/ProfileEditModal.vue`

**Display Pattern:**
- Lines 849-857: Display name input field (editing, not display)
- Lines 1055-1056: Manager search results display
  ```vue
  <span class="search-result-name">{{ user.display_name || 'User' }}</span>
  <span class="search-result-tag">@{{ user.user_tag }}</span>
  ```

**Note:** This modal is primarily for editing, but shows user names/tags in search results.

**Styling Classes:**
- `.search-result-name` - search result display name
- `.search-result-tag` - search result user tag with @ prefix

---

### 8. Recipients Modal (`RecipientsModal.vue`)
**Location:** `src/components/modals/RecipientsModal.vue`

**Display Patterns:**
- Lines 28-29: Existing recipients display
  ```vue
  <span class="recipient-name">{{ recipient.display_name || recipient.user_tag }}</span>
  <span v-if="recipient.user_tag" class="recipient-tag-name">@{{ recipient.user_tag }}</span>
  ```
- Lines 100-101: Search results display
  ```vue
  <span class="search-result-name">{{ user.display_name || 'User' }}</span>
  <span class="search-result-tag">@{{ user.user_tag }}</span>
  ```
- Lines 186-187: New recipients display
  ```vue
  <span class="recipient-name">{{ recipient.display_name || recipient.user_tag }}</span>
  <span v-if="recipient.user_tag" class="recipient-tag-name">@{{ recipient.user_tag }}</span>
  ```
- Lines 232-233: Non-add mode recipients display
  ```vue
  <span class="recipient-name">{{ recipient.display_name || recipient.user_tag }}</span>
  <span v-if="recipient.user_tag" class="recipient-tag-name">@{{ recipient.user_tag }}</span>
  ```

**Styling Classes:**
- `.recipient-name` - recipient display name
- `.recipient-tag-name` - recipient user tag with @ prefix
- `.search-result-name` - search result display name
- `.search-result-tag` - search result user tag with @ prefix

---

### 9. User Search Input (`UserSearchInput.vue`)
**Location:** `src/components/UserSearchInput.vue`

**Display Pattern:**
- Line 14: Search results display
  ```vue
  {{ user.display_name }} (@{{ user.user_tag }})
  ```
- Line 42: Initial user display in input field
  ```vue
  `${newUser.display_name} (@${newUser.user_tag})`
  ```
- Line 67: Selected user display
  ```vue
  `${user.display_name} (@${user.user_tag})`
  ```

**Note:** This component displays names inline in search results and input field, not as separate elements.

---

### 10. Import View (`ImportView.vue`)
**Location:** `src/views/app_views/ImportView.vue`

**Display Pattern:**
- Lines 278-295: Built message author display
  ```vue
  <span class="built-message-author">
    <template v-if="speakerMappingEnabled">
      <template v-if="speakerRegistry[msg.speakerId]">
        {{ speakerRegistry[msg.speakerId].display_name }} (@{{ speakerRegistry[msg.speakerId].user_tag }})
      </template>
    </template>
    <template v-else>
      <template v-if="msg.authorUid">
        {{ msg.authorName }} (@{{ msg.authorTag }})
      </template>
    </template>
  </span>
  ```

**Styling Classes:**
- `.built-message-author` - author display in built messages

---

## Common Patterns

### Display Name Fallback Logic
Most components use a fallback chain:
1. `display_name` or `displayName`
2. `user_tag` (with @ prefix)
3. 'Unknown' or 'Guest'

### Tag Display Pattern
- Always prefixed with `@`
- Conditionally rendered: `v-if="userTag"` or `v-if="authorUserTag"`
- Styled with smaller font size and secondary text color

### Current User Highlighting
- Uses `.current-user-name` class when the displayed user is the current user
- Applied to the display name span

### Common CSS Classes
- `.author-info` / `.author-section` - container for author info
- `.message-author` - display name in message context
- `.author-user-tag` - user tag in message context
- `.username` - display name in header/user context
- `.user-tag` - user tag in header/user context
- `.recipient-name` - display name in recipient context
- `.recipient-tag-name` - user tag in recipient context

---

## Abstraction Opportunities

### Proposed Component: `UserDisplay.vue` or `UserBadge.vue`

> ✅ **Implemented** as `src/components/common/UserDisplay.vue`.
>
> Current adopters: `MessagePreview`, `MessageNode`, `TabViewLayout`, `ProfileEditModal` (manager search results). Remaining locations can migrate gradually.

**Props:**
- `user` - User object with `display_name`, `user_tag`, `uid`, etc.
- `displayName` - Optional override for display name
- `userTag` - Optional override for user tag
- `variant` - Context variant: `'message'`, `'header'`, `'recipient'`, `'menu'`, `'graph'`
- `showTag` - Boolean to show/hide tag (default: true)
- `highlightCurrentUser` - Boolean to highlight if current user (default: true)
- `size` - Size variant: `'sm'`, `'md'`, `'lg'` (default: 'md')
- `badges` - Array of badge descriptors `{ key, label, icon/content }` rendered immediately after the display name
- `showAutoBadges` - Automatically adds system badges (currently 🤖 for bots) unless set to `false`

**Slots:**
- `before` - Content before name/tag
- `after` - Content after name/tag (for badges, icons, etc.)

**Features:**
- Consistent fallback logic for display names (display_name → user_tag → 'Unknown')
- Consistent tag formatting (@ prefix)
- Current user detection and highlighting
- Context-appropriate styling via variant prop
- Support for badge/icon integration
- Optional 🤖 bot badge automatically added when `is_bot` metadata is available (via `message.author_is_bot` or `user.is_bot`), plus support for arbitrary custom badges via the `badges` prop

---

## Notes

- Some components show participant lists (comma-separated) instead of single author - these may need a separate `UserListDisplay` component
- Graph nodes have slightly different fallback logic (includes `author.username` and `author.email`) - may need special handling or prop override
- Profile edit modal primarily shows names in search results, not as display
- Recipients modal shows names in multiple contexts (existing, new, search results)
- UserSearchInput and ImportView show inline formatted strings - may need different approach or a `formatUserString` utility function
- Backend now returns `author_is_bot` on message DTOs so UI can display badges without extra lookups

