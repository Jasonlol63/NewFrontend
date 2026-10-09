import { PROCESS_ADD_URL, PROCESS_UPDATE_URL } from "./processRules";

// Pure rules for the Add / Edit Process form: validation, the "Process ID already in use" explanation and the
// request bodies of /api/process/add-process and /update-process.

// The first problem with the form, or "" when it can be saved. codes: the Process IDs about to be saved
// (one, or several with Multi-Process).
export function validateProcessForm({ isEdit, multi, codes, currencyId, descriptionCount }) {
  if (!isEdit && codes.length === 0) return multi ? "Select at least one Process ID" : "Process ID is required";
  if (!currencyId) return "Currency is required";
  if (descriptionCount === 0) return "Select at least one description";
  return "";
}

/**
 * The same Process ID may appear several times, but not with the same description twice. Returns the message to
 * show when `code` + one of `descriptionIds` is already taken by another process in `rows` (the list of the
 * company), naming the descriptions, or "" when it is free. The backend checks this too and answers just
 * "Process ID already in use"; this is the version that says which.
 */
export function findProcessIdInUse(rows, code, descriptionIds, excludeId, labelById) {
  const taken = new Set();
  for (const p of rows) {
    if (p.id === excludeId || String(p.code).toUpperCase() !== code) continue;
    for (const id of p.descriptionIds) {
      if (descriptionIds.has(id)) taken.add(labelById.get(id) ?? String(id));
    }
  }
  return taken.size ? `Process ID ${code} already in use: ${[...taken].join(", ")}` : "";
}

// Request for one process. In Add with Copy From the form already holds the copied values (possibly edited), and
// they are all sent: what is in the form is what the new process gets (the backend only adds the source's formulas).
export function buildProcessRequest({ isEdit, id, code, tenantId, form, descriptions, days }) {
  const body = {
    tenantId,
    currencyId: Number(form.currency),
    descriptionIds: [...descriptions],
    dayOfWeeks: [...days].sort((a, b) => a - b),
    removeWord: form.removeWord,
    replaceWordFrom: form.replaceFrom.toUpperCase(),
    replaceWordTo: form.replaceTo.toUpperCase(),
    remark: form.remark.toUpperCase(),
    enableSaveDraft: form.saveDataCapture,
  };
  if (isEdit) return { url: PROCESS_UPDATE_URL, code, body: { ...body, id } };
  return {
    url: PROCESS_ADD_URL,
    code,
    body: { ...body, code, ...(form.copyFrom ? { copyFromProcessId: Number(form.copyFrom) } : {}) },
  };
}
