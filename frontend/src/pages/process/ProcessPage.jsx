import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import DataTable from "@/components/shared/list/DataTable.jsx";
import ListToolbar, { DeleteButton, PrimaryButton } from "@/components/shared/list/ListToolbar.jsx";
import { Badge, IconAction, StatusBadge } from "@/components/shared/list/cells.jsx";
import { useListScope } from "@/components/shared/list/useListScope";
import { useListView } from "@/components/shared/list/useListView";
import { useRowActions } from "@/components/shared/list/useRowActions.jsx";
import { useSession } from "@/context/session";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import BankProcessView from "./bank/BankProcessView.jsx";
import ProcessFormModal from "./games/ProcessFormModal.jsx";
import { DAYS, filterProcesses, sortProcesses } from "./games/processRules";
import { useProcessList } from "./games/useProcessList";

// The seven weekdays, the ones the process runs on lit blue. Slightly smaller on narrow screens.
function DayUse({ days }) {
  const on = new Set(days);
  return (
    <span className="inline-flex gap-[3px] max-[1100px]:gap-0.5">
      {DAYS.map(({ day, short, full }) => (
        <span
          key={day}
          title={full}
          className={cn(
            "inline-flex h-[22px] min-w-[27px] items-center justify-center rounded-[5px] border text-[10.5px] font-bold max-[1100px]:min-w-[23px] max-[1100px]:text-[9.5px]",
            on.has(day) ? "border-[#bcd9fb] bg-[#e0edff] text-[#1d4ed8]" : "border-transparent bg-[#eef2f7] text-[#9ca3af]"
          )}
        >
          {short}
        </span>
      ))}
    </span>
  );
}

export default function ProcessPage() {
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
  const { rows: allRows, error: listError, loading, toggleStatus, deleteRows } = useProcessList(isBank ? null : scope.tenantId);
  const rows = useMemo(() => allRows.filter((p) => p.category === "GAME"), [allRows]);

  // Only inactive processes can be deleted.
  const canSelect = useCallback((p) => !readOnly && p.status === "inactive", [readOnly]);
  const view = useListView(rows, { filter: filterProcesses, sort: sortProcesses, canSelect });
  const actions = useRowActions({
    toggleStatus,
    deleteRows,
    noun: "process",
    label: (p) => (p.description ? `${p.code} (${p.description})` : p.code),
    onDeleted: view.clearSelection,
  });

  const columns = [
    { key: "no", label: "No", sortable: false, className: "w-[56px]", cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
    { key: "code", label: "Process ID", cellClassName: "whitespace-nowrap font-semibold", render: (p) => p.code },
    { key: "description", label: "Description", fit: true, render: (p) => p.description || "-" },
    {
      key: "status",
      label: "Status",
      render: (p) => (
        <StatusBadge
          status={p.status}
          pending={actions.pendingIds.has(p.id)}
          onToggle={readOnly ? undefined : () => actions.toggle(p)}
          disabledTitle={readOnly ? "Read-only login" : undefined}
        />
      ),
    },
    { key: "currency", label: "Currency", render: (p) => <Badge className="border-[#bcd9fb] bg-white text-brand-navy">{p.currency}</Badge> },
    { key: "days", label: "Day Use", render: (p) => <DayUse days={p.days} /> },
    {
      key: "action",
      label: "Action",
      sortable: false,
      className: "text-center",
      cellClassName: "whitespace-nowrap",
      render: (p) => <IconAction onClick={() => setEditRow(p)} disabled={readOnly} title={readOnly ? "Read-only login" : "Edit process"} aria-label="Edit process" />,
    },
  ];

  const pageError = scope.error || listError;

  // Bank companies have their own list.
  if (isBank) return <BankProcessView scope={scope} readOnly={readOnly} />;

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <ListToolbar
        primaryAction={
          <PrimaryButton icon={Plus} onClick={() => setAddOpen(true)} disabled={readOnly} title={readOnly ? "Read-only login" : undefined}>
            Add Process
          </PrimaryButton>
        }
        actions={<DeleteButton count={view.selectedRows.length} onClick={() => actions.requestDelete(view.selectedRows)} />}
        searchPlaceholder="Search Process ID, Description"
        search={view.search}
        onSearchChange={view.setSearch}
        chips={view.chips}
        onChipChange={view.setChip}
        scope={scope}
      />

      {pageError && (
        <div className="flex-none rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-medium text-dash-down">
          {pageError}
        </div>
      )}

      <DataTable columns={columns} noun="processes" loading={loading} boxedPager fitWidth minWidth="min-w-[640px]" {...view.table} />

      {actions.dialogs}

      {/* UI only for now: Save just closes the modal until the add / update API is wired up. */}
      {editRow && <ProcessFormModal mode="edit" process={editRow} tenantId={scope.tenantId} processes={rows} onClose={closeEdit} onSave={closeEdit} />}
      {addOpen && <ProcessFormModal tenantId={scope.tenantId} processes={rows} onClose={closeAdd} onSave={closeAdd} />}
    </div>
  );
}
