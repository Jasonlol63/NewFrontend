import { useCallback, useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { useListScope } from "@/components/shared/list/useListScope";
import { useTenantList } from "@/components/shared/list/useTenantList";
import { useSession } from "@/context/session";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOrderedCurrencies } from "@/hooks/useOrderedCurrencies";
import { toIsoDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import { normalizeAccountRow } from "@/pages/account/accountRules";
import ContraInboxModal from "./contra-inbox/ContraInboxModal.jsx";
import { canApproveContra } from "./contra-inbox/contraInboxRules";
import { useContraInbox } from "./contra-inbox/useContraInbox";
import FilterCard from "./FilterCard.jsx";
import ManualForm from "./ManualForm.jsx";
import { openPaymentHistory } from "./paymentHistoryRules";
import ReportBlocks from "./ReportBlocks.jsx";
import { buildBlocks, buildSearchRequest } from "./transactionPaymentRules";
import { useTenantCurrencies, useTransactionSearch } from "./useTransactionData";

/**
 * Transaction Payment (design B): two cards on top (filters, manual transaction form), then one block per selected
 * currency with the two account tables. The page itself scrolls (the layout's main), there is no outer frame.
 * The list comes from /api/transaction/search (all currencies at once, the chips filter on the client); the form posts
 * to /api/transaction/submit and the list reloads after it.
 */
export default function TransactionPaymentPage() {
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
  const { tenantId } = scope;
  const { currencies, error: currencyError } = useTenantCurrencies(tenantId);
  const { rows: accountRows, error: accountError } = useTenantList("/api/account", tenantId, { normalize: normalizeAccountRow });
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
  const today = toIsoDate(new Date());
  const todayOnly = filters.range.from === today && filters.range.to === today;
  const blocks = useMemo(() => buildBlocks(search.rows, shown, filters.pills, todayOnly), [search.rows, shown, filters.pills, todayOnly]);

  const { reload: reloadSearch } = search;
  const { reload: reloadInbox } = inbox;
  const onSubmitted = useCallback(
    (status) => {
      reloadSearch();
      if (status === "PENDING") reloadInbox();
    },
    [reloadSearch, reloadInbox]
  );
  const openHistory = (row) => openPaymentHistory({ account: row.accountId, accountDbId: row.id, tenantId, range: filters.range });

  const pageError = scope.error || currencyError || accountError || search.error;

  return (
    <div className="flex min-h-full flex-col gap-(--gap) p-[clamp(10px,2dvh,18px)] [--gap:clamp(8px,1.5dvh,14px)]">
      {canApprove && (
        <div className="flex flex-none">
          <button
            type="button"
            onClick={() => setInboxOpen(true)}
            className="inline-flex flex-none cursor-pointer items-center gap-2 rounded-[10px] border border-dash-line bg-white px-3.5 py-2 text-[13px] font-bold whitespace-nowrap text-brand-navy shadow-dash-card transition-colors hover:bg-slate-50"
          >
            <Inbox className="size-4" strokeWidth={2.2} />
            Contra Inbox
            {inbox.rows.length > 0 && (
              <span className="min-w-[18px] rounded-full bg-[#ef4444] px-1.5 text-center text-[11px] leading-[18px] font-bold text-white">{inbox.rows.length}</span>
            )}
          </button>
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-(--gap) min-[1024px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <FilterCard
          filters={filters}
          onChange={(patch) => setFilters((cur) => ({ ...cur, ...patch }))}
          scope={scope}
          currency={{ options: currencyOptions, selected: shown, allOn, onToggle: toggleCur, onAll: pickAll, onReorder: setCurrencyOrder }}
        />
        <ManualForm tenantId={tenantId} accounts={accounts} currencies={currencies} shown={shown} onSubmitted={onSubmitted} />
      </div>
      {pageError && (
        <div className="flex-none rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-medium text-dash-down">{pageError}</div>
      )}
      <div className={cn("transition-opacity", search.loading && "opacity-60")}>
        <ReportBlocks blocks={blocks} currencies={shown} showName={Boolean(filters.pills.name)} shut={shut} onToggle={(c) => setShut((cur) => ({ ...cur, [c]: !cur[c] }))} onOpen={openHistory} />
      </div>
      {inboxOpen && <ContraInboxModal inbox={inbox} onClose={closeInbox} />}
    </div>
  );
}
