import { useMemo, useState } from "react";
import { Popover } from "radix-ui";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Single-choice dropdown that looks like the DateRangePicker box. options: [{ value, label }].
 * `searchable` adds a search box on top of the list (Enter picks the first match).
 */
export default function DropdownSelect({
  options,
  value,
  onChange,
  placeholder = "Select",
  searchable = false,
  searchPlaceholder = "Search",
  className = "w-[250px]",
  ariaLabel,
  clearable = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const pick = (option) => {
    onChange(option.value);
    setOpen(false);
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setQuery("");
        setOpen(next);
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "inline-flex max-w-full cursor-pointer items-center justify-between gap-2 rounded-[10px] border border-slate-400/50 bg-white px-3 py-[7px] text-left text-[13px] font-semibold text-[#374151] shadow-[0_2px_8px_rgba(15,23,42,0.06)]",
            className
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate", !selected && "text-dash-faint")}>{selected?.label ?? placeholder}</span>
          {clearable && selected && (
            // A span, not a button: it sits inside the trigger button. Clicking it empties the choice (onChange(null)) without opening the list.
            <span
              role="button"
              tabIndex={0}
              aria-label={`Clear ${ariaLabel ?? "selection"}`}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  onChange(null);
                }
              }}
              className="-mr-0.5 flex size-[18px] flex-none items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-dash-down focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40 focus-visible:outline-none"
            >
              <X className="size-3" strokeWidth={2.6} />
            </span>
          )}
          <ChevronDown className={cn("size-3.5 flex-none text-slate-400 transition-transform", open && "rotate-180")} strokeWidth={2.6} />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-(--radix-popover-trigger-width) min-w-[200px] overflow-hidden rounded-xl border border-dash-line bg-white shadow-[0_12px_32px_-8px_rgba(15,23,42,0.25)]"
        >
          {searchable && (
            <label className="flex items-center gap-2 border-b border-dash-line px-3 py-2">
              <Search className="size-3.5 flex-none text-dash-faint" strokeWidth={2.2} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && shown[0]) pick(shown[0]);
                }}
                placeholder={searchPlaceholder}
                autoComplete="off"
                className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-dash-faint"
              />
            </label>
          )}
          <div className="max-h-[260px] overflow-y-auto p-1">
            {shown.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => pick(option)}
                className={cn(
                  "block w-full cursor-pointer truncate rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-semibold transition-colors",
                  option.value === value
                    ? "bg-seg-active text-white shadow-[0_4px_10px_-3px_rgba(13,96,255,0.55)]"
                    : "text-[#1e3a6e] hover:bg-slate-100"
                )}
              >
                {option.label}
              </button>
            ))}
            {shown.length === 0 && <p className="px-2.5 py-2 text-center text-[12px] text-dash-faint">No results found</p>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
