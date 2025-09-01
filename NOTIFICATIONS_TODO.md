## Notifications Implementation Plan (Frontend)

This document captures the plan and open questions for completing the notifications experience. It references existing code to ensure the design aligns with current behavior.

### Scope
- Single WebSocket event type: `new_message`
- Idle overlay and manual reconnect flow
- HMAC webhook configuration UX (Slack-style model)
- Ping/pong handling (text), remove custom JSON heartbeat
- Idle modal includes email and phone fields like profile
- Refresh/reconnect mirrors app load/refresh and refreshes unread counts

---

### WebSocket

- Endpoint: `ws(s)://{host}/ws/user/{token}/{view_id}`
- Authorization: `token` includes `msg.read`
- Events from backend: `connection_established`, `new_message` (single type)
- Health: server may send text `ping`; client should respond with `pong`

Planned changes
1) Normalize event handling to only `type: "new_message"`.
   - File: `src/services/WebSocketService.js`
   - Current handling special-cases `new_reply`; replace with unified `new_message` branch and route to `handleIncomingMessage(data.data)`.

2) Remove JSON heartbeat writes.
   - Current code sends JSON `{type: 'heartbeat'}` at an interval; remove to keep wire format simple (text ping/pong only).
   - Keep receiving text `ping` and reply `pong`. Optionally send client `ping` as text if needed.

3) Idle behavior changes.
   - Keep idle timer that closes WS after 60s inactivity.
   - Remove activity-based auto-reconnect handlers.
   - On idle close, set global idle state and show overlay; only a manual button initiates reconnect.

References
- URL build and connect: `src/services/WebSocketService.js` (connectUser)
- Idle timeout: `idleTimeoutMs`, `handleIdleTimeout()`
- Current activity reconnect hooks: `installActivityReconnectHandlers()`

---

### Idle Overlay & Manual Reconnect

User experience
- App-wide dimming overlay with a centered modal:
  - Title: "Session inactive. Message notifs going to email / SMS."
  - Fields: Email, Phone (same validation and gating as profile modal)
  - Notify checkboxes: email, phone, endpoint
  - Primary action: "Refresh & reconnect"
  - Secondary: "Close" (dismiss overlay without reconnect)

State & store
- Extend UI store with idle state:
  - `ui.state.isIdle: boolean`
  - `ui.state.idleSince: number | null`
  - Mutations: `SET_IDLE(isIdle: boolean, idleSince?: number)`
  - Actions: `enterIdle()`, `exitIdle()`

Triggering overlay
- `WebSocketService.handleIdleTimeout()` dispatches `ui/enterIdle`.
- On reconnect success, dispatch `ui/exitIdle`.

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
- New component: `src/components/IdleOverlay.vue`
  - Props/state from store; uses `auth/updateProfile` for notify toggles and contact fields.
  - Includes email/phone inputs with validation parity to `ProfileEditModal.vue`.
- Mount globally in `src/App.vue` so it overlays any route.

---

### HMAC Webhook Configuration (Slack-style)

Model
- Slack-style shared secret configured by the user; backend signs each webhook request using HMAC SHA-256 over the raw body.
- Headers:
  - `X-Stitch-Signature: sha256=<hex(hmac_sha256(secret, raw_body_bytes))>`
  - `X-Stitch-Key-Id: <key identifier>` (optional; defaults to user UID if not set)

Frontend UX
- Where: `ProfileEditModal` and a read-only section on bots/integrations page if applicable.
- Fields:
  - Endpoint URL (existing)
  - Endpoint Signing Secret (write-only input)
  - Key ID (optional, text)
- Behavior:
  - Autogenerate a strong secret client-side when enabling endpoint notifications; display it once with a copy button and a hint to store it securely (cannot be shown again).
  - Provide a Rotate action that generates a new secret and one-time displays it; prior secret handling per backend grace/rotation policy.
  - On save, include `endpoint_signing_secret` and optional `endpoint_key_id` (and `endpoint` when changed) in `POST /api/users/profile`.
  - Never display the saved secret after submission. Optionally show a one-time confirmation toast.
  - Surface a short explainer plus a copyable verification snippet link (bot-side) in docs.

Open questions for backend
1) Signature envelope: any timestamp or version prefix like Slack? e.g. `v0:timestamp:hash` to protect against replay.
2) Replay protection: should clients verify a timestamp header and enforce a permissible skew window?
3) Key rotation: when rotating `endpoint_signing_secret`, how are overlapping signatures handled? Any grace period/dual-secret support?
4) Key ID: if omitted, confirm default is user UID. Any constraints/length limits?
5) Webhook retries: delivery retry policy/backoff headers clients should expect?
6) Expected response codes for success (200–299) vs suppression; handling of non-2xx.

References
- Profile POST: `src/store/modules/auth.js` -> `updateProfile()` already posts to `/api/users/profile` and refreshes `/api/users/me`.
- Profile UI: `src/components/modals/ProfileEditModal.vue` has endpoint and notify toggles; we will add secret and key-id inputs.

---

### Notify Gating Rules (UI)

- Global gate: account must have verified email before any notifications are sent.
- Per-contact notify gates:
  - Only allow enabling notify on contacts where `verified == true` and `notify` toggles are enabled.
- UI mirrors:
  - `ProfileEditModal.vue` already disables toggles based on `isEmailVerified` and per-contact verification.
  - Idle overlay will reuse the same gating logic and update via `auth/updateProfile` with `{ notify: { email, phone, endpoint } }`.

---

### Error & Edge Cases

- WebSocket unauthorized (1008): run token refresh path or force logout, then show idle overlay if still disconnected.
- Unknown WS message types: ignore and log.
- If reconnect fails from overlay: show inline error; keep overlay open. Allow retry.

---

### Tasks

1) WebSocket: unify on `new_message`, remove JSON heartbeat, keep text ping/pong.
2) Remove activity-based auto-reconnect; keep idle close; surface idle overlay.
3) UI store: add `isIdle`, `idleSince` and actions.
4) IdleOverlay component with email/phone fields, notify toggles, and "Refresh & reconnect".
5) Mount IdleOverlay globally in `App.vue`.
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
- On success: `ui/exitIdle` and close overlay.

---

### Notes

- Do not display the HMAC secret after submission; only one-time reveal on create/rotate with an explicit hint to copy and store securely.
- Keep existing auto-mark-as-read behavior in thread view after refresh.
- Ensure WS close on idle uses code 1000; avoid retry loops until manual reconnect.

