// Row model and rules of the Data Capture Summary (no React here).
//
// A summary row: { key, type: "main" | "sub", idProduct, rowIndex, account, accountId, currency, currencyId, formula,
// sourcePercent, inputMethod, description, templateId, formulaVariant, rateChecked, rateValue, skip, del, subOrder }
//   - account is the label "ID [NAME]" and accountId its database id; currency is the code and currencyId its id
//   - templateId / formulaVariant are the row of data_capture_formula the row was loaded from or saved to (null = not saved)
//   - a main row comes from the Id Product column of the captured sheet (rowIndex = its sheet row); it keeps its Id Product
//     for good: "deleting" it only clears what was filled in
//   - a sub row is a further formula of the same Id Product (another account, a commission leg...) and sits under its main
//     row; it has the same idProduct / rowIndex and a subOrder 1..n; deleting it removes it
//   - formula keeps its $n references; the list shows them as the captured numbers
//   - sourcePercent is the Source column: a multiplier ("1", "2", "0.5"); inputMethod is a key of INPUT_METHODS
import { formatMoney, formulaDisplay, rowAmountOf, sourceColumnsOf, sumAmounts, totalWithinTolerance } from "./summaryMath.js";

// ---- rows ----

let counter = 0;
export const newKey = () => `r${(counter += 1)}`;

const BLANK = { account: "", accountId: null, currency: "", currencyId: null, templateId: null, formulaVariant: null, formula: "", sourcePercent: "1", inputMethod: "", description: "", rateChecked: false, rateValue: "", skip: false, del: false, subOrder: null };

export const createRow = (fields) => ({ key: newKey(), type: "main", idProduct: "", rowIndex: 0, ...BLANK, ...fields });

/** What a main row gives up when it is deleted: everything that was filled in; the Id Product and the sheet row stay. */
export const clearMain = (row) => ({ ...row, ...BLANK });

export const hasAccount = (row) => Boolean(row.account.trim());

/** Sub rows count 1..n under their main row (a main row has none). */
export function resequence(rows) {
  let order = 0;
  return rows.map((row) => {
    if (row.type === "main") {
      order = 0;
      return row.subOrder === null ? row : { ...row, subOrder: null };
    }
    order += 1;
    return row.subOrder === order ? row : { ...row, subOrder: order };
  });
}

/** The rows with a new sub row after the last sub row of the group `anchorKey` belongs to. */
export function insertSub(rows, anchorKey, sub) {
  let at = rows.findIndex((r) => r.key === anchorKey);
  if (at < 0) return rows;
  while (at > 0 && rows[at].type === "sub") at -= 1; // up to the main row
  const main = rows[at];
  at += 1;
  while (at < rows.length && rows[at].type === "sub") at += 1;
  const next = rows.slice();
  next.splice(at, 0, { ...sub, type: "sub", idProduct: main.idProduct, rowIndex: main.rowIndex });
  return resequence(next);
}

/** Delete of the ticked rows: sub rows go, main rows are cleared. */
export function deleteTicked(rows) {
  let removed = 0;
  let cleared = 0;
  const next = [];
  for (const row of rows) {
    if (!row.del) next.push(row);
    else if (row.type === "sub") removed += 1;
    else {
      cleared += 1;
      next.push(clearMain(row));
    }
  }
  return { rows: resequence(next), removed, cleared };
}

/** "KAIYUAN (COMM)": the Id Product with the description of the row. */
export function idLabel(row) {
  const id = row.idProduct.trim();
  const desc = row.description.trim();
  return id && desc && !id.endsWith(`(${desc})`) ? `${id} (${desc})` : id;
}

/** "KAIYUAN (COMM) -> KY [KAI YUAN]": how a row is named in a message. */
export const rowName = (row) => [idLabel(row) || "(no Id Product)", row.account.trim()].filter(Boolean).join(" → ");

// ---- the captured sheet ----
// captured = { rows } with rows[r][n] = the text of column n of sheet row r (n = 1 is the Id Product, so $2 is the first
// data column), the same numbering the formulas use.

export function capturedFromTable(table) {
  return { rows: (table?.rows ?? []).map((row) => row.map((cell) => String(cell?.value ?? ""))) };
}

const looksLikeAmount = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  if (raw.startsWith("$")) return true;
  return /^-?\d+(?:\.\d+)?$/.test(raw.replace(/[,$]/g, "").replace(/^\((.*)\)$/, "-$1"));
};
const looksLikeRichAmount = (value) => {
  const raw = String(value ?? "").trim();
  return Boolean(raw) && (raw.startsWith("$") || /,\d{3}/.test(raw) || /\d\.\d{1,4}\b/.test(raw));
};

// An empty Id Product with money in the row (a group footer) still gets a row; a bare integer alone could be an id.
function moneyWithoutId(row) {
  if (row.length <= 1 || String(row[1] ?? "").trim()) return false;
  const amounts = row.filter((cell, i) => i > 1 && looksLikeAmount(cell));
  return amounts.length > 0 && (amounts.some(looksLikeRichAmount) || amounts.length >= 2);
}

// One cell that holds several ids ("SUB TOTAL   GRAND TOTAL" or lines) is one row each.
function splitCell(text) {
  const t = text.trim();
  if (!t) return null;
  if (t.includes("\n")) {
    const parts = t.split("\n").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
  }
  const upper = t.toUpperCase();
  if (upper.includes("SUB TOTAL") && upper.includes("GRAND TOTAL")) {
    const parts = t.split(/\s{2,}|\t+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
    const sub = /SUB\s*TOTAL/i.exec(t);
    const grand = /GRAND\s*TOTAL/i.exec(t);
    if (sub && grand) return sub.index < grand.index ? [t.slice(0, grand.index).trim(), t.slice(grand.index).trim()] : [t.slice(0, sub.index).trim(), t.slice(sub.index).trim()];
  }
  return null;
}

/** The main rows of a captured sheet: one per filled Id Product cell, in sheet order. */
export function rowsFromCaptured(captured) {
  const rows = [];
  captured.rows.forEach((row, rowIndex) => {
    if (row.length <= 1) return;
    const id = String(row[1] ?? "");
    if (!id.trim()) {
      if (moneyWithoutId(row)) rows.push(createRow({ idProduct: "", rowIndex }));
      return;
    }
    // Only the 4th sheet row is split this way (the report that prints both totals in one cell).
    const parts = rowIndex === 3 ? splitCell(id) : null;
    (parts ?? [id]).forEach((part) => rows.push(createRow({ idProduct: part.trim(), rowIndex })));
  });
  return rows;
}

// ---- amounts ----

/** Every row's amount (a Decimal, or null when it has no formula / the formula is not valid), by row key. */
export function amountsByKey(rows, captured) {
  return new Map(rows.map((row) => [row.key, rowAmountOf(row, captured)]));
}

/** The total of the rows that are not skipped (a row with no account has no amount). */
export function totalOf(rows, amounts) {
  return sumAmounts(rows.filter((r) => !r.skip && hasAccount(r)).map((r) => amounts.get(r.key)).filter(Boolean));
}

// ---- Submit check ----
const isComm = (row) => /COMM/i.test(row.description);
const groupKey = (row) => `${row.idProduct.trim().toUpperCase()}||${row.description.trim().toUpperCase()}`;

/**
 * The lines Submit sends (/api/datacapture-summary/submit): every row that is not skipped and has an account, in list order.
 * Amounts go as 6-decimal text; the formula goes as the captured numbers, which is what the transaction history shows.
 * A sub row has no description of its own beyond its main row's, so the main row's description rides along.
 */
export function submitLines(rows, amounts, captured) {
  const lines = [];
  let main = null;
  for (const row of rows) {
    if (row.type === "main") main = row;
    if (row.skip || !hasAccount(row)) continue;
    const sub = row.type === "sub";
    const amount = amounts.get(row.key);
    lines.push({
      productType: sub ? "SUB" : "MAIN",
      idProduct: row.idProduct,
      idProductMain: row.idProduct,
      idProductSub: sub ? row.idProduct : null,
      descriptionMain: (sub ? main?.description : row.description) || null,
      descriptionSub: sub ? row.description || null : null,
      formulaVariant: row.formulaVariant,
      displayOrder: lines.length,
      accountId: row.accountId,
      currencyId: row.currencyId,
      sourceColumns: sourceColumnsOf(row.formula, row.idProduct, row.rowIndex) || null,
      sourcePercent: row.sourcePercent || "1",
      enableSourcePercent: true,
      formula: formulaDisplay(row.formula, captured, row.rowIndex),
      processedAmount: amount ? amount.toFixed(6) : "0.000000",
      rateValue: row.rateValue.trim() || null,
    });
  }
  return lines;
}

/**
 * What stops a Submit: { ok, message, problems } with problems = Map(row key -> why). The checks of the old summary:
 * a row with an account needs a valid formula and a currency, the account has to exist, a COMM split has to go in whole
 * (both legs or none), and the total has to be within +-0.05.
 */
export function checkSubmit(rows, amounts) {
  const problems = new Map();
  const known = (row) => row.accountId != null;
  const submitting = rows.filter((r) => !r.skip && hasAccount(r));
  if (submitting.length === 0) return { ok: false, message: "There is nothing to submit: no row has an account.", problems };

  for (const row of submitting) {
    const amount = amounts.get(row.key);
    if (!row.formula.trim()) problems.set(row.key, "No formula");
    else if (amount === null) problems.set(row.key, "The formula is not valid");
    else if (!row.currency.trim()) problems.set(row.key, "No currency");
    else if (!known(row) && !amount.isZero()) problems.set(row.key, "The account could not be found");
  }

  // COMM: legs of one product with an amount; some go in, some are left out (skipped, no account or a wrong account).
  const groups = new Map();
  for (const row of rows) {
    const amount = amounts.get(row.key);
    if (!isComm(row) || !amount || amount.isZero()) continue;
    const list = groups.get(groupKey(row)) ?? [];
    list.push(row);
    groups.set(groupKey(row), list);
  }
  for (const legs of groups.values()) {
    const goes = (r) => !r.skip && hasAccount(r) && known(r);
    if (legs.length < 2 || !legs.some(goes) || legs.every(goes)) continue;
    for (const leg of legs.filter((r) => !goes(r))) problems.set(leg.key, "COMM split is incomplete: the other leg is submitted without this one");
  }

  if (problems.size > 0) {
    const [key, why] = problems.entries().next().value;
    const row = rows.find((r) => r.key === key);
    const more = problems.size > 1 ? ` (and ${problems.size - 1} more)` : "";
    return { ok: false, message: `Cannot submit: ${rowName(row)}: ${why}${more}.`, problems };
  }

  const total = totalOf(rows, amounts);
  if (!totalWithinTolerance(total)) return { ok: false, message: `Total ${formatMoney(total)} is out of tolerance (±0.05); adjust before submitting.`, problems };
  return { ok: true, message: "", problems };
}

