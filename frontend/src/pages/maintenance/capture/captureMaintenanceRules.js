import { formatDisplayDate } from "@/lib/date";
import { deletedByText } from "../shared/maintenanceFormat";

export const CAPTURE_LIST_URL = "/api/maintenance/capture-maintenance/list";
export const CAPTURE_DELETE_URL = "/api/maintenance/capture-maintenance/delete";

// One data_captures header of the list. Live and archived captures can share an id, so the row id
// carries which one it is; `captureId` is what the delete request wants.
export function normalizeCaptureRow(raw) {
  const deleted = Boolean(raw.deleted);
  return {
    id: `${deleted ? "d" : "l"}${raw.id}`,
    captureId: raw.id,
    deleted,
    createdAt: raw.dtsCreated ?? "",
    created: formatDisplayDate(String(raw.dtsCreated ?? "").slice(0, 10)),
    product: raw.product ?? "",
    process: raw.process ?? "",
    currency: raw.currency ?? "",
    createdBy: raw.createdBy ?? "",
    deletedBy: deletedByText(raw.deletedBy, raw.deletedAt),
  };
}
