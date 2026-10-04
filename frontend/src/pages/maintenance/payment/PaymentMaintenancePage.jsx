import { useMemo, useState } from "react";
import DataTable from "@/components/shared/list/DataTable.jsx";
import { DateText } from "@/components/shared/list/cells.jsx";
import { DeleteButton } from "@/components/shared/list/ListToolbar.jsx";
import { useListScope } from "@/components/shared/list/useListScope";
import { useRowActions } from "@/components/shared/list/useRowActions.jsx";
import DropdownSelect from "@/components/shared/DropdownSelect.jsx";
import FilterRow from "@/components/shared/FilterRow.jsx";
import SegmentGroup from "@/components/shared/SegmentGroup.jsx";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOrderedCurrencies } from "@/hooks/useOrderedCurrencies";
import { postJson } from "@/lib/api";
import { toIsoDate } from "@/lib/date";
import { useCurrencyOptions } from "@/pages/dashboard/useDashboardData";
import { Field } from "@/pages/report/shared/ReportFilterCard.jsx";
import MaintenanceFilterCard from "../shared/MaintenanceFilterCard.jsx";
import { useMaintenanceList } from "../shared/useMaintenanceList";
import {
  PAYMENT_DELETE_URL,
  PAYMENT_LIST_URL,
  TYPE_OPTIONS,
  buildPaymentRequest,
  filterPaymentRows,
  normalizePaymentRow,
} from "./paymentMaintenanceRules";

const dash = (v) => v || "-";
const ALL_CURRENCIES = [{ value: "ALL", label: "All" }];

// Every cell stays on one line. Description, Remark and Deleter are the columns that give way
// (with "..." and the full text on hover) if the row is still wider than the card.
const columns = [
  { key: "no", label: "No.", sortable: false, cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
  { key: "createdAt", label: "Created At", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => <DateText value={r.createdAt} variant="gradient" separator="/" /> },
  { key: "toAccount", label: "Account(To)", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => r.toAccount },
  { key: "fromAccount", label: "Account(From)", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => dash(r.fromAccount) },
  { key: "amount", label: "Amount", sortable: false, className: "pl-2 text-right", cellClassName: "text-right whitespace-nowrap tabular-nums", render: (r) => r.amount },
  { key: "description", label: "Description", sortable: false, fit: true, fullText: (r) => r.description, cellClassName: "whitespace-nowrap", render: (r) => dash(r.description) },
  { key: "remark", label: "Remark", sortable: false, fit: true, fullText: (r) => r.remark, cellClassName: "whitespace-nowrap", render: (r) => dash(r.remark) },
  { key: "createdBy", label: "Submitter", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => dash(r.createdBy) },
  { key: "deletedBy", label: "Deleter", sortable: false, fit: true, fullText: (r) => r.deletedBy, cellClassName: "whitespace-nowrap", render: (r) => dash(r.deletedBy) },
];

export default function PaymentMaintenancePage() {
  const user = useCurrentUser();
  const readOnly = Boolean(user?.readOnly);
  const [type, setType] = useState("");
  const [currencyPick, setCurrencyPick] = useState(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [range, setRangeState] = useState(() => {
    const today = toIsoDate(new Date());
    return { from: today, to: today };
  });
  const clearSelection = () => setSelected(new Set());

  const scope = useListScope("maintenance.payment.scope", { onChange: clearSelection });
  const { tenantId } = scope;

  const currencyCodes = useCurrencyOptions(tenantId ? [tenantId] : []);
  // Chips in the order the user dragged them into, shared with the Dashboard.
  const [currencyOptions, setCurrencyOrder] = useOrderedCurrencies(currencyCodes);
  // "All" or one currency; starts on MYR when the company has it, else its first currency.
  const currency =
    currencyPick === "ALL" || currencyCodes.includes(currencyPick)
      ? currencyPick
      : currencyCodes.includes("MYR")
        ? "MYR"
        : (currencyCodes[0] ?? null);

  const request = useMemo(
    () =>
      tenantId && currency
        ? buildPaymentRequest({ tenantId, dateFrom: range.from, dateTo: range.to, type, currency })
        : null,
    [tenantId, currency, range, type]
  );
  const payments = useMaintenanceList(PAYMENT_LIST_URL, request, normalizePaymentRow);
  const rows = useMemo(() => filterPaymentRows(payments.rows, search), [payments.rows, search]);

  // Archived rows are already deleted.
  const canSelect = (r) => !readOnly && !r.deleted;
  const selectedRows = rows.filter((r) => canSelect(r) && selected.has(r.id));
  const actions = useRowActions({
    deleteRows: async (list) => {
      await postJson(PAYMENT_DELETE_URL, { tenantId, transactionIds: list.map((r) => r.transactionId) });
      payments.reload();
    },
    noun: "payment",
    label: (r) => `${r.toAccount} ${r.amount}`,
    onDeleted: clearSelection,
  });

  const filters = {
    scope,
    search,
    setSearch,
    range,
    setRange: (value) => {
      setRangeState(value);
      clearSelection();
    },
  };
  const pageError = scope.error || payments.error;

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <MaintenanceFilterCard
        filters={filters}
        searchPlaceholder="Search Account, Description"
        field={
          <Field label="Transaction Type:">
            <DropdownSelect
              options={TYPE_OPTIONS}
              value={type}
              onChange={(v) => {
                setType(v);
                clearSelection();
              }}
              ariaLabel="Transaction Type"
            />
          </Field>
        }
        actions={<DeleteButton count={selectedRows.length} onClick={() => actions.requestDelete(selectedRows)} />}
        extraRows={
          <FilterRow label="Currency:">
            {currencyCodes.length ? (
              <SegmentGroup
                leading={ALL_CURRENCIES}
                options={currencyOptions}
                value={currency}
                onChange={(v) => {
                  setCurrencyPick(v);
                  clearSelection();
                }}
                onReorder={setCurrencyOrder}
              />
            ) : (
              <span className="text-xs font-medium text-dash-faint">No currency available</span>
            )}
          </FilterRow>
        }
      />

      {pageError && (
        <div className="flex-none rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-medium text-dash-down">
          {pageError}
        </div>
      )}

      <DataTable
        columns={columns}
        noun="records"
        loading={payments.loading}
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
