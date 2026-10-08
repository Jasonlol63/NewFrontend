import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Grey pill with a round dot that fills with a blue tick when on (old user-filter-chip).
// compact: a slimmer pill (smaller type, dot and padding) for toolbars short of room.
export default function FilterChip({ label, checked, onChange, compact = false }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex flex-none cursor-pointer items-center rounded-full border py-1 pl-1 font-medium whitespace-nowrap transition-[border-color,box-shadow,color]",
        compact ? "gap-1.5 pr-2.5 text-[12px]" : "gap-2 pr-3 text-[13px]",
        checked
          ? "border-[rgba(13,96,255,0.45)] bg-[#f8fafc] text-[#0d60ff] shadow-[0_2px_6px_rgba(13,96,255,0.12)]"
          : "border-dash-line bg-[#f8fafc] text-[#475569] shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:border-[#cbd5e1] hover:shadow-[0_2px_4px_rgba(15,23,42,0.08)]"
      )}
    >
      <span
        className={cn(
          "flex flex-none items-center justify-center rounded-full text-white transition-colors",
          compact ? "size-4" : "size-[18px]",
          checked ? "bg-seg-active" : "bg-[#e2e8f0]"
        )}
      >
        {checked && <Check className="size-[11px]" strokeWidth={3.5} />}
      </span>
      {label}
    </button>
  );
}
