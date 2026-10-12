// What Submit hands to the Data Capture Summary: the sheet as a snapshot, with the SUB TOTAL / GRAND TOTAL block of a report
// brought into the shape the summary expects.
//
// snapshot = {
//   headers: ["", "1", "2", ...], rowCount, colCount (data columns + 1),
//   rows: [[{ type: "header", value: "A" }, { type: "data", value: "TEXT", col: 0 }, ...], ...],
// }
import { rowLetter } from "./grid/gridLayout.js";
import { alignSnapshotRow } from "./paste/core/dataCaptureTotalRowAlign.js";
import { createGrid, hasData } from "./grid/gridModel.js";

// "(1,234.50)" -> "-1,234.50", "($12)" -> "-$12"; anything else is left alone.
export function bracketedToNegative(value) {
  const m = /^\((\$?)([\d,]+(?:\.\d+)?)\)$/.exec(value.trim());
  if (!m) return value;
  const [int, dec] = m[2].replace(/,/g, "").split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `-${m[1]}${grouped}${dec ? `.${dec}` : ""}`;
}

// ---- the sheet as a snapshot (the same rules the old Data Capture used) ----
const LABEL_FIRST_COLUMNS = new Set(["AGENT", "PLAYER", "MEMBER", "USER"]);

const placeholder = (value) => !String(value || "").trim();

function swapCells(a, b) {
  [a.value, b.value] = [b.value, a.value];
  [a.colspan, b.colspan] = [b.colspan, a.colspan];
  [a.col, b.col] = [b.col, a.col];
}

// An amount: $12, 1,234.50, (12), -3 ...
function looksLikeAmount(value) {
  const raw = String(value || "").replace(/ /g, " ").trim();
  if (!raw) return false;
  if (raw.startsWith("$")) return true;
  return /^-?d+(?:.d+)?$/.test(raw.replace(/[,$]/g, "").replace(/^((.*))$/, "-$1"));
}

// An amount that cannot be a product id: currency sign, thousands separator or decimals (a bare integer can be an id).
function looksLikeRichAmount(value) {
  const raw = String(value || "").replace(/ /g, " ").trim();
  return Boolean(raw) && (raw.startsWith("$") || /,d{3}/.test(raw) || /d.d{1,4}/.test(raw));
}

// Column 1 is the Id Product. When a row has nothing there, the first real text of the row moves into it (a report that
// starts its rows with empty columns), but not an amount of a SUB TOTAL line, which stays under its own column.
function normalizeIdProduct(row) {
  if (row.length <= 1) return;
  const first = row[1];
  if (first?.type !== "data" || !placeholder(first.value)) return;
  for (let i = 2; i < row.length; i += 1) {
    const cell = row[i];
    if (cell?.type !== "data") continue;
    const candidate = String(cell.value || "").trim();
    if (!candidate || LABEL_FIRST_COLUMNS.has(candidate.toUpperCase())) continue;
    if (looksLikeAmount(candidate)) {
      let leadingEmpty = 0;
      for (let j = 1; j < i; j += 1) {
        if (String(row[j]?.value || "").trim()) break;
        leadingEmpty += 1;
      }
      if (leadingEmpty >= 2) {
        const amounts = row.filter((c, idx) => idx > 1 && c?.type === "data" && looksLikeAmount(c.value)).length;
        if (looksLikeRichAmount(candidate) || amounts >= 2) continue;
      }
    }
    swapCells(first, cell);
    return;
  }
}

/** The sheet as a snapshot: every value upper case, bracketed amounts negative, the Id Product and TOTAL columns settled. */
export function gridToSnapshot(grid) {
  const all = grid.cells.map((cells, r) => {
    const row = [{ type: "header", value: rowLetter(r) }];
    cells.forEach((cell, c) => {
      if (cell.hidden && !String(cell.value || "").trim()) return;
      const colspan = cell.colspan > 1 ? cell.colspan : undefined;
      row.push({ type: "data", value: bracketedToNegative(String(cell.value || "").trim().toUpperCase()), col: c, ...(colspan ? { colspan } : {}) });
    });
    normalizeIdProduct(row);
    const aligned = alignSnapshotRow(row);
    return aligned;
  });
  const width = Math.max(0, ...all.map((row) => row.length - 1));
  all.forEach((row) => {
    for (let i = row.length - 1; i < width; i += 1) row.push({ type: "data", value: "", col: i });
  });
  return { headers: ["", ...Array.from({ length: width }, (_, c) => String(c + 1))], rows: all, rowCount: all.length, colCount: width + 1 };
}

/** The other way: a snapshot as a grid (values only, colspans kept). */
export function snapshotToGrid(snapshot) {
  const rows = snapshot.rowCount || snapshot.rows.length;
  const cols = Math.max(1, snapshot.colCount - 1);
  const grid = createGrid(rows, cols);
  grid.cells = grid.cells.map((row) => [...row]);
  snapshot.rows.forEach((row, r) => {
    row.forEach((cell, i) => {
      if (cell?.type !== "data") return;
      const c = typeof cell.col === "number" ? cell.col : i - 1;
      if (c < 0 || c >= cols || !grid.cells[r]) return;
      grid.cells[r][c] = { value: cell.value || "", ...(cell.colspan > 1 ? { colspan: cell.colspan } : {}) };
      for (let k = 1; k < (cell.colspan || 1); k += 1) if (c + k < cols) grid.cells[r][c + k] = { value: "", hidden: true };
    });
  });
  return grid;
}

/** A grid after the SUB TOTAL / GRAND TOTAL block was brought into shape (what a generic paste runs at its end). */
export const convertGridTotals = (grid) => snapshotToGrid(convertTotals(gridToSnapshot(grid)));

const rowFilled = (row) => row.some((cell) => cell.type === "data" && cell.value.trim() !== "");
const dataText = (row, i) => (row[i + 1]?.type === "data" ? row[i + 1].value.trim() : "");
const has = (text, label) => text.toUpperCase().includes(label);
const dataCells = (row) => row.filter((cell) => cell.type === "data");
const nonEmpty = (row) => dataCells(row).filter((cell) => cell.value.trim() !== "").map((cell) => cell.value.trim());

function totalRow(index, values, width) {
  return [{ type: "header", value: rowLetter(index) }, ...Array.from({ length: width }, (_, i) => ({ type: "data", value: i < values.length ? String(values[i]).toUpperCase() : "", col: i }))];
}

/**
 * Some reports print "SUB TOTAL | GRAND TOTAL" side by side in one row and the two columns of figures under it. The summary
 * wants a SUB TOTAL row and a GRAND TOTAL row, so that block is rewritten into those two rows (the rows after it move up).
 * A snapshot without that block comes back unchanged.
 */
export function convertTotals(snapshot) {
  const rows = snapshot.rows;
  const firstWith = (label) => rows.findIndex((row) => has(dataText(row, 0), label) || has(dataText(row, 1), label));
  const at = firstWith("SUB TOTAL");
  // Both labels must be on the same row (SUB TOTAL first, GRAND TOTAL second); anything else is another layout.
  if (at < 0 || at !== firstWith("GRAND TOTAL") || !has(dataText(rows[at], 0), "SUB TOTAL") || !has(dataText(rows[at], 1), "GRAND TOTAL")) return snapshot;

  const head = rows[at];
  const sub = ["SUB TOTAL"];
  const grand = ["GRAND TOTAL"];
  const third = head[3]?.type === "data" ? head[3].value.trim() : "";
  if (third) grand.push(third.toUpperCase());

  let next = at + 1;
  const expected = at > 0 ? dataCells(rows[at - 1]).length : 0;
  while (next < rows.length) {
    const cells = nonEmpty(rows[next]);
    if (cells.length === 2 && !cells[0].toUpperCase().includes("TOTAL") && !cells[1].toUpperCase().includes("TOTAL")) {
      sub.push(cells[0]);
      grand.push(cells[1]);
    } else if (cells.length === 1) {
      (sub.length > grand.length ? grand : sub).push(cells[0]);
    } else break;
    next += 1;
  }
  if (sub.length <= 1 && grand.length <= 1) return snapshot;

  const width = Math.max(sub.length, grand.length, expected);
  const merged = [...rows.slice(0, at), totalRow(at, sub, width), totalRow(at + 1, grand, width), ...rows.slice(next)];
  merged.forEach((row, i) => {
    if (i >= at + 2) row[0] = { type: "header", value: rowLetter(i) };
  });
  // Every row is at least as wide as the new block.
  const padded = merged.map((row) => {
    const out = [...row];
    for (let i = out.length - 1; i < width; i += 1) out.push({ type: "data", value: "", col: i });
    return out;
  });
  return { headers: ["", ...Array.from({ length: width }, (_, i) => String(i + 1))], rows: padded, rowCount: padded.length, colCount: width + 1 };
}

/** Trailing empty rows are dropped. */
export function trimEmptyRows(snapshot) {
  let last = snapshot.rows.length - 1;
  while (last >= 0 && !rowFilled(snapshot.rows[last])) last -= 1;
  if (last === snapshot.rows.length - 1) return snapshot;
  const rows = snapshot.rows.slice(0, last + 1);
  return { ...snapshot, rows, rowCount: rows.length };
}

/** The snapshot Submit sends on, or null when the sheet is empty. */
export function buildSubmission(grid) {
  if (!hasData(grid)) return null;
  return trimEmptyRows(convertTotals(gridToSnapshot(grid)));
}

// ---- hand-off to the summary page ----
// The router state carries it too, this copy keeps the summary alive across a reload.
const SESSION_KEY = "dc-capture-session";

/** capture: { date, process, description, currency, remark, captureType, table } */
export function saveCaptureSession(capture) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(capture));
  } catch {
    /* storage full or blocked: the router state still carries it */
  }
}

export function loadCaptureSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null");
  } catch {
    return null;
  }
}

/** The copy is of no use once the summary was submitted. */
export function clearCaptureSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
