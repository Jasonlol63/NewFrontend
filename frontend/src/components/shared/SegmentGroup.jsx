import { cn } from "@/lib/utils";

// Joined row of chips (Dashboard Group / Company / Currency filters). With allowDeselect,
// clicking the active chip again clears the selection (onChange(null)).
export default function SegmentGroup({ options, value, onChange, allowDeselect = false, className }) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full overflow-x-auto rounded-[10px] border border-dash-line bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={opt.disabled}
            onClick={() => onChange(active && allowDeselect ? null : opt.value)}
            className={cn(
              "flex-none cursor-pointer border-r border-dash-line px-4 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors last:border-r-0 disabled:cursor-not-allowed disabled:opacity-40",
              active ? "bg-seg-active text-white" : "bg-white text-[#1f2937] hover:bg-slate-50"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
