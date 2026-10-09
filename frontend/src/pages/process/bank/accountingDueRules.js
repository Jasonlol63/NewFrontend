// Rules for Accounting Due (Bank Process). The bills come from /api/bank-process/accounting-due/inbox, one
// AccountingDueDTO per bill, computed by the backend from each process's schedule: { bankProcessId, postedDate,
// periodType, billingStart, billingEnd, cardOwner, bankName, frequency, dayStart, contract, ... }. "Early" is anything
// whose billing (posted) date is still in the future: the user can post or delete those ahead of time.
import { addDays, toIsoDate } from "@/lib/date";
import { FREQUENCIES, contractLabel } from "./bankFormRules";

export const DUE_INBOX_URL = "/api/bank-process/accounting-due/inbox";
export const DUE_POST_URL = "/api/bank-process/accounting-due/post";
export const DUE_SKIP_URL = "/api/bank-process/accounting-due/skip";

export const todayIso = () => toIsoDate(new Date());

// Year End of this year (the default of the Early transaction date; the backend allows today up to this day).
export const yearEndIso = () => `${new Date().getFullYear()}-12-31`;

// Quick picks for the Early transaction date.
export function earlyDatePresets() {
  const now = new Date();
  return [
    { label: "Today", value: toIsoDate(now) },
    { label: "+1 Week", value: toIsoDate(addDays(now, 7)) },
    { label: "+2 Weeks", value: toIsoDate(addDays(now, 14)) },
    { label: "+1 Month", value: toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())) },
    { label: "Year End", value: yearEndIso() },
  ];
}

const FREQUENCY_LABEL = Object.fromEntries(FREQUENCIES.map((f) => [f.value, f.label]));

// One inbox row -> the flat bill the table works with. `raw` is the row as the backend sent it: Post and Delete send it
// back unchanged, because the backend finds the period by bankProcessId + postedDate + periodType.
export function normalizeDue(dto) {
  if (!dto?.bankProcessId || !dto.postedDate) return null;
  return {
    id: `${dto.bankProcessId}|${dto.postedDate}|${dto.periodType}`,
    cardOwner: dto.cardOwner ?? "",
    bank: dto.bankName ?? "",
    frequency: FREQUENCY_LABEL[dto.frequency] ?? dto.frequency ?? "",
    contract: contractLabel(dto.contract ?? ""),
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
