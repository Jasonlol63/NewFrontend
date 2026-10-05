import { cn } from "@/lib/utils";

/**
 * Tab switch in the same white bordered box as SegmentGroup; a blue (Login gradient) thumb glides to
 * the chosen tab. options: [{ value, label, icon: Icon, count }]; every tab gets the same width.
 */
export default function SlideTabs({ options, value, onChange, className }) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  return (
    <div
      role="tablist"
      className={cn("inline-flex rounded-[10px] border border-dash-line bg-white p-[3px] shadow-[0_1px_3px_rgba(15,23,42,0.05)]", className)}
    >
      <div className="relative grid" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 rounded-lg bg-brand-sweep shadow-[0_4px_10px_-4px_rgba(13,96,255,0.6)] transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
          style={{ width: `${100 / options.length}%`, transform: `translateX(${index * 100}%)` }}
        />
        {options.map(({ value: v, label, icon: Icon, count }) => {
          const active = v === value;
          return (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(v)}
              className={cn(
                "relative z-10 flex h-7 min-w-[120px] cursor-pointer items-center justify-center gap-1.5 px-3.5 text-[12.5px] font-semibold transition-colors duration-200",
                active ? "text-white" : "text-[#1f2937]"
              )}
            >
              {Icon && <Icon className="size-4" strokeWidth={2} />}
              {label}
              {count != null && (
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 text-center text-[11px] font-extrabold tabular-nums",
                    active ? "bg-white/25 text-white" : "bg-[#e8f1ff] text-[#0b4fd0]"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
