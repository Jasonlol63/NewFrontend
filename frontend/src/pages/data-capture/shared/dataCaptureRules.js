import { addDays, toIsoDate } from "@/lib/date";

// Sheet sizes of the two capture forms. Both start with rows A-Z; a Game company has 20 columns, a Bank form 11.
// Enter on the last row / Tab on the last column, Add Row / Add Col and a paste grow the sheet up to the caps below
// (702 rows = A..ZZ).
export const GAME_GRID = { rows: 26, cols: 20 };
export const BANK_GRID = { rows: 26, cols: 11 };
export { MAX_GRID_COLS, MAX_GRID_ROWS, rowLetter } from "./grid/gridLayout.js";

// The capture type of the sheet: Text covers every report layout (the old Text / Format / Citibet), Return keeps its formulas.
export const CAPTURE_MODES = [
  { value: "1.Text", label: "1.TEXT" },
  { value: "4.RETURN", label: "4.RETURN" },
];

// The six days after today, today and the six days before it, newest first: { value: "2026-10-08", day: 4 } (day = getDay(), the
// weekday name is written in the page language by useDateOptions: "2026-10-08 (THURSDAY)").
export function dateOptions(today = new Date()) {
  return Array.from({ length: 13 }, (_, i) => {
    const d = addDays(today, 6 - i);
    return { value: toIsoDate(d), day: d.getDay() };
  });
}

/** Today as an option value ("2026-10-11"): the date a capture form starts on and goes back to on Reset. */
export const todayValue = (today = new Date()) => toIsoDate(today);


// The Bank form (Bank companies, C168 and a Group's own data) has a fixed process list, not loaded from the backend.
// PROFIT is never kept as a draft; the other three are.
export const BANK_PROCESS_CODES = ["PROFIT", "SALARY", "COMMISSION", "BONUS"];
export const BANK_PROCESSES = BANK_PROCESS_CODES.map((p) => ({ value: p, label: p }));
export const BANK_DRAFT_PROCESSES = new Set(["SALARY", "COMMISSION", "BONUS"]);

/**
 * Which capture form the picked scope uses: Bank companies, C168 (a Game company that captures like a Bank) and the
 * Group's own data (company === null) use the Bank form, every other company the Game form.
 */
export function usesBankForm(user, scope) {
  return scope.company === null || Boolean(user?.is_current_tenant_c168) || Boolean(user?.tenant_has_bank);
}

// "Add Row" / "Add Col": how many rows / columns one click appends to the sheet.
export const ADD_ROW_OPTIONS = ["5", "10", "26", "50"].map((n) => ({ value: n, label: n }));
export const ADD_COL_OPTIONS = ["1", "2", "5", "10"].map((n) => ({ value: n, label: n }));
