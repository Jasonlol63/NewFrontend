import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import DataTable from "@/components/shared/list/DataTable.jsx";
import ListToolbar, { DeleteButton, PrimaryButton } from "@/components/shared/list/ListToolbar.jsx";
import { Badge, IconAction, StatusBadge } from "@/components/shared/list/cells.jsx";
import { useListScope } from "@/components/shared/list/useListScope";
import { useListView } from "@/components/shared/list/useListView";
import { useRowActions } from "@/components/shared/list/useRowActions.jsx";
import { useSession } from "@/context/session";
import Toast from "@/components/shared/Toast.jsx";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNotice } from "@/hooks/useNotice";
import { postJson } from "@/lib/api";
import BankProcessView from "./bank/BankProcessView.jsx";
import ProcessFormModal from "./games/ProcessFormModal.jsx";
import { DAYS, filterProcesses, sortProcesses } from "./games/processRules";
import { hasProcesses, prefetchProcesses, useProcessList } from "./games/useProcessList";

// The big companies: once the page has settled they are loaded in the background, one by one, so the first switch to them is quick too.
const PREFETCH_COMPANIES = ["95", "AG"];

// Only the weekdays the process runs on, each as a three-letter chip (MON, TUE ...; 周一 in Chinese) at every screen size.
function DayUse({ days }) {
  const { t } = useTranslation("process");
  const on = new Set(days);
  const list = DAYS.filter(({ day }) => on.has(day));
  if (!list.length) return <span className="text-dash-faint">-</span>;
  return (
    <span className="flex gap-[3px]">
      {list.map(({ day }) => (
        <span
          key={day}
          title={t(`days.${day}.full`)}
          className="inline-flex h-[20px] items-center justify-center rounded-[5px] border border-[#bcd9fb] bg-[#e0edff] px-1.5 type-table-cell font-semibold! text-[#1d4ed8]"
        >
          {t(`days.${day}.abbr`).toUpperCase()}
        </span>
      ))}
    </span>
  );
}

export default function ProcessPage() {
  const { t } = useTranslation(["process", "common"]);
  const { toasts, push, dismiss } = useNotice(5000);
  const user = useCurrentUser();
  const readOnly = Boolean(user?.readOnly);
  const [addOpen, setAddOpen] = useState(false);
  const closeAdd = useCallback(() => setAddOpen(false), []);
  const [editRow, setEditRow] = useState(null);
  const closeEdit = useCallback(() => setEditRow(null), []);
  const scope = useListScope({ onChange: () => view.reset() });
  // The picked company's category decides the page: Bank companies get the Bank Process list, Game companies this one.
  const { user: session } = useSession();
  const isBank = scope.company !== null && Boolean(session?.tenant_has_bank);
  const { rows: allRows, error: listError, loading, toggleStatus, deleteRows, reload } = useProcessList(isBank ? null : scope.tenantId);
  const rows = useMemo(() => allRows.filter((p) => p.category === "GAME"), [allRows]);

  // A company chip pressed down: its list starts loading before the click is finished.
  const prefetchCompany = useCallback(
    (code) => prefetchProcesses(scope.companyOptions.find((c) => c.value === code)?.tenantId),
    [scope.companyOptions]
  );
  // The big companies in the background once this one has loaded (not while the tab is hidden, not what is remembered already).
  useEffect(() => {
    if (isBank || loading) return undefined;
    const ids = PREFETCH_COMPANIES.map((code) => scope.companyOptions.find((c) => c.value === code)?.tenantId).filter(
      (id) => id && id !== scope.tenantId && !hasProcesses(id)
    );
    if (!ids.length) return undefined;
    let cancelled = false;
    let timer = setTimeout(async () => {
      for (const id of ids) {
        if (cancelled || document.hidden) return;
        prefetchProcesses(id);
        await new Promise((resolve) => {
          timer = setTimeout(resolve, 1500);
        });
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isBank, loading, scope.companyOptions, scope.tenantId]);

  // Sends what the modal built ([{ url, key, label, body }], several with Multi-Process) one after another; on success
  // the modal closes, the list is fetched again and a toast says so. A failure goes back to the modal, which shows it as a toast:
  // with Multi-Process it says how many were created before it (they stay created) and carries their keys in err.createdKeys.
  const submitProcess = useCallback(
    async (requests) => {
      const created = [];
      for (const r of requests) {
        try {
          await postJson(r.url, r.body);
          created.push(r);
        } catch (err) {
          if (!created.length) throw err;
          reload();
          const failure = new Error(err.message);
          failure.title = t("errors.partial", { done: created.length, total: requests.length });
          failure.toastDetail = [t("errors.partialCreated", { list: created.map((c) => c.label).join(", ") }), t("errors.partialFailed", { code: r.label, message: err.message })];
          failure.createdKeys = created.map((c) => c.key);
          throw failure;
        }
      }
      const editing = Boolean(editRow);
      closeAdd();
      closeEdit();
      reload();
      push(editing ? t("toast.updated") : requests.length === 1 ? t("toast.added", { code: requests[0].label }) : t("toast.addedMany", { count: requests.length }));
    },
    [closeAdd, closeEdit, reload, push, t, editRow]
  );

  // Only inactive processes can be deleted.
  const canSelect = useCallback((p) => !readOnly && p.status === "inactive", [readOnly]);
  const view = useListView(rows, { filter: filterProcesses, sort: sortProcesses, canSelect, rowMin: 26 });
  const actions = useRowActions({
    toggleStatus,
    deleteRows,
    noun: "process",
    label: (p) => (p.description ? `${p.code} (${p.description})` : p.code),
    onDeleted: view.clearSelection,
    push,
  });

  const columns = [
    { key: "no", label: t("col.no"), sortable: false, className: "w-[56px]", cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
    { key: "code", label: t("col.code"), fit: true, cellClassName: "whitespace-nowrap font-semibold", render: (p) => p.code },
    { key: "description", label: t("col.description"), fit: true, render: (p) => p.description || "-" },
    {
      key: "status",
      label: t("col.status"),
      render: (p) => (
        <StatusBadge
          status={p.status}
          pending={actions.pendingIds.has(p.id)}
          onToggle={readOnly ? undefined : () => actions.toggle(p)}
          disabledTitle={readOnly ? t("readOnly") : undefined}
        />
      ),
    },
    { key: "currency", label: t("col.currency"), render: (p) => <Badge className="border-[#bcd9fb] bg-white text-brand-navy">{p.currency}</Badge> },
    { key: "days", label: t("col.days"), render: (p) => <DayUse days={p.days} /> },
    {
      key: "action",
      label: t("col.action"),
      sortable: false,
      className: "text-center",
      cellClassName: "whitespace-nowrap",
      render: (p) => (
        <div className="flex items-center justify-center">
          <IconAction className="size-6" onClick={() => setEditRow(p)} disabled={readOnly} title={readOnly ? t("readOnly") : t("page.edit")} aria-label={t("page.edit")} />
        </div>
      ),
    },
  ];

  // A list or company that did not load is an error toast (once per error).
  useEffect(() => {
    if (listError) push(t("errors.list"), "error", listError, { label: t("common:retry"), onClick: reload });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listError]);
  useEffect(() => {
    if (scope.error) push(t("errors.scope"), "error", scope.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.error]);

  // Bank companies have their own list.
  if (isBank) return <BankProcessView scope={scope} readOnly={readOnly} />;

  return (
    <div className="relative flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <Toast toasts={toasts} onClose={dismiss} />
      <ListToolbar
        primaryAction={
          <PrimaryButton icon={Plus} onClick={() => setAddOpen(true)} disabled={readOnly} title={readOnly ? t("readOnly") : undefined}>
            {t("page.add")}
          </PrimaryButton>
        }
        actions={<DeleteButton count={view.selectedRows.length} onClick={() => actions.requestDelete(view.selectedRows)} />}
        searchPlaceholder={t("page.search")}
        search={view.search}
        onSearchChange={view.setSearch}
        chips={view.chips}
        onChipChange={view.setChip}
        scope={scope}
        onCompanyPressStart={prefetchCompany}
      />

      <DataTable columns={columns} noun="processes" loading={loading && rows.length === 0} boxedPager fitWidth stableColumns measureRows={view.table.allRows} minWidth="min-w-0" {...view.table} />

      {actions.dialogs}

      {editRow && <ProcessFormModal mode="edit" process={editRow} tenantId={scope.tenantId} processes={rows} onClose={closeEdit} onSave={submitProcess} />}
      {addOpen && <ProcessFormModal tenantId={scope.tenantId} processes={rows} onClose={closeAdd} onSave={submitProcess} />}
    </div>
  );
}
