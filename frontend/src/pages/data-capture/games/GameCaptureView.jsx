import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import Toast from "@/components/shared/Toast.jsx";
import { useNotice } from "@/hooks/useNotice";
import FilterRow from "@/components/shared/FilterRow.jsx";
import SegmentGroup from "@/components/shared/SegmentGroup.jsx";
import { AddButton, Field, SearchSelectField, SelectField, TextInput, inputClass } from "@/components/shared/form-modal/fields.jsx";
import DescriptionPickerModal from "@/pages/process/games/DescriptionPickerModal.jsx";
import { useProcessCurrencies } from "@/pages/process/games/useProcessCurrencies";
import { useProcessDescriptions } from "@/pages/process/games/useProcessDescriptions";
import { useProcessList } from "@/pages/process/games/useProcessList";
import CaptureSheet from "../shared/CaptureSheet.jsx";
import RemoveWordInput from "../shared/RemoveWordInput.jsx";
import SheetCard, { SubmitBar, textButtonClass } from "../shared/SheetCard.jsx";
import SubmittedProcesses from "../shared/SubmittedProcesses.jsx";
import { cardClass } from "../shared/cardParts.jsx";
import { CAPTURE_MODES, GAME_GRID } from "../shared/dataCaptureRules";
import { useCaptureGrid } from "../shared/grid/useCaptureGrid";
import { buildSubmission, saveCaptureSession } from "../shared/submitSnapshot";
import { useCaptureDraft } from "../shared/useCaptureDraft";
import { useDateOptions } from "../shared/useDateOptions";
import { useGameProcesses } from "../shared/useGameProcesses";
import { useSubmittedProcesses } from "../shared/useSubmittedProcesses";
import { useErrorToasts } from "@/hooks/useErrorToasts";
import { useFullscreen } from "../shared/useFullscreen";

const EMPTY_FORM = { process: "", currency: "", removeWord: "", replaceFrom: "", replaceTo: "", remark: "" };

/**
 * Data Capture of a Game company: pick Date, Process and Currency, choose the descriptions with the same
 * "Select or Add Description" modal as Add Process, paste the data into the sheet and Submit (opens the summary).
 * A process saved with "Save Data Capture Table" keeps its sheet as a draft per currency (Delete Draft clears it).
 * scope: the Group / Company pickers (useListScope, owned by DataCapturePage); readOnly: read-only login.
 */
export default function GameCaptureView({ scope, readOnly }) {
  const navigate = useNavigate();
  const { t } = useTranslation(["capture", "common"]);

  const { dates, today } = useDateOptions();
  const [date, setDate] = useState(today);
  const [form, setForm] = useState(EMPTY_FORM);
  const [descriptions, setDescriptions] = useState(() => new Set());
  const [picker, setPicker] = useState(false);
  const [mode, setMode] = useState(CAPTURE_MODES[0].value);
  const sheet = useCaptureGrid(GAME_GRID);
  const { toasts, push, dismiss } = useNotice(5000);
  const pushNotice = (message, level) => push(message, level);

  // What can be captured on the date comes from /games/form (the weekday and "not submitted yet" are the server's); what a process
  // was saved with (currency, words, descriptions) is in the Process list of the company.
  const { processes, error: processError, reload: reloadProcesses } = useGameProcesses(scope.tenantId, date);
  const { rows: allProcesses, error: listError } = useProcessList(scope.tenantId);
  const processOptions = useMemo(() => processes.map((p) => ({ value: String(p.id), label: p.display })), [processes]);
  const currencies = useProcessCurrencies(scope.tenantId);
  const descriptionList = useProcessDescriptions(scope.tenantId);
  const submitted = useSubmittedProcesses(scope.tenantId, date);

  // A new day moved the options on and the picked date is no longer among them: back to today.
  useEffect(() => {
    if (!dates.some((d) => d.value === date)) setDate(today);
  }, [dates, date, today]);

  // Another company means another process list: start the form again.
  useEffect(() => {
    setForm(EMPTY_FORM);
    setDescriptions(new Set());
    sheet.resetGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new company starts again
  }, [scope.tenantId]);

  // Another date has its own processes: pick again, on an empty sheet.
  const pickDate = (value) => {
    setDate(value);
    setForm(EMPTY_FORM);
    setDescriptions(new Set());
    sheet.resetGrid();
  };

  // Picking a process fills in what it was saved with; every field stays editable.
  const pickProcess = (id) => {
    const p = allProcesses.find((x) => String(x.id) === id);
    setForm({ process: id, currency: p?.currencyId != null && currencies.options.some((o) => o.value === String(p.currencyId)) ? String(p.currencyId) : "", removeWord: p?.removeWord ?? "", replaceFrom: p?.replaceFrom ?? "", replaceTo: p?.replaceTo ?? "", remark: p?.remark ?? "" });
    setDescriptions(new Set(p?.descriptionIds ?? []));
  };
  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const picked = descriptionList.items.filter((it) => descriptions.has(it.value));
  const process = processes.find((p) => String(p.id) === form.process);
  const currencyLabel = currencies.options.find((o) => o.value === form.currency)?.label ?? "";

  // Draft of the sheet: only for a process saved with "Save Data Capture Table", one per currency (kept on the server).
  const draftEnabled = Boolean(process?.enableSaveDraft);
  const draft = useCaptureDraft({
    sheet,
    draft: draftEnabled && form.currency ? { kind: "game", tenantId: scope.tenantId, process: form.process, currencyId: Number(form.currency) } : null,
    picked: Boolean(form.process && form.currency),
    size: GAME_GRID,
    readOnly,
    onLoadError: (err) => push(t("errors.draftLoad"), "error", [err.message, t("errors.draftLoadDetail")]),
  });

  const deleteDraft = async () => {
    const ok = await draft.remove();
    if (ok === true) push(t("toast.draftDeleted"), "success", t("toast.draftDeletedDetail"));
    else if (ok === false) push(t("errors.draftDelete"), "error", t("errors.tryAgain"));
  };

  // Reset keeps the draft (Delete Draft removes it) and starts the whole form again.
  const reset = () => {
    draft.flush();
    setDate(today);
    setForm(EMPTY_FORM);
    setDescriptions(new Set());
    sheet.resetGrid();
  };

  const fullscreen = useFullscreen();

  // Submit opens the Data Capture Summary with what was chosen here and the sheet (the captured rows come from the submit API).
  const submit = () => {
    const table = buildSubmission(sheet.grid);
    if (!table) return;
    draft.flush();
    const capture = {
      tenantId: scope.tenantId,
      date,
      processId: Number(form.process),
      process: process?.code ?? "",
      description: picked.map((it) => it.label).join(", "),
      descriptionIds: [...descriptions],
      currencyId: Number(form.currency),
      currency: currencyLabel,
      removeWord: form.removeWord,
      replaceFrom: form.replaceFrom,
      replaceTo: form.replaceTo,
      remark: form.remark,
      captureType: mode,
      table,
    };
    saveCaptureSession(capture);
    navigate("/data-capture/summary", { state: capture });
  };

  const canSubmit = !readOnly && sheet.filled && form.process && form.currency && descriptions.size > 0;
  useErrorToasts(push, [
    [scope.error, t("errors.scope")],
    [processError, t("errors.processes"), reloadProcesses],
    [listError, t("errors.list")],
    [currencies.error, t("errors.currencies")],
    [submitted.error, t("errors.submitted")],
  ]);

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <Toast toasts={toasts} onClose={dismiss} />
      <div className="grid flex-none grid-cols-1 gap-[clamp(8px,1.5dvh,12px)] lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <section className={cn(cardClass, "flex min-h-0 flex-col gap-2 px-4 pt-2.5 pb-3.5 transition-opacity short:gap-1.5 short:pb-2.5", scope.loading && "opacity-60")}>
          {scope.showGroups && (
            <FilterRow label={t("common:list.group")}>
              <SegmentGroup options={scope.groupOptions} value={scope.group} onChange={scope.onGroupChange} allowDeselect={scope.allowNoGroup} />
            </FilterRow>
          )}
          {scope.companyOptions.length > 0 && (
            <FilterRow label={t("common:list.company")}>
              <SegmentGroup options={scope.companyOptions} value={scope.company} onChange={scope.onCompanyChange} allowDeselect={scope.allowNoCompany} />
            </FilterRow>
          )}
          <div className="my-0.5 h-px bg-modal-input-line opacity-60" />

          <div className="grid grid-cols-6 gap-x-3.5 gap-y-2 short:gap-y-1.5 max-[899px]:grid-cols-1">
            <Field label={t("form.date")} as="div" className="col-span-2 max-[899px]:col-span-1">
              <SelectField value={date} onChange={pickDate} options={dates} capped />
            </Field>
            <Field label={t("form.process")} as="div" className="col-span-2 max-[899px]:col-span-1">
              <SearchSelectField value={form.process} onChange={pickProcess} options={processOptions} placeholder={t("form.selectProcess")} searchPlaceholder={t("form.searchProcess")} />
            </Field>
            <Field label={t("form.currency")} as="div" className="col-span-2 max-[899px]:col-span-1">
              <SearchSelectField value={form.currency} onChange={(currency) => setForm((f) => ({ ...f, currency }))} options={currencies.options} placeholder={t("form.selectCurrency")} searchPlaceholder={t("form.searchCurrency")} />
            </Field>

            <Field label={t("form.description")} as="div" className="col-span-2 max-[899px]:col-span-1">
              <div className="flex items-center gap-1.5">
                <div title={picked.map((it) => it.label).join(", ")} className={cn(inputClass, "flex min-w-0 flex-1 cursor-default items-center gap-1.5 overflow-hidden")}>
                  {picked.length === 0 ? (
                    <span className="truncate text-dash-faint">{t("form.descriptionHint")}</span>
                  ) : (
                    picked.map((it) => (
                      <span key={it.value} className="inline-flex h-[22px] flex-none items-center rounded-[7px] border border-[#bfd8ff] bg-row-stripe px-2 text-[11.5px] font-extrabold text-brand-navy">
                        {it.label}
                      </span>
                    ))
                  )}
                </div>
                <AddButton label={picked.length ? t("form.editDescriptions") : t("form.addDescription")} edit={picked.length > 0} onClick={() => setPicker(true)} disabled={!scope.tenantId} />
              </div>
            </Field>
            <Field label={t("form.replaceWord")} optional as="div" className="col-span-4 max-[899px]:col-span-1">
              <div className="flex items-center gap-2">
                <TextInput value={form.replaceFrom} onChange={setField("replaceFrom")} autoComplete="off" placeholder={t("form.oldWord")} className="min-w-0 flex-1 uppercase" />
                <span className="flex-none text-[13px] text-dash-sub">→</span>
                <TextInput value={form.replaceTo} onChange={setField("replaceTo")} autoComplete="off" placeholder={t("form.newWord")} className="min-w-0 flex-1 uppercase" />
              </div>
            </Field>

            <Field label={t("form.removeWord")} optional className="col-span-3 max-[899px]:col-span-1">
              <RemoveWordInput value={form.removeWord} onChange={(removeWord) => setForm((f) => ({ ...f, removeWord }))} />
            </Field>
            <Field label={t("form.remark")} optional className="col-span-3 max-[899px]:col-span-1">
              <TextInput value={form.remark} onChange={setField("remark")} autoComplete="off" placeholder={t("form.enterRemark")} className="uppercase" />
            </Field>
          </div>
        </section>

        <SubmittedProcesses items={submitted.items} />
      </div>

      <SheetCard
        fullscreen={fullscreen}
        left={
          <>
            <div className="w-[140px] flex-none">
              <SelectField value={mode} onChange={setMode} options={CAPTURE_MODES} />
            </div>
            <button type="button" onClick={reset} className={textButtonClass}>
              {t("sheet.reset")}
            </button>
            {draftEnabled && (
              <button type="button" onClick={deleteDraft} disabled={!form.currency} title={t("sheet.deleteDraftTitle")} className={textButtonClass}>
                {t("sheet.deleteDraft")}
              </button>
            )}
          </>
        }
      >
        <CaptureSheet sheet={sheet} captureType={mode} onNotice={pushNotice} />
      </SheetCard>

      <SubmitBar disabled={!canSubmit} readOnly={readOnly} onSubmit={submit} />

      {/* The same modal as the "Add" of Add Process: what is ticked here becomes this page's Description. */}
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
    </div>
  );
}
