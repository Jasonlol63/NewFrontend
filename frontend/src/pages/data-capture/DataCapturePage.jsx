import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import FilterRow from "@/components/shared/FilterRow.jsx";
import SegmentGroup from "@/components/shared/SegmentGroup.jsx";
import { AddButton, Field, SelectField, TextInput, inputClass, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";
import { useListScope } from "@/components/shared/list/useListScope";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { isBankCompany } from "@/pages/process/companyCategory";
import DescriptionPickerModal from "@/pages/process/games/DescriptionPickerModal.jsx";
import { MOCK_CURRENCIES } from "@/pages/process/games/processFormOptions";
import { useProcessDescriptions } from "@/pages/process/games/useProcessDescriptions";
import { useProcessList } from "@/pages/process/games/useProcessList";
import CaptureSheet from "./CaptureSheet.jsx";
import BankCaptureView from "./BankCaptureView.jsx";
import SubmittedProcesses from "./SubmittedProcesses.jsx";
import { cardClass } from "./cardParts.jsx";
import { useFullscreen } from "./useFullscreen";
import { CAPTURE_MODES, MOCK_SUBMITTED, dateOptions } from "./dataCaptureRules";

const EMPTY_FORM = { process: "", currency: "", removeWord: "", replaceFrom: "", replaceTo: "", remark: "" };

/**
 * Data Capture: pick Group / Company, Date, Process and Currency, choose the descriptions with the same
 * "Select or Add Description" modal as Add Process, paste the data into the sheet and Submit.
 * UI only for now: Submit just clears the sheet until the submit API is wired up.
 */
export default function DataCapturePage() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const readOnly = Boolean(user?.readOnly);
  const scope = useListScope("dataCapture.scope");
  // Bank companies capture differently (not built yet); this page is for Game companies.
  const isBank = scope.company !== null && isBankCompany(scope.company);

  const dates = useMemo(() => dateOptions(), []);
  const [date, setDate] = useState(dates[0].value);
  const [form, setForm] = useState(EMPTY_FORM);
  const [descriptions, setDescriptions] = useState(() => new Set());
  const [picker, setPicker] = useState(false);
  const [mode, setMode] = useState(CAPTURE_MODES[0].value);

  const { rows: allProcesses, error: listError } = useProcessList(isBank ? null : scope.tenantId);
  const processes = useMemo(() => allProcesses.filter((p) => p.category === "GAME" && p.status === "active"), [allProcesses]);
  const processOptions = useMemo(() => processes.map((p) => ({ value: String(p.id), label: p.code })), [processes]);
  const descriptionList = useProcessDescriptions(isBank ? null : scope.tenantId);

  // Another company means another process list: start the form again.
  useEffect(() => {
    setForm(EMPTY_FORM);
    setDescriptions(new Set());
  }, [scope.tenantId]);

  // Picking a process fills in what it was saved with; every field stays editable.
  const pickProcess = (id) => {
    const p = processes.find((x) => String(x.id) === id);
    setForm({ process: id, currency: p?.currency ?? "", removeWord: p?.removeWord ?? "", replaceFrom: p?.replaceFrom ?? "", replaceTo: p?.replaceTo ?? "", remark: p?.remark ?? "" });
    setDescriptions(new Set(p?.descriptionIds ?? []));
  };
  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const picked = descriptionList.items.filter((it) => descriptions.has(it.value));

  // Sheet: remount to clear; Submit needs at least one filled cell.
  const sheetRef = useRef(null);
  const [sheetKey, setSheetKey] = useState(0);
  const [hasData, setHasData] = useState(false);
  const checkData = useCallback(() => setHasData([...(sheetRef.current?.querySelectorAll("td") ?? [])].some((td) => td.textContent.trim())), []);
  const resetSheet = () => {
    setSheetKey((k) => k + 1);
    setHasData(false);
  };

  const { ref: tableCardRef, full, toggle: toggleFull } = useFullscreen();

  // Submit opens the Data Capture Summary with what was chosen here (the captured rows will come from the submit API).
  const submit = () =>
    navigate("/data-capture/summary", {
      state: { date, process: processes.find((p) => String(p.id) === form.process)?.code ?? "", description: picked.map((it) => it.label).join(", "), currency: form.currency, remark: form.remark },
    });

  const canSubmit = !readOnly && hasData && form.process && form.currency && descriptions.size > 0;
  const pageError = scope.error || listError;

  // Bank companies capture differently: no descriptions / replace words, a fixed process list.
  if (isBank) return <BankCaptureView scope={scope} readOnly={readOnly} />;

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <div className="grid flex-none grid-cols-1 gap-[clamp(8px,1.5dvh,12px)] lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <section className={cn(cardClass, "flex min-h-0 flex-col gap-2 px-4 pt-2.5 pb-3.5 transition-opacity short:gap-1.5 short:pb-2.5", scope.loading && "opacity-60")}>
          {scope.showGroups && (
            <FilterRow label="GroupID:">
              <SegmentGroup options={scope.groupOptions} value={scope.group} onChange={scope.onGroupChange} allowDeselect={scope.allowNoGroup} />
            </FilterRow>
          )}
          {scope.companyOptions.length > 0 && (
            <FilterRow label="Company:">
              <SegmentGroup options={scope.companyOptions} value={scope.company} onChange={scope.onCompanyChange} allowDeselect={scope.allowNoCompany} />
            </FilterRow>
          )}
          <div className="my-0.5 h-px bg-modal-input-line opacity-60" />

          <div className="grid grid-cols-6 gap-x-3.5 gap-y-2 short:gap-y-1.5 max-[899px]:grid-cols-1">
            <Field label="Date" as="div" className="col-span-2 max-[899px]:col-span-1">
              <SelectField value={date} onChange={setDate} options={dates} />
            </Field>
            <Field label="Process" as="div" className="col-span-2 max-[899px]:col-span-1">
              <SelectField value={form.process} onChange={pickProcess} options={processOptions} placeholder="Select Process" />
            </Field>
            <Field label="Currency" as="div" className="col-span-2 max-[899px]:col-span-1">
              <SelectField value={form.currency} onChange={(currency) => setForm((f) => ({ ...f, currency }))} options={MOCK_CURRENCIES} placeholder="Select Currency" />
            </Field>

            <Field label="Description" as="div" className="col-span-2 max-[899px]:col-span-1">
              <div className="flex items-center gap-1.5">
                <div title={picked.map((it) => it.label).join(", ")} className={cn(inputClass, "flex min-w-0 flex-1 cursor-default items-center gap-1.5 overflow-hidden")}>
                  {picked.length === 0 ? (
                    <span className="truncate text-dash-faint">Click + to select descriptions</span>
                  ) : (
                    picked.map((it) => (
                      <span key={it.value} className="inline-flex h-[22px] flex-none items-center rounded-[7px] border border-[#bfd8ff] bg-row-stripe px-2 text-[11.5px] font-extrabold text-brand-navy">
                        {it.label}
                      </span>
                    ))
                  )}
                </div>
                <AddButton label={picked.length ? "Edit descriptions" : "Add description"} edit={picked.length > 0} onClick={() => setPicker(true)} disabled={!scope.tenantId} />
              </div>
            </Field>
            <Field label="Replace Word" optional as="div" className="col-span-4 max-[899px]:col-span-1">
              <div className="flex items-center gap-2">
                <TextInput value={form.replaceFrom} onChange={setField("replaceFrom")} autoComplete="off" placeholder="OLD WORD" className="min-w-0 flex-1 uppercase" />
                <span className="flex-none text-[13px] text-dash-sub">→</span>
                <TextInput value={form.replaceTo} onChange={setField("replaceTo")} autoComplete="off" placeholder="NEW WORD" className="min-w-0 flex-1 uppercase" />
              </div>
            </Field>

            <Field label="Remove Word" optional className="col-span-3 max-[899px]:col-span-1">
              <TextInput value={form.removeWord} onChange={setField("removeWord")} autoComplete="off" className="uppercase" />
            </Field>
            <Field label="Remark" optional className="col-span-3 max-[899px]:col-span-1">
              <TextInput value={form.remark} onChange={setField("remark")} autoComplete="off" placeholder="ENTER REMARK" className="uppercase" />
            </Field>
          </div>
        </section>

        <SubmittedProcesses items={MOCK_SUBMITTED} />
      </div>

      {pageError && <div className="flex-none rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-medium text-dash-down">{pageError}</div>}

      <section ref={tableCardRef} className={cn(cardClass, "flex min-h-0 flex-1 flex-col overflow-hidden", full && "rounded-none bg-[#eaf3fd]")}>
        <div className="flex flex-none items-center gap-2.5 px-4 py-2.5">
          <h2 className="m-0 mr-1.5 flex items-center gap-2 text-[16px] font-extrabold text-brand-navy">
            <span className="h-4 w-1 rounded-sm bg-[linear-gradient(180deg,#3fc4ff,#0a3fc9)]" />
            Data Capture Table
          </h2>
          <div className="w-[140px] flex-none">
            <SelectField value={mode} onChange={setMode} options={CAPTURE_MODES} />
          </div>
          <button type="button" onClick={resetSheet} className="h-[34px] cursor-pointer rounded-[10px] border border-modal-input-line bg-modal-input px-4 text-[13px] font-bold text-[#475569] shadow-[0_1px_3px_rgba(15,23,42,0.05)] hover:border-[#94a3b8] hover:bg-white/90">
            Reset
          </button>
          <button
            type="button"
            onClick={toggleFull}
            aria-label={full ? "Exit full screen" : "Full screen"}
            title={full ? "Exit full screen" : "Full screen"}
            className="ml-auto flex size-[34px] cursor-pointer items-center justify-center rounded-[10px] border border-modal-input-line bg-modal-input text-[#475569] hover:bg-white/90"
          >
            {full ? <Minimize2 className="size-4" strokeWidth={2.2} /> : <Maximize2 className="size-4" strokeWidth={2.2} />}
          </button>
        </div>
        <CaptureSheet key={sheetKey} ref={sheetRef} onInput={checkData} />
      </section>

      <div className="flex flex-none justify-center">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          title={readOnly ? "Read-only login" : undefined}
          className={cn(primaryButtonClass, "h-[34px] min-w-[108px] px-[22px] text-[13.5px] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:grayscale-[0.55] disabled:hover:brightness-100")}
        >
          Submit
        </button>
      </div>

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
