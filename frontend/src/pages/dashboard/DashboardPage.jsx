import { useMemo, useState } from "react";
import { ChartLine, DollarSign, TrendingDown, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { currentLoginStamp, useSavedState } from "@/hooks/useSavedState";
import { useOrderedCurrencies } from "@/hooks/useOrderedCurrencies";
import DashboardFilterPanel from "./components/DashboardFilterPanel.jsx";
import KpiCard from "./components/KpiCard.jsx";
import TrendChartCard from "./components/TrendChartCard.jsx";
import CurrencyBreakdownCard from "./components/CurrencyBreakdownCard.jsx";
import { currentMonthRange, isFullMonth } from "./dashboardFormat";
import {
  ALL,
  canViewGroupItself,
  companiesInGroup,
  firstOpenableGroup,
  hasIndependentCompanies,
  INDEPENDENT,
  loginSelection,
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

// A fresh login starts from the Company / Group logged in with; within the same login the saved
// Group / Company win (so a refresh keeps them). Either is only used while it still exists for this
// login; otherwise the defaults apply, so a removed company or a revoked permission never leaves
// an empty selection.
function resolveSelection(directory, saved) {
  if (!directory) return { group: ALL, company: null };
  const pick = saved && (saved.loginStamp ?? null) === currentLoginStamp() ? saved : loginSelection(directory);
  const savedGroupOk =
    pick?.group === ALL ||
    (pick?.group === INDEPENDENT && hasIndependentCompanies(directory)) ||
    directory.groups.some((g) => g.code === pick?.group);
  const group = savedGroupOk ? pick.group : (directory.groups[0]?.code ?? ALL);

  const c = pick?.company;
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

  // Independent companies: clicking the active company again switches to the first Group, when
  // this login can open one.
  const switchGroup = group === INDEPENDENT ? firstOpenableGroup(directory) : null;
  const allowNoCompany = group === INDEPENDENT ? Boolean(switchGroup) : canViewGroupItself(directory, group);
  const groupOptions = useMemo(
    () => [{ value: ALL, label: "All" }, ...(directory?.groups ?? []).map((g) => ({ value: g.code, label: g.code }))],
    [directory]
  );
  // Clicking the active Group again switches to the independent companies, when there are any.
  const allowNoGroup = group !== ALL && group !== INDEPENDENT && hasIndependentCompanies(directory);
  const groupCompanies = useMemo(() => companiesInGroup(directory, group), [directory, group]);
  // A Group with no companies has nothing to pick, so the Company row is hidden.
  const showCompany = groupCompanies.length > 0;
  const companyOptions = useMemo(
    () => [{ value: ALL, label: "All" }, ...groupCompanies.map((c) => ({ value: c.code, label: c.code }))],
    [groupCompanies]
  );
  // Currency chips in the order the user dragged them into (saved in the browser).
  const [currencyOptions, setCurrencyOrder] = useOrderedCurrencies(currencyCodes);

  // The saved currency is only replaced when the user picks one: if a company lacks it, the page
  // shows a fallback but keeps the preference for when they switch back.
  const save = (next) =>
    setSaved({ group, company, currency: saved?.currency ?? currency, loginStamp: currentLoginStamp(), ...next });
  const handleGroupChange = (picked) => {
    const next = picked ?? INDEPENDENT;
    save({ group: next, company: defaultCompany(directory, next) });
  };
  const handleCompanyChange = (next) => {
    if (next === null && group === INDEPENDENT) {
      // The Group opens on its own data; the user picks a company from there. "All" doesn't switch.
      if (company !== ALL) save({ group: switchGroup, company: null });
      return;
    }
    save({ company: next });
  };
  const handleCurrencyChange = (next) => save({ currency: next });

  const compareLabel = isFullMonth(kpi?.previousDateFrom, kpi?.previousDateTo)
    ? "than last month"
    : "than previous period";
  const showEarnings = Boolean(kpi?.showEarnings);
  const cards = [
    { label: "Profit", icon: DollarSign, color: "#2563eb", tint: "#e8f1ff", value: kpi?.profit, previous: kpi?.previousProfit },
    { label: "Expenses", icon: TrendingDown, color: "#ef4444", tint: "#ffdfdf", value: kpi?.expenses, previous: kpi?.previousExpenses },
    { label: "Net Profit", icon: ChartLine, color: "#10b981", tint: "#d6f7e7", value: kpi?.netProfit, previous: kpi?.previousNetProfit },
    ...(showEarnings
      ? [{ label: "Earnings", icon: Wallet, color: "#d97706", tint: "#fff3da", value: kpi?.earnings, previous: kpi?.previousEarnings }]
      : []),
  ];
  const pageError = directoryError || error;

  return (
    <div className="flex flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)] lg:h-full lg:min-h-[520px]">
      <DashboardFilterPanel
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        groupOptions={groupOptions}
        group={group}
        onGroupChange={handleGroupChange}
        allowNoGroup={allowNoGroup}
        showCompany={showCompany}
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

      <section className={cn("grid flex-none grid-cols-1 gap-[clamp(8px,1.5dvh,12px)]", showEarnings ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3")}>
        {cards.map((card) => (
          <KpiCard key={card.label} {...card} compareLabel={compareLabel} loading={loading} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-[clamp(8px,1.5dvh,12px)] lg:min-h-0 lg:flex-1 lg:grid-cols-[1.6fr_1fr]">
        <TrendChartCard trend={trend} dateFrom={dateRange.from} dateTo={dateRange.to} loading={loading} />
        <CurrencyBreakdownCard breakdown={breakdown} currency={currency} loading={loading} />
      </section>
    </div>
  );
}
