import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { currencyColor, formatMoney, formatRate } from "../dashboardFormat";

const RADIUS = 50;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SLICE_GAP = 1.6;

// Share is |amount| / Σ|amount|, so a currency with a negative Net Profit still gets its own slice.
function CurrencyDonut({ rows, activeCode }) {
  const absTotal = rows.reduce((sum, r) => sum + Math.abs(r.amount || 0), 0);
  const active = rows.find((r) => r.code === activeCode);
  const share = absTotal ? (Math.abs(active?.amount || 0) / absTotal) * 100 : 0;

  let offset = 0;
  const slices = absTotal
    ? rows
        .filter((r) => r.amount)
        .map((r) => {
          const length = (Math.abs(r.amount) / absTotal) * CIRCUMFERENCE;
          const slice = { code: r.code, length, offset };
          offset += length;
          return slice;
        })
    : [];

  return (
    <div className="relative size-[150px] flex-none">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="#f1f5f9" strokeWidth="11" />
        {slices.map((s) => (
          <circle
            key={s.code}
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke={currencyColor(s.code)}
            strokeWidth={s.code === activeCode ? 14 : 11}
            strokeDasharray={`${Math.max(s.length - (slices.length > 1 ? SLICE_GAP : 0), 0.5)} ${CIRCUMFERENCE}`}
            strokeDashoffset={-s.offset}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <b className="text-[22px] leading-none font-bold text-dash-ink tabular-nums">{share.toFixed(1)}%</b>
        <span className="mt-1 text-[10px] font-bold text-dash-sub uppercase">{activeCode}</span>
        <span className="text-[9px] text-dash-faint">Share of total</span>
      </div>
    </div>
  );
}

const TH = "border-b border-slate-200 pb-2 font-bold";
const TD = "py-[7px] group-hover:bg-slate-50";

export default function CurrencyBreakdownCard({ breakdown, currency, loading }) {
  const rows = useMemo(
    () =>
      breakdown
        .map((r) => ({
          code: r.code,
          amount: r.amount == null ? null : Number(r.amount),
          originalAmount: r.originalAmount == null ? null : Number(r.originalAmount),
          rate: r.rate == null ? null : Number(r.rate),
        }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    [breakdown]
  );
  const total = rows.reduce((sum, r) => sum + (r.amount || 0), 0);

  return (
    <div
      className={cn(
        "flex h-[460px] min-h-0 flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-dash-card transition-opacity xl:h-auto",
        loading && "opacity-60"
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1 text-[11px] font-bold tracking-wider text-[#374151] uppercase">
            Net Profit · {currency || "—"}
          </div>
          <div className="text-[28px] leading-tight font-bold tracking-tight text-dash-ink tabular-nums">
            {formatMoney(total)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Includes multi-currency conversion</div>
        </div>
        <CurrencyDonut rows={rows} activeCode={currency} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead className="sticky top-0 z-[1] bg-white">
            <tr className="text-[10.5px] tracking-wider text-[#374151] uppercase">
              <th className={cn(TH, "text-left")}>Currency</th>
              <th className={cn(TH, "text-right")}>Amount ({currency || "—"})</th>
              <th className={cn(TH, "text-right")}>Original Amount</th>
              <th className={cn(TH, "text-right")}>Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className={cn("group", r.code === currency && "[&>td]:bg-slate-50")}>
                <td className={cn(TD, "rounded-l-lg pl-1 font-bold text-dash-ink")}>
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: currencyColor(r.code) }} />
                    {r.code}
                  </span>
                </td>
                <td className={cn(TD, "text-right font-bold text-dash-ink tabular-nums")}>{formatMoney(r.amount)}</td>
                <td className={cn(TD, "text-right text-dash-sub tabular-nums")}>
                  {r.code === currency ? "—" : formatMoney(r.originalAmount)}
                </td>
                <td className={cn(TD, "rounded-r-lg pr-1 text-right text-dash-ink tabular-nums")}>{formatRate(r.rate)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-xs font-medium text-dash-faint">
                  {loading ? "Loading…" : "No data for this period"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
