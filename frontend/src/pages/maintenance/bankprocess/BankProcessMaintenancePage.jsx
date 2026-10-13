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
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { postJson } from "@/lib/api";
import CurrencyFilterRow from "../shared/CurrencyFilterRow.jsx";
import MaintenanceFilterCard from "../shared/MaintenanceFilterCard.jsx";
import { useCurrencyFilters } from "../shared/useCurrencyFilters";
import { useInfiniteMaintenanceList } from "../shared/useInfiniteMaintenanceList";
import {
  BANK_PROCESS_DELETE_URL,
  BANK_PROCESS_LIST_URL,
  buildBankProcessRequest,
  normalizeBankProcessRow,
} from "./bankProcessMaintenanceRules";

// The search box asks the server once typing has paused.
const SEARCH_DELAY_MS = 300;

const dash = (v) => v || "-";

// Every cell stays on one line; only Description may end in "..." when the row is wider than the card.
const baseColumns = [
  { key: "no", label: "no", sortable: false, cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
  { key: "createdAt", label: "dtsCreated", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => <DateText value={r.createdAt} variant="gradient" separator="/" /> },
  { key: "account", label: "account", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => r.account },
  { key: "from", label: "from", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => dash(r.from) },
  { key: "amount", label: "amount", sortable: false, className: "pl-2 text-right", cellClassName: "text-right whitespace-nowrap tabular-nums", render: (r) => r.amount },
  { key: "description", label: "description", sortable: false, fit: true, fitMax: 230, cellClassName: "whitespace-nowrap", render: (r) => dash(r.description) },
  { key: "remark", label: "remark", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => dash(r.remark) },
  { key: "createdBy", label: "submittedBy", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => dash(r.createdBy) },
  { key: "deletedBy", label: "deletedBy", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => dash(r.deletedBy) },
];

export default function BankProcessMaintenancePage() {
  const { t } = useTranslation(["maintenance", "common", "transaction"]);
  const { toasts, push, dismiss } = useNotice(5000);
  const columns = useMemo(() => baseColumns.map((c) => ({ ...c, label: t(`cols.${c.label}`) })), [t]);
  const user = useCurrentUser();
  const readOnly = Boolean(user?.readOnly);
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
        ? { ...buildBankProcessRequest({ tenantId, dateFrom: range.from, dateTo: range.to, currency }), ...(query ? { q: query } : {}) }
        : null,
    [tenantId, currency, range, query]
  );
  const list = useInfiniteMaintenanceList(BANK_PROCESS_LIST_URL, request, normalizeBankProcessRow, touchesLedger);
  const rows = list.rows;

  // Archived rows are already deleted.
  const canSelect = (r) => !readOnly && !r.deleted;
  const selectedRows = rows.filter((r) => canSelect(r) && selected.has(r.id));
  const actions = useRowActions({
    deleteRows: async (picked) => {
      await postJson(BANK_PROCESS_DELETE_URL, { tenantId, transactionIds: picked.map((r) => r.transactionId) });
      list.reload();
    },
    noun: "bank process",
    push,
    label: (r) => `${r.account} ${r.amount}`,
    onDeleted: clearSelection,
  });

  useErrorToasts(push, [
    [filters.scope.error, t("errors.scope")],
    [list.error, t("errors.list"), list.reload],
  ]);

  return (
    <div className="relative flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <Toast toasts={toasts} onClose={dismiss} />
      <MaintenanceFilterCard
        filters={filters}
        searchPlaceholder={t("search.bankProcess")}
        actions={<DeleteButton count={selectedRows.length} onClick={() => actions.requestDelete(selectedRows)} />}
        extraRows={<CurrencyFilterRow filters={filters} />}
      />

      <DataTable
        columns={columns}
        noun="records"
        loading={list.loading}
        rows={rows}
        total={list.total}
        virtual
        hasMore={list.hasMore}
        loadingMore={list.loadingMore}
        onLoadMore={list.loadMore}
        scrollResetKey={request}
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
