import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney, formatSignedMoney, periodDelta } from "../dashboardFormat";

// color: the metric's own colour (icon + watermark); tint: the soft wash the card fades in from.
export default function KpiCard({ label, icon: Icon, color, tint, value, previous, compareLabel, loading }) {
  const hasValue = value != null;
  const delta = periodDelta(value, previous);
  const showDelta = hasValue && previous != null;

  return (
    <div
      style={{ "--kpi-tint": tint }}
      className={cn(
        "relative flex flex-col gap-2.5 overflow-hidden rounded-2xl border border-slate-200/90 bg-[linear-gradient(135deg,var(--kpi-tint)_0%,#ffffff_62%)] px-4 py-4 shadow-dash-card transition-opacity",
        loading && "opacity-60"
      )}
    >
      {/* big faint icon in the corner */}
      <Icon
        aria-hidden="true"
        strokeWidth={1.6}
        style={{ color }}
        className="pointer-events-none absolute -right-2 -bottom-3.5 size-24 opacity-[0.05]"
      />

      <div className="relative flex items-center gap-2.5">
        <span className="flex size-8 flex-none items-center justify-center rounded-[10px] bg-white shadow-[0_2px_6px_rgba(15,23,42,0.08)]">
          <Icon className="size-[18px]" strokeWidth={2.2} style={{ color }} />
        </span>
        <span className="text-sm font-bold text-dash-ink">{label}</span>
      </div>

      <div className="relative flex flex-wrap items-center gap-2.5">
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

      <div className="relative min-h-[18px] text-[12.5px]">
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
