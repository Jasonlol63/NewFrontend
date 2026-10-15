import { useCallback, useMemo, useReducer, useState } from "react";
import { MAX_GRID_COLS, MAX_GRID_ROWS } from "../dataCaptureRules";
import {
  addCols,
  addRows,
  clearAll,
  clearRanges,
  createGrid,
  deleteCols,
  deleteRows,
  growTo,
  hasData,
  inRanges,
  insertCol,
  insertRow,
  rangesToText,
  setCell,
  shiftCellsLeft,
  shiftCellsUp,
  writeMatrix,
} from "./gridModel";

const MAX_HISTORY = 50;

// A cell is one line (typing already turns a line break into a space): a pasted cell of several lines is joined with spaces.
const ONE_LINE = /\s*[\r\n]+\s*/g;
function oneLineCells(grid) {
  let changed = false;
  const cells = grid.cells.map((row) =>
    row.map((cell) => {
      if (typeof cell?.value !== "string" || !/[\r\n]/.test(cell.value)) return cell;
      changed = true;
      return { ...cell, value: cell.value.trim().replace(ONE_LINE, " "), html: undefined };
    })
  );
  return changed ? { ...grid, cells } : grid;
}

// Grid + undo stack. Typing goes straight into the grid ("set", no history: the browser undoes text inside a cell);
// everything else (clear, delete, insert, paste, add rows) is one undo step ("do").
function reducer(state, action) {
  switch (action.type) {
    case "set": {
      const grid = action.fn(state.grid);
      return grid === state.grid ? state : { ...state, grid };
    }
    case "do": {
      const grid = action.fn(state.grid);
      if (grid === state.grid) return state;
      return { grid, past: [...state.past, state.grid].slice(-MAX_HISTORY) };
    }
    case "undo": {
      if (!state.past.length) return state;
      return { grid: state.past[state.past.length - 1], past: state.past.slice(0, -1) };
    }
    case "replace":
      return { grid: action.grid, past: [] };
    default:
      return state;
  }
}

const box = (r1, c1, r2, c2) => ({ r1, c1, r2, c2 });
const bounds = (ranges) => {
  const rs = ranges.flatMap((g) => [g.r1, g.r2]);
  const cs = ranges.flatMap((g) => [g.c1, g.c2]);
  return { r1: Math.min(...rs), r2: Math.max(...rs), c1: Math.min(...cs), c2: Math.max(...cs) };
};
const span = (a, b) => {
  const out = [];
  for (let i = Math.min(a, b); i <= Math.max(a, b); i += 1) out.push(i);
  return out;
};

/**
 * State of the capture sheet: the grid, its undo history, the selection (a list of boxes, Ctrl adds boxes), the cell that
 * is being typed in, and the actions of the context menus / keyboard. Pass the initial { rows, cols }.
 */
export function useCaptureGrid({ rows, cols }) {
  const [{ grid, past }, dispatch] = useReducer(reducer, null, () => ({ grid: createGrid(rows, cols), past: [] }));
  // ranges: the selected boxes; active: where the keyboard is (the corner a drag started from).
  const [selection, setSelection] = useState({ ranges: [], active: null });
  const [editing, setEditing] = useState(null);
  const { ranges, active } = selection;

  const set = useCallback((fn) => dispatch({ type: "set", fn }), []);
  const run = useCallback((fn) => dispatch({ type: "do", fn }), []);

  // ---- selection ----
  const selectOnly = useCallback((r, c) => setSelection({ ranges: [box(r, c, r, c)], active: { r, c } }), []);
  const selectCell = useCallback((r, c, { add = false, extend = false } = {}) => {
    setSelection((s) => {
      if (extend && s.active) return { ranges: [box(s.active.r, s.active.c, r, c)], active: s.active };
      if (!add) return { ranges: [box(r, c, r, c)], active: { r, c } };
      // Ctrl: toggle the cell as its own box.
      const same = s.ranges.findIndex((g) => g.r1 === r && g.r2 === r && g.c1 === c && g.c2 === c);
      if (same >= 0) return { ...s, ranges: s.ranges.filter((_, i) => i !== same) };
      return { ranges: [...s.ranges, box(r, c, r, c)], active: { r, c } };
    });
  }, []);
  // Drag: the last box follows the pointer, from the cell the drag started on.
  const dragTo = useCallback((from, r, c) => {
    setSelection((s) => {
      const last = s.ranges[s.ranges.length - 1];
      if (last && last.r2 === r && last.c2 === c) return s;
      return { ...s, ranges: [...s.ranges.slice(0, -1), box(from.r, from.c, r, c)] };
    });
  }, []);
  const selectRows = useCallback((a, b, add = false) => {
    setSelection((s) => ({ ranges: [...(add ? s.ranges : []), box(Math.min(a, b), 0, Math.max(a, b), Infinity)], active: { r: a, c: 0 } }));
  }, []);
  const selectCols = useCallback((a, b, add = false) => {
    setSelection((s) => ({ ranges: [...(add ? s.ranges : []), box(0, Math.min(a, b), Infinity, Math.max(a, b))], active: { r: 0, c: a } }));
  }, []);
  const selectAll = useCallback(() => setSelection((s) => ({ ranges: [box(0, 0, Infinity, Infinity)], active: s.active ?? { r: 0, c: 0 } })), []);
  const clearSelection = useCallback(() => setSelection({ ranges: [], active: null }), []);

  // Infinity in a box means "to the edge of the sheet"; the clamped ranges are what the actions work on.
  const live = useMemo(
    () => ranges.map((g) => box(g.r1, g.c1, Math.min(g.r2, grid.rows - 1), Math.min(g.c2, grid.cols - 1))).filter((g) => g.r1 < grid.rows && g.c1 < grid.cols),
    [ranges, grid.rows, grid.cols]
  );
  const isSelected = useCallback((r, c) => inRanges(ranges, r, c), [ranges]);
  // Rows / columns holding a selected cell light up their headers.
  const { hotRows, hotCols } = useMemo(() => {
    const hr = new Set();
    const hc = new Set();
    live.forEach((g) => {
      span(g.r1, g.r2).forEach((r) => hr.add(r));
      span(g.c1, g.c2).forEach((c) => hc.add(c));
    });
    return { hotRows: hr, hotCols: hc };
  }, [live]);

  const moveActive = useCallback(
    (dr, dc) => {
      const from = active ?? { r: 0, c: 0 };
      selectOnly(Math.min(Math.max(from.r + dr, 0), grid.rows - 1), Math.min(Math.max(from.c + dc, 0), grid.cols - 1));
    },
    [active, grid.rows, grid.cols, selectOnly]
  );

  // ---- editing ----
  // Typing replaces what a paste had put there, formatting included.
  const setValue = useCallback((r, c, value) => set((g) => setCell(g, r, c, { value, html: undefined })), [set]);
  const startEdit = useCallback((r, c) => {
    setEditing({ r, c });
    setSelection({ ranges: [box(r, c, r, c)], active: { r, c } });
  }, []);
  const stopEdit = useCallback(() => setEditing(null), []);

  // ---- actions on the selection / the sheet ----
  const clearSelected = useCallback(() => live.length && run((g) => clearRanges(g, live)), [live, run]);
  const resetGrid = useCallback(
    (next) => {
      dispatch({ type: "replace", grid: next ?? createGrid(rows, cols) });
      setSelection({ ranges: [], active: null });
      setEditing(null);
    },
    [rows, cols]
  );
  const clearSheet = useCallback(() => run(clearAll), [run]);

  const structural = useCallback(
    (fn) => {
      run(fn);
      setSelection({ ranges: [], active: null });
      setEditing(null);
    },
    [run]
  );
  const rowAt = active?.r ?? 0;
  const colAt = active?.c ?? 0;
  const roomRows = (n) => grid.rows + n <= MAX_GRID_ROWS;
  const roomCols = (n) => grid.cols + n <= MAX_GRID_COLS;

  const actions = {
    insertRowAbove: (r = rowAt) => roomRows(1) && structural((g) => insertRow(g, r)),
    insertRowBelow: (r = rowAt) => roomRows(1) && structural((g) => insertRow(g, r + 1)),
    insertColLeft: (c = colAt) => roomCols(1) && structural((g) => insertCol(g, c)),
    insertColRight: (c = colAt) => roomCols(1) && structural((g) => insertCol(g, c + 1)),
    // Delete dialog / row + column menus. rows / cols: the indexes the action works on (default: the selection).
    deleteRows: (idx) => structural((g) => deleteRows(g, idx ?? [...hotRows])),
    deleteCols: (idx) => structural((g) => deleteCols(g, idx ?? [...hotCols])),
    clearRows: (idx) => run((g) => clearRanges(g, (idx ?? [...hotRows]).map((r) => box(r, 0, r, g.cols - 1)))),
    clearCols: (idx) => run((g) => clearRanges(g, (idx ?? [...hotCols]).map((c) => box(0, c, g.rows - 1, c)))),
    shiftLeft: () => live.length && structural((g) => shiftCellsLeft(g, bounds(live))),
    shiftUp: () => live.length && structural((g) => shiftCellsUp(g, bounds(live))),
    // Add Row / Add Col are undo steps; growTo (Enter on the last row, Tab on the last column) is not.
    addRows: (n) => roomRows(n) && run((g) => addRows(g, n)),
    addCols: (n) => roomCols(n) && run((g) => addCols(g, n)),
    growTo: (r, c) => set((g) => growTo(g, Math.min(r, MAX_GRID_ROWS), Math.min(c, MAX_GRID_COLS))),
    // A paste: the matrix lands with its top-left corner on the first selected cell (or at (r, c) when given).
    paste: (matrix, at) => {
      const from = at ?? (live.length ? { r: bounds(live).r1, c: bounds(live).c1 } : { r: rowAt, c: colAt });
      // What does not fit under the caps (702 rows, 50 columns) is left out.
      const fit = matrix.slice(0, Math.max(0, MAX_GRID_ROWS - from.r)).map((line) => line.slice(0, Math.max(0, MAX_GRID_COLS - from.c)));
      run((g) => oneLineCells(writeMatrix(g, from.r, from.c, fit)));
    },
    // A finished paste hands the whole new grid over: one undo step.
    replaceGrid: (next) => run(() => oneLineCells(next)),
    undo: () => dispatch({ type: "undo" }),
    copyText: () => (live.length ? rangesToText(grid, live) : ""),
  };

  return {
    grid,
    filled: useMemo(() => hasData(grid), [grid]),
    canUndo: past.length > 0,
    ranges,
    active,
    editing,
    isSelected,
    hotRows,
    hotCols,
    bounds: live.length ? bounds(live) : null,
    selectCell,
    selectOnly,
    dragTo,
    selectRows,
    selectCols,
    selectAll,
    clearSelection,
    moveActive,
    setValue,
    startEdit,
    stopEdit,
    clearSelected,
    clearSheet,
    resetGrid,
    actions,
  };
}
