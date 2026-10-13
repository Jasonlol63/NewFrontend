import { touchesLedger } from "@/lib/realtime/realtimeEvents";
import { useEffect, useMemo, useState } from "react";
import Toast from "@/components/shared/Toast.jsx";
import { useErrorToasts } from "@/hooks/useErrorToasts";
import { useNotice } from "@/hooks/useNotice";
import { useTranslation } from "react-i18next";
import DataTable from "@/components/shared/list/DataTable.jsx";
import { DateText } from "@/components/shared/list/cells.jsx";
import MaintenanceFilterCard from "../shared/MaintenanceFilterCard.jsx";
import { useMaintenanceFilters } from "../shared/useMaintenanceFilters";
import { useInfiniteMaintenanceList } from "../shared/useInfiniteMaintenanceList";
import { TRANSACTION_LIST_URL, normalizeTransactionRow } from "./transactionMaintenanceRules";

// The search box asks the server once typing has paused.
const SEARCH_DELAY_MS = 300;
// The server loads whole captures (about 6 lines each) per batch.
const CAPTURES_PER_BATCH = 25;

const dash = (v) => v || "-";
const AMOUNT = "text-right tabular-nums";

// Every cell stays on one line. Id_Product, Description and Remark are the columns that give way
// if the row is still wider than the card.
const baseColumns = [
  { key: "no", label: "no", sortable: false, cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
  { key: "createdAt", label: "createdAt", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => <DateText value={r.createdAt} variant="gradient" separator="/" /> },
  { key: "process", label: "process", sortable: false, fit: true, cellClassName: "font-semibold whitespace-nowrap", render: (r) => r.process },
  { key: "idProduct", label: "idProduct", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => r.idProduct },
  { key: "account", label: "account", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => r.account },
  { key: "description", label: "description", sortable: false, fit: true, fitMax: 200, cellClassName: "whitespace-nowrap", render: (r) => dash(r.description) },
  { key: "remark", label: "remark", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => dash(r.remark) },
  { key: "percent", label: "percent", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => dash(r.percent) },
  { key: "currency", label: "currency", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => r.currency },
  { key: "rate", label: "rate", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => dash(r.rate) },
  { key: "cr", label: "cr", sortable: false, className: "pl-2 text-right", cellClassName: `${AMOUNT} whitespace-nowrap`, render: (r) => r.cr },
  { key: "dr", label: "dr", sortable: false, className: "text-right", cellClassName: `${AMOUNT} whitespace-nowrap`, render: (r) => r.dr },
  { key: "createdBy", label: "submitter", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => r.createdBy },
];

export default function TransactionMaintenancePage() {
  const { t } = useTranslation(["maintenance", "common", "transaction"]);
  const { toasts, push, dismiss } = useNotice(5000);
  const columns = useMemo(() => baseColumns.map((c) => ({ ...c, label: t(`cols.${c.label}`) })), [t]);
  const filters = useMaintenanceFilters();
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(filters.search.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [filters.search]);
  const request = useMemo(() => filters.request && { ...filters.request, ...(query ? { q: query } : {}) }, [filters.request, query]);
  const list = useInfiniteMaintenanceList(TRANSACTION_LIST_URL, request, normalizeTransactionRow, touchesLedger, CAPTURES_PER_BATCH);

  useErrorToasts(push, [
    [filters.error, t("errors.processes")],
    [list.error, t("errors.list"), list.reload],
  ]);

  return (
    <div className="relative flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <Toast toasts={toasts} onClose={dismiss} />
      <MaintenanceFilterCard filters={filters} searchPlaceholder={t("search.transaction")} />

      <DataTable
        columns={columns}
        noun="records"
        loading={list.loading}
        rows={list.rows}
        total={list.total}
        virtual
        hasMore={list.hasMore}
        loadingMore={list.loadingMore}
        onLoadMore={list.loadMore}
        scrollResetKey={request}
        fitWidth
        minWidth="min-w-0"
        emptyMessage={filters.processSelected ? t("empty.noData") : t("empty.pickProcess")}
      />
    </div>
  );
}
