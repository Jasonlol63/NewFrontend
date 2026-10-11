// The last step of every paste: a matrix of values (or { value, style, className, colspan, hidden } cells) is written into the
// sheet's grid. Same behaviour as the old Data Capture (padding, TOTAL row alignment, the grid grows to fit), but on the
// plain grid of the paste session instead of the page's DOM.
import { MAX_GRID_ROWS } from "../../grid/gridLayout.js";
import { EMPTY_CELL, growTo } from "../../grid/gridModel.js";
import { parseAndFillHTMLTable } from "./dataCaptureParseGenericHtml.js";
import {
  getFirstSelectedGridCell,
  getPasteGridModel,
  getPasteMaxCols,
  notifyPasteUser,
  replacePasteGridModel,
} from "../pasteSession.js";
import { alignTotalRowsInMatrix, alignTotalRowArray } from "./dataCaptureTotalRowAlign.js";

export function parseGenericHtmlTable(htmlString, startCell) {
  return parseAndFillHTMLTable(htmlString, startCell);
}

// Where a paste starts is { row, col } (the old code passed the DOM cell).
const isAnchor = (a) => a && Number.isFinite(a.row) && Number.isFinite(a.col);

function alignTotalRowsInGrid(grid, startRow, rowCount) {
  const endRow = Math.min(grid.rows, startRow + rowCount);
  let cells = grid.cells;
  for (let r = startRow; r < endRow; r += 1) {
    const values = grid.cells[r].map((cell) => String(cell.value ?? ""));
    const aligned = alignTotalRowArray(values);
    if (aligned === values) continue;
    if (cells === grid.cells) cells = [...grid.cells];
    cells[r] = grid.cells[r].map((cell, c) => {
      const value = aligned[c] ?? "";
      return String(cell.value ?? "") === value ? cell : { ...cell, value, html: undefined };
    });
  }
  return cells === grid.cells ? grid : { ...grid, cells };
}

/** Grows the grid to at least rows x cols, within the caps of the sheet. */
export function ensurePasteGrid(rows, cols) {
  const grid = getPasteGridModel();
  const targetRows = Math.max(1, Math.min(Number(rows) || 1, MAX_GRID_ROWS));
  const targetCols = Math.max(1, Math.min(Number(cols) || 1, Math.max(getPasteMaxCols(), grid.cols)));
  if (targetRows <= grid.rows && targetCols <= grid.cols) return grid;
  const grown = growTo(grid, targetRows, targetCols);
  replacePasteGridModel(grown);
  return grown;
}

export function resolvePasteAnchor(anchor) {
  return isAnchor(anchor) ? { startRow: anchor.row, startCol: anchor.col } : { startRow: 0, startCol: 0 };
}

/** Last row index with any value, -1 on an empty sheet. */
export function findLastFilledGridRow() {
  const grid = getPasteGridModel();
  for (let r = grid.rows - 1; r >= 0; r -= 1) if (grid.cells[r].some((cell) => String(cell.value ?? "").trim())) return r;
  return -1;
}

/** The selected / keyboard cell the paste starts on, if any. */
export function getFormatPasteAnchorCell() {
  return getFirstSelectedGridCell();
}

/** The selected / keyboard cell, else the first cell (row A, column 1). */
export function getDefaultPasteAnchorCell() {
  return getFormatPasteAnchorCell() ?? { row: 0, col: 0 };
}

/** Start row of a Text / Format paste: the selected cell's row, else under the last filled row (row 0 on an empty sheet). */
export function resolveFormatPasteStartRow(anchor = null) {
  const cell = anchor || getFormatPasteAnchorCell();
  if (isAnchor(cell)) return cell.row;
  const last = findLastFilledGridRow();
  return last >= 0 ? last + 1 : 0;
}

export function ensureGridFits(startRow, startCol, matrixRows, matrixCols) {
  const grid = getPasteGridModel();
  if (startRow + matrixRows <= grid.rows && startCol + matrixCols <= grid.cols) return grid;
  return ensurePasteGrid(Math.max(grid.rows, startRow + matrixRows), Math.max(grid.cols, startCol + matrixCols));
}

function padMatrixRows(matrix) {
  if (!matrix?.length) return matrix;
  const width = Math.max(...matrix.map((row) => row.length));
  matrix.forEach((row) => {
    while (row.length < width) row.push("");
  });
  return matrix;
}

/** One cell of the matrix as a patch { value, html?, style?, styleCssText?, className?, colspan?, hidden? }. */
function resolvePasteCellPatch(raw, row, col, options) {
  const { trimValues = false, uppercaseValues = false, transformCell = null } = options;
  const pick = (p) => ({
    value: p.value != null ? String(p.value) : "",
    ...(p.html ? { html: p.html } : {}),
    ...(p.style ? { style: p.style } : {}),
    ...(p.styleCssText ? { styleCssText: p.styleCssText } : {}),
    ...(p.className ? { className: p.className } : {}),
    ...(p.colspan > 1 ? { colspan: p.colspan } : {}),
    ...(p.hidden ? { hidden: true } : {}),
  });

  if (raw && typeof raw === "object" && ("value" in raw || "html" in raw)) return pick(raw);

  let value = raw ?? "";
  if (trimValues) value = String(value).trim();
  if (typeof transformCell === "function") {
    const out = transformCell(value, row, col);
    return out && typeof out === "object" ? pick(out) : { value: out != null ? String(out) : "" };
  }
  if (uppercaseValues) value = String(value).toUpperCase();
  return { value: String(value) };
}

/** Pads the matrix, applies it and (optionally) says how many cells came in. */
export function applyParsedMatrixToGrid(matrix, anchor, options = {}) {
  // deferUndoCheckpoint was the old undo switch: a paste is one undo step now, whatever it does.
  const { successMessage, emptyMessage, dangerOnEmpty = true, deferUndoCheckpoint: _unused, ...gridOptions } = options;
  if (!matrix?.length) return { successCount: 0, changes: [], applied: false, maxRows: 0, maxCols: 0 };

  padMatrixRows(matrix);
  const maxCols = Math.max(...matrix.map((row) => row.length));
  const result = applyDataMatrixToGrid(matrix, anchor, gridOptions);
  if (result.successCount > 0 && successMessage) notifyPasteSuccess(successMessage);
  else if (result.successCount === 0 && emptyMessage) notifyPasteSuccess(emptyMessage, dangerOnEmpty ? "danger" : "success");
  return { ...result, applied: result.successCount > 0, maxRows: matrix.length, maxCols };
}

/**
 * Writes the matrix with its top-left corner on the anchor (or startRowOverride / startColOverride).
 * @returns {{ successCount: number, changes: Array, maxRows?: number, maxCols?: number }}
 */
export function applyDataMatrixToGrid(matrix, anchor, options = {}) {
  const { startColOverride = null, startRowOverride = null, alignTotalRows = true } = options;
  if (!matrix?.length) return { successCount: 0, changes: [] };

  const source = alignTotalRows ? alignTotalRowsInMatrix(matrix) : matrix;
  const maxCols = Math.max(...source.map((row) => row.length));
  const { startRow: anchorRow, startCol: anchorCol } = resolvePasteAnchor(anchor);
  const startRow = startRowOverride != null ? startRowOverride : anchorRow;
  const startCol = startColOverride != null ? startColOverride : anchorCol;

  const grid = ensureGridFits(startRow, startCol, source.length, maxCols);
  // Every touched row is copied once; a cell keeps what the patch does not set (a plain value does not wipe a style).
  const cells = [...grid.cells];
  let successCount = 0;
  source.forEach((line, dr) => {
    const r = startRow + dr;
    if (!cells[r]) return;
    if (cells[r] === grid.cells[r]) cells[r] = [...grid.cells[r]];
    line.forEach((raw, dc) => {
      const c = startCol + dc;
      if (c >= grid.cols) return;
      const patch = resolvePasteCellPatch(raw, dr, dc, options);
      const old = cells[r][c];
      cells[r][c] = { ...(old === EMPTY_CELL ? {} : old), ...patch };
      if (String(patch.value ?? "").trim() !== "") successCount += 1;
    });
  });

  let next = { ...grid, cells };
  if (alignTotalRows) next = alignTotalRowsInGrid(next, startRow, source.length);
  replacePasteGridModel(next);
  return { successCount, changes: [], maxRows: source.length, maxCols };
}

export function notifyPasteSuccess(message, level = "success") {
  notifyPasteUser(message, level);
}
