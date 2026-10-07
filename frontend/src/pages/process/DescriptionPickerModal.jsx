import { useMemo, useState } from "react";
import { Check, ListChecks, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import FormCard, { CardCount } from "@/components/shared/form-modal/FormCard.jsx";
import DeleteDialog from "@/components/shared/DeleteDialog.jsx";
import { filterItems, toggleIn } from "@/components/shared/form-modal/listSelection";
import { TextInput, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";

// Layout: >= 900px two cards side by side (Selected | Add + Available), < 900px one column (Available, Selected).
const link = "flex-none cursor-pointer whitespace-nowrap rounded-md border-none bg-transparent px-1.5 py-1 text-[12px] font-bold hover:bg-[#eef4ff]";

/**
 * Select or Add Description: opened from the + of Add Process, on top of it (full content area, sidebar stays).
 * items: [{ value, label }] every description; selected: Set of ids.
 * onAdd(name) / onDelete(id) save at once and throw on failure; the list in `items` follows.
 * onConfirm(selected) hands back the ticked ids.
 */
export default function DescriptionPickerModal({ items, selected: initialSelected, onAdd, onDelete, onClose, onConfirm }) {
  const [selected, setSelected] = useState(() => new Set(initialSelected));
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState(null);

  const shown = useMemo(() => filterItems(items, query), [items, query]);
  const picked = items.filter((it) => selected.has(it.value));

  const [busy, setBusy] = useState(false);

  const add = async () => {
    const label = name.trim().toUpperCase();
    if (!label || busy) return;
    if (items.some((it) => it.label === label)) return setError(`"${label}" already exists`);
    setBusy(true);
    try {
      const item = await onAdd(label);
      setSelected((s) => new Set(s).add(item.value));
      setName("");
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const confirmDelete = async () => {
    const item = toDelete;
    setToDelete(null);
    try {
      await onDelete(item.value);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <FormModal
      icon={ListChecks}
      title="Select or Add Description"
      saveLabel={
        <>
          Confirm<span className="@max-[479px]/main:hidden">&nbsp;Selection</span> ({selected.size})
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
        title="Selected Descriptions"
        right={
          <>
            <CardCount>{selected.size} selected</CardCount>
            {selected.size > 0 && (
              <button type="button" onClick={() => setSelected(new Set())} className={cn(link, "text-[#64748b]")}>
                Clear all
              </button>
            )}
          </>
        }
        body={false}
        className="@max-[899px]/main:order-2 @max-[899px]/main:min-h-[220px] @max-[899px]/main:flex-none"
      >
        {picked.length === 0 ? (
          <div className="grid min-h-0 flex-1 place-items-center p-4 text-center text-[12.5px] text-[#8a96a8]">
            <span>
              No descriptions selected.
              <br />
              Tick one from the list to add it here.
            </span>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-1.5">
              {picked.map((it) => (
                <div key={it.value} className="flex min-h-[34px] items-center gap-2.5 rounded-[9px] border border-[#bfd8ff] bg-row-stripe pl-2.5 pr-1 text-[12.5px] modal-tiny:min-h-[30px]">
                  <span title={it.label} className="min-w-0 flex-1 truncate font-extrabold text-brand-navy">{it.label}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${it.label}`}
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
        title="Available Descriptions"
        right={<CardCount>{items.length} total</CardCount>}
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
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="ENTER NEW DESCRIPTION NAME..."
              aria-label="New description name"
              className="min-w-0 flex-1 uppercase"
            />
            <button type="button" onClick={add} disabled={busy} className={cn(primaryButtonClass, "h-9 disabled:cursor-wait disabled:opacity-60 flex-none px-3.5 text-[12.5px] modal-compact:h-[30px] modal-tiny:h-7")}>
              <Plus className="size-3.5" strokeWidth={2.6} />
              Add
            </button>
          </div>
          {error && <p className="m-0 mt-1 ml-0.5 text-[11.5px] font-medium text-[#dc2626]">{error}</p>}
        </div>

        <div className="flex flex-none items-center gap-1.5 px-3.5 pt-2.5 modal-compact:px-3 modal-compact:pt-2">
          <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[9px] border border-modal-input-line bg-modal-input px-2.5 text-[12.5px] focus-within:border-[#3b82f6] modal-tiny:h-7">
            <Search className="size-3.5 flex-none text-dash-faint" strokeWidth={2.2} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search descriptions" className="w-full min-w-0 bg-transparent text-[#111827] outline-none placeholder:text-dash-faint" />
          </label>
          <button type="button" onClick={() => setSelected((s) => new Set([...s, ...shown.map((it) => it.value)]))} className={cn(link, "text-[#1d7bff]")}>
            Select all
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
          {shown.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-dash-faint">No matches</div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-1.5">
              {shown.map((it) => {
                const on = selected.has(it.value);
                return (
                  <div
                    key={it.value}
                    className={cn(
                      "group flex min-h-[34px] min-w-0 items-center gap-0.5 rounded-[9px] border pr-1 text-[12.5px] transition-colors modal-tiny:min-h-[30px]",
                      on ? "border-[#bfd8ff] bg-row-stripe" : "border-white/55 bg-white/35 hover:bg-white/75"
                    )}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      title={it.label}
                      onClick={() => setSelected((s) => toggleIn(s, it.value))}
                      className="flex min-h-[32px] min-w-0 flex-1 cursor-pointer items-center gap-2 border-none bg-transparent pl-2.5 pr-1 text-left"
                    >
                      <span className={cn("flex size-4 flex-none items-center justify-center rounded-[5px] border-[1.5px] text-white", on ? "border-transparent bg-brand-sweep" : "border-[#cbd5e1] bg-white")}>
                        {on && <Check className="size-2.5" strokeWidth={4} />}
                      </span>
                      <span className={cn("min-w-0 flex-1 truncate font-extrabold", on ? "text-brand-navy" : "text-[#374151]")}>{it.label}</span>
                    </button>
                    {/* A ticked description is in use here, so it can't be deleted. */}
                    <button
                      type="button"
                      aria-label={`Delete ${it.label}`}
                      disabled={on}
                      title={on ? "Untick it first to delete" : `Delete ${it.label}`}
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

      <DeleteDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)} names={toDelete ? [toDelete.label] : []} noun="description" onConfirm={confirmDelete} />
    </FormModal>
  );
}
