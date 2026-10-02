// Search + Set helpers for the tickable lists (CheckList, MultiSelectField).

// Rows matching a search box (label or hint contains the text).
export function filterItems(items, query) {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((it) => `${it.label} ${it.hint ?? ""}`.toLowerCase().includes(q));
}

// Toggle helpers for a Set held in state.
export function toggleIn(set, value) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
