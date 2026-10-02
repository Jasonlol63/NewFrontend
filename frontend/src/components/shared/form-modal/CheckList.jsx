import { Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Search box + Select all / Clear + a list of tickable rows. Used inside the multi-select
 * dropdown and as a card body of its own (Company on wide screens), so both look the same.
 * items: [{ value, label, hint?, tag? }]; selected: Set of values; onChange(nextSet).
 */
export function CheckListTools({ query, onQuery, onSelectAll, onClear, placeholder = "Search", className }) {
  return (
    <div className={cn("flex flex-none items-center gap-1.5", className)}>
      <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[9px] border border-modal-input-line bg-modal-input px-2.5 text-[12.5px] focus-within:border-[#3b82f6] modal-tiny:h-7">
        <Search className="size-3.5 flex-none text-dash-faint" strokeWidth={2.2} />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full min-w-0 bg-transparent text-[#111827] outline-none placeholder:text-dash-faint"
        />
      </label>
      <ListLink onClick={onSelectAll}>Select all</ListLink>
      <ListLink onClick={onClear} muted>
        Clear
      </ListLink>
    </div>
  );
}

function ListLink({ muted, className, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "flex-none cursor-pointer whitespace-nowrap rounded-md border-none bg-transparent px-1.5 py-1 text-[12px] font-bold hover:bg-[#eef4ff]",
        muted ? "text-[#64748b]" : "text-[#1d7bff]",
        className
      )}
      {...props}
    />
  );
}

// boxed: rows on the glass card (Company box) get a light frame; in the white popup they stay flat.
export function CheckRows({ items, selected, onToggle, boxed, className }) {
  if (items.length === 0) return <div className="py-4 text-center text-[12px] text-dash-faint">No matches</div>;
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {items.map((it) => {
        const on = selected.has(it.value);
        return (
          <button
            key={it.value}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => onToggle(it.value)}
            className={cn(
              "flex min-h-[34px] w-full flex-none cursor-pointer items-center gap-2.5 rounded-[9px] border px-2.5 text-left text-[13px] transition-colors modal-tiny:min-h-[30px]",
              on
                ? "border-[#bfd8ff] bg-row-stripe"
                : boxed
                  ? "border-white/55 bg-white/35 hover:bg-white/75"
                  : "border-transparent bg-transparent hover:bg-[#f4f8fe]"
            )}
          >
            <span
              className={cn(
                "flex size-4 flex-none items-center justify-center rounded-[5px] border-[1.5px] text-white",
                on ? "border-transparent bg-brand-sweep" : "border-[#cbd5e1] bg-white"
              )}
            >
              {on && <Check className="size-2.5" strokeWidth={4} />}
            </span>
            <span className={cn("min-w-0 flex-none font-extrabold", it.hint ? "w-[72px] truncate" : "flex-1 truncate", on ? "text-brand-navy" : "text-[#374151]")}>
              {it.label}
            </span>
            {it.hint && <span className="min-w-0 flex-1 truncate text-[#64748b]">{it.hint}</span>}
            {it.tag && (
              <span className="ml-auto flex-none rounded-[5px] bg-[#dbeafe] px-1.5 py-0.5 text-[9.5px] font-extrabold tracking-[0.4px] text-[#1d4ed8]">
                {it.tag}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
