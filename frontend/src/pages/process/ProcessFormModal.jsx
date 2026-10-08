import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FilePen, FilePlus2, Layers, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import FormCard from "@/components/shared/form-modal/FormCard.jsx";
import { Field, SelectField, SoftButton, TextInput, ToggleSwitch, inputClass, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";
import { filterItems, toggleIn } from "@/components/shared/form-modal/listSelection";
import { ByTag } from "@/components/shared/form-modal/RecordBar.jsx";
import { formatRecordTime } from "@/components/shared/form-modal/recordTime.js";
import { DAYS } from "./processRules";
import { MOCK_CURRENCIES } from "./processFormOptions";
import { useProcessDescriptions } from "./useProcessDescriptions";
import DescriptionPickerModal from "./DescriptionPickerModal.jsx";

// Layout, from the content area width (@container/main = screen minus sidebar):
//   >= 900px: 2 columns, Information on the left | Text & Replacement over Schedule on the right
//   < 900px (portrait tablets / phones): one column, the whole body scrolls
// Class names are written out in full so Tailwind can see them.

const ALL_DAYS = DAYS.map((d) => d.day);

/**
 * Add Process / Edit Process: same modal shell as Add Account, with the Information / Text & Replacement / Schedule cards.
 * mode: "add" | "edit"; process: the list row being edited (edit mode, adds the Record section and hides Copy From / Multi-Process).
 * processes: the list rows of the picked company, for "Copy From".
 * Descriptions come from the process description API; currencies are placeholders and Save just hands the draft back through onSave (UI only for now).
 */
export default function ProcessFormModal({ mode = "add", process, tenantId, processes = [], onClose, onSave }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    copyFrom: "",
    code: isEdit ? (process?.code ?? "") : "",
    currency: isEdit ? (process?.currency ?? "") : "",
    saveDataCapture: isEdit ? Boolean(process?.enableSaveDraft) : false,
    removeWord: isEdit ? (process?.removeWord ?? "") : "",
    replaceFrom: isEdit ? (process?.replaceFrom ?? "") : "",
    replaceTo: isEdit ? (process?.replaceTo ?? "") : "",
    remark: isEdit ? (process?.remark ?? "") : "",
  });
  const [descriptions, setDescriptions] = useState(() => new Set(isEdit ? (process?.descriptionIds ?? []) : []));
  const [days, setDays] = useState(() => new Set(isEdit ? (process?.days ?? []) : []));
  const descriptionList = useProcessDescriptions(tenantId);
  const [picker, setPicker] = useState(false);
  // Multi-Process (Add only): pick existing process IDs instead of typing one.
  const [multi, setMulti] = useState(false);
  // Multi-Process is open (ticking) or folded into a summary of chips (after Done).
  const [multiOpen, setMultiOpen] = useState(false);
  const [multiCodes, setMultiCodes] = useState(() => new Set());
  const existingCodes = useMemo(() => [...new Set(processes.map((p) => p.code).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })).map((code) => ({ value: code, label: code })), [processes]);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const copyOptions = processes.map((p) => ({ value: String(p.id), label: p.description ? `${p.code} (${p.description})` : p.code }));

  const save = () => onSave?.({ ...form, multiCodes: multi ? [...multiCodes] : [], descriptions: [...descriptions], days: [...days].sort((a, b) => a - b) });

  return (
    <FormModal
      icon={isEdit ? FilePen : FilePlus2}
      title={isEdit ? "Edit Process" : "Add Process"}
      saveLabel={isEdit ? "Update Process" : "Add Process"}
      onClose={onClose}
      onSave={save}
      bodyClassName={cn(
        "grid grid-cols-2 grid-rows-1",
        "@max-[899px]/main:flex @max-[899px]/main:flex-col @max-[899px]/main:overflow-y-auto @max-[899px]/main:[scrollbar-width:thin]"
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-col gap-(--gap) @max-[899px]/main:contents">
      <FormCard title="Information" className="flex-1 @max-[899px]/main:flex-none @max-[899px]/main:overflow-visible" bodyClassName="flex flex-col @max-[899px]/main:overflow-visible">
        <div className="flex min-h-0 flex-1 flex-col gap-3 modal-compact:gap-2 modal-tiny:gap-1.5">
          {!isEdit && (
            <Field label="Copy From" optional>
              <SelectField value={form.copyFrom} onChange={(copyFrom) => setForm((f) => ({ ...f, copyFrom }))} options={copyOptions} placeholder="Select Process to Copy From" />
            </Field>
          )}

          {multi ? (
            <MultiProcessPanel items={existingCodes} selected={multiCodes} onChange={setMultiCodes} open={multiOpen} onOpen={() => setMultiOpen(true)} onDone={() => setMultiOpen(false)} onBack={() => setMulti(false)} />
          ) : (
            <Field label="Process ID">
              <div className="flex items-center gap-2">
                <TextInput value={form.code} onChange={setField("code")} autoComplete="off" placeholder="ENTER PROCESS ID" className="min-w-0 flex-1 uppercase" />
                {!isEdit && (
                  <MultiButton
                    onClick={() => {
                      setMulti(true);
                      setMultiOpen(true);
                    }}
                  />
                )}
              </div>
            </Field>
          )}

          <Field label="Currency">
            <SelectField value={form.currency} onChange={(currency) => setForm((f) => ({ ...f, currency }))} options={MOCK_CURRENCIES} placeholder="Select Currency" />
          </Field>

        <div>
          <div className="mb-1 ml-0.5 flex items-center justify-between">
            <span className="text-[12.5px] font-semibold text-[#374151]">Description <i className="not-italic text-[#ef4444]">*</i></span>
            <button type="button" onClick={() => setPicker(true)} className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-lg border border-[#7fb2ff] bg-white/70 pl-1.5 pr-2.5 text-[12px] font-bold text-[#1d4ed8] hover:bg-white">
              <Plus className="size-3.5" strokeWidth={2.8} />
              Add
            </button>
          </div>
          <DescriptionBox items={descriptionList.items} selected={descriptions} onChange={setDescriptions} onOpen={() => setPicker(true)} />
        </div>

          <div className="flex items-center justify-between gap-3 pt-0.5">
            <span className="text-[12.5px] font-semibold text-[#374151] modal-compact:text-[12px]">Save Data Capture Table</span>
            <ToggleSwitch on={form.saveDataCapture} onToggle={() => setForm((f) => ({ ...f, saveDataCapture: !f.saveDataCapture }))} label={form.saveDataCapture ? "On" : "Off"} className="font-bold" />
          </div>
          {isEdit && <RecordSection process={process} />}
        </div>
      </FormCard>

      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-(--gap) @max-[899px]/main:contents">
        <FormCard title="Text & Replacement" className="flex-1 @max-[899px]/main:flex-none @max-[899px]/main:overflow-visible" bodyClassName="flex flex-col @max-[899px]/main:overflow-visible">
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 modal-compact:gap-1.5">
            <Field label="Remove Word" optional className="flex min-h-[64px] flex-1 flex-col">
              <textarea value={form.removeWord} onChange={setField("removeWord")} autoComplete="off" className={cn(inputClass, "min-h-[40px] flex-1 resize-none py-2 leading-snug modal-compact:h-auto modal-tiny:h-auto @min-[900px]/main:@max-[1099px]/main:h-auto")} />
              <Hint>For multiple words, use commas (,). To match only one exact word, put = before it.</Hint>
            </Field>
            <div className="grid grid-cols-2 gap-x-3 @max-[599px]/main:grid-cols-1 @max-[599px]/main:gap-y-2.5">
              <Field label="Replace From" optional>
                <TextInput value={form.replaceFrom} onChange={setField("replaceFrom")} autoComplete="off" placeholder="OLD WORD" className="uppercase" />
                <Hint>Word to be replaced</Hint>
              </Field>
              <Field label="Replace To" optional>
                <TextInput value={form.replaceTo} onChange={setField("replaceTo")} autoComplete="off" placeholder="NEW WORD" className="uppercase" />
                <Hint>Replacement word</Hint>
              </Field>
            </div>
          </div>
        </FormCard>

        <FormCard title="Schedule" className="flex-[1.15] @max-[899px]/main:flex-none @max-[899px]/main:overflow-visible" bodyClassName="flex flex-col @max-[899px]/main:overflow-visible">
          <Field label="Day Use" as="div">
            <DayBar days={days} onChange={setDays} />
          </Field>
          <Field label="Remarks" optional className="mt-2.5 flex min-h-[72px] flex-1 flex-col modal-compact:mt-1.5">
            <textarea
              value={form.remark}
              onChange={setField("remark")}
              placeholder="ENTER REMARKS..."
              className={cn(inputClass, "min-h-[48px] flex-1 resize-none py-2 uppercase leading-snug modal-compact:h-auto modal-tiny:h-auto @min-[900px]/main:@max-[1099px]/main:h-auto")}
            />
          </Field>
        </FormCard>
      </div>
      {picker && (
        <DescriptionPickerModal
          items={descriptionList.items}
          selected={descriptions}
          onAdd={descriptionList.add}
          onDelete={descriptionList.remove}
          onClose={() => setPicker(false)}
          onConfirm={(selected) => {
            setDescriptions(selected);
            setPicker(false);
          }}
        />
      )}
    </FormModal>
  );
}

function Hint({ children }) {
  return <span className="mt-1 ml-0.5 block text-[11px] italic leading-snug text-[#8a96a8] modal-tiny:mt-0.5">{children}</span>;
}

// ALL DAY + MON ... SUN as one thin segmented bar; several days can be on. ALL DAY lights when all seven are.
function DayBar({ days, onChange }) {
  const all = days.size === ALL_DAYS.length;
  const item = (on) =>
    cn(
      "h-[26px] min-w-0 cursor-pointer truncate rounded-[7px] border-none px-1 text-[12px] font-bold transition-colors modal-compact:h-6 modal-tiny:h-[22px] modal-tiny:text-[11.5px]",
      on ? "bg-brand-sweep text-white shadow-[0_4px_10px_-4px_rgba(20,90,220,0.6)]" : "bg-transparent text-[#64748b] hover:bg-white/60 hover:text-brand-navy"
    );
  return (
    <div className="grid grid-cols-[1.5fr_repeat(7,1fr)] gap-0.5 rounded-[10px] border border-modal-off-line bg-white/45 p-0.5 @max-[599px]/main:grid-cols-4">
      <button type="button" aria-pressed={all} onClick={() => onChange(all ? new Set() : new Set(ALL_DAYS))} className={cn(item(all), "@max-[599px]/main:col-span-4")}>
        ALL DAY
      </button>
      {DAYS.map(({ day, full }) => (
        <button key={day} type="button" title={full} aria-pressed={days.has(day)} onClick={() => onChange(toggleIn(days, day))} className={item(days.has(day))}>
          {full.slice(0, 3).toUpperCase()}
        </button>
      ))}
    </div>
  );
}

const chip =
  "inline-flex h-[26px] flex-none items-center gap-1.5 rounded-[7px] border border-[#7fb2ff] bg-row-stripe pl-2.5 pr-1 text-[12px] font-extrabold text-brand-navy modal-compact:h-[22px]";

// A box that takes the room left in the card: picked descriptions wrap inside it, the + opens the picker.
function DescriptionBox({ items, selected, onChange, onOpen }) {
  const picked = items.filter((it) => selected.has(it.value));
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Select descriptions"
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className={cn(inputClass, "flex h-[clamp(84px,13dvh,140px)] cursor-pointer flex-wrap content-start items-start gap-1 overflow-y-auto py-1.5 [scrollbar-width:thin] hover:border-[#93c5fd] modal-compact:h-[72px] modal-compact:py-1 modal-tiny:h-16")}
    >
      {picked.length === 0 && <span className="pt-1 pl-0.5 text-dash-faint">No descriptions selected</span>}
      {picked.map((it) => (
        <span key={it.value} className={chip}>
          {it.label}
          <button
            type="button"
            aria-label={`Remove ${it.label}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange(toggleIn(selected, it.value));
            }}
            className="flex size-4 cursor-pointer items-center justify-center rounded-[5px] border-none bg-transparent p-0 text-[#64748b] hover:bg-white/90 hover:text-[#ef4444]"
          >
            <X className="size-3" strokeWidth={3} />
          </button>
        </span>
      ))}
    </div>
  );
}

// Edit only, inside the Information card: who last changed the process and who created it, one per row, read-only.
function RecordSection({ process }) {
  const rows = [
    { label: "Modified", at: process?.updatedAt, by: process?.updatedBy },
    { label: "Created", at: process?.createdAt, by: process?.createdBy },
  ];
  return (
    <div className="mt-1 border-t border-modal-divider pt-3 modal-compact:pt-2">
      <h3 className="m-0 mb-2 text-[13px] font-extrabold uppercase tracking-[0.6px] text-[#64748b] modal-compact:mb-1 modal-compact:text-[12px]">Record</h3>
      <div className="flex flex-col gap-3 modal-compact:gap-1.5">
        {rows.map((r) => (
          <Field key={r.label} label={r.label} plain as="div">
            <div className={cn(inputClass, "flex items-center justify-between gap-2 bg-modal-off text-[13px] tabular-nums text-[#374151]")}>
              <span className="truncate">{formatRecordTime(r.at)}</span>
              {r.by && <ByTag>{r.by}</ByTag>}
            </div>
          </Field>
        ))}
      </div>
    </div>
  );
}

// Add only. Pressed = Multi-Process is on (the Process ID box lists existing processes); clicking it again goes back to typing one ID.
function MultiButton({ on, onClick, small }) {
  return (
    <SoftButton
      onClick={onClick}
      aria-label="Multi-Process"
      aria-pressed={Boolean(on)}
      title={on ? "Back to a single Process ID" : "Pick existing processes"}
      className={cn(small ? "h-6 rounded-lg px-2.5 text-[12px]" : "h-9 px-3.5 text-[12.5px] modal-compact:h-[30px] modal-tiny:h-7 @max-[479px]/main:px-2.5", on && "border-[#7fb2ff] bg-row-stripe text-[#1d4ed8]")}
    >
      <Layers className="size-3.5" strokeWidth={2.4} />
      <span className="@max-[479px]/main:hidden">Multi-Process</span>
    </SoftButton>
  );
}

const tileLink = "flex-none cursor-pointer whitespace-nowrap rounded-md border-none bg-transparent px-1.5 py-1 text-[12px] font-bold hover:bg-[#eef4ff]";

// Multi-Process (Add only), right where the Process ID box was. Open: a tall ticking area that pushes everything below it
// down (the card scrolls on short screens) until Done folds it into a summary of chips; the chips box or Select opens it again.
// The pressed Multi-Process button goes back to typing one ID.
function MultiProcessPanel({ items, selected, onChange, open, onOpen, onDone, onBack }) {
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const shown = filterItems(items, query);

  // Opening on a short screen: bring the whole area (list and Done) into view.
  useEffect(() => {
    if (open) rootRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);

  const head = (right) => (
    <div className="mb-1 ml-0.5 flex items-center justify-between gap-2">
      <span className="text-[12.5px] font-semibold text-[#374151] modal-compact:text-[12px]">
        Process ID <i className="not-italic text-[#ef4444]">*</i>
        <span className="ml-1.5 text-[11px] font-bold text-[#3b82f6]">{selected.size} selected</span>
      </span>
      <div className="flex items-center gap-1.5">
        {right}
        <MultiButton on onClick={onBack} small />
      </div>
    </div>
  );

  if (!open) {
    return (
      <div ref={rootRef}>
        {head(
          <button type="button" onClick={onOpen} className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-lg border border-[#7fb2ff] bg-white/70 pl-1.5 pr-2.5 text-[12px] font-bold text-[#1d4ed8] hover:bg-white">
            <Plus className="size-3.5" strokeWidth={2.8} />
            Add
          </button>
        )}
        <div
          role="button"
          tabIndex={0}
          aria-label="Select existing processes"
          onClick={onOpen}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
          className={cn(inputClass, "flex h-auto min-h-9 max-h-[64px] cursor-pointer flex-wrap content-start items-start gap-1 overflow-y-auto py-1.5 [scrollbar-width:thin] hover:border-[#93c5fd] modal-compact:h-auto modal-tiny:h-auto @min-[900px]/main:@max-[1099px]/main:h-auto modal-compact:min-h-[30px] modal-compact:max-h-[58px] modal-compact:py-1")}
        >
          {selected.size === 0 && <span className="pt-0.5 pl-0.5 text-dash-faint">No processes selected</span>}
          {[...selected].map((code) => (
            <span key={code} className={chip}>
              {code}
              <button
                type="button"
                aria-label={`Remove ${code}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(toggleIn(selected, code));
                }}
                className="flex size-4 cursor-pointer items-center justify-center rounded-[5px] border-none bg-transparent p-0 text-[#64748b] hover:bg-white/90 hover:text-[#ef4444]"
              >
                <X className="size-3" strokeWidth={3} />
              </button>
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      {head(null)}
      <div className="overflow-hidden rounded-[10px] border border-[#3b82f6] bg-modal-input shadow-[0_0_0_3px_rgba(59,130,246,0.15)]">
        <div className="flex items-center gap-1.5 border-b border-modal-divider p-1.5">
          <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[8px] border border-modal-input-line bg-white/60 px-2.5 text-[12.5px] focus-within:border-[#3b82f6] modal-compact:h-7">
            <Search className="size-3.5 flex-none text-dash-faint" strokeWidth={2.2} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search processes" className="w-full min-w-0 bg-transparent text-[#111827] outline-none placeholder:text-dash-faint" />
          </label>
          <button type="button" onClick={() => onChange(new Set([...selected, ...shown.map((it) => it.value)]))} className={cn(tileLink, "text-[#1d7bff]")}>
            Select all
          </button>
          <button type="button" onClick={() => onChange(new Set())} className={cn(tileLink, "text-[#64748b]")}>
            Clear
          </button>
        </div>
        <div className="h-[clamp(170px,30dvh,300px)] overflow-y-auto p-1.5 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin] modal-compact:h-[150px]">
          {shown.length === 0 ? (
            <div className="py-4 text-center text-[12px] text-dash-faint">{items.length ? "No matches" : "No existing processes yet"}</div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-1">
              {shown.map((it) => {
                const on = selected.has(it.value);
                return (
                  <button
                    key={it.value}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    title={it.label}
                    onClick={() => onChange(toggleIn(selected, it.value))}
                    className={cn(
                      "flex h-8 min-w-0 cursor-pointer items-center gap-2 rounded-lg border px-2 text-left text-[12.5px] transition-colors modal-compact:h-7",
                      on ? "border-[#bfd8ff] bg-row-stripe" : "border-white/55 bg-white/35 hover:bg-white/75"
                    )}
                  >
                    <span className={cn("flex size-4 flex-none items-center justify-center rounded-[5px] border-[1.5px] text-white", on ? "border-transparent bg-brand-sweep" : "border-[#cbd5e1] bg-white")}>
                      {on && <Check className="size-2.5" strokeWidth={4} />}
                    </span>
                    <span className={cn("min-w-0 flex-1 truncate font-extrabold", on ? "text-brand-navy" : "text-[#374151]")}>{it.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-modal-divider bg-white/40 px-2.5 py-1.5">
          <span className="text-[12px] font-semibold text-[#64748b]">
            <b className="text-brand-navy">{selected.size}</b> of {items.length} selected
          </span>
          <button type="button" onClick={onDone} className={cn(primaryButtonClass, "h-7 px-4 text-[12.5px]")}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
