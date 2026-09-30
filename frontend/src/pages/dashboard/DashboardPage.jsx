import { useMemo, useState } from "react";
import { ChartLine, DollarSign, TrendingDown, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSavedOrder, useSavedState } from "@/hooks/useSavedState";
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

// The saved Group / Company are only used while they still exist for this login; otherwise the
// defaults apply, so a removed company or a revoked permission never leaves an empty selection.
function resolveSelection(directory, saved) {
  if (!directory) return { group: ALL, company: null };
  const savedGroupOk = saved?.group === ALL || directory.groups.some((g) => g.code === saved?.group);
  const group = savedGroupOk ? saved.group : (directory.groups[0]?.code ?? ALL);

  const c = saved?.company;
  const savedCompanyOk =
    savedGroupOk &&
    (c === ALL
      ? true
      : c === null
        ? canViewGroupItself(directory, group)
        : companiesInGroup(directory, group).some((x) => x.code === c));
  return { group, company: savedCompanyOk ? c : defaultCompany(directory, group) };
}

export default function DashboardPage() {
  const { directory: loadedDirectory, error: directoryError } = useTenantDirectory();
  const [dateRange, setDateRange] = useState(currentMonthRange);
  // Group / Company / Currency the user picked last; saved in the browser so a refresh keeps them.
  const [saved, setSaved, savedReady] = useSavedState("dashboard.filters");
  // Order the user dragged the currency chips into; saved the same way.
  const [currencyOrder, setCurrencyOrder] = useSavedOrder("dashboard.currencyOrder");

  // Hold everything back until the saved choice has been read, so the defaults never flash
  // (or fire requests) before the restored selection takes over.
  const directory = savedReady ? loadedDirectory : null;
  const { group, company } = useMemo(() => resolveSelection(directory, saved), [directory, saved]);

  const scope = useMemo(() => resolveScope(directory, group, company), [directory, group, company]);
  const currencyCodes = useCurrencyOptions(scope?.tenantIds);
  const currency = currencyCodes.includes(saved?.currency)
    ? saved.currency
    : currencyCodes.includes("MYR")
      ? "MYR"
      : (currencyCodes[0] ?? "");

  const { kpi, trend, breakdown, loading, initialLoading, error } = useDashboardData(scope, dateRange.from, dateRange.to, currency);

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
  const currencyOptions = useMemo(() => {
    // Dragged order first; currencies that were never dragged keep their default order after it.
    const ordered = [
      ...currencyOrder.filter((code) => currencyCodes.includes(code)),
      ...currencyCodes.filter((code) => !currencyOrder.includes(code)),
    ];
    return ordered.map((code) => ({ value: code, label: code }));
  }, [currencyCodes, currencyOrder]);

  // The saved currency is only replaced when the user picks one: if a company lacks it, the page
  // shows a fallback but keeps the preference for when they switch back.
  const save = (next) => setSaved({ group, company, currency: saved?.currency ?? currency, ...next });
  const handleGroupChange = (next) => save({ group: next, company: defaultCompany(directory, next) });
  const handleCompanyChange = (next) => save({ company: next });
  const handleCurrencyChange = (next) => save({ currency: next });

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
        onCurrencyChange={handleCurrencyChange}
        onCurrencyReorder={setCurrencyOrder}
        loading={initialLoading}
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
