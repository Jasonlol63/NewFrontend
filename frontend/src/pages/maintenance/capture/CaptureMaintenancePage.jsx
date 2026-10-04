import { useMemo, useState } from "react";
import DataTable from "@/components/shared/list/DataTable.jsx";
import { DateText } from "@/components/shared/list/cells.jsx";
import { DeleteButton } from "@/components/shared/list/ListToolbar.jsx";
import { useRowActions } from "@/components/shared/list/useRowActions.jsx";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { postJson } from "@/lib/api";
import MaintenanceFilterCard from "../shared/MaintenanceFilterCard.jsx";
import { useMaintenanceFilters } from "../shared/useMaintenanceFilters";
import { useMaintenanceList } from "../shared/useMaintenanceList";
import { CAPTURE_DELETE_URL, CAPTURE_LIST_URL, filterCaptureRows, normalizeCaptureRow } from "./captureMaintenanceRules";

// Every cell stays on one line; the text columns give way with "..." only when the row does not fit the card.
const columns = [
  { key: "no", label: "No.", sortable: false, className: "w-[56px]", cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
  { key: "created", label: "Dts Created", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => <DateText value={r.createdAt} variant="gradient" separator="/" /> },
  { key: "product", label: "Product", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => r.product },
  { key: "process", label: "Process", sortable: false, fit: true, cellClassName: "font-semibold whitespace-nowrap", render: (r) => r.process },
  { key: "currency", label: "Currency", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => r.currency },
  { key: "wlGroup", label: "W/L Group", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => r.wlGroup },
  { key: "createdBy", label: "Submitted By", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => r.createdBy },
  { key: "deletedBy", label: "Deleted By", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => r.deletedBy || "-" },
];

export default function CaptureMaintenancePage() {
  const user = useCurrentUser();
  const readOnly = Boolean(user?.readOnly);
  const [selected, setSelected] = useState(() => new Set());

  const filters = useMaintenanceFilters("maintenance.capture.scope", { onChange: () => setSelected(new Set()) });
  const captures = useMaintenanceList(CAPTURE_LIST_URL, filters.request, normalizeCaptureRow);
  const rows = useMemo(() => filterCaptureRows(captures.rows, filters.search), [captures.rows, filters.search]);

  // Archived captures are already deleted.
  const canSelect = (r) => !readOnly && !r.deleted;
  const selectedRows = rows.filter((r) => canSelect(r) && selected.has(r.id));
  const actions = useRowActions({
    deleteRows: async (list) => {
      await postJson(CAPTURE_DELETE_URL, { tenantId: filters.request.tenantId, captureIds: list.map((r) => r.captureId) });
      captures.reload();
    },
    noun: "capture",
    label: (r) => `${r.process} ${r.created}`,
    onDeleted: () => setSelected(new Set()),
  });

  const pageError = filters.error || captures.error;

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <MaintenanceFilterCard
        filters={filters}
        searchPlaceholder="Search Process, Product, Currency"
        actions={<DeleteButton count={selectedRows.length} onClick={() => actions.requestDelete(selectedRows)} />}
      />

      {pageError && (
        <div className="flex-none rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-medium text-dash-down">
          {pageError}
        </div>
      )}

      <DataTable
        columns={columns}
        noun="records"
        loading={captures.loading}
        rows={rows}
        selected={selected}
        onSelectedChange={setSelected}
        canSelect={canSelect}
        lockedSelect={(r) => r.deleted}
        rowClassName={(r) => r.deleted && "[&>td]:text-dash-down [&>td]:line-through"}
        fitWidth
        minWidth="min-w-0"
        emptyMessage="No data found. Please adjust your search criteria and try again."
      />

      {actions.dialogs}
    </div>
  );
}
