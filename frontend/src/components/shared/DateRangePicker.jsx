import { useState } from "react";
import { Popover } from "radix-ui";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MONTHS, WEEKDAYS, monthGrid } from "@/lib/calendar";
import { addDays, formatDisplayDate, parseIsoDate, toIsoDate } from "@/lib/date";

// Weeks start on Sunday, matching the calendar grid.
const PRESETS = [
  { label: "Today", range: (t) => [t, t] },
  { label: "Yesterday", range: (t) => [addDays(t, -1), addDays(t, -1)] },
  { label: "This Week", range: (t) => [addDays(t, -t.getDay()), addDays(t, 6 - t.getDay())] },
  { label: "Last Week", range: (t) => [addDays(t, -t.getDay() - 7), addDays(t, -t.getDay() - 1)] },
  {
    label: "This Month",
    range: (t) => [new Date(t.getFullYear(), t.getMonth(), 1), new Date(t.getFullYear(), t.getMonth() + 1, 0)],
  },
  {
    label: "Last Month",
    range: (t) => [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)],
  },
  { label: "This Year", range: (t) => [new Date(t.getFullYear(), 0, 1), new Date(t.getFullYear(), 11, 31)] },
  { label: "Last Year", range: (t) => [new Date(t.getFullYear() - 1, 0, 1), new Date(t.getFullYear() - 1, 11, 31)] },
];

function presetRange(preset) {
  const today = new Date();
  const [from, to] = preset.range(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

// ===== Popup size: tweak these to resize the whole picker =====
// (Tailwind needs full class names written out, so edit the values in place.)
const SIZE = {
  // The popup is always exactly as wide as this box; the calendar takes whatever the presets leave.
  trigger: "w-[330px]",                         // width of the date box AND of the popup
  presetColumn: "w-[92px] p-1",                 // left preset list width + padding
  presetItem: "px-2 py-1.5 text-[12px]",        // each preset row
  calendar: "p-2.5",                            // right calendar padding
  header: "mb-2",                               // gap under the < Sep 2026 > row
  headerButton: "px-2 py-[calc(var(--spacing)*1.2)] text-[12px]",      // "Sep" / "2026" buttons
  navButton: "size-6",                          // < > arrows
  weekday: "pb-0.5 text-[10.5px]",              // Sun Mon Tue ...
  dayCell: "size-7 text-[12px]",                // each day number
  dayRowGap: "gap-y-1.5",
  tile: "py-2 text-[12px]",                     // month / year grid tiles
  tileGap: "gap-1.5",
};
// ================================================================

const tileClass = cn("cursor-pointer rounded-lg font-semibold transition-colors", SIZE.tile);
const tileIdle = "bg-slate-50 text-[#1e3a6e] hover:bg-slate-100";
const tileActive = "bg-seg-active text-white shadow-[0_4px_10px_-3px_rgba(13,96,255,0.55)]";

/**
 * App-wide date range picker. `from` / `to` are ISO "yyyy-mm-dd" strings; onChange({ from, to })
 * fires when a preset is picked or the second day of a range is clicked. `compact` is the 256px box (toolbars
 * that must stay on one row): the popup is the same design, but the presets sit in a dropdown above the calendar
 * instead of a column beside it.
 */
export default function DateRangePicker({ from, to, onChange, align = "start", className, compact = false }) {
  const S = SIZE;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("day"); // "day" | "month" | "year"
  const [viewDate, setViewDate] = useState(() => parseIsoDate(to || toIsoDate(new Date())));
  const [anchor, setAnchor] = useState(null); // first clicked day while picking a range
  const [hovered, setHovered] = useState(null);
  const [presetOpen, setPresetOpen] = useState(false); // compact: the preset dropdown above the calendar

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const yearPageStart = Math.floor(year / 12) * 12;
  const todayIso = toIsoDate(new Date());

  const handleOpenChange = (next) => {
    if (next) {
      setView("day");
      setViewDate(parseIsoDate(to || todayIso));
      setAnchor(null);
      setHovered(null);
      setPresetOpen(false);
    }
    setOpen(next);
  };

  const commit = (range) => {
    onChange(range);
    setOpen(false);
  };

  const pickDay = (iso) => {
    if (!anchor) {
      setAnchor(iso);
      return;
    }
    commit(anchor <= iso ? { from: anchor, to: iso } : { from: iso, to: anchor });
  };

  // While picking, preview the range up to the hovered day; otherwise show the applied range.
  const [rangeStart, rangeEnd] = anchor
    ? [anchor, hovered || anchor].sort()
    : [from, to];

  const step = (dir) => {
    if (view === "day") setViewDate(new Date(year, month + dir, 1));
    else if (view === "month") setViewDate(new Date(year + dir, month, 1));
    else setViewDate(new Date(year + dir * 12, month, 1));
  };

  const activePreset = PRESETS.find((p) => {
    const r = presetRange(p);
    return r.from === from && r.to === to;
  });

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn("inline-flex max-w-full cursor-pointer items-stretch overflow-hidden rounded-[10px] border border-slate-400/50 bg-white text-[13px] font-semibold text-[#374151] shadow-[0_2px_8px_rgba(15,23,42,0.06)]", compact ? "w-[256px]" : S.trigger, className)}
        >
          <span className="flex w-9 flex-none items-center justify-center bg-[#3b82f6] text-white">
            <CalendarDays className="size-3.5" strokeWidth={2.2} />
          </span>
          <span className="flex flex-1 items-center px-3 py-1.5 tabular-nums">
            {formatDisplayDate(from)} - {formatDisplayDate(to)}
          </span>
          <span className="flex items-center pr-3 text-slate-400">
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} strokeWidth={2.6} />
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          className={cn(
            "z-50 flex w-(--radix-popover-trigger-width) overflow-hidden rounded-xl border border-dash-line bg-white shadow-[0_12px_32px_-8px_rgba(15,23,42,0.25)]",
            compact && "flex-col"
          )}
        >
          {compact ? (
            // presets: one dropdown above the calendar
            <div className="relative flex-none border-b border-dash-line bg-[#f4f8fe] p-2">
              <button
                type="button"
                aria-expanded={presetOpen}
                onClick={() => setPresetOpen((v) => !v)}
                className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-dash-line bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#1e3a6e]"
              >
                {activePreset?.label ?? "Custom range"}
                <ChevronDown className={cn("size-3.5 transition-transform", presetOpen && "rotate-180")} strokeWidth={2.6} />
              </button>
              {presetOpen && (
                <div className="absolute inset-x-2 top-[calc(100%-4px)] z-10 flex flex-col rounded-[10px] border border-dash-line bg-white p-1 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.25)]">
                  {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => commit(presetRange(preset))}
                    className={cn(
                      "cursor-pointer rounded-lg text-left font-semibold transition-colors",
                      S.presetItem,
                      preset === activePreset ? tileActive : "text-[#1e3a6e] hover:bg-white"
                    )}
                  >
                    {preset.label}
                  </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // presets: the column beside the calendar
            <div className={cn("flex flex-none flex-col border-r border-dash-line bg-[#f4f8fe]", S.presetColumn)}>
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => commit(presetRange(preset))}
                  className={cn(
                    "cursor-pointer rounded-lg text-left font-semibold transition-colors",
                    S.presetItem,
                    preset === activePreset ? tileActive : "text-[#1e3a6e] hover:bg-white"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          {/* calendar */}
          <div className={cn("min-w-0 flex-1", S.calendar)}>
            <div className={cn("flex items-center justify-between", S.header)}>
              <button
                type="button"
                onClick={() => step(-1)}
                className={cn("flex cursor-pointer items-center justify-center rounded-lg text-[#1e3a6e] hover:bg-slate-100", S.navButton)}
                aria-label="Previous"
              >
                <ChevronLeft className="size-4" strokeWidth={2.4} />
              </button>

              <div className="inline-flex overflow-hidden rounded-lg border border-dash-line">
                <button
                  type="button"
                  onClick={() => setView(view === "month" ? "day" : "month")}
                  className={cn(
                    "flex cursor-pointer items-center gap-1 font-bold transition-colors",
                    S.headerButton,
                    view === "month" ? tileActive : "text-[#1d4ed8] hover:bg-slate-50"
                  )}
                >
                  {MONTHS[month]}
                  <ChevronDown className="size-3" strokeWidth={2.6} />
                </button>
                <button
                  type="button"
                  onClick={() => setView(view === "year" ? "day" : "year")}
                  className={cn(
                    "flex cursor-pointer items-center gap-1 border-l border-dash-line font-bold transition-colors",
                    S.headerButton,
                    view === "year" ? tileActive : "text-[#1e3a6e] hover:bg-slate-50"
                  )}
                >
                  {year}
                  <ChevronDown className="size-3" strokeWidth={2.6} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => step(1)}
                className={cn("flex cursor-pointer items-center justify-center rounded-lg text-[#1e3a6e] hover:bg-slate-100", S.navButton)}
                aria-label="Next"
              >
                <ChevronRight className="size-4" strokeWidth={2.4} />
              </button>
            </div>

            {view === "day" && (
              <div className={cn("grid grid-cols-7 text-center", S.dayRowGap)} onMouseLeave={() => setHovered(null)}>
                {WEEKDAYS.map((d) => (
                  <span key={d} className={cn("font-semibold text-dash-sub", S.weekday)}>
                    {d}
                  </span>
                ))}
                {monthGrid(year, month).map((date, i) => {
                  const iso = toIsoDate(date);
                  const col = i % 7;
                  const outside = date.getMonth() !== month;
                  const isStart = iso === rangeStart;
                  const isEnd = iso === rangeEnd;
                  const isEdge = isStart || isEnd;
                  const hasSpan = rangeStart && rangeEnd && rangeStart !== rangeEnd;
                  const inRange = hasSpan && iso > rangeStart && iso < rangeEnd;
                  const isToday = iso === todayIso;
                  return (
                    // The light band sits behind the day buttons and joins them into one continuous
                    // strip; it rounds off at the start/end day and at each week's first/last column.
                    <div key={iso} className="relative flex justify-center">
                      {(inRange || (hasSpan && isEdge)) && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute inset-y-0 bg-[#e8f0fe]",
                            isStart && !isEnd ? "right-0 left-1/2" : isEnd && !isStart ? "right-1/2 left-0" : "inset-x-0",
                            inRange && col === 0 && "left-0.5 rounded-l-lg",
                            inRange && col === 6 && "right-0.5 rounded-r-lg",
                            isStart && col === 6 && "hidden",
                            isEnd && col === 0 && "hidden"
                          )}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => pickDay(iso)}
                        onMouseEnter={() => anchor && setHovered(iso)}
                        className={cn(
                          "relative flex cursor-pointer items-center justify-center rounded-lg font-semibold tabular-nums transition-colors",
                          S.dayCell,
                          isEdge
                            ? "bg-seg-active text-white shadow-[0_3px_8px_-2px_rgba(13,96,255,0.6)]"
                            : inRange
                              ? outside
                                ? "text-[#1d4ed8]/45 hover:bg-[#d6e4fd]"
                                : "text-[#1d4ed8] hover:bg-[#d6e4fd]"
                              : outside
                                ? "text-slate-300 hover:bg-slate-50"
                                : "text-dash-ink hover:bg-slate-100",
                          // Today: a thin outline in the same rounded-square shape; a selected day's
                          // solid fill already stands out, so it gets no extra mark.
                          !isEdge && isToday && "font-bold text-[#2563eb] ring-1 ring-[#2563eb]/60 ring-inset"
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
              <div className={cn("grid grid-cols-3", S.tileGap)}>
                {MONTHS.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setViewDate(new Date(year, i, 1));
                      setView("day");
                    }}
                    className={cn(tileClass, i === month ? tileActive : tileIdle)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {view === "year" && (
              <div className={cn("grid grid-cols-3", S.tileGap)}>
                {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setViewDate(new Date(y, month, 1));
                      setView("month");
                    }}
                    className={cn(tileClass, y === year ? tileActive : tileIdle)}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}

            {anchor && view === "day" && (
              <p className="mt-2 text-center text-[11px] font-medium text-dash-faint">Select an end date</p>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
