import { useEffect, useId } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import MainOverlay from "@/components/layout/MainOverlay.jsx";
import { SoftButton, primaryButtonClass } from "./fields.jsx";

// Width tiers come from the content area (@container/main = screen minus sidebar):
//   @min-[900px]/main:@max-[1099px]/main = narrow content area (1200-1366 with the sidebar, 1024-1180 with the rail)
//   @max-[899px]/main = tablets; @max-[599px]/main = phones
// Height tiers use the modal-compact / modal-tiny / modal-tall variants from index.css.
// Class names are written out in full so Tailwind can see them.

/**
 * Shell shared by the full-area form modals (Add / Edit User, Add / Edit Account): fills the
 * content area (the sidebar stays visible) over the blurred page, header with icon + title +
 * Back, footer with Cancel / Save. Each modal only supplies its own body.
 *
 * bodyClassName: the body's own layout (grid columns, scrolling...); it already has the padding
 *   and gap (--pad / --gap) and fills the space between header and footer.
 * footerStart: shown on the left of the footer (e.g. a validation message).
 * Mount it only while open so every opening starts from its initial values.
 */
export default function FormModal({ icon: Icon, title, onClose, onSave, saveLabel = "Save", footerStart, bodyClassName, children }) {
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (e) => {
      // An open dropdown / popup handles (and prevents) its own Escape; only close the modal otherwise.
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <MainOverlay>
      <div className="@container/main absolute inset-0 z-30 flex animate-dialog-overlay motion-reduce:animate-none">
        <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-[rgba(214,230,252,0.72)] backdrop-blur-[12px]" />

        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={cn(
            "relative z-10 m-[clamp(8px,1.6dvh,16px)] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[22px] bg-modal-bg backdrop-blur-[22px] backdrop-saturate-[1.15]",
            "[--gap:clamp(8px,1.5dvh,14px)] [--pad:clamp(10px,2dvh,18px)]",
            "@min-[900px]/main:@max-[1099px]/main:[--gap:8px] @min-[900px]/main:@max-[1099px]/main:[--pad:10px]",
            "modal-compact:[--gap:8px] modal-compact:[--pad:10px] modal-tiny:m-2 modal-tiny:[--gap:6px] modal-tiny:[--pad:8px]",
            "@max-[599px]/main:m-2 @max-[599px]/main:rounded-[18px]"
          )}
        >
          <header className="flex flex-none items-center justify-between gap-3 px-[calc(var(--pad)+6px)] pt-(--pad)">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 flex-none items-center justify-center rounded-xl bg-brand-sweep text-white shadow-[0_10px_20px_-8px_rgba(20,90,220,0.55),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.35)] modal-compact:size-8 modal-compact:rounded-[10px] modal-tiny:size-7 modal-tiny:rounded-lg">
                <Icon className="size-5 modal-tiny:size-4" strokeWidth={2.2} />
              </div>
              <h1
                id={titleId}
                className="m-0 whitespace-nowrap text-[clamp(20px,2.6dvh,26px)] font-extrabold leading-[1.1] tracking-[-0.3px] text-brand-navy modal-compact:text-[20px] modal-tiny:text-[18px]"
              >
                {title}
              </h1>
            </div>
            <SoftButton onClick={onClose} className="h-9 px-4 modal-compact:h-8 modal-tiny:h-[30px] modal-tiny:px-3">
              <ChevronLeft className="size-[15px]" strokeWidth={2.5} />
              Back
            </SoftButton>
          </header>

          <div className={cn("min-h-0 min-w-0 flex-1 gap-(--gap) px-(--pad) py-(--gap)", bodyClassName)}>{children}</div>

          <footer className="flex flex-none flex-wrap items-center justify-end gap-2 border-t border-modal-line px-(--pad) pb-(--pad) pt-2.5 modal-compact:pt-1.5">
            {footerStart}
            <SoftButton onClick={onClose} className="h-[38px] min-w-[112px] px-[22px] text-[13.5px] modal-compact:h-8 modal-tiny:h-[30px] @max-[599px]/main:min-w-0 @max-[599px]/main:flex-1">
              Cancel
            </SoftButton>
            <button
              type="button"
              onClick={onSave}
              className={cn(
                primaryButtonClass,
                "h-[38px] min-w-[112px] px-[22px] text-[13.5px] modal-compact:h-8 modal-tiny:h-[30px] @max-[599px]/main:min-w-0 @max-[599px]/main:flex-1"
              )}
            >
              <Check className="size-[15px]" strokeWidth={2.5} />
              {saveLabel}
            </button>
          </footer>
        </div>
      </div>
    </MainOverlay>
  );
}
