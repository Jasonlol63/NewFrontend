import { touchesLedger } from "@/lib/realtime/realtimeEvents";
import { useEffect, useMemo, useState } from "react";
import Toast from "@/components/shared/Toast.jsx";
import { useErrorToasts } from "@/hooks/useErrorToasts";
import { useNotice } from "@/hooks/useNotice";
import { useTranslation } from "react-i18next";
import DataTable from "@/components/shared/list/DataTable.jsx";
import { DateText } from "@/components/shared/list/cells.jsx";
import { DeleteButton } from "@/components/shared/list/ListToolbar.jsx";
import { useRowActions } from "@/components/shared/list/useRowActions.jsx";
import DropdownSelect from "@/components/shared/DropdownSelect.jsx";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { postJson } from "@/lib/api";
import { Field } from "@/pages/report/shared/ReportFilterCard.jsx";
import CurrencyFilterRow from "../shared/CurrencyFilterRow.jsx";
import MaintenanceFilterCard from "../shared/MaintenanceFilterCard.jsx";
import { useCurrencyFilters } from "../shared/useCurrencyFilters";
import { useInfiniteMaintenanceList } from "../shared/useInfiniteMaintenanceList";
import {
  PAYMENT_DELETE_URL,
  PAYMENT_LIST_URL,
  TYPE_OPTIONS,
  buildPaymentRequest,
  normalizePaymentRow,
} from "./paymentMaintenanceRules";

// The search box asks the server once typing has paused.
const SEARCH_DELAY_MS = 300;

const dash = (v) => v || "-";

// Every cell stays on one line. Description, Remark and Deleter are the columns that give way
// if the row is still wider than the card.
const baseColumns = [
  { key: "no", label: "no", sortable: false, cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
  { key: "createdAt", label: "createdAt", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => <DateText value={r.createdAt} variant="gradient" separator="/" /> },
  { key: "toAccount", label: "toAccount", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => r.toAccount },
  { key: "fromAccount", label: "fromAccount", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => dash(r.fromAccount) },
  { key: "amount", label: "amount", sortable: false, className: "pl-2 text-right", cellClassName: "text-right whitespace-nowrap tabular-nums", render: (r) => r.amount },
  { key: "description", label: "description", sortable: false, fit: true, fitMax: 200, cellClassName: "whitespace-nowrap", render: (r) => dash(r.description) },
  { key: "remark", label: "remark", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => dash(r.remark) },
  { key: "createdBy", label: "submitter", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => dash(r.createdBy) },
  { key: "deletedBy", label: "deleter", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => dash(r.deletedBy) },
];

export default function PaymentMaintenancePage() {
  const { t } = useTranslation(["maintenance", "common", "transaction"]);
  const { toasts, push, dismiss } = useNotice(5000);
  const columns = useMemo(() => baseColumns.map((c) => ({ ...c, label: t(`cols.${c.label}`) })), [t]);
  const typeOptions = useMemo(() => TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.value ? t(`transaction:types.${o.value}`) : t("filter.allTypes") })), [t]);
  const user = useCurrentUser();
  const readOnly = Boolean(user?.readOnly);
  const [type, setType] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const clearSelection = () => setSelected(new Set());

  const filters = useCurrencyFilters({ onChange: clearSelection });
  const { tenantId, currency, range } = filters;

  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(filters.search.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [filters.search]);
  const request = useMemo(
    () =>
      tenantId && currency
        ? { ...buildPaymentRequest({ tenantId, dateFrom: range.from, dateTo: range.to, type, currency }), ...(query ? { q: query } : {}) }
        : null,
    [tenantId, currency, range, type, query]
  );
  const payments = useInfiniteMaintenanceList(PAYMENT_LIST_URL, request, normalizePaymentRow, touchesLedger);
  const rows = payments.rows;

  // Archived rows are already deleted.
  const canSelect = (r) => !readOnly && !r.deleted;
  const selectedRows = rows.filter((r) => canSelect(r) && selected.has(r.id));
  const actions = useRowActions({
    deleteRows: async (list) => {
      await postJson(PAYMENT_DELETE_URL, { tenantId, transactionIds: list.map((r) => r.transactionId) });
      payments.reload();
    },
    noun: "payment",
    push,
    label: (r) => `${r.toAccount} ${r.amount}`,
    // The API deletes a whole RATE (both currencies, the Middle-Man and the fees) even when only one of its rows is picked.
    note: (list) => (list.some((r) => r.type === "RATE") ? t("payment.rateNote") : undefined),
    onDeleted: clearSelection,
  });

  useErrorToasts(push, [
    [filters.scope.error, t("errors.scope")],
    [payments.error, t("errors.list"), payments.reload],
  ]);

  return (
    <div className="relative flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <Toast toasts={toasts} onClose={dismiss} />
      <MaintenanceFilterCard
        filters={filters}
        searchPlaceholder={t("search.payment")}
        field={
          <Field label={t("filter.transactionType")}>
            <DropdownSelect
              options={typeOptions}
              value={type}
              onChange={(v) => {
                setType(v);
                clearSelection();
              }}
              ariaLabel={t("filter.transactionTypeLabel")}
            />
          </Field>
        }
        actions={<DeleteButton count={selectedRows.length} onClick={() => actions.requestDelete(selectedRows)} />}
        extraRows={<CurrencyFilterRow filters={filters} />}
      />

      <DataTable
        columns={columns}
        noun="records"
        loading={payments.loading}
        rows={rows}
        total={payments.total}
        virtual
        hasMore={payments.hasMore}
        loadingMore={payments.loadingMore}
        onLoadMore={payments.loadMore}
        scrollResetKey={request}
        rowHeight={26}
        selected={selected}
        onSelectedChange={setSelected}
        canSelect={canSelect}
        lockedSelect={(r) => r.deleted}
        rowClassName={(r) => r.deleted && "[&>td]:text-dash-down [&>td]:line-through"}
        fitWidth
        minWidth="min-w-0"
        emptyMessage={t("empty.noData")}
      />

      {actions.dialogs}
    </div>
  );
}
