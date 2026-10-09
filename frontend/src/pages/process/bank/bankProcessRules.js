// Rules for the Bank Process list (Bank companies). The list comes from /api/bank-process/list, one BankProcessDTO per
// process: { id, bankProcess: { dayStart, dayEnd, frequency, supplierPrice, ... }, countryCode, bankName,
// supplierAccountCode, customerAccountCode, companyAccountCode, status, bankBalance, bankBalanceTransactionId, shares }.
import { compareText, matchesSearch, sortRows } from "@/components/shared/list/listFormat";
import { toIsoDate } from "@/lib/date";

export const BANK_LIST_URL = "/api/bank-process/list";
export const BANK_STATUS_URL = "/api/bank-process/update-status";
export const BANK_REMARK_URL = "/api/bank-process/update-remark";
export const BANK_DELETE_URL = "/api/bank-process/delete-bank-process";
export const BANK_COUNTRY_LIST_URL = "/api/bank-country-option/list-country";

const amount = (v) => (v == null || v === "" ? null : Number(v));

// One list row of the API -> the flat row the table, filters and the edit modal work with.
export function normalizeBankRow(dto) {
  const bp = dto?.bankProcess ?? {};
  const id = dto?.id ?? bp.id;
  if (id == null) return null;
  const cost = amount(bp.supplierPrice) ?? 0;
  const price = amount(bp.customerPrice) ?? 0;
  return {
    id,
    tenantId: bp.tenantId,
    countryId: bp.countryId,
    bankOptionId: bp.bankOptionId,
    supplierAccountId: bp.supplierAccountId,
    customerAccountId: bp.customerAccountId,
    companyAccountId: bp.companyAccountId,
    supplier: dto.supplierAccountCode ?? "",
    supplierName: dto.supplierAccountName ?? "",
    customer: dto.customerAccountCode ?? "",
    customerName: dto.customerAccountName ?? "",
    company: dto.companyAccountCode ?? "",
    companyName: dto.companyAccountName ?? "",
    country: dto.countryCode ?? "",
    currency: dto.countryCode ?? "", // the country is the currency
    bank: dto.bankName ?? "",
    cardOwner: bp.cardOwner ?? "",
    cardOwnerType: bp.cardOwnerType ?? "",
    contract: bp.contract ?? "",
    insurance: amount(bp.insurancePrice),
    cost,
    price,
    profit: amount(bp.companyPrice) ?? price - cost,
    frequency: bp.frequency ?? "",
    date: bp.dayStart ?? "",
    dayEnd: bp.dayEnd ?? null,
    dayEndMonthlyCapEnabled: Boolean(bp.dayEndMonthlyCapEnabled),
    sop: bp.sop ?? "",
    remark: bp.remark ?? "",
    status: String(dto.status ?? bp.status ?? "ACTIVE").toUpperCase(),
    bankBalance: amount(dto.bankBalance),
    bankBalanceTransactionId: dto.bankBalanceTransactionId ?? null,
    shares: dto.shares ?? [],
    createdAt: bp.createdAt ?? null,
    createdBy: bp.createdBy ?? "",
    updatedAt: bp.updatedAt ?? null,
    updatedBy: bp.updatedBy ?? "",
  };
}

const money = (key) => (a, b) => (a[key] ?? 0) - (b[key] ?? 0);

const COMPARE = {
  supplier: compareText("supplier"),
  country: compareText("country"),
  bank: compareText("bank"),
  cardOwner: compareText("cardOwner"),
  contract: compareText("contract"),
  insurance: money("insurance"),
  customer: compareText("customer"),
  cost: money("cost"),
  price: money("price"),
  profit: money("profit"),
  status: compareText("status"),
  date: compareText("date"),
};

// Ties (and the default order) fall back to the date, newest first, then the supplier.
const byDefault = (a, b) => b.date.localeCompare(a.date) || COMPARE.supplier(a, b);

export function sortBankProcesses(rows, key, dir) {
  return sortRows(rows, COMPARE[key] ?? byDefault, byDefault, dir);
}

// With no chip ticked the list shows only Active processes. The status chips choose what else to see: each ticked one adds
// its status (Active, Inactive, Official, E-Invoice, Blocked), and "Show All" shows every status, Waiting included.
const CHIP_STATUS = { showActive: "ACTIVE", showInactive: "INACTIVE", showOfficial: "OFFICIAL", showEInvoice: "E_INVOICE", showBlocked: "BLOCK" };

export function filterBankProcesses(rows, { search, ...chips }) {
  const picked = Object.entries(CHIP_STATUS).filter(([key]) => chips[key]).map(([, status]) => status);
  const statusShown = (status) => chips.showAll || (picked.length ? picked.includes(status) : status === "ACTIVE");
  return rows.filter(
    (p) =>
      matchesSearch([p.supplier, p.country, p.bank, p.cardOwner, p.contract, p.customer, p.status, p.date], search) && statusShown(p.status)
  );
}

// Badge colours of the statuses (the old page's: green, red, amber, orange, dark), softened to the system's badge look.
// className: the tinted badge; text: just the colour, for the unselected rows of the status picker.
export const BANK_STATUS_BADGE = {
  WAITING: { label: "WAITING", className: "bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]", text: "text-[#0369a1]" },
  ACTIVE: { label: "ACTIVE", className: "bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]", text: "text-[#15803d]" },
  INACTIVE: { label: "INACTIVE", className: "bg-[#fee2e2] text-[#b91c1c] border-[#fecaca]", text: "text-[#b91c1c]" },
  OFFICIAL: { label: "OFFICIAL", className: "bg-[#fef3c7] text-[#b45309] border-[#fde68a]", text: "text-[#b45309]" },
  E_INVOICE: { label: "E-INVOICE", className: "bg-[#ffedd5] text-[#c2410c] border-[#fed7aa]", text: "text-[#c2410c]" },
  BLOCK: { label: "BLOCK", className: "bg-[#e5e7eb] text-[#1f2937] border-[#d1d5db]", text: "text-[#1f2937]" },
};

// What the user can set from the status picker. WAITING is set by the system, so it is only ever shown.
export const BANK_PICKABLE_STATUSES = ["ACTIVE", "INACTIVE", "OFFICIAL", "E_INVOICE", "BLOCK"];

// In these statuses the backend freezes the billing fields (it saves only SOP, Remark and Insurance) and refuses to delete the
// Bank Balance: change the status first for anything more.
const LOCKED_STATUSES = ["OFFICIAL", "E_INVOICE", "BLOCK"];
export const isBankLocked = (p) => LOCKED_STATUSES.includes(p.status);
// Official, E-Invoice and Block: Edit still opens, but the backend keeps the billing fields (dates, frequency, contract, prices, accounts, profit sharing) and only saves SOP, Remark and Insurance.
export const LOCKED_EDIT_TITLE = "Billing fields are locked in this status; only SOP, Remark and Insurance can be changed";

// A contract ends on its Day End. Only 1st of Every Month and Monthly have one; Once, Daily and Weekly never run out.
export function isContractExpired(p, today = new Date()) {
  return Boolean(p.dayEnd) && p.dayEnd < toIsoDate(today);
}

// yyyy-mm-dd, or "" when the contract has no end (what the edit modal shows in Day End).
export function contractEndDate(p) {
  return p.dayEnd ?? "";
}

export const formatMoney = (n) => (n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
