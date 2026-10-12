// The paste modules still say things in Chinese ("成功粘贴 12 个单元格 (3 行 x 4 列)!") or in English ("Successfully pasted 12 cells
// (3 rows x 4 cols)!"). describePasteNotice turns the ones they use into [key, params] pieces of the "capture:paste.*" texts, and
// translatePasteNotice writes them in the page language. A message it does not know is shown as it is.
const TAIL = {
  已保持Excel原始格式: "tail.excel",
  已保持PDF原始格式: "tail.pdf",
  已保持表格行格式: "tail.tableRow",
  已按Excel矩阵排列: "tail.matrix",
  已在1: "tail.format",
};

const LABEL_KEYS = { 发票: "labels.invoice" };

/** The pieces of a paste message, in order: [[key, params], ...], or null when the message is not a known one. */
export function describePasteNotice(message) {
  const raw = String(message ?? "").trim();
  let m;

  // "[label：]成功粘贴 N 个单元格 (R 行 x C 列)[，suffix]!  [按 Ctrl+Z 可撤销]"
  if ((m = /^(?:(.+?)[:：]\s*)?成功粘贴 (\d+) 个单元格 \((\d+) 行 x (\d+) 列\)(?:，(.+?))?!(?: 按 Ctrl\+Z 可撤销)?$/.exec(raw))) {
    const [, label, cells, rows, cols, suffix] = m;
    const tail = suffix ? TAIL[Object.keys(TAIL).find((k) => suffix.startsWith(k))] : raw.includes("Ctrl+Z") ? "tail.undo" : null;
    return [[label ? "cellsLabeled" : "cells", { label, cells, rows, cols }], ...(tail ? [[tail]] : [])];
  }
  // "Successfully pasted N cells (R rows x C cols)![ Press Ctrl+Z to undo]"
  if ((m = /^Successfully pasted (\d+) cells \((\d+) rows x (\d+) cols\)!(?: Press Ctrl\+Z to undo)?$/.exec(raw))) {
    return [["cells", { cells: m[1], rows: m[2], cols: m[3] }], ...(raw.includes("Ctrl+Z") ? [["tail.undo"]] : [])];
  }
  // "Successfully pasted Excel format (N cells, R rows x C cols)!"
  if ((m = /^Successfully pasted Excel format \((\d+) cells, (\d+) rows x (\d+) cols\)!$/.exec(raw))) {
    return [["cells", { cells: m[1], rows: m[2], cols: m[3] }], ["tail.excel"]];
  }
  if ((m = /^Successfully pasted (\d+) cells in (\d+) columns!$/.exec(raw))) return [["cellsInCols", { cells: m[1], cols: m[2] }]];
  if ((m = /^Successfully pasted cells in (\d+) columns!$/.exec(raw))) return [["colsOnly", { cols: m[1] }]];
  // "Successfully pasted HTML table (R rows x C cols)![ Press Ctrl+Z to undo]"
  if ((m = /^Successfully pasted HTML table \((\d+) rows x (\d+) cols\)!(?: Press Ctrl\+Z to undo)?$/.exec(raw))) {
    return [["htmlTable", { rows: m[1], cols: m[2] }], ...(raw.includes("Ctrl+Z") ? [["tail.undo"]] : [])];
  }
  // "成功粘贴表格 (H 个表头行, D 个数据行 x C 列)，已保持完整表格结构!"
  if ((m = /^成功粘贴表格 \((\d+) 个表头行, (\d+) 个数据行 x (\d+) 列\)，已保持完整表格结构!$/.exec(raw))) {
    return [["table", { headers: m[1], rows: m[2], cols: m[3] }]];
  }
  // "成功粘贴表格 (D 个数据行 x C 列)，已按字段重排!"
  if ((m = /^成功粘贴表格 \((\d+) 个数据行 x (\d+) 列\)，已按字段重排!$/.exec(raw))) return [["tableByField", { rows: m[1], cols: m[2] }]];
  // "成功粘贴 <report> R 行 x C 列"  (Citibet Agent PT, KING855 Win/Loss, WOS Win/Loss, Win Lose Total, 发票)
  if ((m = /^成功粘贴 (.+?) (\d+) 行 x (\d+) 列(?:数据)?!?$/.exec(raw))) return [["report", { label: m[1], labelKey: LABEL_KEYS[m[1]], rows: m[2], cols: m[3] }]];

  if ((m = /^No cells were pasted from (.+?)\.$/.exec(raw))) return [["noCells", { source: m[1] }]];
  if (raw === "No cells were pasted. Check console for details.") return [["noCellsAny"]];
  if (raw === "Pasted content is empty after filtering blank lines.") return [["empty"]];
  if (raw === "格式保留失败，已按纯文本粘贴。") return [["formatLost"]];
  return null;
}

/** The message in the page language. t: i18next's t. */
export function translatePasteNotice(message, t) {
  const parts = describePasteNotice(message);
  if (!parts) return String(message ?? "").trim();
  return parts
    .map(([key, params = {}]) => t(`capture:paste.${key}`, { ...params, label: params.labelKey ? t(`capture:paste.${params.labelKey}`) : params.label }))
    .join(" ");
}
