import { REALTIME_DOMAINS } from "@/lib/realtime/realtimeEvents";
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
import MaintenanceFilterCard from "../shared/MaintenanceFilterCard.jsx";
import { useMaintenanceFilters } from "../shared/useMaintenanceFilters";
import { useInfiniteMaintenanceList } from "../shared/useInfiniteMaintenanceList";
import { CAPTURE_DELETE_URL, CAPTURE_LIST_URL, normalizeCaptureRow } from "./captureMaintenanceRules";

// The search box asks the server once typing has paused.
const SEARCH_DELAY_MS = 300;

// Every cell stays on one line; the text columns give way with "..." only when the row does not fit the card.
const baseColumns = [
  { key: "no", label: "no", sortable: false, className: "w-[56px]", cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
  { key: "created", label: "dtsCreated", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => <DateText value={r.createdAt} variant="gradient" separator="/" /> },
  { key: "product", label: "product", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => r.product },
  { key: "process", label: "process", sortable: false, fit: true, cellClassName: "font-semibold whitespace-nowrap", render: (r) => r.process },
  { key: "currency", label: "currency", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => r.currency },
  { key: "createdBy", label: "submittedBy", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => r.createdBy },
  { key: "deletedBy", label: "deletedBy", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => r.deletedBy || "-" },
];

export default function CaptureMaintenancePage() {
  const { t } = useTranslation(["maintenance", "common", "transaction"]);
  const { toasts, push, dismiss } = useNotice(5000);
  const columns = useMemo(() => baseColumns.map((c) => ({ ...c, label: t(`cols.${c.label}`) })), [t]);
  const user = useCurrentUser();
  const readOnly = Boolean(user?.readOnly);
  const [selected, setSelected] = useState(() => new Set());

  const filters = useMaintenanceFilters({ onChange: () => setSelected(new Set()) });
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(filters.search.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [filters.search]);
  const request = useMemo(() => filters.request && { ...filters.request, ...(query ? { q: query } : {}) }, [filters.request, query]);
  const captures = useInfiniteMaintenanceList(CAPTURE_LIST_URL, request, normalizeCaptureRow, [REALTIME_DOMAINS.DATACAPTURE]);
  const rows = captures.rows;

  // Archived captures are already deleted.
  const canSelect = (r) => !readOnly && !r.deleted;
  const selectedRows = rows.filter((r) => canSelect(r) && selected.has(r.id));
  const actions = useRowActions({
    deleteRows: async (list) => {
      await postJson(CAPTURE_DELETE_URL, { tenantId: filters.request.tenantId, captureIds: list.map((r) => r.captureId) });
      captures.reload();
    },
    noun: "capture",
    push,
    label: (r) => `${r.process} ${r.created}`,
    onDeleted: () => setSelected(new Set()),
  });

  useErrorToasts(push, [
    [filters.error, t("errors.processes")],
    [captures.error, t("errors.list"), captures.reload],
  ]);

  return (
    <div className="relative flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <Toast toasts={toasts} onClose={dismiss} />
      <MaintenanceFilterCard
        filters={filters}
        searchPlaceholder={t("search.capture")}
        actions={<DeleteButton count={selectedRows.length} onClick={() => actions.requestDelete(selectedRows)} />}
      />

      <DataTable
        columns={columns}
        noun="records"
        loading={captures.loading}
        rows={rows}
        total={captures.total}
        virtual
        hasMore={captures.hasMore}
        loadingMore={captures.loadingMore}
        onLoadMore={captures.loadMore}
        scrollResetKey={request}
        rowHeight={26}
        selected={selected}
        onSelectedChange={setSelected}
        canSelect={canSelect}
        lockedSelect={(r) => r.deleted}
        rowClassName={(r) => r.deleted && "[&>td]:text-dash-down [&>td]:line-through"}
        fitWidth
        minWidth="min-w-0"
        emptyMessage={filters.processSelected ? t("empty.noData") : t("empty.pickProcess")}
      />

      {actions.dialogs}
    </div>
  );
}
