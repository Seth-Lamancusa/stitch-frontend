# Channels — Frontend UX Design

**Status**: Design settled — Option C  
**Priority**: High  
**Date**: 2025-01-27

---

## Design Decision: Option C — Channels Tab + Pills + Modal

**Three core UI elements**:
1. **Channels Tab** — Browse and manage channels
2. **Channel Pills** — Individual pills on messages (one per channel)
3. **Channels Modal** — Add/remove channels from messages

---

## 1. Channels Tab

**Location**: Main navigation (desktop tabs + mobile footer)

**Route**: `/channels`

**Purpose**: Browse channels, view channel messages, create channels

### Channel List View

**Layout**: Grid or list of channel cards

**Channel Card**:
- Channel `display_name` (prominent)
- Channel `description` (smaller text, truncated)
- Member count badge
- Admin badge (if user is admin)
- Click card → navigate to channel messages view

**Actions**:
- "Create Channel" button (if user has `channel.create` scope)
- Click channel card → view messages in that channel

### Channel Messages View

**Layout**: Message list filtered to channel

**Channel Header**:
- Channel name (`display_name`)
- Channel description
- Member count
- Admin actions (if user is admin):
  - Edit channel (name/description)
  - Manage members
  - Delete channel

**Content**: 
- Messages that belong to this channel
- Standard message list UI
- Messages show channel pills (see below)

---

## 2. Channel Pills (on Messages)

**Location**: On each message, similar to tags/recipients pills

**Pattern**: Individual pill per channel (not a count badge)

**Visual Design**:
- One pill per channel: `[engineering]` `[design]` `[marketing]`
- Distinct styling from tags (different color/size to show organizational nature)
- Always visible (not hidden behind a badge)

**Interaction**:
- **Click pill** → Navigate to channel view (show messages in that channel)
- **Right-click/long-press pill** → Context menu:
  - View channel
  - Remove from message (if user can edit)
  - Channel settings (if admin)

**Placement**:
- Near tags/recipients area on message
- Could be above or below tags
- Consider visual hierarchy: channels are organizational, tags are metadata

**Edge Cases**:
- Many channels: Show first N pills, "+3 more" indicator
- Long channel names: Truncate with ellipsis
- No channels: Don't show anything (or show "+ Add channels" placeholder)

---

## 3. Channels Modal

**Purpose**: Add/remove channels from messages

**Trigger**:
- From message: Click "+ Add channels" or channel pill context menu
- From ReplyBox: Channel button in toolbar (similar to tags button)

**Pattern**: Follow `TagsModal.vue` structure

### Modal Structure

**Header**:
- Title: "Channels" or "Channels (new message)" based on context
- Close button

**Content**:
- **Channel Dropdown**: Select from user's channels (similar to TagDropdown)
- **Selected Channels List**: 
  - Shows currently selected channels
  - Each channel row: name, description, remove button
  - Empty state: "No channels yet"

**Footer**:
- "Done" button

### Behavior

**Add Mode** (new message in ReplyBox):
- User selects channels before sending
- Changes stored locally until message is sent
- Emits `@change` event with `channel_ids` array

**Edit Mode** (existing message):
- User editing channels on existing message
- Changes saved immediately via API
- Emits `@update` event with `{ messageId, channel_ids }`

---

## Design Considerations

### Visual Distinction from Tags

**Channels** (organizational):
- Different color scheme (e.g., blue/purple vs. gray for tags)
- Slightly larger or different shape
- May have icon/indicator (e.g., `📢` or `#`)

**Tags** (metadata):
- Existing gray styling
- Smaller, more subtle

**Rationale**: Channels are organizational containers, tags are descriptive metadata

### Pill Interaction Model

**Option A: Click = Navigate**
- Click pill → go to channel view
- Right-click → context menu (remove, settings)

**Option B: Click = Quick Actions**
- Click pill → small popover (view channel, remove)
- Double-click → navigate to channel

**Recommendation**: Option A (click = navigate) — simpler, more intuitive

### Handling Many Channels

**Problem**: Message with 10+ channels creates visual clutter

**Solutions**:
1. **Truncate with indicator**: Show first 3-5 pills, "+5 more" pill
2. **Collapsible section**: "Show all channels" toggle
3. **Horizontal scroll**: Pills in scrollable container
4. **Group by category**: If channels have categories (future)

**Recommendation**: Start with truncation (show 3-5, "+N more")

---

## Integration Points

### ReplyBox Integration

**Location**: Toolbar above message input

**UI**: Button similar to tags button
- Icon: `📢` or channel icon
- Text: "Channels (N)" where N = selected count
- Click → open ChannelsModal in add mode

**State**: Store `channelIds` in ReplyBox component, include in message creation payload

### MessageNode Integration

**Location**: Message metadata area (near tags/recipients)

**UI**: Channel pills rendered inline
- One pill per channel
- Click pill → navigate to `/channels/{channel_id}`
- Context menu for actions

**Data**: Read from `message.channels` array (from API)

### Navigation Integration

**TabViewLayout**: Add Channels tab
- Emoji: `📢`
- Label: "Channels"
- Route: `/channels`

**MobileTabBar**: Same tab in mobile footer

**Router**: Add route `/channels` → `ChannelsView`

---

## API Surface Requirements

What these UI elements need to support:

1. **Channels Tab**:
   - `GET /v1/channels` — List user's channels
   - `POST /v1/channels` — Create channel
   - `GET /v1/channels/{id}/messages` — View channel messages
   - `GET /v1/channels/{id}` — Channel details
   - `PATCH /v1/channels/{id}` — Edit channel (admin)
   - `DELETE /v1/channels/{id}` — Delete channel (admin)
   - `GET /v1/channels/{id}/members` — List members
   - `POST /v1/channels/{id}/members` — Add members (admin)
   - `DELETE /v1/channels/{id}/members/{user_id}` — Remove member (admin)

2. **Channel Pills**:
   - `message.channels` array in MessageResponse
   - Navigation to channel view

3. **Channels Modal**:
   - `GET /v1/channels` — List channels for dropdown
   - `PATCH /v1/messages/{id}/channels` — Update message channels
   - `POST /v1/messages` — Include `channel_ids` in creation

---

## Design Questions (TBD)

1. **Pill styling**: What color/size/shape to distinguish from tags?
2. **Pill placement**: Above or below tags/recipients?
3. **Many channels**: Truncation threshold (3? 5? 10?) and indicator style
4. **Channel icon**: Use emoji (`📢`) or icon font?
5. **Context menu**: Right-click or long-press on mobile?
6. **Empty state**: Show "+ Add channels" placeholder or nothing?

---

## Next Steps

1. Design pill visual style (mockup/wireframe)
2. Decide on truncation strategy for many channels
3. Design channel card layout in Channels Tab
4. Design channel header in channel messages view
5. Create component specs based on these decisions
