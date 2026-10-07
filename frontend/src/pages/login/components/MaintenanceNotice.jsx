import { useLayoutEffect, useRef, useState } from "react";
import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

// Scroll speed, in px per second.
const SPEED = 45;
// Space between the end of the text and its repeat.
const GAP = 48;

/**
 * Maintenance notice above the login card: a pill with the wrench, the bold prefix and the notice text.
 * The text always runs left in a loop (a marquee, so it is noticed even when it is short); it starts at the left edge
 * so nothing waits to come in, fades at both ends and pauses while the pointer is over it. A short text crosses the
 * whole pill before it comes round again. With "reduce motion" it stays still and is cut off with "...".
 * Only one line is shown, so the page passes the notice as plain text.
 *  - prefix, text: what the Settings tab saved (rich text already flattened by the page)
 */
export default function MaintenanceNotice({ prefix, text, className }) {
  const windowRef = useRef(null);
  const textRef = useRef(null);
  const [lap, setLap] = useState(null); // { width, seconds } of one copy of the text, gap included

  useLayoutEffect(() => {
    const win = windowRef.current;
    const measure = () => {
      // one copy is at least as wide as the pill, so a short text leaves the pill before its repeat comes in
      const width = Math.max(textRef.current.getBoundingClientRect().width, win.clientWidth) + GAP;
      setLap({ width, seconds: width / SPEED });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(win);
    return () => ro.disconnect();
  }, [prefix, text]);

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
        className="group min-w-0 flex-1 overflow-hidden whitespace-nowrap text-left [mask-image:linear-gradient(90deg,transparent,#000_4%,#000_94%,transparent)] motion-reduce:[mask-image:none]"
      >
        <div
          className={cn("inline-flex", lap && "animate-notice-run group-hover:[animation-play-state:paused] motion-reduce:animate-none")}
          style={lap ? { "--run-distance": `-${lap.width}px`, animationDuration: `${lap.seconds}s` } : undefined}
        >
          <span className="inline-block" style={lap ? { minWidth: lap.width - GAP, paddingRight: GAP } : undefined}>
            <span ref={textRef} className={cn(copy, "motion-reduce:max-w-full motion-reduce:truncate")}>
              {text}
            </span>
          </span>
          {lap && (
            <span aria-hidden="true" className="inline-block motion-reduce:hidden" style={{ minWidth: lap.width - GAP, paddingRight: GAP }}>
              <span className={copy}>{text}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
