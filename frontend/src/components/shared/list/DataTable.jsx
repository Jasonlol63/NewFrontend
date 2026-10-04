import { useEffect, useRef } from "react";
import { Check, ChevronLeft, ChevronRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// Smallest body row height; useListView works out how many fit and stretches them to fill the body.
export const ROW_HEIGHT = 38;

const td = "border-b border-[#eef2f7] py-0";

/**
 * Delete-selection checkbox, same look as the Add User select-all box.
 * checked: true | false | "mixed". onHeader: white-on-blue variant for the gradient header.
 */
function SelectBox({ checked, onChange, onHeader, label, disabled }) {
  const on = checked === true || checked === "mixed";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(checked !== true)}
      className={cn(
        "flex size-[18px] cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] p-0 align-middle outline-none transition-[background-color,border-color,box-shadow] active:scale-[0.92] motion-reduce:transition-none",
        onHeader
          ? on
            ? "border-white bg-white text-[#0f61ff] shadow-[0_3px_8px_-3px_rgba(6,40,120,0.5)]"
            : "border-white/85 bg-white/20 hover:bg-white/30"
          : on
            ? "border-transparent bg-brand-sweep text-white shadow-[0_3px_8px_-3px_rgba(20,90,220,0.6)]"
            : "border-[#c3d3ea] bg-white hover:border-[#7fb2ff]",
        disabled && "cursor-not-allowed border-[#d5dbe5] bg-[#eef1f6] opacity-70 hover:border-[#d5dbe5] active:scale-100",
        onHeader ? "focus-visible:ring-[3px] focus-visible:ring-white/55" : "focus-visible:ring-[3px] focus-visible:ring-[#3b82f6]/35"
      )}
    >
      {checked === true && <Check className="size-2.5" strokeWidth={4} />}
      {checked === "mixed" && <Minus className="size-2.5" strokeWidth={4} />}
    </button>
  );
}

function SortIcon({ active, dir }) {
  return (
    <span className={cn("ml-1 inline-flex flex-col text-[8px] leading-[5px]", active ? "opacity-100" : "opacity-55")}>
      <span className={active && dir === 1 ? "" : "opacity-40"}>▲</span>
      <span className={active && dir === -1 ? "" : "opacity-40"}>▼</span>
    </span>
  );
}

function Pager({ page, pageCount, onPageChange }) {
  const btn =
    "flex size-7 cursor-pointer items-center justify-center rounded-lg border border-dash-line bg-white hover:bg-slate-50 disabled:cursor-default disabled:opacity-40";
  // Current page, its neighbours, the ends, and "…" for gaps.
  const pages = [];
  for (let n = 1; n <= pageCount; n++) {
    if (n === 1 || n === pageCount || Math.abs(n - page) <= 1) pages.push(n);
    else if (pages.at(-1) !== "…") pages.push("…");
  }
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={btn} disabled={page === 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
        <ChevronLeft className="size-4" />
      </button>
      {pages.map((n, i) =>
        n === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-dash-faint">…</span>
        ) : n === page ? (
          <span key={n} className="flex size-7 items-center justify-center rounded-lg bg-seg-active font-bold text-white">{n}</span>
        ) : (
          <button key={n} type="button" className={btn} onClick={() => onPageChange(n)}>{n}</button>
        )
      )}
      <button type="button" className={btn} disabled={page === pageCount} onClick={() => onPageChange(page + 1)} aria-label="Next page">
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

// Narrowest a shrinking column gets besides its header label.
const FIT_MIN = 40;

// fitWidth tables: every column keeps its full text on one line. When that is wider than the card,
// only the `fit` columns give up the difference (widest ones first, never below their header), so the
// table fills the card without a sideways scrollbar and the cut-off text ends in "...".
function fitColumns(body) {
  const table = body.querySelector("table");
  if (!table) return;
  const spans = [...table.querySelectorAll("[data-fit]")];
  spans.forEach((s) => (s.style.maxWidth = ""));
  if (!spans.length) return;

  table.style.width = "max-content";
  const natural = table.offsetWidth;
  const columns = new Map();
  for (const span of spans) {
    const key = span.dataset.fit;
    const col = columns.get(key) ?? { spans: [], width: 0, min: FIT_MIN };
    col.spans.push(span);
    col.width = Math.max(col.width, span.scrollWidth);
    columns.set(key, col);
  }
  table.querySelectorAll("[data-head]").forEach((label) => {
    const col = columns.get(label.dataset.head);
    if (col) col.min = Math.max(col.min, label.offsetWidth);
  });
  table.style.width = "";

  // 2px of slack so rounding never brings the scrollbar back.
  const deficit = natural - body.clientWidth + 2;
  if (deficit <= 0) return;
  const list = [...columns.values()];
  const room = list.reduce((sum, c) => sum + Math.max(0, c.width - c.min), 0);
  if (!room) return;
  const take = Math.min(deficit, room);
  for (const c of list) {
    const target = c.width - (take * Math.max(0, c.width - c.min)) / room;
    c.spans.forEach((s) => (s.style.maxWidth = `${Math.floor(target)}px`));
  }
}

function useFitColumns(enabled, ref, rows) {
  useEffect(() => {
    const body = ref.current;
    if (!enabled || !body) return undefined;
    const run = () => fitColumns(body);
    run();
    const observer = new ResizeObserver(run);
    observer.observe(body);
    document.fonts?.ready.then(run);
    return () => observer.disconnect();
  }, [enabled, ref, rows]);
}

const NO_SELECTION = new Set();
const NO_SORT = { key: null, dir: 1 };
const noop = () => {};
const never = () => false;

/**
 * List card: gradient header with sort arrows, striped fixed-height rows, a delete-selection
 * checkbox column, and a footer with the row count and pager.
 * columns: [{ key, label, sortable = true, className (header + cells), cellClassName, render(row, rowNumber) }]
 * rowClassName(row) adds classes to a row; lockedSelect(row) shows a disabled checkbox on rows that can't be selected.
 * Paging / sort / selection props come from useListView's `table`; a plain read-only list (the
 * Reports) passes just rows and columns with `sortable: false`, plus:
 *  - totalRow: [{ span = 1, className, content }] cells of a Total row under the last data row.
 *  - emptyMessage: text of the empty state (default "No <noun> found").
 *  - fitWidth: no sideways scroll; columns marked `fit: true` (with optional fullText(row) for the hover title)
 *    shrink with "..." only when the row does not fit the card. Pair with minWidth="min-w-0".
 *  - minWidth: Tailwind min-width class of the table; narrower than that it scrolls sideways inside the card.
 */
export default function DataTable({
  columns,
  rowKey = (row) => row.id,
  noun = "rows",
  loading,
  bodyRef,
  rows,
  offset = 0,
  total = rows.length,
  paged = false,
  rowHeight = ROW_HEIGHT,
  pageFull,
  page = 1,
  pageCount = 1,
  onPageChange = noop,
  sort = NO_SORT,
  onSortChange = noop,
  selected = NO_SELECTION,
  onSelectedChange = noop,
  canSelect = never,
  rowClassName,
  lockedSelect = never,
  totalRow,
  emptyMessage,
  minWidth = "min-w-[980px]",
  fitWidth = false,
}) {
  const localBodyRef = useRef(null);
  const scrollRef = bodyRef ?? localBodyRef;
  useFitColumns(fitWidth, scrollRef, rows);
  const selectable = rows.filter(canSelect);
  const selectedCount = selectable.filter((r) => selected.has(r.id)).length;
  const headChecked = selectedCount === 0 ? false : selectedCount === selectable.length ? true : "mixed";
  // The delete-selection column only shows when this page has rows that can be deleted (inactive).
  const showSelect = selectable.length > 0;
  // Without it, the last data column takes over the right-edge padding.
  const edge = (c) => !showSelect && c === columns.length - 1 && "pr-4";

  // fitWidth tables squeeze the column gaps (and the type a little) on narrower screens.
  const pad = fitWidth ? "pr-2.5 max-[1100px]:pr-2" : "pr-3";

  const setMany = (list, checked) => {
    const next = new Set(selected);
    list.forEach((r) => (checked ? next.add(r.id) : next.delete(r.id)));
    onSelectedChange(next);
  };

  const summary = paged
    ? `Showing ${rows.length ? offset + 1 : 0}–${offset + rows.length} of ${total} ${noun}`
    : `Showing all ${total} ${noun}`;

  return (
    <section
      className={cn(
        // Frosted glass like the modals: rows are solid, the empty area under them lets the page background through.
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-dash-line bg-white/35 shadow-dash-card backdrop-blur-[10px] transition-opacity",
        loading && "opacity-60"
      )}
    >
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0.18)_100%)]">
        <table className={cn("w-full border-separate border-spacing-0 text-[13px]", fitWidth && "max-[1100px]:text-[12px]", minWidth)}>
          <thead className="sticky top-0 z-10">
            <tr className={cn("bg-brand-head text-left text-[13px] font-bold text-white", fitWidth && "max-[1100px]:text-[12px]")}>
              {columns.map((col, i) => {
                const sortable = col.sortable !== false;
                return (
                  <th
                    key={col.key}
                    onClick={sortable ? () => onSortChange(col.key) : undefined}
                    className={cn(
                      "py-2.5 whitespace-nowrap",
                      pad,
                      i === 0 && "pl-4",
                      edge(i),
                      col.className,
                      sortable && "cursor-pointer select-none"
                    )}
                  >
                    <span data-head={fitWidth && col.fit ? col.key : undefined} className="inline-flex items-center">
                      {col.label}
                      {sortable && <SortIcon active={sort.key === col.key} dir={sort.dir} />}
                    </span>
                  </th>
                );
              })}
              {showSelect && (
                <th className="w-[44px] py-2.5 pr-4">
                  <SelectBox
                    onHeader
                    label="Select all inactive rows on this page"
                    checked={headChecked}
                    onChange={(checked) => setMany(selectable, checked)}
                  />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, i) => {
                const isSelected = selected.has(row.id);
                return (
                  <tr
                    key={rowKey(row)}
                    style={{ height: rowHeight }}
                    className={cn(
                      "transition-colors",
                      // A full page ends on the footer line, so the last row drops its own bottom border.
                      pageFull && i === rows.length - 1 && "[&>td]:border-b-0",
                      rowClassName?.(row),
                      // Hover swaps in the stripe gradient one step deeper, on blue and white rows alike.
                      isSelected ? "bg-[#c2dcff]" : cn(i % 2 ? "bg-white/90" : "bg-row-stripe", "hover:bg-row-hover")
                    )}
                  >
                    {columns.map((col, c) => (
                      <td key={col.key} className={cn(td, pad, c === 0 && "pl-4", edge(c), col.className, col.cellClassName)}>
                        {fitWidth && col.fit ? (
                          <span data-fit={col.key} title={col.fullText?.(row)} className="block overflow-hidden text-ellipsis whitespace-nowrap">
                            {col.render(row, offset + i + 1)}
                          </span>
                        ) : (
                          col.render(row, offset + i + 1)
                        )}
                      </td>
                    ))}
                    {showSelect && (
                      <td className={cn(td, "pr-4")}>
                        {canSelect(row) && (
                          <SelectBox label="Select row" checked={isSelected} onChange={(checked) => setMany([row], checked)} />
                        )}
                        {!canSelect(row) && lockedSelect(row) && (
                          <SelectBox disabled label="Already deleted" checked={false} onChange={noop} />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={columns.length + (showSelect ? 1 : 0)} className="py-10 text-center text-dash-faint">
                  {loading ? "Loading…" : (emptyMessage ?? `No ${noun} found`)}
                </td>
              </tr>
            )}
            {rows.length > 0 && totalRow && (
              <tr className="bg-[linear-gradient(180deg,#dcecfd_0%,#c9def8_100%)] font-extrabold">
                {totalRow.map((cell, i) => (
                  <td
                    key={i}
                    colSpan={cell.span ?? 1}
                    className={cn("h-10 border-t-2 border-[#8fbdf5] py-0 pr-3 whitespace-nowrap", i === 0 && "pl-4", cell.className)}
                  >
                    {cell.content}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-none items-center justify-between gap-3 border-t border-dash-line bg-white/70 px-4 py-2 text-[12px] text-dash-sub">
        <span>{summary}</span>
        {paged && pageCount > 1 && <Pager page={page} pageCount={pageCount} onPageChange={onPageChange} />}
      </div>
    </section>
  );
}
