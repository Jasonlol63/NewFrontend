import { Dialog } from "radix-ui";
import { drawFirst, drawLate } from "@/components/shared/StatusDialog.jsx";

// Sizes scale continuously with the viewport (no breakpoints), so the dialog keeps the
// same proportions from a 1280×560 laptop up to 1920×950: width follows vw, vertical
// rhythm follows dvh, and every value is capped at the design size.
const FLUID = {
  width: "clamp(300px, 22vw, 400px)",
  "--pad-x": "clamp(20px, 1.5vw, 28px)",
  "--pad-y": "clamp(20px, 3.4dvh, 30px)",
  "--icon": "clamp(42px, 6dvh, 52px)",
  "--gap": "clamp(14px, 2.4dvh, 22px)",
  "--btn-h": "clamp(36px, 5dvh, 42px)",
};

// Same motion language as the Login status dialog, toned down: the icon pops in, the
// trash draws itself, one ripple goes out on entry, then only a soft glow remains.
function TrashIcon() {
  return (
    <div aria-hidden="true" className="relative mx-auto mb-[calc(var(--gap)*0.65)] size-(--icon) animate-status-pop motion-reduce:animate-none">
      <span className="pointer-events-none absolute -inset-1 animate-status-glow rounded-full bg-[#ffd6d6] opacity-0 blur-[8px] motion-reduce:hidden" />
      <span className="pointer-events-none absolute inset-0 animate-status-ripple rounded-full border-[1.5px] border-[#e5484d] opacity-0 motion-reduce:hidden" />
      <div className="absolute inset-0 grid place-items-center rounded-full bg-[#ffecec] text-[#e5484d] shadow-[0_0_0_8px_#fff6f6]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[46%] overflow-visible">
          <path className={drawFirst} pathLength="1" d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path className={drawLate} pathLength="1" d="M3 6h18" />
          <path className={drawLate} pathLength="1" d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path className={drawLate} pathLength="1" d="M10 11v6" />
          <path className={drawLate} pathLength="1" d="M14 11v6" />
        </svg>
      </div>
    </div>
  );
}

/**
 * Global delete confirmation. One item shows its name, several show a count.
 *  - names: labels of the items to delete (string[])
 *  - noun: singular noun ("user", "account")
 *  - note: optional extra line under the warning
 */
export default function DeleteDialog({ open, onOpenChange, names = [], noun = "item", note, onConfirm }) {
  const count = names.length;
  const single = count === 1;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-dialog-overlay bg-[rgba(20,51,107,0.22)] backdrop-blur-[6px] motion-reduce:animate-none" />
        <Dialog.Content
          style={FLUID}
          className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-32px)] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 animate-dialog-in overflow-y-auto rounded-[20px] bg-white px-(--pad-x) pb-[calc(var(--pad-y)*0.75)] pt-(--pad-y) text-center shadow-[0_30px_60px_-20px_rgba(20,51,107,0.45),0_8px_20px_-10px_rgba(20,70,160,0.25)] outline-none motion-reduce:animate-none"
        >
          <TrashIcon />
          <Dialog.Title className="m-0 mb-1.5 text-[clamp(16px,2.3dvh,18px)] font-bold tracking-[-0.2px] text-brand-navy">
            {single ? `Delete ${noun}?` : `Delete ${count} ${noun}s?`}
          </Dialog.Title>
          <Dialog.Description className="m-0 break-words text-[clamp(13px,1.8dvh,14px)] leading-relaxed text-[#5b74a3] [&_b]:font-semibold [&_b]:text-brand-navy">
            {single ? (
              <>
                Are you sure you want to delete <b>{names[0]}</b>?
              </>
            ) : (
              <>The {count} selected {noun}s will be deleted.</>
            )}
            <br />
            This action can't be undone.
            {note && (
              <>
                <br />
                {note}
              </>
            )}
          </Dialog.Description>
          <div className="mt-(--gap) flex gap-2.5">
            <Dialog.Close className="h-(--btn-h) flex-1 cursor-pointer rounded-xl border border-[#dbe5f3] bg-white text-sm font-semibold text-brand-navy outline-none transition-colors hover:bg-[#f5f8fd] focus-visible:ring-2 focus-visible:ring-brand-blue/40 focus-visible:ring-offset-2">
              Cancel
            </Dialog.Close>
            <button
              type="button"
              onClick={onConfirm}
              className="h-(--btn-h) flex-1 cursor-pointer rounded-xl border-none bg-[#e5484d] text-sm font-semibold text-white shadow-[0_6px_14px_-6px_rgba(229,72,77,0.6)] outline-none transition-colors hover:bg-[#d63b40] focus-visible:ring-2 focus-visible:ring-[#e5484d]/45 focus-visible:ring-offset-2"
            >
              Delete
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
