// Rules for the Account list, carried over from the old Count-Frontend account page
// (accountListApi.js / accountLogic.js / accountCSS.css).
import { compareDate, compareText, matchesSearch, matchesStatusChips, sortRows } from "@/components/shared/list/listFormat";

// Role order used when sorting by Role. UPLINE is the old name of SUPPLIER.
export const ROLE_PRIORITY = ["CAPITAL", "BANK", "CASH", "PROFIT", "EXPENSES", "COMPANY", "PARTNER", "STAFF", "SUPPLIER", "AGENT", "MEMBER", "DEBTOR"];

// Badge colours 1:1 from the old accountCSS.css.
export const ROLE_BADGE = {
  CAPITAL: "bg-[#ffe0e0] text-[#a30b0b] border-[#ffa8a8]",
  BANK: "bg-[#dfe3ff] text-[#14228a] border-[#bfc7ff]",
  CASH: "bg-[#dff4e7] text-[#0f6d38] border-[#bbe9cf]",
  PROFIT: "bg-[#fff2c7] text-[#7a5b00] border-[#ffe28a]",
  EXPENSES: "bg-[#f0e1ff] text-[#4f148f] border-[#ddbdfd]",
  COMPANY: "bg-[#ecfccb] text-[#3f6212] border-[#bef264]",
  PARTNER: "bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]",
  STAFF: "bg-[#ffe5cc] text-[#a24700] border-[#ffc58c]",
  SUPPLIER: "bg-[#d6f9ff] text-[#0a6b78] border-[#aef2ff]",
  AGENT: "bg-[#ffe0f3] text-[#a02578] border-[#ffc1e7]",
  MEMBER: "bg-[#f2dfd2] text-[#5f2e0f] border-[#dbb99a]",
  DEBTOR: "bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]",
};
export const ROLE_BADGE_NONE = "bg-[#eceef2] text-[#3e434f] border-[#d6d9e1]";

function normalizeRole(value) {
  const role = String(value || "").trim().toUpperCase();
  return role === "UPLINE" ? "SUPPLIER" : role;
}

// Spring UserListDTO (flat fields) -> table row.
export function normalizeAccountRow(item) {
  return {
    id: item?.id,
    accountId: item?.accountId ?? "",
    name: item?.name ?? "",
    role: normalizeRole(item?.role),
    status: String(item?.status || "active").toLowerCase(),
    paymentAlert: Number(item?.paymentAlert) === 1,
    remark: item?.remark ?? "",
    // Payment Alert settings and the companies the account is in, needed to edit it.
    alertDay: item?.alertDay ?? null,
    alertAmount: item?.alertAmount == null ? null : Number(item.alertAmount),
    alertStartDate: item?.alertSpecificDate ?? null,
    tenantIds: Array.isArray(item?.tenantIds) ? item.tenantIds : [],
    lastLogin: item?.lastLogin ?? null,
    lastLogout: item?.lastLogout ?? null,
  };
}

export function filterAccounts(rows, { search, ...chips }) {
  return rows.filter(
    (a) => matchesSearch([a.accountId, a.name, a.role, a.status, a.remark], search) && matchesStatusChips(a.status, chips)
  );
}

const roleRank = (role) => {
  const i = ROLE_PRIORITY.indexOf(role);
  return i === -1 ? ROLE_PRIORITY.length : i;
};

const COMPARE = {
  accountId: compareText("accountId"),
  name: compareText("name"),
  role: (a, b) => roleRank(a.role) - roleRank(b.role) || a.role.localeCompare(b.role),
  alert: (a, b) => Number(a.paymentAlert) - Number(b.paymentAlert),
  status: compareText("status"),
  lastLogin: compareDate("lastLogin"),
  lastLogout: compareDate("lastLogout"),
  remark: compareText("remark"),
};

// Ties (and the default order) fall back to Account, numbers first: 23, 58, 977, 1039, AG…
export function sortAccounts(rows, key, dir) {
  return sortRows(rows, COMPARE[key] ?? COMPARE.accountId, COMPARE.accountId, dir);
}
