# Folders (V1) Design Notes (Frontend)

This document complements the backend spec: `stitch-backend/_docs/folders_v1_design.md`.

## What V1 Adds in the UI

1. A new tab: `/folders`
2. A “Folders” message control (like Channels) inside the thread/message UI
3. Drive-style warnings when adding a message to a folder (visibility shares with N users)

## Key UX Behaviors

1. Folder visibility is enforced for **thread traversal** (replies/parents expansion).
2. Folder-only messages do not gain receiver-edge read/unread semantics.
3. Multi-folder membership is supported; a message may appear in multiple folders.

## Primary Frontend Changes

Modify:

- `src/router.js`: add `/folders` route + component
- `src/components/MessageNode.vue`: add “Folders (N)” badge + modal wiring
- `src/components/ReplyBox.vue`: add folder control in the thread/reply controls area

Create:

- `src/views/app_views/FoldersView.vue`: folder list + folder message list
- `src/components/modals/FoldersModal.vue`: add/remove folder membership for a message
- `src/services/FoldersService.js`: API wrapper for folders and folder message lists
