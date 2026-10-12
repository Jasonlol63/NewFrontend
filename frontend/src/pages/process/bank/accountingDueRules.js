// Rules for Accounting Due (Bank Process). The bills come from /api/bank-process/accounting-due/inbox, one
// AccountingDueDTO per bill, computed by the backend from each process's schedule: { bankProcessId, postedDate,
// periodType, billingStart, billingEnd, cardOwner, bankName, frequency, dayStart, contract, ... }. "Early" is anything
// whose billing (posted) date is still in the future: the user can post or delete those ahead of time.
import { addDays, toIsoDate } from "@/lib/date";

export const DUE_INBOX_URL = "/api/bank-process/accounting-due/inbox";
export const DUE_POST_URL = "/api/bank-process/accounting-due/post";
export const DUE_SKIP_URL = "/api/bank-process/accounting-due/skip";

export const todayIso = () => toIsoDate(new Date());

// Year End of this year (the last Early transaction date the backend allows; the default is today, so no early bills show).
export const yearEndIso = () => `${new Date().getFullYear()}-12-31`;

// Quick picks for the Early transaction date.
export function earlyDatePresets() {
  const now = new Date();
  return [
    { key: "today", value: toIsoDate(now) },
    { key: "week1", value: toIsoDate(addDays(now, 7)) },
    { key: "week2", value: toIsoDate(addDays(now, 14)) },
    { key: "month1", value: toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())) },
    { key: "yearEnd", value: yearEndIso() },
  ];
}

// One inbox row -> the flat bill the table works with. `raw` is the row as the backend sent it: Post and Delete send it
// back unchanged, because the backend finds the period by bankProcessId + postedDate + periodType.
export function normalizeDue(dto) {
  if (!dto?.bankProcessId || !dto.postedDate) return null;
  return {
    id: `${dto.bankProcessId}|${dto.postedDate}|${dto.periodType}`,
    cardOwner: dto.cardOwner ?? "",
    bank: dto.bankName ?? "",
    frequency: dto.frequency ?? "", // the back end's key; shown through the `process:bank.frequency` texts
    contract: dto.contract ?? "", // shown through contractLabel()
    startDate: dto.dayStart ?? dto.postedDate,
    billingDate: dto.postedDate,
    raw: dto,
  };
}

export const isEarlyBill = (bill) => bill.billingDate > todayIso();

// The bills in billing order (the backend already limits them to the Early transaction date).
export const sortBills = (bills) =>
  [...bills].sort((a, b) => (a.billingDate < b.billingDate ? -1 : a.billingDate > b.billingDate ? 1 : a.id < b.id ? -1 : 1));

// What the list button shows: bills already due (not the early ones).
export const dueNowCount = (bills) => bills.filter((b) => !isEarlyBill(b)).length;
