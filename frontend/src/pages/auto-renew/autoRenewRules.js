import { addDays, formatDisplayDate, parseIsoDate, toIsoDate } from "@/lib/date";
import { compareText, matchesSearch, sortRows } from "@/components/shared/list/listFormat";

// ===== Renew periods =====
// `rate` only prices the placeholder rows (price = basePrice x rate); the real prices come with the API.
export const PERIODS = [
  { key: "7d", label: "7 days", days: 7, rate: 0.03 },
  { key: "1m", label: "1 month", days: 30, rate: 0.1 },
  { key: "3m", label: "3 months", days: 91, rate: 0.25 },
  { key: "6m", label: "6 months", days: 182, rate: 0.5 },
  { key: "1y", label: "1 year", days: 365, rate: 1 },
];

export const periodOf = (key) => PERIODS.find((p) => p.key === key) ?? null;

export const priceOf = (row, periodKey) => {
  const period = periodOf(periodKey);
  return period ? (row.basePrice * period.rate).toFixed(2) : null;
};

const todayStart = () => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
};

export const displayDate = (iso) => formatDisplayDate(iso, "-");

// A renewal runs on from the expiry date, or from today when it has already lapsed.
export function newExpiryOf(row, periodKey) {
  const period = periodOf(periodKey);
  if (!period) return null;
  const expiry = parseIsoDate(row.expiry);
  const from = expiry > todayStart() ? expiry : todayStart();
  return toIsoDate(addDays(from, period.days));
}

// ===== Remaining =====
export function remainingDays(expiryIso) {
  return Math.round((parseIsoDate(expiryIso) - todayStart()) / 86400000);
}

// Only rows within 30 days of expiry are listed, so four steps: expired / 7 / 15 / 30 days.
export function remainingTier(days) {
  if (days <= 0) return "expired";
  if (days <= 7) return "d7";
  if (days <= 15) return "d15";
  return "d30";
}

export function remainingLabel(days) {
  if (days < 0) return "Expired";
  if (days === 0) return "Expires today";
  return `${days} days left`;
}

// Soft pastel fills; the closer to expiry, the stronger the tone and the faster the pulse ring.
export const REMAINING_BADGE = {
  expired: {
    badge: "border-[#d93a41] bg-[linear-gradient(180deg,#f08a8e,#dc4c53)] text-white [--glow:rgba(220,76,83,0.42)] animate-renew-ring-0 motion-reduce:animate-none",
    dot: "bg-white animate-renew-dot motion-reduce:animate-none",
  },
  d7: {
    badge: "border-[#ffb9a3] bg-[#ffe1d6] text-[#b0340d] [--glow:rgba(239,90,42,0.38)] animate-renew-ring-7 motion-reduce:animate-none",
    dot: "bg-[#ef5a2a] animate-renew-dot motion-reduce:animate-none",
  },
  d15: {
    badge: "border-[#ffd2a6] bg-[#ffeddb] text-[#a84300] [--glow:rgba(249,115,22,0.3)] animate-renew-ring-15 motion-reduce:animate-none",
    dot: "bg-[#f97316]",
  },
  d30: { badge: "border-[#f3e18b] bg-[#fff7cf] text-[#7a5c00]", dot: "bg-[#eab308]" },
  // Approved / Rejected rows are settled: grey, no pulse.
  settled: { badge: "border-[#d6d9e1] bg-[#eceef2] text-[#6b7280]", dot: "bg-[#9ca3af]" },
};

// ===== Status =====
export const STATUS_BADGE = {
  pending: { label: "Pending", badge: "border-[#aac6ff] bg-[#dfeaff] text-[#0a3fc9]", dot: "bg-[#1f6fe8]" },
  approved: { label: "Approved", badge: "border-[#a7f0c0] bg-[#dcfce7] text-[#13873f]", dot: "bg-[#22c55e]" },
  rejected: { label: "Rejected", badge: "border-[#ffc2cf] bg-[#ffe4ea] text-[#c8304f]", dot: "bg-[#f0506e]" },
};

// Status filter tiles (Show All is teal, Pending takes the Login blue, Approved green, Rejected rose).
export const STATUS_FILTERS = [
  {
    value: "all",
    label: "Show All",
    tile: "bg-[#d9f4fa] text-[#0b86a3]",
    tileOn: "bg-[#0aa5c8] text-white",
    count: "bg-[#d9f4fa] text-[#0b86a3]",
    countOn: "bg-[#0aa5c8] text-white",
    hover: "hover:border-[#0aa5c8]",
    on: "border-[#0aa5c8] shadow-[0_5px_12px_-6px_#0aa5c8,inset_0_0_0_1px_#0aa5c8]",
  },
  {
    value: "pending",
    label: "Pending",
    tile: "bg-[#dfeaff] text-[#0a3fc9]",
    tileOn: "bg-brand-sweep text-white",
    count: "bg-[#dfeaff] text-[#0a3fc9]",
    countOn: "bg-brand-sweep text-white",
    hover: "hover:border-[#1f6fe8]",
    on: "border-[#1f6fe8] shadow-[0_5px_12px_-6px_#1f6fe8,inset_0_0_0_1px_#1f6fe8]",
  },
  {
    value: "approved",
    label: "Approved",
    tile: "bg-[#dcfce7] text-[#16a34a]",
    tileOn: "bg-[#22c55e] text-white",
    count: "bg-[#dcfce7] text-[#16a34a]",
    countOn: "bg-[#22c55e] text-white",
    hover: "hover:border-[#22c55e]",
    on: "border-[#22c55e] shadow-[0_5px_12px_-6px_#22c55e,inset_0_0_0_1px_#22c55e]",
  },
  {
    value: "rejected",
    label: "Rejected",
    tile: "bg-[#ffe4ea] text-[#d63a58]",
    tileOn: "bg-[#f0506e] text-white",
    count: "bg-[#ffe4ea] text-[#d63a58]",
    countOn: "bg-[#f0506e] text-white",
    hover: "hover:border-[#f0506e]",
    on: "border-[#f0506e] shadow-[0_5px_12px_-6px_#f0506e,inset_0_0_0_1px_#f0506e]",
  },
];

export function statusCounts(rows) {
  const counts = { all: rows.length, pending: 0, approved: 0, rejected: 0 };
  rows.forEach((r) => {
    counts[r.status] += 1;
  });
  return counts;
}

// ===== Placeholder rows (design preview): expiry dates are relative to today so every step shows =====
export function buildMockRows() {
  const day = (n) => toIsoDate(addDays(todayStart(), n));
  const row = (id, kind, company, name, offset, basePrice, extra = {}) => ({
    id,
    kind,
    company,
    name,
    expiry: day(offset),
    basePrice,
    charge: true,
    comm: false,
    status: "pending",
    periodKey: null,
    ...extra,
  });
  return [
    row("c1", "company", "ASIA", "-", -3, 2400),
    row("c2", "company", "GT", "-", -7, 1200),
    row("c3", "company", "1039", "IT01 KUNZZ", 0, 2400, { charge: false, comm: true }),
    row("c4", "company", "BK1", "IT01 KUNZZ", 5, 3000, { comm: true }),
    row("c5", "company", "AJ", "-", 7, 600),
    row("c6", "company", "MK7", "-", 12, 1800),
    row("c7", "company", "XY3", "-", 15, 1500),
    row("c8", "company", "PL5", "-", 22, 900),
    row("c9", "company", "RT8", "-", 30, 2100, { charge: false }),
    row("c10", "company", "ZX9", "-", 22, 2400, { comm: true, status: "approved", periodKey: "1y" }),
    row("c11", "company", "QW2", "-", 7, 1200, { charge: false, status: "rejected", periodKey: "6m" }),
    row("g1", "group", "GRP01", "-", 4, 5000, { comm: true }),
  ];
}

// ===== Search / sort =====
export function filterAutoRenewRows(rows, { search }) {
  return rows.filter((r) => matchesSearch([r.company, r.name], search));
}

const priceValue = (r) => (r.periodKey ? r.basePrice * periodOf(r.periodKey).rate : -1);

const COMPARE = {
  company: compareText("company"),
  name: compareText("name"),
  expiry: (a, b) => a.expiry.localeCompare(b.expiry),
  price: (a, b) => priceValue(a) - priceValue(b),
};
COMPARE.remaining = COMPARE.expiry;

// Ties (and the default order) fall back to the soonest expiry.
export function sortAutoRenewRows(rows, key, dir) {
  return sortRows(rows, COMPARE[key] ?? COMPARE.expiry, COMPARE.expiry, dir);
}
