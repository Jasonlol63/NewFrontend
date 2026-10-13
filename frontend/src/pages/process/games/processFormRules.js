import i18n from "@/i18n";
import { PROCESS_ADD_URL, PROCESS_UPDATE_URL } from "./processRules";

// Pure rules for the Add / Edit Process form: validation, the "Process ID already in use" explanation and the
// request bodies of /api/process/add-process and /update-process.

// The first problem with the form, or "" when it can be saved. codes: the Process IDs about to be saved
// (one, or several with Multi-Process).
export function validateProcessForm({ isEdit, multi, codes, currencyId, descriptionCount, copySourceCode }) {
  if (!isEdit && codes.length === 0) return multi ? i18n.t("process:validation.selectCodes") : i18n.t("process:validation.codeRequired");
  // Copy From makes a process with a new name; Multi-Process reuses an existing name, so the two cannot be the same Process ID.
  if (multi && copySourceCode && codes.some((c) => c.toUpperCase() === String(copySourceCode).toUpperCase())) {
    return i18n.t("process:validation.copyFromSameAsMulti", { code: copySourceCode });
  }
  if (!currencyId) return i18n.t("process:validation.currencyRequired");
  if (descriptionCount === 0) return i18n.t("process:validation.descriptionRequired");
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
  return taken.size ? i18n.t("process:validation.inUse", { code, list: [...taken].join(", ") }) : "";
}

// Add requests for the picked Process IDs. Normally one process per ID holding all the descriptions. With Multi-Process
// each ID x description becomes its own independent process (same Process ID, one description each); Copy From, if
// picked, applies to every one of them. key identifies a request ("CODE|descriptionId") so a retry can skip what went through.
export function buildAddRequests({ codes, multi, descriptions, labelById, tenantId, form, days }) {
  if (!multi) return codes.map((code) => ({ ...buildProcessRequest({ code, tenantId, form, descriptions, days }), key: code, label: code }));
  return codes.flatMap((code) =>
    [...descriptions].map((descId) => ({
      ...buildProcessRequest({ code, tenantId, form, descriptions: [descId], days }),
      key: `${code}|${descId}`,
      label: `${code} - ${labelById.get(descId) ?? descId}`,
    }))
  );
}

// Request for one process. In Add with Copy From the form already holds the copied values (possibly edited), and
// they are all sent: what is in the form is what the new process gets (the backend only adds the source's formulas).
export function buildProcessRequest({ isEdit, id, code, tenantId, form, descriptions, days }) {
  const body = {
    tenantId,
    currencyId: Number(form.currency),
    descriptionIds: [...descriptions],
    dayOfWeeks: [...days].sort((a, b) => a - b),
    removeWord: form.removeWord.toUpperCase(),
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
