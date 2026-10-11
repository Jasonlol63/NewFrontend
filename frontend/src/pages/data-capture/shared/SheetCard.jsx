import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";
import { cardClass } from "./cardParts.jsx";

export const textButtonClass =
  "h-[34px] cursor-pointer rounded-[10px] border border-modal-input-line bg-modal-input px-4 text-[13px] font-bold text-[#475569] shadow-[0_1px_3px_rgba(15,23,42,0.05)] hover:border-[#94a3b8] hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50";
export const iconButtonClass = "flex size-[34px] flex-none cursor-pointer items-center justify-center rounded-[10px] border border-modal-input-line bg-modal-input text-[#475569] hover:bg-white/90";

/**
 * The Data Capture Table card of both capture forms: title, `left` controls (type, Reset...), the notice of the last paste,
 * `right` controls (Add Row...), the full-screen button, and the sheet as children. fullscreen: useFullscreen() of the page;
 * notice: { message, level } from useNotice().
 */
export default function SheetCard({ fullscreen, left, right, notice, children }) {
  const { ref, full, toggle } = fullscreen;
  return (
    <section ref={ref} className={cn(cardClass, "flex min-h-0 flex-1 flex-col overflow-hidden", full && "rounded-none bg-[#eaf3fd]")}>
      <div className="flex flex-none items-center gap-2.5 px-4 py-2.5">
        <h2 className="m-0 mr-1.5 flex items-center gap-2 text-[16px] font-extrabold text-brand-navy">
          <span className="h-4 w-1 rounded-sm bg-[linear-gradient(180deg,#3fc4ff,#0a3fc9)]" />
          Data Capture Table
        </h2>
        {left}
        <span role="status" title={notice?.message} className={cn("ml-1 min-w-0 flex-1 truncate text-[12.5px] font-semibold", notice?.level === "danger" ? "text-dash-down" : "text-[#15803d]")}>
          {notice?.message}
        </span>
        <div className="flex flex-none items-center gap-2">
          {right}
          <button type="button" onClick={toggle} aria-label={full ? "Exit full screen" : "Full screen"} title={full ? "Exit full screen" : "Full screen"} className={iconButtonClass}>
            {full ? <Minimize2 className="size-4" strokeWidth={2.2} /> : <Maximize2 className="size-4" strokeWidth={2.2} />}
          </button>
        </div>
      </div>
      {children}
    </section>
  );
}

/** Submit under the sheet; disabled until the form and the sheet are filled in. */
export function SubmitBar({ disabled, readOnly, onSubmit }) {
  return (
    <div className="flex flex-none justify-center">
      <button
        type="button"
        disabled={disabled}
        onClick={onSubmit}
        title={readOnly ? "Read-only login" : undefined}
        className={cn(primaryButtonClass, "h-[34px] min-w-[108px] px-[22px] text-[13.5px] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:grayscale-[0.55] disabled:hover:brightness-100")}
      >
        Submit
      </button>
    </div>
  );
}
