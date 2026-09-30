import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { formatDisplayDate, formatMoney } from "../dashboardFormat";

// Same values as the --color-series-* theme tokens; SVG attributes need literal colours.
const SERIES = [
  { key: "profit", label: "Profit", color: "#3b82f6" },
  { key: "expenses", label: "Expenses", color: "#ef4444" },
  { key: "netProfit", label: "Net Profit", color: "#10b981" },
  { key: "earnings", label: "Earnings", color: "#f59e0b" },
];

const AXIS_TICK = { fontSize: 10.5, fill: "#94a3b8" };

// Lines and fills draw in left to right when data first arrives, and glide to the new shape when
// a filter changes. Skipped for people who ask their system for reduced motion.
const ANIMATE = typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const DRAW_MS = 1200;

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[160px] rounded-lg border border-dash-line bg-white/95 px-3 py-2 text-xs shadow-[0_8px_20px_-6px_rgba(15,23,42,0.25)] backdrop-blur">
      <div className="mb-1 font-bold text-dash-ink">{formatDisplayDate(payload[0].payload.date, "-")}</div>
      {payload.map((item) => (
        <div key={item.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-dash-sub">
            <span className="size-2 rounded-full" style={{ background: item.color }} />
            {item.name}
          </span>
          <b className="text-dash-ink tabular-nums">{formatMoney(item.value)}</b>
        </div>
      ))}
    </div>
  );
}

export default function TrendChartCard({ trend, dateFrom, dateTo, loading }) {
  const [hidden, setHidden] = useState(() => new Set());

  const { rows, series, multiMonth } = useMemo(() => {
    const hasEarnings = trend.some((p) => p.earnings != null);
    const rows = trend.map((p) => ({
      date: p.date,
      profit: Number(p.profit) || 0,
      expenses: Number(p.expenses) || 0,
      netProfit: Number(p.netProfit) || 0,
      earnings: p.earnings == null ? null : Number(p.earnings),
    }));
    return {
      rows,
      series: SERIES.filter((s) => s.key !== "earnings" || hasEarnings),
      multiMonth: dateFrom?.slice(0, 7) !== dateTo?.slice(0, 7),
    };
  }, [trend, dateFrom, dateTo]);

  const toggle = (key) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const formatDay = (iso) => (multiMonth ? formatDisplayDate(iso).slice(0, 5) : String(Number(iso.slice(8, 10))));

  return (
    // Whole card fades while loading (same as the KPI and currency cards), so the glass background shows through.
    <div
      className={cn(
        "flex min-h-[360px] lg:min-h-[240px] flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-dash-card transition-opacity",
        loading && "opacity-60"
      )}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold text-dash-ink">Trend Chart</h3>
        <div className="flex flex-wrap gap-4">
          {series.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 text-[12.5px] font-semibold text-[#374151] transition-opacity",
                hidden.has(s.key) && "opacity-35"
              )}
            >
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
        <span className="rounded-lg border border-dash-line bg-slate-50 px-3 py-1.5 text-[13px] font-semibold text-[#374151]">
          {formatDisplayDate(dateFrom, "-")} to {formatDisplayDate(dateTo, "-")}
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} accessibilityLayer={false} margin={{ top: 10, right: 12, bottom: 0, left: 4 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`trend-fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="#eef0f3" strokeDasharray="4 4" />
            <ReferenceLine y={0} stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDay}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              interval="preserveStartEnd"
              minTickGap={6}
            />
            <YAxis
              tickFormatter={formatMoney}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={72}
              tickCount={5}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }} />
            {series
              .filter((s) => !hidden.has(s.key))
              .map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#trend-fill-${s.key})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                  isAnimationActive={ANIMATE}
                  animationDuration={DRAW_MS}
                  animationEasing="ease-out"
                />
              ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
