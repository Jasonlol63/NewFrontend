import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Download, History, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SoftButton } from "@/components/shared/form-modal/fields.jsx";
import { HISTORY_ROWS } from "./paymentHistoryRules";
import { fmt } from "./transactionPaymentRules";

const amountTone = (n) => (n > 0 ? "font-bold text-[#1d4ed8]" : n < 0 ? "font-bold text-[#dc2626]" : "");

// Column widths in %; Description takes what is left. Remark gets more room on narrower screens so it is never cut.
const COLS = [
  ["Date", "text-left", "w-[8%] max-[1250px]:w-[10.5%]"],
  ["ID Product", "text-left", "w-[8.5%]"],
  ["Currency", "text-center", "w-[6.5%]"],
  ["Rate", "text-center", "w-[5%]"],
  ["Win/Loss", "text-right", "w-[7%]"],
  ["Cr/Dr", "text-right", "w-[8.5%]"],
  ["Balance", "text-right", "w-[8.5%]"],
  ["Description", "text-left", ""],
  ["Remark", "text-center", "w-[12%] max-[1250px]:w-[16%]"],
  ["Creater", "text-center", "w-[7.5%]"],
];

const TH =
  "sticky top-0 z-[2] h-[clamp(26px,1.6vw,30px)] border-r border-white/25 bg-brand-head px-[clamp(6px,0.55vw,10px)] text-[clamp(11px,0.65vw,12px)] font-bold tracking-[0.2px] whitespace-nowrap text-white uppercase last:border-r-0";
const TD =
  "h-[clamp(21px,1.3vw,25px)] overflow-hidden border-b border-[rgba(130,155,195,0.16)] px-[clamp(6px,0.55vw,10px)] text-ellipsis whitespace-nowrap tabular-nums";

/**
 * Payment History: opened in its own popup window from an account name in Transaction Payment. Same frosted frame as
 * the form modals, the rows of the Admin / Account list. UI only for now: the same sample rows for every account,
 * and PDF does nothing yet.
 */
export default function PaymentHistoryPage() {
  const account = decodeURIComponent(useParams().account ?? "");
  const title = `Payment History - ${account} (${account})`;
  useEffect(() => {
    document.title = title;
  }, [title]);

  const closing = HISTORY_ROWS[HISTORY_ROWS.length - 1].balance;

  return (
    <div className="fixed inset-0 bg-[#eaf3fd] bg-[url('/images/Count-Inside-Bg.webp')] bg-cover bg-center bg-no-repeat">
      <div
        role="dialog"
        aria-label={title}
        className="absolute inset-[clamp(8px,1.6dvh,16px)] flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-white/55 bg-modal-bg shadow-[0_20px_50px_-30px_rgba(20,51,107,0.45)] backdrop-blur-[22px] backdrop-saturate-[1.15] [--gap:clamp(8px,1.5dvh,14px)] [--pad:clamp(10px,2dvh,18px)]"
      >
        <header className="flex flex-none items-center justify-between gap-3 px-[calc(var(--pad)+6px)] pt-(--pad)">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 flex-none items-center justify-center rounded-xl bg-brand-sweep text-white shadow-[0_10px_20px_-8px_rgba(20,90,220,0.55),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.35)]">
              <History className="size-5" strokeWidth={2.2} />
            </div>
            <h1 className="m-0 truncate text-[clamp(20px,2.6dvh,26px)] leading-[1.1] font-extrabold tracking-[-0.3px] whitespace-nowrap text-brand-navy">{title}</h1>
          </div>
          <div className="flex flex-none items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border border-[#bfd8ff] bg-[#eaf4ff] px-4 text-[13px] font-bold text-[#1d4ed8] hover:bg-[#dcebff] max-[900px]:px-3"
            >
              <Download className="size-[15px]" strokeWidth={2.3} />
              PDF
            </button>
            <SoftButton onClick={() => window.close()} aria-label="Close" className="h-9 px-4 max-[900px]:px-3">
              <X className="size-[15px]" strokeWidth={2.5} />
              <span className="max-[900px]:hidden">Close</span>
            </SoftButton>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col px-(--pad) pt-(--gap) pb-(--pad)">
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/85 bg-white/80 shadow-[0_8px_22px_-16px_rgba(20,51,107,0.5)]">
            <div className="min-h-0 flex-1 overflow-auto [scrollbar-color:#c3cedf_transparent] [scrollbar-width:thin]">
              <table className="w-full table-fixed border-separate border-spacing-0 text-[clamp(11px,0.625vw,12px)]">
                <colgroup>
                  {COLS.map(([name, , width]) => (
                    <col key={name} className={width} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {COLS.map(([name, align]) => (
                      <th key={name} className={cn(TH, align)}>
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-[rgba(214,230,250,0.92)] font-extrabold text-brand-navy">
                    <td className={cn(TD, "text-left")}>B/F</td>
                    <td className={cn(TD, "text-left")}>-</td>
                    <td className={cn(TD, "text-center")}>MYR</td>
                    <td className={cn(TD, "text-center")}>-</td>
                    <td className={cn(TD, "text-right")}>-</td>
                    <td className={cn(TD, "text-right")}>-</td>
                    <td className={cn(TD, "text-right")}>0.00</td>
                    <td className={cn(TD, "text-left")}>OPENING BALANCE</td>
                    <td className={cn(TD, "text-center")}>-</td>
                    <td className={cn(TD, "text-center")}>-</td>
                  </tr>
                  {/* the same two-tone rows as the Admin / Account list: blue stripe, white, deeper blue on hover */}
                  {HISTORY_ROWS.map((r, i) => (
                    <tr key={r.key} className={cn(i % 2 ? "bg-white/90" : "bg-row-stripe", "hover:bg-row-hover")}>
                      <td className={cn(TD, "text-left font-bold text-[#1f2937]")}>{r.date}</td>
                      <td className={cn(TD, "text-left font-bold text-[#1f2937]")}>{r.product}</td>
                      <td className={cn(TD, "text-center font-bold text-[#1f2937]")}>{r.currency}</td>
                      <td className={cn(TD, "text-center text-[#1f2937]")}>{r.rate}</td>
                      <td className={cn(TD, "text-right text-[#1f2937]")}>{r.winLoss}</td>
                      <td className={cn(TD, "text-right", amountTone(r.crdr))}>{fmt(r.crdr)}</td>
                      <td className={cn(TD, "text-right", amountTone(r.balance))}>{fmt(r.balance)}</td>
                      <td className={cn(TD, "text-left font-bold text-[#1f2937]")}>{r.description}</td>
                      <td className={cn(TD, "text-center font-bold text-[#1f2937]")}>{r.remark}</td>
                      <td className={cn(TD, "text-center font-bold text-[#1f2937]")}>{r.creater}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-none items-center justify-between gap-3 border-t border-[rgba(130,155,195,0.3)] bg-white/60 px-3.5 py-[7px] text-xs text-dash-sub">
              <span>
                Showing <b className="text-brand-navy">{HISTORY_ROWS.length + 1}</b> records
              </span>
              <span>
                Closing balance <b className={cn("ml-1", closing < 0 ? "text-[#dc2626]" : "text-brand-navy")}>{fmt(closing)}</b>
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
