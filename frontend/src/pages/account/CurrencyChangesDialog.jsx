import { useState } from "react";
import { Dialog } from "radix-ui";
import { Redo2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { drawFirst, drawLate } from "@/components/shared/StatusDialog.jsx";

// Fixed-size confirmation shown by Save: currencies on the left, the accounts changed in the picked one on the
// right (only that grid scrolls). Click an account to undo it, click again to redo; nothing is final until Confirm.

const KEY_SEP = "\u0001";
const keyOf = (currency, id) => `${currency}${KEY_SEP}${id}`;

// Same motion language as the other dialogs: pops in, the triangle draws itself, one ripple, then a soft glow.
function WarningIcon() {
  return (
    <div aria-hidden="true" className="relative size-[38px] flex-none animate-status-pop motion-reduce:animate-none">
      <span className="pointer-events-none absolute -inset-1 animate-status-glow rounded-full bg-[#ffe4b8] opacity-0 blur-[8px] motion-reduce:hidden" />
      <span className="pointer-events-none absolute inset-0 animate-status-ripple rounded-full border-[1.5px] border-[#f59e0b] opacity-0 motion-reduce:hidden" />
      <div className="absolute inset-0 grid place-items-center rounded-full bg-[#fff4e0] text-[#d97706] shadow-[0_0_0_6px_#fffaf0]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5 overflow-visible">
          <path className={drawFirst} pathLength="1" d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
          <path className={drawLate} pathLength="1" d="M12 9v4" />
          <circle className="animate-status-dot opacity-0 motion-reduce:animate-none motion-reduce:opacity-100" cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
        </svg>
      </div>
    </div>
  );
}

const pillClass = {
  removed: "border-[#fecaca] bg-[#fff5f5] text-[#b91c1c]",
  added: "border-[#a7f3d0] bg-[#ecfdf5] text-[#047857]",
  undone: "border-dashed border-[#e1e7ef] bg-[#f4f6f9] text-[#94a3b8]",
};

/**
 * changes: [{ currency, removed: [accountId], added: [accountId] }] (what Save would do)
 * accountsById: Map accountId -> { name }
 * onClose(restored): Back to edit / Esc; restored = [{ currency, accountId, kind }] the user undid (kind: "removed" | "added")
 * onConfirm(restored): Confirm & Save
 * Mount it only while open so every opening starts fresh.
 */
export default function CurrencyChangesDialog({ changes, accountsById, onClose, onConfirm }) {
  const [restored, setRestored] = useState(() => new Set());
  const [currency, setCurrency] = useState(changes[0]?.currency);
  const [tab, setTab] = useState(changes[0]?.removed.length ? "removed" : "added");

  const remaining = (c) => ({
    removed: c.removed.filter((id) => !restored.has(keyOf(c.currency, id))),
    added: c.added.filter((id) => !restored.has(keyOf(c.currency, id))),
  });
  const left = changes.map((c) => ({ ...c, left: remaining(c) }));
  const removedTotal = left.reduce((n, c) => n + c.left.removed.length, 0);
  const addedTotal = left.reduce((n, c) => n + c.left.added.length, 0);
  const total = removedTotal + addedTotal;
  const touched = left.filter((c) => c.left.removed.length + c.left.added.length).length;

  const current = changes.find((c) => c.currency === currency) ?? changes[0];
  const bothTabs = current.removed.length > 0 && current.added.length > 0;
  const shownTab = current[tab].length ? tab : tab === "removed" ? "added" : "removed";
  const ids = current[shownTab];
  const allUndone = ids.every((id) => restored.has(keyOf(current.currency, id)));

  const pick = (c) => {
    setCurrency(c.currency);
    setTab(c.removed.length ? "removed" : "added");
  };
  const toggle = (id) =>
    setRestored((s) => {
      const next = new Set(s);
      const key = keyOf(current.currency, id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleAll = () =>
    setRestored((s) => {
      const next = new Set(s);
      ids.forEach((id) => (allUndone ? next.delete(keyOf(current.currency, id)) : next.add(keyOf(current.currency, id))));
      return next;
    });
  const restoredList = () =>
    [...restored].map((key) => {
      const [c, accountId] = key.split(KEY_SEP);
      const kind = changes.find((x) => x.currency === c).removed.includes(accountId) ? "removed" : "added";
      return { currency: c, accountId, kind };
    });

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose(restoredList())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-dialog-overlay bg-[rgba(20,51,107,0.22)] backdrop-blur-[6px] motion-reduce:animate-none" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[clamp(340px,54vw,740px)] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 animate-dialog-in flex-col rounded-[20px] bg-white px-[clamp(16px,1.6vw,24px)] pb-[clamp(14px,2.2dvh,20px)] pt-[clamp(16px,2.6dvh,24px)] text-left shadow-[0_30px_60px_-20px_rgba(20,51,107,0.45),0_8px_20px_-10px_rgba(20,70,160,0.25)] outline-none motion-reduce:animate-none"
        >
          <div className="flex flex-none flex-wrap items-center gap-3">
            <WarningIcon />
            <Dialog.Title className="m-0 text-[clamp(16px,2.3dvh,18px)] font-bold tracking-[-0.2px] text-brand-navy">Confirm changes</Dialog.Title>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {removedTotal > 0 && <SumChip className="bg-[#fee2e2] text-[#b91c1c]">{removedTotal} removed</SumChip>}
              {addedTotal > 0 && <SumChip className="bg-[#d1fae5] text-[#047857]">{addedTotal} added</SumChip>}
              <SumChip className="bg-[#eef3fb] text-[#475569]">
                {touched} {touched === 1 ? "currency" : "currencies"}
              </SumChip>
            </div>
          </div>

          <div className="mt-3.5 grid h-[min(360px,46dvh)] min-h-0 grid-cols-[clamp(120px,24%,170px)_minmax(0,1fr)] gap-3 max-[640px]:h-[min(380px,56dvh)] max-[640px]:grid-cols-1 max-[640px]:grid-rows-[auto_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col gap-1 overflow-y-auto pr-1 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin] max-[640px]:flex-row max-[640px]:overflow-x-auto max-[640px]:overflow-y-hidden max-[640px]:pb-1 max-[640px]:pr-0">
              {left.map((c) => {
                const on = c.currency === current.currency;
                const empty = c.left.removed.length + c.left.added.length === 0;
                return (
                  <button
                    key={c.currency}
                    type="button"
                    onClick={() => pick(c)}
                    className={cn(
                      "flex h-[38px] w-full flex-none cursor-pointer items-center gap-2 rounded-[10px] border px-2.5 text-left text-[13px] font-extrabold text-brand-navy max-[640px]:w-auto max-[640px]:min-w-[92px]",
                      on ? "border-[#7fb2ff] bg-row-stripe" : "border-transparent bg-transparent hover:bg-[#f1f6fd]",
                      empty && "opacity-45"
                    )}
                  >
                    {c.currency}
                    <span className="ml-auto flex gap-1.5 text-[11px] font-extrabold">
                      {c.left.removed.length > 0 && <span className="text-[#b91c1c]">−{c.left.removed.length}</span>}
                      {c.left.added.length > 0 && <span className="text-[#047857]">+{c.left.added.length}</span>}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex min-h-0 min-w-0 flex-col rounded-[14px] border border-[#e6edf8] bg-[#fafcff]">
              <div className="flex flex-none items-center gap-2 border-b border-[#e6edf8] px-2.5 py-2">
                <div className="inline-flex gap-0.5 rounded-[10px] bg-[#eef3fb] p-0.5">
                  {bothTabs ? (
                    <>
                      <TabButton on={shownTab === "removed"} tone="removed" onClick={() => setTab("removed")}>
                        Removed {current.removed.length}
                      </TabButton>
                      <TabButton on={shownTab === "added"} tone="added" onClick={() => setTab("added")}>
                        Added {current.added.length}
                      </TabButton>
                    </>
                  ) : (
                    <TabButton on tone={shownTab} disabled>
                      {shownTab === "removed" ? "Removed" : "Added"} {ids.length}
                    </TabButton>
                  )}
                </div>
                <span className="hidden min-w-0 truncate text-[11.5px] text-dash-faint min-[821px]:block">Click an account to undo</span>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="ml-auto inline-flex h-7 flex-none cursor-pointer items-center gap-1.5 rounded-lg border border-[#dbe5f3] bg-white px-2.5 text-xs font-bold text-brand-navy hover:bg-[#f1f6fd]"
                >
                  {allUndone ? <Redo2 className="size-3" strokeWidth={2.8} /> : <Undo2 className="size-3" strokeWidth={2.8} />}
                  {allUndone ? "Redo all" : "Undo all"}
                </button>
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(128px,1fr))] content-start gap-2 overflow-y-auto p-2.5 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
                {ids.map((id) => {
                  const undone = restored.has(keyOf(current.currency, id));
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggle(id)}
                      title={undone ? "Click to redo" : "Click to undo"}
                      className={cn(
                        "relative flex h-[46px] min-w-0 cursor-pointer flex-col justify-center rounded-[10px] border py-0 pl-[11px] pr-8 text-left transition-[background-color,opacity] hover:brightness-[0.97]",
                        undone ? pillClass.undone : pillClass[shownTab]
                      )}
                    >
                      <b className={cn("truncate text-[13px] font-extrabold", undone && "line-through")}>{id}</b>
                      <span className="truncate text-[10.5px] font-bold uppercase opacity-75">{accountsById.get(id)?.name}</span>
                      <i className={cn("absolute right-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-md", undone ? "bg-[#e6edf8] text-[#64748b]" : "bg-white/80")}>
                        {undone ? <Redo2 className="size-3" strokeWidth={2.8} /> : <Undo2 className="size-3" strokeWidth={2.8} />}
                      </i>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-3.5 flex flex-none gap-2.5">
            <Dialog.Close className="h-[clamp(36px,5dvh,42px)] flex-1 cursor-pointer rounded-xl border border-[#dbe5f3] bg-white text-sm font-semibold text-brand-navy outline-none transition-colors hover:bg-[#f5f8fd] focus-visible:ring-2 focus-visible:ring-brand-blue/40 focus-visible:ring-offset-2">
              Back to edit
            </Dialog.Close>
            <button
              type="button"
              disabled={!total}
              onClick={() => onConfirm(restoredList())}
              className="h-[clamp(36px,5dvh,42px)] flex-1 cursor-pointer rounded-xl border-none bg-[#e5484d] text-sm font-semibold text-white shadow-[0_6px_14px_-6px_rgba(229,72,77,0.6)] outline-none transition-colors hover:bg-[#d63b40] focus-visible:ring-2 focus-visible:ring-[#e5484d]/45 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:bg-[#e5484d]"
            >
              {total ? `Confirm & Save (${total})` : "Nothing to save"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SumChip({ className, children }) {
  return <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-extrabold", className)}>{children}</span>;
}

function TabButton({ on, tone, className, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "h-[26px] cursor-pointer whitespace-nowrap rounded-lg border-none px-3 text-xs font-extrabold disabled:cursor-default",
        on ? cn("bg-white shadow-[0_1px_4px_rgba(20,51,107,0.15)]", tone === "removed" ? "text-[#b91c1c]" : "text-[#047857]") : "bg-transparent text-[#64748b]",
        className
      )}
    >
      {children}
    </button>
  );
}
