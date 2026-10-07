import { useState } from "react";
import { Popover } from "radix-ui";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MONTHS, monthKey, monthLabel } from "./ownershipRules";

/**
 * Month picker for the Ownership page: a year header with arrows and a 4x3 month grid.
 * Months after `current` are greyed out; a dot marks months that have saved changes (`saved`).
 * The trigger turns amber with a HISTORICAL tag while a past month is selected.
 */
export default function MonthPicker({ value, current, saved, onChange, triggerClassName }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.split("-")[0]));
  const currentYear = Number(current.split("-")[0]);
  const historical = value !== current;

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setYear(Number(value.split("-")[0]));
        setOpen(next);
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Choose month"
          className={cn(
            triggerClassName,
            "cursor-pointer transition-[border-color,box-shadow,background-color]",
            historical ? "border-[#f5a524] bg-[#fffaf0] text-[#a45a04]" : "text-brand-navy",
            open && !historical && "border-brand-blue shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
          )}
        >
          <CalendarDays className={cn("size-4", historical ? "text-[#c77d0a]" : "text-[#0b57e8]")} strokeWidth={2.2} />
          {monthLabel(value)}
          {historical && <span className="rounded-full bg-[#fde7b8] px-2 py-0.5 text-[10px] font-extrabold tracking-[0.4px] text-[#a45a04]">HISTORICAL</span>}
          <ChevronDown className={cn("size-3.5 text-slate-400 transition-transform", open && "rotate-180")} strokeWidth={2.6} />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[304px] rounded-2xl border border-dash-line bg-white p-3 shadow-[0_14px_34px_-8px_rgba(15,23,42,0.32)]"
        >
          <div className="flex items-center justify-between rounded-[10px] bg-[#f3f6fb] px-2 py-1.5 text-[13px] font-extrabold text-brand-navy">
            <button type="button" aria-label="Previous year" onClick={() => setYear((y) => y - 1)} className="flex size-6 cursor-pointer items-center justify-center rounded-md hover:bg-white">
              <ChevronLeft className="size-4" strokeWidth={2.6} />
            </button>
            {year}
            <button
              type="button"
              aria-label="Next year"
              disabled={year >= currentYear}
              onClick={() => setYear((y) => y + 1)}
              className="flex size-6 cursor-pointer items-center justify-center rounded-md hover:bg-white disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              <ChevronRight className="size-4" strokeWidth={2.6} />
            </button>
          </div>

          <div className="mt-2.5 grid grid-cols-4 gap-[7px]">
            {MONTHS.map((name, i) => {
              const key = monthKey(year, i);
              const future = key > current;
              const selected = key === value;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={future}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative flex h-[34px] cursor-pointer items-center justify-center rounded-[10px] border text-[12.5px] font-bold transition-colors",
                    future && "cursor-not-allowed border-[#eef1f5] bg-[#f8fafc] text-[#c3cad5]",
                    !future && selected && key !== current && "border-[#f5a524] bg-[#fff4dc] text-[#8a4b04]",
                    !future && selected && key === current && "border-transparent bg-seg-active text-white shadow-[0_4px_10px_-3px_rgba(13,96,255,0.55)]",
                    !future && !selected && key === current && "border-brand-blue bg-[#eef4ff] text-[#0b57e8]",
                    !future && !selected && key !== current && "border-dash-line bg-white text-[#1f2937] hover:bg-slate-50"
                  )}
                >
                  {name}
                  {saved.has(key) && <span className="absolute right-1.5 top-[5px] size-1.5 rounded-full bg-[#f5a524]" />}
                </button>
              );
            })}
          </div>

          <div className="mt-2.5 flex items-center gap-3.5 text-[11px] text-dash-sub">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#f5a524]" />
              Has saved changes
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-brand-blue" />
              Current month
            </span>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
