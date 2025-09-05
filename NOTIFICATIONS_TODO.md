## Notifications Implementation Plan (Frontend)

This document captures the plan and open questions for completing the notifications experience. It references existing code to ensure the design aligns with current behavior.

### Scope
- Single WebSocket event type: `new_message`
- Activity-based reconnect on user interaction; no idle overlay
- HMAC webhook configuration UX (Slack-style model)
- Ping/pong handling (text), remove custom JSON heartbeat
- Refresh/reconnect mirrors app load/refresh and refreshes unread counts

---

### WebSocket

- Endpoint: `ws(s)://{host}/ws/user/{token}`
- Authorization: `token` includes `msg.read`
- Events from backend: `connection_established`, `new_message` (single type)
- Health: server may send text `ping`; client should respond with `pong`

Planned changes
1) Normalize event handling to only `type: "new_message"`.
   - File: `src/services/WebSocketService.js`
   - Current handling special-cases `new_reply`; replace with unified `new_message` branch and route to `handleIncomingMessage(data.data)`.

2) Remove JSON heartbeat writes.
   - Remove sending `{type: 'heartbeat'}`; wire format is text ping/pong only.
   - Keep receiving text `ping` and reply `pong`. Optionally send client `ping` as text if needed.

3) Idle behavior changes.
   - Remove idle timer and overlay.
   - Keep lightweight activity-based reconnect and connection health checks.

References
- URL build and connect: `src/services/WebSocketService.js` (connectUser)
- Activity reconnect handler: `maybeActivityReconnect()` wired in `src/App.vue`

---

### Idle Overlay & Manual Reconnect

Removed. System now silently attempts reconnect on activity and via health checks.

State & store
- Idle overlay state removed (`isIdle`, `idleSince`, related actions/mutations).

Triggering overlay
- N/A (overlay removed)

Refresh & reconnect button behavior
- Steps should mirror first-load for the current page:
  - Reconnect WS using current token (or latest via `TokenManager`).
  - Refresh current view data:
    - Thread pages: call `messages/loadTraversal` or `loadMessageRadius` around the current `messageId` to ensure thread is up-to-date.
    - Inbox/feed pages: call `messages/fetchUserMessages` or mode-specific loaders.
  - Refresh unread counts:
    - Call `messages/fetchUnreadMessageCount()`.
  - Dismiss overlay on success.

References
- Thread reload helpers: `src/services/MessageService.js` (traverseFrom, loadMessageRadius)
- Store traversal: `src/store/modules/messages.js` (loadTraversal, loadMessageRadius)
- Unread count: `messages/fetchUnreadMessageCount`, mutation `SET_UNREAD_MESSAGE_COUNT`

Components & mounting
- `src/components/IdleOverlay.vue` removed and not mounted in `src/App.vue`.

---

### HMAC Webhook Configuration (Simplified)

Model
- Shared secret configured by the developer; backend signs each webhook request using HMAC SHA-256 over the string `ts + "\n" + raw_body`.

Headers
- `X-Stitch-Timestamp: <epoch_ms>` (milliseconds since epoch)
- `X-Stitch-Signature: sha256=<hex(hmac_sha256(secret, ts + "\n" + raw_body_bytes))>`

Frontend UX
- Where: `ProfileEditModal` and a read-only section on integrations page if applicable.
- Fields:
  - Endpoint URL (existing)
  - Endpoint Signing Secret (write-only input)
- Behavior:
  - Autogenerate a strong secret client-side when enabling endpoint notifications; display it once with a copy button and a hint to store it securely (cannot be shown again).
  - Provide a Rotate action that generates a new secret and one-time displays it.
  - On save, include `endpoint_signing_secret` (and `endpoint` when changed) in `POST /api/users/profile`.
  - Never display the saved secret after submission. Optionally show a one-time confirmation toast.

Open questions for backend
1) Replay protection: confirm bots verify timestamp skew (recommend ≤ 5 minutes).
2) Webhook retries: delivery retry policy/backoff headers clients should expect?
3) Expected response codes for success (200–299) vs suppression; handling of non-2xx.

References
- Profile POST: `src/store/modules/auth.js` -> `updateProfile()` already posts to `/api/users/profile` and refreshes `/api/users/me`.
- Profile UI: `src/components/modals/ProfileEditModal.vue` has endpoint and notify toggles; we add the secret input.

---

### Notify Gating Rules (UI)

- Global gate: account must have verified email before any notifications are sent.
- Per-contact notify gates:
  - Only allow enabling notify on contacts where `verified == true` and `notify` toggles are enabled.
- UI mirrors:
  - `ProfileEditModal.vue` already disables toggles based on `isEmailVerified` and per-contact verification.
  - Idle overlay references removed; gating remains in profile modal.

---

### Error & Edge Cases

- WebSocket unauthorized (1008): run token refresh path or force logout.
- Unknown WS message types: ignore and log.
- If reconnect fails from overlay: show inline error; keep overlay open. Allow retry.

---

### Tasks

1) WebSocket: unify on `new_message`, remove JSON heartbeat, keep text ping/pong.
2) Remove idle overlay and idle timer; keep activity-based reconnect only.
3) Remove idle overlay state/actions from UI store.
4) Wire `maybeActivityReconnect` in `App.vue` for user interactions.
6) Profile modal: add signing secret (write-only) + optional key ID; include in profile save payload.
7) Define refresh sequence for each route and wire unread count refresh.
8) Coordinate with backend on HMAC envelope (timestamp/version), replay protection, rotation.

---

### Refresh & Reconnect: Concrete Steps

- Reconnect WS: call `WebSocketService.connectUser(token)`; token from `TokenManager` or `localStorage`.
- Page refresh mirroring:
  - Thread route (`/messages/:id`): dispatch `messages/loadMessageRadius({ messageId: id, radius: 5, get_replies: true })`.
  - Inbox route: dispatch `messages/fetchUserMessages({ page: 1 })`.
  - Public feed route: `MessageService.getPublicMessages` via `messages/fetchMessages({ mode: 'public' })`.
- Unread count: dispatch `messages/fetchUnreadMessageCount()`.
- On success: app resumes; no overlay.

---

### Notes

- Do not display the HMAC secret after submission; only one-time reveal on create/rotate with an explicit hint to copy and store securely.
- Keep existing auto-mark-as-read behavior in thread view after refresh.
- Idle-based close logic removed.

