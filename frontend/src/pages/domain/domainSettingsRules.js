import { addDays, parseIsoDate, toIsoDate } from "@/lib/date";
import { NO_EXPIRY, PERMANENT_EXPIRY, PRICE_PERIODS, formatExpiry } from "./domainRules";

// Rules of the Company Settings / Group Settings dialog (the Set button of a company or group).
//
// Share: the Company / Group price of the picked period is 100%. Sales, CS and IT each take part of it
// (accounts with an amount and a percentage); Profit, always C168, is what is left. The Share switch is also the
// "Charge on Save" switch: when it is on, saving the domain posts the domain fee and the commissions to the C168 ledger.

export const DEPARTMENTS = [
  { key: "sales", label: "Sales", color: "#0ea5e9" },
  { key: "cs", label: "CS", color: "#16a34a" },
  { key: "it", label: "IT", color: "#7c3aed" },
];

// One company type (category) per company; the back end calls them feature modules. A group has none (it defaults to Games).
export const COMPANY_TYPES = ["Games", "Bank", "Loan", "Rate", "Money"];
const MODULE_IDS = { Games: 1, Bank: 2, Loan: 3, Rate: 4, Money: 5 };
export const PROFIT_ACCOUNT = "C168";
// The back end also accepts an account called PROFIT when C168 itself was renamed.
const PROFIT_ACCOUNT_CODES = [PROFIT_ACCOUNT, "PROFIT"];

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Up to 2 decimals; anything else the user types or pastes is ignored.
export const AMOUNT_PATTERN = /^\d*(\.\d{0,2})?$/;

let rowSeq = 0;
export const newRowId = () => `row${++rowSeq}`;

export const periodOf = (key) => PRICE_PERIODS.find((p) => p.key === key) ?? null;

/** The starting values: nothing picked, Games, Share off. `currentExpiry` is the date already saved ("" for a new one). */
export function buildSettings(kind) {
  return {
    startDate: toIsoDate(new Date()),
    period: null,
    currentExpiry: "",
    type: kind === "company" ? COMPANY_TYPES[0] : "",
    shareOn: false,
    departments: { sales: [], cs: [], it: [] },
  };
}

/**
 * The starting values for a group / company that is already saved: its expiry, company type and share rows. The back end
 * keeps no start date or period (only the expiry date) and never keeps the Share switch, so those start empty / off.
 * item: a domainRules.toDomains tenant; accounts: [{ id, code }].
 */
export function settingsFromTenant(kind, item, accounts) {
  const codeById = new Map(accounts.map((a) => [a.id, a.code]));
  const departments = { sales: [], cs: [], it: [] };
  for (const row of item.shares) {
    const key = String(row.shareType ?? "").toLowerCase();
    const account = codeById.get(row.accountId);
    if (departments[key] && account) departments[key].push({ id: newRowId(), account, pct: Number(row.percentage) || 0 });
  }
  const moduleId = item.modules.find((m) => Object.values(MODULE_IDS).includes(m.id))?.id;
  const type = Object.keys(MODULE_IDS).find((name) => MODULE_IDS[name] === moduleId) ?? COMPANY_TYPES[0];
  return { ...buildSettings(kind), currentExpiry: item.expiry, type: kind === "company" ? type : "", departments };
}

/** The price (100%) of a kind ("company" | "group") for a period, from the Price dialog's amounts. */
export function priceFor(prices, kind, periodKey) {
  if (!periodKey) return 0;
  const value = Number(prices?.[kind]?.[periodKey]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** The expiry date (yyyy-mm-dd) these settings give: No Expiry, start date + period, or the date saved before; "" if none. */
export function expiryIsoOf(settings) {
  if (settings.period === NO_EXPIRY) return PERMANENT_EXPIRY;
  const period = periodOf(settings.period);
  if (period && settings.startDate) return toIsoDate(addDays(parseIsoDate(settings.startDate), period.days));
  return settings.currentExpiry || "";
}

/** The same as dd-mm-yyyy ("No Expiry" for the permanent date); "" when there is none. */
export const expiryOf = (settings) => formatExpiry(expiryIsoOf(settings));

export const amountOf = (price, pct) => round2((price * pct) / 100);
export const pctOf = (price, amount) => (price > 0 ? (amount / price) * 100 : 0);

/**
 * What every row of the Share panel shows.
 *  - departments: { [key]: { pct, amount, count } }
 *  - profit: { pct, amount } = what the departments leave of the price
 *  - over: the departments take more than the price
 *  - incomplete: a row has no account yet
 */
export function shareSummary(price, departments) {
  let pctSum = 0;
  let amountSum = 0;
  let incomplete = false;
  const byDepartment = {};
  for (const { key } of DEPARTMENTS) {
    const rows = departments[key];
    const pct = rows.reduce((sum, r) => sum + r.pct, 0);
    const amount = round2(rows.reduce((sum, r) => sum + amountOf(price, r.pct), 0));
    if (rows.some((r) => !r.account)) incomplete = true;
    byDepartment[key] = { pct, amount, count: rows.length };
    pctSum += pct;
    amountSum += amount;
  }
  const profit = { pct: 100 - pctSum, amount: round2(price - amountSum) };
  return { departments: byDepartment, profit, over: round2(pctSum) > 100, incomplete };
}

/** Why Save is blocked (a short sentence), or "" when it can go. */
export function settingsProblem(kind, settings, summary, price) {
  const period = periodOf(settings.period);
  // A tenant that already has an expiry date can be saved without picking a period again.
  if (!settings.period && !settings.currentExpiry) return "Pick a Period";
  if (period && !settings.startDate) return "Pick a Start Date";
  if (kind === "company" && !settings.type) return "Pick a company type";
  if (settings.shareOn) {
    if (!period) return "Pick a Period to charge the share";
    if (price <= 0) return "Set the price of this period first (Price)";
    if (summary.incomplete) return "Choose an account for every share row";
    if (summary.over) return "The share is over 100%";
  }
  return "";
}

/** The same total spread evenly over the rows (the last row takes the rounding). */
export function splitEqually(rows) {
  const total = rows.reduce((sum, r) => sum + r.pct, 0);
  if (!rows.length || total <= 0) return rows;
  const each = Math.floor((total / rows.length) * 100) / 100;
  const lastPct = round2(total - each * (rows.length - 1));
  return rows.map((r, i) => ({ ...r, pct: i === rows.length - 1 ? lastPct : each }));
}

// Who can take a share (the same rule as the old Domain page): only Active accounts. Sales, CS and IT take STAFF and AGENT accounts;
// Profit takes the PROFIT role (or an account called PROFIT). Accounts: [{ id, code, role, status }] of the C168 ledger.
const SHARE_ROLES = ["STAFF", "AGENT"];
export const isShareAccount = (a) => a.status === "active" && SHARE_ROLES.includes(a.role);
const isProfitAccount = (a) => a.status === "active" && (a.role === "PROFIT" || String(a.code).trim().toUpperCase() === "PROFIT");

/** The account that takes the Profit share: C168 first, then PROFIT, then the first Profit account; undefined when there is none. */
export const profitAccountOf = (accounts) => {
  const list = accounts.filter(isProfitAccount);
  for (const code of PROFIT_ACCOUNT_CODES) {
    const found = list.find((a) => String(a.code).trim().toUpperCase() === code);
    if (found) return found;
  }
  return list[0];
};

/**
 * The body of PUT /api/domain/update-setting for one group / company.
 * Share off: only the expiry date (and the company type) are sent, the share rows saved before stay as they are.
 * Share on: the share rows replace the saved ones and the back end charges the domain fee for the period on this save
 * (it needs the Profit row, which is always included).
 */
export function tenantSettingBody({ ownerId, tenantId, kind, code, settings, accounts }) {
  const body = { id: tenantId, ownerId, code, expirationDate: expiryIsoOf(settings) || null };
  if (kind === "company") body.featureModules = [{ id: MODULE_IDS[settings.type] }];
  if (!settings.shareOn) return body;

  const idByCode = new Map(accounts.map((a) => [a.code, a.id]));
  const profit = profitAccountOf(accounts);
  if (!profit) throw new Error("No active Profit account (role PROFIT) was found, so the share cannot be saved");

  const rows = [];
  let taken = 0;
  for (const { key } of DEPARTMENTS) {
    for (const r of settings.departments[key]) {
      if (!(r.pct > 0) || !idByCode.has(r.account)) continue;
      rows.push({ shareType: key.toUpperCase(), accountId: idByCode.get(r.account), ownerType: "user", percentage: round2(r.pct) });
      taken += r.pct;
    }
  }
  const profitRow = { shareType: "PROFIT", accountId: profit.id, ownerType: "owner", percentage: Math.max(0, round2(100 - taken)) };
  body.feeShareAllocations = [profitRow, ...rows].map((row, sortOrder) => ({ ...row, sortOrder }));
  body.chargeDomainFeeOnConfirm = true;
  body.domainFeePeriod = periodOf(settings.period).api;
  return body;
}
