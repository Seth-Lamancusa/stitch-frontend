# Unread Count Display Issue Analysis

**Issue**: The unread message count appears inconsistent or "random" to users.

**Date**: January 17, 2026

**Branch**: `cursor/unread-count-display-issue-6628`

---

## Executive Summary

The unread count system has several architectural issues causing client-side count drift from the server's authoritative state. The primary problems are:

1. **Silent failures in auto-mark logic** when not in ThreadView
2. **Race conditions** between increment/decrement operations
3. **No server validation** of client-side count changes
4. **Timing issues** causing visible count flickering

---

## Data Flow Analysis

### How Unread Count is Fetched

1. **API Endpoint**: `GET /users/unread-total`
2. **Service Layer**: `UserService.getUnreadMessageCount()` in `src/services/UserService.js`
3. **Store**: `state.unreadMessageCount` in `src/store/modules/messages.js`
4. **Display**: 
   - Desktop: `TabViewLayout.vue` (line 331)
   - Mobile: `MobileTabBar.vue` (line 87)

### Update Triggers

| Trigger | Action | Location |
|---------|--------|----------|
| User login | Fetch from server | `TabViewLayout.vue` watch (line 376-386) |
| WebSocket connects | Fetch from server | `WebSocketService.js` (line 591) |
| New message via WS | Increment locally | `messages.js` handleIncomingWsMessage (line 490) |
| Mark as read | Decrement locally | `messages.js` markMessageAsRead (line 1256) |
| Mark as unread | Increment locally | `messages.js` markMessageAsUnread (line 1293) |
| Batch mark read | Decrement locally | `messages.js` batchMarkAsRead (line 1527) |

---

## Issues Identified

### Issue 1: Auto-Mark Fails Silently Outside ThreadView

**Location**: `src/store/modules/messages.js`, lines 1473-1536

**Problem**: The `batchMarkAsRead` action only works when `threadViewMode` is `true`:

```javascript
async batchMarkAsRead({ commit, state, rootState }, messageIds) {
  // Only proceed if in thread view mode
  if (!state.threadViewMode) {
    console.log('[Store] Not in thread view mode, skipping auto-mark');
    return;  // ← Exits without decrementing count!
  }
  // ...
}
```

However, in `handleIncomingWsMessage` (line 488-510), the count is ALWAYS incremented before checking if auto-mark should happen:

```javascript
if (isToCurrentUser && !isFromCurrentUser) {
  dispatch('incrementUnreadCount');  // ← Always increments
  
  // ...
  
  if (isNextInBranch) {
    dispatch('batchMarkAsRead', [messageData.id]);  // ← May silently fail
  }
}
```

**Impact**: When a user receives a message while viewing the inbox list (not in ThreadView), the count increments but the auto-mark silently fails, causing the count to be higher than expected.

---

### Issue 2: Race Condition in Count Updates

**Location**: `src/store/modules/messages.js`, lines 488-530

**Problem**: The increment happens synchronously, but the decrement is asynchronous:

```
Timeline when viewing active thread:
T0: Message arrives via WebSocket
T1: incrementUnreadCount() called → count = N+1 (user sees +1)
T2: isNextInBranch evaluated → true
T3: batchMarkAsRead() dispatched (async)
T4: API call to mark-read...
T5: API response received
T6: count decremented → count = N (user sees -1)
```

**Impact**: Users see a brief "flicker" where count goes up then immediately back down.

---

### Issue 3: No Server Validation of Count Changes

**Problem**: All count modifications are done client-side with optimistic updates. The server's `unread_total` is only fetched on:
- Initial login
- WebSocket reconnection

If any API call fails (e.g., `mark-read` returns error), the client count continues to be modified while the server state diverges:

```javascript
// In batchMarkAsRead (line 1520-1527):
eligibleIds.forEach(id => {
  commit('UPDATE_MESSAGE_READ_STATUS', { messageId: id, isRead: true });
});
// Count decremented even if API partially failed
const newUnreadCount = Math.max(0, state.unreadMessageCount - updatedCount);
commit('SET_UNREAD_MESSAGE_COUNT', newUnreadCount);
```

**Impact**: Client count drifts from server over time, especially on unreliable networks.

---

### Issue 4: WebSocket Reconnection Causes Count Jumps

**Location**: `src/services/ws/WebSocketService.js`, line 591

**Problem**: On WebSocket reconnection:

```javascript
this.client.on('open', () => {
  // ...
  try { store.dispatch('messages/fetchUnreadMessageCount'); } catch (e) {}
  // ...
});
```

This fetches the server's authoritative count, which may differ significantly from the client's drifted count due to:
- Messages received while disconnected
- Failed API calls during the session
- Race conditions

**Impact**: Users see sudden jumps in the count when WebSocket reconnects (e.g., tab becomes visible again, network reconnects).

---

### Issue 5: Legacy Dead Code (Minor)

**Location**: `src/store/modules/messages.js`, line 6

```javascript
let initialUnreadCountFetched = false;
```

This variable is defined but never used, suggesting incomplete implementation or abandoned refactoring.

---

## Component Responsibility Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        Display Layer                            │
│  ┌───────────────────┐     ┌─────────────────────┐             │
│  │ TabViewLayout.vue │     │  MobileTabBar.vue   │             │
│  │   (Desktop)       │     │    (Mobile)         │             │
│  └─────────┬─────────┘     └──────────┬──────────┘             │
│            │                          │                         │
│            └────────────┬─────────────┘                         │
│                         ▼                                       │
│            ┌────────────────────────┐                           │
│            │ getUnreadMessageCount  │ (Vuex getter)             │
│            └────────────┬───────────┘                           │
│                         ▼                                       │
│            ┌────────────────────────┐                           │
│            │ state.unreadMessageCount │                         │
│            └────────────────────────┘                           │
│                         ▲                                       │
│         ┌───────────────┼───────────────┐                       │
│         │               │               │                       │
│  ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐               │
│  │ increment   │ │ fetch from  │ │ decrement   │               │
│  │ UnreadCount │ │   server    │ │ (mark read) │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Recommended Fixes

### Fix 1: Conditional Increment Based on Thread View State (Quick Fix)

Only increment the count if NOT in an auto-markable context:

```javascript
// In handleIncomingWsMessage:
if (isToCurrentUser && !isFromCurrentUser) {
  const shouldAutoMark = state.threadViewMode && isNextInBranch;
  
  if (!shouldAutoMark) {
    dispatch('incrementUnreadCount');
  }
  
  if (shouldAutoMark) {
    dispatch('batchMarkAsRead', [messageData.id]);
  } else {
    // Show notification
  }
}
```

### Fix 2: Server-Authoritative Count (Best Long-Term Fix)

After any batch operation, re-fetch the count from the server:

```javascript
async batchMarkAsRead({ commit, state, rootState, dispatch }, messageIds) {
  // ... existing logic ...
  
  // After API call succeeds, refresh from server to ensure sync
  await dispatch('fetchUnreadMessageCount');
}
```

### Fix 3: Debounced Count Refresh

Implement a debounced refresh that triggers after any count-modifying operation:

```javascript
let refreshDebounceTimer = null;

function scheduleCountRefresh(dispatch) {
  if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
  refreshDebounceTimer = setTimeout(() => {
    dispatch('fetchUnreadMessageCount');
  }, 2000); // 2 second debounce
}
```

### Fix 4: Remove Race Condition with Promise Chaining

Ensure increment only happens if auto-mark will NOT succeed:

```javascript
if (isToCurrentUser && !isFromCurrentUser) {
  if (isNextInBranch && state.threadViewMode) {
    // Will auto-mark, don't increment
    await dispatch('batchMarkAsRead', [messageData.id]);
  } else {
    // Won't auto-mark, increment and notify
    dispatch('incrementUnreadCount');
    // ... notification logic ...
  }
}
```

---

## Files Involved

| File | Responsibility |
|------|----------------|
| `src/store/modules/messages.js` | Count state management, mutations, actions |
| `src/services/UserService.js` | API calls for fetching/updating read status |
| `src/services/ws/WebSocketService.js` | Real-time message handling, reconnection |
| `src/components/layouts/TabViewLayout.vue` | Desktop count display |
| `src/components/layouts/MobileTabBar.vue` | Mobile count display |
| `src/views/app_views/ThreadView.vue` | Thread view mode management |

---

## Testing Scenarios

To reproduce the "random" behavior:

1. **Scenario A**: Login → Go to inbox list → Receive new message via WS → Count increments but message isn't auto-marked (not in ThreadView)

2. **Scenario B**: Be in ThreadView → Receive message → See count briefly spike then return (race condition)

3. **Scenario C**: Lose network briefly → Reconnect → See count jump to different value (server sync)

4. **Scenario D**: Mark messages as read on slow network → Some API calls fail → Count shows fewer unread than server
