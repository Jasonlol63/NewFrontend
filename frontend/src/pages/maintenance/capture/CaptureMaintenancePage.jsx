import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import DataTable from "@/components/shared/list/DataTable.jsx";
import { DeleteButton } from "@/components/shared/list/ListToolbar.jsx";
import { useListScope } from "@/components/shared/list/useListScope";
import { useRowActions } from "@/components/shared/list/useRowActions.jsx";
import DateRangePicker from "@/components/shared/DateRangePicker.jsx";
import DropdownSelect from "@/components/shared/DropdownSelect.jsx";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toIsoDate } from "@/lib/date";
import ReportFilterCard, { Field } from "@/pages/report/shared/ReportFilterCard.jsx";
import { processOptions } from "@/pages/report/domain/domainReportRules";
import { useProcesses } from "@/pages/report/domain/useProcesses";
import { buildCaptureRequest, filterCaptureRows } from "./captureMaintenanceRules";
import { useCaptureRows } from "./useCaptureRows";

export default function CaptureMaintenancePage() {
  const user = useCurrentUser();
  const readOnly = Boolean(user?.readOnly);
  const [processPick, setProcessPick] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [range, setRange] = useState(() => {
    const today = new Date();
    return { from: toIsoDate(new Date(today.getFullYear(), 0, 1)), to: toIsoDate(today) };
  });

  const scope = useListScope("maintenance.capture.scope", {
    onChange: () => {
      setProcessPick("");
      setSelected(new Set());
    },
  });
  const { tenantId } = scope;
  // company null = the Group's own data.
  const isGroupOwn = Boolean(tenantId) && scope.company === null;

  const { processes, error: processError } = useProcesses(tenantId);
  const processChoices = useMemo(() => processOptions(processes, isGroupOwn), [processes, isGroupOwn]);
  // A Group has no "All Process": it starts on its first process.
  const processId = processChoices.some((o) => o.value === processPick) ? processPick : (processChoices[0]?.value ?? "");

  const request = useMemo(
    () =>
      tenantId && (processId !== "" || !isGroupOwn)
        ? buildCaptureRequest({ tenantId, dateFrom: range.from, dateTo: range.to, processId, isGroupOwn })
        : null,
    [tenantId, range, processId, isGroupOwn]
  );
  const captures = useCaptureRows(request);
  const rows = useMemo(() => filterCaptureRows(captures.rows, search), [captures.rows, search]);

  // Archived captures are already deleted.
  const canSelect = (r) => !readOnly && !r.deleted;
  const selectedRows = rows.filter((r) => canSelect(r) && selected.has(r.id));
  const actions = useRowActions({
    deleteRows: (list) => captures.deleteCaptures(list.map((r) => r.captureId)),
    noun: "capture",
    label: (r) => `${r.process} ${r.created}`,
    onDeleted: () => setSelected(new Set()),
  });

  const columns = [
    { key: "no", label: "No.", sortable: false, className: "w-[56px]", cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
    { key: "created", label: "Dts Created", sortable: false, cellClassName: "whitespace-nowrap tabular-nums", render: (r) => r.created },
    { key: "product", label: "Product", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => r.product },
    { key: "process", label: "Process", sortable: false, cellClassName: "font-semibold whitespace-nowrap", render: (r) => r.process },
    { key: "currency", label: "Currency", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => r.currency },
    { key: "wlGroup", label: "W/L Group", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => r.wlGroup },
    { key: "createdBy", label: "Submitted By", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => r.createdBy },
    { key: "deletedBy", label: "Deleted By", sortable: false, cellClassName: "max-w-[240px] truncate", render: (r) => <span title={r.deletedBy || undefined}>{r.deletedBy || "-"}</span> },
  ];

  const pageError = scope.error || processError || captures.error;

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <ReportFilterCard scope={scope}>
        <Field label="Process:">
          <DropdownSelect
            options={processChoices}
            value={processId}
            onChange={(v) => {
              setProcessPick(v);
              setSelected(new Set());
            }}
            placeholder="Select process"
            searchable={!isGroupOwn}
            searchPlaceholder="Search process"
            ariaLabel="Process"
          />
        </Field>
        <label className="flex h-9 w-full max-w-[260px] min-w-[180px] flex-1 items-center gap-2 rounded-[10px] border border-dash-line bg-white px-3 text-[13px] shadow-[0_1px_3px_rgba(15,23,42,0.05)] focus-within:border-[#3b82f6]">
          <Search className="size-4 flex-none text-dash-faint" strokeWidth={2.2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent outline-none placeholder:text-dash-faint"
            placeholder="Search Process, Product, Currency"
          />
        </label>
        <Field label="Date Range:">
          <DateRangePicker
            from={range.from}
            to={range.to}
            onChange={(r) => {
              setRange(r);
              setSelected(new Set());
            }}
          />
        </Field>
        <div className="ml-auto flex-none">
          <DeleteButton count={selectedRows.length} onClick={() => actions.requestDelete(selectedRows)} />
        </div>
      </ReportFilterCard>

      {pageError && (
        <div className="flex-none rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-medium text-dash-down">
          {pageError}
        </div>
      )}

      <DataTable
        columns={columns}
        noun="records"
        loading={captures.loading}
        rows={rows}
        selected={selected}
        onSelectedChange={setSelected}
        canSelect={canSelect}
        lockedSelect={(r) => r.deleted}
        rowClassName={(r) => r.deleted && "[&>td]:text-dash-down [&>td]:line-through"}
        minWidth="min-w-[820px]"
        emptyMessage="No data found. Please adjust your search criteria and try again."
      />

      {actions.dialogs}
    </div>
  );
}
