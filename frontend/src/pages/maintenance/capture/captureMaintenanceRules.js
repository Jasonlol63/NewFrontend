import { formatDisplayDate } from "@/lib/date";

export const CAPTURE_LIST_URL = "/api/maintenance/capture-maintenance/list";
export const CAPTURE_DELETE_URL = "/api/maintenance/capture-maintenance/delete";

export function buildCaptureRequest({ tenantId, dateFrom, dateTo, processId, isGroupOwn }) {
  return {
    tenantId,
    dateFrom,
    dateTo,
    process: processId === "" ? null : String(processId),
    // The maintenance API words the categories "games" / "bank".
    category: isGroupOwn ? "bank" : "games",
  };
}

// "2026-09-30T14:48:12" -> "30/09/2026 14:48"
function formatDateTime(value) {
  const text = String(value ?? "");
  return text ? `${formatDisplayDate(text.slice(0, 10))} ${text.slice(11, 16)}`.trim() : "";
}

// One data_captures header of the list. Live and archived captures can share an id, so the row id
// carries which one it is; `captureId` is what the delete request wants.
export function normalizeCaptureRow(raw) {
  const deleted = Boolean(raw.deleted);
  return {
    id: `${deleted ? "d" : "l"}${raw.id}`,
    captureId: raw.id,
    deleted,
    created: formatDisplayDate(String(raw.dtsCreated ?? "").slice(0, 10)),
    product: raw.product ?? "",
    process: raw.process ?? "",
    currency: raw.currency ?? "",
    wlGroup: raw.wlGroup ?? "",
    createdBy: raw.createdBy ?? "",
    deletedBy: raw.deletedBy ? `${raw.deletedBy} (${formatDateTime(raw.deletedAt)})` : "",
  };
}

export function filterCaptureRows(rows, search) {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => [r.process, r.product, r.currency].some((v) => v.toLowerCase().includes(q)));
}
