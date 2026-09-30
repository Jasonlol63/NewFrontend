import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney, formatSignedMoney, periodDelta } from "../dashboardFormat";

export default function KpiCard({ label, icon: Icon, iconClassName, value, previous, compareLabel, loading }) {
  const hasValue = value != null;
  const delta = periodDelta(value, previous);
  const showDelta = hasValue && previous != null;

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-2xl border border-slate-200/90 bg-white px-4 py-4 shadow-dash-card transition-opacity",
        loading && "opacity-60"
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("size-[18px]", iconClassName)} strokeWidth={2.2} />
        <span className="text-sm font-bold text-dash-ink">{label}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[28px] leading-none font-bold tracking-tight text-dash-ink tabular-nums">
          {hasValue ? formatMoney(value) : "—"}
        </span>
        {showDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
              delta.up ? "bg-green-500/15 text-dash-up" : "bg-red-500/12 text-dash-down"
            )}
          >
            {delta.up ? <ArrowUp className="size-3" strokeWidth={2.6} /> : <ArrowDown className="size-3" strokeWidth={2.6} />}
            {delta.pct.toFixed(1)}%
          </span>
        )}
      </div>

      <div className="min-h-[18px] text-[12.5px]">
        {showDelta && (
          <>
            <b className={cn("font-bold", delta.up ? "text-dash-up" : "text-dash-down")}>
              {formatSignedMoney(delta.diff)}
            </b>{" "}
            <span className="text-dash-faint">{compareLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}
