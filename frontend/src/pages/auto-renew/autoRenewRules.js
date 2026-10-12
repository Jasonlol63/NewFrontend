import { addDays, formatDisplayDate, parseIsoDate, toIsoDate } from "@/lib/date";
import { compareText, matchesSearch, sortRows } from "@/components/shared/list/listFormat";

// ===== Renew periods =====
// key: the page's own key; code: what the back end calls it (renewal_period.code); domainKey: its key in the Domain page's
// texts (the Share panel); label: the English name (the pages write it with t(`periods.${key}`)).
export const PERIODS = [
  { key: "7d", code: "7days", label: "7 days", domainKey: "days7" },
  { key: "1m", code: "1month", label: "1 month", domainKey: "month1" },
  { key: "3m", code: "3months", label: "3 months", domainKey: "months3" },
  { key: "6m", code: "6months", label: "6 months", domainKey: "months6" },
  { key: "1y", code: "1year", label: "1 year", domainKey: "year1" },
];

export const periodOf = (key) => PERIODS.find((p) => p.key === key) ?? null;
export const periodCodeOf = (key) => periodOf(key)?.code ?? null;
const periodByCode = (code) => PERIODS.find((p) => p.code === code) ?? null;

// The list price of a period for this row's kind (company / group): the C168 price table, same for every row of a kind.
export const priceOf = (row, periodKey) => {
  const price = row.periodPrices?.[periodKey];
  return price == null ? null : price.toFixed(2);
};

// The price of a row: the price it was approved at, else the list price of the picked period. Never typed in.
export function rowPrice(row) {
  if (!row.periodKey) return null;
  if (row.status !== "pending" && row.price != null) return row.price;
  return row.periodPrices?.[row.periodKey] ?? 0;
}

const todayStart = () => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
};

export const displayDate = (iso) => formatDisplayDate(iso, "-");

// Same as java.time.LocalDate.plusMonths: a day that does not exist in the target month falls back to its last day.
function addMonths(date, months) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), last));
}

// The day a renewal counts from (same rule as the back end): the saved expiry date while it is still ahead, else today.
// "expiry" = continuing from the saved date, "today" = it has lapsed (or lapses today), so the period starts now.
export function startOf(row) {
  const today = todayStart();
  const expiry = parseIsoDate(row.expiry);
  return expiry > today ? { date: toIsoDate(expiry), from: "expiry" } : { date: toIsoDate(today), from: "today" };
}

// The new expiry date, by calendar months / years from startOf(row). A settled row shows the date it was saved with.
// The back end decides with its own clock when the request is approved, so a renewal approved after midnight can differ by a day.
export function newExpiryOf(row, periodKey) {
  if (row.status !== "pending" && row.newExpiry) return row.newExpiry;
  const expiry = parseIsoDate(startOf(row).date);
  switch (periodKey) {
    case "7d":
      return toIsoDate(addDays(expiry, 7));
    case "1m":
      return toIsoDate(addMonths(expiry, 1));
    case "3m":
      return toIsoDate(addMonths(expiry, 3));
    case "6m":
      return toIsoDate(addMonths(expiry, 6));
    case "1y":
      return toIsoDate(addMonths(expiry, 12));
    default:
      return null;
  }
}

const feeKeys = { "7d": "7days", "1m": "1month", "3m": "3months", "6m": "6months", "1y": "1year" };

/** One row of POST /api/auto-renew/list as the page shows it. feeSettings: the response's fee_settings (list price per kind and period). */
export function toRow(r, feeSettings) {
  const kind = r.entity_type === "group" ? "group" : "company";
  const table = (kind === "group" ? feeSettings?.group_period_prices : feeSettings?.company_period_prices) ?? {};
  const periodPrices = {};
  for (const [key, code] of Object.entries(feeKeys)) {
    const value = table[code];
    if (value != null) periodPrices[key] = Number(value);
  }
  return {
    id: r.request_id,
    tenantId: r.tenant_id,
    ownerId: r.owner_id,
    kind,
    company: r.company_code ?? "",
    name: r.owner_name || "-",
    expiry: r.expiration_date,
    newExpiry: r.new_expiration_date ?? null,
    status: r.status,
    periodKey: periodByCode(r.period)?.key ?? null,
    price: r.price != null ? Number(r.price) : null,
    periodPrices,
    canApprove: Boolean(r.can_approve),
    canDelete: Boolean(r.can_delete),
    charge: true,
    departments: { sales: [], cs: [], it: [] },
  };
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

// t: the `autorenew` namespace's t.
export function remainingLabel(days, t) {
  if (days < 0) return t("remaining.expired");
  if (days === 0) return t("remaining.today");
  return t("remaining.left", { days });
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

// ===== Search / sort =====
export function filterAutoRenewRows(rows, { search }) {
  return rows.filter((r) => matchesSearch([r.company, r.name], search));
}

const priceValue = (r) => rowPrice(r) ?? -1;

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
