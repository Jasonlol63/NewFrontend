// Rows made by one operation (one Rate, one Bank Process posting, one Domain charge) share a `groupId` and are deleted
// together by the API. Ticking one row ticks the rest of its group, so the user sees what goes with it.

/**
 * Selection after the user changed `prev` into `next` (a row box, or the header box): every row whose tick changed drags
 * the other loaded rows of its group to the same state. Rows that cannot be selected (already deleted, read-only) stay out.
 */
export function syncGroupSelection(prev, next, rows, canSelect) {
  const changed = [];
  next.forEach((id) => !prev.has(id) && changed.push([id, true]));
  prev.forEach((id) => !next.has(id) && changed.push([id, false]));
  if (!changed.length) return next;

  const groupOf = new Map(rows.map((r) => [r.id, r.groupId]));
  const out = new Set(next);
  for (const [id, on] of changed) {
    const groupId = groupOf.get(id);
    if (!groupId) continue;
    for (const r of rows) {
      if (r.groupId !== groupId || !canSelect(r)) continue;
      if (on) out.add(r.id);
      else out.delete(r.id);
    }
  }
  return out;
}
