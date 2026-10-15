import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import Toast from "@/components/shared/Toast.jsx";
import { useListScope } from "@/components/shared/list/useListScope";
import { useSession } from "@/context/session";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useErrorToasts } from "@/hooks/useErrorToasts";
import { useNotice } from "@/hooks/useNotice";
import { useOrderedCurrencies } from "@/hooks/useOrderedCurrencies";
import { toIsoDate } from "@/lib/date";
import ContraInboxModal from "./contra-inbox/ContraInboxModal.jsx";
import { canApproveContra } from "./contra-inbox/contraInboxRules";
import { useContraInbox } from "./contra-inbox/useContraInbox";
import FilterCard from "./FilterCard.jsx";
import ManualForm from "./ManualForm.jsx";
import { openPaymentHistory } from "./paymentHistoryRules";
import ReportBlocks from "./ReportBlocks.jsx";
import { buildBlocks, buildSearchRequest, fmt, rangeAroundToday } from "./transactionPaymentRules";
import { hasSearchFor, prefetchTenant, useTenantAccounts, useTenantCurrencies, useTransactionSearch } from "./useTransactionData";

// The big companies: once the page has settled they are loaded in the background, one by one, so the first switch to them is quick too.
const PREFETCH_COMPANIES = ["95", "AG"];

/**
 * Transaction Payment (design B): two cards on top (filters, manual transaction form), then one block per selected
 * currency with the two account tables. The page itself scrolls (the layout's main), there is no outer frame.
 * The list comes from /api/transaction/search (all currencies at once, the chips filter on the client); the form posts
 * to /api/transaction/submit and the list reloads after it.
 */
export default function TransactionPaymentPage() {
  const { t } = useTranslation(["transaction", "common"]);
  const { toasts, push, dismiss } = useNotice(5000);
  const [filters, setFilters] = useState(() => {
    const today = toIsoDate(new Date());
    return { categories: new Set(), range: { from: today, to: today }, pills: {} };
  });
  const [sel, setSel] = useState([]);
  const [shut, setShut] = useState({});

  // Contra Inbox: only Owner / Admin / Manager get it. The session is always in one company, which is the inbox's company.
  const { user: session } = useSession();
  const canApprove = canApproveContra(useCurrentUser());
  const inbox = useContraInbox(session?.tenant_id ?? null, canApprove);
  const [inboxOpen, setInboxOpen] = useState(false);
  const closeInbox = useCallback(() => setInboxOpen(false), []);

  const scope = useListScope();
  // The data follows what is picked, not the session: a switch is on its way for a few hundred ms and nothing here depends on it
  // being done (every request carries its own tenant_id), so the lists start loading at the click. Submit waits for the switch.
  const tenantId = scope.dataTenantId;
  const { switching } = scope;
  const { currencies, error: currencyError } = useTenantCurrencies(tenantId);
  const { rows: accountRows, error: accountError } = useTenantAccounts(tenantId);
  const accounts = useMemo(() => accountRows.filter((a) => a.status === "active"), [accountRows]);

  // Chips in the order the user dragged them into (shared with the Dashboard); the default is MYR, else the first currency.
  const codes = useMemo(() => currencies.map((c) => c.code), [currencies]);
  const [currencyOptions, setCurrencyOrder] = useOrderedCurrencies(codes);
  const orderKey = currencyOptions.map((o) => o.value).join(",");
  const selKey = sel.join(",");
  const shown = useMemo(() => {
    const ordered = orderKey ? orderKey.split(",") : [];
    const chosen = ordered.filter((c) => selKey.split(",").includes(c));
    if (chosen.length) return chosen;
    const fallback = ordered.includes("MYR") ? "MYR" : ordered[0];
    return fallback ? [fallback] : [];
  }, [orderKey, selKey]);
  const allOn = codes.length > 1 && shown.length === codes.length;

  const toggleCur = (c) => setSel(shown.includes(c) ? (shown.length > 1 ? shown.filter((x) => x !== c) : shown) : [...shown, c]);
  const pickAll = () => setSel(allOn ? [] : codes);

  const request = useMemo(
    () => (tenantId ? buildSearchRequest({ tenantId, range: filters.range, categories: filters.categories, showZero: filters.pills.zero }) : null),
    [tenantId, filters.range, filters.categories, filters.pills.zero]
  );
  const search = useTransactionSearch(request);

  // A company's chip pressed down: its data starts loading before the click is finished.
  const prefetchCompany = useCallback(
    (code) => {
      const id = scope.companyOptions.find((c) => c.value === code)?.tenantId;
      if (id && id !== tenantId) prefetchTenant(request, id);
    },
    [scope.companyOptions, tenantId, request]
  );
  // The big companies in the background once this one has loaded (not while the tab is hidden, not what is remembered already).
  useEffect(() => {
    if (!request || search.loading) return undefined;
    const ids = PREFETCH_COMPANIES.map((code) => scope.companyOptions.find((c) => c.value === code)?.tenantId).filter(
      (id) => id && id !== request.tenantId && !hasSearchFor(request, id)
    );
    if (!ids.length) return undefined;
    let cancelled = false;
    let timer = setTimeout(async function next() {
      for (const id of ids) {
        if (cancelled || document.hidden) return;
        prefetchTenant(request, id);
        await new Promise((resolve) => {
          timer = setTimeout(resolve, 1500);
        });
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [request, search.loading, scope.companyOptions]);
  const today = toIsoDate(new Date());
  const todayOnly = filters.range.from === today && filters.range.to === today;

  // Type Search: only the accounts with a manual transaction in the Capture Date. null = off; otherwise { snapshot, discover, focus }.
  // The left filters at entry are kept in the snapshot and come back on exit. `discover` waits for the first result (today, every
  // currency) to select the currencies that have manual transactions. `focus` ({ MYR: [account ids] }) is set by approved submits:
  // each currency then lists only the accounts the submits of the session touched.
  const [typeSearch, setTypeSearch] = useState(null);
  const typeSearchOn = typeSearch !== null;
  const blocks = useMemo(() => buildBlocks(search.rows, shown, filters.pills, todayOnly, typeSearch ?? false), [search.rows, shown, filters.pills, todayOnly, typeSearch]);

  // Another company has other accounts: leave Type Search (adjusting state while rendering, no effect needed).
  const [seenTenant, setSeenTenant] = useState(tenantId);
  if (seenTenant !== tenantId) {
    setSeenTenant(tenantId);
    if (typeSearch) setTypeSearch(null);
  }
  if (typeSearch?.discover && !search.loading) {
    const found = new Set(search.rows.filter((r) => r.hasManual).map((r) => r.currency));
    setSel(orderKey.split(",").filter((c) => found.has(c)));
    setTypeSearch({ ...typeSearch, discover: false });
  }

  const enterTypeSearch = () => {
    const snapshot = typeSearch?.snapshot ?? { filters, sel: shown };
    setFilters({ categories: new Set(), range: { from: today, to: today }, pills: {} });
    setTypeSearch({ snapshot, discover: true, focus: null });
  };
  const exitTypeSearch = () => {
    if (!typeSearch) return;
    setFilters(typeSearch.snapshot.filters);
    setSel(typeSearch.snapshot.sel);
    setTypeSearch(null);
  };

  const { reload: reloadSearch } = search;
  const { reload: reloadInbox } = inbox;
  // An approved submit goes into the Type Search view showing only the accounts that submit touched, per currency (each submit
  // replaces the last; the Search button lists everything), with the Capture Date from the transaction date to today. One waiting
  // in the Contra Inbox (PENDING) is not in the list yet, so the view stays as it is.
  const onSubmitted = useCallback(
    (status, { date, accounts = {} } = {}) => {
      if (status === "APPROVED" && date) {
        setTypeSearch({ snapshot: typeSearch?.snapshot ?? { filters, sel: shown }, discover: false, focus: accounts });
        setFilters((cur) => ({
          ...cur,
          ...(typeSearchOn ? {} : { categories: new Set(), pills: {} }),
          range: rangeAroundToday(date, toIsoDate(new Date())),
        }));
        setSel(Object.keys(accounts));
      }
      reloadSearch();
      if (status === "PENDING") reloadInbox();
    },
    [reloadSearch, reloadInbox, shown, filters, typeSearch, typeSearchOn]
  );
  // A click on a Balance fills the manual form (nonce: clicking the same balance again fills it again). The page may be scrolled
  // far from the form, so a toast says what went in.
  const readOnly = Boolean(useCurrentUser()?.readOnly);
  const [fill, setFill] = useState(null);
  const pickBalance = (row) => {
    setFill((cur) => ({ row, nonce: (cur?.nonce ?? 0) + 1 }));
    push(t("toast.filled", { account: row.accountId, currency: row.currency, amount: fmt(row.balance) }));
  };
  const openHistory = (row) => openPaymentHistory({ account: row.accountId, accountDbId: row.id, tenantId, range: filters.range, currencies: [row.currency] });

  useErrorToasts(push, [
    [scope.error, t("errors.scope")],
    [currencyError, t("errors.currencies")],
    [accountError, t("errors.accounts")],
    [search.error, t("errors.search"), reloadSearch],
    [inbox.error, t("inbox.loadFailed"), reloadInbox],
  ]);

  return (
    <div className="relative flex min-h-full flex-col gap-(--gap) p-[clamp(10px,2dvh,18px)] [--gap:clamp(8px,1.5dvh,14px)]">
      <Toast toasts={toasts} onClose={dismiss} />
      {canApprove && (
        <div className="flex flex-none">
          <button
            type="button"
            onClick={() => setInboxOpen(true)}
            className="inline-flex flex-none cursor-pointer items-center gap-2 rounded-[10px] border border-dash-line bg-white px-3.5 py-2 type-body font-semibold! whitespace-nowrap text-brand-navy shadow-dash-card transition-colors hover:bg-slate-50"
          >
            <Inbox className="size-4" strokeWidth={2.2} />
            {t("inbox.title")}
            {inbox.rows.length > 0 && (
              <span className="min-w-[18px] rounded-full bg-[#ef4444] px-1.5 text-center type-caption leading-[18px]! font-semibold! text-white">{inbox.rows.length}</span>
            )}
          </button>
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-(--gap) min-[1024px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <FilterCard
          filters={filters}
          onChange={(patch) => setFilters((cur) => ({ ...cur, ...patch }))}
          scope={scope}
          onPrefetchCompany={prefetchCompany}
          currency={{ options: currencyOptions, selected: shown, allOn, onToggle: toggleCur, onAll: pickAll, onReorder: setCurrencyOrder }}
        />
        <ManualForm tenantId={tenantId} switching={switching} accounts={accounts} currencies={currencies} shown={shown} fill={fill} onSubmitted={onSubmitted} notify={push} typeSearch={{ active: typeSearchOn && !typeSearch.focus, on: typeSearchOn, busy: typeSearch?.discover || search.loading, onEnter: enterTypeSearch, onExit: exitTypeSearch }} />
      </div>
      <div>
        <ReportBlocks skeleton={search.loading && search.rows.length === 0} blocks={blocks} currencies={shown} showName={Boolean(filters.pills.name)} shut={shut} onToggle={(c) => setShut((cur) => ({ ...cur, [c]: !cur[c] }))} onOpen={openHistory} onPick={readOnly ? undefined : pickBalance} />
      </div>
      {inboxOpen && <ContraInboxModal inbox={inbox} onClose={closeInbox} notify={push} />}
    </div>
  );
}
