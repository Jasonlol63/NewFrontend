import { useState } from "react";
import { Dialog } from "radix-ui";
import { Check, Maximize2, MessageSquare, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SoftButton, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";

// The same shell and spacing variables as DeleteDialog, only wider for the text box (nearly the whole screen on a phone).
// The buttons are the ones of the Add / Edit modals' footer (Cancel soft, Save the blue gradient with its tick,
// right-aligned), not the half-width pair. The Expand button in the text box switches to the wider, taller size.
const FLUID = {
  "--pad-x": "clamp(16px, 1.5vw, 28px)",
  "--pad-y": "clamp(18px, 3.4dvh, 30px)",
  "--gap": "clamp(12px, 2.4dvh, 22px)",
};
const WIDTH = { normal: "min(540px, calc(100vw - 24px))", expanded: "min(760px, calc(100vw - 24px))" };

/**
 * Remark of one Bank Process, edited on its own (the backend has a separate endpoint for it).
 * row: the process being edited (null = closed); onSave(row, remark) saves and throws on failure, the message
 * stays in the dialog; the dialog closes after a successful save.
 */
export default function BankRemarkDialog({ row, onClose, onSave }) {
  const [expanded, setExpanded] = useState(false);
  // Every opening starts at the normal size.
  const close = () => {
    onClose();
    setExpanded(false);
  };
  return (
    <Dialog.Root open={Boolean(row)} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-dialog-overlay bg-[rgba(20,51,107,0.22)] backdrop-blur-[6px] motion-reduce:animate-none" />
        <Dialog.Content
          style={{ ...FLUID, width: expanded ? WIDTH.expanded : WIDTH.normal }}
          className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-24px)] -translate-x-1/2 -translate-y-1/2 animate-dialog-in overflow-y-auto rounded-[20px] bg-white px-(--pad-x) pb-[calc(var(--pad-y)*0.75)] pt-(--pad-y) shadow-[0_30px_60px_-20px_rgba(20,51,107,0.45),0_8px_20px_-10px_rgba(20,70,160,0.25)] outline-none transition-[width] duration-200 motion-reduce:animate-none motion-reduce:transition-none"
        >
          {/* Mounted only while a row is open, so every opening starts from that row's remark. */}
          {row && <RemarkForm row={row} onClose={close} onSave={onSave} expanded={expanded} onToggleExpand={() => setExpanded((v) => !v)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RemarkForm({ row, onClose, onSave, expanded, onToggleExpand }) {
  const [text, setText] = useState(row.remark ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave(row, text.trim().toUpperCase());
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mb-[clamp(10px,2.4dvh,16px)] flex items-center gap-3">
        <span className="flex size-10 flex-none items-center justify-center rounded-[14px] bg-brand-sweep text-white shadow-[0_10px_20px_-8px_rgba(20,90,220,0.55),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.35)]">
          <MessageSquare className="size-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <Dialog.Title className="m-0 text-[clamp(16px,2.3dvh,18px)] font-extrabold tracking-[-0.2px] text-brand-navy">Remark</Dialog.Title>
          <Dialog.Description className="m-0 truncate text-[12.5px] text-[#5b74a3]">
            {row.supplier} · {row.bank} · {row.cardOwner}
          </Dialog.Description>
        </div>
      </div>
      {/* Not the shared input class: that one fixes the height to 30px on short screens, which squeezed this box to a single line. */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ENTER REMARKS..."
          autoFocus
          className={cn(
            "block w-full resize-none rounded-[14px] border border-modal-input-line bg-white px-3.5 py-3 text-[16px] leading-normal text-[#111827] uppercase shadow-[0_1px_3px_rgba(15,23,42,0.05)] outline-none transition-[border-color,box-shadow] placeholder:text-dash-faint focus:border-[#3b82f6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] min-[600px]:text-[15px]",
            expanded ? "h-[clamp(220px,52dvh,420px)]" : "h-[clamp(110px,30dvh,220px)]"
          )}
        />
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? "Collapse the text box" : "Expand the text box"}
          aria-pressed={expanded}
          title={expanded ? "Collapse" : "Expand"}
          className="absolute right-2 top-2 flex size-7 cursor-pointer items-center justify-center rounded-lg border border-[#d5deea] bg-white/90 text-[#475569] transition-colors hover:border-[#93c5fd] hover:text-brand-navy"
        >
          {expanded ? <Minimize2 className="size-3.5" strokeWidth={2.3} /> : <Maximize2 className="size-3.5" strokeWidth={2.3} />}
        </button>
      </div>
      <div className="mt-1.5 flex justify-between gap-2 text-[11.5px] text-[#8a96a8]">
        <span>Saved in uppercase</span>
        <span className="font-bold text-[#3b82f6]">
          {text.length} {text.length === 1 ? "character" : "characters"}
        </span>
      </div>
      {error && (
        <p role="alert" className="m-0 mt-2 text-[12.5px] font-semibold text-[#dc2626]">
          {error}
        </p>
      )}
      <div className="mt-(--gap) flex flex-wrap items-center justify-end gap-2">
        <Dialog.Close asChild>
          <SoftButton disabled={saving} className="h-[38px] min-w-[112px] px-[22px] text-[13.5px] disabled:cursor-not-allowed disabled:opacity-60">
            Cancel
          </SoftButton>
        </Dialog.Close>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className={cn(
            primaryButtonClass,
            "h-[38px] min-w-[112px] whitespace-nowrap px-[22px] text-[13.5px] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:brightness-100"
          )}
        >
          <Check className="size-[15px]" strokeWidth={2.5} />
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </>
  );
}
