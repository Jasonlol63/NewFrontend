import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Smallest body row height; useListView works out how many fit and stretches them to fill the body.
export const ROW_HEIGHT = 38;

const td = "border-b border-[#eef2f7] py-0 pr-3";

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

/**
 * List card: gradient header with sort arrows, striped fixed-height rows, a delete-selection
 * checkbox column, and a footer with the row count and pager.
 * columns: [{ key, label, sortable = true, className (header + cells), cellClassName, render(row, rowNumber) }]
 * Paging / sort / selection props come from useListView's `table`.
 */
export default function DataTable({
  columns,
  rowKey = (row) => row.id,
  noun = "rows",
  loading,
  bodyRef,
  rows,
  offset,
  total,
  paged,
  rowHeight = ROW_HEIGHT,
  pageFull,
  page,
  pageCount,
  onPageChange,
  sort,
  onSortChange,
  selected,
  onSelectedChange,
  canSelect,
}) {
  const selectable = rows.filter(canSelect);
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));
  // The delete-selection column only shows when this page has rows that can be deleted (inactive).
  const showSelect = selectable.length > 0;
  // Without it, the last data column takes over the right-edge padding.
  const edge = (c) => !showSelect && c === columns.length - 1 && "pr-4";

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
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-dash-line bg-white shadow-dash-card transition-opacity",
        loading && "opacity-60"
      )}
    >
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-brand-head text-left text-[13px] font-bold text-white">
              {columns.map((col, i) => {
                const sortable = col.sortable !== false;
                return (
                  <th
                    key={col.key}
                    onClick={sortable ? () => onSortChange(col.key) : undefined}
                    className={cn(
                      "py-2.5 pr-3 whitespace-nowrap",
                      i === 0 && "pl-4",
                      edge(i),
                      col.className,
                      sortable && "cursor-pointer select-none"
                    )}
                  >
                    <span className="inline-flex items-center">
                      {col.label}
                      {sortable && <SortIcon active={sort.key === col.key} dir={sort.dir} />}
                    </span>
                  </th>
                );
              })}
              {showSelect && (
                <th className="w-[44px] py-2.5 pr-4">
                  <input
                    type="checkbox"
                    aria-label="Select all inactive rows on this page"
                    checked={allSelected}
                    onChange={(e) => setMany(selectable, e.target.checked)}
                    className="size-4 cursor-pointer accent-white"
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
                      // Hover swaps in the stripe gradient one step deeper, on blue and white rows alike.
                      isSelected ? "bg-[#c2dcff]" : cn(i % 2 ? "bg-white" : "bg-row-stripe", "hover:bg-row-hover")
                    )}
                  >
                    {columns.map((col, c) => (
                      <td key={col.key} className={cn(td, c === 0 && "pl-4", edge(c), col.className, col.cellClassName)}>
                        {col.render(row, offset + i + 1)}
                      </td>
                    ))}
                    {showSelect && (
                      <td className={cn(td, "pr-4")}>
                        {canSelect(row) && (
                          <input
                            type="checkbox"
                            aria-label="Select row"
                            checked={isSelected}
                            onChange={(e) => setMany([row], e.target.checked)}
                            className="size-4 cursor-pointer accent-[#2563eb]"
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={columns.length + (showSelect ? 1 : 0)} className="py-10 text-center text-dash-faint">
                  {loading ? "Loading…" : `No ${noun} found`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-none items-center justify-between gap-3 border-t border-dash-line px-4 py-2 text-[12px] text-dash-sub">
        <span>{summary}</span>
        {paged && pageCount > 1 && <Pager page={page} pageCount={pageCount} onPageChange={onPageChange} />}
      </div>
    </section>
  );
}
