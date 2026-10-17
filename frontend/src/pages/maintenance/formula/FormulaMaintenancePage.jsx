import { useEffect, useMemo, useState } from "react";
import Toast from "@/components/shared/Toast.jsx";
import { useErrorToasts } from "@/hooks/useErrorToasts";
import { useNotice } from "@/hooks/useNotice";
import { useTranslation } from "react-i18next";
import DataTable from "@/components/shared/list/DataTable.jsx";
import { IconAction } from "@/components/shared/list/cells.jsx";
import { DeleteButton } from "@/components/shared/list/ListToolbar.jsx";
import { useRowActions } from "@/components/shared/list/useRowActions.jsx";
import { useTenantList } from "@/components/shared/list/useTenantList";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { postJson } from "@/lib/api";
import { normalizeAccountRow } from "@/pages/account/accountRules";
import FormulaEditModal from "./FormulaEditModal.jsx";
import MaintenanceFilterCard from "../shared/MaintenanceFilterCard.jsx";
import { useMaintenanceFilters } from "../shared/useMaintenanceFilters";
import { useInfiniteMaintenanceList } from "../shared/useInfiniteMaintenanceList";
import { FORMULA_DELETE_URL, FORMULA_LIST_URL, normalizeFormulaRow } from "./formulaMaintenanceRules";

// The search box asks the server once typing has paused.
const SEARCH_DELAY_MS = 300;

const dash = (v) => v || "-";

// Every cell stays on one line. Formula and Description are the columns that give way (with "..."
// and the full text on hover) if the row is still wider than the card.
const baseColumns = [
  { key: "no", label: "no", sortable: false, cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
  { key: "process", label: "process", sortable: false, fit: true, cellClassName: "font-semibold whitespace-nowrap", render: (r) => r.process },
  { key: "account", label: "account", sortable: false, fit: true, grow: 4, cellClassName: "whitespace-nowrap", render: (r) => dash(r.account) },
  { key: "currency", label: "currency", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => dash(r.currency) },
  { key: "source", label: "source", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => dash(r.source) },
  { key: "product", label: "product", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => r.product },
  { key: "inputMethod", label: "inputMethod", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => dash(r.inputMethod) },
  { key: "formula", label: "formula", sortable: false, fit: true, cellClassName: "whitespace-nowrap", render: (r) => dash(r.formula) },
  { key: "description", label: "description", sortable: false, fit: true, fitMax: 160, cellClassName: "whitespace-nowrap", render: (r) => dash(r.description) },
];

export default function FormulaMaintenancePage() {
  const { t } = useTranslation(["maintenance", "common"]);
  const { toasts, push, dismiss } = useNotice(5000);
  const user = useCurrentUser();
  const readOnly = Boolean(user?.readOnly);
  const [selected, setSelected] = useState(() => new Set());
  const [editing, setEditing] = useState(null);

  const filters = useMaintenanceFilters({
    dated: false,
    allByDefault: false,
    onChange: () => setSelected(new Set()),
  });
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(filters.search.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [filters.search]);
  // With no process picked, a search still looks through All Process.
  const base = filters.request ?? (query ? filters.allProcessRequest : null);
  const request = useMemo(() => base && { ...base, ...(query ? { q: query } : {}) }, [base, query]);
  const list = useInfiniteMaintenanceList(FORMULA_LIST_URL, request, normalizeFormulaRow);
  const rows = list.rows;

  // The accounts the Edit window offers: the company's active ones.
  const { tenantId } = filters.scope;
  const { rows: accountRows } = useTenantList("/api/account", tenantId, { normalize: normalizeAccountRow });
  const accounts = useMemo(() => accountRows.filter((a) => a.status === "active"), [accountRows]);

  const columns = useMemo(
    () => [
      ...baseColumns.map((c) => ({ ...c, label: t(`cols.${c.label}`) })),
      {
        key: "action",
        label: t("cols.action"),
        sortable: false,
        className: "text-center",
        cellClassName: "whitespace-nowrap text-center",
        render: (r) => (
          <div className="flex items-center justify-center">
            <IconAction
              className="size-6"
              disabled={readOnly}
              onClick={() => setEditing(r)}
              aria-label={readOnly ? t("readOnly") : t("formula.editRow")}
              title={readOnly ? t("readOnly") : t("formula.editRow")}
            />
          </div>
        ),
      },
    ],
    [readOnly, t]
  );

  const canSelect = () => !readOnly;
  const selectedRows = rows.filter((r) => canSelect(r) && selected.has(r.id));
  const actions = useRowActions({
    deleteRows: async (picked) => {
      await postJson(FORMULA_DELETE_URL, { tenantId: request.tenantId, formulaIds: picked.map((r) => Number(r.id)) });
      await list.refreshLoaded();
    },
    noun: "formula",
    push,
    label: (r) => [r.process, r.account, r.product].filter(Boolean).join(" "),
    onDeleted: () => setSelected(new Set()),
  });

  useErrorToasts(push, [
    [filters.error, t("errors.processes")],
    [list.error, t("errors.list"), list.reload],
  ]);

  return (
    <div className="relative flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <Toast toasts={toasts} onClose={dismiss} />
      <MaintenanceFilterCard
        filters={filters}
        searchPlaceholder={t("search.formula")}
        actions={<DeleteButton count={selectedRows.length} onClick={() => actions.requestDelete(selectedRows)} />}
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
        rowHeight={26}
        selected={selected}
        onSelectedChange={setSelected}
        canSelect={canSelect}
        fitWidth
        minWidth="min-w-0"
        emptyMessage={request ? t("empty.noData") : t("empty.pickProcess")}
      />

      {actions.dialogs}

      {editing && (
        <FormulaEditModal row={editing} tenantId={tenantId} accounts={accounts} onClose={() => setEditing(null)} onSaved={list.refreshLoaded} notify={push} />
      )}
    </div>
  );
}
