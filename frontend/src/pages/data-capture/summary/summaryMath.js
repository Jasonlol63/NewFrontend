// Amount rules of the Data Capture Summary, the same as the old summary and the backend (SummaryAmountFormat):
//   formula result x Source, then the Input Method, then the Rate cut down to 8 decimals, and the amount that is stored and
//   totalled cut down to 6. Only the shown figures are rounded (half up, 2 decimals); a rounded figure is never calculated with.
import Decimal from "../../../lib/decimal.js";

const dec = (value) => new Decimal(value);

export const SUBMIT_TOLERANCE = "0.05";

/** The Input Methods: key = what is stored and sent, label = what the dialog lists. */
export const INPUT_METHODS = [
  ["positive_to_negative_negative_to_positive", "Positive to negative, negative to positive"],
  ["positive_to_negative_negative_to_zero", "Positive to negative, negative to zero"],
  ["negative_to_positive_positive_to_zero", "Negative to positive, positive to zero"],
  ["positive_unchanged_negative_to_zero", "Positive unchanged, negative to zero"],
  ["negative_unchanged_positive_to_zero", "Negative unchanged, positive to zero"],
  ["change_to_positive", "Change to positive"],
  ["change_to_negative", "Change to negative"],
  ["change_to_zero", "Change to zero"],
].map(([value, label]) => ({ value, label }));

export const inputMethodLabel = (key) => INPUT_METHODS.find((m) => m.value === key)?.label ?? "";

export function applyInputMethod(value, method) {
  switch (method) {
    case "positive_to_negative_negative_to_positive":
      return value.neg();
    case "positive_to_negative_negative_to_zero":
      return value.gt(0) ? value.neg() : dec(0);
    case "negative_to_positive_positive_to_zero":
      return value.lt(0) ? value.neg() : dec(0);
    case "positive_unchanged_negative_to_zero":
      return value.gt(0) ? value : dec(0);
    case "negative_unchanged_positive_to_zero":
      return value.lt(0) ? value : dec(0);
    case "change_to_positive":
      return value.abs();
    case "change_to_negative":
      return value.abs().neg();
    case "change_to_zero":
      return dec(0);
    default:
      return value;
  }
}

/**
 * Value of an arithmetic text (+ - * / ( ) and numbers, "1,234.5" and "$12" allowed). Throws when it is not valid, or
 * divides by zero. The formulas already in the database were written for the old summary, so its habits stay: adjacent
 * factors multiply ("(a)(b)", "3(4)"), a missing ")" at the end is closed, a currency tag such as "(USD)" is dropped, and
 * a "%" sign is only decoration ("$8/3.1%" is $8 / 3.1, NOT 3.1 percent).
 */
export function evalExpression(text) {
  const source = String(text ?? "")
    .replace(/−/g, "-")
    .replace(/\s*\([A-Za-z]{2,4}\)\s*/g, " ")
    .replace(/[$,%\s]/g, "");
  const tokens = source.match(/\d+\.?\d*|\.\d+|[-+*/()]|./g) ?? [];
  let i = 0;
  const peek = () => tokens[i];
  const factor = () => {
    const t = tokens[i++];
    if (t === "-") return factor().neg();
    if (t === "+") return factor();
    if (t === "(") {
      const v = expr();
      if (i < tokens.length && tokens[i++] !== ")") throw new Error("expected )");
      return v;
    }
    if (t !== undefined && /^(\d|\.\d)/.test(t)) return dec(t);
    throw new Error("unexpected token");
  };
  const term = () => {
    let v = factor();
    for (;;) {
      if (peek() === "*") {
        i += 1;
        v = v.mul(factor());
      } else if (peek() === "/") {
        i += 1;
        const d = factor();
        if (d.isZero()) throw new Error("divide by zero");
        v = v.div(d);
      } else if (peek() === "(") v = v.mul(factor()); // "(a)(b)"
      else return v;
    }
  };
  function expr() {
    let v = term();
    while (peek() === "+" || peek() === "-") v = tokens[i++] === "+" ? v.add(term()) : v.sub(term());
    return v;
  }
  if (tokens.length === 0) throw new Error("empty");
  const v = expr();
  if (i < tokens.length || !v.isFinite()) throw new Error("bad formula");
  return v;
}

/**
 * Expands the references of a formula into numbers: $n = column n of the row's own captured row (column 1 is the Id
 * Product, so data starts at $2), [ID,n] = column n of the first captured row with that Id Product. A negative number is
 * wrapped in brackets so it keeps its sign inside the sum. A column that is missing or is text throws.
 *
 * captured: { rows: string[][], rowIndex } -- rows[r][n] is the text of column n.
 */
export function expandRefs(formula, captured, rowIndex) {
  const cell = (r, n) => {
    const text = captured?.rows?.[r]?.[n];
    if (text === undefined || n < 2) throw new Error("no such column");
    const value = cellNumber(text);
    if (value === null) throw new Error("not a number");
    return value.isNeg() ? `(${value.toString()})` : value.toString();
  };
  return String(formula ?? "")
    .replace(/\[([^,\]]+),\s*(\d+)\]/g, (_, id, n) => {
      const r = captured?.rows?.findIndex((row) => String(row?.[1] ?? "").trim().toUpperCase() === id.trim().toUpperCase()) ?? -1;
      if (r < 0) throw new Error("no such Id Product");
      return cell(r, Number(n));
    })
    .replace(/\$(\d+)/g, (_, n) => cell(rowIndex, Number(n)));
}

/** A captured cell as a number: "$1,204.30" -> 1204.3, "12.5%" -> 12.5, "-3" -> -3; null for text. */
export function cellNumber(text) {
  const t = String(text ?? "").trim();
  if (!/^-?\$?-?[\d,]+(\.\d+)?%?$/.test(t)) return null;
  try {
    return dec(t.replace(/[$,%]/g, ""));
  } catch {
    return null;
  }
}

/** The formula with its references replaced by the captured numbers (what the Formula column shows). Falls back to the text. */
export function formulaDisplay(formula, captured, rowIndex) {
  try {
    return expandRefs(formula, captured, rowIndex);
  } catch {
    return String(formula ?? "");
  }
}

/** Source "1", "2", "0.5" or an expression ("1/2"); null when it is not a number. */
export function parseSource(text) {
  try {
    const v = evalExpression(String(text ?? "").trim() || "1");
    return v;
  } catch {
    return null;
  }
}

/**
 * The amount of a formula before the Rate: the result x Source, then the Input Method.
 * Throws on an invalid formula; an empty formula is 0.
 */
export function baseAmount({ formula, sourcePercent, inputMethod }, captured, rowIndex) {
  if (!String(formula ?? "").trim()) return dec(0);
  let value = evalExpression(expandRefs(formula, captured, rowIndex));
  const source = parseSource(sourcePercent);
  if (source === null) throw new Error("bad source");
  if (!source.minus(1).abs().lt("0.0001")) value = value.mul(source);
  return applyInputMethod(value, inputMethod);
}

// "*3" / "/3" / "3" -> { op, n }, or null when it is not a rate (empty, text, zero).
export function parseRate(text) {
  const m = /^([*/]?)\s*(\d+(?:\.\d+)?)$/.exec(String(text ?? "").trim());
  if (!m) return null;
  const n = dec(m[2]);
  return n.isZero() ? null : { op: m[1] === "/" ? "/" : "*", n };
}

/** The amount after the Rate (cut down to 8 decimals); no rate leaves it as it is. */
export function applyRate(amount, rateText) {
  const rate = parseRate(rateText);
  if (!rate) return amount;
  const result = rate.op === "/" ? amount.div(rate.n) : amount.mul(rate.n);
  return result.toDecimalPlaces(8, Decimal.ROUND_DOWN);
}

/** The amount that is stored, totalled and sent: cut down to 6 decimals. */
export const finalAmount = (amount) => amount.toDecimalPlaces(6, Decimal.ROUND_DOWN);

/** The amount of a summary row, or null when it has no formula or the formula is not valid. */
export function rowAmountOf(row, captured) {
  if (!String(row.formula ?? "").trim()) return null;
  try {
    return finalAmount(applyRate(baseAmount(row, captured, row.rowIndex), row.rateValue));
  } catch {
    return null;
  }
}

export const sumAmounts = (amounts) => amounts.reduce((sum, a) => sum.add(a), dec(0));

/** The Submit gate: the total, rounded half up to 2 decimals, has to be within +-0.05. */
export const totalWithinTolerance = (total) => dec(total).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).abs().lte(SUBMIT_TOLERANCE);

/** A number in a formula result as short text: "3000", "850.5", "1250.4". */
export const plainNumber = (value) => dec(value).toDecimalPlaces(6, Decimal.ROUND_DOWN).toString();

/**
 * The source_columns text the old summary stored ("ID:#rowIndex:column", one per reference, space separated), kept so the
 * old pages still read what this one saves. $n = a column of the row's own sheet row, [ID,n] = one of another Id Product.
 */
export function sourceColumnsOf(formula, idProduct, rowIndex) {
  const text = String(formula ?? "");
  const own = [...text.matchAll(/\$(\d+)/g)].map((m) => `${idProduct}:#${rowIndex}:${m[1]}`);
  const other = [...text.matchAll(/\[([^,\]]+),\s*(\d+)\]/g)].map((m) => `${m[1].trim()}:#0:${m[2]}`);
  return [...own, ...other].join(" ");
}
