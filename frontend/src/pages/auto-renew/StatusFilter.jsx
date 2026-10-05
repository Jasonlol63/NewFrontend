import { Check, Clock, List, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_FILTERS } from "./autoRenewRules";

const ICONS = { all: List, pending: Clock, approved: Check, rejected: X };

/** Show All / Pending / Approved / Rejected: icon tile, label and the number of rows behind each. */
export default function StatusFilter({ value, onChange, counts }) {
  return (
    <div role="radiogroup" aria-label="Status" className="flex flex-wrap items-center gap-2">
      {STATUS_FILTERS.map((s) => {
        const Icon = ICONS[s.value];
        const active = s.value === value;
        return (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(s.value)}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-[10px] border bg-white py-1 pr-3 pl-1 text-[12.5px] font-semibold whitespace-nowrap text-[#1f2937] transition-[border-color,box-shadow]",
              active ? s.on : cn("border-dash-line shadow-[0_1px_3px_rgba(15,23,42,0.05)]", s.hover)
            )}
          >
            <span className={cn("flex size-[26px] items-center justify-center rounded-lg transition-colors", active ? s.tileOn : s.tile)}>
              <Icon className="size-3.5" strokeWidth={2.4} />
            </span>
            {s.label}
            <span className={cn("min-w-5 rounded-md px-1.5 text-center text-[11px] font-extrabold tabular-nums", active ? s.countOn : s.count)}>
              {counts[s.value]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
