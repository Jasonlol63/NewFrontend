// Rules for Accounting Due (Bank Process). UI only for now: the bills below are sample data, dated around today,
// until the backend list is wired up. The backend decides when each bill is generated; "early" is anything whose
// billing date is still in the future (the user can post or delete those ahead of time).
import { addDays, toIsoDate } from "@/lib/date";

export const todayIso = () => toIsoDate(new Date());

// Year End of this year (the default of the Early transaction date).
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

// [card owner, bank, frequency, contract, days since start, days from today to billing]
const SAMPLE = [
  ["ORBIT TRADING SDN BHD", "OCBC", "Monthly", "6 MONTHS", 190, -6],
  ["KOPI HARVEST ENTERPRISE", "CIMB", "Monthly", "3 MONTHS", 95, -3],
  ["BROOM BLOOM PTE. LTD.", "MARI", "Monthly", "3 MONTHS", 63, -2],
  ["LIANG FISHING SDN BHD", "MBB", "Monthly", "6 MONTHS", 52, 8],
  ["LIANG FISHING SDN BHD", "CIMB", "Monthly", "6 MONTHS", 52, 8],
  ["GROWTH VAULT SG PTE LTD", "MAYBANK", "Monthly", "3 MONTHS", 2, 28],
  ["LIANG FISHING SDN BHD", "RHB", "1st of Every Month", "6 MONTHS", 31, 24],
  ["AD VERIZON PRIVATE LIMITED", "OCBC", "Monthly", "2 MONTHS", 32, 28],
  ["LIANG FISHING SDN BHD", "MBB", "Monthly", "6 MONTHS", 52, 39],
  ["DIONNE TECH EMPORIUM", "GXS", "1st of Every Month", "2 MONTHS", 190, 24],
  ["GROWTH VAULT SG PTE LTD", "MAYBANK", "Monthly", "3 MONTHS", 2, 58],
  ["LIANG FISHING SDN BHD", "RHB", "1st of Every Month", "6 MONTHS", 31, 54],
  ["AD VERIZON PRIVATE LIMITED", "OCBC", "Monthly", "2 MONTHS", 32, 58],
  ["LIANG FISHING SDN BHD", "CIMB", "Monthly", "6 MONTHS", 52, 69],
  ["DIONNE TECH EMPORIUM", "GXS", "1st of Every Month", "2 MONTHS", 190, 54],
];

export function sampleAccountingDue() {
  const now = new Date();
  return SAMPLE.map(([cardOwner, bank, frequency, contract, sinceStart, toBilling], i) => ({
    id: i + 1,
    cardOwner,
    bank,
    frequency,
    contract,
    startDate: toIsoDate(addDays(now, -sinceStart)),
    billingDate: toIsoDate(addDays(now, toBilling)),
  }));
}

// What the list button shows: bills already due (not the early ones).
export const dueNowCount = (bills = sampleAccountingDue()) => bills.filter((b) => b.billingDate <= todayIso()).length;

export const isEarlyBill = (bill) => bill.billingDate > todayIso();

// The bills shown for an early transaction date, in billing order.
export const visibleBills = (bills, earlyDate) =>
  bills.filter((b) => b.billingDate <= earlyDate).sort((a, b) => (a.billingDate < b.billingDate ? -1 : a.billingDate > b.billingDate ? 1 : a.id - b.id));
