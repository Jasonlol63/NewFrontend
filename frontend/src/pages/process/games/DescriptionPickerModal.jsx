import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ListChecks, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import FormCard, { CardCount } from "@/components/shared/form-modal/FormCard.jsx";
import DeleteDialog from "@/components/shared/DeleteDialog.jsx";
import Toast from "@/components/shared/Toast.jsx";
import { useNotice } from "@/hooks/useNotice";
import { filterItems, toggleIn } from "@/components/shared/form-modal/listSelection";
import { TextInput, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";
import { useCellTip } from "@/components/shared/list/CellTip.jsx";

// Layout: >= 900px two cards side by side (Selected | Add + Available), < 900px one column (Available, Selected).
const link = "flex-none cursor-pointer whitespace-nowrap rounded-md border-none bg-transparent px-1.5 py-1 fm-btn-sm hover:bg-[#eef4ff]";

/**
 * Select or Add Description: opened from the + of Add Process, on top of it (full content area, sidebar stays).
 * items: [{ value, label }] every description; selected: Set of ids.
 * onAdd(name) / onDelete(id) save at once and throw on failure; the list in `items` follows.
 * onConfirm(selected) hands back the ticked ids.
 */
export default function DescriptionPickerModal({ items, selected: initialSelected, onAdd, onDelete, onClose, onConfirm }) {
  const { t } = useTranslation(["process", "common"]);
  const { toasts, push, dismiss } = useNotice(5000);
  // A description that is cut off shows in full in the same hover card as the tables (not the browser tooltip).
  const { cellTipHandlers, hideCellTip, cellTip } = useCellTip(true);
  const [selected, setSelected] = useState(() => new Set(initialSelected));
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState(null);

  const shown = useMemo(() => filterItems(items, query), [items, query]);
  const picked = items.filter((it) => selected.has(it.value));

  const [busy, setBusy] = useState(false);

  const add = async () => {
    const label = name.trim().toUpperCase();
    if (!label || busy) return;
    if (items.some((it) => it.label === label)) return push(t("errors.descExists", { name: label }), "error");
    setBusy(true);
    try {
      const item = await onAdd(label);
      setSelected((s) => new Set(s).add(item.value));
      setName("");
      push(t("toast.descAdded", { name: label }));
    } catch (err) {
      push(t("errors.descAdd"), "error", err.message);
    } finally {
      setBusy(false);
    }
  };
  const confirmDelete = async () => {
    const item = toDelete;
    setToDelete(null);
    try {
      await onDelete(item.value);
      push(t("toast.descDeleted", { name: item.label }));
    } catch (err) {
      push(t("errors.descDelete"), "error", err.message);
    }
  };

  return (
    <FormModal
      icon={ListChecks}
      title={t("desc.title")}
      saveLabel={
        <>
          {t("desc.confirm")}<span className="@max-[479px]/main:hidden">{t("desc.confirmSuffix")}</span> ({selected.size})
        </>
      }
      onClose={onClose}
      onSave={() => onConfirm?.(selected)}
      bodyClassName={cn(
        "grid grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] grid-rows-1",
        "@max-[899px]/main:flex @max-[899px]/main:flex-col @max-[899px]/main:overflow-y-auto @max-[899px]/main:[scrollbar-width:thin]"
      )}
    >
      <FormCard
        title={t("desc.selectedCard")}
        right={
          <>
            <CardCount>{t("desc.selectedCount", { count: selected.size })}</CardCount>
            {selected.size > 0 && (
              <button type="button" onClick={() => setSelected(new Set())} className={cn(link, "text-[#64748b]")}>
                {t("desc.clearAll")}
              </button>
            )}
          </>
        }
        body={false}
        className="@max-[899px]/main:order-2 @max-[899px]/main:min-h-[220px] @max-[899px]/main:flex-none"
      >
        {picked.length === 0 ? (
          <div className="grid min-h-0 flex-1 place-items-center p-4 text-center fm-empty text-[#8a96a8]">
            <span>
              {t("desc.none1")}
              <br />
              {t("desc.none2")}
            </span>
          </div>
        ) : (
          <div {...cellTipHandlers} onScroll={hideCellTip} className="min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-1.5">
              {picked.map((it) => (
                <div key={it.value} className="flex min-h-[34px] items-center gap-2.5 rounded-[9px] border border-[#bfd8ff] bg-row-stripe pl-2.5 pr-1 fm-btn-sm modal-tiny:min-h-[30px]">
                  <span data-fit="label" className="min-w-0 flex-1 truncate text-brand-navy">{it.label}</span>
                  <button
                    type="button"
                    aria-label={t("desc.removeOf", { label: it.label })}
                    onClick={() => setSelected((s) => toggleIn(s, it.value))}
                    className="flex size-6 flex-none cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-0 text-[#64748b] hover:bg-white/90 hover:text-[#ef4444]"
                  >
                    <X className="size-3.5" strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </FormCard>

      <FormCard
        title={t("desc.available")}
        right={<CardCount>{t("desc.total", { count: items.length })}</CardCount>}
        body={false}
        className="@max-[899px]/main:order-1 @max-[899px]/main:h-[460px] @max-[899px]/main:flex-none"
      >
        {/* Add New: one row (input + Add); the new name is ticked and goes to the top of the list. */}
        <div className="flex-none border-b border-modal-divider px-3.5 py-2.5 modal-compact:px-3 modal-compact:py-2">
          <div className="flex items-center gap-2">
            <TextInput
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder={t("desc.newPlaceholder")}
              aria-label={t("desc.newAria")}
              className="min-w-0 flex-1 uppercase"
            />
            <button type="button" onClick={add} disabled={busy} className={cn(primaryButtonClass, "h-9 disabled:cursor-wait disabled:opacity-60 flex-none px-3.5 fm-btn-sm modal-compact:h-[30px] modal-tiny:h-7")}>
              <Plus className="size-3.5" strokeWidth={2.6} />
              {t("desc.add")}
            </button>
          </div>
        </div>

        <div className="flex flex-none items-center gap-1.5 px-3.5 pt-2.5 modal-compact:px-3 modal-compact:pt-2">
          <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[9px] border border-modal-input-line bg-modal-input px-2.5 fm-input focus-within:border-[#3b82f6] modal-tiny:h-7">
            <Search className="size-3.5 flex-none text-dash-faint" strokeWidth={2.2} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("desc.search")} className="w-full min-w-0 bg-transparent text-[#111827] uppercase placeholder:normal-case outline-none placeholder:text-dash-faint" />
          </label>
          <button type="button" onClick={() => setSelected((s) => new Set([...s, ...shown.map((it) => it.value)]))} className={cn(link, "text-[#1d7bff]")}>
            {t("desc.selectAll")}
          </button>
        </div>

        <div {...cellTipHandlers} onScroll={hideCellTip} className="min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
          {shown.length === 0 ? (
            <div className="py-6 text-center fm-empty text-dash-faint">{t("desc.noMatches")}</div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-1.5">
              {shown.map((it) => {
                const on = selected.has(it.value);
                return (
                  <div
                    key={it.value}
                    className={cn(
                      "group flex min-h-[34px] min-w-0 items-center gap-0.5 rounded-[9px] border pr-1 fm-btn-sm transition-colors modal-tiny:min-h-[30px]",
                      on ? "border-[#bfd8ff] bg-row-stripe" : "border-white/55 bg-white/35 hover:bg-white/75"
                    )}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => setSelected((s) => toggleIn(s, it.value))}
                      className="flex min-h-[32px] min-w-0 flex-1 cursor-pointer items-center gap-2 border-none bg-transparent pl-2.5 pr-1 text-left"
                    >
                      <span className={cn("flex size-4 flex-none items-center justify-center rounded-[5px] border-[1.5px] text-white", on ? "border-transparent bg-brand-sweep" : "border-[#cbd5e1] bg-white")}>
                        {on && <Check className="size-2.5" strokeWidth={4} />}
                      </span>
                      <span data-fit="label" className={cn("min-w-0 flex-1 truncate", on ? "text-brand-navy" : "text-[#374151]")}>{it.label}</span>
                    </button>
                    {/* A ticked description is in use here, so it can't be deleted. */}
                    <button
                      type="button"
                      aria-label={t("desc.deleteOf", { label: it.label })}
                      disabled={on}
                      title={on ? t("desc.untickFirst") : t("desc.deleteOf", { label: it.label })}
                      onClick={() => setToDelete(it)}
                      className="flex size-5 flex-none cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-0 text-[#ef4444] hover:bg-[#fee2e2] disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent"
                    >
                      <X className="size-3" strokeWidth={3} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </FormCard>

      {cellTip}
      <Toast toasts={toasts} onClose={dismiss} />
      <DeleteDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)} names={toDelete ? [toDelete.label] : []} noun="description" onConfirm={confirmDelete} />
    </FormModal>
  );
}
