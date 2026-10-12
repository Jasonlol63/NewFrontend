// Spring Boot calls of the Data Capture Summary. Every call is a POST with a JSON body; postJson (lib/api.js) throws the
// server's message when it is not a success.
//   /api/datacapture-summary/formula/save | update | delete, /submit  (DataCaptureSummaryController)
//   /api/maintenance/formula-maintenance/list  the stored formulas of a process (read only here)
//   /api/account/list, /api/currency/list      the company's accounts and currencies
import { postJson } from "@/lib/api";
import { normalizeAccountRow } from "@/pages/account/accountRules";
import { sourceColumnsOf } from "./summaryMath";

const BASE = "/api/datacapture-summary";

/** "KY [KAI YUAN]": how an account is named in the list. */
export const accountLabel = ({ accountId, name }) => (name ? `${accountId} [${name}]` : String(accountId ?? ""));

/** The company's active accounts: [{ label, id, row }] (row = the normalised account, for the Edit Account modal). */
export async function fetchAccounts(tenantId, { signal } = {}) {
  const body = await postJson(`/api/account/list?tenant_id=${encodeURIComponent(tenantId)}`, null, { signal });
  return (body.data ?? [])
    .map(normalizeAccountRow)
    .filter((row) => row.status === "active")
    .map((row) => ({ label: accountLabel(row), id: row.id, row }));
}

/** The company's active currencies: [{ id, code }]. */
export async function fetchCurrencies(tenantId, { signal } = {}) {
  const body = await postJson(`/api/currency/list?tenant_id=${encodeURIComponent(tenantId)}`, null, { signal });
  return (body.data ?? [])
    .filter((c) => c.status !== "INACTIVE")
    .map((c) => ({ id: c.id, code: String(c.code ?? "").toUpperCase() }))
    .filter((c) => c.code);
}

/**
 * The process of a capture as the formula API wants it: a Game process has its numeric id, a Bank process only its code
 * (the backend creates the process row on the first save). capture = { tenantId, processId, process }.
 */
export const processOf = (capture) => ({
  tenantId: capture.tenantId,
  processId: capture.processId ?? null,
  processCode: capture.processId ? null : String(capture.process ?? "").trim().toUpperCase() || null,
});

/** The stored formulas of the process, as templates for summaryPopulate.buildRows. */
export async function fetchTemplates(capture, { signal } = {}) {
  const process = capture.processId ? String(capture.processId) : String(capture.process ?? "").trim().toUpperCase();
  if (!process) return [];
  const body = await postJson(
    "/api/maintenance/formula-maintenance/list",
    { tenantId: capture.tenantId, process, category: capture.processId ? "games" : "bank" },
    { signal }
  );
  return (body.data ?? []).map((r) => ({
    id: r.id,
    type: String(r.productType).toUpperCase() === "SUB" ? "sub" : "main",
    idProduct: String(r.idProduct ?? ""),
    parentId: r.parentIdProduct ?? null,
    variant: r.formulaVariant ?? null,
    subOrder: r.subOrder == null ? null : Number(r.subOrder),
    rowIndex: r.rowIndex ?? null,
    accountId: r.accountId ?? null,
    account: r.account ? accountLabel({ accountId: r.account, name: r.accountName }) : "",
    currencyId: r.currencyId ?? null,
    currency: String(r.currency ?? ""),
    description: r.description ?? "",
    formula: String(r.formula ?? ""),
    inputMethod: r.inputMethod ?? "",
    sourcePercent: r.sourcePercent ?? "1",
    enableSourcePercent: r.enableSourcePercent !== false && Number(r.enableSourcePercent) !== 0,
    enableInputMethod: r.enableInputMethod === true || Number(r.enableInputMethod) === 1,
  }));
}

// The fields of a stored formula that a row holds.
const formulaFields = (row) => ({
  accountId: row.accountId,
  currencyId: row.currencyId,
  description: row.description,
  sourceColumns: sourceColumnsOf(row.formula, row.idProduct, row.rowIndex),
  formula: row.formula,
  inputMethod: row.inputMethod || null,
  sourcePercent: row.sourcePercent.trim() || "1",
  enableSourcePercent: true,
  enableInputMethod: Boolean(row.inputMethod),
});

/**
 * Stores a new formula. The backend decides whether it is the MAIN formula of the Id Product (on this sheet row) or one more
 * SUB formula, and answers { id, productType, subOrder, formulaVariant }.
 */
export async function saveFormula(row, capture) {
  const body = await postJson(`${BASE}/formula/save`, { ...processOf(capture), idProduct: row.idProduct, rowIndex: row.rowIndex, ...formulaFields(row) });
  return normalizeSaved(body.data);
}

/** Stores the changes of a formula that was saved before (located by its id). */
export async function updateFormula(row, capture) {
  const body = await postJson(`${BASE}/formula/update`, { ...processOf(capture), id: row.templateId, ...formulaFields(row) });
  return normalizeSaved(body.data);
}

/** Deletes stored formulas (rows without a templateId were never stored and are skipped). Returns how many went. */
export async function deleteFormulas(rows, capture) {
  const items = rows.filter((r) => r.templateId).map((r) => ({ id: r.templateId }));
  if (items.length === 0) return 0;
  const body = await postJson(`${BASE}/formula/delete`, { ...processOf(capture), items });
  return body.data?.deletedCount ?? items.length;
}

function normalizeSaved(data) {
  return {
    id: data?.id ?? null,
    type: String(data?.productType ?? "").toUpperCase() === "SUB" ? "sub" : "main",
    subOrder: data?.subOrder == null ? null : Number(data.subOrder),
    formulaVariant: data?.formulaVariant ?? null,
  };
}

/** The final Submit: one atomic transaction on the server. Returns the new capture id. */
export async function submitSummary(capture, lines) {
  const isGame = Boolean(capture.processId);
  const body = await postJson(`${BASE}/submit`, {
    ...processOf(capture),
    category: isGame ? "GAME" : "BANK",
    captureDate: capture.date,
    currencyId: capture.currencyId,
    remark: capture.remark || "",
    removeWord: capture.removeWord || "",
    replaceWordFrom: capture.replaceFrom || "",
    replaceWordTo: capture.replaceTo || "",
    lines,
  });
  const captureId = body.data?.captureId;
  if (!captureId) throw new Error("The server did not return a capture id.");
  return captureId;
}
