import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import Toast from "@/components/shared/Toast.jsx";
import { useNotice } from "@/hooks/useNotice";
import FilterRow from "@/components/shared/FilterRow.jsx";
import SegmentGroup from "@/components/shared/SegmentGroup.jsx";
import { Field, SearchSelectField, SelectField, TextInput } from "@/components/shared/form-modal/fields.jsx";
import { useProcessCurrencies } from "@/pages/process/games/useProcessCurrencies";
import CaptureSheet from "../shared/CaptureSheet.jsx";
import SheetCard, { SubmitBar, iconButtonClass, textButtonClass } from "../shared/SheetCard.jsx";
import SubmittedProcesses from "../shared/SubmittedProcesses.jsx";
import { cardClass } from "../shared/cardParts.jsx";
import { ADD_COL_OPTIONS, ADD_ROW_OPTIONS, BANK_DRAFT_PROCESSES, BANK_GRID, BANK_PROCESSES } from "../shared/dataCaptureRules";
import { useCaptureGrid } from "../shared/grid/useCaptureGrid";
import { buildSubmission, saveCaptureSession } from "../shared/submitSnapshot";
import { useCaptureDraft } from "../shared/useCaptureDraft";
import { useDateOptions } from "../shared/useDateOptions";
import { useErrorToasts } from "@/hooks/useErrorToasts";
import { useFullscreen } from "../shared/useFullscreen";

const EMPTY_FORM = { process: "", currency: "", remark: "" };

/**
 * Data Capture of a Bank company, of C168 (a Game company that captures like a Bank) and of a Group's own data: no
 * description / replace / remove word, just Date, Process, Currency and Remark above the sheet. The sheet has 11 columns
 * (no column menu) and "Add Row" / "Add Col" append more.
 * SALARY, COMMISSION and BONUS keep their sheet as a draft per currency, PROFIT never does.
 * The process list is fixed (BANK_PROCESSES): unlike a Game process, a Bank process can be submitted again on the same date, so
 * there is no "submitted" list here (the card stays empty).
 */
export default function BankCaptureView({ scope, readOnly }) {
  const navigate = useNavigate();
  const { t } = useTranslation(["capture", "common"]);
  const { dates, today } = useDateOptions();
  const [date, setDate] = useState(today);
  const [form, setForm] = useState(EMPTY_FORM);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const sheet = useCaptureGrid(BANK_GRID);
  const { toasts, push, dismiss } = useNotice(5000);
  const pushNotice = (message, level) => push(message, level);
  const [addRows, setAddRows] = useState("26");
  const [addCols, setAddCols] = useState("1");
  const fullscreen = useFullscreen();

  const currencies = useProcessCurrencies(scope.tenantId);
  const currencyLabel = currencies.options.find((o) => o.value === form.currency)?.label ?? "";

  // SALARY / COMMISSION / BONUS keep a draft per currency on the server, PROFIT never does.
  const draft = useCaptureDraft({
    sheet,
    draft: BANK_DRAFT_PROCESSES.has(form.process) && form.currency ? { kind: "bank", tenantId: scope.tenantId, process: form.process, currencyId: Number(form.currency) } : null,
    picked: Boolean(form.process && form.currency),
    size: BANK_GRID,
    readOnly,
    onLoadError: (err) => push(t("errors.draftLoad"), "error", [err.message, t("errors.draftLoadDetail")]),
  });

  // A new day moved the options on and the picked date is no longer among them: back to today.
  useEffect(() => {
    if (!dates.some((d) => d.value === date)) setDate(today);
  }, [dates, date, today]);

  // Another company: start the form again.
  useEffect(() => {
    setForm(EMPTY_FORM);
    sheet.resetGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new company starts again
  }, [scope.tenantId]);

  // Another date (or Reset) starts the form again on an empty sheet; the drafts stay.
  const startAgain = (nextDate = date) => {
    draft.flush();
    setDate(nextDate);
    setForm(EMPTY_FORM);
    sheet.resetGrid();
  };

  // Submit opens the Data Capture Summary with what was chosen here and the sheet (the captured rows come from the submit API).
  const submit = () => {
    const table = buildSubmission(sheet.grid);
    if (!table) return;
    draft.flush();
    const capture = {
      tenantId: scope.tenantId,
      date,
      processId: null,
      process: form.process,
      description: "",
      descriptionIds: [],
      currencyId: Number(form.currency),
      currency: currencyLabel,
      remark: form.remark,
      captureType: "1.Text",
      table,
    };
    saveCaptureSession(capture);
    navigate("/data-capture/summary", { state: capture });
  };

  const addRowsNow = () => {
    sheet.actions.addRows(Number(addRows));
    push(t("toast.rowsAdded", { count: Number(addRows) }));
  };
  const addColsNow = () => {
    sheet.actions.addCols(Number(addCols));
    push(t("toast.colsAdded", { count: Number(addCols) }));
  };

  const canSubmit = !readOnly && sheet.filled && form.process && form.currency;
  useErrorToasts(push, [
    [scope.error, t("errors.scope")],
    [currencies.error, t("errors.currencies")],
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

          <div className="grid grid-cols-2 gap-x-3.5 gap-y-2 short:gap-y-1.5 max-[899px]:grid-cols-1">
            <Field label={t("form.date")} as="div">
              <SelectField value={date} onChange={(d) => startAgain(d)} options={dates} capped />
            </Field>
            <Field label={t("form.process")} as="div">
              <SelectField value={form.process} onChange={set("process")} options={BANK_PROCESSES} placeholder={t("form.selectProcess")} />
            </Field>
            <Field label={t("form.currency")} as="div">
              <SearchSelectField value={form.currency} onChange={set("currency")} options={currencies.options} placeholder={t("form.selectCurrency")} searchPlaceholder={t("form.searchCurrency")} />
            </Field>
            <Field label={t("form.remark")} optional>
              <TextInput value={form.remark} onChange={(e) => set("remark")(e.target.value)} autoComplete="off" placeholder={t("form.enterRemark")} className="uppercase" />
            </Field>
          </div>
        </section>

        <SubmittedProcesses items={[]} />
      </div>

      <SheetCard
        fullscreen={fullscreen}
        left={
          <button type="button" onClick={() => startAgain(today)} className={textButtonClass}>
            {t("sheet.reset")}
          </button>
        }
        right={
          <>
            <span className="text-[13px] font-semibold text-[#374151]">{t("sheet.addRow")}</span>
            <div className="w-[84px] flex-none">
              <SelectField value={addRows} onChange={setAddRows} options={ADD_ROW_OPTIONS} />
            </div>
            <button type="button" onClick={addRowsNow} aria-label={t("sheet.addRows", { count: Number(addRows) })} title={t("sheet.addRows", { count: Number(addRows) })} className={iconButtonClass}>
              <RefreshCw className="size-4" strokeWidth={2.2} />
            </button>
            <span className="ml-1 text-[13px] font-semibold text-[#374151]">{t("sheet.addCol")}</span>
            <div className="w-[76px] flex-none">
              <SelectField value={addCols} onChange={setAddCols} options={ADD_COL_OPTIONS} />
            </div>
            <button type="button" onClick={addColsNow} aria-label={t("sheet.addCols", { count: Number(addCols) })} title={t("sheet.addCols", { count: Number(addCols) })} className={iconButtonClass}>
              <RefreshCw className="size-4" strokeWidth={2.2} />
            </button>
          </>
        }
      >
        <CaptureSheet sheet={sheet} columnEdit={false} maxCols={BANK_GRID.cols} onNotice={pushNotice} />
      </SheetCard>

      <SubmitBar disabled={!canSubmit} readOnly={readOnly} onSubmit={submit} />
    </div>
  );
}
