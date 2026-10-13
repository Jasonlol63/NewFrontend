import { touchesLedger } from "@/lib/realtime/realtimeEvents";
import { useMemo, useState } from "react";
import Toast from "@/components/shared/Toast.jsx";
import { useErrorToasts } from "@/hooks/useErrorToasts";
import { useNotice } from "@/hooks/useNotice";
import { useTranslation } from "react-i18next";
import DataTable from "@/components/shared/list/DataTable.jsx";
import FilterChip from "@/components/shared/list/FilterChip.jsx";
import { useListScope } from "@/components/shared/list/useListScope";
import { useTenantList } from "@/components/shared/list/useTenantList";
import DateRangePicker from "@/components/shared/DateRangePicker.jsx";
import DropdownSelect from "@/components/shared/DropdownSelect.jsx";
import FilterRow from "@/components/shared/FilterRow.jsx";
import SegmentGroup from "@/components/shared/SegmentGroup.jsx";
import { useOrderedCurrencies } from "@/hooks/useOrderedCurrencies";
import { toIsoDate } from "@/lib/date";
import { normalizeAccountRow } from "@/pages/account/accountRules";
import { useCurrencyOptions } from "@/pages/dashboard/useDashboardData";
import ReportFilterCard, { Field } from "../shared/ReportFilterCard.jsx";
import { LOSE_CLASS, WIN_CLASS, formatAmount } from "../shared/reportFormat";
import { useReport } from "../shared/useReport";
import {
  CUSTOMER_REPORT_URL,
  accountOptions,
  buildCustomerRequest,
  normalizeCustomerRow,
} from "./customerReportRules";

const AMOUNT = "text-right tabular-nums";

const baseColumns = [
  { key: "account", label: "account", sortable: false, cellClassName: "font-semibold whitespace-nowrap", render: (r) => r.accountCode },
  { key: "name", label: "name", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => r.name },
  { key: "currency", label: "currency", sortable: false, cellClassName: "whitespace-nowrap", render: (r) => r.currency },
  { key: "win", label: "win", sortable: false, className: "text-right", cellClassName: `${AMOUNT} ${WIN_CLASS}`, render: (r) => formatAmount(r.win) },
  { key: "lose", label: "lose", sortable: false, className: "text-right", cellClassName: `${AMOUNT} ${LOSE_CLASS}`, render: (r) => formatAmount(r.lose) },
];

export default function CustomerReportPage() {
  const { t } = useTranslation(["report", "common"]);
  const { toasts, push, dismiss } = useNotice(5000);
  const columns = useMemo(() => baseColumns.map((c) => ({ ...c, label: t(`cols.${c.label}`) })), [t]);
  const [accountPick, setAccountPick] = useState("");
  const [currencyPick, setCurrencyPick] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [range, setRange] = useState(() => {
    const today = toIsoDate(new Date());
    return { from: today, to: today };
  });

  const scope = useListScope({ onChange: () => setAccountPick("") });
  const { tenantId } = scope;

  const { rows: accounts } = useTenantList("/api/account", tenantId, { normalize: normalizeAccountRow });
  const accountChoices = useMemo(() => accountOptions(accounts, t("allAccounts")), [accounts, t]);
  const accountId = accountChoices.some((o) => o.value === accountPick) ? accountPick : "";

  const currencyCodes = useCurrencyOptions(tenantId ? [tenantId] : []);
  // Chips in the order the user dragged them into, shared with the Dashboard.
  const [currencyOptions, setCurrencyOrder] = useOrderedCurrencies(currencyCodes);
  // Same default as the Dashboard: MYR when the company has it, else the first currency.
  const currency = currencyCodes.includes(currencyPick)
    ? currencyPick
    : currencyCodes.includes("MYR")
      ? "MYR"
      : (currencyCodes[0] ?? null);

  const request = useMemo(
    () =>
      tenantId && currency
        ? buildCustomerRequest({ tenantId, dateFrom: range.from, dateTo: range.to, accountId, currency, showAll })
        : null,
    [tenantId, currency, range, accountId, showAll]
  );
  const report = useReport(CUSTOMER_REPORT_URL, request, touchesLedger);
  const rows = useMemo(() => report.rows.map(normalizeCustomerRow), [report.rows]);

  const totalRow = report.total && [
    { span: 3, className: "text-right text-brand-navy", content: t("totalColon") },
    { className: `${AMOUNT} ${WIN_CLASS}`, content: formatAmount(report.total.winAmount) },
    { className: `${AMOUNT} ${LOSE_CLASS}`, content: formatAmount(report.total.loseAmount) },
  ];

  useErrorToasts(push, [
    [scope.error, t("errors.scope")],
    [report.error, t("errors.report")],
  ]);

  return (
    <div className="relative flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <Toast toasts={toasts} onClose={dismiss} />
      <ReportFilterCard
        scope={scope}
        extraRows={
          <FilterRow label={t("currency")}>
            {currencyCodes.length ? (
              <SegmentGroup
                options={currencyOptions}
                value={currency}
                onChange={setCurrencyPick}
                wrap onReorder={setCurrencyOrder}
              />
            ) : (
              <span className="type-caption font-medium! text-dash-faint">{t("noCurrency")}</span>
            )}
          </FilterRow>
        }
      >
        <Field label={t("account")}>
          <DropdownSelect
            options={accountChoices}
            value={accountId}
            onChange={setAccountPick}
            searchable
            searchPlaceholder={t("searchAccount")}
            ariaLabel={t("cols.account")}
          />
        </Field>
        <Field label={t("dateRange")}>
          <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
        </Field>
        <FilterChip label={t("showAll")} checked={showAll} onChange={setShowAll} />
      </ReportFilterCard>

      <DataTable
        columns={columns}
        rowKey={(r) => r.id}
        noun="accounts"
        loading={report.loading}
        rows={rows}
        totalRow={totalRow}
        minWidth="min-w-[560px]"
        rowHeight={26}
        emptyMessage={t("empty")}
      />
    </div>
  );
}
