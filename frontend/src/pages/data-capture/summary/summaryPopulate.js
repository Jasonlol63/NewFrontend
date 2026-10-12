// The summary rows of a captured sheet: one main row per Id Product cell (summaryRules.rowsFromCaptured), filled from the
// formulas stored for the process (data_capture_formula, see summaryApi.fetchTemplates). Pure, no React.
//
// template = { id, type: "main" | "sub", idProduct, parentId, variant, subOrder, rowIndex, accountId, account, currencyId,
//              currency, description, formula, inputMethod, sourcePercent }  (account = the label "ID [NAME]")
//
// How a template finds its row (the rules of the old summary):
//   - a MAIN formula goes to the main row with the same Id Product (a row whose id only carries more text after it, such as
//     "TT683951A (COMM)", counts too): first the one on the sheet row the formula was made for (rowIndex), then, for what is
//     left, the first row that is still free. The same Id Product on several sheet rows keeps its formulas apart that way.
//   - a SUB formula goes under the main row of its parent Id Product; with several of them, under the last one that starts
//     at or before the formula's rowIndex. Subs are listed in their subOrder.
//   - a formula whose Id Product is not on the sheet is left out (it belongs to another day's capture).
import { createRow, resequence, rowsFromCaptured } from "./summaryRules.js";

const norm = (text) => String(text ?? "").trim().replace(/\s+/g, " ").toUpperCase();

// 2 = the same text, 1 = the row's text only continues it ("TT683951A (COMM)" for "TT683951A"), 0 = another product.
function idMatch(rowId, templateId) {
  const r = norm(rowId);
  const t = norm(templateId);
  if (!r || !t) return 0;
  if (r === t) return 2;
  return r.startsWith(`${t} `) || r.startsWith(`${t}(`) ? 1 : 0;
}

// What a template fills in a row. A switched-off Source / Input Method counts as none.
function fields(t) {
  return {
    account: t.account,
    accountId: t.accountId,
    currency: t.currency,
    currencyId: t.currencyId,
    formula: t.formula,
    sourcePercent: t.enableSourcePercent === false ? "1" : t.sourcePercent || "1",
    inputMethod: t.enableInputMethod === false ? "" : t.inputMethod || "",
    description: t.description || "",
    templateId: t.id,
    formulaVariant: t.variant,
  };
}

// The best free candidate: the same id text before a longer one, and the first of them in sheet order.
function pick(candidates, templateId, want) {
  const free = candidates.filter((c) => (want ? want(c) : true));
  return free.find((c) => idMatch(c.idProduct, templateId) === 2) ?? free[0] ?? null;
}

/** The sub formula's main row (see above); null when its parent Id Product is not on the sheet. */
function parentOf(mains, template) {
  const parents = mains.filter((m) => idMatch(m.idProduct, template.parentId || template.idProduct) > 0);
  if (parents.length === 0) return null;
  if (parents.length === 1 || template.rowIndex == null) return parents[0];
  const sorted = [...parents].sort((a, b) => a.rowIndex - b.rowIndex);
  const owner = sorted.filter((m) => m.rowIndex <= template.rowIndex).at(-1);
  return owner ?? sorted[0];
}

/**
 * The rows of the summary: the main rows of the captured sheet with their stored formulas, sub rows under their main row.
 * captured: { rows } (summaryRules.capturedFromTable); templates: [template].
 */
export function buildRows(captured, templates) {
  const mains = rowsFromCaptured(captured);
  const taken = new Set();

  const mainTemplates = templates.filter((t) => t.type === "main");
  const give = (template, row) => {
    taken.add(row.key);
    Object.assign(row, fields(template));
  };
  const free = (template) => mains.filter((m) => !taken.has(m.key) && idMatch(m.idProduct, template.idProduct) > 0);

  const later = [];
  for (const template of mainTemplates) {
    const row = template.rowIndex == null ? null : pick(free(template), template.idProduct, (m) => m.rowIndex === template.rowIndex);
    if (row) give(template, row);
    else later.push(template);
  }
  for (const template of later) {
    const row = pick(free(template), template.idProduct);
    if (row) give(template, row);
  }

  const subsOf = new Map();
  const subTemplates = templates.filter((t) => t.type === "sub").sort((a, b) => (a.subOrder ?? 0) - (b.subOrder ?? 0) || a.id - b.id);
  for (const template of subTemplates) {
    const parent = parentOf(mains, template);
    if (!parent) continue;
    const list = subsOf.get(parent.key) ?? [];
    list.push(createRow({ type: "sub", idProduct: parent.idProduct, rowIndex: parent.rowIndex, ...fields(template) }));
    subsOf.set(parent.key, list);
  }

  return resequence(mains.flatMap((main) => [main, ...(subsOf.get(main.key) ?? [])]));
}
