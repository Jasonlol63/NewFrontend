// Local-date helpers (never toISOString, which shifts the day in UTC+8).

export function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// "2026-09-01" -> "01/09/2026" (sep "/") or "01-09-2026" (sep "-")
export function formatDisplayDate(iso, sep = "/") {
  return iso ? iso.split("-").reverse().join(sep) : "";
}

export function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function currentMonthRange(today = new Date()) {
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}
