import { useCallback, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import FilterRow from "@/components/shared/FilterRow.jsx";
import SegmentGroup from "@/components/shared/SegmentGroup.jsx";
import { Field, SelectField, TextInput, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";
import { MOCK_CURRENCIES } from "@/pages/process/games/processFormOptions";
import CaptureSheet from "./CaptureSheet.jsx";
import SubmittedProcesses from "./SubmittedProcesses.jsx";
import { cardClass } from "./cardParts.jsx";
import { ADD_ROW_OPTIONS, BANK_PROCESSES, MOCK_SUBMITTED, SHEET_ROWS, dateOptions } from "./dataCaptureRules";
import { useFullscreen } from "./useFullscreen";

const iconBtn = "flex size-[34px] flex-none cursor-pointer items-center justify-center rounded-[10px] border border-modal-input-line bg-modal-input text-[#475569] hover:bg-white/90";

/**
 * Data Capture of a Bank company: no description / replace / remove word, just Date, Process, Currency and Remark
 * above the sheet. The sheet starts with 26 rows and "Add Row" appends more.
 * UI only for now: the process list is fixed (BANK_PROCESSES) and Submit just clears the sheet.
 */
export default function BankCaptureView({ scope, readOnly }) {
  const dates = useMemo(() => dateOptions(), []);
  const [form, setForm] = useState({ date: dates[0].value, process: "", currency: "", remark: "" });
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const sheetRef = useRef(null);
  const [sheetKey, setSheetKey] = useState(0);
  const [rows, setRows] = useState(SHEET_ROWS);
  const [addCount, setAddCount] = useState(String(SHEET_ROWS));
  const [hasData, setHasData] = useState(false);
  const checkData = useCallback(() => setHasData([...(sheetRef.current?.querySelectorAll("td") ?? [])].some((td) => td.textContent.trim())), []);
  const resetSheet = () => {
    setSheetKey((k) => k + 1);
    setRows(SHEET_ROWS);
    setHasData(false);
  };
  const { ref: tableCardRef, full, toggle: toggleFull } = useFullscreen();

  const canSubmit = !readOnly && hasData && form.process && form.currency;

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

          <div className="grid grid-cols-2 gap-x-3.5 gap-y-2 short:gap-y-1.5 max-[899px]:grid-cols-1">
            <Field label="Date" as="div">
              <SelectField value={form.date} onChange={set("date")} options={dates} />
            </Field>
            <Field label="Process" as="div">
              <SelectField value={form.process} onChange={set("process")} options={BANK_PROCESSES} placeholder="Select Process" />
            </Field>
            <Field label="Currency" as="div">
              <SelectField value={form.currency} onChange={set("currency")} options={MOCK_CURRENCIES} placeholder="Select Currency" />
            </Field>
            <Field label="Remark" optional>
              <TextInput value={form.remark} onChange={(e) => set("remark")(e.target.value)} autoComplete="off" placeholder="ENTER REMARK" className="uppercase" />
            </Field>
          </div>
        </section>

        <SubmittedProcesses items={MOCK_SUBMITTED} />
      </div>

      <section ref={tableCardRef} className={cn(cardClass, "flex min-h-0 flex-1 flex-col overflow-hidden", full && "rounded-none bg-[#eaf3fd]")}>
        <div className="flex flex-none items-center gap-2.5 px-4 py-2.5">
          <h2 className="m-0 mr-1.5 flex items-center gap-2 text-[16px] font-extrabold text-brand-navy">
            <span className="h-4 w-1 rounded-sm bg-[linear-gradient(180deg,#3fc4ff,#0a3fc9)]" />
            Data Capture Table
          </h2>
          <button type="button" onClick={resetSheet} className="h-[34px] cursor-pointer rounded-[10px] border border-modal-input-line bg-modal-input px-4 text-[13px] font-bold text-[#475569] shadow-[0_1px_3px_rgba(15,23,42,0.05)] hover:border-[#94a3b8] hover:bg-white/90">
            Reset
          </button>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[#374151]">Add Row</span>
            <div className="w-[84px] flex-none">
              <SelectField value={addCount} onChange={setAddCount} options={ADD_ROW_OPTIONS} />
            </div>
            <button type="button" onClick={() => setRows((n) => n + Number(addCount))} aria-label={`Add ${addCount} rows`} title={`Add ${addCount} rows`} className={iconBtn}>
              <RefreshCw className="size-4" strokeWidth={2.2} />
            </button>
            <button type="button" onClick={toggleFull} aria-label={full ? "Exit full screen" : "Full screen"} title={full ? "Exit full screen" : "Full screen"} className={iconBtn}>
              {full ? <Minimize2 className="size-4" strokeWidth={2.2} /> : <Maximize2 className="size-4" strokeWidth={2.2} />}
            </button>
          </div>
        </div>
        <CaptureSheet key={sheetKey} ref={sheetRef} rows={rows} onInput={checkData} />
      </section>

      <div className="flex flex-none justify-center">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={resetSheet}
          title={readOnly ? "Read-only login" : undefined}
          className={cn(primaryButtonClass, "h-[34px] min-w-[108px] px-[22px] text-[13.5px] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:grayscale-[0.55] disabled:hover:brightness-100")}
        >
          Submit
        </button>
      </div>
    </div>
  );
}
