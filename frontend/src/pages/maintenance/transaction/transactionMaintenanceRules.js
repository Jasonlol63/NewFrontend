import { formatAmount } from "@/pages/report/shared/reportFormat";

export const TRANSACTION_LIST_URL = "/api/maintenance/transaction-maintenance/list";

// One data_capture_line of the list. Empty text stays "" here; the page shows "-" for it.
export function normalizeTransactionRow(raw) {
  const text = (v) => String(v ?? "").trim();
  return {
    id: String(raw.id),
    createdAt: raw.dtsCreated ?? "",
    process: text(raw.process),
    idProduct: text(raw.idProduct),
    account: text(raw.account),
    description: text(raw.description),
    remark: text(raw.remark),
    percent: text(raw.percent),
    currency: text(raw.currency),
    rate: text(raw.rate),
    cr: formatAmount(raw.cr),
    dr: formatAmount(raw.dr),
    createdBy: text(raw.createdBy),
  };
}
