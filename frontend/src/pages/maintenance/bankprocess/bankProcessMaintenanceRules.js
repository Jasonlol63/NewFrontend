import { formatAmount } from "@/pages/report/shared/reportFormat";
import { deletedByText } from "../shared/maintenanceFormat";

export const BANK_PROCESS_LIST_URL = "/api/maintenance/bankprocess-maintenance/list";
export const BANK_PROCESS_DELETE_URL = "/api/maintenance/bankprocess-maintenance/delete";

// currency "ALL" = every currency (the API reads an empty list as no filter).
export function buildBankProcessRequest({ tenantId, dateFrom, dateTo, currency }) {
  return { tenantId, dateFrom, dateTo, currencyCodes: currency === "ALL" ? [] : [currency] };
}

// Live and archived rows can share a transaction id, so the row id carries which one it is;
// `transactionId` is what the delete request wants.
export function normalizeBankProcessRow(raw) {
  const text = (v) => String(v ?? "").trim();
  const deleted = Boolean(raw.deleted);
  return {
    id: `${deleted ? "d" : "l"}${raw.id}`,
    transactionId: raw.id,
    deleted,
    createdAt: raw.createdAt ?? "",
    account: text(raw.toAccountCode),
    from: text(raw.fromAccountCode),
    amount: `${text(raw.currencyCode)} ${formatAmount(raw.amount)}`.trim(),
    description: text(raw.description),
    remark: text(raw.remark),
    createdBy: text(raw.createdBy),
    deletedBy: deletedByText(raw.deletedBy, raw.deletedAt),
  };
}

export function filterBankProcessRows(rows, search) {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) =>
    [r.account, r.from, r.description, r.remark, r.createdBy, r.deletedBy].some((v) => v.toLowerCase().includes(q))
  );
}
