// The paste modules still say things in Chinese ("成功粘贴 12 个单元格 (3 行 x 4 列)!"): this turns the ones they use into English.
// A message it does not know is shown as it is.
const SUFFIX = {
  已保持Excel原始格式: "Excel format preserved.",
  已保持PDF原始格式: "PDF format preserved.",
  已保持表格行格式: "Table row format kept.",
  已按Excel矩阵排列: "Arranged as an Excel matrix.",
  已在1: "Format kept.",
};

const LABELS = { 发票: "Invoice" };

const cells = (n, r, c) => `${n} cells (${r} rows × ${c} columns)`;

export function translatePasteNotice(message) {
  const raw = String(message ?? "").trim();
  let m;

  // "[label：]成功粘贴 N 个单元格 (R 行 x C 列)[，suffix]!  [按 Ctrl+Z 可撤销]"
  if ((m = /^(?:(.+?)[:：]\s*)?成功粘贴 (\d+) 个单元格 \((\d+) 行 x (\d+) 列\)(?:，(.+?))?!(?: 按 Ctrl\+Z 可撤销)?$/.exec(raw))) {
    const [, label, n, r, c, suffix] = m;
    const tail = suffix ? SUFFIX[Object.keys(SUFFIX).find((k) => suffix.startsWith(k))] : raw.includes("Ctrl+Z") ? "Press Ctrl+Z to undo." : "";
    return `${label ? `${label}: s` : "S"}uccessfully pasted ${cells(n, r, c)}.${tail ? ` ${tail}` : ""}`;
  }
  // "成功粘贴表格 (H 个表头行, D 个数据行 x C 列)，已保持完整表格结构!"
  if ((m = /^成功粘贴表格 \((\d+) 个表头行, (\d+) 个数据行 x (\d+) 列\)，已保持完整表格结构!$/.exec(raw))) {
    return `Successfully pasted table (${m[1]} header rows, ${m[2]} data rows × ${m[3]} columns). Full structure preserved.`;
  }
  // "成功粘贴表格 (D 个数据行 x C 列)，已按字段重排!"
  if ((m = /^成功粘贴表格 \((\d+) 个数据行 x (\d+) 列\)，已按字段重排!$/.exec(raw))) {
    return `Successfully pasted table (${m[1]} data rows × ${m[2]} columns). Rearranged by field.`;
  }
  // "成功粘贴 <report> R 行 x C 列"  (Citibet Agent PT, KING855 Win/Loss, WOS Win/Loss, Win Lose Total, 发票)
  if ((m = /^成功粘贴 (.+?) (\d+) 行 x (\d+) 列(?:数据)?!?$/.exec(raw))) {
    return `${LABELS[m[1]] ?? m[1]}: successfully pasted ${m[2]} rows × ${m[3]} columns.`;
  }
  if (raw === "格式保留失败，已按纯文本粘贴。") return "The formatting could not be kept: pasted as plain text.";
  return raw;
}
