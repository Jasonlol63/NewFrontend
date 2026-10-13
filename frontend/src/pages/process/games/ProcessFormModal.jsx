import { useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Check, FilePen, FilePlus2, Layers, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import FormCard from "@/components/shared/form-modal/FormCard.jsx";
import Toast from "@/components/shared/Toast.jsx";
import { useNotice } from "@/hooks/useNotice";
import { Field, SelectField, SoftButton, TextInput, ToggleSwitch, inputClass, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";
import { filterItems, toggleIn } from "@/components/shared/form-modal/listSelection";
import { ByTag } from "@/components/shared/form-modal/RecordBar.jsx";
import { formatRecordTime } from "@/components/shared/form-modal/recordTime.js";
import { DAYS } from "./processRules";
import { buildProcessRequest, findProcessIdInUse, validateProcessForm } from "./processFormRules";
import { useProcessCurrencies } from "./useProcessCurrencies";
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
 * Currencies and descriptions come from the company's own lists. Copy From fills the form with the picked process's
 * values; everything stays editable and what is in the form on Save is what the new process gets (the backend only
 * adds the source's formulas). Multi-Process adds one process per picked Process ID, one request each.
 * Save hands the requests [{ url, code, body }] to onSave, which sends them and closes the modal; if it throws, the
 * message is shown in the footer (err.createdCodes: Multi-Process IDs that already went through).
 */
export default function ProcessFormModal({ mode = "add", process, tenantId, processes = [], onClose, onSave }) {
  const { t } = useTranslation(["process", "common"]);
  const { toasts, push, dismiss } = useNotice(5000);
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    copyFrom: "",
    code: isEdit ? (process?.code ?? "") : "",
    currency: isEdit ? String(process?.currencyId ?? "") : "", // currency id
    saveDataCapture: isEdit ? Boolean(process?.enableSaveDraft) : false,
    removeWord: isEdit ? (process?.removeWord ?? "") : "",
    replaceFrom: isEdit ? (process?.replaceFrom ?? "") : "",
    replaceTo: isEdit ? (process?.replaceTo ?? "") : "",
    remark: isEdit ? (process?.remark ?? "") : "",
  });
  const [descriptions, setDescriptions] = useState(() => new Set(isEdit ? (process?.descriptionIds ?? []) : []));
  const [days, setDays] = useState(() => new Set(isEdit ? (process?.days ?? []) : []));
  const descriptionList = useProcessDescriptions(tenantId);
  const currencies = useProcessCurrencies(tenantId);
  // Lists that did not load are error toasts (once per error).
  useEffect(() => {
    if (currencies.error) push(t("errors.currencies"), "error", currencies.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencies.error]);
  useEffect(() => {
    if (descriptionList.error) push(t("errors.descriptions"), "error", descriptionList.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptionList.error]);
  const [saving, setSaving] = useState(false);
  const labelById = useMemo(() => new Map(descriptionList.items.map((it) => [it.value, it.label])), [descriptionList.items]);
  const [picker, setPicker] = useState(false);
  // Multi-Process (Add only): pick existing process IDs instead of typing one.
  const [multi, setMulti] = useState(false);
  // Multi-Process is open (ticking) or folded into a summary of chips (after Done).
  const [multiOpen, setMultiOpen] = useState(false);
  const [multiCodes, setMultiCodes] = useState(() => new Set());
  const existingCodes = useMemo(() => [...new Set(processes.map((p) => p.code).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })).map((code) => ({ value: code, label: code })), [processes]);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  // Text replacement words are matched in capitals, so only capitals can be typed or pasted.
  const setUpper = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value.toUpperCase() }));
  // Only active processes can be copied.
  const copyOptions = processes.filter((p) => p.status === "active").map((p) => ({ value: String(p.id), label: p.description ? `${p.code} (${p.description})` : p.code }));

  // Process IDs are always upper case: converted as they are typed, keeping the cursor where it was.
  const setCode = (e) => {
    const input = e.target;
    const { selectionStart, selectionEnd } = input;
    setForm((f) => ({ ...f, code: input.value.toUpperCase() }));
    requestAnimationFrame(() => input.setSelectionRange(selectionStart, selectionEnd));
  };

  // Copy From: fill the form with the picked process's values. Clearing the pick keeps what is in the form.
  const pickCopyFrom = (copyFrom) => {
    const source = processes.find((p) => String(p.id) === copyFrom);
    setForm((f) => ({
      ...f,
      copyFrom,
      ...(source && {
        currency: String(source.currencyId ?? ""),
        saveDataCapture: source.enableSaveDraft,
        removeWord: source.removeWord,
        replaceFrom: source.replaceFrom,
        replaceTo: source.replaceTo,
        remark: source.remark,
      }),
    }));
    if (source) {
      setDescriptions(new Set(source.descriptionIds));
      setDays(new Set(source.days));
    }
  };

  const save = async () => {
    if (saving) return;
    const codes = isEdit ? [process.code] : multi ? [...multiCodes] : [form.code.trim().toUpperCase()].filter(Boolean);
    const problem = validateProcessForm({ isEdit, multi, codes, currencyId: form.currency, descriptionCount: descriptions.size });
    if (problem) {
      push(problem, "error");
      return;
    }
    // Same Process ID + same description twice is refused by the backend; say which one here, before sending.
    for (const code of codes) {
      const inUse = findProcessIdInUse(processes, code.toUpperCase(), descriptions, isEdit ? process.id : null, labelById);
      if (inUse) {
        push(inUse, "error");
        return;
      }
    }
    setSaving(true);
    const requests = codes.map((code) => buildProcessRequest({ isEdit, id: process?.id, code, tenantId, form, descriptions, days }));
    try {
      await onSave(requests); // closes the modal on success
    } catch (err) {
      // Multi-Process IDs that already went through are not picked again for a retry.
      if (err.createdCodes?.length) setMultiCodes((prev) => new Set([...prev].filter((c) => !err.createdCodes.includes(c))));
      push(err.title ?? (isEdit ? t("errors.update") : t("errors.add")), "error", err.toastDetail ?? err.message);
      setSaving(false);
    }
  };


  return (
    <FormModal
      icon={isEdit ? FilePen : FilePlus2}
      title={isEdit ? t("form.edit") : t("form.add")}
      saveLabel={isEdit ? t("form.update") : t("form.add")}
      onClose={onClose}
      onSave={save}
      saveDisabled={saving || currencies.loading}
      bodyClassName={cn(
        "grid grid-cols-2 grid-rows-1",
        "@max-[899px]/main:flex @max-[899px]/main:flex-col @max-[899px]/main:overflow-y-auto @max-[899px]/main:[scrollbar-width:thin]"
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-col gap-(--gap) @max-[899px]/main:contents">
      <FormCard title={t("form.info")} className="flex-1 @max-[899px]/main:flex-none @max-[899px]/main:overflow-visible" bodyClassName="flex flex-col @max-[899px]/main:overflow-visible">
        <div className="flex min-h-0 flex-1 flex-col gap-3 modal-compact:gap-2 modal-tiny:gap-1.5">
          {!isEdit && (
            <Field label={t("form.copyFrom")} optional>
              <SelectField value={form.copyFrom} onChange={pickCopyFrom} onClear={() => setForm((f) => ({ ...f, copyFrom: "" }))} options={copyOptions} placeholder={t("form.copyPlaceholder")} />
            </Field>
          )}

          {multi ? (
            <MultiProcessPanel items={existingCodes} selected={multiCodes} onChange={setMultiCodes} open={multiOpen} onOpen={() => setMultiOpen(true)} onDone={() => setMultiOpen(false)} onBack={() => setMulti(false)} />
          ) : (
            <Field label={t("form.code")}>
              <div className="flex items-center gap-2">
                {/* The backend never changes a Process ID once it is created. */}
                <TextInput
                  value={form.code}
                  onChange={setCode}
                  autoComplete="off"
                  autoCapitalize="characters"
                  disabled={isEdit}
                  placeholder={t("form.codePlaceholder")}
                  className="min-w-0 flex-1 uppercase disabled:cursor-not-allowed disabled:bg-modal-off disabled:text-dash-faint"
                />
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

          <Field label={t("form.currency")}>
            <SelectField value={form.currency} onChange={(currency) => setForm((f) => ({ ...f, currency }))} options={currencies.options} placeholder={t("form.selectCurrency")} />
          </Field>

        <div>
          <div className="mb-1 ml-0.5 flex items-center justify-between">
            <span className="fm-label text-[#374151]">{t("form.description")} <i className="not-italic text-[#ef4444]">*</i></span>
            <button type="button" onClick={() => setPicker(true)} className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-lg border border-[#7fb2ff] bg-white/70 pl-1.5 pr-2.5 fm-btn-sm text-[#1d4ed8] hover:bg-white">
              <Plus className="size-3.5" strokeWidth={2.8} />
              {t("form.add_button")}
            </button>
          </div>
          <DescriptionBox items={descriptionList.items} selected={descriptions} onChange={setDescriptions} onOpen={() => setPicker(true)} />
        </div>

          <div className="flex items-center justify-between gap-3 pt-0.5">
            <span className="fm-label text-[#374151]">{t("form.saveCapture")}</span>
            <ToggleSwitch on={form.saveDataCapture} onToggle={() => setForm((f) => ({ ...f, saveDataCapture: !f.saveDataCapture }))} label={form.saveDataCapture ? t("form.on") : t("form.off")} className="font-semibold" />
          </div>
          {isEdit && <RecordSection process={process} />}
        </div>
      </FormCard>

      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-(--gap) @max-[899px]/main:contents">
        <FormCard title={t("form.textCard")} className="flex-1 @max-[899px]/main:flex-none @max-[899px]/main:overflow-visible" bodyClassName="flex flex-col @max-[899px]/main:overflow-visible">
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 modal-compact:gap-1.5">
            <Field label={t("form.removeWord")} optional className="flex min-h-[64px] flex-1 flex-col">
              <textarea value={form.removeWord} onChange={setUpper("removeWord")} autoComplete="off" className={cn(inputClass, "uppercase","min-h-[40px] flex-1 resize-none py-2 leading-snug modal-compact:h-auto modal-tiny:h-auto @min-[900px]/main:@max-[1099px]/main:h-auto")} />
              <Hint>{t("form.removeHint")}</Hint>
            </Field>
            <div className="grid grid-cols-2 gap-x-3 @max-[599px]/main:grid-cols-1 @max-[599px]/main:gap-y-2.5">
              <Field label={t("form.replaceFrom")} optional>
                <TextInput value={form.replaceFrom} onChange={setUpper("replaceFrom")} autoComplete="off" placeholder={t("form.oldWord")} className="uppercase" />
                <Hint>{t("form.replaceFromHint")}</Hint>
              </Field>
              <Field label={t("form.replaceTo")} optional>
                <TextInput value={form.replaceTo} onChange={setUpper("replaceTo")} autoComplete="off" placeholder={t("form.newWord")} className="uppercase" />
                <Hint>{t("form.replaceToHint")}</Hint>
              </Field>
            </div>
          </div>
        </FormCard>

        <FormCard title={t("form.schedule")} className="flex-[1.15] @max-[899px]/main:flex-none @max-[899px]/main:overflow-visible" bodyClassName="flex flex-col @max-[899px]/main:overflow-visible">
          <Field label={t("form.dayUse")} as="div">
            <DayBar days={days} onChange={setDays} />
          </Field>
          <Field label={t("form.remarks")} optional className="mt-2.5 flex min-h-[72px] flex-1 flex-col modal-compact:mt-1.5">
            <textarea
              value={form.remark}
              onChange={setField("remark")}
              placeholder={t("form.remarksPlaceholder")}
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
      <Toast toasts={toasts} onClose={dismiss} />
    </FormModal>
  );
}

function Hint({ children }) {
  return <span className="mt-1 ml-0.5 block fm-help italic leading-snug text-[#8a96a8] modal-tiny:mt-0.5">{children}</span>;
}

// ALL DAY + MON ... SUN as one thin segmented bar; several days can be on. ALL DAY lights when all seven are.
function DayBar({ days, onChange }) {
  const { t } = useTranslation("process");
  const all = days.size === ALL_DAYS.length;
  const item = (on) =>
    cn(
      "h-[26px] min-w-0 cursor-pointer truncate rounded-[7px] border-none px-1 fm-btn-sm transition-colors modal-compact:h-6 modal-tiny:h-[22px]",
      on ? "bg-brand-sweep text-white shadow-[0_4px_10px_-4px_rgba(20,90,220,0.6)]" : "bg-transparent text-[#64748b] hover:bg-white/60 hover:text-brand-navy"
    );
  return (
    <div className="grid grid-cols-[1.5fr_repeat(7,1fr)] gap-0.5 rounded-[10px] border border-modal-off-line bg-white/45 p-0.5 @max-[599px]/main:grid-cols-4">
      <button type="button" aria-pressed={all} onClick={() => onChange(all ? new Set() : new Set(ALL_DAYS))} className={cn(item(all), "@max-[599px]/main:col-span-4")}>
        {t("form.allDay")}
      </button>
      {DAYS.map(({ day }) => (
        <button key={day} type="button" title={t(`days.${day}.full`)} aria-pressed={days.has(day)} onClick={() => onChange(toggleIn(days, day))} className={item(days.has(day))}>
          {t(`days.${day}.abbr`)}
        </button>
      ))}
    </div>
  );
}

const chip =
  "inline-flex h-[26px] flex-none items-center gap-1.5 rounded-[7px] border border-[#7fb2ff] bg-row-stripe pl-2.5 pr-1 fm-btn-sm text-brand-navy modal-compact:h-[22px]";

// A box that takes the room left in the card: picked descriptions wrap inside it, the + opens the picker.
function DescriptionBox({ items, selected, onChange, onOpen }) {
  const { t } = useTranslation("process");
  const picked = items.filter((it) => selected.has(it.value));
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t("form.selectDescriptions")}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className={cn(inputClass, "flex h-[clamp(84px,13dvh,140px)] cursor-pointer flex-wrap content-start items-start gap-1 overflow-y-auto py-1.5 [scrollbar-width:thin] hover:border-[#93c5fd] modal-compact:h-[72px] modal-compact:py-1 modal-tiny:h-16")}
    >
      {picked.length === 0 && <span className="pt-1 pl-0.5 text-dash-faint">{t("form.noDescriptions")}</span>}
      {picked.map((it) => (
        <span key={it.value} className={chip}>
          {it.label}
          <button
            type="button"
            aria-label={t("form.removeOf", { label: it.label })}
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
  const { t } = useTranslation("process");
  const rows = [
    { label: t("form.modified"), at: process?.updatedAt, by: process?.updatedBy },
    { label: t("form.created"), at: process?.createdAt, by: process?.createdBy },
  ];
  return (
    <div className="mt-1 border-t border-modal-divider pt-3 modal-compact:pt-2">
      <h3 className="m-0 mb-2 fm-label tracking-[0.6px] text-[#64748b] modal-compact:mb-1">{t("form.record")}</h3>
      <div className="flex flex-col gap-3 modal-compact:gap-1.5">
        {rows.map((r) => (
          <Field key={r.label} label={r.label} plain as="div">
            <div className={cn(inputClass, "flex items-center justify-between gap-2 bg-modal-off fm-input tabular-nums text-[#374151]")}>
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
  const { t } = useTranslation("process");
  return (
    <SoftButton
      onClick={onClick}
      aria-label={t("form.multi")}
      aria-pressed={Boolean(on)}
      title={on ? t("form.multiBack") : t("form.multiPick")}
      className={cn(small ? "h-6 rounded-lg px-2.5 fm-btn-sm" : "h-9 px-3.5 fm-btn-sm modal-compact:h-[30px] modal-tiny:h-7 @max-[479px]/main:px-2.5", on && "border-[#7fb2ff] bg-row-stripe text-[#1d4ed8]")}
    >
      <Layers className="size-3.5" strokeWidth={2.4} />
      <span className="@max-[479px]/main:hidden">{t("form.multi")}</span>
    </SoftButton>
  );
}

const tileLink = "flex-none cursor-pointer whitespace-nowrap rounded-md border-none bg-transparent px-1.5 py-1 fm-btn-sm hover:bg-[#eef4ff]";

// Multi-Process (Add only), right where the Process ID box was. Open: a tall ticking area that pushes everything below it
// down (the card scrolls on short screens) until Done folds it into a summary of chips; the chips box or Select opens it again.
// The pressed Multi-Process button goes back to typing one ID.
function MultiProcessPanel({ items, selected, onChange, open, onOpen, onDone, onBack }) {
  const { t } = useTranslation("process");
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const shown = filterItems(items, query);

  // Opening on a short screen: bring the whole area (list and Done) into view.
  useEffect(() => {
    if (open) rootRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);

  const head = (right) => (
    <div className="mb-1 ml-0.5 flex items-center justify-between gap-2">
      <span className="fm-label text-[#374151]">
        Process ID <i className="not-italic text-[#ef4444]">*</i>
        <span className="ml-1.5 fm-opt font-semibold! text-[#3b82f6]">{t("form.selectedCount", { count: selected.size })}</span>
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
          <button type="button" onClick={onOpen} className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-lg border border-[#7fb2ff] bg-white/70 pl-1.5 pr-2.5 fm-btn-sm text-[#1d4ed8] hover:bg-white">
            <Plus className="size-3.5" strokeWidth={2.8} />
            {t("form.add_button")}
          </button>
        )}
        <div
          role="button"
          tabIndex={0}
          aria-label={t("form.selectExisting")}
          onClick={onOpen}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
          className={cn(inputClass, "flex h-auto min-h-9 max-h-[64px] cursor-pointer flex-wrap content-start items-start gap-1 overflow-y-auto py-1.5 [scrollbar-width:thin] hover:border-[#93c5fd] modal-compact:h-auto modal-tiny:h-auto @min-[900px]/main:@max-[1099px]/main:h-auto modal-compact:min-h-[30px] modal-compact:max-h-[58px] modal-compact:py-1")}
        >
          {selected.size === 0 && <span className="pt-0.5 pl-0.5 text-dash-faint">{t("form.noProcesses")}</span>}
          {[...selected].map((code) => (
            <span key={code} className={chip}>
              {code}
              <button
                type="button"
                aria-label={t("form.removeOf", { label: code })}
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
          <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[8px] border border-modal-input-line bg-white/60 px-2.5 fm-input focus-within:border-[#3b82f6] modal-compact:h-7">
            <Search className="size-3.5 flex-none text-dash-faint" strokeWidth={2.2} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("form.searchProcesses")} className="w-full min-w-0 bg-transparent text-[#111827] uppercase placeholder:normal-case outline-none placeholder:text-dash-faint" />
          </label>
          <button type="button" onClick={() => onChange(new Set([...selected, ...shown.map((it) => it.value)]))} className={cn(tileLink, "text-[#1d7bff]")}>
            {t("common:selectAll")}
          </button>
          <button type="button" onClick={() => onChange(new Set())} className={cn(tileLink, "text-[#64748b]")}>
            {t("common:clear")}
          </button>
        </div>
        <div className="h-[clamp(170px,30dvh,300px)] overflow-y-auto p-1.5 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin] modal-compact:h-[150px]">
          {shown.length === 0 ? (
            <div className="py-4 text-center fm-empty text-dash-faint">{items.length ? t("form.noMatches") : t("form.noExisting")}</div>
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
                      "flex h-8 min-w-0 cursor-pointer items-center gap-2 rounded-lg border px-2 text-left fm-btn-sm transition-colors modal-compact:h-7",
                      on ? "border-[#bfd8ff] bg-row-stripe" : "border-white/55 bg-white/35 hover:bg-white/75"
                    )}
                  >
                    <span className={cn("flex size-4 flex-none items-center justify-center rounded-[5px] border-[1.5px] text-white", on ? "border-transparent bg-brand-sweep" : "border-[#cbd5e1] bg-white")}>
                      {on && <Check className="size-2.5" strokeWidth={4} />}
                    </span>
                    <span className={cn("min-w-0 flex-1 truncate", on ? "text-brand-navy" : "text-[#374151]")}>{it.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-modal-divider bg-white/40 px-2.5 py-1.5">
          <span className="fm-btn-sm text-[#64748b]">
            <Trans t={t} i18nKey="form.ofSelected" values={{ count: selected.size, total: items.length }} components={{ b: <b className="text-brand-navy" /> }} />
          </span>
          <button type="button" onClick={onDone} className={cn(primaryButtonClass, "h-7 px-4 fm-btn-sm")}>
            {t("form.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
