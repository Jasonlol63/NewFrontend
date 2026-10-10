import { parseIsoDate, toIsoDate } from "@/lib/date";

export const PENDING_URL = "/api/pending";
export const APPROVE_URL = "/api/approved";
export const REJECT_URL = "/api/rejected";

// Only these roles see the Contra Inbox (the backend's requireContraInboxApprover is the real gate).
const APPROVER_ROLES = new Set(["owner", "admin", "manager"]);
export const canApproveContra = (user) => Boolean(user) && !user.readOnly && APPROVER_ROLES.has(user.role);

// A backdated entry older than this many days is flagged red.
export const OLD_AFTER_DAYS = 7;

// The Type chip colours (bg, text). An unknown type falls back to grey.
const TYPE_TONES = {
  CONTRA: ["#eeedfe", "#3c3489"],
  PAYMENT: ["#e6f1fb", "#0c447c"],
  CLAIM: ["#faeeda", "#633806"],
  CLEAR: ["#e1f5ee", "#085041"],
  RATE: ["#eaf3de", "#27500a"],
  ADJUSTMENT: ["#f1efe8", "#444441"],
  PROFIT: ["#fbeaf0", "#72243e"],
};
export const typeTone = (type) => TYPE_TONES[type] ?? ["#f1efe8", "#444441"];
export const typeLabel = (type) => (type ? type[0] + type.slice(1).toLowerCase() : "");

// "2026-10-09T14:32:10" (or Jackson's [y, m, d, h, mi, s] array) -> "09/10 14:32".
function shortStamp(value) {
  const parts = Array.isArray(value)
    ? value.map((n) => String(n).padStart(2, "0"))
    : String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)?.slice(1);
  return parts ? `${parts[2]}/${parts[1]} ${parts[3]}:${parts[4]}` : "";
}

const isoOf = (value) => (Array.isArray(value) ? value.slice(0, 3).map((n) => String(n).padStart(2, "0")).join("-") : (value ?? ""));

export function normalizePending(dto) {
  if (!dto?.id || !dto.transactionDate) return null;
  return {
    id: dto.id,
    type: dto.transactionType ?? "",
    date: isoOf(dto.transactionDate),
    from: dto.fromAccountCode ?? "",
    to: dto.toAccountCode ?? "",
    amount: Number(dto.amount) || 0,
    currency: dto.currencyCode ?? "",
    description: dto.description ?? "",
    remark: dto.remark ?? "",
    submittedBy: dto.createdBy ?? "",
    submittedAt: shortStamp(dto.createdAt),
  };
}

// Oldest transaction date first (the most overdue on top).
export const sortPending = (rows) => [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));

// How many days before today the transaction date is.
export function daysBack(dateIso, today = new Date()) {
  const base = parseIsoDate(toIsoDate(today));
  return Math.max(0, Math.round((base - parseIsoDate(dateIso)) / 86400000));
}

export const money = (n) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// [[currency, total], ...] in the order the currencies first appear.
export function totalsByCurrency(rows) {
  const totals = new Map();
  rows.forEach((r) => totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.amount));
  return [...totals];
}

export const rowLabel = (r) => `${typeLabel(r.type)} ${r.from || "—"} → ${r.to || "—"} · ${r.currency} ${money(r.amount)}`;
