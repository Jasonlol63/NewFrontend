import Decimal from "@/lib/decimal";
import { moneySign, moneyText, showsZero, sumMoney } from "@/lib/money";
import { ROLE_PRIORITY } from "@/pages/account/accountRules";
// Transaction Payment: constants, the Search request / rows, the display filters and the Submit payloads.

export const SEARCH_URL = "/api/transaction/search";
export const SUBMIT_URL = "/api/transaction/submit";

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

// Category filter: the account roles (a Set of them can be picked; none = every role).
export const CATEGORY_ITEMS = Object.keys(ROLE_COLORS).map((v) => ({ value: v, label: v }));

// Account order on this page: by role (ROLE_PRIORITY from the Account page, unknown roles last), then by account
// code numbers-first (23, 58, 977, 1039, AG…). Replaces the plain 1-Z order of the account code.
const roleRank = (role) => {
  const i = ROLE_PRIORITY.indexOf(role);
  return i === -1 ? ROLE_PRIORITY.length : i;
};
export const compareByRole = (a, b) =>
  roleRank(a.role) - roleRank(b.role) ||
  String(a.accountId ?? "").localeCompare(String(b.accountId ?? ""), undefined, { sensitivity: "base", numeric: true });

export { formatMoney as fmt } from "@/lib/money";

export const todayDisplay = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export const toNumber = (value) => parseFloat(String(value ?? "").replace(/,/g, ""));
export const positive = (value) => toNumber(value) > 0;
// A typed amount (e.g. "-5,000.5") that is a number and not 0, worked on the text.
export const isNonZeroAmount = (value) => /^-?(\d+\.?\d*|\.\d+)$/.test(plain(value)) && moneySign(plain(value)) !== 0;

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

// The backend returns every currency of the company at once; the currency chips filter on the client.
export function buildSearchRequest({ tenantId, range, categories, showZero }) {
  return {
    tenantId,
    dateFrom: range.from,
    dateTo: range.to,
    currencyCodes: [],
    categories: [...categories],
    showAllZeroBalance: Boolean(showZero),
  };
}

export function normalizeSearchRow(dto) {
  return {
    key: `${dto.accountId}|${dto.currencyCode}`,
    id: dto.accountId,
    accountId: String(dto.accountCode ?? "").trim(),
    name: String(dto.accountName ?? "").trim(),
    role: String(dto.role ?? "").trim().toUpperCase(),
    currency: String(dto.currencyCode ?? "").trim().toUpperCase(),
    bf: moneyText(dto.bf),
    winLoss: moneyText(dto.winLoss),
    crDr: moneyText(dto.crDr),
    balance: moneyText(dto.balance),
    hasWinLoss: Boolean(dto.hasWinLossInPeriod),
    hasCrDr: Boolean(dto.hasCrDrInPeriod),
    alert: Boolean(dto.alertActive),
  };
}

// Amounts stay decimal strings; a figure that shows 0.00 counts as zero here (what the lists hide), the colour uses the raw value.
const sum = (rows, key) => sumMoney(rows.map((r) => r[key]));
const isZero = showsZero;
const hasCrDr = (r) => !isZero(r.crDr) || r.hasCrDr;
const hasWinLoss = (r) => !isZero(r.winLoss) || r.hasWinLoss;

// Win/Loss Only / Payment Only keep the rows with that activity in the period; a row that nets to 0.00 stays hidden
// unless "All 0 balance" is on, or it is today's own activity (e.g. a CONTRA that cancels out).
function passes(row, { zero, payment, winLoss, today }) {
  if (payment || winLoss) {
    const active = (payment && hasCrDr(row)) || (winLoss && hasWinLoss(row));
    if (!(zero ? isZero(row.balance) || active : active)) return false;
  }
  if (zero || !isZero(row.balance)) return true;
  if (payment && hasCrDr(row)) return true;
  if (winLoss && hasWinLoss(row)) return true;
  return today && (hasCrDr(row) || hasWinLoss(row));
}

const totalsOf = (rows) => ({ bf: sum(rows, "bf"), winLoss: sum(rows, "winLoss"), crDr: sum(rows, "crDr"), balance: sum(rows, "balance") });

/** The rows of every shown currency, split into the left (Balance >= 0) and right (Balance < 0) tables, with their totals. */
export function buildBlocks(rows, currencies, pills, today) {
  const options = { zero: Boolean(pills.zero), payment: Boolean(pills.payment), winLoss: Boolean(pills.winLoss), today };
  return Object.fromEntries(
    currencies.map((code) => {
      const shown = rows.filter((r) => r.currency === code && passes(r, options)).sort(compareByRole);
      const left = shown.filter((r) => moneySign(r.balance) >= 0);
      const right = shown.filter((r) => moneySign(r.balance) < 0);
      return [code, { left, right, totals: totalsOf(shown), leftTotals: totalsOf(left), rightTotals: totalsOf(right) }];
    })
  );
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

export const accountLabel = (a) => `${a.accountId}[${a.name || a.accountId}]`;
export const accountOptions = (accounts) => [...accounts].sort(compareByRole).map((a) => ({ value: String(a.id), label: accountLabel(a) }));

const plain = (value) => String(value ?? "").replace(/,/g, "").trim();
const idOf = (value) => (value ? Number(value) : null);

// "/1.5" (divide) or a plain number -> the multiplier, at most 8 decimals like the backend column.
export function parseRate(raw) {
  const text = plain(raw).replace("÷", "/");
  if (/^\/\d*\.?\d+$/.test(text)) {
    const divisor = parseFloat(text.slice(1));
    return divisor > 0 ? { divisor, value: Math.round((1 / divisor) * 1e8) / 1e8 } : null;
  }
  if (/^\d*\.?\d+$/.test(text) && parseFloat(text) > 0) return { divisor: null, value: parseFloat(text) };
  return null;
}

// Amount 2 follows Amount 1 x Rate; "/N" divides by N itself (not by a 1/N cut to 8 decimals, which loses digits).
export const rateAmount2 = (amount1, rate) => {
  const parsed = parseRate(rate);
  if (!parsed || !positive(amount1)) return "";
  const amount = new Decimal(plain(amount1));
  const result = parsed.divisor ? amount.div(plain(rate).replace("÷", "/").slice(1)) : amount.mul(plain(rate));
  return result.toDecimalPlaces(8, Decimal.ROUND_DOWN).toFixed();
};

// Middle-Man total shown in the Amount box: the Rate-Mul commission plus the Fee net of PT-Fee (each only when above 0), as a
// decimal string cut to 8 decimals ("" when 0). Same formulas as the backend's RateMulCalculator.computeCommission, worked in
// Decimal (division at 20 decimals, half up) so nothing drifts like floating point does.
export function middleManTotal({ amount1, rate, mul, fee, pt }) {
  const dec = (v) => new Decimal(plain(v) || "0");
  const from = positive(amount1) ? dec(amount1) : new Decimal(0);
  const fx = parseRate(rate);
  let commission = new Decimal(0);
  const text = plain(mul).replace("÷", "/");
  if (from.gt(0) && fx && text) {
    if (/^\/\d*\.?\d+$/.test(text)) {
      const divisor = dec(text.slice(1));
      if (fx.divisor && divisor.gt(0)) {
        const base = from.div(plain(rate).replace("÷", "/").slice(1)).toDecimalPlaces(20, Decimal.ROUND_HALF_UP);
        commission = base.minus(from.div(divisor).toDecimalPlaces(20, Decimal.ROUND_HALF_UP));
      }
    } else if (/^\d*\.?\d+$/.test(text) && dec(text).gt(0)) {
      commission = fx.divisor ? dec(text).mul(1000) : from.mul(dec(rate).minus(dec(text)));
    }
  }
  const eight = (d) => d.toDecimalPlaces(8, Decimal.ROUND_HALF_UP);
  const feeNet = eight(dec(fee).minus(dec(pt)));
  const ratePart = eight(commission);
  const total = (ratePart.gt(0) ? ratePart : new Decimal(0)).plus(feeNet.gt(0) ? feeNet : new Decimal(0));
  return total.gt(0) ? total.toFixed() : "";
}

/** The /api/transaction/submit body of the form, or throws the message to show (written with t, the `transaction` namespace's t). `f` is the form state, `cur` the resolved currencies. */
export function buildSubmitRequest({ tenantId, type, f, cur, t }) {
  const base = { tenantId, transactionType: type };
  if (type === "RATE") {
    const rate = parseRate(f.rRate);
    if (!f.rTo1 || !f.rFrom1) throw new Error(t("errors.toFirst"));
    if (!f.rTo2 || !f.rFrom2) throw new Error(t("errors.toSecond"));
    if (cur.rate1 === cur.rate2) throw new Error(t("errors.sameCurrency"));
    if (!positive(f.rAmt1)) throw new Error(t("errors.enterAmount"));
    if (!rate) throw new Error(t("errors.validRate"));
    const mul = plain(f.rMul);
    const fee = plain(f.rFee);
    const pt = plain(f.rPT);
    if ((mul || fee || pt) && !f.rMid) throw new Error(t("errors.middleMan"));
    if (f.rMid && !mul && !fee && !pt) throw new Error(t("errors.middleManRate"));
    return {
      ...base,
      leg1ToAccountId: idOf(f.rTo1),
      leg1FromAccountId: idOf(f.rFrom1),
      leg1CurrencyCode: cur.rate1,
      leg1Amount: plain(f.rAmt1),
      leg2ToAccountId: idOf(f.rTo2),
      leg2FromAccountId: idOf(f.rFrom2),
      leg2CurrencyCode: cur.rate2,
      exchangeRate: rate.value,
      rateExpression: plain(f.rRate).replace("÷", "/"),
      ...(f.rMid ? { middlemanAccountId: idOf(f.rMid) } : {}),
      ...(mul ? { middlemanRateExpression: mul } : {}),
      ...(positive(fee) ? { middlemanAmount: fee } : {}),
      ...(positive(pt) ? { platformFeeAmount: pt } : {}),
    };
  }
  if (type === "ADJUSTMENT") {
    if (!f.aAcc) throw new Error(t("errors.selectAccount"));
    if (!isNonZeroAmount(f.aAmt)) throw new Error(t("errors.nonZero"));
    return { ...base, toAccountId: idOf(f.aAcc), currencyCode: cur.adj, amount: plain(f.aAmt), remark: f.aRemark.trim() || null };
  }
  if (!f.to || !f.from) throw new Error(t("errors.toFrom"));
  if (f.to === f.from) throw new Error(t("errors.differentAccounts"));
  if (!positive(f.amount)) throw new Error(t("errors.amountAbove0"));
  return { ...base, toAccountId: idOf(f.to), fromAccountId: idOf(f.from), currencyCode: cur.std, amount: plain(f.amount), remark: f.remark.trim() || null };
}
