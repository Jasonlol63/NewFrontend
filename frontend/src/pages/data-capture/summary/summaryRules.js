// TEMPORARY while the Data Capture Summary is a UI draft: the captured rows come from the submit API once it exists.
// base = the amount before any Rate is applied; src = which captured sheet row it came from.
export const MOCK_SUMMARY = [
  { id: "KAIYUAN", acc: "KY [KAI YUAN]", cur: "MYR", f: "3000", src: 1, base: 3000 },
  { id: "KAIYUAN", acc: "EXPENSES [EXPENSES]", cur: "MYR", f: "3000", src: 1, base: -3000 },
  { id: "SHIHUI", acc: "SHI HUI [SH]", cur: "MYR", f: "3000", src: 1, base: 3000 },
  { id: "SHIHUI", acc: "EXPENSES [EXPENSES]", cur: "MYR", f: "3000", src: 1, base: -3000 },
  { id: "AHMAD", acc: "AHMAD [AHM]", cur: "MYR", f: "1200", src: 2, base: 1200 },
  { id: "AHMAD", acc: "EXPENSES [EXPENSES]", cur: "MYR", f: "1200", src: 2, base: -1200 },
  { id: "LIM WEI", acc: "LIM WEI [LW]", cur: "MYR", f: "850.5", src: 1, base: 850.5 },
  { id: "LIM WEI", acc: "EXPENSES [EXPENSES]", cur: "MYR", f: "850.5", src: 1, base: -850.5 },
  { id: "TAN KOK", acc: "TAN KOK [TAN]", cur: "MYR", f: "4300", src: 1, base: 4300 },
  { id: "TAN KOK", acc: "EXPENSES [EXPENSES]", cur: "MYR", f: "4300", src: 1, base: -4300 },
  { id: "SITI", acc: "SITI [SIT]", cur: "MYR", f: "275.25", src: 2, base: 275.25 },
  { id: "SITI", acc: "EXPENSES [EXPENSES]", cur: "MYR", f: "275.25", src: 2, base: -275.25 },
].map((r, i) => ({ ...r, key: i + 1, rate: false, rateValue: "", skip: false, del: false }));

// "*3" / "/3" -> the factor, or null when it is not a rate.
export function parseRate(text) {
  const m = /^([*/])\s*(\d+(?:\.\d+)?)$/.exec(text.trim());
  if (!m) return null;
  const n = Number(m[2]);
  if (m[1] === "/" && n === 0) return null;
  return m[1] === "*" ? n : 1 / n;
}

// The amount of a summary row once its Rate (if any) is applied.
export const rowAmount = (r) => (r.rateValue ? r.base * (parseRate(r.rateValue) ?? 1) : r.base);

// TEMPORARY while Add / Edit Formula is a UI draft: the captured sheet row of each Id Product (column number -> text), the
// accounts of the company and the input methods come from the backend once the submit API exists.
export const MOCK_CAPTURED = {
  "M99M06 (D)": ['M06-KZ"', "MAJOR", "WIN/PLC", "182", "$1.27", "350", "$9.10", "$10.37", "$930.78", "$10.37", "$930.78", "12.5%", "88", "$45.00", "KZ", "$1,204.30", "77", "$3.60", "2026-10-08"],
  KAIYUAN: ["3000", "MAJOR", "1", "$25.50"],
  SHIHUI: ["3000", "MINOR", "2", "$12.00"],
};
export const MOCK_SUMMARY_ACCOUNTS = ["KY [KAI YUAN]", "SHI HUI [SH]", "EXPENSES [EXPENSES]", "AHMAD [AHM]"].map((a) => ({ value: a, label: a }));
export const INPUT_METHODS = [
  "Positive to negative, negative to positive",
  "Positive to negative, negative to zero",
  "Negative to positive, positive to zero",
  "Positive unchanged, negative to zero",
  "Negative unchanged, positive to zero",
  "Change to positive",
  "Change to negative",
  "Change to zero",
].map((m) => ({ value: m, label: m }));

// Every column of a captured row as { n, t, v }: n = the $n a formula uses (column 1 is the Id Product, so data starts at $2),
// t = the text, v = its number (null for text such as "MAJOR", which a formula cannot use).
export function capturedCells(idProduct) {
  return (MOCK_CAPTURED[idProduct] ?? []).map((t, k) => ({
    n: k + 2,
    t,
    v: /^-?\$?-?[\d,]+(\.\d+)?%?$/.test(t) ? parseFloat(t.replace(/[$,%]/g, "")) : null,
  }));
}

/**
 * Value of a formula such as "$5+$10*0.6/7" (+ - * / ( ) and numbers; $n = column n of the captured row).
 * Throws when it is not a valid formula or uses a text column.
 */
export function evalFormula(src, cells) {
  const text = src.replace(/\$(\d+)/g, (_, n) => {
    const c = cells.find((x) => x.n === Number(n));
    if (!c || c.v === null) throw new Error("bad column");
    return `(${c.v})`;
  });
  const tokens = text.match(/\d+\.?\d*|\.\d+|[-+*/()]|\S/g) ?? [];
  let i = 0;
  const peek = () => tokens[i];
  const factor = () => {
    const t = tokens[i++];
    if (t === "-") return -factor();
    if (t === "+") return factor();
    if (t === "(") {
      const v = expr();
      if (tokens[i++] !== ")") throw new Error("missing )");
      return v;
    }
    if (t !== undefined && /^(\d|\.\d)/.test(t)) return Number(t);
    throw new Error("unexpected token");
  };
  const term = () => {
    let v = factor();
    while (peek() === "*" || peek() === "/") v = tokens[i++] === "*" ? v * factor() : v / factor();
    return v;
  };
  function expr() {
    let v = term();
    while (peek() === "+" || peek() === "-") v = tokens[i++] === "+" ? v + term() : v - term();
    return v;
  }
  const v = expr();
  if (i < tokens.length || !Number.isFinite(v)) throw new Error("bad formula");
  return v;
}
