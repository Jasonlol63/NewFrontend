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

export const fmt = (n) => (n < 0 ? "-" : "") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const todayDisplay = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export const toNumber = (value) => parseFloat(String(value ?? "").replace(/,/g, ""));
export const positive = (value) => toNumber(value) > 0;

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
    bf: toNumber(dto.bf) || 0,
    winLoss: toNumber(dto.winLoss) || 0,
    crDr: toNumber(dto.crDr) || 0,
    balance: toNumber(dto.balance) || 0,
    hasWinLoss: Boolean(dto.hasWinLossInPeriod),
    hasCrDr: Boolean(dto.hasCrDrInPeriod),
    alert: Boolean(dto.alertActive),
  };
}

// Whole cents, so sums of many rows never drift.
const cents = (n) => Math.round(n * 100);
const sum = (rows, key) => rows.reduce((a, r) => a + cents(r[key]), 0) / 100;
const isZero = (n) => cents(n) === 0;
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
      const shown = rows.filter((r) => r.currency === code && passes(r, options));
      const left = shown.filter((r) => r.balance >= 0);
      const right = shown.filter((r) => r.balance < 0);
      return [code, { left, right, totals: totalsOf(shown), leftTotals: totalsOf(left), rightTotals: totalsOf(right) }];
    })
  );
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

export const accountLabel = (a) => `${a.accountId}[${a.name || a.accountId}]`;
export const accountOptions = (accounts) => accounts.map((a) => ({ value: String(a.id), label: accountLabel(a) }));

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

export const trim8 = (n) => String(Math.round(n * 1e8) / 1e8);

// Amount 2 follows Amount 1 x Rate (the backend recomputes it the same way).
export const rateAmount2 = (amount1, rate) => {
  const parsed = parseRate(rate);
  return parsed && positive(amount1) ? trim8(toNumber(amount1) * parsed.value) : "";
};

// Middle-Man total shown in the Amount box: the Rate-Mul commission plus the Fee net of PT-Fee (each only when above 0).
// Same formulas as the backend's RateMulCalculator.computeCommission.
export function middleManTotal({ amount1, rate, mul, fee, pt }) {
  const from = toNumber(amount1);
  const fx = parseRate(rate);
  let commission = 0;
  const text = plain(mul).replace("÷", "/");
  if (from > 0 && fx && text) {
    if (/^\/\d*\.?\d+$/.test(text)) {
      const divisor = parseFloat(text.slice(1));
      if (fx.divisor && divisor > 0) commission = from / fx.divisor - from / divisor;
    } else if (/^\d*\.?\d+$/.test(text) && parseFloat(text) > 0) {
      commission = fx.divisor ? parseFloat(text) * 1000 : from * (fx.value - parseFloat(text));
    }
  }
  const feeNet = (toNumber(fee) || 0) - (toNumber(pt) || 0);
  const total = (commission > 0 ? commission : 0) + (feeNet > 0 ? feeNet : 0);
  return total > 0 ? String(Math.round(total * 100) / 100) : "";
}

/** The /api/transaction/submit body of the form, or throws the message to show. `f` is the form state, `cur` the resolved currencies. */
export function buildSubmitRequest({ tenantId, type, f, cur }) {
  const base = { tenantId, transactionType: type };
  if (type === "RATE") {
    const rate = parseRate(f.rRate);
    if (!f.rTo1 || !f.rFrom1) throw new Error("Select the To and From account of the first currency");
    if (!f.rTo2 || !f.rFrom2) throw new Error("Select the To and From account of the second currency");
    if (cur.rate1 === cur.rate2) throw new Error("The two currencies must be different");
    if (!positive(f.rAmt1)) throw new Error("Enter the amount");
    if (!rate) throw new Error("Enter a valid rate");
    const mul = plain(f.rMul);
    const fee = plain(f.rFee);
    const pt = plain(f.rPT);
    if ((mul || fee || pt) && !f.rMid) throw new Error("Select the Middle-Man account");
    if (f.rMid && !mul && !fee && !pt) throw new Error("Enter the Middle-Man Rate-Mul, Fee or PT-Fee");
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
    const amount = toNumber(f.aAmt);
    if (!f.aAcc) throw new Error("Select the account");
    if (!Number.isFinite(amount) || amount === 0) throw new Error("Enter a non-zero amount");
    return { ...base, toAccountId: idOf(f.aAcc), currencyCode: cur.adj, amount: plain(f.aAmt), remark: f.aRemark.trim() || null };
  }
  if (!f.to || !f.from) throw new Error("Select the To and From account");
  if (f.to === f.from) throw new Error("The To and From account must be different");
  if (!positive(f.amount)) throw new Error("Enter an amount above 0");
  return { ...base, toAccountId: idOf(f.to), fromAccountId: idOf(f.from), currencyCode: cur.std, amount: plain(f.amount), remark: f.remark.trim() || null };
}
