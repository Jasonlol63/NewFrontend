import { useState } from "react";
import { Popover } from "radix-ui";
import { ArrowRight, CalendarDays, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PERIODS, displayDate, newExpiryOf, periodOf, priceOf } from "./autoRenewRules";

/**
 * Renew period picker. The trigger and the card under it are exactly the same width; every period
 * shows its price, and hovering one previews the new expiry date (Current struck through -> New).
 */
export default function PeriodSelect({ row, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(null);
  const set = Boolean(value);
  const previewKey = hover ?? value;

  const handleOpenChange = (next) => {
    setOpen(next);
    setHover(null);
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex h-7 w-[148px] items-center gap-1.5 rounded-lg border bg-white px-2.5 text-[12px] font-semibold transition-colors enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
            open
              ? "rounded-b-none border-solid border-[#2f8dff]"
              : set
                ? "border-[#9fd0ff] bg-[linear-gradient(90deg,#d6ebff,#f0f8ff)] text-[#0b4fd0]"
                : "border-dashed border-[#9fb8de] text-dash-sub enabled:hover:border-[#2f8dff] enabled:hover:text-[#0d60ff]",
            open && (set ? "bg-[linear-gradient(90deg,#d6ebff,#f0f8ff)] text-[#0b4fd0]" : "text-[#0d60ff]")
          )}
        >
          <CalendarDays className="size-3.5 flex-none" strokeWidth={2} />
          <span className="truncate">{set ? periodOf(value).label : "Select period"}</span>
          <ChevronDown className="ml-auto size-3.5 flex-none" strokeWidth={2.4} />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={-1}
          className="z-50 w-(--radix-popover-trigger-width) overflow-hidden rounded-b-[10px] border border-t-0 border-[#2f8dff] bg-white shadow-[0_14px_24px_-10px_rgba(20,70,160,0.45)]"
        >
          <div className="p-1" onMouseLeave={() => setHover(null)}>
            {PERIODS.map((p) => {
              const selected = p.key === value;
              return (
                <button
                  key={p.key}
                  type="button"
                  onMouseEnter={() => setHover(p.key)}
                  onFocus={() => setHover(p.key)}
                  onClick={() => {
                    onChange(p.key);
                    handleOpenChange(false);
                  }}
                  className={cn(
                    "relative flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-[7px] text-left text-[12.5px] font-semibold transition-colors",
                    selected
                      ? "bg-[#e8f2ff] text-[#0b4fd0] shadow-[inset_3px_0_0_#0d60ff]"
                      : "text-[#1f2937] hover:bg-[#f4f9ff]"
                  )}
                >
                  {p.label}
                  <span className={cn("tabular-nums", selected ? "font-extrabold text-[#0b4fd0]" : "font-bold text-[#14336b]")}>
                    {priceOf(row, p.key)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-[#e6eef9] bg-[linear-gradient(90deg,#d6ebff,#f0f8ff)] p-1.5 whitespace-nowrap tabular-nums">
            {previewKey ? (
              <>
                {/* Two full-width lines so the dates always fit inside the card: old date struck through, new date highlighted. */}
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="text-[9px] font-extrabold tracking-[0.6px] text-[#94a3b8] uppercase">Current</span>
                  <s className="text-[11px] font-semibold text-[#8b97a8] decoration-slate-500/70">{displayDate(row.expiry)}</s>
                </div>
                <div className="flex items-center justify-between gap-1 rounded-lg border border-[#7fb8ff] bg-white px-2 py-1 shadow-[0_3px_8px_-4px_rgba(13,96,255,0.5)]">
                  <span className="flex items-center gap-1 text-[9px] font-extrabold tracking-[0.6px] text-[#2f8dff] uppercase">
                    <ArrowRight className="size-3 flex-none" strokeWidth={2.6} />
                    New
                  </span>
                  <b className="text-[12.5px] text-[#0b4fd0]">{displayDate(newExpiryOf(row, previewKey))}</b>
                </div>
              </>
            ) : (
              <p className="py-1 text-center text-[11px] font-semibold text-dash-faint">Hover to preview new expiry</p>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
