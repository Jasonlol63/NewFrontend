import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChartLine, DollarSign, TrendingDown, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/context/session";
import { currentLoginStamp, useSavedState } from "@/hooks/useSavedState";
import { useOrderedCurrencies } from "@/hooks/useOrderedCurrencies";
import { useNotice } from "@/hooks/useNotice";
import Toast from "@/components/shared/Toast.jsx";
import DashboardFilterPanel from "./components/DashboardFilterPanel.jsx";
import KpiCard from "./components/KpiCard.jsx";
import TrendChartCard from "./components/TrendChartCard.jsx";
import CurrencyBreakdownCard from "./components/CurrencyBreakdownCard.jsx";
import { isFullMonth, monthToDateRange } from "./dashboardFormat";
import {
  ALL,
  canViewGroupItself,
  companiesInGroup,
  firstOpenableGroup,
  hasGroupAccess,
  hasIndependentCompanies,
  INDEPENDENT,
  loginSelection,
  resolveScope,
  sessionSelection,
  useCurrencyOptions,
  useDashboardData,
  hasDashboardResult,
  prefetchDashboard,
  useTenantDirectory,
} from "./useDashboardData";

// company: null = the Group's own view (when allowed), ALL = every company in the group.
function defaultCompany(directory, group) {
  const first = companiesInGroup(directory, group)[0];
  if (first) return first.code;
  return canViewGroupItself(directory, group) ? null : ALL;
}

// The tenant a selection points at when it is one company or one Group's own data; null for the
// "All" views, which span several tenants.
function singleTenantId(directory, group, company) {
  const scope = resolveScope(directory, group, company);
  if (scope?.kind === "company") return scope.params.tenant_id;
  if (scope?.kind === "group") return scope.params.group_tenant_id;
  return null;
}

const isAggregate = (pick) => pick?.company === ALL || (pick?.group === ALL && pick?.company === null);

// A single company / Group follows the session (the company the sidebar is in), so switching
// company anywhere carries over here. Only an "All" view is remembered by this page, for the same
// login (so a refresh keeps it). A pick is only used while it still exists for this login;
// otherwise the defaults apply, so a removed company or a revoked permission never leaves an
// empty selection.
function resolveSelection(directory, saved, tenantId) {
  if (!directory) return { group: ALL, company: null };
  if (!hasGroupAccess(directory)) return resolveCompanyOnlySelection(directory, saved, tenantId);
  const savedAll = saved && isAggregate(saved) && (saved.loginStamp ?? null) === currentLoginStamp();
  const pick = savedAll ? saved : (sessionSelection(directory, tenantId) ?? loginSelection(directory));
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

// A login with no Group access has no Group filter: the Company row lists every company it can open,
// across all Groups. Any saved Group pick is ignored; only a saved "All" view carries over.
function resolveCompanyOnlySelection(directory, saved, tenantId) {
  if (saved?.company === ALL && (saved.loginStamp ?? null) === currentLoginStamp()) {
    return { group: ALL, company: ALL };
  }
  const pick = sessionSelection(directory, tenantId) ?? loginSelection(directory);
  const known = directory.companies.some((c) => c.code === pick?.company);
  return { group: ALL, company: known ? pick.company : (directory.companies[0]?.code ?? ALL) };
}

export default function DashboardPage() {
  const { t } = useTranslation(["dashboard", "common"]);
  const { toasts, push, dismiss } = useNotice(5000);
  const { directory: loadedDirectory, error: directoryError } = useTenantDirectory();
  const { user, switchCompany } = useSession();
  const [switchError, setSwitchError] = useState("");
  const [dateRange, setDateRange] = useState(monthToDateRange);
  // The "All" Group / Company view and the Currency the user picked last; saved in the browser so a
  // refresh keeps them. A single company / Group is not saved here: it is the session's company.
  const [saved, setSaved, savedReady] = useSavedState("dashboard.filters");

  // Hold everything back until the saved choice has been read, so the defaults never flash
  // (or fire requests) before the restored selection takes over.
  const directory = savedReady && user ? loadedDirectory : null;
  const sessionTenantId = user?.tenant_id ?? null;
  const resolved = useMemo(
    () => resolveSelection(directory, saved, sessionTenantId),
    [directory, saved, sessionTenantId]
  );
  // What was just picked while the company switch is still on its way: the chips show it at once, and it stops counting as
  // soon as the session has moved on or the switch failed.
  const [pending, setPending] = useState(null);
  const { group, company } = pending && pending.from === sessionTenantId ? pending : resolved;

  // The data follows what is picked, not the session: every request carries its own tenant ids, so it starts at the click, in
  // parallel with the company switch (the Dashboard has no per-company view that depends on the session).
  const scope = useMemo(() => resolveScope(directory, group, company), [directory, group, company]);
  const currencyCodes = useCurrencyOptions(scope?.tenantIds);
  const currency = currencyCodes.includes(saved?.currency)
    ? saved.currency
    : currencyCodes.includes("MYR")
      ? "MYR"
      : (currencyCodes[0] ?? "");

  const { kpi, trend, breakdown, dataKey, requestKey, loading, initialLoading, error } = useDashboardData(scope, dateRange.from, dateRange.to, currency);

  // Independent companies: clicking the active company again switches to the first Group, when
  // this login can open one.
  const switchGroup = group === INDEPENDENT ? firstOpenableGroup(directory) : null;
  const allowNoCompany = group === INDEPENDENT ? Boolean(switchGroup) : canViewGroupItself(directory, group);
  const groupOptions = useMemo(
    () => [{ value: ALL, label: t("common:all") }, ...(directory?.groups ?? []).map((g) => ({ value: g.code, label: g.code }))],
    [directory, t]
  );
  // The Group row only exists for a login that has Group access.
  const showGroup = hasGroupAccess(directory) && groupOptions.length > 1;
  // Clicking the active Group again switches to the independent companies, when there are any.
  const allowNoGroup = group !== ALL && group !== INDEPENDENT && hasIndependentCompanies(directory);
  const groupCompanies = useMemo(() => companiesInGroup(directory, group), [directory, group]);

  // A company chip pressed down: its numbers start loading before the click is finished.
  const prefetchCompany = useCallback(
    (code) => {
      if (code === company) return;
      prefetchDashboard(resolveScope(directory, group, code), dateRange.from, dateRange.to, currency);
    },
    [directory, group, company, dateRange, currency]
  );
  // Once this view has loaded, the other companies of the group load in the background, one by one (not while the tab is hidden,
  // not what is remembered already), so the first switch to them is quick too.
  useEffect(() => {
    if (loading || !currency) return undefined;
    const others = groupCompanies
      .map((c) => resolveScope(directory, group, c.code))
      .filter((s) => s && !hasDashboardResult(s, dateRange.from, dateRange.to, currency));
    if (!others.length) return undefined;
    let cancelled = false;
    let timer = setTimeout(async () => {
      for (const s of others) {
        if (cancelled || document.hidden) return;
        prefetchDashboard(s, dateRange.from, dateRange.to, currency);
        await new Promise((resolve) => {
          timer = setTimeout(resolve, 1500);
        });
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loading, directory, group, groupCompanies, dateRange, currency]);
  // A Group with no companies has nothing to pick, so the Company row is hidden.
  const showCompany = groupCompanies.length > 0;
  const companyOptions = useMemo(
    () => [{ value: ALL, label: t("common:all") }, ...groupCompanies.map((c) => ({ value: c.code, label: c.code }))],
    [groupCompanies, t]
  );
  // Currency chips in the order the user dragged them into (saved in the browser).
  const [currencyOptions, setCurrencyOrder] = useOrderedCurrencies(currencyCodes);

  // The saved currency is only replaced when the user picks one: if a company lacks it, the page
  // shows a fallback but keeps the preference for when they switch back.
  // Picking one company / Group switches the session to it (sidebar and other pages follow);
  // an "All" view spans several tenants, so it leaves the session where it is.
  const save = async (next) => {
    const target = { group, company, ...next };
    const id = singleTenantId(directory, target.group, target.company);
    if (id && id !== sessionTenantId) {
      setPending({ group: target.group, company: target.company, from: sessionTenantId });
      try {
        await switchCompany(id);
        setSwitchError("");
      } catch (err) {
        setSwitchError(err.message);
        setPending(null); // back to the company the session is still in
        return;
      }
    }
    setSaved({ currency: saved?.currency ?? currency, loginStamp: currentLoginStamp(), ...target });
    setPending(null);
  };
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
    ? t("kpi.vsLastMonth")
    : t("kpi.vsPrevious");
  const showEarnings = Boolean(kpi?.showEarnings);
  const cards = [
    { id: "profit", label: t("kpi.profit"), icon: DollarSign, color: "#2563eb", tint: "#e8f1ff", value: kpi?.profit, previous: kpi?.previousProfit },
    { id: "expenses", label: t("kpi.expenses"), icon: TrendingDown, color: "#ef4444", tint: "#ffdfdf", value: kpi?.expenses, previous: kpi?.previousExpenses },
    { id: "netProfit", label: t("kpi.netProfit"), icon: ChartLine, color: "#10b981", tint: "#d6f7e7", value: kpi?.netProfit, previous: kpi?.previousNetProfit },
    ...(showEarnings
      ? [{ id: "earnings", label: t("kpi.earnings"), icon: Wallet, color: "#d97706", tint: "#fff3da", value: kpi?.earnings, previous: kpi?.previousEarnings }]
      : []),
  ];
  const pageError = directoryError || switchError || error;
  // What went wrong is shown as a toast: the headline in the current language, the reason as the server gave it.
  useEffect(() => {
    if (pageError) push(t(switchError ? "errors.switch" : "errors.load"), "error", pageError);
    // one toast per new error (a language switch must not add another)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageError, switchError]);

  return (
    <div className="relative flex flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)] lg:h-full lg:min-h-[520px]">
      <Toast toasts={toasts} onClose={dismiss} />
      <DashboardFilterPanel
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        showGroup={showGroup}
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
        onCompanyPressStart={prefetchCompany}
      />

      <section className={cn("grid flex-none grid-cols-1 gap-[clamp(8px,1.5dvh,12px)]", showEarnings ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3")}>
        {cards.map((card) => (
          <KpiCard key={card.id} {...card} compareLabel={compareLabel} loading={initialLoading} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-[clamp(8px,1.5dvh,12px)] lg:min-h-0 lg:flex-1 lg:grid-cols-[1.6fr_1fr]">
        <TrendChartCard trend={trend} dateFrom={dateRange.from} dateTo={dateRange.to} drawKey={requestKey} ready={Boolean(requestKey) && dataKey === requestKey} />
        <CurrencyBreakdownCard breakdown={breakdown} currency={currency} loading={initialLoading} />
      </section>
    </div>
  );
}
