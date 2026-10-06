import { useEffect, useLayoutEffect, useRef } from "react";
import { Check, ChevronLeft, ChevronRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCellTip } from "./CellTip.jsx";

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

// Soft sky tray used by the cards variant for the pager and the row count.
export const TRAY =
  "border border-[#cfe0fa] bg-[linear-gradient(135deg,#ffffff_0%,#e4efff_100%)] shadow-[0_6px_16px_-8px_rgba(30,80,170,0.4),inset_0_1px_0_rgba(255,255,255,0.95)]";

// The boxed pager grows with the screen height: small on short screens (laptops), medium from 760px,
// full size from 900px. Spelled out in full so Tailwind can see every class.
const BOX_SIZE =
  "h-6 min-w-6 rounded-[7px] px-1.5 text-[11px] [@media(min-height:760px)]:h-7 [@media(min-height:760px)]:min-w-7 [@media(min-height:760px)]:rounded-[8px] [@media(min-height:760px)]:px-2 [@media(min-height:760px)]:text-[12px] [@media(min-height:900px)]:h-[30px] [@media(min-height:900px)]:min-w-[30px] [@media(min-height:900px)]:rounded-[9px] [@media(min-height:900px)]:text-[12.5px]";
const BOX_ICON = "size-3.5 [@media(min-height:760px)]:size-4";
const BOX_TRAY =
  "gap-[2px] rounded-[10px] p-0.5 [@media(min-height:760px)]:gap-[3px] [@media(min-height:760px)]:rounded-xl [@media(min-height:760px)]:p-1";

function Pager({ page, pageCount, onPageChange, boxed }) {
  // boxed (cards variant): the whole pager sits in one rounded-square tray with a soft white-to-sky gradient;
  // the current page is a glowing blue gradient square.
  const btn = boxed
    ? `flex ${BOX_SIZE} cursor-pointer items-center justify-center font-bold text-[#1f3d73] tabular-nums transition-colors hover:bg-white/75 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent`
    : "flex size-7 cursor-pointer items-center justify-center rounded-lg border border-dash-line bg-white hover:bg-slate-50 disabled:cursor-default disabled:opacity-40";
  const current = boxed
    ? `flex ${BOX_SIZE} items-center justify-center bg-[linear-gradient(135deg,#6fc8ff_0%,#2f7bff_55%,#0d60ff_100%)] font-bold text-white tabular-nums shadow-[0_5px_12px_-4px_rgba(13,96,255,0.75),inset_0_1px_0_rgba(255,255,255,0.45)]`
    : "flex size-7 items-center justify-center rounded-lg bg-seg-active font-bold text-white";
  // Current page, its neighbours, the ends, and "…" for gaps.
  const pages = [];
  for (let n = 1; n <= pageCount; n++) {
    if (n === 1 || n === pageCount || Math.abs(n - page) <= 1) pages.push(n);
    else if (pages.at(-1) !== "…") pages.push("…");
  }
  return (
    <div className={boxed ? `flex items-center ${BOX_TRAY} ${TRAY}` : "flex items-center gap-1"}>
      <button type="button" className={btn} disabled={page === 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
        <ChevronLeft className={boxed ? BOX_ICON : "size-4"} />
      </button>
      {pages.map((n, i) =>
        n === "…" ? (
          <span key={`gap-${i}`} className={boxed ? "px-0.5 text-dash-faint" : "px-1 text-dash-faint"}>…</span>
        ) : n === page ? (
          <span key={n} aria-current="page" className={current}>{n}</span>
        ) : (
          <button key={n} type="button" className={btn} onClick={() => onPageChange(n)}>{n}</button>
        )
      )}
      <button type="button" className={btn} disabled={page === pageCount} onClick={() => onPageChange(page + 1)} aria-label="Next page">
        <ChevronRight className={boxed ? BOX_ICON : "size-4"} />
      </button>
    </div>
  );
}

// Narrowest a shrinking column gets besides its header label.
const FIT_MIN = 40;

// fitWidth tables: every column keeps its full text on one line. When that is wider than the card,
// only the `fit` columns give up the difference (longest ones first, never below their header), so the
// table fills the card without a sideways scrollbar and the cut-off text ends in "...".
function fitColumns(body) {
  const table = body.querySelector("table");
  if (!table) return;
  const spans = [...table.querySelectorAll("[data-fit]")];
  // A column with `fitMax` never grows past that many px, even when the card has room.
  spans.forEach((s) => (s.style.maxWidth = s.dataset.fitMax ? `${s.dataset.fitMax}px` : ""));
  if (!spans.length) return;

  table.style.width = "max-content";
  const natural = table.offsetWidth;
  const columns = new Map();
  for (const span of spans) {
    const key = span.dataset.fit;
    const col = columns.get(key) ?? { spans: [], content: 0, max: Infinity, min: FIT_MIN };
    col.spans.push(span);
    col.content = Math.max(col.content, span.scrollWidth);
    if (span.dataset.fitMax) col.max = Number(span.dataset.fitMax);
    columns.set(key, col);
  }
  for (const col of columns.values()) col.width = Math.min(col.content, col.max);
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
  // Water-filling: lower one cap level until the columns above it have given up `take` px in total,
  // so the longest columns are cut first and short ones (Process, Account) stay whole.
  const saved = (level) => list.reduce((sum, c) => sum + Math.max(0, c.width - Math.max(c.min, level)), 0);
  let low = 0;
  let high = Math.max(...list.map((c) => c.width));
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (saved(mid) > take) low = mid;
    else high = mid;
  }
  for (const c of list) {
    const target = Math.min(c.width, Math.max(c.min, high));
    if (target < c.content) c.spans.forEach((s) => (s.style.maxWidth = `${Math.floor(target)}px`));
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

// Cards variant: the row gradient runs across the whole row, so every cell gets the same row-wide
// background size and is shifted left by its own offset; together the cells show one continuous sweep.
function sweepRows(body) {
  const table = body.querySelector("table");
  if (!table) return;
  const size = `${table.offsetWidth}px 100%`;
  body.querySelectorAll("tbody td").forEach((td) => {
    if (td.colSpan > 1) return;
    td.style.backgroundSize = size;
    td.style.backgroundPosition = `${-td.offsetLeft}px 0`;
  });
}

function useRowSweep(enabled, ref, rows) {
  // Before paint, so a new page never shows the cells with mismatched slices ...
  useLayoutEffect(() => {
    if (enabled && ref.current) sweepRows(ref.current);
  }, [enabled, ref, rows]);
  // ... and again once fitWidth has moved the columns (declared after useFitColumns, so it runs after it).
  useEffect(() => {
    const body = ref.current;
    if (!enabled || !body) return undefined;
    const run = () => sweepRows(body);
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
 *  - fitWidth: no sideways scroll; columns marked `fit: true` (`fitMax`: widest, in px, even with room to spare) shrink with "..." only when the row does not fit
 *    the card, and a cut-off cell shows its full text in a hover card. Pair with minWidth="min-w-0".
 *  - minWidth: Tailwind min-width class of the table; narrower than that it scrolls sideways inside the card.
 *  - variant="cards": no frame or header bar; every row is its own white rounded card with a gap between rows
 *    (pass the same gap to useListView's `rowGap`), plain header labels with a colon, and a boxed pager.
 *    Never scrolls: rows that don't fit go to the next page.
 *  - boxedPager: the sky-gradient square pager of the cards variant, on a table-variant list too.
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
  variant = "table",
  boxedPager = false,
}) {
  const cards = variant === "cards";
  // The cell look of a body row. Cards: a sky-blue sweep, white on the left to light blue on the right, runs
  // across the whole row (each cell paints its slice, see useRowSweep) and hover / selected lay a blue tint
  // (--tint, set on the <tr>) over it.
  const cell = cards
    ? "py-0 bg-[linear-gradient(90deg,#ffffff_0%,#e6f0ff_50%,#cfe2fd_100%)] bg-no-repeat shadow-[inset_0_0_0_999px_var(--tint)] first:rounded-l-[12px] last:rounded-r-[12px]"
    : td;
  const localBodyRef = useRef(null);
  const scrollRef = bodyRef ?? localBodyRef;
  useFitColumns(fitWidth, scrollRef, rows);
  useRowSweep(cards, scrollRef, rows);
  const { cellTipHandlers, hideCellTip, cellTip } = useCellTip(fitWidth);
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
        "flex min-h-0 flex-1 flex-col transition-opacity",
        // Frosted glass like the modals: rows are solid, the empty area under them lets the page background through.
        !cards && "overflow-hidden rounded-xl border border-dash-line bg-white/35 shadow-dash-card backdrop-blur-[10px]",
        loading && "opacity-60"
      )}
    >
      <div
        ref={scrollRef}
        onScroll={hideCellTip}
        className={cn(
          "min-h-0 flex-1",
          cards ? "overflow-hidden" : "overflow-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0.18)_100%)]"
        )}
      >
        <table
          className={cn(
            "w-full border-separate text-[13px]",
            // Cards: 8px between rows (and under the header); -mt-2 drops the gap above the header.
            cards ? "-mt-2 border-spacing-x-0 border-spacing-y-2" : "border-spacing-0",
            fitWidth && "max-[1100px]:text-[12px]",
            minWidth
          )}
        >
          <thead className="sticky top-0 z-10">
            <tr
              className={cn(
                "text-left font-bold",
                cards ? "text-[14px] text-brand-navy" : "bg-brand-head text-[13px] text-white",
                fitWidth && "max-[1100px]:text-[12px]"
              )}
            >
              {columns.map((col, i) => {
                const sortable = col.sortable !== false;
                return (
                  <th
                    key={col.key}
                    onClick={sortable ? () => onSortChange(col.key) : undefined}
                    className={cn(
                      "py-2.5 whitespace-nowrap",
                      cards && "bg-[#e4eefc] first:rounded-l-[10px] last:rounded-r-[10px]",
                      pad,
                      i === 0 && "pl-4",
                      edge(i),
                      col.className,
                      sortable && "cursor-pointer select-none"
                    )}
                  >
                    <span data-head={fitWidth && col.fit ? col.key : undefined} className="inline-flex items-center">
                      {col.label}
                      {cards && col.label ? ":" : null}
                      {sortable && <SortIcon active={sort.key === col.key} dir={sort.dir} />}
                    </span>
                  </th>
                );
              })}
              {showSelect && (
                <th className={cn("w-[44px] py-2.5 pr-4", cards && "bg-[#e4eefc] last:rounded-r-[10px]")}>
                  <SelectBox
                    onHeader={!cards}
                    label="Select all inactive rows on this page"
                    checked={headChecked}
                    onChange={(checked) => setMany(selectable, checked)}
                  />
                </th>
              )}
            </tr>
          </thead>
          <tbody {...cellTipHandlers}>
            {rows.length ? (
              rows.map((row, i) => {
                const isSelected = selected.has(row.id);
                return (
                  <tr
                    key={rowKey(row)}
                    style={{ height: rowHeight }}
                    className={cn(
                      "transition-colors",
                      rowClassName?.(row),
                      cards
                        ? cn(
                            "[--tint:transparent] [filter:drop-shadow(0_2px_3px_rgba(15,23,42,0.1))]",
                            isSelected ? "[--tint:rgba(47,111,239,0.2)]" : "hover:[--tint:rgba(47,111,239,0.09)]"
                          )
                        : cn(
                            // A full page ends on the footer line, so the last row drops its own bottom border.
                            pageFull && i === rows.length - 1 && "[&>td]:border-b-0",
                            // Hover swaps in the stripe gradient one step deeper, on blue and white rows alike.
                            isSelected ? "bg-[#c2dcff]" : cn(i % 2 ? "bg-white/90" : "bg-row-stripe", "hover:bg-row-hover")
                          )
                    )}
                  >
                    {columns.map((col, c) => (
                      <td key={col.key} className={cn(cell, pad, c === 0 && "pl-4", edge(c), col.className, col.cellClassName)}>
                        {fitWidth && col.fit ? (
                          <span data-fit={col.key} data-fit-max={col.fitMax} className="block overflow-hidden text-ellipsis whitespace-nowrap">
                            {col.render(row, offset + i + 1)}
                          </span>
                        ) : (
                          col.render(row, offset + i + 1)
                        )}
                      </td>
                    ))}
                    {showSelect && (
                      <td className={cn(cell, "pr-4")}>
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

      <div
        className={cn(
          "flex flex-none items-center justify-between gap-3",
          // Cards: no footer bar; the count and the pager are sky-gradient chips sitting on the page background.
          cards ? "pt-1" : "border-t border-dash-line bg-white/70 px-4 py-2 text-[12px] text-dash-sub"
        )}
      >
        <span className={cards ? `rounded-[10px] px-2.5 py-1 text-[11px] font-medium text-[#33507f] [@media(min-height:760px)]:rounded-xl [@media(min-height:760px)]:px-3 [@media(min-height:760px)]:py-[7px] [@media(min-height:760px)]:text-[12.5px] ${TRAY}` : undefined}>{summary}</span>
        {paged && pageCount > 1 && <Pager page={page} pageCount={pageCount} onPageChange={onPageChange} boxed={cards || boxedPager} />}
      </div>
      {cellTip}
    </section>
  );
}
