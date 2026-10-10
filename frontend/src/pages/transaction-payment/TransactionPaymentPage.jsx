import { useCallback, useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { useSession } from "@/context/session";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toIsoDate } from "@/lib/date";
import ContraInboxModal from "./contra-inbox/ContraInboxModal.jsx";
import { canApproveContra } from "./contra-inbox/contraInboxRules";
import { useContraInbox } from "./contra-inbox/useContraInbox";
import FilterCard from "./FilterCard.jsx";
import ManualForm from "./ManualForm.jsx";
import ReportBlocks from "./ReportBlocks.jsx";
import { ALL_CUR, DEFAULT_COMPANY, accountOptions, setFor } from "./transactionPaymentRules";

const ORDER_KEY = "tx-cur-order";
const loadOrder = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(ORDER_KEY));
    if (Array.isArray(saved) && saved.length === ALL_CUR.length && ALL_CUR.every((c) => saved.includes(c))) return saved;
  } catch {
    // no saved order, or storage is blocked: fall back to the default
  }
  return ALL_CUR;
};

/**
 * Transaction Payment (design B): two cards on top (filters, manual transaction form), then one block per selected
 * currency with the two account tables. The page itself scrolls (the layout's main), there is no outer frame.
 * UI only for now: sample data, nothing is loaded or saved on the server.
 */
export default function TransactionPaymentPage() {
  const [filters, setFilters] = useState(() => {
    const today = toIsoDate(new Date());
    return { categories: new Set(), range: { from: today, to: today }, pills: {}, group: "IG", company: DEFAULT_COMPANY };
  });
  const [sel, setSel] = useState(["MYR"]);
  const [order, setOrder] = useState(loadOrder);
  const [shut, setShut] = useState({});

  // Contra Inbox: only Owner / Admin / Manager get it. The session is always in one company, which is the inbox's company.
  const { user: session } = useSession();
  const canApprove = canApproveContra(useCurrentUser());
  const inbox = useContraInbox(session?.tenant_id ?? null, canApprove);
  const [inboxOpen, setInboxOpen] = useState(false);
  const closeInbox = useCallback(() => setInboxOpen(false), []);

  const { group, company } = filters;
  const fullSet = setFor(group, company[group]);
  // Category: only the accounts of the picked roles (none picked = all).
  const set = useMemo(() => {
    if (!filters.categories.size) return fullSet;
    const keep = (rows) => rows.filter(([, role]) => filters.categories.has(role));
    return { left: keep(fullSet.left), right: keep(fullSet.right) };
  }, [fullSet, filters.categories]);
  const accounts = useMemo(() => accountOptions(set), [set]);

  // AP only has MYR. Otherwise the shown currencies keep the chip order.
  const fixed = group === "AP";
  const selected = fixed ? ["MYR"] : order.filter((c) => sel.includes(c));
  const shown = selected.length ? selected : ["MYR"];
  const allOn = !fixed && shown.length === order.length;

  const toggleCur = (c) => setSel(shown.includes(c) ? (shown.length > 1 ? shown.filter((x) => x !== c) : shown) : [...shown, c]);
  const pickAll = () => setSel(allOn ? ["MYR"] : [...order]);
  const reorder = (next) => {
    setOrder(next);
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(next));
    } catch {
      // storage blocked: the order just won't be remembered
    }
  };

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
          currency={{ order: fixed ? ["MYR"] : order, selected: shown, allOn, onToggle: toggleCur, onAll: pickAll, onReorder: reorder, fixed }}
        />
        <ManualForm accounts={accounts} currencies={shown} accountsKey={`${group}/${company[group]}`} />
      </div>
      <ReportBlocks set={set} currencies={shown} shut={shut} onToggle={(c) => setShut((cur) => ({ ...cur, [c]: !cur[c] }))} />
      {inboxOpen && <ContraInboxModal inbox={inbox} onClose={closeInbox} />}
    </div>
  );
}
