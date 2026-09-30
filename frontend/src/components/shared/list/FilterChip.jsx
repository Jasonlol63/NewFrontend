import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Grey pill with a round dot that fills with a blue tick when on (old user-filter-chip).
export default function FilterChip({ label, checked, onChange }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex flex-none cursor-pointer items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-[13px] font-medium whitespace-nowrap transition-[border-color,box-shadow,color]",
        checked
          ? "border-[rgba(13,96,255,0.45)] bg-[#f8fafc] text-[#0d60ff] shadow-[0_2px_6px_rgba(13,96,255,0.12)]"
          : "border-dash-line bg-[#f8fafc] text-[#475569] shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:border-[#cbd5e1] hover:shadow-[0_2px_4px_rgba(15,23,42,0.08)]"
      )}
    >
      <span
        className={cn(
          "flex size-[18px] flex-none items-center justify-center rounded-full text-white transition-colors",
          checked ? "bg-seg-active" : "bg-[#e2e8f0]"
        )}
      >
        {checked && <Check className="size-[11px]" strokeWidth={3.5} />}
      </span>
      {label}
    </button>
  );
}
