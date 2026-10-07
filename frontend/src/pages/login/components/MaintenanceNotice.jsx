import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

// Scroll speed, in px per second.
const SPEED = 45;
// Space between the end of the text and its repeat.
const GAP = 48;
// How quickly the speed eases to a stop / back up when the pointer enters / leaves (per second).
const EASE = 8;

/**
 * Maintenance notice above the login card: a pill with the wrench, the bold prefix and the notice text.
 * The text always runs left in a loop (a marquee, so it is noticed even when it is short); it starts at the left edge
 * so nothing waits to come in, fades at both ends and eases to a stop while the pointer is over it. A short text crosses
 * the whole pill before it comes round again. With "reduce motion" it stays still and is cut off with "...".
 * Only one line is shown, so the page passes the notice as plain text.
 *
 * The position is one continuous offset advanced every frame (speed x time, wrapped at one lap), not a CSS animation,
 * so re-measuring (fonts loading, window resized) keeps the same place in the lap instead of jumping, and the lap is a
 * whole number of pixels with the offset snapped to device pixels so the wrap-around is invisible.
 *  - prefix, text: what the Settings tab saved (rich text already flattened by the page)
 */
export default function MaintenanceNotice({ prefix, text, className }) {
  const windowRef = useRef(null);
  const trackRef = useRef(null);
  const textRef = useRef(null);
  const [lap, setLap] = useState(null); // width of one copy of the text, gap included (whole px)
  const lapRef = useRef(0);
  const offsetRef = useRef(0);
  const hoverRef = useRef(false);

  const paint = () => {
    if (!trackRef.current) return;
    const dpr = window.devicePixelRatio || 1;
    const x = Math.round(offsetRef.current * dpr) / dpr;
    trackRef.current.style.transform = `translate3d(${-x}px,0,0)`;
  };

  useLayoutEffect(() => {
    const win = windowRef.current;
    const measure = () => {
      // one copy is at least as wide as the pill, so a short text leaves the pill before its repeat comes in
      const width = Math.round(Math.max(textRef.current.getBoundingClientRect().width, win.clientWidth)) + GAP;
      if (width === lapRef.current) return;
      // keep the place in the lap (as a fraction) so a re-measure never makes the text jump
      if (lapRef.current) offsetRef.current = (offsetRef.current / lapRef.current) * width;
      lapRef.current = width;
      setLap(width);
      paint();
    };
    lapRef.current = 0;
    offsetRef.current = 0;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(win);
    return () => ro.disconnect();
  }, [prefix, text]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let raf;
    let last = null;
    let velocity = SPEED;
    const tick = (now) => {
      // a long gap (background tab) is skipped instead of making the text leap forward
      const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.1);
      last = now;
      const target = hoverRef.current ? 0 : SPEED;
      velocity += (target - velocity) * Math.min(1, dt * EASE);
      if (lapRef.current && dt > 0) {
        offsetRef.current = (offsetRef.current + velocity * dt) % lapRef.current;
        paint();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const copy = "inline-block whitespace-nowrap text-[12.5px] font-medium tabular-nums text-brand-navy";

  return (
    <div
      role="status"
      className={cn(
        "flex h-10 w-full items-center gap-[9px] rounded-full bg-notice-gradient py-0 pl-[6px] pr-3 shadow-notice",
        className
      )}
    >
      <span className="flex size-7 flex-none items-center justify-center rounded-full bg-white text-brand-blue shadow-[0_2px_6px_-2px_rgba(20,70,160,0.3)]">
        <Wrench size={15} aria-hidden="true" />
      </span>
      {prefix && <b className="max-w-[45%] flex-none truncate text-[12.5px] font-extrabold text-brand-navy">{prefix}</b>}
      <div
        ref={windowRef}
        title={text}
        onMouseEnter={() => { hoverRef.current = true; }}
        onMouseLeave={() => { hoverRef.current = false; }}
        className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-left [mask-image:linear-gradient(90deg,transparent,#000_4%,#000_94%,transparent)] motion-reduce:[mask-image:none]"
      >
        <div ref={trackRef} className="inline-flex will-change-transform motion-reduce:!transform-none">
          <span className="inline-block" style={lap ? { minWidth: lap - GAP, paddingRight: GAP } : undefined}>
            <span ref={textRef} className={cn(copy, "motion-reduce:max-w-full motion-reduce:truncate")}>
              {text}
            </span>
          </span>
          {lap && (
            <span aria-hidden="true" className="inline-block motion-reduce:hidden" style={{ minWidth: lap - GAP, paddingRight: GAP }}>
              <span className={copy}>{text}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
