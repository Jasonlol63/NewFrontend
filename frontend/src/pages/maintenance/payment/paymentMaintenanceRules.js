import { formatAmount } from "@/pages/report/shared/reportFormat";
import { deletedByText } from "../shared/maintenanceFormat";

export const PAYMENT_LIST_URL = "/api/maintenance/payment-maintenance/list";
export const PAYMENT_DELETE_URL = "/api/maintenance/payment-maintenance/delete";

// Transaction types the Payment Maintenance API accepts ("" = all of them).
export const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  ...["PAYMENT", "CLAIM", "CLEAR", "CONTRA", "RATE", "ADJUSTMENT", "PROFIT"].map((t) => ({ value: t, label: t })),
];

// currency "ALL" = every currency (the API reads an empty list as no filter).
export function buildPaymentRequest({ tenantId, dateFrom, dateTo, type, currency }) {
  return {
    tenantId,
    dateFrom,
    dateTo,
    transactionType: type || null,
    currencyCodes: currency === "ALL" ? [] : [currency],
  };
}

// Live and archived rows can share a transaction id, so the row id carries which one it is;
// `transactionId` is what the delete request wants.
export function normalizePaymentRow(raw) {
  const text = (v) => String(v ?? "").trim();
  const deleted = Boolean(raw.deleted);
  return {
    id: `${deleted ? "d" : "l"}${raw.id}`,
    transactionId: raw.id,
    deleted,
    createdAt: raw.createdAt ?? "",
    toAccount: text(raw.toAccountCode),
    fromAccount: text(raw.fromAccountCode),
    amount: `${text(raw.currencyCode)} ${formatAmount(raw.amount)}`.trim(),
    description: text(raw.description),
    remark: text(raw.remark),
    createdBy: text(raw.createdBy),
    deletedBy: deletedByText(raw.deletedBy, raw.deletedAt),
  };
}

export function filterPaymentRows(rows, search) {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) =>
    [r.toAccount, r.fromAccount, r.description, r.remark, r.createdBy, r.deletedBy].some((v) => v.toLowerCase().includes(q))
  );
}
