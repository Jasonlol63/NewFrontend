import { useState } from "react";
import { Dialog } from "radix-ui";
import { Check, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { SoftButton, inputClass, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";

// The same shell and spacing variables as DeleteDialog, only wider for the text box. The buttons are the ones of the
// Add / Edit modals' footer (Cancel soft, Save the blue gradient with its tick, right-aligned), not the half-width pair.
const FLUID = {
  width: "clamp(320px, 26vw, 440px)",
  "--pad-x": "clamp(20px, 1.5vw, 28px)",
  "--pad-y": "clamp(20px, 3.4dvh, 30px)",
  "--gap": "clamp(14px, 2.4dvh, 22px)",
};

/**
 * Remark of one Bank Process, edited on its own (the backend has a separate endpoint for it).
 * row: the process being edited (null = closed); onSave(row, remark) saves and throws on failure, the message
 * stays in the dialog; the dialog closes after a successful save.
 */
export default function BankRemarkDialog({ row, onClose, onSave }) {
  return (
    <Dialog.Root open={Boolean(row)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-dialog-overlay bg-[rgba(20,51,107,0.22)] backdrop-blur-[6px] motion-reduce:animate-none" />
        <Dialog.Content
          style={FLUID}
          className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-32px)] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 animate-dialog-in overflow-y-auto rounded-[20px] bg-white px-(--pad-x) pb-[calc(var(--pad-y)*0.75)] pt-(--pad-y) shadow-[0_30px_60px_-20px_rgba(20,51,107,0.45),0_8px_20px_-10px_rgba(20,70,160,0.25)] outline-none motion-reduce:animate-none"
        >
          {/* Mounted only while a row is open, so every opening starts from that row's remark. */}
          {row && <RemarkForm row={row} onClose={onClose} onSave={onSave} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RemarkForm({ row, onClose, onSave }) {
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
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid size-9 flex-none place-items-center rounded-full bg-[#eaf3ff] text-[#2563eb]">
          <MessageSquare className="size-[18px]" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <Dialog.Title className="m-0 text-[clamp(16px,2.3dvh,18px)] font-bold tracking-[-0.2px] text-brand-navy">Remark</Dialog.Title>
          <Dialog.Description className="m-0 truncate text-[12.5px] text-[#5b74a3]">
            {row.supplier} · {row.bank} · {row.cardOwner}
          </Dialog.Description>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="ENTER REMARKS..."
        autoFocus
        rows={5}
        className={`${inputClass} h-auto resize-none py-2 uppercase leading-snug`}
      />
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
