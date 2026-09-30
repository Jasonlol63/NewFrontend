import { parseIsoDate, toIsoDate } from "@/lib/date";

export const CURRENCY_COLORS = {
  MYR: "#2563eb",
  EUR: "#7c3aed",
  SGD: "#0891b2",
  CNY: "#dc2626",
  USD: "#16a34a",
  NPR: "#6366f1",
  HKD: "#db2777",
  IDR: "#ea580c",
  THB: "#ca8a04",
  AUD: "#059669",
  PGK: "#14b8a6",
  USDT: "#84cc16",
};
const FALLBACK_COLORS = ["#64748b", "#0ea5e9", "#a855f7", "#f43f5e", "#22c55e", "#eab308"];

export function currencyColor(code) {
  if (CURRENCY_COLORS[code]) return CURRENCY_COLORS[code];
  const hash = [...(code || "")].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

const moneyFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return moneyFormat.format(Number(value));
}

export function formatSignedMoney(value) {
  const n = Number(value) || 0;
  return `${n >= 0 ? "+" : ""}${formatMoney(n)}`;
}

export function formatRate(value) {
  if (value == null) return "—";
  const n = Number(value);
  return n === 1 ? "1" : n.toFixed(6);
}

// % change vs the previous period; the sign of the difference decides up/down colouring.
export function periodDelta(current, previous) {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  const diff = cur - prev;
  const pct = prev === 0 ? (cur === 0 ? 0 : 100) : (diff / Math.abs(prev)) * 100;
  return { diff, pct: Math.abs(pct), up: diff >= 0 };
}

// ---- dates ----

export { currentMonthRange, formatDisplayDate, parseIsoDate, toIsoDate } from "@/lib/date";

export function isFullMonth(fromIso, toIso) {
  if (!fromIso || !toIso) return false;
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  const monthEnd = new Date(from.getFullYear(), from.getMonth() + 1, 0);
  return from.getDate() === 1 && toIsoDate(monthEnd) === toIsoDate(to);
}
