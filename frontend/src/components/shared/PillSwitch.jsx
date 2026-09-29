import { cn } from "@/lib/utils";

export default function PillSwitch({
  options,
  value,
  onChange,
  itemWidth = 76,
  compact = false,
}) {
  const activeIndex = Math.max(
    0,
    options.findIndex((opt) => opt.value === value)
  );

  return (
    <div className="relative inline-flex rounded-full bg-[linear-gradient(180deg,#dfe9f8_0%,#ccdcf3_100%)] p-1 shadow-[inset_0_2px_5px_rgba(20,70,160,0.18),inset_0_-1px_0_rgba(255,255,255,0.5)]">
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 rounded-full bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] shadow-[0_6px_14px_-3px_rgba(20,90,220,0.55),0_2px_3px_rgba(20,90,220,0.4),inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-3px_5px_rgba(0,0,30,0.18)] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{ width: itemWidth, transform: `translateX(${activeIndex * itemWidth}px)` }}
      >
        <span className="pointer-events-none absolute inset-x-[10%] top-[1px] h-[45%] rounded-t-full bg-gradient-to-b from-white/55 to-transparent" />
      </span>

      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{ width: itemWidth }}
            className={cn(
              "relative z-10 cursor-pointer rounded-full border-none bg-transparent text-[12px] font-bold tracking-[0.3px] transition-transform active:scale-95",
              compact ? "py-[4px]" : "py-[6px]",
              active
                ? "text-white [text-shadow:0_1px_2px_rgba(10,40,120,0.25)]"
                : "text-[#6f93c9]"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
