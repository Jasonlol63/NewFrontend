import { useEffect, useMemo, useRef, useState } from "react";
import { ROW_HEIGHT } from "./DataTable.jsx";

const NO_CHIPS = { showAll: false, showActive: false, showInactive: false };

// How many rows fit in the table body without scrolling, and how tall each one is so a full page
// ends exactly at the bottom: the space left over after whole ROW_HEIGHT rows is shared out
// between them (re-measured when the body resizes).
function useFitRows(ref) {
  const [fit, setFit] = useState({ count: 10, rowHeight: ROW_HEIGHT });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const head = el.querySelector("thead")?.getBoundingClientRect().height ?? 40;
      const space = el.clientHeight - head;
      const count = Math.max(3, Math.floor(space / ROW_HEIGHT));
      const rowHeight = Math.max(ROW_HEIGHT, space / count);
      setFit((f) => (f.count === count && f.rowHeight === rowHeight ? f : { count, rowHeight }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return fit;
}

/**
 * Search / status chips / sort / paging / selection state of a list page.
 *  - filter(rows, { search, ...chips }) and sort(rows, key, dir) come from the page's rules.
 *  - Paging fits the table height ("Show All" turns it off and the table scrolls instead).
 *  - `selected` holds row ids; only rows that pass `canSelect` and are still listed count.
 * Spread `table` into <DataTable> and use the rest for the toolbar.
 */
export function useListView(rows, { filter, sort: sortRowsBy, canSelect }) {
  const [search, setSearchState] = useState("");
  const [chips, setChips] = useState(NO_CHIPS);
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());
  const bodyRef = useRef(null);
  const { count: pageSize, rowHeight } = useFitRows(bodyRef);

  const visible = useMemo(
    () => sortRowsBy(filter(rows, { search, ...chips }), sort.key, sort.dir),
    [rows, search, chips, sort, filter, sortRowsBy]
  );

  const paged = !chips.showAll;
  const pageCount = paged ? Math.max(1, Math.ceil(visible.length / pageSize)) : 1;
  const currentPage = Math.min(page, pageCount);
  const offset = paged ? (currentPage - 1) * pageSize : 0;
  const pageRows = paged ? visible.slice(offset, offset + pageSize) : visible;
  const selectedRows = visible.filter((r) => canSelect(r) && selected.has(r.id));

  const reset = () => {
    setPage(1);
    setSelected(new Set());
  };

  return {
    search,
    setSearch: (value) => {
      setSearchState(value);
      setPage(1);
    },
    chips,
    setChip: (key, value) => {
      setChips((c) => ({ ...c, [key]: value }));
      reset();
    },
    selectedRows,
    clearSelection: () => setSelected(new Set()),
    reset,
    table: {
      bodyRef,
      rows: pageRows,
      offset,
      total: visible.length,
      paged,
      // Paged rows stretch to fill the body; "Show All" scrolls at the plain height.
      rowHeight: paged ? rowHeight : ROW_HEIGHT,
      pageFull: paged && pageRows.length === pageSize,
      page: currentPage,
      pageCount,
      onPageChange: setPage,
      sort,
      onSortChange: (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 })),
      selected,
      onSelectedChange: setSelected,
      canSelect,
    },
  };
}
