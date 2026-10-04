import { useMemo, useState } from "react";
import DataTable from "@/components/shared/list/DataTable.jsx";
import { useListScope } from "@/components/shared/list/useListScope";
import DateRangePicker from "@/components/shared/DateRangePicker.jsx";
import DropdownSelect from "@/components/shared/DropdownSelect.jsx";
import { toIsoDate } from "@/lib/date";
import ReportFilterCard, { Field } from "../shared/ReportFilterCard.jsx";
import { LOSE_CLASS, WIN_CLASS, formatAmount, signClass } from "../shared/reportFormat";
import { useReport } from "../shared/useReport";
import { DOMAIN_REPORT_URL, buildDomainRequest, normalizeDomainRow, processOptions } from "./domainReportRules";
import { useProcesses } from "./useProcesses";

const AMOUNT = "text-right tabular-nums";

export default function DomainReportPage() {
  const [processPick, setProcessPick] = useState("");
  const [range, setRange] = useState(() => {
    const today = toIsoDate(new Date());
    return { from: today, to: today };
  });

  const scope = useListScope("report.domain.scope", { onChange: () => setProcessPick("") });
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
        ? buildDomainRequest({ tenantId, dateFrom: range.from, dateTo: range.to, processId, isGroupOwn })
        : null,
    [tenantId, range, processId, isGroupOwn]
  );
  const report = useReport(DOMAIN_REPORT_URL, request);
  const rows = useMemo(() => report.rows.map((r) => normalizeDomainRow(r, isGroupOwn)), [report.rows, isGroupOwn]);

  const columns = [
    { key: "process", label: "Process", sortable: false, cellClassName: "font-extrabold whitespace-nowrap", render: (r) => r.label },
    { key: "turnover", label: "Turnover", sortable: false, className: "text-right", cellClassName: `${AMOUNT} font-bold`, render: (r) => formatAmount(r.turnover) },
    { key: "win", label: "Win", sortable: false, className: "text-right", cellClassName: `${AMOUNT} ${WIN_CLASS}`, render: (r) => formatAmount(r.win) },
    { key: "lose", label: "Lose", sortable: false, className: "text-right", cellClassName: `${AMOUNT} ${LOSE_CLASS}`, render: (r) => formatAmount(r.lose) },
    { key: "winLose", label: "Win/Lose", sortable: false, className: "text-right", cellClassName: AMOUNT, render: (r) => <span className={signClass(r.winLose)}>{formatAmount(r.winLose)}</span> },
  ];

  const totalRow = report.total && [
    { className: "text-brand-navy", content: "Total" },
    { className: AMOUNT, content: formatAmount(report.total.turnoverAmount) },
    { className: `${AMOUNT} ${WIN_CLASS}`, content: formatAmount(report.total.winAmount) },
    { className: `${AMOUNT} ${LOSE_CLASS}`, content: formatAmount(report.total.loseAmount) },
    { className: AMOUNT, content: <span className={signClass(report.total.winLoseAmount)}>{formatAmount(report.total.winLoseAmount)}</span> },
  ];

  const pageError = scope.error || processError || report.error;

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <ReportFilterCard scope={scope}>
        <Field label="Process:">
          <DropdownSelect
            options={processChoices}
            value={processId}
            onChange={setProcessPick}
            placeholder="Select process"
            searchable={!isGroupOwn}
            searchPlaceholder="Search process"
            ariaLabel="Process"
          />
        </Field>
        <Field label="Date Range:">
          <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
        </Field>
      </ReportFilterCard>

      {pageError && (
        <div className="flex-none rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-medium text-dash-down">
          {pageError}
        </div>
      )}

      <DataTable
        columns={columns}
        rowKey={(r) => r.id}
        noun="processes"
        loading={report.loading}
        rows={rows}
        totalRow={totalRow}
        minWidth="min-w-[640px]"
        emptyMessage="No data found. Please adjust your search criteria and try again."
      />
    </div>
  );
}
