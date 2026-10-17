import { useEffect, useMemo, useRef, useState } from "react";
import { Calculator, Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import MainOverlay from "@/components/layout/MainOverlay.jsx";
import DropdownSelect from "@/components/shared/DropdownSelect.jsx";
import { AddButton, SelectField, SoftButton, TextInput, inputClass, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";
import AccountFormModal from "@/pages/account/form/AccountFormModal.jsx";
import { INPUT_METHODS, applyInputMethod, cellNumber, evalExpression, expandRefs, parseSource, plainNumber } from "./summaryMath";

const KEYS = [
  ["7", "8", "9", "/"],
  ["4", "5", "6", "*"],
  ["1", "2", "3", "-"],
  ["0", ".", null, "+"],
  ["(", ")", "clr", "="],
];
const keyClass = (k) =>
  cn(
    "h-[38px] cursor-pointer rounded-[10px] border border-white/85 bg-white/70 fm-btn text-[#1f2937] shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-[transform,background-color] hover:bg-white active:scale-95 modal-compact:h-8",
    "/*+-".includes(k) && "bg-[rgba(214,230,250,0.8)] text-brand-navy",
    k === "clr" && "border-[#fecaca] bg-[#fee2e2] text-[#dc2626]",
    k === "=" && "border-none bg-brand-sweep text-white"
  );

const gl = "whitespace-nowrap fm-label text-[#374151]";

// 1234567.5 -> "1,234,567.5"
const group = (plain) => {
  const [int, frac] = plain.split(".");
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (frac ? `.${frac}` : "");
};

/**
 * Add Formula / Edit Formula of a Data Capture Summary row: Id Product (fixed: it names the row), Input Method, Account (+ /
 * pen opens the Account modal on top), Currency, Source (a multiplier: 1, 2, 0.5), Description, the Data pickers, the Formula
 * with a live Result, the captured Row data (a click inserts $n) and a calculator keypad.
 *
 * mode: "fill" (the row has no account yet: the formula goes into this row) | "sub" (the row has one: the formula becomes a
 *       new sub row under it) | "edit"
 * row: the summary row; captured: { rows } of the sheet; accounts: [{ label, id, row }]; currencies: [{ id, code }]
 * companyOptions / tenantId: what the Account modal offers; onSaveAccount({ url, body }): saves an account made or edited
 *   in that modal and answers its label
 * onSave({ account, accountId, currency, currencyId, formula, sourcePercent, inputMethod, description }): may be async;
 *   when it throws, the message is shown in the footer and the dialog stays open
 */
export default function FormulaDialog({ mode = "fill", row, captured, accounts, currencies, defaultCurrency = "", tenantId, companyOptions, onSaveAccount, onClose, onSave }) {
  const { t } = useTranslation(["capture", "common"]);
  const edit = mode === "edit";
  const methodLabel = (key) => t(`summary.methods.${key}`);
  const methodOptions = useMemo(() => INPUT_METHODS.map((m) => ({ value: m.value, label: t(`summary.methods.${m.value}`) })), [t]);
  const title = edit ? t("summary.dialog.edit") : mode === "sub" ? t("summary.dialog.addSub") : t("summary.dialog.add");
  const [method, setMethod] = useState(edit ? row.inputMethod : "");
  const [account, setAccount] = useState(edit ? row.account : "");
  const [currency, setCurrency] = useState(row.currency || defaultCurrency);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState(edit ? row.sourcePercent : "1");
  const [desc, setDesc] = useState(row.description);
  const [dataRow, setDataRow] = useState(String(row.rowIndex));
  const [dataCol, setDataCol] = useState("");
  const [fx, setFx] = useState(edit ? row.formula : "");
  const [failed, setFailed] = useState(null); // { message, at }: the refusal of the last Save, for the values it was made with
  const [accountModal, setAccountModal] = useState(false);
  const [flash, setFlash] = useState(null);
  const fxRef = useRef(null);
  const dialogRef = useRef(null);
  const saveRef = useRef(null);

  // The Id Products of the sheet; the same id on several sheet rows is told apart by the row letter.
  const dataRows = useMemo(() => {
    const list = captured.rows.map((r, i) => ({ i, id: String(r[1] ?? "").trim(), letter: String(r[0] ?? "") })).filter((r) => r.id);
    return list.map((r) => ({ value: String(r.i), label: list.filter((x) => x.id === r.id).length > 1 ? `${r.id} (${r.letter})` : r.id }));
  }, [captured]);
  const own = Number(dataRow) === row.rowIndex;
  const cells = useMemo(
    () =>
      (captured.rows[Number(dataRow)] ?? [])
        .map((text, n) => ({ n, t: String(text ?? ""), v: cellNumber(text) }))
        .filter((c) => c.n >= 2 && c.t.trim() !== ""),
    [captured, dataRow]
  );
  const colOptions = useMemo(() => cells.map((c) => ({ value: String(c.n), label: `[${c.n}] ${c.t}` })), [cells]);
  const refOf = (n) => (own ? `$${n}` : `[${captured.rows[Number(dataRow)][1]},${n}]`);

  // raw = the formula alone; result = what the row will show before its Rate (x Source, then the Input Method).
  const { raw, result } = useMemo(() => {
    if (!fx.trim()) return { raw: null, result: { text: "-" } };
    try {
      const value = evalExpression(expandRefs(fx, captured, row.rowIndex));
      const src = parseSource(source);
      if (src === null) return { raw: value, result: { text: t("summary.dialog.invalidSource"), bad: true } };
      const final = applyInputMethod(src.minus(1).abs().lt("0.0001") ? value : value.mul(src), method);
      return { raw: value, result: { text: group(plainNumber(final)) } };
    } catch {
      return { raw: null, result: { text: t("summary.dialog.invalidFormula"), bad: true } };
    }
  }, [fx, source, method, captured, row.rowIndex, t]);
  const note = [parseSource(source)?.minus(1).abs().lt("0.0001") === false ? `× ${source.trim()}` : "", method ? methodLabel(method) : ""].filter(Boolean).join(" · ");
  const used = useMemo(() => {
    const counts = {};
    if (own) for (const m of fx.matchAll(/\$(\d+)/g)) counts[m[1]] = (counts[m[1]] ?? 0) + 1;
    else {
      const id = String(captured.rows[Number(dataRow)]?.[1] ?? "").trim().toUpperCase();
      for (const m of fx.matchAll(/\[([^,\]]+),\s*(\d+)\]/g)) if (m[1].trim().toUpperCase() === id) counts[m[2]] = (counts[m[2]] ?? 0) + 1;
    }
    return counts;
  }, [fx, own, captured, dataRow]);

  // Escape closes the dialog unless the Account modal (or an open dropdown, which prevents its own Escape) is on top.
  // Enter saves (like the Save button) while typing in the dialog's fields; not on a button (the keypad, a closed
  // dropdown: Enter clicks / opens it), not in an open dropdown list (rendered outside the dialog), not mid-IME.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.defaultPrevented || accountModal) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "Enter" && !e.isComposing && !e.repeat) {
        const target = e.target;
        const inDialog = target === document.body || dialogRef.current?.contains(target);
        if (!inDialog || target.closest?.("button, [role='button']")) return;
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [accountModal, onClose]);
  useEffect(() => {
    fxRef.current?.focus();
  }, []);

  const insert = (text) => {
    setFx((f) => f + text);
    fxRef.current?.focus();
  };
  const pressKey = (k) => {
    if (k === "clr") setFx("");
    else if (k === "=") {
      if (raw !== null) setFx(plainNumber(raw));
      return;
    } else setFx((f) => f + k);
    fxRef.current?.focus();
  };
  const pickCell = (c) => {
    insert(refOf(c.n));
    setFlash(c.n);
    setTimeout(() => setFlash(null), 400);
  };
  const changeDataRow = (next) => {
    setDataRow(next);
    setDataCol("");
  };
  // The message of the last Save goes away as soon as something is changed.
  const stamp = [fx, account, currency, source, method].join("");
  const error = failed?.stamp === stamp ? failed.message : "";

  // A Profit account is shown by its account alone ("1SLOT", not "1SLOT [1SLOT]"); the value stays the full label,
  // which is what is saved and matched against the rows.
  const accountOptions = useMemo(
    () => accounts.map((a) => ({ value: a.label, label: a.row?.role === "PROFIT" ? String(a.row.accountId || a.label) : a.label })),
    [accounts]
  );
  const currencyOptions = useMemo(() => currencies.map((c) => ({ value: c.code, label: c.code })), [currencies]);
  const picked = accounts.find((a) => a.label === account);

  const save = async () => {
    const refuse = (message) => setFailed({ message, stamp });
    if (!picked) return refuse(t("summary.dialog.errSelectAccount"));
    const pickedCurrency = currencies.find((c) => c.code === currency);
    if (!pickedCurrency) return refuse(t("summary.dialog.errSelectCurrency"));
    if (raw === null) return refuse(t("summary.dialog.errFormula"));
    if (parseSource(source) === null) return refuse(t("summary.dialog.errSource"));
    setSaving(true);
    try {
      await onSave({
        account: picked.label,
        accountId: picked.id,
        currency: pickedCurrency.code,
        currencyId: pickedCurrency.id,
        formula: fx.trim(),
        sourcePercent: source.trim() || "1",
        inputMethod: method,
        description: desc.trim(),
      });
    } catch (err) {
      refuse(err?.message || t("summary.dialog.errSave"));
      setSaving(false);
    }
  };

  // Enter goes through the same gate as the Save button (a formula typed, not already saving).
  saveRef.current = () => {
    if (fx.trim() && !saving) save();
  };

  const hasAccount = Boolean(picked);

  return (
    <MainOverlay>
      <div className="absolute inset-0 z-30 flex animate-dialog-overlay items-center justify-center p-4 motion-reduce:animate-none">
        <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-[rgba(214,230,252,0.72)] backdrop-blur-[12px]" />
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="relative z-10 flex max-h-full w-[min(1180px,100%)] flex-col overflow-hidden rounded-[20px] border border-white/70 bg-[rgba(232,240,251,0.88)] shadow-[0_30px_70px_-30px_rgba(20,51,107,0.55)] backdrop-blur-[22px] backdrop-saturate-[1.15]"
        >
          <header className="flex flex-none items-center gap-3 border-b border-[rgba(130,155,195,0.25)] px-[18px] pt-3.5 pb-3 modal-short:px-4 modal-short:pt-2.5 modal-short:pb-2">
            <div className="flex size-9 flex-none items-center justify-center rounded-[11px] bg-brand-sweep text-white shadow-[0_8px_16px_-8px_rgba(20,90,220,0.55),inset_0_2px_4px_rgba(255,255,255,0.35)] modal-short:size-[30px] modal-short:rounded-[9px]">
              <Calculator className="size-[18px] modal-short:size-4" strokeWidth={2.2} />
            </div>
            <h2 className="m-0 fm-section text-brand-navy">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common:close")}
              className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-[10px] border-none bg-transparent text-[#64748b] hover:bg-white/70 hover:text-[#ef4444]"
            >
              <X className="size-[18px]" strokeWidth={2.4} />
            </button>
          </header>

          <div className="formula-grid min-h-0 overflow-y-auto px-[18px] py-4 [scrollbar-width:thin] modal-short:px-4 modal-short:py-2.5">
            <label className={gl} style={{ gridArea: "lid" }} htmlFor="fx-id">{t("summary.dialog.idProduct")}</label>
            <TextInput id="fx-id" value={row.idProduct} readOnly tabIndex={-1} title={t("summary.dialog.idProductTitle")} className="min-w-0 cursor-default bg-modal-off uppercase" style={{ gridArea: "cid" }} />
            <span className={gl} style={{ gridArea: "lim" }}>{t("summary.dialog.inputMethod")}</span>
            <div className="min-w-0" style={{ gridArea: "cim" }}>
              <SelectField value={method} onChange={setMethod} options={methodOptions} placeholder={t("summary.dialog.selectMethod")} onClear={() => setMethod("")} />
            </div>

            <span className={gl} style={{ gridArea: "lac" }}>{t("summary.dialog.account")}</span>
            <div className="flex min-w-0 items-center gap-1.5" style={{ gridArea: "cac" }}>
              <DropdownSelect
                options={accountOptions}
                value={account}
                onChange={(v) => setAccount(v ?? "")}
                placeholder={t("summary.dialog.selectAccount")}
                searchable
                clearable
                searchPlaceholder={t("summary.dialog.search")}
                ariaLabel={t("summary.dialog.account")}
                className={cn(inputClass, "min-w-0 flex-1 justify-between gap-2 py-0 font-normal shadow-[0_1px_3px_rgba(15,23,42,0.05)]")}
              />
              <AddButton label={hasAccount ? t("summary.dialog.editAccount") : t("summary.dialog.addAccount")} edit={hasAccount} onClick={() => setAccountModal(true)} />
            </div>
            <span className={gl} style={{ gridArea: "lcu" }}>{t("summary.dialog.currency")}</span>
            <div className="min-w-0" style={{ gridArea: "ccu" }}>
              <SelectField value={currency} onChange={setCurrency} options={currencyOptions} placeholder={t("summary.dialog.selectCurrency")} />
            </div>

            <label className={gl} style={{ gridArea: "lsr" }} htmlFor="fx-src">{t("summary.dialog.source")}</label>
            <TextInput id="fx-src" value={source} onChange={(e) => setSource(e.target.value)} inputMode="decimal" placeholder={t("summary.table.sourcePlaceholder")} title={t("summary.dialog.sourceTitle")} autoComplete="off" className="min-w-0" style={{ gridArea: "csr" }} />
            <label className={gl} style={{ gridArea: "lde" }} htmlFor="fx-desc">{t("summary.dialog.description")}</label>
            <TextInput id="fx-desc" value={desc} onChange={(e) => setDesc(e.target.value.toUpperCase())} autoComplete="off" className="min-w-0 uppercase" style={{ gridArea: "cde" }} />

            <span className={gl} style={{ gridArea: "ldt" }}>{t("summary.dialog.data")}</span>
            <div className="flex min-w-0 items-center gap-[5px]" style={{ gridArea: "cdt" }}>
              <div className="min-w-[104px] flex-[1.25_1_0]">
                <SelectField wide value={dataRow} onChange={changeDataRow} options={dataRows} placeholder={t("summary.dialog.selectIdProduct")} />
              </div>
              <div className="min-w-0 flex-[1_1_0]">
                <SelectField wide value={dataCol} onChange={setDataCol} options={colOptions} placeholder={t("summary.dialog.selectRowData")} />
              </div>
              <button
                type="button"
                disabled={!dataCol || cells.find((c) => String(c.n) === dataCol)?.v === null}
                onClick={() => {
                  const c = cells.find((x) => String(x.n) === dataCol);
                  if (c && c.v !== null) insert(refOf(c.n));
                }}
                className={cn(primaryButtonClass, "h-9 flex-none px-[11px] fm-btn-sm modal-compact:h-[30px] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:grayscale-[0.5]")}
              >
                {t("summary.dialog.add_button")}
              </button>
            </div>

            <label className={gl} style={{ gridArea: "lfx" }} htmlFor="fx-formula">{t("summary.dialog.formula")}</label>
            <TextInput id="fx-formula" ref={fxRef} value={fx} onChange={(e) => setFx(e.target.value)} placeholder={t("summary.dialog.formulaPlaceholder")} autoComplete="off" className="min-w-0" style={{ gridArea: "cfx" }} />
            <span style={{ gridArea: "lrs" }} />
            <div
              className={cn(
                "flex h-9 w-full items-center justify-between rounded-[10px] border border-dashed border-modal-input-line bg-white/35 px-3 fm-input tabular-nums text-dash-sub modal-compact:h-[30px]",
                result.bad && "[&_b]:text-[#dc2626]"
              )}
              style={{ gridArea: "crs" }}
            >
              <span className="min-w-0 truncate" title={note || undefined}>
                {t("summary.dialog.result")}{note && <small className="ml-2 fm-help text-dash-faint">{note}</small>}
              </span>
              <b className="flex-none pl-2 fm-input font-semibold! text-brand-navy">{result.text}</b>
            </div>

            <span className={cn(gl, "self-start pt-1.5")} style={{ gridArea: "lrd" }} title={t("summary.dialog.rowDataTitle")}>
              {t("summary.dialog.rowData")}
            </span>
            <div className="flex max-h-[104px] flex-wrap gap-1.5 self-start overflow-y-auto py-0.5 pr-0.5 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin] modal-short:max-h-[68px]" style={{ gridArea: "crd" }}>
              {cells.length === 0 ? (
                <div className="py-1.5 fm-help text-dash-faint">{t("summary.dialog.rowDataEmpty")}</div>
              ) : (
                cells.map((c) => (
                  <button
                    key={c.n}
                    type="button"
                    disabled={c.v === null}
                    onClick={() => pickCell(c)}
                    title={c.v === null ? t("summary.dialog.textCell") : t("summary.dialog.insert", { ref: refOf(c.n) })}
                    className={cn(
                      "inline-flex h-[30px] cursor-pointer items-center gap-[5px] rounded-lg border border-[rgba(130,155,195,0.4)] bg-white/70 px-2.5 fm-btn-sm text-[#1f2937] transition-colors enabled:hover:border-[#7fb2ff] enabled:hover:bg-white modal-short:h-[26px] modal-short:px-2",
                      c.v === null && "cursor-not-allowed bg-white/35 text-[#94a3b8]",
                      flash === c.n && "border-[#3b82f6] bg-[#bfdbfe]"
                    )}
                  >
                    <i className={cn("fm-help font-semibold! not-italic", c.v === null ? "text-[#a8b3c4]" : "text-[#64748b]")}>[{c.n}]</i>
                    <span className="max-w-[180px] flex-none truncate tabular-nums">{c.t}</span>
                    {used[c.n] && (
                      <em title={t("summary.dialog.used", { count: used[c.n] })} className="ml-0.5 flex h-[18px] items-center rounded-full bg-[rgba(20,51,107,0.08)] px-1.5 fm-opt font-semibold! not-italic text-dash-sub">
                        ×{used[c.n]}
                      </em>
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="grid w-[232px] grid-cols-4 content-start gap-2 self-start justify-self-end max-[1400px]:w-[200px] max-[1100px]:justify-self-center modal-short:gap-1.5" style={{ gridArea: "keys" }}>
              {KEYS.flat().map((k, i) =>
                k === null ? (
                  <span key={i} aria-hidden="true" />
                ) : (
                  <button key={k} type="button" onClick={() => pressKey(k)} className={keyClass(k)}>
                    {k === "clr" ? t("summary.dialog.clear") : k}
                  </button>
                )
              )}
            </div>
          </div>

          <footer className="flex flex-none items-center justify-end gap-2 border-t border-white/70 px-[18px] pt-3 pb-4 modal-short:px-4 modal-short:pt-2 modal-short:pb-3">
            {error && (
              <span role="alert" className="mr-auto min-w-0 truncate fm-help font-medium! text-[#dc2626]">
                {error}
              </span>
            )}
            <SoftButton onClick={onClose} className="h-[38px] min-w-[112px] px-[22px] fm-btn modal-short:h-[34px] modal-short:min-w-[104px]">
              {t("common:cancel")}
            </SoftButton>
            <button
              type="button"
              onClick={save}
              disabled={!fx.trim() || saving}
              className={cn(primaryButtonClass, "h-[38px] min-w-[112px] px-[22px] fm-btn modal-short:h-[34px] modal-short:min-w-[104px] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:brightness-100")}
            >
              <Check className="size-[15px]" strokeWidth={2.5} />
              {saving ? t("summary.dialog.saving") : t("common:save")}
            </button>
          </footer>
        </div>
      </div>

      {/* The Account page's Add / Edit Account modal, on top of this dialog. */}
      {accountModal && (
        <AccountFormModal
          mode={hasAccount ? "edit" : "add"}
          account={picked?.row}
          tenantId={tenantId}
          companyOptions={companyOptions}
          onClose={() => setAccountModal(false)}
          onSave={async (request) => {
            setAccount(await onSaveAccount(request));
            setAccountModal(false);
          }}
        />
      )}
    </MainOverlay>
  );
}
