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
import { useProcessList } from "./games/useProcessList";

// The seven weekdays, the ones the process runs on lit blue. Slightly smaller on narrow screens.
function DayUse({ days }) {
  const { t } = useTranslation("process");
  const on = new Set(days);
  return (
    <span className="flex gap-[3px] max-[1100px]:gap-0.5">
      {DAYS.map(({ day }) => (
        <span
          key={day}
          title={t(`days.${day}.full`)}
          className={cn(
            "inline-flex h-[22px] min-w-[27px] items-center justify-center rounded-[5px] border type-caption font-semibold! max-[1100px]:min-w-[23px]",
            on.has(day) ? "border-[#bcd9fb] bg-[#e0edff] text-[#1d4ed8]" : "border-transparent bg-[#eef2f7] text-[#9ca3af]"
          )}
        >
          {t(`days.${day}.short`)}
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
    { key: "code", label: t("col.code"), cellClassName: "whitespace-nowrap font-semibold", render: (p) => p.code },
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
      />

      <DataTable columns={columns} noun="processes" loading={loading} boxedPager fitWidth minWidth="min-w-[640px]" {...view.table} />

      {actions.dialogs}

      {editRow && <ProcessFormModal mode="edit" process={editRow} tenantId={scope.tenantId} processes={rows} onClose={closeEdit} onSave={submitProcess} />}
      {addOpen && <ProcessFormModal tenantId={scope.tenantId} processes={rows} onClose={closeAdd} onSave={submitProcess} />}
    </div>
  );
}
