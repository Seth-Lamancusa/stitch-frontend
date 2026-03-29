# Stitch (rebranded Links) — UI and UX

## Status
Draft stub (rebranding effort). This doc describes the existing **links** feature between messages, using the new name **stitches**.

## What is a stitch?
A stitch is a **directional** connection between two messages that both users can view.

## UI: linking messages

Primary component: `stitch-frontend/src/components/modals/LinksModal.vue`.

### How users create stitches
- The modal opens in a “Linked Messages” dialog.
- Two selection modes:
  - **Incoming**: selected messages link *to* the current message
  - **Outgoing**: the current message links *to* selected messages
- The UI uses `MessageList` in link-specific modes:
  - `incoming-links`
  - `outgoing-links`
- Users select messages, then click **Add** to create the connections.

### Redux/Vuex flow
- `LinksModal.vue` dispatches `messages/createLink`.
- The Vuex store method calls the backend via `stitch-frontend/src/services/UserService.js`.

## Backend API (referenced)
The backend creates/deletes stitches via the messages links endpoints:
- `POST /v1/links/messages/{message_id_from}/{message_id_to}`
- `DELETE /v1/links/messages/{message_id_from}/{message_id_to}`

For “incoming/outgoing” listing, the backend provides:
- `GET /v1/links/messages/{message_id}/incoming`
- `GET /v1/links/messages/{message_id}/outgoing`

Implementation source in backend:
- `stitch-backend/app/routers/public_v1/enrichment.py`

## Permissions (UI expectations)
- Creating/deleting requires the user to have `msg.write` capability.
- Deleting is restricted to the user who created the edge.
- Guest users are prompted to sign in before creating links.

## Related files
- UI modal: `stitch-frontend/src/components/modals/LinksModal.vue`
- Store actions: `stitch-frontend/src/store/modules/messages.js`
- Service methods: `stitch-frontend/src/services/UserService.js`
