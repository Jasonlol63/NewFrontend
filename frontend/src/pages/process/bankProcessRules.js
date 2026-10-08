// Rules for the Bank Process list (Bank companies). UI only for now: the rows below are sample
// data until the Bank Process API is wired up; the row shape is what the list needs.
import { compareText, matchesSearch, sortRows } from "@/components/shared/list/listFormat";

// Currency chips of the filter row (Dashboard style: "All" first, the rest draggable).
export const BANK_CURRENCIES = ["MYR", "SGD", "AUD", "USDT", "IDR"];

const row = (id, supplier, country, bank, cardOwner, contract, insurance, customer, cost, price, date, flags = {}) => ({
  id,
  supplier,
  country,
  currency: country,
  bank,
  cardOwner,
  contract,
  insurance,
  customer,
  cost,
  price,
  profit: price - cost,
  status: "ACTIVE",
  date,
  createdAt: date + " 11:01:31",
  createdBy: "SH",
  updatedAt: null,
  updatedBy: "",
  ...flags,
});

export const SAMPLE_BANK_PROCESSES = [
  row(1, "BS003", "MYR", "CIMB (BUSINESS)", "LIANG FISHING SDN BHD", "6 MONTHS", 100000, "BC028", 2250, 2450, "2026-08-17", { status: "OFFICIAL" }),
  row(2, "BS003", "MYR", "MBB (BUSINESS)", "LIANG FISHING SDN BHD", "6 MONTHS", 100000, "BC028", 2250, 2450, "2026-08-17"),
  row(3, "BS003", "MYR", "RHB (BUSINESS)", "LIANG FISHING SDN BHD", "6 MONTHS", 100000, "BS001", 2250, 2625, "2026-09-07", { status: "E_INVOICE" }),
  row(4, "BS005", "SGD", "OCBC (BUSINESS)", "AD VERIZON PRIVATE LIMITED", "2 MONTHS", 10000, "BC015", 2500, 3200, "2026-06-06"),
  row(5, "BS005", "SGD", "MAYBANK (BUSINESS)", "GROWTH VAULT SG PTE LTD", "3 MONTHS", 10000, "BA020", 3150, 3900, "2026-10-06"),
  row(6, "BS007", "MYR", "PUBLIC BANK (BUSINESS)", "SEA HARVEST TRADING SDN BHD", "12 MONTHS", 50000, "BC031", 1800, 2300, "2026-07-21"),
  row(7, "BS007", "SGD", "UOB (BUSINESS)", "ORCHID LINK PTE LTD", "3 MONTHS", 20000, "BC044", 2900, 3500, "2026-06-12", { status: "INACTIVE" }),
  row(8, "BS009", "AUD", "ANZ (BUSINESS)", "SOUTHERN CROSS HOLDINGS PTY LTD", "3 MONTHS", 15000, "BA051", 3300, 4100, "2026-09-25", { status: "BLOCK" }),
  row(9, "BS011", "MYR", "HLB (BUSINESS)", "BAYU LOGISTICS SDN BHD", "1 MONTH", 8000, "BC060", 1500, 1900, "2026-08-02", { status: "WAITING" }),
];

const money = (key) => (a, b) => a[key] - b[key];

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

// The status chips narrow the list to those statuses; with none ticked every row shows except Inactive.
const CHIP_STATUS = { showActive: "ACTIVE", showInactive: "INACTIVE", showOfficial: "OFFICIAL", showEInvoice: "E_INVOICE", showBlocked: "BLOCK" };

export function filterBankProcesses(rows, { search, ...chips }) {
  const picked = Object.entries(CHIP_STATUS).filter(([key]) => chips[key]).map(([, status]) => status);
  return rows.filter(
    (p) =>
      matchesSearch([p.supplier, p.country, p.bank, p.cardOwner, p.contract, p.customer, p.status, p.date], search) &&
      (picked.length ? picked.includes(p.status) : p.status !== "INACTIVE")
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

// A contract runs from the process date for its number of months; once that is over it is expired.
// (Sample logic for the draft: the real answer comes from the backend.)
function contractEnd(p) {
  const months = Number(/(\d+)/.exec(p.contract)?.[1] ?? 0);
  const [y, m, d] = p.date.split("-").map(Number);
  return new Date(y, m - 1 + months, d);
}

export function isContractExpired(p, today = new Date()) {
  return contractEnd(p) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

// yyyy-mm-dd
export function contractEndDate(p) {
  const e = contractEnd(p);
  const pad = (n) => String(n).padStart(2, "0");
  return e.getFullYear() + "-" + pad(e.getMonth() + 1) + "-" + pad(e.getDate());
}

export const formatMoney = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
