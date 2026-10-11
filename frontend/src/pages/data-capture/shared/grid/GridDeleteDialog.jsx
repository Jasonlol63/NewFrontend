import { useState } from "react";
import { Dialog } from "radix-ui";
import { cn } from "@/lib/utils";
import { SoftButton, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";

const OPTIONS = [
  { value: "left", label: "Shift cells left" },
  { value: "up", label: "Shift cells up" },
  { value: "row", label: "Entire row" },
  { value: "col", label: "Entire column" },
];

/**
 * "Delete" of the sheet menu (like a spreadsheet): what happens to the selected cells.
 * columns: false hides "Entire column" (the Bank sheet keeps its columns).
 * onConfirm gets "left" | "up" | "row" | "col"; onClosed runs once it is closed (the caller takes the keyboard back).
 */
export default function GridDeleteDialog({ open, onOpenChange, columns = true, onConfirm, onClosed }) {
  const [choice, setChoice] = useState("left");
  const options = columns ? OPTIONS : OPTIONS.filter((o) => o.value !== "col");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {/* In full screen only the full-screen element is drawn, so the dialog goes inside it. */}
      <Dialog.Portal container={document.fullscreenElement ?? undefined}>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-dialog-overlay bg-[rgba(20,51,107,0.22)] backdrop-blur-[6px] motion-reduce:animate-none" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            onClosed?.();
          }}
          className="fixed left-1/2 top-1/2 z-50 w-[clamp(280px,20vw,340px)] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 animate-dialog-in rounded-[20px] bg-white px-6 pb-5 pt-5 shadow-[0_30px_60px_-20px_rgba(20,51,107,0.45),0_8px_20px_-10px_rgba(20,70,160,0.25)] outline-none motion-reduce:animate-none"
        >
          <Dialog.Title className="m-0 mb-3 text-[17px] font-bold text-brand-navy">Delete</Dialog.Title>
          <div role="radiogroup" className="flex flex-col gap-1">
            {options.map((o) => (
              <label
                key={o.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-transparent px-2.5 py-2 text-[13.5px] font-semibold text-[#374151] hover:bg-[#eef4ff]",
                  choice === o.value && "border-[#7fb2ff] bg-row-stripe text-brand-navy"
                )}
              >
                <input type="radio" name="delete-option" value={o.value} checked={choice === o.value} onChange={() => setChoice(o.value)} className="size-4 accent-[#2563eb]" />
                {o.label}
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <SoftButton className="h-9 min-w-[88px] px-5" onClick={() => onOpenChange(false)}>Cancel</SoftButton>
            <button
              type="button"
              onClick={() => {
                onConfirm(choice);
                onOpenChange(false);
              }}
              className={cn(primaryButtonClass, "h-9 min-w-[88px] px-5 text-[13px]")}
            >
              OK
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
