import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Trash2, X } from "lucide-react";
import { Popover } from "radix-ui";
import { cn } from "@/lib/utils";
import Toast from "@/components/shared/Toast.jsx";
import { useNotice } from "@/hooks/useNotice";
import { AddButton, TextInput } from "@/components/shared/form-modal/fields.jsx";

/**
 * The "+" beside Country / Bank: a small popover under the button with a box to add a new one and the existing ones as
 * chips (click x to remove). items: [string]; onAdd(name) / onRemove(name) (async: when one throws, its message is shown in the popover); lockedReason(item): text when an item can't be
 * removed (shown as a lock in remove mode), or "". isOn(item) / onToggle(item): clicking a chip shows it in the select (blue) or hides it (grey); the Remove button switches the chips to remove mode. anchorEl: the select + button row (element), so the popup is as wide as that row. disabledReason: when set the button is greyed and shows it as its tooltip.
 */
export default function CountryBankAdder({ noun, title, hint, items, onAdd, onRemove, lockedReason, isOn, onToggle, disabledReason, anchorEl }) {
  const { t } = useTranslation("process");
  const { toasts, push, dismiss } = useNotice(5000);
  const nounText = t(`bank.adder.noun.${noun}`, { defaultValue: noun });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  // Remove mode: the chips turn into remove buttons instead of show / hide switches (so a stray click can't delete one).
  const [removing, setRemoving] = useState(false);
  // The popup is as wide as the select + button row; the button is the row's right end, so it hangs from there (align end).
  const [width, setWidth] = useState(0);

  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const next = name.trim().toUpperCase();
    if (!next) return push(t("bank.errors.enterName", { noun: nounText }), "error");
    if (items.some((i) => i.toUpperCase() === next)) return push(t("bank.errors.exists", { noun: nounText }), "error");
    if (busy) return;
    setBusy(true);
    try {
      await onAdd(next);
      setName("");
      push(noun === "country" ? t("bank.toast.countryAdded", { name: next }) : t("bank.toast.bankAdded", { name: next }));
    } catch (err) {
      push(t("bank.errors.adderAdd", { noun: nounText }), "error", err.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (item) => {
    if (busy) return;
    setBusy(true);
    try {
      await onRemove(item);
      push(noun === "country" ? t("bank.toast.countryRemoved", { name: item }) : t("bank.toast.bankRemoved", { name: item }));
    } catch (err) {
      push(t("bank.errors.adderRemove", { noun: nounText }), "error", err.message);
    } finally {
      setBusy(false);
    }
  };
  const handleOpenChange = (next) => {
    if (next && anchorEl) setWidth(anchorEl.getBoundingClientRect().width);
    setOpen(next);
    if (!next) {
      setName("");
      setRemoving(false);
    }
  };

  if (disabledReason) {
    return (
      <span title={disabledReason} className="flex-none">
        <AddButton label={t("bank.adder.addAria", { noun: nounText })} disabled />
      </span>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <AddButton label={t("bank.adder.addAria", { noun: nounText })} className={cn(open && "border-solid bg-[#d6e8ff]")} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={8}
          style={width ? { width } : undefined}
          className="z-50 max-h-(--radix-popover-content-available-height) max-w-[calc(100vw-16px)] min-w-[260px] overflow-y-auto uppercase [&_input]:uppercase rounded-xl border border-dash-line bg-white p-3 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.25)]"
        >
          <p className="m-0 text-[12.5px] font-bold text-brand-navy">{title}</p>
          {hint && <p className="m-0 mt-0.5 text-[11.5px] text-dash-sub">{hint}</p>}
          <div className="mt-2 flex items-center gap-1.5">
            <TextInput
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              autoComplete="off"
              placeholder={t("bank.adder.newPlaceholder", { noun: nounText.toUpperCase() })}
              className="h-8 min-w-0 flex-1 uppercase"
            />
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="h-8 flex-none cursor-pointer rounded-lg border-none bg-brand-sweep px-3 disabled:cursor-not-allowed disabled:opacity-60 text-[12.5px] font-bold text-white shadow-[0_6px_12px_-6px_rgba(20,90,220,0.6)] hover:brightness-105"
            >
              {t("bank.adder.add")}
            </button>
          </div>

          <div className="mt-3 mb-2 flex items-center justify-between gap-2">
            <p className="m-0 text-[11.5px] font-semibold text-dash-sub">
              {!items.length ? t("bank.adder.none") : removing ? t("bank.adder.removeMode") : t("bank.adder.existing")}
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
                {removing ? t("bank.adder.done") : t("bank.adder.remove")}
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
                      title={t("bank.adder.removeOf", { item })}
                      onClick={() => remove(item)}
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
                    title={on ? t("bank.adder.shown") : t("bank.adder.hidden")}
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
      <Toast toasts={toasts} onClose={dismiss} />
    </Popover.Root>
  );
}
