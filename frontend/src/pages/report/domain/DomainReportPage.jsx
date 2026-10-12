import { touchesLedger } from "@/lib/realtime/realtimeEvents";
import { useMemo, useState } from "react";
import Toast from "@/components/shared/Toast.jsx";
import { useErrorToasts } from "@/hooks/useErrorToasts";
import { useNotice } from "@/hooks/useNotice";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation(["report", "common"]);
  const { toasts, push, dismiss } = useNotice(5000);
  const [processPick, setProcessPick] = useState("");
  const [range, setRange] = useState(() => {
    const today = toIsoDate(new Date());
    return { from: today, to: today };
  });

  const scope = useListScope({ onChange: () => setProcessPick("") });
  const { tenantId } = scope;
  // company null = the Group's own data.
  const isGroupOwn = Boolean(tenantId) && scope.company === null;

  const { processes, error: processError } = useProcesses(tenantId);
  const processChoices = useMemo(() => processOptions(processes, isGroupOwn, t("allProcess")), [processes, isGroupOwn, t]);
  // A Group has no "All Process": it starts on its first process.
  const processId = processChoices.some((o) => o.value === processPick) ? processPick : (processChoices[0]?.value ?? "");

  const request = useMemo(
    () =>
      tenantId && (processId !== "" || !isGroupOwn)
        ? buildDomainRequest({ tenantId, dateFrom: range.from, dateTo: range.to, processId, isGroupOwn })
        : null,
    [tenantId, range, processId, isGroupOwn]
  );
  const report = useReport(DOMAIN_REPORT_URL, request, touchesLedger);
  const rows = useMemo(() => report.rows.map((r) => normalizeDomainRow(r, isGroupOwn)), [report.rows, isGroupOwn]);

  const columns = [
    { key: "process", label: t("cols.process"), sortable: false, cellClassName: "font-extrabold whitespace-nowrap", render: (r) => r.label },
    { key: "turnover", label: t("cols.turnover"), sortable: false, className: "text-right", cellClassName: `${AMOUNT} font-bold`, render: (r) => formatAmount(r.turnover) },
    { key: "win", label: t("cols.win"), sortable: false, className: "text-right", cellClassName: `${AMOUNT} ${WIN_CLASS}`, render: (r) => formatAmount(r.win) },
    { key: "lose", label: t("cols.lose"), sortable: false, className: "text-right", cellClassName: `${AMOUNT} ${LOSE_CLASS}`, render: (r) => formatAmount(r.lose) },
    { key: "winLose", label: t("cols.winLose"), sortable: false, className: "text-right", cellClassName: AMOUNT, render: (r) => <span className={signClass(r.winLose)}>{formatAmount(r.winLose)}</span> },
  ];

  const totalRow = report.total && [
    { className: "text-brand-navy", content: t("total") },
    { className: AMOUNT, content: formatAmount(report.total.turnoverAmount) },
    { className: `${AMOUNT} ${WIN_CLASS}`, content: formatAmount(report.total.winAmount) },
    { className: `${AMOUNT} ${LOSE_CLASS}`, content: formatAmount(report.total.loseAmount) },
    { className: AMOUNT, content: <span className={signClass(report.total.winLoseAmount)}>{formatAmount(report.total.winLoseAmount)}</span> },
  ];

  useErrorToasts(push, [
    [scope.error, t("errors.scope")],
    [processError, t("errors.processes")],
    [report.error, t("errors.report")],
  ]);

  return (
    <div className="relative flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <Toast toasts={toasts} onClose={dismiss} />
      <ReportFilterCard scope={scope}>
        <Field label={t("process")}>
          <DropdownSelect
            options={processChoices}
            value={processId}
            onChange={setProcessPick}
            placeholder={t("selectProcess")}
            searchable={!isGroupOwn}
            searchPlaceholder={t("searchProcess")}
            ariaLabel={t("cols.process")}
          />
        </Field>
        <Field label={t("dateRange")}>
          <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
        </Field>
      </ReportFilterCard>

      <DataTable
        columns={columns}
        rowKey={(r) => r.id}
        noun="processes"
        loading={report.loading}
        rows={rows}
        totalRow={totalRow}
        minWidth="min-w-[640px]"
        emptyMessage={t("empty")}
      />
    </div>
  );
}
