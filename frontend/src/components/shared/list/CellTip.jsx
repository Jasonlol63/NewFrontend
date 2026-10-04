import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Pause before the card shows, the gap to the cell, and the room kept to the screen edge.
const DELAY = 400;
const GAP = 8;
const MARGIN = 8;

// Same soft blue card as the time hover on the date cells. Sits under the cell (above it near the
// bottom of the screen) and is kept inside the window.
function CellTipCard({ text, rect }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { offsetWidth: w, offsetHeight: h } = el;
    const left = Math.min(Math.max(MARGIN, rect.left), Math.max(MARGIN, window.innerWidth - w - MARGIN));
    const below = rect.bottom + GAP + h <= window.innerHeight - MARGIN || rect.top - GAP - h < MARGIN;
    const top = below ? rect.bottom + GAP : rect.top - GAP - h;
    const arrow = Math.min(Math.max(14, rect.left + Math.min(rect.width / 2, 24) - left), Math.max(14, w - 14));
    setPos({ left, top, arrow, below });
  }, [rect, text]);

  return (
    <div
      ref={ref}
      role="tooltip"
      style={{ position: "fixed", left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? "visible" : "hidden" }}
      className="pointer-events-none z-50 w-max max-w-[320px] rounded-[10px] bg-[linear-gradient(135deg,#3a63c4_0%,#4f8fd9_100%)] px-3 py-1.5 text-[12px] leading-snug font-semibold tracking-[0.2px] break-words text-[#f4f8ff] shadow-[0_10px_22px_-8px_rgba(40,80,170,0.5),inset_0_1px_0_rgba(255,255,255,0.25)] animate-in fade-in-0 zoom-in-95"
    >
      {text}
      {pos && (
        <span
          aria-hidden="true"
          style={{ left: pos.arrow, [pos.below ? "top" : "bottom"]: -4 }}
          className="absolute size-[9px] -translate-x-1/2 rotate-45 rounded-[2px] bg-[#3f6ec9]"
        />
      )}
    </div>
  );
}

/**
 * Hover card with the full text of a cut-off cell, for tables whose text columns shrink (DataTable
 * fitWidth). One card for the whole table instead of one tooltip per cell: the handlers watch which
 * [data-fit] cell the pointer is over and only cells that really are cut off show it.
 * Spread `cellTipHandlers` on the <tbody>, call `hideCellTip` when the table scrolls, and render `cellTip`.
 */
export function useCellTip(enabled) {
  const [tip, setTip] = useState(null);
  const timer = useRef(null);
  const current = useRef(null);

  const hideCellTip = () => {
    clearTimeout(timer.current);
    current.current = null;
    setTip(null);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const onMouseOver = (event) => {
    if (!enabled) return;
    const cell = event.target.closest?.("[data-fit]") ?? null;
    if (cell === current.current) return;
    hideCellTip();
    if (!cell || cell.scrollWidth <= cell.clientWidth + 1) return;
    current.current = cell;
    timer.current = setTimeout(() => setTip({ text: cell.textContent, rect: cell.getBoundingClientRect() }), DELAY);
  };

  return {
    cellTipHandlers: { onMouseOver, onMouseLeave: hideCellTip },
    hideCellTip,
    cellTip: tip ? createPortal(<CellTipCard text={tip.text} rect={tip.rect} />, document.body) : null,
  };
}
