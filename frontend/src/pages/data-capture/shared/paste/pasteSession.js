// The meeting point between the paste modules (core/, vendors/: copied from the old Data Capture, they still call these
// functions by their old names) and the sheet.
//
// A paste runs inside runPasteSession(): the sheet hands over its grid, where the paste starts, the capture type and a way to
// say something to the user; the modules read and replace the grid through getPasteGridModel / replacePasteGridModel;
// when the paste is over the final grid is committed ONCE, so a paste that fills the sheet in several steps is one Undo.
import { convertGridTotals } from "../submitSnapshot.js";

let session = null;

/**
 * init: { grid, anchor: { row, col } | null, captureType, maxCols, notify(message, level), commit(grid) }.
 * Returns true when the paste was taken (fn said so, or the grid was written).
 */
export function runPasteSession(init, fn) {
  const previous = session;
  // session.grid is the working copy: it starts as the sheet's grid and is replaced by every write.
  session = { ...init, start: init.grid };
  try {
    const result = fn();
    // A module that wrote into the grid took the paste, whatever it returned.
    const changed = session.grid !== session.start;
    if (changed) session.commit(session.grid);
    return Boolean(result) || changed;
  } finally {
    session = previous;
  }
}

const live = () => {
  if (!session) throw new Error("paste modules run inside runPasteSession");
  return session;
};

export function getPasteGridModel() {
  return live().grid;
}

export function replacePasteGridModel(grid) {
  live().grid = grid;
}

export function ensurePasteTableInitialized() {
  /* the sheet always has a grid */
}

/** Where the paste starts: { row, col } of the first selected cell (or the keyboard cell), null when none. */
export function getFirstSelectedGridCell() {
  return live().anchor;
}

export function getActiveCaptureType(defaultType = "1.Text") {
  return live().captureType || defaultType;
}
export const getBridgeCaptureType = getActiveCaptureType;

/** The widest the sheet may grow to by this paste (the Bank sheet keeps its columns). */
export function getPasteMaxCols() {
  return live().maxCols;
}

export function notifyPasteUser(message, level = "success") {
  live().notify?.(message, level);
}
export const pushDataCaptureNotification = notifyPasteUser;

// The sheet shows the submit state from its grid, so there is nothing to recompute / commit step by step.
export function recomputeSubmitStateAfterPaste() {}
export function setTableActiveForPaste() {}
export function commitPasteGridCheckpoint() {}

/**
 * End of a successful paste. runConvert: the report's SUB TOTAL / GRAND TOTAL block is put into shape (the old Data Capture did
 * this after every generic paste; it also makes every value upper case).
 */
export function finalizePasteWithOptionalConvert(successCount, { runConvert = false, beforeCommit = null } = {}) {
  if (!(successCount > 0)) return;
  const s = live();
  if (runConvert) s.grid = convertGridTotals(getPasteGridModel());
  beforeCommit?.();
}
