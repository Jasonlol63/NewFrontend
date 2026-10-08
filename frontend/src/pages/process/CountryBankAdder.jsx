import { useState } from "react";
import { Lock, Trash2, X } from "lucide-react";
import { Popover } from "radix-ui";
import { cn } from "@/lib/utils";
import { AddButton, TextInput } from "@/components/shared/form-modal/fields.jsx";

/**
 * The "+" beside Country / Bank: a small popover under the button with a box to add a new one and the existing ones as
 * chips (click x to remove). items: [string]; onAdd(name) / onRemove(name); lockedReason(item): text when an item can't be
 * removed (shown as a lock in remove mode), or "". isOn(item) / onToggle(item): clicking a chip shows it in the select (blue) or hides it (grey); the Remove button switches the chips to remove mode. anchorEl: the select + button row (element), so the popup is as wide as that row. disabledReason: when set the button is greyed and shows it as its tooltip.
 */
export default function CountryBankAdder({ noun, title, hint, items, onAdd, onRemove, lockedReason, isOn, onToggle, disabledReason, anchorEl }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  // Remove mode: the chips turn into remove buttons instead of show / hide switches (so a stray click can't delete one).
  const [removing, setRemoving] = useState(false);
  // The popup is as wide as the select + button row; the button is the row's right end, so it hangs from there (align end).
  const [width, setWidth] = useState(0);

  const submit = () => {
    const next = name.trim().toUpperCase();
    if (!next) return setError("Enter a " + noun + " name");
    if (items.some((i) => i.toUpperCase() === next)) return setError("That " + noun + " already exists");
    onAdd(next);
    setName("");
    setError("");
  };
  const handleOpenChange = (next) => {
    if (next && anchorEl) setWidth(anchorEl.getBoundingClientRect().width);
    setOpen(next);
    if (!next) {
      setName("");
      setError("");
      setRemoving(false);
    }
  };

  if (disabledReason) {
    return (
      <span title={disabledReason} className="flex-none">
        <AddButton label={"Add " + noun} disabled />
      </span>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <AddButton label={"Add " + noun} className={cn(open && "border-solid bg-[#d6e8ff]")} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={8}
          style={width ? { width } : undefined}
          className="z-50 max-h-(--radix-popover-content-available-height) max-w-[calc(100vw-16px)] min-w-[260px] overflow-y-auto rounded-xl border border-dash-line bg-white p-3 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.25)]"
        >
          <p className="m-0 text-[12.5px] font-bold text-brand-navy">{title}</p>
          {hint && <p className="m-0 mt-0.5 text-[11.5px] text-dash-sub">{hint}</p>}
          <div className="mt-2 flex items-center gap-1.5">
            <TextInput
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              autoComplete="off"
              placeholder={"NEW " + noun.toUpperCase()}
              className="h-8 w-[170px] min-w-0 flex-none uppercase"
            />
            <button
              type="button"
              onClick={submit}
              className="h-8 flex-none cursor-pointer rounded-lg border-none bg-brand-sweep px-3 text-[12.5px] font-bold text-white shadow-[0_6px_12px_-6px_rgba(20,90,220,0.6)] hover:brightness-105"
            >
              Add
            </button>
          </div>
          {error && <p className="m-0 mt-1 text-[11.5px] font-medium text-dash-down">{error}</p>}

          <div className="mt-3 mb-2 flex items-center justify-between gap-2">
            <p className="m-0 text-[11.5px] font-semibold text-dash-sub">
              {!items.length ? "None yet" : removing ? "Click a name to remove it" : "Existing, click to show or hide in the list"}
            </p>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => setRemoving((v) => !v)}
                className={cn(
                  "inline-flex h-7 flex-none cursor-pointer items-center gap-1 rounded-lg border px-2 text-[12px] font-bold transition-colors",
                  removing ? "border-transparent bg-[#fee2e2] text-[#dc2626] hover:bg-[#fecaca]" : "border-[#d5deea] bg-white text-dash-sub hover:border-[#fca5a5] hover:text-[#ef4444]"
                )}
              >
                <Trash2 className="size-3.5" strokeWidth={2.2} />
                {removing ? "Done" : "Remove"}
              </button>
            )}
          </div>
          {items.length > 0 && (
            <div className="flex max-h-[180px] flex-wrap gap-2 overflow-y-auto p-0.5">
              {items.map((item) => {
                const locked = lockedReason?.(item);
                const on = isOn(item);
                const chip = "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-bold transition-colors";
                if (removing) {
                  return locked ? (
                    <span key={item} title={locked} className={cn(chip, "cursor-not-allowed border-[#dbe2ec] bg-[#f1f5f9] text-[#94a3b8]")}>
                      {item}
                      <Lock className="size-3.5" strokeWidth={2.4} />
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      title={"Remove " + item}
                      onClick={() => onRemove(item)}
                      className={cn(chip, "cursor-pointer border-[#fca5a5] bg-[#fef2f2] text-[#dc2626] hover:bg-[#fee2e2]")}
                    >
                      {item}
                      <X className="size-3.5" strokeWidth={2.6} />
                    </button>
                  );
                }
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={on}
                    title={on ? "Shown in the list, click to hide" : "Hidden from the list, click to show"}
                    onClick={() => onToggle(item)}
                    className={cn(chip, "cursor-pointer", on ? "border-[#7fb2ff] bg-[#e8f1ff] text-[#1d4ed8] hover:bg-[#d6e8ff]" : "border-[#dbe2ec] bg-[#f1f5f9] text-[#94a3b8] hover:bg-[#e8edf3]")}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
