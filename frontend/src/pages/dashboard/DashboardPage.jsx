import { useMemo, useState } from "react";
import { ChartLine, DollarSign, TrendingDown, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardFilterPanel from "./components/DashboardFilterPanel.jsx";
import KpiCard from "./components/KpiCard.jsx";
import TrendChartCard from "./components/TrendChartCard.jsx";
import CurrencyBreakdownCard from "./components/CurrencyBreakdownCard.jsx";
import { currentMonthRange, isFullMonth } from "./dashboardFormat";
import {
  ALL,
  canViewGroupItself,
  companiesInGroup,
  resolveScope,
  useCurrencyOptions,
  useDashboardData,
  useTenantDirectory,
} from "./useDashboardData";

// company: null = the Group's own view (when allowed), ALL = every company in the group.
function defaultCompany(directory, group) {
  const first = companiesInGroup(directory, group)[0];
  if (first) return first.code;
  return canViewGroupItself(directory, group) ? null : ALL;
}

export default function DashboardPage() {
  const { directory, error: directoryError } = useTenantDirectory();
  const [dateRange, setDateRange] = useState(currentMonthRange);
  // null until the user picks something; until then the defaults below are used.
  const [selection, setSelection] = useState(null);
  const [pickedCurrency, setPickedCurrency] = useState("");

  const group = selection?.group ?? directory?.groups[0]?.code ?? ALL;
  const company = selection ? selection.company : directory ? defaultCompany(directory, group) : null;

  const scope = useMemo(() => resolveScope(directory, group, company), [directory, group, company]);
  const currencyCodes = useCurrencyOptions(scope?.tenantIds);
  const currency = currencyCodes.includes(pickedCurrency)
    ? pickedCurrency
    : currencyCodes.includes("MYR")
      ? "MYR"
      : (currencyCodes[0] ?? "");

  const { kpi, trend, breakdown, loading, error } = useDashboardData(scope, dateRange.from, dateRange.to, currency);

  const allowNoCompany = canViewGroupItself(directory, group);
  const groupOptions = useMemo(
    () => [{ value: ALL, label: "All" }, ...(directory?.groups ?? []).map((g) => ({ value: g.code, label: g.code }))],
    [directory]
  );
  const companyOptions = useMemo(
    () => [
      { value: ALL, label: "All" },
      ...companiesInGroup(directory, group).map((c) => ({ value: c.code, label: c.code })),
    ],
    [directory, group]
  );
  const currencyOptions = useMemo(() => currencyCodes.map((code) => ({ value: code, label: code })), [currencyCodes]);

  const handleGroupChange = (next) =>
    setSelection({ group: next, company: canViewGroupItself(directory, next) ? null : ALL });
  const handleCompanyChange = (next) => setSelection({ group, company: next });

  const compareLabel = isFullMonth(kpi?.previousDateFrom, kpi?.previousDateTo)
    ? "than last month"
    : "than previous period";
  const showEarnings = Boolean(kpi?.showEarnings);
  const cards = [
    { label: "Profit", icon: DollarSign, iconClassName: "text-series-profit", value: kpi?.profit, previous: kpi?.previousProfit },
    { label: "Expenses", icon: TrendingDown, iconClassName: "text-series-expenses", value: kpi?.expenses, previous: kpi?.previousExpenses },
    { label: "Net Profit", icon: ChartLine, iconClassName: "text-series-net", value: kpi?.netProfit, previous: kpi?.previousNetProfit },
    ...(showEarnings
      ? [{ label: "Earnings", icon: Wallet, iconClassName: "text-series-earnings", value: kpi?.earnings, previous: kpi?.previousEarnings }]
      : []),
  ];
  const pageError = directoryError || error;

  return (
    <div className="flex flex-col gap-3 p-4 xl:h-screen xl:min-h-[780px]">
      <DashboardFilterPanel
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        groupOptions={groupOptions}
        group={group}
        onGroupChange={handleGroupChange}
        companyOptions={companyOptions}
        company={company}
        onCompanyChange={handleCompanyChange}
        allowNoCompany={allowNoCompany}
        currencyOptions={currencyOptions}
        currency={currency}
        onCurrencyChange={setPickedCurrency}
      />

      {pageError && (
        <div className="flex-none rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-medium text-dash-down">
          {pageError}
        </div>
      )}

      <section className={cn("grid flex-none grid-cols-1 gap-3", showEarnings ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3")}>
        {cards.map((card) => (
          <KpiCard key={card.label} {...card} compareLabel={compareLabel} loading={loading} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-[1.6fr_1fr]">
        <TrendChartCard trend={trend} dateFrom={dateRange.from} dateTo={dateRange.to} loading={loading} />
        <CurrencyBreakdownCard breakdown={breakdown} currency={currency} loading={loading} />
      </section>
    </div>
  );
}
