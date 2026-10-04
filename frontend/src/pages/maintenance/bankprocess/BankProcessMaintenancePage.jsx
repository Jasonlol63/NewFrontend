import { useMemo, useState } from "react";
import DataTable from "@/components/shared/list/DataTable.jsx";
import { DateText } from "@/components/shared/list/cells.jsx";
import { DeleteButton } from "@/components/shared/list/ListToolbar.jsx";
import { useRowActions } from "@/components/shared/list/useRowActions.jsx";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { postJson } from "@/lib/api";
import CurrencyFilterRow from "../shared/CurrencyFilterRow.jsx";
import MaintenanceFilterCard from "../shared/MaintenanceFilterCard.jsx";
import { useCurrencyFilters } from "../shared/useCurrencyFilters";
import { useMaintenanceList } from "../shared/useMaintenanceList";
import {
  BANK_PROCESS_DELETE_URL,
  BANK_PROCESS_LIST_URL,
  buildBankProcessRequest,
  filterBankProcessRows,
  normalizeBankProcessRow,
} from "./bankProcessMaintenanceRules";

const dash = (v) => v || "-";

// Every cell stays on one line; only Description may end in "..." when the row is wider than the card.
const columns = [
  { key: "no", label: "No.", sortable: false, cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
  { key: "createdAt", label: "Dts Created", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => <DateText value={r.createdAt} variant="gradient" separator="/" /> },
  { key: "account", label: "Account", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => r.account },
  { key: "from", label: "From", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => dash(r.from) },
  { key: "amount", label: "Amount", sortable: false, className: "pl-2 text-right", cellClassName: "text-right whitespace-nowrap tabular-nums", render: (r) => r.amount },
  { key: "description", label: "Description", sortable: false, fit: true, fitMax: 230, cellClassName: "whitespace-nowrap", render: (r) => dash(r.description) },
  { key: "remark", label: "Remark", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => dash(r.remark) },
  { key: "createdBy", label: "Submitted By", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => dash(r.createdBy) },
  { key: "deletedBy", label: "Deleted By", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => dash(r.deletedBy) },
];

export default function BankProcessMaintenancePage() {
  const user = useCurrentUser();
  const readOnly = Boolean(user?.readOnly);
  const [selected, setSelected] = useState(() => new Set());
  const clearSelection = () => setSelected(new Set());

  const filters = useCurrencyFilters("maintenance.bankprocess.scope", { onChange: clearSelection });
  const { tenantId, currency, range } = filters;

  const request = useMemo(
    () =>
      tenantId && currency ? buildBankProcessRequest({ tenantId, dateFrom: range.from, dateTo: range.to, currency }) : null,
    [tenantId, currency, range]
  );
  const list = useMaintenanceList(BANK_PROCESS_LIST_URL, request, normalizeBankProcessRow);
  const rows = useMemo(() => filterBankProcessRows(list.rows, filters.search), [list.rows, filters.search]);

  // Archived rows are already deleted.
  const canSelect = (r) => !readOnly && !r.deleted;
  const selectedRows = rows.filter((r) => canSelect(r) && selected.has(r.id));
  const actions = useRowActions({
    deleteRows: async (picked) => {
      await postJson(BANK_PROCESS_DELETE_URL, { tenantId, transactionIds: picked.map((r) => r.transactionId) });
      list.reload();
    },
    noun: "bank process",
    label: (r) => `${r.account} ${r.amount}`,
    onDeleted: clearSelection,
  });

  const pageError = filters.scope.error || list.error;

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <MaintenanceFilterCard
        filters={filters}
        searchPlaceholder="Search Account, From, Description"
        actions={<DeleteButton count={selectedRows.length} onClick={() => actions.requestDelete(selectedRows)} />}
        extraRows={<CurrencyFilterRow filters={filters} />}
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
