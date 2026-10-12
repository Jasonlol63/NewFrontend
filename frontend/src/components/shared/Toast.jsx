import { createPortal } from "react-dom";
import { Check, CircleAlert, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Card, icon disc and countdown bar colours per level: calm tints, never a hard red.
const TONE = {
  success: { card: "border-[#b9e6d0] bg-[#f0faf5] text-[#0f5f43]", fill: "bg-[#1f9d6b]", Icon: Check },
  error: { card: "border-[#f1c4c4] bg-[#fff5f5] text-[#8a2f2f]", fill: "bg-[#d86a6a]", Icon: CircleAlert },
  warning: { card: "border-[#f0dba9] bg-[#fffaf0] text-[#74500f]", fill: "bg-[#d9a021]", Icon: TriangleAlert },
  info: { card: "border-[#c6d9f7] bg-[#f1f6ff] text-[#1b3f8c]", fill: "bg-[#2f6fef]", Icon: Info },
};

function ToastCard({ notice, onClose }) {
  const tone = TONE[notice.level] ?? TONE.info;
  const { Icon } = tone;
  const lines = Array.isArray(notice.detail) ? notice.detail : [];
  const text = typeof notice.detail === "string" ? notice.detail : "";
  return (
    <div
      role={notice.level === "error" ? "alert" : "status"}
      aria-live={notice.level === "error" ? "assertive" : "polite"}
      style={{ "--toast-ms": `${notice.ms ?? 0}ms` }}
      className={cn(
        "pointer-events-auto relative flex w-full max-w-[min(440px,100%)] animate-toast-in items-start gap-[11px] overflow-hidden rounded-xl border py-[11px] pl-3 pr-2.5 shadow-[0_10px_24px_-12px_rgba(20,51,107,0.45)] motion-reduce:animate-none",
        notice.ms ? "pb-[13px]" : "",
        tone.card
      )}
    >
      <span className={cn("mt-px flex size-[26px] flex-none items-center justify-center rounded-full text-white", tone.fill)}>
        <Icon className="size-[15px]" strokeWidth={2.4} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[13.5px] font-semibold leading-[1.35]">{notice.message}</p>
        {text && <p className="m-0 mt-0.5 text-[12.5px] leading-normal opacity-90">{text}</p>}
        {lines.length > 0 && (
          <ul className="m-0 mt-1.5 list-none p-0 text-[12.5px] leading-[1.55]">
            {lines.map((line) => (
              <li key={line} className="flex items-baseline gap-[7px]">
                <i className="size-[5px] flex-none -translate-y-px rounded-full bg-current opacity-60" />
                {line}
              </li>
            ))}
          </ul>
        )}
        {notice.action && (
          <button
            type="button"
            onClick={() => {
              notice.action.onClick();
              onClose?.(notice.id);
            }}
            className="mt-1.5 cursor-pointer border-none bg-transparent p-0 text-[12.5px] font-bold text-current underline underline-offset-2"
          >
            {notice.action.label}
          </button>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          aria-label="Close"
          onClick={() => onClose(notice.id)}
          className="mt-0.5 flex-none cursor-pointer border-none bg-transparent p-0.5 text-current opacity-55 transition-opacity hover:opacity-100"
        >
          <X className="size-[15px]" aria-hidden="true" />
        </button>
      )}
      {notice.ms ? <span className={cn("absolute inset-x-0 bottom-0 h-[3px] origin-left animate-toast-countdown motion-reduce:animate-none", tone.fill)} /> : null}
    </div>
  );
}

/**
 * What the last actions did, over the top of the page. toasts = [{ id, message, detail?, level, at, ms }] (see hooks/useNotice):
 * `message` is the headline, `detail` an optional second line, or an array of lines for several problems at once.
 * Several can be on screen at once, stacked in the order they came, each one going away when its own countdown bar ends
 * (`ms`; null = stays until closed). onClose(id) is the X. It is drawn into #main-overlay (the content area, above the
 * full-area modals) when the layout has it, else in place: put it in a `relative` page.
 */
export default function Toast({ toasts, onClose }) {
  if (!toasts?.length) return null;
  const root = typeof document === "undefined" ? null : document.getElementById("main-overlay");
  const stack = (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-[80] flex flex-col items-center gap-2 px-4">
      {toasts.map((n) => (
        <ToastCard key={n.id} notice={n} onClose={onClose} />
      ))}
    </div>
  );
  return root ? createPortal(stack, root) : stack;
}
