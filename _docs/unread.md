# Unread

**Status:** Implemented  
**Last Updated:** September 2026

The backend is the only unread counter. Do not ±1 `unreadMessageCount` or `unread_count_in_thread` locally. Backend contract: `stitch-backend/_docs/unread.md`.

## Two numbers

1. **Tab badge** — Vuex `unreadMessageCount`. Assigned from `unread_total` on login (`TabViewLayout`), websocket `open` / `notification.data.unread_total`, and mark-read / unread / mark-all responses. Fallback: `GET /users/unread-total` via `fetchUnreadMessageCount` / `applyUnreadTotal`.
2. **Inbox row badge** — `message.unread_count_in_thread` from the inbox query. After a read-state write or live arrival, `refreshThreadUnreadCounts` POSTs those leaf ids to `/users/thread-unread-counts` and replaces the field. Clearing the message cache must not zero the tab badge.

## Envelope

`isUnread(message, user)` = recipient of the current user **and** `is_read === false`. `null` means not a recipient, not unread. Shared helper and `messages/isMessageUnread` getter.

## Code

- Store: `src/store/modules/messages.js` (`applyUnreadTotal`, `refreshThreadUnreadCounts`)
- API: `src/services/UserService.js`
- WS: `src/services/ws/WebSocketService.js` (applies `unread_total`, then refreshes thread badges)
- UI: `TabViewLayout.vue`, `MobileTabBar.vue`, `MessagePreview.vue`, `MessageNode.vue`
