# Stitches (Graph-Linked Messages) - Frontend Spec

The "Stitch" UI transforms a conversation from a series of trees into a navigable web. It enables users to view alternative histories for any message and connect disparate threads.

## 1. ThreadView: Local Slice

ThreadView renders a 1D linear projection of the stitched message graph.

Note: This document focuses on GraphView behavior that is implemented in the current frontend. ThreadView stitch-bridge/loop handling is intentionally left as TBD.

## 2. GraphView: Forest (Implemented)

GraphView provides a 2D "God View" of a stitched conversation.

### Visual Language
- Nodes: rendered as circular `GraphTreeNode` instances.
- Reply edges: rendered as directed edges based on reply adjacency (`parent_id` and `child_ids`).
- Stitch edges: rendered as directed edges based on stitch adjacency (`stitch_child_ids`).
- Edges include an arrow head at the outgoing end.

### Node Edge Load Controls (Up to 4)
Each visible message node exposes up to four manual load buttons, each gated by whether the relevant one-hop neighbor exists but is not already loaded:
- Reply In (↑)
  - Loads additional reply ancestors using the backend traversal with `edge_type=replies`.
- Stitch In (←)
  - Loads additional stitch ancestors using the backend traversal with `edge_type=links`.
- Reply Out (↓)
  - Loads additional reply descendants using the backend traversal with `edge_type=replies`.
- Stitch Out (→)
  - Loads additional stitch descendants using the backend traversal with `edge_type=links`.

Implementation detail:
- Stitch In/Out buttons call `loadMessageBranchUp/Down(..., edge_type='links')`.

### Dotted Reply-Tree Boundaries (Draggable)
GraphCanvas renders dotted, rounded containers around reply-edge connected components (reply edges only). These boundary containers are draggable and translate the positions of nodes inside that reply component.

### Loading
- Origin expansion / incremental loading
  - Uses the backend traversal endpoint to fetch messages and their adjacency fields.
  - GraphView refreshes incrementally after each expansion.
- Load All
  - Iteratively expands both reply and stitch edges until no unloaded neighbors remain.
  - After the loop completes, GraphView performs a final full layout recompute to normalize spacing across the entire forest.

### Selection + Right-Side Message Panel
- Clicking a node updates GraphView selection.
- The right-side details drawer is rendered by `GraphSidePanel` and is driven by selection (`graphView.selection.lastSelectedId`).
- Close dispatches `graphView/clearSelection`.

## 3. Store State (GraphView)

GraphView uses the Vuex module `graphView`.

- `graphView.selection.selectedIds`: supports multi-selection.
- `graphView.selection.lastSelectedId`: drives `GraphSidePanel`.
- `graphView.layout.positions`: message coordinate map used by GraphCanvas.

Edges derived from message adjacency:
- Reply edges: `parent_id` (source) -> `id` (target)
- Stitch edges: `id` (source) -> each `stitch_child_ids[]` (target)

Adjacency fields come from backend traversal:
- `parent_id` / `child_ids`
- `stitch_parent_ids` / `stitch_child_ids`
