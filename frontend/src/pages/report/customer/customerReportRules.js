export const CUSTOMER_REPORT_URL = "/api/report/customer-report/list";

// One account row of the Spring CustomerReportDTO list.
export function normalizeCustomerRow(raw) {
  const accountCode = String(raw.accountCode ?? "").trim().toUpperCase();
  const currency = String(raw.currencyCode ?? "").trim().toUpperCase();
  return {
    id: raw.accountRowId ?? `${accountCode}|${currency}`,
    accountCode,
    name: String(raw.accountName ?? "").trim().toUpperCase(),
    currency: currency || "-",
    win: raw.winAmount,
    lose: raw.loseAmount,
  };
}

// accountId "" = All Accounts. showAll keeps the rows whose Win and Lose are both 0.
export function buildCustomerRequest({ tenantId, dateFrom, dateTo, accountId, currency, showAll }) {
  return {
    tenantId,
    dateFrom,
    dateTo,
    accountId: accountId === "" ? null : Number(accountId),
    currencyCodes: [currency],
    showAll,
  };
}

// Account dropdown: All Accounts first, then the tenant's accounts by code.
export function accountOptions(accounts) {
  const sorted = [...accounts].sort((a, b) => a.accountId.localeCompare(b.accountId, undefined, { numeric: true }));
  return [
    { value: "", label: "All Accounts" },
    ...sorted.map((a) => ({ value: a.id, label: `${a.accountId} - ${a.name}` })),
  ];
}
