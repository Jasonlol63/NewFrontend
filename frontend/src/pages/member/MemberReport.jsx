import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { fmt } from "@/pages/transaction-payment/transactionPaymentRules";

const amountTone = (n) => (n > 0 ? "font-semibold text-[#1d4ed8]" : n < 0 ? "font-semibold text-[#dc2626]" : "");
const flow = (n) => (n ? fmt(n) : "-");
const rowTone = (i) => cn(i % 2 ? "bg-white/65" : "bg-row-stripe", "hover:bg-row-hover");

const COLS = [
  ["date", "text-left", "w-[9%]"],
  ["idProduct", "text-left", "w-[13%]"],
  ["rate", "text-right", "w-[8%]"],
  ["winLoss", "text-right", "w-[10%]"],
  ["crDr", "text-right", "w-[9%]"],
  ["balance", "text-right", "w-[11%]"],
  ["description", "text-left", ""],
  ["remark", "text-left", "w-[15%]"],
];
const TH =
  "h-7 border-r border-white/25 bg-brand-head px-[clamp(6px,0.42vw,8px)] type-caption font-semibold! whitespace-nowrap text-white first:rounded-tl-lg last:rounded-tr-lg last:border-r-0";
const TD = "h-[26px] overflow-hidden border-b border-[rgba(130,155,195,0.2)] px-[clamp(6px,0.42vw,8px)] text-ellipsis whitespace-nowrap text-[#374151] tabular-nums";
const TOTAL = "h-7 border-t border-[rgba(47,111,239,0.35)] bg-white/40 px-[clamp(6px,0.42vw,8px)] text-right font-semibold text-brand-navy tabular-nums";

/** One block per shown currency: "Currency: XXX", the statement rows and a TOTAL (XXX) line. */
export default function MemberReport({ blocks }) {
  const { t } = useTranslation("member");
  return blocks.map(({ currency, rows, totals }) => (
    <div key={currency} className="not-first:mt-(--gap)">
      <h2 className="mb-1.5 type-card-title text-brand-navy">{t("report.currency", { code: currency })}</h2>
      <div className="overflow-hidden rounded-lg">
        <table className="w-full table-fixed border-separate border-spacing-0 type-table-cell">
          <colgroup>
            {COLS.map(([name, , width]) => (
              <col key={name} className={width} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {COLS.map(([name, align]) => (
                <th key={name} className={cn(TH, align)}>{t(`report.cols.${name}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key} className={rowTone(i)}>
                <td className={cn(TD, "text-left text-[#1f2937]")}>{r.date}</td>
                <td className={cn(TD, "text-left text-[#1f2937]")}>{r.product}</td>
                <td className={cn(TD, "text-right text-[#1f2937]")}>{r.rate}</td>
                <td className={cn(TD, "text-right", amountTone(r.winLoss))}>{flow(r.winLoss)}</td>
                <td className={cn(TD, "text-right", amountTone(r.crDr))}>{flow(r.crDr)}</td>
                <td className={cn(TD, "text-right", amountTone(r.balance))}>{fmt(r.balance)}</td>
                <td className={cn(TD, "text-left text-[#1f2937] uppercase")}>{r.description}</td>
                <td className={cn(TD, "text-left text-[#1f2937]")}>{r.remark}</td>
              </tr>
            ))}
            <tr>
              <td className={cn(TOTAL, "text-left")} colSpan={3}>{t("report.total", { currency })}</td>
              <td className={TOTAL}>{flow(totals.winLoss)}</td>
              <td className={TOTAL}>{flow(totals.crDr)}</td>
              <td className={cn(TOTAL, amountTone(totals.balance))}>{fmt(totals.balance)}</td>
              <td className={TOTAL} colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  ));
}
