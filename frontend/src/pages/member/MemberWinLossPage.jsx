import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Toast from "@/components/shared/Toast.jsx";
import { useSession } from "@/context/session";
import { useErrorToasts } from "@/hooks/useErrorToasts";
import { useNotice } from "@/hooks/useNotice";
import { useOrderedCurrencies } from "@/hooks/useOrderedCurrencies";
import { toIsoDate } from "@/lib/date";
import MemberFilterCard from "./MemberFilterCard.jsx";
import MemberReport from "./MemberReport.jsx";
import ExportPdfModal from "@/pages/transaction-payment/ExportPdfModal.jsx";
import { buildMemberBlocks } from "./memberRules";
import { useLinkedCurrencies, useMemberHistory, useMemberProfile, useMiniBalances } from "./useMemberData";

/**
 * Member Win/Loss: the page a member lands on. Filter card on top (Date Range, Company, [Account], Currency; with linked
 * accounts also the Select + balance table), the statement per currency below. The page never scrolls, only the report
 * card does. Data: /api/member/profile (accounts, own currencies), /account-currencies/batch, /mini-grid-balances and
 * /history; the backend lets a member see only their own account and the ones linked to it.
 */
export default function MemberWinLossPage() {
  const { t } = useTranslation("member");
  const { toasts, push, dismiss } = useNotice(5000);
  const { user } = useSession();
  const { profile, error: profileError } = useMemberProfile();
  const [filters, setFilters] = useState(() => {
    const today = toIsoDate(new Date());
    return { range: { from: today, to: today }, account: null, select: "ALL" };
  });
  const [sel, setSel] = useState([]);
  const [exportOpen, setExportOpen] = useState(false);

  const accounts = profile?.accounts ?? [];
  const linked = Boolean(profile?.linked);
  const account = filters.account ?? profile?.accountId ?? null; // the member's own account until another is picked
  const currentAccount = accounts.find((a) => a.value === account);
  const accountIds = useMemo(() => accounts.map((a) => a.value), [accounts]);

  const union = useLinkedCurrencies(accountIds, linked);
  const codes = useMemo(() => (linked ? union.value : profile?.ownCurrencies ?? []), [linked, union.value, profile]);
  const [currencyOptions, setCurrencyOrder] = useOrderedCurrencies(codes);
  const orderKey = currencyOptions.map((o) => o.value);
  const shown = useMemo(() => {
    const chosen = orderKey.filter((c) => sel.includes(c));
    if (chosen.length) return chosen;
    const fallback = orderKey.includes("MYR") ? "MYR" : orderKey[0];
    return fallback ? [fallback] : [];
  }, [orderKey.join(","), sel.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const allOn = codes.length > 1 && shown.length === codes.length;
  const toggleCur = (c) => setSel(shown.includes(c) ? (shown.length > 1 ? shown.filter((x) => x !== c) : shown) : [...shown, c]);
  const pickAll = () => setSel(allOn ? [] : codes);

  const { from: dateFrom, to: dateTo } = filters.range;
  const historyRequest = useMemo(
    () => (account && shown.length ? { accountId: account, dateFrom, dateTo, currencyCodes: shown } : null),
    [account, dateFrom, dateTo, shown.join(",")] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const history = useMemberHistory(historyRequest);
  const blocks = useMemo(() => buildMemberBlocks(history.value, shown, t("report.bf")), [history.value, shown.join(","), t]); // eslint-disable-line react-hooks/exhaustive-deps

  const balanceRequest = useMemo(
    () => (linked && shown.length ? { accountIds, currencyCodes: shown, dateFrom, dateTo } : null),
    [linked, accountIds, dateFrom, dateTo, shown.join(",")] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const balances = useMiniBalances(balanceRequest);

  // Balance table: Total over the listed accounts, then one row each; Select narrows it to one account.
  const summary = useMemo(() => {
    const listed = filters.select === "ALL" ? accounts : accounts.filter((a) => a.value === filters.select);
    const rows = listed.map((a) => ({ label: a.label, values: Object.fromEntries(shown.map((c) => [c, balances.value[a.value]?.[c] ?? 0])) }));
    const total = { label: t("balance.total"), values: Object.fromEntries(shown.map((c) => [c, rows.reduce((s, r) => s + r.values[c], 0)])) };
    return { currencies: shown, rows: [total, ...rows] };
  }, [accounts, shown, balances.value, filters.select, t]);

  useErrorToasts(push, [
    [profileError, t("errors.profile")],
    [union.error, t("errors.currencies")],
    [history.error, t("errors.history")],
    [balances.error, t("errors.balances")],
  ]);

  return (
    <div className="relative flex h-full min-h-[520px] flex-col gap-(--gap) p-[clamp(10px,2dvh,18px)] [--gap:clamp(8px,1.5dvh,14px)]">
      <Toast toasts={toasts} onClose={dismiss} />
      <MemberFilterCard
        filters={{ ...filters, account }}
        onChange={(patch) => setFilters((cur) => ({ ...cur, ...patch }))}
        company={user?.tenant_code ?? ""}
        accounts={accounts}
        linked={linked}
        currency={{ options: currencyOptions, selected: shown, allOn, onToggle: toggleCur, onAll: pickAll, onReorder: setCurrencyOrder }}
        summary={summary}
        onExport={() => setExportOpen(true)}
      />
      <section className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/70 bg-[rgba(226,237,251,0.62)] px-4 py-3 shadow-[0_8px_22px_-16px_rgba(20,51,107,0.5)] backdrop-blur-[10px] [scrollbar-color:#c3cedf_transparent] [scrollbar-width:thin]">
        <div className={history.loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <MemberReport blocks={blocks} />
          {profile && !shown.length && <p className="type-table-cell font-medium! text-dash-faint">{t("filter.noCurrency")}</p>}
        </div>
      </section>
      {exportOpen && currentAccount && (
        <ExportPdfModal
          open
          member
          onClose={() => setExportOpen(false)}
          request={{ accountId: account, dateFrom, dateTo, currencyCodes: shown }}
          account={{ code: currentAccount.label, name: currentAccount.name }}
        />
      )}
    </div>
  );
}
