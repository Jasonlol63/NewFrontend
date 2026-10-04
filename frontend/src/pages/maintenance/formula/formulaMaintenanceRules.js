export const FORMULA_LIST_URL = "/api/maintenance/formula-maintenance/list";
export const FORMULA_DELETE_URL = "/api/maintenance/formula-maintenance/delete";

// One data_capture_formula row. Empty text stays "" here; the page shows "-" for it.
export function normalizeFormulaRow(raw) {
  const text = (v) => String(v ?? "").trim();
  return {
    id: String(raw.id),
    process: text(raw.process),
    account: text(raw.account),
    currency: text(raw.currency),
    source: text(raw.sourcePercent),
    product: text(raw.idProduct),
    inputMethod: text(raw.inputMethod),
    formula: text(raw.formula),
    description: text(raw.description),
  };
}

export function filterFormulaRows(rows, search) {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) =>
    [r.process, r.account, r.product, r.formula, r.description].some((v) => v.toLowerCase().includes(q))
  );
}
