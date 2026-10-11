/**
 * Win/Loss report with product sections and "<Section> Total =" footers - scoped only.
 *
 * Unique to this report (OBET style agent report: Sport / E-Games ...):
 * - a line holding one cell (the section title: "Sport", "E-Games")
 * - agent rows of 23 cells: user, first name, wagers, turnover, valid amount, ... a money figure per column
 * - a footer per section "Sport Total =" and a last "Total =" with only the figures: they have no user / first name /
 *   wagers cells, so they have to be moved right until the figures sit under the Turnover column of the agent rows
 *
 * Why plain text only: the page is a DataTables grid with fixed columns, its HTML copy carries the left column and the
 * header again (hundreds of columns), while text/plain is the clean grid.
 *
 * Other Data Capture pastes must not enter this path: the shape is checked strictly (sections + agent rows of one width +
 * "Total =" footers) and every other known report is excluded first.
 */

import { applyDataMatrixToGrid, notifyPasteSuccess } from "./dataCapturePasteApply.js";

const TOTAL_LABEL_RE = /^(?:.+\s)?TOTAL\s*=$/i;
const GRAND_LABEL_RE = /^TOTAL\s*=$/i;

function normalizeClipboardText(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/ /g, " ");
}

function cellText(cell) {
  return String(cell ?? "")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isFigure(text) {
  const cleaned = cellText(text).replace(/,/g, "").replace(/^\((.*)\)$/, "-$1");
  return /^-?\d+(?:\.\d+)?$/.test(cleaned);
}

/** Reports that have their own helper (or a "Total" of another kind): never claimed here. */
function looksLikeForeignReport(text) {
  if (/upline\s+payment|downline\s+payment|my\s+earnings/i.test(text)) return true;
  if (/\bSUB\s*TOTAL\b|\bGRAND\s*TOTAL\b/i.test(text)) return true;
  if (/BET\s*COUNTS/i.test(text) && /\bSENIOR\b/i.test(text)) return true;
  if (/PRODUCT BRAND/i.test(text) || /EXTRA FEE/i.test(text)) return true;
  if (/Showing\s+\d+\s+to\s+\d+\s+of\s+\d+/i.test(text)) return true;
  return false;
}

/** Only sure when it really is this report. Better to miss than to take another report's clipboard. */
export function looksLikeSectionTotalsReport(pastedData, html = "") {
  void html;
  const text = normalizeClipboardText(pastedData);
  if (text.length < 80 || !text.includes("\t")) return false;
  if (looksLikeForeignReport(text)) return false;
  return Boolean(classify(text));
}

/** @returns {{ sections: number, body: string[][], totals: number } | null} rows classified, or null when it is not this shape */
function classify(text) {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  if (lines.length < 5) return null;
  const rows = lines.map((line) => line.split("\t").map(cellText));

  const kinds = rows.map((cells) => {
    if (cells.length === 1) return TOTAL_LABEL_RE.test(cells[0]) ? "other" : "section";
    if (TOTAL_LABEL_RE.test(cells[0]) && cells.length >= 6 && cells.slice(1).every(isFigure)) return "total";
    if (cells.length >= 12 && cells.filter(isFigure).length >= 6) return "body";
    return "other";
  });
  if (kinds.includes("other")) return null;

  const body = rows.filter((_, i) => kinds[i] === "body");
  const totals = rows.filter((_, i) => kinds[i] === "total");
  const sections = kinds.filter((k) => k === "section").length;
  if (sections < 1 || body.length < 2 || totals.length < 2) return null;
  if (!totals.some((cells) => GRAND_LABEL_RE.test(cells[0]))) return null;

  const width = Math.max(...body.map((cells) => cells.length));
  if (width < 15) return null;
  if (body.filter((cells) => cells.length === width).length < Math.ceil(body.length * 0.8)) return null;
  // The footers hold figures only: they must be narrower than the agent rows (the missing user / name / wagers cells).
  if (totals.some((cells) => cells.length > width)) return null;

  return { rows, kinds, width };
}

/**
 * @returns {string[][] | null}
 */
export function tryBuildSectionTotalsMatrix(pastedData, html) {
  void html;
  const text = normalizeClipboardText(pastedData);
  if (!looksLikeSectionTotalsReport(text)) return null;
  const found = classify(text);
  if (!found) return null;

  const { rows, kinds, width } = found;
  return rows.map((cells, i) => {
    if (kinds[i] === "total") {
      // label, the blanks of the missing columns, then the figures: they land under the same columns as the agent rows.
      const gap = Math.max(0, width - cells.length);
      return [cells[0], ...Array(gap).fill(""), ...cells.slice(1)];
    }
    return [...cells, ...Array(Math.max(0, width - cells.length)).fill("")];
  });
}

export function tryHandleSectionTotalsPaste(html, pastedData, applyOptions = {}) {
  const matrix = tryBuildSectionTotalsMatrix(pastedData, html);
  if (!matrix?.length) return false;

  const { successCount, maxRows, maxCols } = applyDataMatrixToGrid(matrix, applyOptions.anchorCell || null, {
    alignTotalRows: false,
    uppercaseValues: false,
    trimValues: false,
    startRowOverride: applyOptions.startRowOverride,
    startColOverride: applyOptions.startColOverride,
  });
  if (successCount <= 0) return false;
  notifyPasteSuccess(`成功粘贴 Win/Loss (section totals) ${maxRows} 行 x ${maxCols} 列`);
  return true;
}
