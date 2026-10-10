import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { openPaymentHistory } from "./paymentHistoryRules";
import { ROLE_COLORS, fmt } from "./transactionPaymentRules";

const DEBTOR = ROLE_COLORS.DEBTOR;
const amountTone = (n) => (n > 0 ? "font-bold text-[#1d4ed8]" : n < 0 ? "font-bold text-[#dc2626]" : "");
// Same two-tone rows as the Admin / Account list (DataTable): blue stripe, white, deeper blue on hover.
const rowTone = (i) => cn(i % 2 ? "bg-white/90" : "bg-row-stripe", "hover:bg-row-hover");

const TH =
  "h-[clamp(24px,1.46vw,28px)] border-r border-white/25 bg-brand-head px-[clamp(6px,0.42vw,8px)] text-right text-[clamp(11px,0.625vw,12px)] font-bold whitespace-nowrap text-white first:rounded-tl-lg first:text-left last:rounded-tr-lg last:border-r-0";
// A red row (Payment Alert) keeps its white bold text on hover too.
const ALERT = "bg-[#dc2626] font-bold text-white hover:bg-[#b91c1c]";
const TD = "h-[clamp(20px,1.25vw,24px)] border-b border-[rgba(130,155,195,0.2)] px-[clamp(6px,0.42vw,8px)] text-right text-[#374151] tabular-nums";
const TOTAL = "h-[clamp(22px,1.35vw,26px)] border-t border-[rgba(47,111,239,0.35)] bg-white/40 px-[clamp(6px,0.42vw,8px)] text-right font-extrabold text-brand-navy tabular-nums";

function AccountTable({ rows, totals, showName, onOpen }) {
  const headers = ["Account", ...(showName ? ["Name"] : []), "B/F", "Win/Loss", "Cr/Dr", "Balance"];
  return (
    <div className="overflow-hidden rounded-lg">
      <table className="w-full table-fixed border-separate border-spacing-0 text-[clamp(11px,0.625vw,12px)]">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={h} className={cn(TH, i === 0 && "w-[21%]", h === "Name" && "w-[22%] text-left")}>
                {h}
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
                <td className={cn(TD, "overflow-hidden text-left font-extrabold text-ellipsis whitespace-nowrap")} style={r.alert ? undefined : { background: bg, color: fg }}>
                  <button type="button" title="Payment history" onClick={() => onOpen(r)} className="block w-full cursor-pointer truncate text-left font-extrabold hover:underline">
                    {r.accountId}
                  </button>
                </td>
                {showName && <td className={cn(TD, "overflow-hidden text-left font-semibold text-ellipsis whitespace-nowrap uppercase")} title={r.name}>{r.name}</td>}
                <td className={cn(TD, tone(r.bf))}>{fmt(r.bf)}</td>
                <td className={cn(TD, tone(r.winLoss))}>{fmt(r.winLoss)}</td>
                <td className={cn(TD, tone(r.crDr))}>{fmt(r.crDr)}</td>
                <td className={cn(TD, tone(r.balance))}>{fmt(r.balance)}</td>
              </tr>
            );
          })}
          <tr>
            <td className={cn(TOTAL, "text-left")} colSpan={showName ? 2 : 1}>Total</td>
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
export default function ReportBlocks({ blocks, currencies, showName, shut, onToggle, onOpen }) {
  return currencies.map((c) => {
    const block = blocks[c];
    const net = block.totals.balance;
    return (
      <div key={c} className="not-first:mt-(--gap)">
        <button
          type="button"
          aria-expanded={!shut[c]}
          onClick={() => onToggle(c)}
          className="sticky top-0 z-[6] mb-2.5 flex w-full cursor-pointer items-center gap-2 rounded-[10px] bg-[rgba(226,235,247,0.82)] px-2.5 py-1.5 text-left text-base font-extrabold text-brand-navy shadow-[0_2px_8px_-4px_rgba(20,51,107,0.3)] backdrop-blur-[10px] before:h-4 before:w-1 before:rounded-sm before:bg-[linear-gradient(180deg,#3fc4ff,#0a3fc9)] before:content-['']"
        >
          Currency: {c}
          <span className="ml-auto inline-flex items-center gap-2 text-xs font-semibold text-dash-sub">
            Balance <b className="font-extrabold">{fmt(net)}</b>
            <ChevronDown className={cn("size-4 transition-transform", shut[c] && "-rotate-90")} strokeWidth={2.6} />
          </span>
        </button>
        {!shut[c] && (
          <>
            <div className="grid grid-cols-1 items-start gap-(--gap) min-[1024px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <AccountTable rows={block.left} totals={block.leftTotals} showName={showName} onOpen={onOpen} />
              <AccountTable rows={block.right} totals={block.rightTotals} showName={showName} onOpen={onOpen} />
            </div>
            <div className="mt-(--gap) flex justify-center">
              <div className="w-[min(clamp(260px,19.8vw,380px),100%)] overflow-hidden rounded-lg">
                <div className="flex h-[clamp(30px,2.1vw,40px)] items-center justify-center bg-brand-head px-4 text-[clamp(13px,0.78vw,15px)] font-bold text-white">Total</div>
                <table className="w-full border-collapse text-[clamp(12px,0.73vw,14px)]">
                  <tbody>
                    {[["B/F", "bf"], ["Win/Loss", "winLoss"], ["Cr/Dr", "crDr"], ["Balance", "balance"]].map(([l, key], i) => (
                      <tr key={l} className={rowTone(i)}>
                        <th className="h-[clamp(26px,1.9vw,36px)] w-[48%] border-b border-[rgba(130,155,195,0.2)] px-[clamp(10px,0.83vw,16px)] text-left font-extrabold text-brand-navy">{l}</th>
                        <td className="h-[clamp(26px,1.9vw,36px)] border-b border-[rgba(130,155,195,0.2)] px-[clamp(10px,0.83vw,16px)] text-right font-bold text-[#374151] tabular-nums">{fmt(block.totals[key])}</td>
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
