// Spring Boot calls of Data Capture (/api/datacapture/*). Every call is a POST with a JSON body; the reply is
// { status | success, data }. postJson (lib/api.js) throws the server's message when it is not a success.
import { postJson } from "@/lib/api";
import { createGrid } from "./grid/gridModel";

const BASE = "/api/datacapture";

/**
 * The Game processes that can be captured on a date: the active ones of that weekday that were not submitted for that
 * date yet. [{ id, code, display, enableSaveDraft }], display = "CODE (first description)".
 */
export async function fetchGameProcesses({ tenantId, captureDate }, { signal } = {}) {
  const body = await postJson(`${BASE}/games/form`, { tenantId, captureDate }, { signal });
  return (body.data?.processes ?? []).map((p) => ({
    id: p.id,
    code: String(p.processId ?? ""),
    display: String(p.processDisplay || p.processId || ""),
    enableSaveDraft: Boolean(p.enableSaveDraft),
  }));
}

/** The processes already submitted for the date, newest first, as the Submitted Processes card shows them. */
export async function fetchSubmittedProcesses({ tenantId, captureDate }, { signal } = {}) {
  const body = await postJson(`${BASE}/games/submitted`, { tenantId, captureDate }, { signal });
  return (body.data ?? []).map((r) => {
    const at = String(r.createAt ?? "");
    const [day = "", time = ""] = at.split("T");
    const [y, m, d] = day.split("-");
    return {
      id: r.id,
      code: String(r.processId ?? ""),
      name: String(r.descriptionName ?? ""),
      by: String(r.createdBy ?? ""),
      date: y ? `${d}/${m}/${y}` : "",
      time: time.slice(0, 8),
    };
  });
}

/**
 * The Bank captures of the date (a Bank process can be submitted again on the same date, so every one is listed), newest first, in the
 * shape of the Submitted Processes card: the Process as the title and the currency beside it. It reads the Capture Maintenance list;
 * a deleted capture comes back flagged and is left out, because deleting it removes it from the card too.
 */
export async function fetchSubmittedBankCaptures({ tenantId, captureDate }, { signal } = {}) {
  const body = await postJson(
    "/api/maintenance/capture-maintenance/list",
    { tenantId, dateFrom: captureDate, dateTo: captureDate, process: null, category: "bank", limit: 100 },
    { signal }
  );
  return (body.data ?? [])
    .filter((r) => !r.deleted)
    .map((r) => {
      const [day = "", time = ""] = String(r.dtsCreated ?? "").split("T");
      const [y, m, d] = day.split("-");
      return { id: r.id, code: String(r.process ?? ""), name: String(r.currency ?? ""), by: String(r.createdBy ?? ""), date: y ? `${d}/${m}/${y}` : "", time: time.slice(0, 8) };
    });
}

// ---- drafts ----
// A draft is the filled cells of the sheet: { rowIndex (0 = A), colIndex (1 = first column), cellValue }. Saving a sheet with
// no cell empties the draft on the server.

export function gridToCells(grid) {
  const cells = [];
  grid.cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      const value = String(cell.value ?? "").trim();
      if (value) cells.push({ rowIndex: r, colIndex: c + 1, cellValue: value });
    })
  );
  return cells;
}

/** A grid of at least rows x cols that holds the cells (the sheet grows to fit what was saved). */
export function cellsToGrid(cells, rows, cols) {
  const R = Math.max(rows, ...cells.map((c) => c.rowIndex + 1));
  const C = Math.max(cols, ...cells.map((c) => c.colIndex));
  const grid = createGrid(R, C);
  grid.cells = grid.cells.map((row) => [...row]);
  cells.forEach((c) => {
    grid.cells[c.rowIndex][c.colIndex - 1] = { value: c.cellValue };
  });
  return grid;
}

/** key = { kind: "bank" | "game", tenantId, process (Bank process code | Game process id), currencyId } */
function draftBody(key) {
  const body = { tenantId: key.tenantId, currencyId: key.currencyId };
  if (key.kind === "bank") body.processCode = key.process;
  else body.processId = Number(key.process);
  return body;
}

const draftUrl = (key, action) => `${BASE}/${key.kind === "bank" ? "bank" : "games"}/draft/${action}`;

/** The saved cells of a draft ([] when there is none). */
export async function fetchDraft(key, { signal } = {}) {
  const body = await postJson(draftUrl(key, "get"), draftBody(key), { signal });
  return body.data?.cells ?? [];
}

/**
 * Saves the sheet as the draft. keepalive: the request still goes out when the page is being closed.
 * (Not postJson: that one has no keepalive. A failure is not thrown: a draft that could not be saved must not break typing.)
 */
export async function saveDraft(key, grid, { keepalive = false } = {}) {
  try {
    const res = await fetch(draftUrl(key, "save"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draftBody(key), cells: gridToCells(grid) }),
      keepalive,
    });
    return res.ok;
  } catch {
    return false;
  }
}
