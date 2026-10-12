// What is ticked or typed on the summary but not stored in the database (Rate tick, Rate Value, Skip) is kept in the browser
// (sessionStorage), so a reload, a Refresh or a saved formula does not lose it. It belongs to one capture and goes when
// the summary is submitted.
const KEY = "dc-summary-draft";

/** Which capture a draft belongs to. */
export const draftSignature = (capture) => [capture.tenantId, capture.processId ?? capture.process, capture.date, capture.currencyId].join("|");

// A formula row is found again by its database id; a main row that has none by its Id Product and sheet row.
const rowKey = (row) => (row.templateId ? `t${row.templateId}` : `m:${row.idProduct}#${row.rowIndex}`);

const touched = (row) => row.rateChecked || row.skip || row.rateValue.trim() !== "";

export function saveDraft(signature, rows) {
  const draft = {};
  for (const row of rows) if (touched(row)) draft[rowKey(row)] = { rateChecked: row.rateChecked, rateValue: row.rateValue, skip: row.skip };
  try {
    if (Object.keys(draft).length === 0) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, JSON.stringify({ signature, draft }));
  } catch {
    /* storage full or blocked: the draft is only a convenience */
  }
}

export function clearDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** The rows with the saved ticks put back (only when the draft is of this capture). */
export function applyDraft(signature, rows) {
  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
  } catch {
    saved = null;
  }
  if (!saved || saved.signature !== signature) return rows;
  return rows.map((row) => {
    const d = saved.draft?.[rowKey(row)];
    return d ? { ...row, rateChecked: Boolean(d.rateChecked), rateValue: String(d.rateValue ?? ""), skip: Boolean(d.skip) } : row;
  });
}
