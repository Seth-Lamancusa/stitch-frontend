# Stitches (Graph-Linked Messages) - Frontend Spec

The "Stitch" UI transforms the conversation from a series of trees into a navigable web. It allows users to view "alternative histories" for any message and visually connect disparate threads.

## 1. ThreadView: The "Local Slice"
The ThreadView renders a 1D linear projection of the message graph.

### The Symmetric Path Algorithm
1. **Trace UP (Ancestry)**: From the local anchor, follow `active_parent` pointers (which may be a reply-parent or a stitch-parent) until a root or loop is reached.
2. **Trace DOWN (Lineage)**: From the virtual root, follow `active_child` pointers (`branch_child` logic) down to a leaf.
3. **Loop Handling**: If a circular stitch path is detected, rendering stops at the duplicate node and displays a "Loop Detected" marker.

### The Stitch Bridge (TBD)
A **Stitch Bridge** component may be inserted in the thread list to indicate when a vertical connection is via a **Stitch edge** rather than a reply edge.

- **Purpose**: Visually bridge the "jump" between disparate contexts in the conversation graph.
- **Placement**: Between the two messages linked by a stitch edge (either as a parent or child).
- **Controls**: May include actions to switch between multiple potential parents or children, and potentially to add new stitches directly. Details to be refined during implementation.

## 2. GraphView: The "Forest"
The GraphView provides a 2D "God View" of the conversation forest.

### Visual Language
- **Reply Edges**: Standard gray lines, defining the primary tree clusters and node positions.
- **Stitch Edges**: Curved Teal/Purple lines connecting nodes across trees.
- **Node Indicators**: Small icons indicating unloaded neighbors:
  - `+` (Top/Bottom): Unloaded reply parents/children.
  - `🪡` (Sides): Unloaded stitch neighbors.

### Navigation & Loading
- **Load All**: Iteratively performs a BFS following both reply and stitch edges to load the entire connected component.
- **Local Radius**: Default view loads immediate reply family + indicators for available stitches.

## 3. Store State
The `messages` module manages the "Local Perspective":
- `active_parent_id_by_message`: Maps a message to its currently selected parent (defaults to `parent_id` if present).
- `stitch_parent_ids` / `stitch_child_ids`: Adjacency data provided by the graph traversal endpoint.
- `switchParent(messageId)`: Action to cycle through available reply and stitch parents.
