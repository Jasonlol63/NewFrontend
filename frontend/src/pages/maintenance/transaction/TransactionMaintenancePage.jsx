import { useMemo } from "react";
import DataTable from "@/components/shared/list/DataTable.jsx";
import { DateText } from "@/components/shared/list/cells.jsx";
import MaintenanceFilterCard from "../shared/MaintenanceFilterCard.jsx";
import { useMaintenanceFilters } from "../shared/useMaintenanceFilters";
import { useMaintenanceList } from "../shared/useMaintenanceList";
import { TRANSACTION_LIST_URL, filterTransactionRows, normalizeTransactionRow } from "./transactionMaintenanceRules";

const dash = (v) => v || "-";
const AMOUNT = "text-right tabular-nums";

// Every cell stays on one line. Id_Product, Description and Remark are the columns that give way
// (with "..." and the full text on hover) if the row is still wider than the card.
const columns = [
  { key: "no", label: "No.", sortable: false, cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
  { key: "createdAt", label: "Created At", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => <DateText value={r.createdAt} variant="gradient" separator="/" /> },
  { key: "process", label: "Process", sortable: false, cellClassName: "font-semibold whitespace-nowrap", render: (r) => r.process },
  { key: "idProduct", label: "Id_Product", sortable: false, fit: true, fullText: (r) => r.idProduct, cellClassName: "whitespace-nowrap", render: (r) => r.idProduct },
  { key: "account", label: "Account", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => r.account },
  { key: "description", label: "Description", sortable: false, fit: true, fullText: (r) => r.description, cellClassName: "whitespace-nowrap", render: (r) => dash(r.description) },
  { key: "remark", label: "Remark", sortable: false, fit: true, fullText: (r) => r.remark, cellClassName: "whitespace-nowrap", render: (r) => dash(r.remark) },
  { key: "percent", label: "Percent", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => dash(r.percent) },
  { key: "currency", label: "Currency", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => r.currency },
  { key: "rate", label: "Rate", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => dash(r.rate) },
  { key: "cr", label: "Cr", sortable: false, className: "pl-2 text-right", cellClassName: `${AMOUNT} whitespace-nowrap`, render: (r) => r.cr },
  { key: "dr", label: "Dr", sortable: false, className: "text-right", cellClassName: `${AMOUNT} whitespace-nowrap`, render: (r) => r.dr },
  { key: "createdBy", label: "Submitter", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => r.createdBy },
];

export default function TransactionMaintenancePage() {
  const filters = useMaintenanceFilters("maintenance.transaction.scope");
  const list = useMaintenanceList(TRANSACTION_LIST_URL, filters.request, normalizeTransactionRow);
  const rows = useMemo(() => filterTransactionRows(list.rows, filters.search), [list.rows, filters.search]);

  const pageError = filters.error || list.error;

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <MaintenanceFilterCard filters={filters} searchPlaceholder="Search Product, Account, Description" />

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
        fitWidth
        minWidth="min-w-0"
        emptyMessage="No data found. Please adjust your search criteria and try again."
      />
    </div>
  );
}
