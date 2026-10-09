import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { openPaymentHistory } from "./paymentHistoryRules";
import { ROLE_COLORS, convert, fmt } from "./transactionPaymentRules";

const DEBTOR = ROLE_COLORS.DEBTOR;
const amountTone = (n) => (n > 0 ? "font-bold text-[#1d4ed8]" : n < 0 ? "font-bold text-[#dc2626]" : "");
// Same two-tone rows as the Admin / Account list (DataTable): blue stripe, white, deeper blue on hover.
const rowTone = (i) => cn(i % 2 ? "bg-white/90" : "bg-row-stripe", "hover:bg-row-hover");

const TH =
  "h-[clamp(24px,1.46vw,28px)] border-r border-white/25 bg-brand-head px-[clamp(6px,0.42vw,8px)] text-right text-[clamp(11px,0.625vw,12px)] font-bold whitespace-nowrap text-white first:w-[21%] first:rounded-tl-lg first:text-left last:rounded-tr-lg last:border-r-0";
const TD = "h-[clamp(20px,1.25vw,24px)] border-b border-[rgba(130,155,195,0.2)] px-[clamp(6px,0.42vw,8px)] text-right text-[#374151] tabular-nums";
const TOTAL = "h-[clamp(22px,1.35vw,26px)] border-t border-[rgba(47,111,239,0.35)] bg-white/40 px-[clamp(6px,0.42vw,8px)] text-right font-extrabold text-brand-navy tabular-nums";

function AccountTable({ rows, currency }) {
  const lines = rows.map(([account, role, value]) => ({ account, role, value: convert(value, currency) }));
  const sum = lines.reduce((a, r) => a + r.value, 0);
  return (
    <div className="overflow-hidden rounded-lg">
      <table className="w-full table-fixed border-separate border-spacing-0 text-[clamp(11px,0.625vw,12px)]">
        <thead>
          <tr>
            {["Account", "B/F", "Win/Loss", "Cr/Dr", "Balance"].map((h) => (
              <th key={h} className={TH}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((r, i) => {
            const [bg, fg] = ROLE_COLORS[r.role] ?? DEBTOR;
            return (
              <tr key={r.account} className={rowTone(i)}>
                <td className={cn(TD, "overflow-hidden text-left font-extrabold text-ellipsis whitespace-nowrap")} style={{ background: bg, color: fg }}>
                  <button type="button" title="Payment history" onClick={() => openPaymentHistory(r.account)} className="block w-full cursor-pointer truncate text-left font-extrabold hover:underline">
                    {r.account}
                  </button>
                </td>
                <td className={cn(TD, amountTone(r.value))}>{fmt(r.value)}</td>
                <td className={TD}>0.00</td>
                <td className={TD}>0.00</td>
                <td className={cn(TD, amountTone(r.value))}>{fmt(r.value)}</td>
              </tr>
            );
          })}
          <tr>
            <td className={cn(TOTAL, "text-left")}>Total</td>
            <td className={cn(TOTAL, amountTone(sum))}>{fmt(sum)}</td>
            <td className={TOTAL}>0.00</td>
            <td className={TOTAL}>0.00</td>
            <td className={cn(TOTAL, amountTone(sum))}>{fmt(sum)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** One block per shown currency: a foldable "Currency: XXX" heading with its balance, the two account tables and a Total. */
export default function ReportBlocks({ set, currencies, shut, onToggle }) {
  return currencies.map((c) => {
    const net = [...set.left, ...set.right].reduce((a, r) => a + convert(r[2], c), 0);
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
              <AccountTable rows={set.left} currency={c} />
              <AccountTable rows={set.right} currency={c} />
            </div>
            <div className="mt-(--gap) flex justify-center">
              <div className="w-[min(clamp(260px,19.8vw,380px),100%)] overflow-hidden rounded-lg">
                <div className="flex h-[clamp(30px,2.1vw,40px)] items-center justify-center bg-brand-head px-4 text-[clamp(13px,0.78vw,15px)] font-bold text-white">Total</div>
                <table className="w-full border-collapse text-[clamp(12px,0.73vw,14px)]">
                  <tbody>
                    {["B/F", "Win/Loss", "Cr/Dr", "Balance"].map((l, i) => (
                      <tr key={l} className={rowTone(i)}>
                        <th className="h-[clamp(26px,1.9vw,36px)] w-[48%] border-b border-[rgba(130,155,195,0.2)] px-[clamp(10px,0.83vw,16px)] text-left font-extrabold text-brand-navy">{l}</th>
                        <td className="h-[clamp(26px,1.9vw,36px)] border-b border-[rgba(130,155,195,0.2)] px-[clamp(10px,0.83vw,16px)] text-right font-bold text-[#374151] tabular-nums">0.00</td>
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
