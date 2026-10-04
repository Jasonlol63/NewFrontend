import { useMemo, useState } from "react";
import DataTable from "@/components/shared/list/DataTable.jsx";
import { IconAction } from "@/components/shared/list/cells.jsx";
import { DeleteButton } from "@/components/shared/list/ListToolbar.jsx";
import { useRowActions } from "@/components/shared/list/useRowActions.jsx";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { postJson } from "@/lib/api";
import MaintenanceFilterCard from "../shared/MaintenanceFilterCard.jsx";
import { useMaintenanceFilters } from "../shared/useMaintenanceFilters";
import { useMaintenanceList } from "../shared/useMaintenanceList";
import { FORMULA_DELETE_URL, FORMULA_LIST_URL, filterFormulaRows, normalizeFormulaRow } from "./formulaMaintenanceRules";

const dash = (v) => v || "-";

// Every cell stays on one line. Formula and Description are the columns that give way (with "..."
// and the full text on hover) if the row is still wider than the card.
const columns = [
  { key: "no", label: "No.", sortable: false, cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
  { key: "process", label: "Process", sortable: false, fit: true, cellClassName: "font-semibold whitespace-nowrap", render: (r) => r.process },
  { key: "account", label: "Account", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => dash(r.account) },
  { key: "currency", label: "Currency", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => dash(r.currency) },
  { key: "source", label: "Source", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => dash(r.source) },
  { key: "product", label: "Product", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => r.product },
  { key: "inputMethod", label: "Input Method", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => dash(r.inputMethod) },
  { key: "formula", label: "Formula", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => dash(r.formula) },
  { key: "description", label: "Description", sortable: false, fit: true, fitMax: 200, cellClassName: "whitespace-nowrap", render: (r) => dash(r.description) },
  {
    key: "action",
    label: "Action",
    sortable: false,
    className: "text-center",
    cellClassName: "whitespace-nowrap text-center",
    // The edit window is not built yet, so the pencil stays disabled.
    render: () => <IconAction disabled aria-label="Edit formula (not available yet)" />,
  },
];

export default function FormulaMaintenancePage() {
  const user = useCurrentUser();
  const readOnly = Boolean(user?.readOnly);
  const [selected, setSelected] = useState(() => new Set());

  const filters = useMaintenanceFilters("maintenance.formula.scope", {
    dated: false,
    onChange: () => setSelected(new Set()),
  });
  const list = useMaintenanceList(FORMULA_LIST_URL, filters.request, normalizeFormulaRow);
  const rows = useMemo(() => filterFormulaRows(list.rows, filters.search), [list.rows, filters.search]);

  const canSelect = () => !readOnly;
  const selectedRows = rows.filter((r) => canSelect(r) && selected.has(r.id));
  const actions = useRowActions({
    deleteRows: async (picked) => {
      await postJson(FORMULA_DELETE_URL, { tenantId: filters.request.tenantId, formulaIds: picked.map((r) => Number(r.id)) });
      list.reload();
    },
    noun: "formula",
    label: (r) => [r.process, r.account, r.product].filter(Boolean).join(" "),
    onDeleted: () => setSelected(new Set()),
  });

  const pageError = filters.error || list.error;

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <MaintenanceFilterCard
        filters={filters}
        searchPlaceholder="Search Process, Account, Product"
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
        loading={list.loading}
        rows={rows}
        selected={selected}
        onSelectedChange={setSelected}
        canSelect={canSelect}
        fitWidth
        minWidth="min-w-0"
        emptyMessage="No data found. Please adjust your search criteria and try again."
      />

      {actions.dialogs}
    </div>
  );
}
