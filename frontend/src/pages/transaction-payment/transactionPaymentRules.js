// Transaction Payment: sample data and small helpers. UI only for now: nothing here talks to the backend.

export const GROUPS = ["AP", "IG"];
export const COMPANIES = { AP: ["C168"], IG: ["95", "AG", "CX", "RS", "VG"] };
export const ALL_CUR = ["MYR", "SGD", "USD", "CNY", "EUR", "HKD", "IDR", "THB", "NPR", "AUD", "USDT", "PGK"];
export const DEFAULT_COMPANY = { AP: "C168", IG: "95" };

// Sample conversion from MYR, only so each currency block shows different numbers.
export const RATE = { MYR: 1, SGD: 0.31, USD: 0.23, CNY: 1.6, EUR: 0.2, HKD: 1.8, IDR: 3600, THB: 7.6, NPR: 30, AUD: 0.35, USDT: 0.23, PGK: 0.9 };



// Show toggles under Category / Capture Date.
export const PILLS = [
  { key: "name", label: "Name" },
  { key: "winLoss", label: "Win/Loss Only" },
  { key: "payment", label: "Payment Only" },
  { key: "zero", label: "All 0 balance" },
];

// The manual transaction types. RATE and ADJUSTMENT have their own layout; the rest share one.
export const TYPES = ["CONTRA", "PAYMENT", "CLAIM", "PROFIT", "RATE", "ADJUSTMENT", "CLEAR"];
export const TYPE_OPTIONS = TYPES.map((v) => ({ value: v, label: v }));
export const layoutOf = (type) => (type === "RATE" ? "rate" : type === "ADJUSTMENT" ? "adj" : "std");

// Account column background / text, 1:1 with ROLE_BADGE in pages/account/accountRules.js.
export const ROLE_COLORS = {
  CAPITAL: ["#ffe0e0", "#a30b0b"],
  BANK: ["#dfe3ff", "#14228a"],
  CASH: ["#dff4e7", "#0f6d38"],
  PROFIT: ["#fff2c7", "#7a5b00"],
  EXPENSES: ["#f0e1ff", "#4f148f"],
  COMPANY: ["#ecfccb", "#3f6212"],
  PARTNER: ["#e0f2fe", "#0369a1"],
  STAFF: ["#ffe5cc", "#a24700"],
  SUPPLIER: ["#d6f9ff", "#0a6b78"],
  AGENT: ["#ffe0f3", "#a02578"],
  MEMBER: ["#f2dfd2", "#5f2e0f"],
  DEBTOR: ["#f1f5f9", "#475569"],
};

// [account, role, balance]; B/F = Balance in this sample (no win/loss, no cr/dr yet).
export const SETS = {
  "AP/C168": {
    left: [["C168", "COMPANY", 19440], ["AG", "COMPANY", 13451.35], ["APPLE", "STAFF", 1380], ["BEE", "STAFF", 1500], ["WINE", "STAFF", 1380], ["ZERO", "STAFF", 1500], ["BANG", "AGENT", 480], ["DARREN", "AGENT", 1440], ["JK", "SUPPLIER", 78.19], ["K", "SUPPLIER", 480]],
    right: [["EXPENSES", "EXPENSES", -38729.54], ["UG", "STAFF", -2400]],
  },
  "IG/95": {
    left: [["CAPITAL", "CAPITAL", 796566.26], ["XE", "CAPITAL", 37036.41], ["1SLOT", "PROFIT", 9.41], ["28WIN", "PROFIT", 2267.45], ["777MINION", "PROFIT", 32.39], ["918KAYA", "PROFIT", 33.11], ["918KISS", "PROFIT", 1181.83], ["918UMOBILE", "PROFIT", 18.59], ["AP95", "PROFIT", 3.6], ["API 3WIN8", "PROFIT", 0.01], ["API 918H5", "PROFIT", 177.9], ["API 918KAYA", "PROFIT", 290.93], ["API 918KISS", "PROFIT", 10.65], ["API BIGWIN", "PROFIT", 55.2], ["API JOKER", "PROFIT", 402.1]],
    right: [["3WIN8", "PROFIT", -2.35], ["ACE333", "PROFIT", -2.4], ["API CT855", "PROFIT", -40.33], ["LIVE22", "PROFIT", -4.53], ["717A", "SUPPLIER", -4238.67], ["717A-API-GP", "SUPPLIER", -3000], ["717A-API-P", "SUPPLIER", -9564.13], ["API-BG-SGD-ROYAL", "SUPPLIER", -316.06], ["API-HELEN", "SUPPLIER", -55656.42], ["API-LFC888", "SUPPLIER", -2387.19], ["API-LW-AE", "SUPPLIER", -890.03], ["BZ-029", "SUPPLIER", -1.11]],
  },
};
const EMPTY_SET = { left: [], right: [] };
export const setFor = (group, company) => SETS[`${group}/${group === "AP" ? "C168" : company}`] ?? EMPTY_SET;

export const fmt = (n) => (n < 0 ? "-" : "") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const tone = (n) => (n > 0 ? "pos" : n < 0 ? "neg" : "");
// Sample amounts converted into the shown currency, to cents.
export const convert = (n, currency) => Math.round(n * (RATE[currency] ?? 1) * 100) / 100;

// "CAPITAL[CAPITAL]": account id and name; the sample data has no separate name yet.
export const accountOptions = (set) => [...set.left, ...set.right].map(([id]) => ({ value: id, label: `${id}[${id}]` }));

export const todayDisplay = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
export const positive = (value) => parseFloat(String(value).replace(/,/g, "")) > 0;

// Category filter: the account roles (a Set of them can be picked; none = every role).
export const CATEGORY_ITEMS = Object.keys(ROLE_COLORS).map((v) => ({ value: v, label: v }));
