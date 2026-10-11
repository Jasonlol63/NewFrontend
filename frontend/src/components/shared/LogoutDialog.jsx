import { Dialog } from "radix-ui";
import { Loader2 } from "lucide-react";
import { drawFirst, drawLate } from "@/components/shared/StatusDialog.jsx";

// Same proportions and motion as DeleteDialog (width follows vw, rhythm follows dvh, all capped at the design size).
const FLUID = {
  width: "clamp(300px, 22vw, 400px)",
  "--pad-x": "clamp(20px, 1.5vw, 28px)",
  "--pad-y": "clamp(20px, 3.4dvh, 30px)",
  "--icon": "clamp(42px, 6dvh, 52px)",
  "--gap": "clamp(14px, 2.4dvh, 22px)",
  "--btn-h": "clamp(36px, 5dvh, 42px)",
};

// The door draws itself, the arrow follows and then keeps stepping out of the door, with one ripple on entry and a
// soft glow after it (blue, like the app; DeleteDialog does the same in red).
function LogoutIcon() {
  return (
    <div aria-hidden="true" className="relative mx-auto mb-[calc(var(--gap)*0.65)] size-(--icon) animate-status-pop motion-reduce:animate-none">
      <span className="pointer-events-none absolute -inset-1 animate-status-glow rounded-full bg-[#cfe0ff] opacity-0 blur-[8px] motion-reduce:hidden" />
      <span className="pointer-events-none absolute inset-0 animate-status-ripple rounded-full border-[1.5px] border-[#2f6fef] opacity-0 motion-reduce:hidden" />
      <div className="absolute inset-0 grid place-items-center rounded-full bg-[#eaf2ff] text-[#1d63ed] shadow-[0_0_0_8px_#f3f8ff]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[46%] overflow-visible">
          <path className={drawFirst} pathLength="1" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <g className="animate-logout-step motion-reduce:animate-none">
            <path className={drawLate} pathLength="1" d="m16 17 5-5-5-5" />
            <path className={drawLate} pathLength="1" d="M21 12H9" />
          </g>
        </svg>
      </div>
    </div>
  );
}

/** Logout confirmation. `who` is the signed-in account shown in the text; `busy` shows the spinner while logging out. */
export default function LogoutDialog({ open, onOpenChange, who, busy = false, onConfirm }) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-dialog-overlay bg-[rgba(20,51,107,0.22)] backdrop-blur-[6px] motion-reduce:animate-none" />
        <Dialog.Content
          style={FLUID}
          className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-32px)] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 animate-dialog-in overflow-y-auto rounded-[20px] bg-white px-(--pad-x) pb-[calc(var(--pad-y)*0.75)] pt-(--pad-y) text-center shadow-[0_30px_60px_-20px_rgba(20,51,107,0.45),0_8px_20px_-10px_rgba(20,70,160,0.25)] outline-none motion-reduce:animate-none"
        >
          <LogoutIcon />
          <Dialog.Title className="m-0 mb-1.5 text-[clamp(16px,2.3dvh,18px)] font-bold tracking-[-0.2px] text-brand-navy">Log out?</Dialog.Title>
          <Dialog.Description className="m-0 break-words text-[clamp(13px,1.8dvh,14px)] leading-relaxed text-[#5b74a3] [&_b]:font-semibold [&_b]:text-brand-navy">
            {who && (
              <>
                You're signed in as <b>{who}</b>.
                <br />
              </>
            )}
            You'll need to sign in again to continue.
          </Dialog.Description>
          <div className="mt-(--gap) flex gap-2.5">
            <Dialog.Close
              disabled={busy}
              className="h-(--btn-h) flex-1 cursor-pointer rounded-xl border border-[#dbe5f3] bg-white text-sm font-semibold text-brand-navy outline-none transition-colors hover:bg-[#f5f8fd] focus-visible:ring-2 focus-visible:ring-brand-blue/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </Dialog.Close>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="inline-flex h-(--btn-h) flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-none bg-brand-sweep text-sm font-semibold text-white shadow-[0_10px_20px_-8px_rgba(20,90,220,0.55),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.35)] outline-none transition-[filter] hover:brightness-105 focus-visible:ring-2 focus-visible:ring-brand-blue/45 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Log out
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
