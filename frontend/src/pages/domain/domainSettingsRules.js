import { addDays, formatDisplayDate, parseIsoDate, toIsoDate } from "@/lib/date";
import { PRICE_PERIODS } from "./domainRules";

// Rules of the Company Settings / Group Settings dialog (the Set button of a company or group).
// Nothing here talks to the API yet.
//
// Share: the Company / Group price of the picked period is 100%. Sales, CS and IT each take part of it
// (accounts with an amount and a percentage); Profit, always C168, is what is left.

export const DEPARTMENTS = [
  { key: "sales", label: "Sales", color: "#0ea5e9" },
  { key: "cs", label: "CS", color: "#16a34a" },
  { key: "it", label: "IT", color: "#7c3aed" },
];

// Company types of a company; a group has none (the back end defaults it to Games).
export const COMPANY_TYPES = ["Games", "Bank", "Loan", "Rate", "Money"];
export const PROFIT_ACCOUNT = "C168";

// Placeholder accounts for the Account dropdown; the real list comes with the API.
export const ACCOUNTS = ["AMY", "BEN", "CAT", "DAN", "EVA", "FAY"];

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Up to 2 decimals; anything else the user types or pastes is ignored.
export const AMOUNT_PATTERN = /^\d*(\.\d{0,2})?$/;

let rowSeq = 0;
export const newRowId = () => `row${++rowSeq}`;

export const periodOf = (key) => PRICE_PERIODS.find((p) => p.key === key) ?? null;

/** The starting values: nothing picked, Games, Share off. */
export function buildSettings(kind) {
  return {
    startDate: toIsoDate(new Date()),
    period: null,
    types: kind === "company" ? ["Games"] : [],
    shareOn: false,
    departments: { sales: [], cs: [], it: [] },
  };
}

/** The price (100%) of a kind ("company" | "group") for a period, from the Price dialog's amounts. */
export function priceFor(prices, kind, periodKey) {
  if (!periodKey) return 0;
  const value = Number(prices?.[kind]?.[periodKey]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Expiry date as dd-mm-yyyy: the start date plus the period; "" until both are picked. */
export function expiryOf(startDate, periodKey) {
  const period = periodOf(periodKey);
  if (!startDate || !period) return "";
  return formatDisplayDate(toIsoDate(addDays(parseIsoDate(startDate), period.days)), "-");
}

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
export function settingsProblem(kind, settings, summary) {
  if (!settings.startDate) return "Pick a Start Date";
  if (!settings.period) return "Pick a Period";
  if (kind === "company" && settings.types.length === 0) return "Pick at least one company type";
  if (settings.shareOn && summary.incomplete) return "Choose an account for every share row";
  if (settings.shareOn && summary.over) return "The share is over 100%";
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
