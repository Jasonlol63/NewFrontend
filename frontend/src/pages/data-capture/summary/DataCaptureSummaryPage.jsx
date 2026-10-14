import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import DeleteDialog from "@/components/shared/DeleteDialog.jsx";
import { SelectBox } from "@/components/shared/list/DataTable.jsx";
import { IconAction } from "@/components/shared/list/cells.jsx";
import { PrimaryButton } from "@/components/shared/list/ListToolbar.jsx";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSession } from "@/context/session";
import { postJson } from "@/lib/api";
import { localizeBackend } from "@/i18n/backendMessages";
import Toast from "@/components/shared/Toast.jsx";
import { useNotice } from "@/hooks/useNotice";
import { clearCaptureSession, loadCaptureSession } from "../shared/submitSnapshot";
import FormulaDialog from "./FormulaDialog.jsx";
import { deleteFormulas, fetchAccounts, fetchCurrencies, fetchTemplates, saveFormula, submitSummary, updateFormula } from "./summaryApi";
import { applyDraft, clearDraft, draftSignature, saveDraft } from "./summaryDraft";
import { formatMoney, moneySign } from "@/lib/money";
import { baseAmount, formulaDisplay, parseRate, parseSource, totalWithinTolerance } from "./summaryMath";
import { buildRows } from "./summaryPopulate";
import { amountsByKey, capturedFromTable, checkSubmit, createRow, deleteTicked, hasAccount, idLabel, insertSub, rowName, submitLines, totalOf } from "./summaryRules";

// Column widths in %. Formula has none and takes what is left: it is the column that gets long.
const COLS = [
  ["idProduct", 13],
  ["account", 15],
  ["currency", 7],
  ["formula", null],
  ["source", 5.5],
  ["rate", 4],
  ["rateValue", 6],
  ["processedAmount", 9],
  ["skip", 4],
  ["delete", 5.5],
];

// No horizontal scroll: headers wrap below 1700px wide instead of widening the table.
const th =
  "sticky top-0 z-[2] h-7 overflow-hidden border-r border-white/25 bg-[linear-gradient(180deg,#60c1fe,#1a6bff)] px-1 text-center type-caption font-semibold! text-white last:border-r-0 min-[1701px]:whitespace-nowrap max-[1700px]:py-0.5 max-[1700px]:leading-[1.15] max-[1250px]:px-0.5 short:h-[26px]";
const td =
  "h-7 overflow-hidden text-ellipsis whitespace-nowrap border-r border-b border-[#e8eef7] px-1.5 type-table-cell font-semibold! text-[#1f2937] last:border-r-0 group-even:bg-[#f7faff] group-hover:bg-[#e9f3ff] max-[1400px]:px-1 short:h-[25px]";
const smallButton = "h-7 whitespace-nowrap rounded-lg py-0 type-table-cell font-semibold!";
const actionButton = "h-8 whitespace-nowrap rounded-lg py-0 type-body font-semibold!";

const TOTAL_CELL = "sticky bottom-0 z-[2] h-[30px] border-t border-[#bcd0ec] bg-[#dfeafb] px-1.5 short:h-[27px]";

// Dashed "+" like the AddButton beside a select, at row size.
function AddMini(props) {
  return (
    <button
      type="button"
      className="flex size-[22px] flex-none cursor-pointer items-center justify-center rounded-[7px] border-[1.5px] border-dashed border-[#7fb2ff] bg-[rgba(232,242,255,0.7)] text-[#2563eb] transition-colors hover:border-solid hover:bg-[#d6e8ff] disabled:pointer-events-none disabled:opacity-50"
      {...props}
    >
      <Plus className="size-[13px]" strokeWidth={2.4} />
    </button>
  );
}

// "Date 2026-10-08 ·": what was captured, one chip per value, a dot between them.
function InfoChip({ label, value }) {
  return (
    <span className="whitespace-nowrap type-table-cell font-normal! text-dash-sub not-last:after:ml-2.5 not-last:after:text-[#b6c2d6] not-last:after:content-['·']">
      {label}
      <b className={cn("ml-[5px]", value ? "font-semibold text-brand-navy" : "font-semibold text-dash-faint")}>{value || "-"}</b>
    </span>
  );
}

// A cell edited in place (double click): Enter or leaving it saves, Escape drops the change.
function InlineInput({ value, onSave, onCancel, align = "left", placeholder }) {
  const [text, setText] = useState(value);
  const done = useRef(false);
  const finish = (save) => {
    if (done.current) return;
    done.current = true;
    if (save) onSave(text.trim());
    else onCancel();
  };
  return (
    <input
      autoFocus
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(true);
        else if (e.key === "Escape") {
          e.stopPropagation();
          finish(false);
        }
      }}
      className={cn("h-[22px] w-full min-w-0 rounded-md border border-[#3b82f6] bg-white px-1.5 type-table-cell text-[#111827] outline-none shadow-[0_0_0_2px_rgba(59,130,246,0.15)]", align === "right" && "text-right", align === "center" && "text-center")}
    />
  );
}

// A page in the frame of the summary that only says something (loading, an error, nothing captured).
function Message({ title, text, children }) {
  return (
    <div className="h-full min-h-[520px] p-[clamp(8px,1.6dvh,16px)]">
      <div className="flex h-full min-h-[480px] flex-col items-center justify-center gap-3 rounded-[22px] border border-white/55 bg-modal-bg px-6 text-center shadow-[0_20px_50px_-30px_rgba(20,51,107,0.45)] backdrop-blur-[22px]">
        <h1 className="m-0 type-page-title text-brand-navy">{title}</h1>
        {text && <p className="m-0 max-w-[460px] type-body font-normal! text-dash-sub">{text}</p>}
        {children}
      </div>
    </div>
  );
}

const linkButton = "inline-flex h-9 cursor-pointer items-center rounded-[10px] border-none bg-brand-sweep px-5 type-body font-semibold! text-white no-underline shadow-[0_8px_16px_-8px_rgba(20,90,220,0.55)]";

// What the page needs from the server: the company's accounts and currencies and the stored formulas of the process. It loads
// again when `version` changes (Refresh); loading is "no answer for this key yet", so no state is set from the effect.
function useSummaryData(capture, version) {
  const key = capture ? `${capture.tenantId}|${capture.processId ?? capture.process}|${version}` : "";
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!capture) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    Promise.all([fetchAccounts(capture.tenantId, { signal }), fetchCurrencies(capture.tenantId, { signal }), fetchTemplates(capture, { signal })])
      .then(([accounts, currencies, templates]) => setResult({ key, accounts, currencies, templates }))
      .catch((err) => {
        if (err.name !== "AbortError") setResult({ key, error: err.message || i18n.t("capture:summary.empty.network") });
      });
    return () => controller.abort();
    // The capture is read once per key (its identity changes on every read of the navigation state).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return result?.key === key ? result : null;
}

// The summary while its data is on the way: the same frame, with the list showing "Loading…" in its body.
function LoadingFrame({ capture }) {
  const { t } = useTranslation(["capture", "common"]);
  return (
    <div className="h-full min-h-[520px] p-[clamp(8px,1.6dvh,16px)]">
      <div className="flex h-full min-h-[480px] flex-col gap-[clamp(6px,1.3dvh,10px)] overflow-hidden rounded-[22px] border border-white/55 bg-modal-bg px-[clamp(12px,1.8vw,24px)] py-[clamp(10px,2dvh,18px)] shadow-[0_20px_50px_-30px_rgba(20,51,107,0.45)] backdrop-blur-[22px] backdrop-saturate-[1.15]">
        <div className="flex flex-none flex-wrap items-center gap-x-2.5 gap-y-1">
          <h1 className="m-0 mr-2 flex items-center gap-2 whitespace-nowrap type-page-title text-brand-navy">
            <span className="h-4 w-1 rounded-sm bg-[linear-gradient(180deg,#3fc4ff,#0a3fc9)]" />
            {t("summary.title")}
          </h1>
          <InfoChip label={t("form.date")} value={capture.date} />
          <InfoChip label={t("form.process")} value={capture.process} />
          <InfoChip label={t("form.description")} value={capture.description} />
          <InfoChip label={t("form.currency")} value={capture.currency} />
          <InfoChip label={t("form.remark")} value={capture.remark} />
        </div>
        <div className="flex h-[42px] flex-none items-center gap-2 rounded-[10px] border border-white/80 bg-white/55 px-2.5 type-label text-brand-navy">{t("summary.rate.label")}</div>
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/85 bg-white/80 shadow-[0_8px_22px_-16px_rgba(20,51,107,0.5)]">
          <table className="w-full table-fixed border-separate border-spacing-0 type-table-cell">
            <colgroup>
              {COLS.map(([name, w]) => (
                <col key={name} style={w ? { width: `${w}%` } : undefined} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {COLS.map(([name]) => (
                  <th key={name} className={th}>
                    {t(`summary.cols.${name}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={COLS.length} className="h-40 border-b border-[#e8eef7] text-center type-body font-medium! text-dash-sub">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    {t("common:loading")}
                  </span>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={COLS.length} className={cn(TOTAL_CELL, "text-right")} />
              </tr>
            </tfoot>
          </table>
        </section>
      </div>
    </div>
  );
}

/**
 * Data Capture Summary: opened by Submit on Data Capture (its state, or the copy in sessionStorage after a reload). Title +
 * what was captured on one row, the Rate bar, then one card holding the grid, all inside the frosted frame the form modals
 * use. The page loads the company's accounts / currencies and the process's stored formulas, then SummaryBoard shows them.
 * See summaryRules.js (row model), summaryPopulate.js (rows from formulas), summaryMath.js (amounts) and summaryApi.js.
 */
export default function DataCaptureSummaryPage() {
  const { t } = useTranslation("capture");
  const location = useLocation();
  const capture = useMemo(() => location.state ?? loadCaptureSession(), [location.state]);
  const [version, setVersion] = useState(0);
  const data = useSummaryData(capture?.table?.rows?.length ? capture : null, version);

  if (!capture?.table?.rows?.length) {
    return (
      <Message title={t("summary.empty.title")} text={t("summary.empty.text")}>
        <Link to="/data-capture" className={linkButton}>
          {t("summary.empty.go")}
        </Link>
      </Message>
    );
  }
  if (!data) return <LoadingFrame capture={capture} />;
  if (data.error) {
    return (
      <Message title={t("summary.empty.loadFailed")} text={localizeBackend(data.error)}>
        <button type="button" className={linkButton} onClick={() => setVersion((v) => v + 1)}>
          {t("common:retry")}
        </button>
      </Message>
    );
  }
  return <SummaryBoard key={version} capture={capture} data={data} onRefresh={() => setVersion((v) => v + 1)} />;
}

function SummaryBoard({ capture, data, onRefresh }) {
  const { t } = useTranslation(["capture", "common"]);
  const navigate = useNavigate();
  const readOnly = Boolean(useCurrentUser()?.readOnly);
  const { user } = useSession();
  const { toasts, push, dismiss } = useNotice(5500);
  const captured = useMemo(() => capturedFromTable(capture.table), [capture.table]);
  const signature = draftSignature(capture);
  const defaultCurrency = data.currencies.find((c) => c.id === capture.currencyId)?.code ?? String(capture.currency ?? "");
  const companyCode = String(user?.tenant_code ?? capture.tenantId);

  const [rows, setRows] = useState(() => applyDraft(signature, buildRows(captured, data.templates)));
  const [accounts, setAccounts] = useState(data.accounts);
  const [rate, setRate] = useState("");
  const [dialog, setDialog] = useState(null); // { key, mode } of the row whose Add / Edit Formula is open
  const [editing, setEditing] = useState(null); // { key, field } of the cell edited in place
  const [problems, setProblems] = useState(() => new Map()); // row key -> why Submit refused it
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [working, setWorking] = useState(false); // a delete or a submit is on its way
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  // Rate ticks / values and Skip stay in the browser until the summary is submitted.
  useEffect(() => saveDraft(signature, rows), [signature, rows]);

  const amounts = useMemo(() => amountsByKey(rows, captured), [rows, captured]);
  const total = useMemo(() => totalOf(rows, amounts), [rows, amounts]);
  const delRows = rows.filter((r) => r.del);
  const withAccount = rows.filter(hasAccount);
  const allRate = withAccount.length > 0 && withAccount.every((r) => r.rateChecked);
  const rateOk = parseRate(rate) !== null;
  const busy = working;

  const edit = (changes, key) => {
    setProblems((p) => (p.size ? new Map() : p));
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...changes } : r)));
  };

  const applyRateToTicked = () => {
    const ticked = rows.filter((r) => r.rateChecked && hasAccount(r));
    if (ticked.length === 0) return push(t("summary.toast.tickRate"), "info", t("summary.toast.tickRateDetail"));
    const value = rate.trim();
    setRows((rs) => rs.map((r) => (r.rateChecked && hasAccount(r) ? { ...r, rateValue: value, rateChecked: false } : r)));
    return push(t("summary.toast.rateApplied", { value, count: ticked.length }));
  };

  // ---- cells edited in place ----
  // A formula or Source is stored right away (the row is a stored formula); when the server refuses, the cell goes back.
  const storeInline = async (row, changes) => {
    const next = { ...row, ...changes };
    edit(changes, row.key);
    if (!row.templateId) return;
    try {
      await updateFormula(next, capture);
    } catch (err) {
      setRows((rs) => rs.map((r) => (r.key === row.key ? row : r)));
      push(t("summary.toast.saveFailed"), "error", err.message);
    }
  };
  const commitInline = (row, field, text) => {
    setEditing(null);
    if (field === "rateValue") {
      if (text && !parseRate(text)) return push(t("summary.toast.rateInvalid"), "error", t("summary.toast.rateInvalidDetail"));
      return edit({ rateValue: text }, row.key);
    }
    if (field === "source") {
      const value = text || "1";
      if (parseSource(value) === null) return push(t("summary.toast.sourceInvalid"), "error", t("summary.toast.sourceInvalidDetail"));
      if (value === row.sourcePercent) return undefined;
      return storeInline(row, { sourcePercent: value });
    }
    // formula: what is typed has to calculate
    if (!text) return push(t("summary.toast.formulaEmpty"), "error", t("summary.toast.formulaEmptyDetail"));
    try {
      baseAmount({ ...row, formula: text }, captured, row.rowIndex);
    } catch {
      return push(t("summary.toast.formulaInvalid"), "error", t("summary.toast.formulaInvalidDetail"));
    }
    if (text === formulaDisplay(row.formula, captured, row.rowIndex)) return undefined;
    return storeInline(row, { formula: text });
  };

  // ---- Add / Edit Formula ----
  const dialogRow = dialog && rows.find((r) => r.key === dialog.key);
  const saveFormulaDraft = async (draft) => {
    const { mode } = dialog;
    const target = mode === "sub" ? createRow({ type: "sub", idProduct: dialogRow.idProduct, rowIndex: dialogRow.rowIndex, ...draft }) : { ...dialogRow, ...draft };
    const stored = mode === "edit" && target.templateId ? await updateFormula(target, capture) : await saveFormula(target, capture);
    const saved = { ...target, templateId: stored.id ?? target.templateId, formulaVariant: stored.formulaVariant ?? target.formulaVariant };
    setDialog(null);
    // The server decides main or sub; when it did not decide what the screen assumed, show what it stored instead.
    const expected = mode === "sub" ? "sub" : target.type;
    if (mode !== "edit" && stored.type !== expected) {
      push(t("summary.toast.formulaSaved"));
      return onRefresh();
    }
    setProblems(new Map());
    setRows((rs) => (mode === "sub" ? insertSub(rs, dialog.key, saved) : rs.map((r) => (r.key === dialog.key ? saved : r))));
    return push(t("summary.toast.formulaSaved"));
  };
  // The Account modal made or edited an account: it is stored, the list is read again and the dialog gets its label.
  const saveAccount = async ({ url, body }) => {
    await postJson(url, body);
    const list = await fetchAccounts(capture.tenantId);
    setAccounts(list);
    const found = list.find((a) => (body.id != null ? a.id === body.id : a.row.accountId === body.accountId));
    if (!found) throw new Error(t("summary.errors.accountNotListed"));
    return found.label;
  };

  // ---- Delete ----
  const confirmDeleteRows = async () => {
    setWorking(true);
    try {
      await deleteFormulas(delRows, capture);
    } catch (err) {
      setWorking(false);
      setConfirmDelete(false);
      return push(t("summary.toast.deleteFailed"), "error", err.message);
    }
    const { rows: next, removed, cleared } = deleteTicked(rows);
    setRows(next);
    setProblems(new Map());
    setConfirmDelete(false);
    setWorking(false);
    return push(t("summary.toast.deleted", { count: removed + cleared }));
  };

  // ---- Submit ----
  const submit = async () => {
    const check = checkSubmit(rows, amounts, t);
    setProblems(check.problems);
    if (!check.ok) {
      if (check.lines?.length) push(check.title, "error", check.lines);
      else push(check.message, "error");
      const first = check.problems.keys().next().value;
      if (first) document.querySelector(`[data-row-key="${first}"]`)?.scrollIntoView({ block: "center" });
      return;
    }
    const lines = submitLines(rows, amounts, captured);
    setWorking(true);
    try {
      const captureId = await submitSummary(capture, lines);
      clearDraft();
      clearCaptureSession();
      push(t("summary.toast.submitted"), "success", t("summary.toast.submittedDetail", { id: captureId, count: lines.length }));
      // Stay locked until the page is left, so a second click cannot submit it twice.
      later(() => navigate("/data-capture"), 1600);
    } catch (err) {
      setWorking(false);
      push(t("summary.toast.submitFailed"), "error", err.message);
    }
  };

  const info = capture;
  if (rows.length === 0) {
    return (
      <Message title={t("summary.empty.title")} text={t("summary.empty.noIdProduct")}>
        <Link to="/data-capture" className={linkButton}>
          {t("summary.empty.go")}
        </Link>
      </Message>
    );
  }

  const totalBad = !totalWithinTolerance(total);
  // Inside +-0.05 the total is blue above 0 and red below it (by the raw value: 0.004 shows 0.00 but is still blue); a real 0 stays plain; outside the gate it is red.
  const totalTone = totalBad || moneySign(total) < 0 ? "text-[#dc2626]" : moneySign(total) > 0 ? "text-[#1d4ed8]" : "text-brand-navy";

  return (
    <div className="relative h-full min-h-[520px] p-[clamp(8px,1.6dvh,16px)]">
      <Toast toasts={toasts} onClose={dismiss} />
      <div className="flex h-full min-h-[480px] flex-col gap-[clamp(6px,1.3dvh,10px)] overflow-hidden rounded-[22px] border border-white/55 bg-modal-bg px-[clamp(12px,1.8vw,24px)] py-[clamp(10px,2dvh,18px)] shadow-[0_20px_50px_-30px_rgba(20,51,107,0.45)] backdrop-blur-[22px] backdrop-saturate-[1.15]">
        <div className="flex flex-none flex-wrap items-center gap-x-2.5 gap-y-1">
          <h1 className="m-0 mr-2 flex items-center gap-2 whitespace-nowrap type-page-title text-brand-navy">
            <span className="h-4 w-1 rounded-sm bg-[linear-gradient(180deg,#3fc4ff,#0a3fc9)]" />
            {t("summary.title")}
          </h1>
          <InfoChip label={t("form.date")} value={info.date} />
          <InfoChip label={t("form.process")} value={info.process} />
          <InfoChip label={t("form.description")} value={info.description} />
          <InfoChip label={t("form.currency")} value={info.currency} />
          <InfoChip label={t("form.remark")} value={info.remark} />
        </div>

        <div className="flex flex-none items-center gap-2 rounded-[10px] border border-white/80 bg-white/55 px-2.5 py-1.5 short:py-1">
          <span className="type-label text-brand-navy">{t("summary.rate.label")}</span>
          <input
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder={t("summary.rate.placeholder")}
            autoComplete="off"
            className="h-7 w-[150px] rounded-lg border border-modal-input-line bg-modal-input px-2.5 type-table-cell text-[#111827] outline-none focus:border-[#3b82f6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
          />
          <PrimaryButton className={smallButton} disabled={readOnly || busy || withAccount.length === 0} onClick={() => setRows((rs) => rs.map((r) => (hasAccount(r) ? { ...r, rateChecked: !allRate } : r)))}>
            {allRate ? t("summary.rate.selectNone") : t("summary.rate.selectAll")}
          </PrimaryButton>
          <PrimaryButton className={smallButton} disabled={readOnly || busy || !rateOk} onClick={applyRateToTicked}>
            {t("summary.rate.apply")}
          </PrimaryButton>
          <div className="ml-auto flex flex-none items-center gap-2">
            <button
              type="button"
              aria-label={t("summary.rate.refresh")}
              title={t("summary.rate.refresh")}
              disabled={busy}
              onClick={onRefresh}
              className="flex size-7 cursor-pointer items-center justify-center rounded-lg border border-white/80 bg-white/55 text-brand-navy hover:bg-white/75 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className="size-[13px]" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              disabled={readOnly || busy || delRows.length === 0}
              onClick={() => setConfirmDelete(true)}
              className="inline-flex h-7 flex-none items-center gap-1.5 whitespace-nowrap rounded-lg px-4 type-table-cell font-semibold! text-white transition-colors enabled:cursor-pointer enabled:bg-[linear-gradient(180deg,#ff8a8a_0%,#ef4444_100%)] enabled:shadow-[0_6px_14px_-6px_rgba(239,68,68,0.6)] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Trash2 className="size-[13px]" strokeWidth={2.2} />
              {t("common:list.delete", { count: delRows.length })}
            </button>
          </div>
        </div>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/85 bg-white/80 shadow-[0_8px_22px_-16px_rgba(20,51,107,0.5)]">
          <div className="min-h-0 flex-initial overflow-x-hidden overflow-y-auto [scrollbar-color:#c3cedf_transparent] [scrollbar-width:thin]">
              <table className="w-full table-fixed border-separate border-spacing-0 type-table-cell">
                <colgroup>
                  {COLS.map(([name, w]) => (
                    <col key={name} style={w ? { width: `${w}%` } : undefined} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {COLS.map(([name]) => (
                      <th key={name} className={th}>
                        {t(`summary.cols.${name}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const amt = amounts.get(r.key);
                    const filled = hasAccount(r);
                    const sub = r.type === "sub";
                    const problem = problems.get(r.key);
                    const isEditing = (field) => editing?.key === r.key && editing.field === field;
                    const startEdit = (field) => !readOnly && filled && setEditing({ key: r.key, field });
                    return (
                      <tr key={r.key} data-row-key={r.key} title={problem} className={cn("group", r.skip && "opacity-45", problem && "[&>td]:bg-[#fde4e4]!")}>
                        <td className={cn(td, sub && "font-normal!")} title={idLabel(r)}>
                          {sub && <span className="mr-1 text-[#94a3b8]">↳</span>}
                          {idLabel(r)}
                        </td>
                        <td className={td}>
                          <div className="flex items-center gap-1.5">
                            <span className={cn("min-w-0 flex-1 truncate text-[#475569]", !filled && "text-[#94a3b8]")}>{r.account || "-"}</span>
                            <AddMini
                              aria-label={filled ? t("summary.table.addSub") : t("summary.table.addFormula")}
                              title={filled ? t("summary.table.addSubTitle") : t("summary.table.addFormula")}
                              disabled={readOnly || busy}
                              onClick={() => setDialog({ key: r.key, mode: filled ? "sub" : "fill" })}
                            />
                          </div>
                        </td>
                        <td className={cn(td, "text-center")}>
                          {r.currency && <span className="inline-block rounded-full border border-[#bfd8ff] bg-[#eaf4ff] px-[7px] type-caption font-medium! text-[#1d4ed8]">{r.currency}</span>}
                        </td>
                        <td className={cn(td, isEditing("formula") && "p-0.5")}>
                          {isEditing("formula") ? (
                            <InlineInput value={formulaDisplay(r.formula, captured, r.rowIndex)} onSave={(text) => commitInline(r, "formula", text)} onCancel={() => setEditing(null)} />
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <code
                                className={cn("min-w-0 flex-1 truncate font-[inherit] font-medium text-[#334155]", r.formula && !readOnly && "cursor-text")}
                                title={r.inputMethod ? t(`summary.methods.${r.inputMethod}`) : t("summary.table.dblEdit")}
                                onDoubleClick={() => r.formula && startEdit("formula")}
                              >
                                {formulaDisplay(r.formula, captured, r.rowIndex)}
                              </code>
                              {r.formula && <IconAction className="flex-none" aria-label={t("summary.table.editFormula")} title={t("summary.table.editFormula")} disabled={readOnly || busy} onClick={() => setDialog({ key: r.key, mode: "edit" })} />}
                            </div>
                          )}
                        </td>
                        <td className={cn(td, "text-center tabular-nums", isEditing("source") && "p-0.5")} onDoubleClick={() => !isEditing("source") && startEdit("source")} title={filled ? t("summary.table.dblEdit") : undefined}>
                          {isEditing("source") ? <InlineInput align="center" value={r.sourcePercent} placeholder={t("summary.table.sourcePlaceholder")} onSave={(text) => commitInline(r, "source", text)} onCancel={() => setEditing(null)} /> : filled ? r.sourcePercent : ""}
                        </td>
                        <td className={cn(td, "text-center")}>
                          <SelectBox checked={r.rateChecked} onChange={(rateChecked) => edit({ rateChecked }, r.key)} label={t("summary.table.applyRate")} disabled={readOnly || busy || !filled} />
                        </td>
                        <td className={cn(td, "text-right tabular-nums", isEditing("rateValue") && "p-0.5")} onDoubleClick={() => !isEditing("rateValue") && startEdit("rateValue")} title={filled ? t("summary.table.dblEdit") : undefined}>
                          {isEditing("rateValue") ? <InlineInput align="right" value={r.rateValue} placeholder={t("summary.table.ratePlaceholder")} onSave={(text) => commitInline(r, "rateValue", text)} onCancel={() => setEditing(null)} /> : r.rateValue}
                        </td>
                        <td className={cn(td, "text-right font-semibold! tabular-nums", amt?.isNeg() ? "text-[#dc2626]" : "text-[#1d4ed8]")}>
                          {amt ? formatMoney(amt) : r.formula && filled ? <span className="text-[#dc2626]">{t("summary.table.error")}</span> : ""}
                        </td>
                        <td className={cn(td, "text-center")}>
                          <SelectBox checked={r.skip} onChange={(skip) => edit({ skip }, r.key)} label={t("summary.cols.skip")} disabled={readOnly || busy} />
                        </td>
                        <td className={cn(td, "text-center")}>
                          <SelectBox checked={r.del} onChange={(del) => edit({ del }, r.key)} label={t("summary.cols.delete")} disabled={readOnly || busy || (!sub && !filled)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="type-body font-semibold! text-brand-navy">
                    <td colSpan={7} className={cn(TOTAL_CELL, "text-right")}>
                      {t("summary.table.total")}
                    </td>
                    <td className={cn(TOTAL_CELL, "text-right tabular-nums", totalTone)} title={totalBad ? t("summary.table.totalTitle") : undefined}>
                      {formatMoney(total)}
                    </td>
                    <td colSpan={2} className={TOTAL_CELL} />
                  </tr>
                </tfoot>
              </table>
          </div>
        </section>

        <div className="flex flex-none items-center gap-2">
          <PrimaryButton className={actionButton} disabled={readOnly || busy} title={readOnly ? t("readOnly") : undefined} onClick={submit}>
            {working ? t("summary.working") : t("summary.submit")}
          </PrimaryButton>
          <button
            type="button"
            onClick={() => navigate("/data-capture")}
            className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-white/80 bg-white/55 px-4 type-body font-semibold! text-brand-navy hover:bg-white/75"
          >
            {t("summary.back")}
          </button>
        </div>
      </div>

      {dialogRow && (
        <FormulaDialog
          mode={dialog.mode}
          row={dialogRow}
          captured={captured}
          accounts={accounts}
          currencies={data.currencies}
          defaultCurrency={defaultCurrency}
          tenantId={capture.tenantId}
          companyOptions={[{ value: companyCode, label: companyCode, tenantId: capture.tenantId }]}
          onSaveAccount={saveAccount}
          onClose={() => setDialog(null)}
          onSave={saveFormulaDraft}
        />
      )}

      <DeleteDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        names={delRows.map((r) => rowName(r, t))}
        noun="row"
        note={delRows.some((r) => r.type === "main") ? t("summary.deleteNote") : undefined}
        onConfirm={confirmDeleteRows}
      />
    </div>
  );
}
