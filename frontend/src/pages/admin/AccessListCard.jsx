import { useMemo, useRef, useState } from "react";
import { Check, Minus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const FILTERS = [
  { value: "all", label: "All", title: "All" },
  { value: "on", label: "Sel", title: "Selected" },
  { value: "off", label: "Unsel", title: "Unselected" },
];

/**
 * One of the Account / Process columns of Add User.
 * Header: [select-all checkbox] Title 12/76 ... [All | Sel | Unsel] [search]
 * The card is a container (@container/card) so the header and the 2- or 3-column grid
 * adapt to the width the column really gets, not to the screen width.
 */
export default function AccessListCard({ title, items, selected, onChange }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [searching, setSearching] = useState(false);
  const searchRef = useRef(null);

  // Rows matching the search; the select-all checkbox acts on these.
  const matched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => `${it.code} ${it.name}`.toLowerCase().includes(q));
  }, [items, query]);

  const shown = filter === "all" ? matched : matched.filter((it) => selected.has(it.id) === (filter === "on"));
  const matchedSelected = matched.filter((it) => selected.has(it.id)).length;
  const allMatched = matched.length > 0 && matchedSelected === matched.length;
  const someMatched = matchedSelected > 0 && !allMatched;

  // onChange is a state setter: update from the latest set so quick clicks don't overwrite each other.
  const toggle = (id) =>
    onChange((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    onChange((prev) => {
      const next = new Set(prev);
      matched.forEach((it) => (allMatched ? next.delete(it.id) : next.add(it.id)));
      return next;
    });

  const openSearch = () => {
    setSearching(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const searchInput = (props) => (
    <label className="flex h-8 min-w-0 items-center gap-2 rounded-[10px] border border-modal-input-line bg-modal-input px-2.5 text-[13px] shadow-[0_1px_3px_rgba(15,23,42,0.05)] focus-within:border-[#3b82f6]">
      <Search className="size-3.5 flex-none text-dash-faint" strokeWidth={2.2} />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full min-w-0 bg-transparent outline-none placeholder:text-dash-faint"
        {...props}
      />
    </label>
  );

  return (
    <section className="@container/card flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-modal-line bg-modal-card">
      <div
        className={cn(
          "relative flex flex-none items-center gap-2 border-b border-modal-divider px-3.5 pb-2.5 pt-3",
          "@min-[900px]/main:@max-[1099px]/main:px-2.5 @min-[900px]/main:@max-[1099px]/main:pb-2 @min-[900px]/main:@max-[1099px]/main:pt-[9px]",
          "modal-compact:px-3 modal-compact:pb-1.5 modal-compact:pt-[7px] modal-tiny:px-2.5 modal-tiny:pb-[5px] modal-tiny:pt-1.5",
          "@max-[380px]/card:gap-1.5 @max-[340px]/card:gap-[5px] @max-[340px]/card:px-2.5"
        )}
      >
        <button
          type="button"
          onClick={toggleAll}
          title={allMatched ? "Clear" : "Select all"}
          aria-label={allMatched ? `Clear ${title}` : `Select all ${title}`}
          className={cn(
            "flex size-[18px] flex-none cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] p-0 transition-colors @max-[340px]/card:size-4 @max-[340px]/card:rounded-[4px]",
            allMatched || someMatched
              ? "border-transparent bg-brand-sweep text-white shadow-[0_3px_8px_-3px_rgba(20,90,220,0.6)]"
              : "border-[#c3d3ea] bg-modal-input hover:border-[#7fb2ff]"
          )}
        >
          {allMatched && <Check className="size-2.5" strokeWidth={4} />}
          {someMatched && <Minus className="size-2.5" strokeWidth={4} />}
        </button>

        <div className="flex min-w-0 flex-none items-baseline gap-1.5 @max-[380px]/card:gap-1">
          <h2 className="m-0 whitespace-nowrap text-[16px] font-extrabold text-brand-navy @min-[900px]/main:@max-[1099px]/main:text-[14.5px] modal-tiny:text-[14px] @max-[380px]/card:text-[14px]">
            {title}
          </h2>
          <Count value={selected.size} total={items.length} />
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-1.5 @max-[380px]/card:gap-[5px] @max-[340px]/card:gap-1">
          <div className="inline-flex gap-0.5 rounded-[9px] bg-[#eaf2ff] p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                title={f.title}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "cursor-pointer whitespace-nowrap rounded-[7px] border-none px-[9px] py-[3px] text-[11.5px] font-bold @max-[380px]/card:px-2 @max-[340px]/card:px-[7px]",
                  filter === f.value
                    ? "bg-brand-sweep text-white shadow-[0_6px_12px_-6px_rgba(20,90,220,0.6)]"
                    : "bg-transparent text-[#5b74a3]"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Only very wide columns keep the search box open; others use the search button. */}
          <div className="hidden w-[170px] min-w-[110px] @min-[620px]/card:block">{searchInput({ placeholder: "Search" })}</div>
          <button
            type="button"
            onClick={openSearch}
            title="Search"
            aria-label={`Search ${title}`}
            className="relative flex size-7 flex-none cursor-pointer items-center justify-center rounded-lg border border-[#cfe0fb] bg-[#eaf2ff] text-brand-navy hover:bg-[#dce9ff] @max-[340px]/card:size-[26px] @min-[620px]/card:hidden"
          >
            <Search className="size-3.5" strokeWidth={2.2} />
            {query && (
              <span className="absolute -right-[3px] -top-[3px] size-2 rounded-full bg-brand-sweep shadow-[0_0_0_2px_#fff]" />
            )}
          </button>
        </div>

        {searching && (
          <div className="absolute inset-0 z-10 flex items-center gap-1.5 rounded-t-2xl bg-modal-card px-3">
            <div className="min-w-0 flex-1">{searchInput({ ref: searchRef, placeholder: `Search ${title.toLowerCase()}` })}</div>
            <button
              type="button"
              onClick={() => setSearching(false)}
              aria-label="Close search"
              className="flex size-7 flex-none cursor-pointer items-center justify-center rounded-lg border border-[#cfe0fb] bg-[#eaf2ff] text-brand-navy hover:bg-[#dce9ff]"
            >
              <X className="size-3.5" strokeWidth={2.2} />
            </button>
          </div>
        )}
      </div>

      {/* 3 cards per row once the column fits ~146px cards (and the screen is 1200+), else 2. */}
      <div
        className={cn(
          "grid min-h-0 flex-1 auto-rows-[44px] grid-cols-2 content-start gap-1.5 overflow-y-auto px-2.5 pb-3 pt-1 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]",
          "nav:@min-[474px]/card:grid-cols-3",
          "@min-[900px]/main:@max-[1099px]/main:auto-rows-[40px] @min-[900px]/main:@max-[1099px]/main:gap-[5px] @min-[900px]/main:@max-[1099px]/main:pb-2.5"
        )}
      >
        {shown.length === 0 ? (
          <div className="col-span-full py-9 text-center text-[13px] text-dash-faint">No matches</div>
        ) : (
          shown.map((it) => <AccessItem key={it.id} item={it} on={selected.has(it.id)} onToggle={() => toggle(it.id)} />)
        )}
      </div>
    </section>
  );
}

function AccessItem({ item, on, onToggle }) {
  // One line each; a code too long for the card ends in "…" and the tooltip shows it in full.
  return (
    <button
      type="button"
      onClick={onToggle}
      title={`${item.code} · ${item.name}`}
      aria-pressed={on}
      className={cn(
        "relative flex h-full min-w-0 cursor-pointer flex-col justify-center gap-px rounded-[9px] border pl-[9px] pr-[22px] text-left transition-colors",
        "@min-[474px]/card:@max-[560px]/card:pl-2 @min-[474px]/card:@max-[560px]/card:pr-[19px]",
        "@min-[900px]/main:@max-[1099px]/main:pl-[7px] @min-[900px]/main:@max-[1099px]/main:pr-[19px] @max-[340px]/card:pl-[7px] @max-[340px]/card:pr-[19px]",
        on ? "border-[#7fb2ff] bg-row-stripe" : "border-dash-line bg-white hover:border-[#93c5fd] hover:bg-[#f8fbff]"
      )}
    >
      <span
        className={cn(
          "block truncate text-[12px] font-bold leading-[1.25]",
          "@min-[474px]/card:@max-[560px]/card:text-[11.5px] @min-[900px]/main:@max-[1099px]/main:text-[11px] @max-[340px]/card:text-[11px]",
          on ? "text-[#0d60ff]" : "text-[#374151]"
        )}
      >
        {item.code}
      </span>
      <span
        className={cn(
          "block truncate text-[10.5px] font-semibold leading-[1.25] @min-[900px]/main:@max-[1099px]/main:text-[10px] @max-[340px]/card:text-[10px]",
          on ? "text-[#5b74a3]" : "text-dash-faint"
        )}
      >
        {item.name}
      </span>
      {on && (
        <span className="absolute right-[7px] top-1/2 flex size-[11px] -translate-y-1/2 items-center justify-center rounded-full bg-brand-sweep text-white @min-[900px]/main:@max-[1099px]/main:size-[10px]">
          <Check className="size-2" strokeWidth={4} />
        </span>
      )}
    </button>
  );
}

// Small blue "12/76" next to a title (shared with the Permissions heading).
export function Count({ value, total }) {
  return (
    <span className={cn("whitespace-nowrap text-[11px] font-semibold tabular-nums", value ? "text-[#0d60ff]" : "text-[#9cb7ec]")}>
      {value}/{total}
    </span>
  );
}
