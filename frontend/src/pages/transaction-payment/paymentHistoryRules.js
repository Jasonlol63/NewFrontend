// Payment History: the address the popup is opened with, the request, and the rows of the reply.

import { fmt, toNumber } from "./transactionPaymentRules";

export const HISTORY_URL = "/api/transaction/history";

// Opens the history of one account in its own browser window (a popup window, not a tab), about 85% of the screen and
// centred. Clicking the same account again brings its window to the front instead of opening another one.
// The company, account, period and the currencies shown in the list go along in the address for the history to load with.
export function openPaymentHistory({ account, accountDbId, tenantId, range, currencies }) {
  const w = Math.min(1360, Math.round(window.screen.availWidth * 0.85));
  const h = Math.min(900, Math.round(window.screen.availHeight * 0.85));
  const left = Math.round((window.screen.availWidth - w) / 2);
  const top = Math.round((window.screen.availHeight - h) / 2);
  const query = new URLSearchParams({ tenant: tenantId, id: accountDbId, from: range.from, to: range.to, cur: (currencies ?? []).join(",") });
  const win = window.open(
    `/transaction-payment/history/${encodeURIComponent(account)}?${query}`,
    `payment-history-${tenantId}-${accountDbId}`,
    `popup=yes,width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
  win?.focus();
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The request of the page address, or null when something is missing (the page then goes back to the list). */
export function parseHistoryParams(search) {
  const tenantId = Number(search.get("tenant"));
  const accountId = Number(search.get("id"));
  const dateFrom = search.get("from") ?? "";
  const dateTo = search.get("to") ?? "";
  if (!(tenantId > 0) || !(accountId > 0) || !ISO_DATE.test(dateFrom) || !ISO_DATE.test(dateTo)) return null;
  const currencyCodes = (search.get("cur") ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  return { tenantId, accountId, dateFrom, dateTo, currencyCodes };
}

export function normalizeHistoryRow(dto, index) {
  const text = (value) => String(value ?? "").trim();
  return {
    key: dto.id ?? `${dto.rowType ?? "row"}-${index}`,
    bf: dto.rowType === "bf",
    date: text(dto.date),
    // Data Capture rows carry the Id Product, the others their type; a bank row has none, only its card owner.
    product: text(dto.product) || text(dto.cardOwner),
    currency: text(dto.currency).toUpperCase(),
    rate: text(dto.rate),
    winLoss: toNumber(dto.winLoss) || 0,
    crDr: toNumber(dto.crDr) || 0,
    balance: toNumber(dto.balance) || 0,
    description: text(dto.description),
    remark: text(dto.remark),
    createdBy: text(dto.createdBy),
  };
}

// Win/Loss and Cr/Dr show a dash for 0.00; the Balance always shows its figure.
export const flowAmount = (n) => (Math.round(n * 100) === 0 ? "-" : fmt(n));

// "0.30000000" -> "0.3" (at most 6 decimals, cut not rounded); "/3" and other expressions stay as they are.
export function formatRate(rate) {
  if (!rate || rate === "-") return "-";
  if (!/^-?\d+(\.\d+)?$/.test(rate)) return rate;
  const [whole, decimals = ""] = rate.split(".");
  const kept = decimals.slice(0, 6).replace(/0+$/, "");
  return kept ? `${whole}.${kept}` : whole;
}

// The Balance of the last row of every currency, in the order the currencies first appear.
export function closingBalances(rows) {
  const last = new Map();
  rows.forEach((r) => last.set(r.currency, r.balance));
  return [...last];
}
