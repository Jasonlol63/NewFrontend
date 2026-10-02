import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover } from "radix-ui";
import { cn } from "@/lib/utils";
import { MONTHS, WEEKDAYS, monthGrid } from "@/lib/calendar";
import { parseIsoDate, toIsoDate } from "@/lib/date";
import { inputClass, openFieldClass } from "./fields.jsx";

// Selected day / month / year: the modal's blue gradient (same as Save), not the Dashboard's lighter one.
const activeClass = "bg-brand-sweep text-white shadow-[0_4px_10px_-4px_rgba(20,90,220,0.6)]";
// Short laptops (modal-short, <= 700px high) get a smaller calendar: 216 wide with 26px days instead of 260 wide with 28px days.
const tileClass = "cursor-pointer rounded-lg border-none py-2 text-[12px] font-semibold transition-colors modal-short:py-1.5 modal-short:text-[11.5px]";

/**
 * Single-date field: a plain input-style box (yyyy-mm-dd + calendar icon) that opens the
 * Dashboard calendar (month / year views). Picking a day sets it and closes the popup.
 * value / onChange use ISO "yyyy-mm-dd" strings.
 */
export default function DateField({ value, onChange, placeholder = "Select date" }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("day"); // "day" | "month" | "year"
  const [viewDate, setViewDate] = useState(() => parseIsoDate(value || toIsoDate(new Date())));
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const todayIso = toIsoDate(new Date());

  const handleOpenChange = (next) => {
    if (next) {
      setView("day");
      setViewDate(parseIsoDate(value || todayIso));
    }
    setOpen(next);
  };

  const step = (dir) => {
    if (view === "day") setViewDate(new Date(year, month + dir, 1));
    else if (view === "month") setViewDate(new Date(year + dir, month, 1));
    else setViewDate(new Date(year + dir * 12, month, 1));
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button type="button" className={cn(inputClass, "flex cursor-pointer items-center gap-2 text-left hover:border-[#93c5fd]", open && openFieldClass)}>
          <span className={cn("min-w-0 flex-1 truncate tabular-nums", !value && "text-dash-faint")}>{value || placeholder}</span>
          <CalendarDays className="size-[15px] flex-none text-dash-faint" strokeWidth={2} />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="z-50 max-h-(--radix-popover-content-available-height) w-(--radix-popover-trigger-width) min-w-[260px] overflow-y-auto rounded-xl border border-dash-line bg-white p-2.5 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.25)] modal-short:min-w-[216px] modal-short:p-2"
        >
          <div className="mb-2 flex items-center justify-between modal-short:mb-1">
            <NavButton onClick={() => step(-1)} label="Previous">
              <ChevronLeft className="size-4" strokeWidth={2.4} />
            </NavButton>
            <div className="inline-flex overflow-hidden rounded-lg border border-dash-line">
              <HeadButton active={view === "month"} onClick={() => setView(view === "month" ? "day" : "month")} idleClass="text-[#1d4ed8]">
                {MONTHS[month]}
              </HeadButton>
              <HeadButton active={view === "year"} onClick={() => setView(view === "year" ? "day" : "year")} divider>
                {year}
              </HeadButton>
            </div>
            <NavButton onClick={() => step(1)} label="Next">
              <ChevronRight className="size-4" strokeWidth={2.4} />
            </NavButton>
          </div>

          {view === "day" && (
            <div className="grid grid-cols-7 gap-y-1.5 text-center modal-short:gap-y-0.5">
              {WEEKDAYS.map((d) => (
                <span key={d} className="pb-0.5 text-[10.5px] font-semibold text-dash-sub modal-short:pb-0 modal-short:text-[10px]">
                  {d}
                </span>
              ))}
              {monthGrid(year, month).map((date) => {
                const iso = toIsoDate(date);
                const selected = iso === value;
                const outside = date.getMonth() !== month;
                return (
                  <div key={iso} className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        onChange(iso);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex size-7 cursor-pointer items-center justify-center rounded-lg border-none text-[12px] font-semibold tabular-nums transition-colors modal-short:size-[26px] modal-short:text-[11.5px]",
                        selected
                          ? activeClass
                          : outside
                            ? "bg-transparent text-slate-300 hover:bg-slate-50"
                            : "bg-transparent text-dash-ink hover:bg-slate-100",
                        // Today: thin outline in the same blue as the other outlines.
                        !selected && iso === todayIso && "font-bold text-[#0d4fd6] ring-1 ring-[#3b82f6] ring-inset"
                      )}
                    >
                      {date.getDate()}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {view === "month" && (
            <div className="grid grid-cols-3 gap-1.5 modal-short:gap-1">
              {MONTHS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setViewDate(new Date(year, i, 1));
                    setView("day");
                  }}
                  className={cn(tileClass, i === month ? activeClass : "bg-slate-50 text-[#1e3a6e] hover:bg-slate-100")}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {view === "year" && (
            <div className="grid grid-cols-3 gap-1.5 modal-short:gap-1">
              {Array.from({ length: 12 }, (_, i) => Math.floor(year / 12) * 12 + i).map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setViewDate(new Date(y, month, 1));
                    setView("month");
                  }}
                  className={cn(tileClass, y === year ? activeClass : "bg-slate-50 text-[#1e3a6e] hover:bg-slate-100")}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function NavButton({ label, children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex size-6 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-[#1e3a6e] hover:bg-slate-100 modal-short:size-[22px]"
      {...props}
    >
      {children}
    </button>
  );
}

// The month / year buttons of the header; `divider` draws the line between the two.
function HeadButton({ active, divider, idleClass = "text-[#1e3a6e]", children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "flex cursor-pointer items-center gap-1 border-0 px-2 py-[5px] text-[12px] font-bold transition-colors modal-short:px-[7px] modal-short:py-[3px] modal-short:text-[11.5px]",
        divider && "border-l border-dash-line",
        active ? activeClass : cn("bg-white hover:bg-slate-50", idleClass)
      )}
      {...props}
    >
      {children}
      <ChevronDown className="size-3" strokeWidth={2.6} />
    </button>
  );
}
