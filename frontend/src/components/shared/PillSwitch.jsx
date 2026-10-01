import { cn } from "@/lib/utils";

export default function PillSwitch({
  options,
  value,
  onChange,
  itemWidth = 76,
  compact = false,
  // "sm" is the slimmer version used inside the sidebar profile card
  size = "md",
}) {
  const activeIndex = Math.max(
    0,
    options.findIndex((opt) => opt.value === value)
  );
  const sm = size === "sm";

  return (
    <div
      className={cn(
        "relative inline-flex rounded-full bg-[linear-gradient(180deg,#dfe9f8_0%,#ccdcf3_100%)] shadow-[inset_0_2px_5px_rgba(20,70,160,0.18),inset_0_-1px_0_rgba(255,255,255,0.5)]",
        sm ? "p-[3px]" : "p-1"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute rounded-full bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          sm
            ? "inset-y-[3px] left-[3px] shadow-[0_3px_8px_-2px_rgba(20,90,220,0.55),0_1px_2px_rgba(20,90,220,0.4),inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-3px_5px_rgba(0,0,30,0.18)]"
            : "inset-y-1 left-1 shadow-[0_6px_14px_-3px_rgba(20,90,220,0.55),0_2px_3px_rgba(20,90,220,0.4),inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-3px_5px_rgba(0,0,30,0.18)]"
        )}
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
              "relative z-10 cursor-pointer rounded-full border-none bg-transparent font-bold tracking-[0.3px] transition-transform active:scale-95",
              sm ? "py-[3px] text-[11px] leading-[1.3]" : cn("text-[12px]", compact ? "py-[4px]" : "py-[6px]"),
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
