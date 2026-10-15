import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { moneySign } from "@/lib/money";
import { ROLE_COLORS, fmt } from "./transactionPaymentRules";

const DEBTOR = ROLE_COLORS.DEBTOR;
// The colour follows the raw amount: 0.002586 shows 0.00 but stays blue; only a real 0 is plain.
const amountTone = (n) => (moneySign(n) > 0 ? "font-semibold text-[#1d4ed8]" : moneySign(n) < 0 ? "font-semibold text-[#dc2626]" : "");
// Same two-tone rows as the Admin / Account list (DataTable): blue stripe, white, deeper blue on hover.
const rowTone = (i) => cn(i % 2 ? "bg-white/90" : "bg-row-stripe", "hover:bg-row-hover");

const TH =
  "h-[22px] border-r border-white/25 bg-brand-head px-[clamp(4px,0.3vw,6px)] text-right type-table-head whitespace-nowrap text-white first:rounded-tl-lg first:text-left last:rounded-tr-lg last:border-r-0 max-[1024px]:h-5 max-[1024px]:text-[12px]";
// A red row (Payment Alert) keeps its white bold text on hover too.
const ALERT = "bg-[#dc2626] font-semibold text-white hover:bg-[#b91c1c]";
const TD = "h-5 border-b border-[rgba(130,155,195,0.2)] px-[clamp(4px,0.3vw,6px)] text-right font-semibold text-[#374151] tabular-nums max-[1024px]:h-[18px] max-[1024px]:text-[12px]";
const TOTAL = "h-[22px] border-t border-[rgba(47,111,239,0.35)] bg-white/40 px-[clamp(4px,0.3vw,6px)] text-right font-semibold text-brand-navy tabular-nums max-[1024px]:h-5 max-[1024px]:text-[12px]";

function AccountTable({ rows, totals, showName, onOpen, onPick }) {
  const { t } = useTranslation("transaction");
  const headers = ["account", ...(showName ? ["name"] : []), "bf", "winLoss", "crDr", "balance"];
  return (
    <div className="overflow-hidden rounded-lg">
      <table className="w-full table-fixed border-separate border-spacing-0 type-table-cell">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={h} className={cn(TH, i === 0 && "w-[21%]", h === "name" && "w-[22%] text-left")}>
                {t(`table.${h}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const [bg, fg] = ROLE_COLORS[r.role] ?? DEBTOR;
            const tone = (n) => (r.alert ? "" : amountTone(n));
            return (
              <tr key={r.key} className={r.alert ? ALERT : rowTone(i)}>
                <td className={cn(TD, "overflow-hidden text-left font-semibold text-ellipsis whitespace-nowrap")} style={r.alert ? undefined : { background: bg, color: fg }}>
                  <button type="button" title={t("table.history")} onClick={() => onOpen(r)} className="block w-full cursor-pointer truncate text-left font-semibold hover:underline">
                    {r.accountId}
                  </button>
                </td>
                {showName && <td className={cn(TD, "overflow-hidden text-left text-ellipsis whitespace-nowrap uppercase")} title={r.name}>{r.name}</td>}
                <td className={cn(TD, tone(r.bf))}>{fmt(r.bf)}</td>
                <td className={cn(TD, tone(r.winLoss))}>{fmt(r.winLoss)}</td>
                <td className={cn(TD, tone(r.crDr))}>{fmt(r.crDr)}</td>
                <td className={cn(TD, tone(r.balance))}>
                  {/* A balance that shows 0.00 but holds a remainder is still clickable; only a real 0 is not. */}
                  {onPick && moneySign(r.balance) !== 0 ? (
                    <button type="button" onClick={() => onPick(r)} className="cursor-pointer font-semibold tabular-nums hover:underline">
                      {fmt(r.balance)}
                    </button>
                  ) : (
                    fmt(r.balance)
                  )}
                </td>
              </tr>
            );
          })}
          <tr>
            <td className={cn(TOTAL, "text-left")} colSpan={showName ? 2 : 1}>{t("table.total")}</td>
            <td className={cn(TOTAL, amountTone(totals.bf))}>{fmt(totals.bf)}</td>
            <td className={cn(TOTAL, amountTone(totals.winLoss))}>{fmt(totals.winLoss)}</td>
            <td className={cn(TOTAL, amountTone(totals.crDr))}>{fmt(totals.crDr)}</td>
            <td className={cn(TOTAL, amountTone(totals.balance))}>{fmt(totals.balance)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** One block per shown currency: a foldable "Currency: XXX" heading with its balance, the two account tables and a Total. */
export default function ReportBlocks({ blocks, currencies, showName, shut, onToggle, onOpen, onPick }) {
  const { t } = useTranslation("transaction");
  return currencies.map((c) => {
    const block = blocks[c];
    const net = block.totals.balance;
    return (
      <div key={c} className="not-first:mt-(--gap)">
        <button
          type="button"
          aria-expanded={!shut[c]}
          onClick={() => onToggle(c)}
          className="sticky top-0 z-[6] mb-1.5 flex w-full cursor-pointer items-center gap-2 rounded-[10px] bg-[rgba(226,235,247,0.82)] px-2.5 py-0.5 text-left type-label text-brand-navy shadow-[0_2px_8px_-4px_rgba(20,51,107,0.3)] backdrop-blur-[10px] before:h-3.5 before:w-1 before:rounded-sm before:bg-[linear-gradient(180deg,#3fc4ff,#0a3fc9)] before:content-['']"
        >
          {t("table.currency", { code: c })}
          <span className="ml-auto inline-flex items-center gap-2 type-caption font-semibold! text-dash-sub">
            {t("table.balance")} <b className="font-semibold">{fmt(net)}</b>
            <ChevronDown className={cn("size-4 transition-transform", shut[c] && "-rotate-90")} strokeWidth={2.6} />
          </span>
        </button>
        {!shut[c] && (
          <>
            <div className="grid grid-cols-1 items-start gap-(--gap) min-[1024px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <AccountTable rows={block.left} totals={block.leftTotals} showName={showName} onOpen={onOpen} onPick={onPick} />
              <AccountTable rows={block.right} totals={block.rightTotals} showName={showName} onOpen={onOpen} onPick={onPick} />
            </div>
            <div className="mt-(--gap) flex justify-center">
              <div className="w-[min(clamp(260px,19.8vw,380px),100%)] overflow-hidden rounded-lg">
                <div className="flex h-[clamp(20px,1.2vw,24px)] items-center justify-center bg-brand-head px-4 type-table-head text-white">{t("table.total")}</div>
                <table className="w-full border-collapse type-table-cell">
                  <tbody>
                    {["bf", "winLoss", "crDr", "balance"].map((key, i) => (
                      <tr key={key} className={rowTone(i)}>
                        <th className="h-[clamp(18px,1.1vw,22px)] w-[48%] border-b border-[rgba(130,155,195,0.2)] px-[clamp(6px,0.5vw,10px)] text-left font-semibold text-brand-navy">{t(`table.${key}`)}</th>
                        <td className={cn("h-[clamp(18px,1.1vw,22px)] border-b border-[rgba(130,155,195,0.2)] px-[clamp(6px,0.5vw,10px)] text-right font-semibold tabular-nums", amountTone(block.totals[key]) || "text-[#374151]")}>{fmt(block.totals[key])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    );
  });
}
