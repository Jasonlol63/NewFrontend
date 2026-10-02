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
// tiles: a grid of small tiles with the label only (the hint is the tooltip, the tag a blue dot), for a narrow card.
export function CheckRows({ items, selected, onToggle, boxed, tiles, className }) {
  if (items.length === 0) return <div className="py-4 text-center text-[12px] text-dash-faint">No matches</div>;
  return (
    <div className={cn(tiles ? "grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] content-start gap-[5px] modal-tiny:gap-1" : "flex flex-col gap-0.5", className)}>
      {items.map((it) => {
        const on = selected.has(it.value);
        return (
          <button
            key={it.value}
            type="button"
            role="checkbox"
            aria-checked={on}
            title={tiles ? [it.label, it.hint].filter(Boolean).join(" · ") : undefined}
            onClick={() => onToggle(it.value)}
            className={cn(
              "flex w-full flex-none cursor-pointer items-center rounded-[9px] border text-left text-[13px] transition-colors",
              tiles
                ? "min-h-9 gap-2 px-2 modal-compact:min-h-8 modal-short:min-h-[30px] modal-tiny:min-h-7"
                : "min-h-[34px] gap-2.5 px-2.5 modal-tiny:min-h-[30px]",
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
            <span className={cn("min-w-0 flex-none font-extrabold", it.hint && !tiles ? "w-[72px] truncate" : "flex-1 truncate", on ? "text-brand-navy" : "text-[#374151]")}>
              {it.label}
            </span>
            {it.hint && !tiles && <span className="min-w-0 flex-1 truncate text-[#64748b]">{it.hint}</span>}
            {it.tag &&
              (tiles ? (
                <span aria-label={it.tag} className="size-2 flex-none rounded-full bg-[#1d7bff]" />
              ) : (
                <span className="ml-auto flex-none rounded-[5px] bg-[#dbeafe] px-1.5 py-0.5 text-[9.5px] font-extrabold tracking-[0.4px] text-[#1d4ed8]">
                  {it.tag}
                </span>
              ))}
          </button>
        );
      })}
    </div>
  );
}
