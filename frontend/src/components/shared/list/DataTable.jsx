import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Square, SquareCheck, SquareMinus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCellTip } from "./CellTip.jsx";

// Smallest body row height; useListView works out how many fit and stretches them to fill the body.
export const ROW_HEIGHT = 38;

const td = "border-b border-[#eef2f7] py-0";

/**
 * Delete-selection checkbox: a soft blue line icon like the Action icons (an empty square, a ticked square, a dashed one
 * for "some"). checked: true | false | "mixed". onHeader: the white variant for the gradient header.
 */
export function SelectBox({ checked, onChange, onHeader, label, disabled, className }) {
  const Icon = checked === true ? SquareCheck : checked === "mixed" ? SquareMinus : Square;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(checked !== true)}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2 enabled:cursor-pointer disabled:cursor-not-allowed motion-reduce:transition-none",
        onHeader
          ? cn(checked ? "text-white" : "text-white/75", "enabled:hover:bg-white/20 enabled:hover:text-white focus-visible:ring-white/55")
          : cn(checked ? "text-[#2563eb]" : "text-[#8fb0e8]", "enabled:hover:bg-[#e8f1ff] enabled:hover:text-[#2563eb] focus-visible:ring-[#3b82f6]/35"),
        disabled && !onHeader && "text-[#cbd5e1]",
        className
      )}
    >
      <Icon className="size-4" strokeWidth={2.1} />
    </button>
  );
}

// overlay: the arrows sit in the gap after the label instead of widening the column.
function SortIcon({ active, dir, overlay }) {
  return (
    <span className={cn("inline-flex flex-col text-[8px] leading-[5px]", overlay ? "absolute left-full ml-px" : "ml-1", active ? "opacity-100" : "opacity-55")}>
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
  "h-6 min-w-6 rounded-[7px] px-1.5 type-caption font-semibold! [@media(min-height:760px)]:h-7 [@media(min-height:760px)]:min-w-7 [@media(min-height:760px)]:rounded-[8px] [@media(min-height:760px)]:px-2 [@media(min-height:900px)]:h-[30px] [@media(min-height:900px)]:min-w-[30px] [@media(min-height:900px)]:rounded-[9px]";
const BOX_ICON = "size-3.5 [@media(min-height:760px)]:size-4";
const BOX_TRAY =
  "gap-[2px] rounded-[10px] p-0.5 [@media(min-height:760px)]:gap-[3px] [@media(min-height:760px)]:rounded-xl [@media(min-height:760px)]:p-1";

function Pager({ page, pageCount, onPageChange, boxed }) {
  const { t } = useTranslation();
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
      <button type="button" className={btn} disabled={page === 1} onClick={() => onPageChange(page - 1)} aria-label={t("table.previous")}>
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
      <button type="button" className={btn} disabled={page === pageCount} onClick={() => onPageChange(page + 1)} aria-label={t("table.next")}>
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
// Returns the narrowest width the table can get to (columns at their minimum), which useFoldColumns
// compares with the card to decide how many columns to fold away.
function fitColumns(body) {
  const table = body.querySelector("table");
  if (!table) return 0;
  const spans = [...table.querySelectorAll("[data-fit]")];
  // A column with `fitMax` never grows past that many px, even when the card has room.
  spans.forEach((s) => (s.style.maxWidth = s.dataset.fitMax ? `${s.dataset.fitMax}px` : ""));

  table.style.width = "max-content";
  const natural = table.offsetWidth;
  const columns = new Map();
  for (const span of spans) {
    const key = span.dataset.fit;
    const col = columns.get(key) ?? { spans: [], content: 0, max: Infinity, min: FIT_MIN };
    col.spans.push(span);
    col.content = Math.max(col.content, span.scrollWidth);
    if (span.dataset.fitMax) col.max = Number(span.dataset.fitMax);
    if (span.dataset.fitMin) col.min = Math.max(col.min, Number(span.dataset.fitMin));
    columns.set(key, col);
  }
  for (const col of columns.values()) col.width = Math.min(col.content, col.max);
  table.querySelectorAll("[data-head]").forEach((label) => {
    const col = columns.get(label.dataset.head);
    if (col) col.min = Math.max(col.min, label.offsetWidth);
  });
  table.style.width = "";

  const list = [...columns.values()];
  const room = list.reduce((sum, c) => sum + Math.max(0, c.width - c.min), 0);
  const needed = natural - room;
  // 2px of slack so rounding never brings the scrollbar back.
  const deficit = natural - body.clientWidth + 2;
  if (deficit <= 0 || !room) return needed;
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
  return needed;
}

// `layoutKey` re-runs the fit when the shown columns change; onFit(needed, available) reports the result.
function useFitColumns(enabled, ref, rows, layoutKey, onFit) {
  const onFitRef = useRef(onFit);
  useLayoutEffect(() => {
    onFitRef.current = onFit;
  });
  useEffect(() => {
    const body = ref.current;
    if (!enabled || !body) return undefined;
    const run = () => onFitRef.current?.(fitColumns(body), body.clientWidth);
    run();
    const observer = new ResizeObserver(run);
    observer.observe(body);
    document.fonts?.ready.then(run);
    return () => observer.disconnect();
  }, [enabled, ref, rows, layoutKey]);
}

// altColumns: a second, more compact set of columns (e.g. two-line cells). The table starts with `columns`; when
// even after squeezing the `fit` columns they would not fit, it switches to `altColumns`, and switches back once the
// card is as wide as the first layout needed. It follows the measured width instead of fixed breakpoints, so there is
// no in-between size that scrolls sideways. onChange(isAlt) tells the page, e.g. to give two-line rows more height.
function useAltColumns(columns, altColumns, onChange) {
  const [alt, setAlt] = useState(false);
  const needed = useRef(0);
  // The layout the table was last drawn in, so a measurement is always applied to the layout it was taken from
  // (several measurements can arrive before React redraws).
  const drawn = useRef(false);
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    drawn.current = alt;
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    onChangeRef.current?.(alt);
  }, [alt]);
  const onFit = useCallback(
    (need, available) => {
      if (!altColumns) return;
      if (!drawn.current && need > available) {
        needed.current = need;
        setAlt(true);
      } else if (drawn.current && available >= needed.current) {
        setAlt(false);
      }
    },
    [altColumns]
  );
  return { cols: alt && altColumns ? altColumns : columns, alt: Boolean(alt && altColumns), onFit };
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

// Rows kept above and below the visible ones when the list is windowed (virtual).
const OVERSCAN = 12;
// The window only moves in steps of this many rows, so scrolling does not redraw on every row.
const WINDOW_STEP = 10;
// Start loading the next batch when this many rows are left below the viewport.
const LOAD_AHEAD = 30;

// Fixed-height rows, so which rows are on screen follows from scrollTop alone. Only those rows are drawn
// (spacer rows stand in for the rest), however many have been loaded. Also asks for the next batch near the bottom.
function useRowWindow({ enabled, ref, rowHeight, rowCount, hasMore, loadingMore, onLoadMore, resetKey }) {
  const [win, setWin] = useState({ start: 0, end: 60 });
  const more = useRef({ hasMore, loadingMore, onLoadMore });
  useLayoutEffect(() => {
    more.current = { hasMore, loadingMore, onLoadMore };
  });
  const update = useCallback(() => {
    const body = ref.current;
    if (!enabled || !body) return;
    const first = Math.floor(body.scrollTop / rowHeight);
    const visible = Math.ceil(body.clientHeight / rowHeight);
    const start = Math.max(0, Math.floor(first / WINDOW_STEP) * WINDOW_STEP - OVERSCAN);
    const end = start + visible + 2 * OVERSCAN + WINDOW_STEP;
    setWin((w) => (w.start === start && w.end === end ? w : { start, end }));
    const left = body.scrollHeight - body.scrollTop - body.clientHeight;
    if (more.current.hasMore && !more.current.loadingMore && left < LOAD_AHEAD * rowHeight) more.current.onLoadMore?.();
  }, [enabled, ref, rowHeight]);

  // A different list (new filters): back to the top.
  useLayoutEffect(() => {
    if (enabled && ref.current) ref.current.scrollTop = 0;
  }, [enabled, ref, resetKey]);
  // Rows or loading state changed, or the card was resized: recompute (this also loads more when the first batch
  // does not fill the card).
  useEffect(() => {
    const body = ref.current;
    if (!enabled || !body) return undefined;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(body);
    return () => observer.disconnect();
  }, [enabled, ref, update, rowCount, hasMore, loadingMore]);
  return { win, update };
}

// A virtual list only draws the rows near the viewport, so with automatic column widths the columns would be re-measured
// from a different set of rows on every scroll step and the whole table would shift sideways. This measures the columns
// once (after the first rows are drawn and the fit has run), then freezes them: the table gets a <colgroup> and a fixed
// layout. It measures again when the card is resized, the columns change or the list is reset (new filters).
const FROZEN_MIN_FIT = 48;
const FROZEN_CELL_PAD = 14;
function useFrozenColumns(enabled, ref, key, ready, fitWidth) {
  const [widths, setWidths] = useState(null);
  useLayoutEffect(() => {
    setWidths(null);
  }, [key]);
  useEffect(() => {
    const body = ref.current;
    if (!enabled || !body) return undefined;
    let last = body.clientWidth;
    const observer = new ResizeObserver(() => {
      if (Math.abs(body.clientWidth - last) < 1) return;
      last = body.clientWidth;
      setWidths(null);
    });
    observer.observe(body);
    return () => observer.disconnect();
  }, [enabled, ref]);
  // After every render until frozen: once rows are in, take the widths the automatic layout gave the header cells.
  useLayoutEffect(() => {
    if (!enabled || !ready || widths) return;
    const body = ref.current;
    const table = body?.querySelector("table");
    const heads = table && [...table.querySelectorAll("thead th")];
    if (!heads?.length) return;
    // Natural widths (as narrow as the content allows) ...
    const before = table.style.width;
    table.style.width = "max-content";
    const natural = heads.map((h) => Math.ceil(h.getBoundingClientRect().width) + 1);
    table.style.width = before;
    // ... then the room that is left is shared by every column in proportion to its natural width, exactly as the
    // browser's own layout does while the list is empty — except columns with an explicit width class (No., the select
    // column), which keep it. That way the columns do not jump when the first rows arrive.
    // A column with fitMax never gets wider than that many px (plus its cell padding), even when the card has room.
    const maxes = new Map();
    table.querySelectorAll("tbody span[data-fit-max]").forEach((s) => maxes.set(s.dataset.fit, Number(s.dataset.fitMax)));
    const keyOf = (h) => h.querySelector("[data-head]")?.dataset.head;
    heads.forEach((h, i) => {
      const max = maxes.get(keyOf(h));
      if (max) natural[i] = Math.min(natural[i], max + FROZEN_CELL_PAD);
    });
    const extra = body.clientWidth - natural.reduce((a, b) => a + b, 0);
    let out = natural;
    if (extra > 1) {
      const fixed = heads.map((h) => /w-\[[\d.]+px\]/.test(h.className));
      // `grow` (th data-grow) weighs how much of the spare room a column takes: 1 by default.
      const grow = heads.map((h) => (maxes.has(keyOf(h)) ? 0 : Number(h.dataset.grow ?? 1)));
      const targets = fixed.some((f, i) => !f && grow[i] > 0) ? fixed.map((f, i) => !f && grow[i] > 0) : fixed.map(() => true);
      const weight = (w, i) => w * (grow[i] || 1);
      const base = natural.reduce((sum, w, i) => (targets[i] ? sum + weight(w, i) : sum), 0);
      out = natural.map((w, i) => (targets[i] ? w + extra * (weight(w, i) / base) : w));
    } else if (extra < -1 && fitWidth) {
      // Too wide for the card: the `fit` columns give way (their cells are cut with "..."), so there is no sideways scroll.
      const shrinkable = heads.map((h) => Boolean(h.querySelector("[data-head]")));
      const room = natural.reduce((sum, w, i) => (shrinkable[i] ? sum + Math.max(0, w - FROZEN_MIN_FIT) : sum), 0);
      if (room > 0) {
        const cut = Math.min(-extra, room);
        out = natural.map((w, i) => (shrinkable[i] ? w - cut * (Math.max(0, w - FROZEN_MIN_FIT) / room) : w));
      }
    }
    setWidths(out);
  });
  return enabled ? widths : null;
}

// A few rows that stand for the whole list when the columns are measured: per column the two longest values and every
// different value (up to 8, so each role / status badge is in it), plus the rows with the most text overall. So the widths
// come from the whole list, not from the page that happens to be shown.
function measureSample(rows, cols) {
  if (!rows?.length) return [];
  const size = (v) => (v == null ? 0 : Array.isArray(v) ? v.length * 4 : typeof v === "object" ? 0 : String(v).length);
  const picked = new Set();
  for (const col of cols) {
    [...rows].sort((a, b) => size(b[col.key]) - size(a[col.key])).slice(0, 2).forEach((r) => picked.add(r));
    const seen = new Set();
    for (const r of rows) {
      const v = r[col.key];
      if (typeof v === "object" && v !== null) continue;
      const k = String(v);
      if (seen.has(k) || seen.size >= 8) continue;
      seen.add(k);
      picked.add(r);
    }
  }
  const total = (r) => Object.values(r).reduce((sum, v) => sum + size(v), 0);
  [...rows].sort((a, b) => total(b) - total(a)).slice(0, 12).forEach((r) => picked.add(r));
  return [...picked];
}

// What a hidden measuring table says about its columns: the width each needs, which of them are text (`fit`) or fixed, and
// the narrowest a text column may get (its header, or its fitMin).
function readLayout(table) {
  const heads = table ? [...table.querySelectorAll("thead th")] : [];
  if (!heads.length) return null;
  const natural = heads.map((h) => Math.ceil(h.getBoundingClientRect().width) + 1);
  const label = heads.map((h) => (h.querySelector("[data-head]")?.getBoundingClientRect().width ?? 0) + 20);
  return {
    natural,
    fit: heads.map((h) => h.dataset.fit === "1"),
    fixed: heads.map((h) => Boolean(h.dataset.fixed)),
    mins: heads.map((h, i) => Math.min(natural[i], Math.max(FIT_MIN, Number(h.dataset.fitmin) || 0, label[i]))),
    sum: natural.reduce((a, b) => a + b, 0),
  };
}

// The narrowest the layout can get by shortening its text columns (the others keep their width).
function narrowest(layout) {
  return layout.natural.reduce((acc, w, i) => acc + (layout.fit[i] ? layout.mins[i] : w), 0);
}

// Whole-pixel column widths for a card `room` px wide. Spare room is shared by every column without a fixed width (text
// columns count 1.5x); too little room is taken from the text columns only, longest first, never below their minimum.
function spreadWidths(layout, room) {
  const { natural, fit, fixed, mins, sum } = layout;
  let out = natural.slice();
  if (sum < room) {
    const weight = natural.map((w, i) => (fixed[i] ? 0 : w * (fit[i] ? 1.5 : 1)));
    const total = weight.reduce((acc, w) => acc + w, 0) || 1;
    out = natural.map((w, i) => w + ((room - sum) * weight[i]) / total);
  } else if (sum > room) {
    const give = (level) => natural.reduce((acc, w, i) => (fit[i] ? acc + Math.max(0, w - Math.max(mins[i], level)) : acc), 0);
    const take = Math.min(sum - room, give(0));
    let low = 0;
    let high = Math.max(...natural);
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      if (give(mid) > take) low = mid;
      else high = mid;
    }
    out = natural.map((w, i) => (fit[i] ? Math.min(w, Math.max(mins[i], high)) : w));
  }
  const whole = out.map((w) => Math.ceil(w));
  const over = whole.reduce((acc, w) => acc + w, 0) - room;
  // A pixel too many (rounding up) is taken from the widest text column, never from a column that needs it.
  const widest = whole.map((w, i) => (fit[i] ? i : -1)).filter((i) => i >= 0).sort((x, y) => whole[y] - whole[x])[0];
  if (over > 0 && widest !== undefined) whole[widest] -= Math.min(over, Math.max(0, whole[widest] - mins[widest]));
  return whole;
}

// Paged lists: the column widths come from the whole list (see measureSample), not from the rows of the page, and stay the
// same while paging, so the header never moves. The natural widths are read from hidden copies of the table (one for
// `columns`, one for `altColumns`). `columns` is used while its text columns can shrink far enough to fit the card (the
// text that is cut ends in "..." with the full text in the hover card); only when even that is not enough the compact
// `altColumns` take over.
function useStableColumns(enabled, ref, measureRef, altMeasureRef, key, ready) {
  const [state, setState] = useState(null);
  const compute = useCallback(() => {
    const body = ref.current;
    const first = readLayout(measureRef.current);
    if (!body || !first) return;
    const second = readLayout(altMeasureRef.current);
    const room = body.clientWidth;
    // The normal layout stays while its text columns can give up enough room (their cut text shows in the hover card);
    // the compact one only comes in when even that is not enough.
    const alt = Boolean(second) && narrowest(first) > room;
    setState({ alt, widths: spreadWidths(alt ? second : first, room) });
  }, [ref, measureRef, altMeasureRef]);
  useLayoutEffect(() => {
    setState(null);
  }, [key]);
  useLayoutEffect(() => {
    if (enabled && ready && !state) compute();
  });
  useEffect(() => {
    const body = ref.current;
    if (!enabled || !body) return undefined;
    let last = body.clientWidth;
    const observer = new ResizeObserver(() => {
      if (Math.abs(body.clientWidth - last) < 1) return;
      last = body.clientWidth;
      setState(null);
    });
    observer.observe(body);
    document.fonts?.ready.then(() => setState(null));
    return () => observer.disconnect();
  }, [enabled, ref]);
  return enabled ? state : null;
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
 *  - dense: table cell type (13 / 500) with a 13 / 600 head (14px from 1600px wide), 8px between columns and sort arrows that do not widen the headers, at every width, for lists with many columns.
 *  - altColumns / onAltChange: a more compact set of columns the table switches to when `columns` would not fit even
 *    after the `fit` columns shrink (`fitMin`: narrowest, in px). onAltChange(true | false) reports the switch.
 *  - selectColumn={false}: no checkbox column; the page puts SelectBox where it wants (e.g. in its Action column).
 *  - minWidth: Tailwind min-width class of the table; narrower than that it scrolls sideways inside the card.
 *  - variant="cards": no frame or header bar; every row is its own white rounded card with a gap between rows
 *    (pass the same gap to useListView's `rowGap`), plain header labels with a colon, and a boxed pager.
 *    Never scrolls: rows that don't fit go to the next page.
 *  - boxedPager: the sky-gradient square pager of the cards variant, on a table-variant list too.
 *  - onRowClick(row): the whole row is clickable (Audit Log opens the detail panel).
 *  - virtual: a long list that loads in batches and scrolls to the end (no pager). Rows must be rowHeight tall; only the rows
 *    on screen are drawn. hasMore / loadingMore / onLoadMore load the next batch near the bottom; `total` is the full count
 *    (the footer reads "Showing N of total" while more is coming); scrollResetKey scrolls back to the top when it changes.
 *    Select-all covers the rows loaded so far.
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
  dense = false,
  altColumns,
  onAltChange,
  selectColumn = true,
  variant = "table",
  boxedPager = false,
  virtual = false,
  stableColumns = false,
  measureRows,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  scrollResetKey,
  onRowClick,
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
  const stable = stableColumns && !virtual && !cards && Boolean(measureRows);
  const measureRef = useRef(null);
  const altMeasureRef = useRef(null);
  const colSig = [...columns, ...(altColumns ?? [])].map((c) => `${c.key}${c.fit ? "*" : ""}`).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sample = useMemo(() => (stable ? measureSample(measureRows, [...columns, ...(altColumns ?? [])]) : []), [stable, measureRows, colSig]);
  const stableKey = `${colSig}|${selectColumn}|${measureRows?.length}|${sample.map((r) => r.id).join(",")}`;
  const stableState = useStableColumns(stable, scrollRef, measureRef, altMeasureRef, stableKey, rows.length > 0);
  const stableWidths = stableState?.widths ?? null;
  const lastAlt = useRef(false);
  const stableAlt = stableState ? stableState.alt : lastAlt.current;
  useEffect(() => {
    lastAlt.current = stableAlt;
  }, [stableAlt]);
  const layout = useAltColumns(columns, fitWidth && !stable ? altColumns : undefined, onAltChange);
  const cols = stable && altColumns ? (stableAlt ? altColumns : columns) : layout.cols;
  const { win, update: updateWindow } = useRowWindow({
    enabled: virtual,
    ref: scrollRef,
    rowHeight,
    rowCount: rows.length,
    hasMore,
    loadingMore,
    onLoadMore,
    resetKey: scrollResetKey,
  });
  const winStart = virtual ? Math.min(win.start, Math.max(0, rows.length - 1)) : 0;
  const winEnd = virtual ? Math.min(win.end, rows.length) : rows.length;
  const shown = useMemo(() => (virtual ? rows.slice(winStart, winEnd) : rows), [virtual, rows, winStart, winEnd]);
  useFitColumns(fitWidth && !stable, scrollRef, shown, layout.alt, layout.onFit);
  // Tells the page which of the two column sets is drawn (e.g. to give two-line rows more height).
  useEffect(() => {
    if (stable && altColumns) onAltChange?.(stableAlt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stable, stableAlt]);
  const virtualFrozen = useFrozenColumns(virtual, scrollRef, `${cols.map((c) => c.key).join("|")}|${selectColumn}|${scrollResetKey}|${String(total).length}`, rows.length > 0, fitWidth);
  const frozen = virtualFrozen ?? stableWidths;
  useRowSweep(cards, scrollRef, rows);
  const { cellTipHandlers, hideCellTip, cellTip } = useCellTip(fitWidth || stable);
  const selectable = rows.filter(canSelect);
  const selectedCount = selectable.filter((r) => selected.has(r.id)).length;
  const headChecked = selectedCount === 0 ? false : selectedCount === selectable.length ? true : "mixed";
  // The delete-selection column only shows when this page has rows that can be deleted (inactive).
  // Stable columns: decided by the whole list, so the column does not come and go while paging.
  const showSelect = selectColumn && (stable ? measureRows.some(canSelect) : selectable.length > 0);
  // Without it, the last data column takes over the right-edge padding.
  const edge = (c) => !showSelect && c === cols.length - 1 && (dense ? "pr-3" : "pr-4");

  // fitWidth tables squeeze the column gaps (and the type a little) on narrower screens.
  const pad = dense ? "pr-2" : fitWidth ? "pr-2.5 max-[1100px]:pr-2" : "pr-3";

  const setMany = (list, checked) => {
    const next = new Set(selected);
    list.forEach((r) => (checked ? next.add(r.id) : next.delete(r.id)));
    onSelectedChange(next);
  };

  const { t } = useTranslation();
  const nounText = t(`nouns.${noun}`, { defaultValue: noun });
  const summary = virtual && hasMore
    ? t("table.summaryLoaded", { shown: rows.length, total, noun: nounText })
    : paged
    ? t("table.summaryPaged", { from: rows.length ? offset + 1 : 0, to: offset + rows.length, total, noun: nounText })
    : t("table.summaryAll", { total, noun: nounText });

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
        style={virtual ? { overflowAnchor: "none", scrollbarGutter: "stable" } : undefined}
        onScroll={() => {
          hideCellTip();
          updateWindow();
        }}
        className={cn(
          "min-h-0 flex-1",
          cards ? "overflow-hidden" : "overflow-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0.18)_100%)]"
        )}
      >
        {stable && (
          // Hidden copies with the sample rows, one per column set: their automatic layout gives each column the width the
          // whole list needs.
          <div aria-hidden inert className="pointer-events-none invisible absolute top-0 left-0 -z-10 h-0 w-0 overflow-hidden">
            {[[columns, measureRef], ...(altColumns ? [[altColumns, altMeasureRef]] : [])].map(([set, setRef], n) => (
              <table
                key={n}
                ref={setRef}
                style={{ width: "max-content" }}
                className={cn("border-separate border-spacing-0", "type-table-cell font-semibold!")}
              >
                <thead>
                  <tr className={cn("text-left", dense ? "type-table-cell font-semibold! min-[1600px]:type-table-head" : "type-table-head")}>
                    {set.map((col, i) => (
                      <th
                        key={col.key}
                        data-fit={col.fit ? "1" : "0"}
                        data-fitmin={col.fitMin}
                        data-fixed={/w-\[[\d.]+px\]/.test(col.className ?? "") ? "1" : undefined}
                        className={cn("py-2.5 whitespace-nowrap", pad, i === 0 && "pl-4", !showSelect && i === set.length - 1 && (dense ? "pr-3" : "pr-4"), col.className)}
                      >
                        <span data-head={col.key} className={cn("inline-flex items-center", dense && "relative")}>
                          {col.label}
                          {col.sortable !== false && <SortIcon active={false} dir={1} overlay={dense} />}
                        </span>
                      </th>
                    ))}
                    {showSelect && <th data-fit="0" data-fixed="1" className="w-[44px] py-2.5 pr-4" />}
                  </tr>
                </thead>
                <tbody>
                  {sample.map((row, k) => (
                    <tr key={rowKey(row)}>
                      {set.map((col, c) => (
                        <td key={col.key} className={cn(td, pad, c === 0 && "pl-4", !showSelect && c === set.length - 1 && (dense ? "pr-3" : "pr-4"), col.className, col.cellClassName)}>
                          <span className="whitespace-nowrap">{col.render(row, offset + k + 1)}</span>
                        </td>
                      ))}
                      {showSelect && <td className="pr-4" />}
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        )}
        <table
          className={cn(
            "w-full border-separate",
            "type-table-cell font-semibold!",
            // Cards: 8px between rows (and under the header); -mt-2 drops the gap above the header.
            cards ? "-mt-2 border-spacing-x-0 border-spacing-y-2" : "border-spacing-0",
            fitWidth && !dense && "max-[1100px]:text-[13px]",
            frozen && !stable && "[&_td]:overflow-hidden [&_td]:text-ellipsis [&_td]:whitespace-nowrap",
            stable && "[&_td]:whitespace-nowrap",
            minWidth
          )}
          style={frozen ? { tableLayout: "fixed" } : undefined}
        >
          {frozen && (
            <colgroup>
              {frozen.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>
          )}
          <thead className="sticky top-0 z-10">
            <tr
              className={cn(
                "text-left",
                dense ? "type-table-cell font-semibold! min-[1600px]:type-table-head" : "type-table-head",
                cards ? "text-brand-navy" : "bg-brand-head text-white"
              )}
            >
              {cols.map((col, i) => {
                const sortable = col.sortable !== false;
                return (
                  <th
                    key={col.key}
                    onClick={sortable ? () => onSortChange(col.key) : undefined}
                    data-grow={col.grow}
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
                    <span data-head={(fitWidth || stable) && col.fit ? col.key : undefined} className={cn(virtual && col.key === "no" && total > 0 ? "inline-grid" : "inline-flex items-center", dense && "relative")}>
                      {col.label}
                      {virtual && col.key === "no" && total > 0 && (
                        // Invisible: as wide as the longest row number, so the frozen column never cuts a number to "11…".
                        <span aria-hidden className="invisible block h-0 whitespace-nowrap tabular-nums">
                          {"9".repeat(String(total).length)}
                        </span>
                      )}
                      {cards && col.label ? ":" : null}
                      {sortable && <SortIcon active={sort.key === col.key} dir={sort.dir} overlay={dense} />}
                    </span>
                  </th>
                );
              })}
              {showSelect && (
                <th className={cn("w-[44px] py-2.5 pr-4", cards && "bg-[#e4eefc] last:rounded-r-[10px]")}>
                  <SelectBox
                    onHeader={!cards}
                    label={t("table.selectAllInactive")}
                    checked={headChecked}
                    onChange={(checked) => setMany(selectable, checked)}
                  />
                </th>
              )}
            </tr>
          </thead>
          <tbody {...cellTipHandlers}>
            {rows.length ? (
              <>
              {/* Windowed list: spacer rows stand in for the rows above and below the drawn ones. */}
              {winStart > 0 && (
                <tr aria-hidden style={{ height: winStart * rowHeight }}>
                  <td colSpan={cols.length + (showSelect ? 1 : 0)} className="border-0 p-0" />
                </tr>
              )}
              {shown.map((row, k) => {
                const i = winStart + k;
                const isSelected = selected.has(row.id);
                return (
                  <tr
                    key={rowKey(row)}
                    style={{ height: rowHeight }}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "transition-colors",
                      onRowClick && "cursor-pointer",
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
                    {cols.map((col, c) => (
                      <td key={col.key} data-fit={stable && col.fit ? col.key : undefined} className={cn(cell, pad, c === 0 && "pl-4", edge(c), stable && col.fit && "overflow-hidden text-ellipsis", col.className, col.cellClassName)}>
                        {fitWidth && col.fit && !stable ? (
                          <span data-fit={col.key} data-fit-max={col.fitMax} data-fit-min={col.fitMin} className="block overflow-hidden text-ellipsis whitespace-nowrap">
                            {col.render(row, offset + i + 1)}
                          </span>
                        ) : (
                          col.render(row, offset + i + 1)
                        )}
                      </td>
                    ))}
                    {showSelect && (
                      <td className={cn(cell, "pr-4")}>
                        {/* A block-level flex box: an inline checkbox would sit on the text baseline and make the row taller than rowHeight. */}
                        <div className="flex items-center">
                        {canSelect(row) && (
                          <SelectBox className="size-6" label={t("table.selectRow")} checked={isSelected} onChange={(checked) => setMany([row], checked)} />
                        )}
                        {!canSelect(row) && lockedSelect(row) && (
                          <SelectBox className="size-6" disabled label={t("table.alreadyDeleted")} checked={false} onChange={noop} />
                        )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {winEnd < rows.length && (
                <tr aria-hidden style={{ height: (rows.length - winEnd) * rowHeight }}>
                  <td colSpan={cols.length + (showSelect ? 1 : 0)} className="border-0 p-0" />
                </tr>
              )}
              {loadingMore && (
                <tr>
                  <td colSpan={cols.length + (showSelect ? 1 : 0)} className="py-3 text-center text-dash-faint">
                    {t("loading")}
                  </td>
                </tr>
              )}
              </>
            ) : (
              <tr>
                <td colSpan={cols.length + (showSelect ? 1 : 0)} className="py-10 text-center text-dash-faint">
                  {loading ? t("loading") : (emptyMessage ?? t("table.empty", { noun: nounText }))}
                </td>
              </tr>
            )}
            {rows.length > 0 && totalRow && (
              <tr className="bg-[linear-gradient(180deg,#dcecfd_0%,#c9def8_100%)] font-semibold">
                {totalRow.map((cell, i) => (
                  <td
                    key={i}
                    colSpan={cell.span ?? 1}
                    className={cn("h-8 border-t-2 border-[#8fbdf5] py-0 pr-3 whitespace-nowrap", i === 0 && "pl-4", cell.className)}
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
          cards ? "pt-1" : "border-t border-dash-line bg-white/70 px-4 py-2 type-caption text-dash-sub"
        )}
      >
        <span className={cards ? `rounded-[10px] px-2.5 py-1 type-caption font-medium! text-[#33507f] [@media(min-height:760px)]:rounded-xl [@media(min-height:760px)]:px-3 [@media(min-height:760px)]:py-[7px] ${TRAY}` : undefined}>{summary}</span>
        {paged && pageCount > 1 && <Pager page={page} pageCount={pageCount} onPageChange={onPageChange} boxed={cards || boxedPager} />}
      </div>
      {cellTip}
    </section>
  );
}
