// Branch resolution for the thread view.
// branch_parent === undefined: no override, use default_incoming, then parent_id.
// branch_parent === null: explicit top of a stored context window. Do not walk further.

export function outgoingChildPool(message) {
  if (!message) return [];
  return [...new Set([...(message.child_ids || []), ...(message.stitch_child_ids || [])])];
}

export function explicitDefaultOutgoing(message) {
  const id = message && message.default_outgoing;
  if (!id) return null;
  return outgoingChildPool(message).includes(id) ? id : null;
}

export function resolvedBranchParent(message) {
  if (!message) return null;
  if (message.branch_parent !== undefined) return message.branch_parent;
  return message.default_incoming || message.parent_id || null;
}

export function uniqueIds(ids) {
  const ordered = [];
  for (const id of ids || []) {
    if (id == null || id === '') continue;
    if (ordered.some(existing => String(existing) === String(id))) continue;
    ordered.push(id);
  }
  return ordered;
}

// Parents that exist above an explicit context terminus and are not attached.
export function earlierParentIds(message) {
  if (!message || message.branch_parent !== null) return [];
  return uniqueIds([
    message.default_incoming,
    message.parent_id,
    ...(message.stitch_parent_ids || []),
  ]);
}

// Unloaded replies, unloaded stitches, and default_outgoing under a context anchor.
export function continuationIds(message, isUnloaded) {
  if (!message) return [];
  const unloaded = typeof isUnloaded === 'function' ? isUnloaded : () => false;
  return uniqueIds([
    message.default_outgoing,
    ...(message.child_ids || []).filter(id => unloaded(id)),
    ...(message.stitch_child_ids || []).filter(id => unloaded(id)),
  ]);
}

export function chooseBranchChild(message, messages) {
  const explicit = explicitDefaultOutgoing(message);
  if (explicit) return explicit;
  // Automatic continuation follows replies. A stitch is shown only after an
  // explicit choice, such as Load stitches setting branch_child.
  const pool = message?.child_ids || [];
  const loaded = pool
    .map(id => messages && messages[id])
    .filter(Boolean)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  if (!loaded.length) return null;
  const order = new Map(
    (Array.isArray(message.reply_order) ? message.reply_order : []).map((id, index) => [String(id), index])
  );
  if (order.size) {
    const ordered = loaded.filter(child => order.has(String(child.id)));
    const pickFrom = ordered.length ? ordered : loaded;
    pickFrom.sort((a, b) => {
      const ai = order.has(String(a.id)) ? order.get(String(a.id)) : -1;
      const bi = order.has(String(b.id)) ? order.get(String(b.id)) : -1;
      if (ai !== bi) return ai - bi;
      return new Date(a.timestamp) - new Date(b.timestamp);
    });
    return pickFrom[pickFrom.length - 1].id;
  }
  return loaded[loaded.length - 1].id;
}

export function contextChainMatches(visibleIds, contextIds, anchorId) {
  if (anchorId == null || !Array.isArray(contextIds)) return false;
  const expected = [...contextIds, anchorId].map(id => String(id));
  const actual = (visibleIds || []).map(id => String(id));
  if (actual.length !== expected.length) return false;
  return actual.every((id, index) => id === expected[index]);
}

// The stored context plus its anchor, repeats kept. This is a walk, not a successor orbit.
export function contextWalkIds(contextIds, anchorId) {
  const ids = [];
  for (const id of contextIds || []) {
    if (id == null || id === '') continue;
    ids.push(id);
  }
  if (anchorId != null && anchorId !== '') ids.push(anchorId);
  return ids;
}

// Ids to show while a context view is active. Null means follow the successor orbit.
export function activeContextWalk(contextView) {
  if (!contextView || !Array.isArray(contextView.ids) || contextView.ids.length === 0) return null;
  return contextView.ids;
}

// A walk can show one message at more than one position, so the row key includes the index.
export function branchRowKey(id, index, walkActive) {
  if (walkActive) return `walk:${index}:${id}`;
  return String(id);
}

// Loaded descendants of rootId, excluding the context window. Does not walk into a kept id.
export function loadedDescendantIds(messages, rootId, keepIds) {
  const keep = new Set((keepIds || []).map(id => String(id)));
  const seen = new Set([String(rootId)]);
  const remove = [];
  const stack = [rootId];
  while (stack.length) {
    const currentId = stack.pop();
    const message = messages && messages[currentId];
    if (!message) continue;
    const nextIds = [...(message.child_ids || []), ...(message.stitch_child_ids || [])];
    if (message.branch_child) nextIds.push(message.branch_child);
    for (const childId of nextIds) {
      if (childId == null) continue;
      const key = String(childId);
      if (seen.has(key) || keep.has(key)) continue;
      seen.add(key);
      if (!messages[childId]) continue;
      remove.push(childId);
      stack.push(childId);
    }
  }
  return remove;
}
