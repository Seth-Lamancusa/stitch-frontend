# The Stitch System: Multi-Dimensional Conversations

The Stitch system transforms a conversation from a collection of isolated hierarchical trees into a navigable, semantic web. It enables users to view alternative histories for any message and connect disparate threads within a single, coherent application.

## 1. Data Architecture: The Two Edge Families

The system relies on a unified data model where every message is aware of its neighbors across two distinct edge families:

*   **Reply Edges (Structural Tree):** The primary parent-child relationship. These define the "reply trees" and traditional conversation flow. Every message has at most one reply parent (`parent_id`) and zero or more reply children (`child_ids`).
*   **Stitch Edges (Semantic Web):** Cross-tree or intra-tree links that connect disparate points of a conversation. A message can have multiple incoming stitch parents (`stitch_parent_ids`) and multiple outgoing stitch children (`stitch_child_ids`).

### Unified Traversal
Access to this graph is provided via a single backend endpoint:
`GET /v1/messages/traverse-from/{message_id}`

*   **Edge Type:** The `edge_type=replies|links` parameter determines which family the traversal "walks."
*   **Metadata:** Regardless of the walk type, the backend returns the immediate adjacent metadata for **both** families for every node found, allowing the UI to detect available connections without extra fetches.

---

## 2. GraphView: The Forest (2D Map)

GraphView provides a 2D "God View" of the entire stitched conversation forest. It is designed for **exploration and visualization**.

### Visual Language
*   **Nodes:** Rendered as circular instances representing messages.
*   **Edges:** Directed lines with arrow heads. Purple edges indicate stitches, while standard colors indicate replies.
*   **Reply-Tree Boundaries:** Draggable, dotted rounded containers wrap reply-edge connected components. This allows users to organize the forest by moving entire sub-threads as single units while preserving internal tree structure.

### Interaction & Loading
*   **Manual Expansion:** Each node exposes up to four manual load buttons (↑, ↓, ←, →) to expand standard ancestry/descendancy or link neighbors.
*   **Load All:** Iteratively expands both reply and stitch edges until no unloaded neighbors remain in the reachable graph.
*   **Selection:** Clicking a node updates the selection state and drives the `GraphSidePanel` for message details.

---

## 3. ThreadView: The Story Line (1D Projection)

ThreadView collapses the multi-dimensional message graph into a single, vertical **Story Line**. It is designed for **focus and reading**.

### The "Visible Branch"
The UI renders a 1D slice of the graph by following a specific trajectory of pointers (`branch_parent` and `branch_child`) stored in the Vuex state.

### Navigation Dimensions
Navigation is handled through two distinct lateral axes:
1.  **Sibling Navigation (Downward):** Controlled by the **sibling navigator** beside a message. It chooses which **outgoing child** (reply or stitch) the trajectory follows downward.
2.  **Parent Navigation (Upward):** Controlled by the **parent navigator** shown above the message. It switches which **incoming origin** (reply parent or stitch parent) the history above a message descends from.

### Viewport Stability (The "Eye-Tracking" Fix)
To maintain reading flow during origin switches, ThreadView employs a capture-and-restore mechanism. When a user switches an origin, the UI captures the message's exact distance from the top of the viewport and recalculates the scroll position after the new branch renders to keep that message **perfectly stationary**.

### Visual & Spatial Cues
*   **Stitch Boundaries:** Stitch neighbors at the top/bottom of a thread are not auto-loaded. Users must explicitly "bridge" the gap via the **Adaptive Marker** ("Load stitches") to bring a different tree into the current slice.
*   **Origin Transparency:** The **LinkSwitcher** flags when a message's context is derived from a stitch rather than a reply via a "Linked origin" indicator.
*   **Desktop Sizing:** Reply roots (no incoming reply edge) render **18px wider** on desktop when displayed in a stitch context, signalling a jump between trees.

---

## 4. Store State & Logic Integrity

*   **Vuex Module (`messages`):** Manages the flat message cache and the active branch pointers.
*   **Surgical Loading:** Initial thread loads are restricted to `edge_type=replies` to establish a clean primary storyline. Stitches are brought into the session only through deliberate user action.
*   **First-Class Targets:** The state machine treats stitch edges as valid navigation targets, ensuring that switching between a reply and a stitch never invalidates the active branch path.
