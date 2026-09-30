// Helpers shared by the list pages (Admin users, Accounts): status filter chips, date columns,
// sorting comparators and badge colours.

export const STATUS_BADGE = {
  active: "bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]",
  inactive: "bg-[#fee2e2] text-[#b91c1c] border-[#fecaca]",
};

// Neither chip / Active only -> active rows; Inactive only -> inactive; both -> everyone.
export function matchesStatusChips(status, { showActive, showInactive }) {
  if (showActive && showInactive) return true;
  return status === (showInactive ? "inactive" : "active");
}

export function matchesSearch(fields, search) {
  const q = search.trim().toLowerCase();
  return !q || fields.some((v) => String(v ?? "").toLowerCase().includes(q));
}

function parseDateTime(raw) {
  if (!raw) return null;
  const d = new Date(String(raw).trim().replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

const pad = (n) => String(n).padStart(2, "0");

// "2026-09-30T14:05:09" -> { date: "30-09-2026", time: "14:05:09" }
export function formatDateTime(raw) {
  const d = parseDateTime(raw);
  if (!d) return { date: raw ? String(raw) : "-", time: "" };
  return {
    date: `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  };
}

// Comparators take (a, b, dir) and return an ascending result; sortRows applies the direction.
export const compareText = (key) => (a, b) =>
  String(a[key] ?? "").localeCompare(String(b[key] ?? ""), undefined, { sensitivity: "base", numeric: true });

// Empty dates always sort last, whichever the direction.
export const compareDate = (key) => (a, b, dir) => {
  const va = parseDateTime(a[key])?.getTime() ?? null;
  const vb = parseDateTime(b[key])?.getTime() ?? null;
  if (va == null || vb == null) return va == null && vb == null ? 0 : (va == null ? 1 : -1) * dir;
  return va - vb;
};

// dir: 1 asc, -1 desc. `pinned` rows stay on top; ties fall back to `tiebreak`.
export function sortRows(rows, compare, tiebreak, dir, pinned = () => false) {
  return [...rows].sort((a, b) => {
    const pa = pinned(a);
    if (pa !== pinned(b)) return pa ? -1 : 1;
    return (compare(a, b, dir) || tiebreak(a, b, dir)) * dir;
  });
}
