// Which paste module takes the clipboard. The order is the old Data Capture's (see paste/README.md: the helpers come before
// the wide fallbacks, and the two entries - Text and Return - must keep their order or one clipboard is taken by a
// different helper depending on the mode).
import { getClipboardHtml } from "./core/dataCaptureClipboard.js";
import { tryFillGridWithFormatClipboard } from "./core/dataCaptureFormatPasteHandler.js";
import { handleGenericPaste } from "./core/dataCaptureGenericPaste.js";
import { resolveFormatPasteStartRow } from "./core/dataCapturePasteApply.js";
import { autoDetectCaptureTypeFromPaste, parseCitibetPasteData } from "./core/dataCapturePasteDetect.js";
import { tryHandleCitibetAgentPtReportPaste } from "./core/dataCaptureCitibetAgentPtReportPasteHelper.js";
import { tryHandleGamingSoftInvoicePaste } from "./core/dataCaptureGamingSoftInvoicePasteHelper.js";
import { tryHandleKing855WinLossPaste } from "./core/dataCaptureKing855WinLossPasteHelper.js";
import { handleTextModePaste } from "./core/dataCaptureTextPaste.js";
import { tryHandleSectionTotalsPaste } from "./core/dataCaptureSectionTotalsPasteHelper.js";
import { tryHandleFooterOnlySubGrandPaste } from "./core/dataCaptureWinLoseFooterOnlyPasteHelper.js";
import { tryHandleWosWinLossDetailPaste } from "./core/dataCaptureWosWinLossDetailPasteHelper.js";
import { handleCitibetPaste } from "./vendors/dataCaptureCitibetPaste.js";
import { handle4ReturnPaste } from "./vendors/dataCaptureReturnPaste.js";
import { runPasteSession } from "./pasteSession.js";

// The paste modules were written for a paste event: this is one made from { text, html }, with the cell it lands on as target.
function pasteEvent(target, { text = "", html = "" }) {
  const types = [];
  if (html) types.push("text/html");
  if (text || !html) types.push("text/plain");
  return {
    target,
    currentTarget: target,
    preventDefault() {},
    stopPropagation() {},
    clipboardData: {
      types,
      getData: (type) => (type === "text/html" ? html : ["text/plain", "text", "Text"].includes(type) ? text : ""),
    },
  };
}

/**
 * Pastes clip = { text, html } into the grid.
 *  grid: the sheet's grid; anchor: { row, col } the paste starts on; captureType: "1.Text" | "4.RETURN";
 *  maxCols: the widest the paste may make the sheet; notify(message, level): what to tell the user;
 *  commit(grid): receives the grid once the paste is over (one Undo step).
 * @returns {boolean} true when a module took the clipboard
 */
export function pasteIntoSheet({ clip, grid, anchor, captureType, maxCols, notify, commit }) {
  const cell = anchor ?? { row: 0, col: 0 };
  return runPasteSession({ grid, anchor: cell, captureType, maxCols, notify, commit }, () => {
    const e = pasteEvent(cell, clip);
    const pastedData = clip.text ?? "";

    // 4.RETURN keeps its formulas: it never falls back to the generic paste.
    if (captureType === "4.RETURN") return handle4ReturnPaste(e, pastedData);

    // 1.Text (Text, Format and Citibet of the old Data Capture in one).
    // A clipboard that is strictly a Citibet report goes to the Citibet parser; a miss falls through to the rest.
    if (autoDetectCaptureTypeFromPaste(pastedData) === "CITIBET") {
      const parsed = parseCitibetPasteData(pastedData, "CITIBET");
      if (parsed && handleCitibetPaste(e, pastedData, cell, "CITIBET", parsed)) return true;
    }
    const html = getClipboardHtml(e);
    const at = { anchorCell: cell, startRowOverride: resolveFormatPasteStartRow(cell) };
    if (tryHandleGamingSoftInvoicePaste(html, pastedData, at)) return true;
    if (tryHandleKing855WinLossPaste(html, pastedData, at)) return true;
    if (tryHandleWosWinLossDetailPaste(html, pastedData, at)) return true;
    if (tryHandleCitibetAgentPtReportPaste(html, pastedData, at)) return true;
    if (tryHandleSectionTotalsPaste(html, pastedData, at)) return true;
    if (tryHandleFooterOnlySubGrandPaste(html, pastedData, at)) return true;
    // The Format fill core: structure and cell styles of the copied table.
    if (tryFillGridWithFormatClipboard(html, pastedData, { anchorCell: cell, startRow: resolveFormatPasteStartRow(cell), formatShell: false })) return true;
    if (handleTextModePaste(e, pastedData, cell)) return true;
    return Boolean(handleGenericPaste(e, pastedData));
  });
}
