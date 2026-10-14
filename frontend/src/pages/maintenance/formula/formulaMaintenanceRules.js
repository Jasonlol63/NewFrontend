export const FORMULA_LIST_URL = "/api/maintenance/formula-maintenance/list";
export const FORMULA_UPDATE_URL = "/api/maintenance/formula-maintenance/update";
export const FORMULA_DELETE_URL = "/api/maintenance/formula-maintenance/delete";

// One data_capture_formula row. Empty text stays "" here; the page shows "-" for it.
// The ids and raw values are what the edit window starts from.
export function normalizeFormulaRow(raw) {
  const text = (v) => String(v ?? "").trim();
  return {
    id: String(raw.id),
    process: text(raw.process),
    accountId: raw.accountId ?? null,
    account: text(raw.account),
    accountName: text(raw.accountName),
    currency: text(raw.currency),
    source: text(raw.sourcePercent),
    product: text(raw.idProduct),
    inputMethod: text(raw.inputMethod),
    formula: text(raw.formula),
    description: text(raw.description),
  };
}

// ---------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------

// The values the Formula Maintenance API stores for Input Method.
export const INPUT_METHOD_OPTIONS = [
  { value: "positive_to_negative_negative_to_positive", label: "Positive to negative, negative to positive" },
  { value: "positive_to_negative_negative_to_zero", label: "Positive to negative, negative to zero" },
  { value: "negative_to_positive_positive_to_zero", label: "Negative to positive, positive to zero" },
  { value: "positive_unchanged_negative_to_zero", label: "Positive unchanged, negative to zero" },
  { value: "negative_unchanged_positive_to_zero", label: "Negative unchanged, positive to zero" },
  { value: "change_to_positive", label: "Change to positive" },
  { value: "change_to_negative", label: "Change to negative" },
  { value: "change_to_zero", label: "Change to zero" },
];

// The form the edit window starts with.
export const formFromRow = (row) => ({
  accountId: row.accountId == null ? "" : String(row.accountId),
  source: row.source,
  inputMethod: row.inputMethod,
  formula: row.formula,
  description: row.description,
});

// Source accepts a non-negative decimal; "", "." and "0." are fine while typing, so only the typed characters are checked.
const SOURCE_TYPING = /^(?:\d+(?:\.\d*)?|\.\d*)?$/;
export const sourceAfterTyping = (previous, next) => (SOURCE_TYPING.test(next) ? next : previous);
export const isSourceValid = (source) => /\d/.test(source) && SOURCE_TYPING.test(source.trim());

const formulaLetters = (value) => String(value ?? "").match(/[A-Za-z]/g) ?? [];

// Are the letters of `candidate` some of the letters of `previous`, in the same order (kept or removed, none new)?
function isLetterSubsequence(candidate, previous) {
  let at = 0;
  for (const letter of candidate) {
    while (at < previous.length && previous[at] !== letter) at += 1;
    if (at >= previous.length) return false;
    at += 1;
  }
  return true;
}

// The formula may hold numbers, operators, references and the letters it already has, but no newly typed letters.
export function formulaAfterTyping(previous, next) {
  if (!/^[0-9A-Za-z.$+\-*/()[\],\s]*$/.test(next)) return previous;
  return isLetterSubsequence(formulaLetters(next), formulaLetters(previous)) ? next : previous;
}

// Removes a trailing "*(source)" the user may have typed: the Source column is stored on its own.
export function stripSourceSuffix(formulaText) {
  let result = String(formulaText ?? "").trim();
  const suffix = /^\*\s*\(([0-9.+\-*/\s]+)\)\s*$/;
  for (;;) {
    const star = result.lastIndexOf("*");
    if (star < 0) break;
    const before = result.slice(0, star);
    const insideParens = (before.match(/\(/g) || []).length > (before.match(/\)/g) || []).length;
    if (insideParens || !suffix.test(result.slice(star))) break;
    result = before.trim();
  }
  return result;
}

export const isFormFilled = (form) => isSourceValid(form.source);

export const isFormChanged = (form, row) => {
  const start = formFromRow(row);
  return Object.keys(start).some((key) => String(form[key]).trim() !== String(start[key]).trim());
};

export function buildFormulaUpdateRequest({ tenantId, row, form }) {
  return {
    tenantId,
    id: Number(row.id),
    accountId: form.accountId ? Number(form.accountId) : null,
    sourcePercent: form.source.trim(),
    inputMethod: form.inputMethod || null,
    formula: stripSourceSuffix(form.formula),
    description: form.description.trim() || null,
  };
}
