import { useEffect, useId, useRef } from "react";
import { Check, MessageSquare, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { primaryButtonClass } from "./fields.jsx";

/**
 * A big text box floating over a form modal (pass it as FormModal's `overlay`), opened by an ExpandableTextarea so a long text
 * is easy to write on a small screen. It edits the same value live: value / onChange(text). Done, the Collapse button, a click
 * on the backdrop and Esc all close it (Esc closes only this, not the modal under it). The text is upper case through the
 * modal's own text-transform; `subtitle` is the line under the title (which process it is).
 */
export default function TextEditorSheet({ title, subtitle, value, onChange, placeholder, onClose, icon: Icon = MessageSquare }) {
  const titleId = useId();
  const box = useRef(null);

  // Opens with the cursor after the existing text.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const onKeyDown = (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault(); // the modal under it only closes on an Escape nobody handled
    onClose();
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={onKeyDown}
      className="absolute inset-0 z-20 grid animate-dialog-overlay place-items-center rounded-[inherit] bg-[rgba(20,51,107,0.2)] p-2.5 backdrop-blur-[3px] motion-reduce:animate-none"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-[min(100%,440px)] w-[min(640px,100%)] animate-dialog-in flex-col rounded-[18px] bg-[#f1f6fd] px-4 pb-3.5 pt-3.5 shadow-[0_30px_60px_-20px_rgba(20,51,107,0.45),0_8px_20px_-10px_rgba(20,70,160,0.25)] motion-reduce:animate-none modal-tiny:px-3 modal-tiny:pb-3 modal-tiny:pt-3"
      >
        <div className="mb-2.5 flex flex-none items-center gap-2.5">
          <span className="flex size-8 flex-none items-center justify-center rounded-[11px] bg-brand-sweep text-white shadow-[0_8px_16px_-8px_rgba(20,90,220,0.55)]">
            <Icon className="size-4" strokeWidth={2.3} />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="m-0 text-[16px] font-extrabold text-brand-navy">
              {title}
            </h2>
            {subtitle && <p className="m-0 truncate text-[11.5px] text-[#5b74a3]">{subtitle}</p>}
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1">
          <textarea
            ref={box}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="block h-full w-full resize-none rounded-xl border border-modal-input-line bg-white py-2.5 pl-3 pr-10 text-[16px] leading-normal text-[#111827] uppercase outline-none transition-[border-color,box-shadow] placeholder:text-dash-faint focus:border-[#3b82f6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] min-[600px]:text-[15px]"
          />
          <button
            type="button"
            onClick={onClose}
            title="Collapse"
            aria-label="Collapse"
            className="absolute right-2 top-2 flex size-7 cursor-pointer items-center justify-center rounded-lg border border-[#d5deea] bg-white/90 text-[#475569] transition-colors hover:border-[#93c5fd] hover:text-brand-navy"
          >
            <Minimize2 className="size-3.5" strokeWidth={2.3} />
          </button>
        </div>

        <div className="mt-2.5 flex flex-none items-center justify-between gap-2 text-[11.5px] text-[#8a96a8]">
          <span className="min-w-0 truncate normal-case">
            Saved in uppercase ·{" "}
            <b className="font-bold text-[#3b82f6]">
              {value.length} {value.length === 1 ? "character" : "characters"}
            </b>
          </span>
          <button type="button" onClick={onClose} className={cn(primaryButtonClass, "h-9 min-w-24 flex-none px-4 text-[13px] modal-tiny:h-8")}>
            <Check className="size-[15px]" strokeWidth={2.5} />
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
