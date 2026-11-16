// Writes that make the rendered branch the default trajectory.
// The first message has no rendered parent, and the last has no rendered child,
// so those ends are left alone. A hop is written only when that neighbor is
// already a reply or stitch.

function sameId(a, b) {
  return a != null && b != null && String(a) === String(b);
}

function includesId(ids, id) {
  return (ids || []).some((candidate) => sameId(candidate, id));
}

function consider(writes, skipped, { message, field, value, linked, allowed }) {
  if (!message?.id || value == null) return;
  if (!linked) {
    skipped.unlinked += 1;
    return;
  }
  const current = field === 'default_outgoing' ? message.default_outgoing : message.default_incoming;
  if (sameId(current, value)) {
    skipped.unchanged += 1;
    return;
  }
  if (!allowed) {
    skipped.permission += 1;
    return;
  }
  writes.push({ messageId: message.id, field, value });
}

export function defaultThreadWrites(messages, direction, canUpdate) {
  const list = Array.isArray(messages) ? messages : [];
  const writes = [];
  const skipped = { unlinked: 0, unchanged: 0, permission: 0 };
  const wantOutgoing = direction !== 'incoming';
  const wantIncoming = direction !== 'outgoing';
  const allowed = typeof canUpdate === 'function' ? canUpdate : () => false;

  for (let i = 0; i < list.length - 1; i += 1) {
    const above = list[i];
    const below = list[i + 1];
    if (wantOutgoing) {
      consider(writes, skipped, {
        message: above,
        field: 'default_outgoing',
        value: below?.id,
        linked: includesId(above?.child_ids, below?.id) || includesId(above?.stitch_child_ids, below?.id),
        allowed: allowed(above),
      });
    }
    if (wantIncoming) {
      const parents = below?.parent_id ? [below.parent_id] : [];
      consider(writes, skipped, {
        message: below,
        field: 'default_incoming',
        value: above?.id,
        linked: includesId(parents, above?.id) || includesId(below?.stitch_parent_ids, above?.id),
        allowed: allowed(below),
      });
    }
  }

  return { writes, skipped };
}
