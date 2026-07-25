import { hierarchy, tree } from 'd3-hierarchy';

/**
 * Grouped tidy-tree layout — a variation of the graph-view tree layout.
 *
 * Differences from calculateTreeLayout (layoutAlgorithms.js):
 *  - Explicit node width via d3.tree().nodeSize() instead of content-driven width.
 *  - Sibling "groups": siblings sharing a `group` value render as an overlapping
 *    stack (overlap fraction is configurable, e.g. 0.5 = 50% of nodeWidth).
 *  - Contour-based placement (d3.tree is a true Buchheim implementation):
 *    separation is only enforced between nodes at the same depth, so deep
 *    branches may slide horizontally underneath shallow leaf clusters rather
 *    than being pushed out by whole-subtree width reservation.
 *
 * Messages may carry a group hint either as `group` or `layout.group`.
 * Groups are scoped to a parent: the same group value under different
 * parents does not merge.
 */

const DEFAULT_CONFIG = {
  nodeWidth: 100,     // explicit node width (circle diameter); the unit for separation
  verticalGap: 160,   // y distance between depth layers
  siblingGap: 40,     // px gap between ungrouped siblings
  subtreeGap: 80,     // px gap between adjacent nodes of different parents
  rootGap: 150,       // px gap between independent root trees
  groupOverlap: 0.5,  // fraction of nodeWidth that same-group siblings overlap
  maxWidth: null,     // if set and layout is wider, x positions are scaled to fit
};

function getGroup(message) {
  const g = message?.group ?? message?.layout?.group;
  return g === undefined || g === null ? null : g;
}

/**
 * @param {Array} messages - flat array of {id, parent_id, timestamp, group?, ...}
 * @param {Object} options - overrides for DEFAULT_CONFIG
 * @returns {{positions: Map<string, Object>, bounds: Object}}
 *   positions: id -> {x, y, layer, group, stackIndex, groupSize, message}
 *   stackIndex orders nodes within their group (render later ones on top).
 */
export function calculateGroupedTreeLayout(messages, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };

  if (!messages || messages.length === 0) {
    return { positions: new Map(), bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 } };
  }

  const byId = new Map(messages.map((m) => [m.id, m]));
  const childrenOf = new Map();
  const roots = [];

  for (const m of messages) {
    if (m.parent_id && byId.has(m.parent_id)) {
      if (!childrenOf.has(m.parent_id)) childrenOf.set(m.parent_id, []);
      childrenOf.get(m.parent_id).push(m);
    } else {
      roots.push(m);
    }
  }

  // Group members must be adjacent siblings for the overlap to read as a stack:
  // order by group (ungrouped last), then timestamp within.
  const byGroupThenTime = (a, b) => {
    const ga = getGroup(a);
    const gb = getGroup(b);
    if (ga !== gb) {
      if (ga === null) return 1;
      if (gb === null) return -1;
      if (ga < gb) return -1;
      if (ga > gb) return 1;
    }
    return new Date(a.timestamp) - new Date(b.timestamp);
  };
  for (const children of childrenOf.values()) children.sort(byGroupThenTime);
  roots.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Virtual super-root lets one layout pass handle multiple root trees.
  const VIRTUAL_ID = '__virtual_root__';
  const root = hierarchy({ id: VIRTUAL_ID }, (d) =>
    d.id === VIRTUAL_ID ? roots : childrenOf.get(d.id),
  );

  const sameGroup = (a, b) =>
    a.parent === b.parent &&
    getGroup(a.data) !== null &&
    getGroup(a.data) === getGroup(b.data);

  // separation() is in multiples of nodeWidth and is only consulted for
  // adjacent nodes at the same depth — this is what allows under-sliding.
  const separation = (a, b) => {
    if (a.parent === b.parent) {
      if (a.parent?.data?.id === VIRTUAL_ID) return 1 + config.rootGap / config.nodeWidth;
      if (sameGroup(a, b)) return 1 - config.groupOverlap;
      return 1 + config.siblingGap / config.nodeWidth;
    }
    return 1 + config.subtreeGap / config.nodeWidth;
  };

  tree().nodeSize([config.nodeWidth, config.verticalGap]).separation(separation)(root);

  // Collect real nodes (skip the virtual root, re-base depth to 0).
  const nodes = root.descendants().filter((n) => n.data.id !== VIRTUAL_ID);

  let minX = Infinity;
  let maxX = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
  }

  // Normalize to x >= 0, then compress uniformly if wider than maxWidth.
  // (Uniform scaling shrinks gaps and overlaps proportionally.)
  const rawWidth = maxX - minX;
  const scale =
    config.maxWidth && rawWidth > config.maxWidth ? config.maxWidth / rawWidth : 1;

  const positions = new Map();
  for (const n of nodes) {
    const group = getGroup(n.data);
    let stackIndex = 0;
    let groupSize = 1;
    if (group !== null && n.parent) {
      const stack = n.parent.children.filter((c) => getGroup(c.data) === group);
      stackIndex = stack.indexOf(n);
      groupSize = stack.length;
    }
    positions.set(n.data.id, {
      x: (n.x - minX) * scale,
      y: (n.depth - 1) * config.verticalGap,
      layer: n.depth - 1,
      group,
      stackIndex,
      groupSize,
      message: byId.get(n.data.id) || n.data,
    });
  }

  return { positions, bounds: calculateGroupedBounds(positions, config) };
}

export function calculateGroupedBounds(positions, config = DEFAULT_CONFIG) {
  if (positions.size === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of positions.values()) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const half = (config.nodeWidth ?? DEFAULT_CONFIG.nodeWidth) / 2;
  return {
    minX: minX - half,
    minY: minY - half,
    maxX: maxX + half,
    maxY: maxY + half,
    width: maxX - minX + 2 * half,
    height: maxY - minY + 2 * half,
  };
}

/**
 * Cubic Bézier path for a parent->child edge (vertical flow).
 * Matches the curveTension idea in VISUAL_CONFIG.edges.
 */
export function curvedEdgePath(source, target, curveTension = 0.5) {
  const dy = target.y - source.y;
  const c1y = source.y + dy * curveTension;
  const c2y = target.y - dy * curveTension;
  return `M ${source.x} ${source.y} C ${source.x} ${c1y}, ${target.x} ${c2y}, ${target.x} ${target.y}`;
}
