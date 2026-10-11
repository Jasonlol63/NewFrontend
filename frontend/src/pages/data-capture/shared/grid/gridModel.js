// The capture sheet as plain data: { rows, cols, cells } with cells[r][c] = { value, ...extras }. Every function returns a new
// grid (untouched rows and cells keep their identity, so memoized cells only re-render when they changed) or the same
// grid when there is nothing to change.
// Rows are labelled A.. by index (rowLetter), columns 1.. by index, so inserting or deleting just renumbers them.

export const EMPTY_CELL = Object.freeze({ value: "" });

const blankRow = (cols) => Array.from({ length: cols }, () => EMPTY_CELL);
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

export function createGrid(rows, cols) {
  return { rows, cols, cells: Array.from({ length: rows }, () => blankRow(cols)) };
}

export const cellValue = (grid, r, c) => grid.cells[r]?.[c]?.value ?? "";

export function setCell(grid, r, c, patch) {
  const cell = grid.cells[r]?.[c];
  if (!cell) return grid;
  const next = { ...cell, ...patch };
  if (next.value === cell.value && Object.keys(patch).every((k) => cell[k] === patch[k])) return grid;
  return { ...grid, cells: grid.cells.map((row, ri) => (ri === r ? row.map((x, ci) => (ci === c ? next : x)) : row)) };
}

/** At least rows x cols (never shrinks). */
export function growTo(grid, rows, cols) {
  const R = Math.max(grid.rows, rows);
  const C = Math.max(grid.cols, cols);
  if (R === grid.rows && C === grid.cols) return grid;
  const cells = grid.cells.map((row) => (C > grid.cols ? [...row, ...blankRow(C - grid.cols)] : row));
  while (cells.length < R) cells.push(blankRow(C));
  return { rows: R, cols: C, cells };
}

export const addRows = (grid, count) => growTo(grid, grid.rows + count, grid.cols);
export const addCols = (grid, count) => growTo(grid, grid.rows, grid.cols + count);

export function insertRow(grid, at) {
  const i = clamp(at, 0, grid.rows);
  const cells = [...grid.cells.slice(0, i), blankRow(grid.cols), ...grid.cells.slice(i)];
  return { ...grid, rows: cells.length, cells };
}

export function insertCol(grid, at) {
  const i = clamp(at, 0, grid.cols);
  const cells = grid.cells.map((row) => [...row.slice(0, i), EMPTY_CELL, ...row.slice(i)]);
  return { ...grid, cols: grid.cols + 1, cells };
}

/** Removes the rows with these indexes; the last remaining row is never removed. */
export function deleteRows(grid, indexes) {
  const drop = new Set(indexes);
  const cells = grid.cells.filter((_, r) => !drop.has(r));
  if (cells.length === grid.rows || cells.length === 0) return grid;
  return { ...grid, rows: cells.length, cells };
}

export function deleteCols(grid, indexes) {
  const drop = new Set(indexes);
  const cells = grid.cells.map((row) => row.filter((_, c) => !drop.has(c)));
  if (!cells[0]?.length) return grid;
  return { ...grid, cols: cells[0].length, cells };
}

/** Empties the cells of the given { r1, c1, r2, c2 } ranges (inclusive, any order). */
export function clearRanges(grid, ranges) {
  let changed = false;
  const cells = grid.cells.map((row, r) =>
    row.map((cell, c) => {
      if (!inRanges(ranges, r, c) || cell === EMPTY_CELL || (!cell.value && Object.keys(cell).length === 1)) return cell;
      changed = true;
      return EMPTY_CELL;
    })
  );
  return changed ? { ...grid, cells } : grid;
}

export function clearAll(grid) {
  return clearRanges(grid, [{ r1: 0, c1: 0, r2: grid.rows - 1, c2: grid.cols - 1 }]);
}

/** Delete > Shift cells left: the cells of the box are removed and the rest of each row moves left. */
export function shiftCellsLeft(grid, { r1, r2, c1, c2 }) {
  const n = c2 - c1 + 1;
  const cells = grid.cells.map((row, r) => (r < r1 || r > r2 ? row : [...row.slice(0, c1), ...row.slice(c2 + 1), ...blankRow(n)]));
  return { ...grid, cells };
}

/** Delete > Shift cells up. */
export function shiftCellsUp(grid, { r1, r2, c1, c2 }) {
  const n = r2 - r1 + 1;
  const cells = grid.cells.map((row) => [...row]);
  for (let c = c1; c <= c2; c += 1) {
    for (let r = r1; r < grid.rows; r += 1) cells[r][c] = r + n < grid.rows ? grid.cells[r + n][c] : EMPTY_CELL;
  }
  return { ...grid, cells };
}

/** Writes a matrix of strings (or { value, ... } cells) with its top-left corner at (r, c), growing the sheet as needed. */
export function writeMatrix(grid, r, c, matrix) {
  if (!matrix.length) return grid;
  const width = Math.max(...matrix.map((row) => row.length));
  const base = growTo(grid, r + matrix.length, c + width);
  const cells = base.cells.map((row) => [...row]);
  matrix.forEach((line, dr) =>
    line.forEach((raw, dc) => {
      const cell = typeof raw === "object" && raw ? raw : { value: String(raw ?? "") };
      cells[r + dr][c + dc] = cell.value || Object.keys(cell).length > 1 ? cell : EMPTY_CELL;
    })
  );
  return { ...base, cells };
}

export const rowHasData = (grid, r) => grid.cells[r].some((cell) => cell.value.trim() !== "");
export const hasData = (grid) => grid.cells.some((_, r) => rowHasData(grid, r));

/** Tab-separated text of the box around the given ranges, the way a spreadsheet copies it. */
export function rangesToText(grid, ranges) {
  const rs = ranges.flatMap((g) => [g.r1, g.r2]);
  const cs = ranges.flatMap((g) => [g.c1, g.c2]);
  const [r1, r2, c1, c2] = [Math.min(...rs), Math.max(...rs), Math.min(...cs), Math.max(...cs)];
  const lines = [];
  for (let r = r1; r <= r2; r += 1) {
    const line = [];
    for (let c = c1; c <= c2; c += 1) line.push(inRanges(ranges, r, c) ? grid.cells[r][c].value : "");
    lines.push(line.join("\t"));
  }
  return lines.join("\n");
}

export function inRanges(ranges, r, c) {
  return ranges.some((g) => r >= Math.min(g.r1, g.r2) && r <= Math.max(g.r1, g.r2) && c >= Math.min(g.c1, g.c2) && c <= Math.max(g.c1, g.c2));
}
