// Money on screen. The backend sends amounts as decimal strings (6 decimals, 8 for rates); the page only shows them.
// Amounts stay strings (or Decimal) all the way, never `Number`, so no digit is lost. What is shown is cut to 2
// decimals, half up like the backend (SummaryAmountFormat), with thousands separators. The colour of an amount comes
// from the raw value (moneySign), never from the shown text: 0.002586 shows 0.00 but is still positive (blue).
import Decimal from "@/lib/decimal";

const toDecimal = (value) => {
  if (value instanceof Decimal) return value;
  if (typeof value === "number") return Number.isFinite(value) ? new Decimal(value) : new Decimal(0);
  const text = String(value ?? "").replace(/[,\s]/g, "");
  try {
    return /^-?(\d+\.?\d*|\.\d+)$/.test(text) ? new Decimal(text) : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
};

/** An amount as a plain decimal string ("1,204.30 " -> "1204.30", 1e-7 -> "0.0000001"); anything else is "0". */
export const moneyText = (value) => toDecimal(value).toFixed();

/** -1, 0 or 1 from the raw value. */
export const moneySign = (value) => {
  const d = toDecimal(value);
  return d.isZero() ? 0 : d.isNeg() ? -1 : 1;
};

/** Half up to 2 decimals with thousands separators. A rounded-away negative shows 0.00, not -0.00 (its colour tells). */
export function formatMoney(value) {
  const rounded = toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const [whole, cents] = rounded.abs().toFixed(2).split(".");
  return `${rounded.isNeg() && !rounded.isZero() ? "-" : ""}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${cents}`;
}

/** True when the amount shows as 0.00 (it may still hold a remainder; see moneySign). */
export const showsZero = (value) => formatMoney(value) === "0.00";

/** Sum of amounts as an exact decimal string. */
export const sumMoney = (values) => values.reduce((total, v) => total.plus(toDecimal(v)), new Decimal(0)).toFixed();

/** Half up to `scale` decimals as plain text, no thousands separators (for inputs and form values): "12.345" -> "12.35". */
export const roundMoney = (value, scale = 2) => toDecimal(value).toDecimalPlaces(scale, Decimal.ROUND_HALF_UP).toFixed(scale);

/** A percentage of an amount, half up to 2 decimals as plain text: ("1000", "12.5") -> "125.00". */
export const percentOf = (amount, pct) => roundMoney(toDecimal(amount).mul(toDecimal(pct)).div(100));
