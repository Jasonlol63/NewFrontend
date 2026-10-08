import { useEffect, useMemo, useRef, useState } from "react";
import { Calculator, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import MainOverlay from "@/components/layout/MainOverlay.jsx";
import DropdownSelect from "@/components/shared/DropdownSelect.jsx";
import { AddButton, SelectField, SoftButton, TextInput, inputClass, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";
import AccountFormModal from "@/pages/account/AccountFormModal.jsx";
import { MOCK_CURRENCIES } from "@/pages/process/games/processFormOptions";
import { INPUT_METHODS, MOCK_CAPTURED, MOCK_SUMMARY_ACCOUNTS, capturedCells, evalFormula } from "./dataCaptureRules";

// "KY [KAI YUAN]" <-> { accountId: "KY", name: "KAI YUAN" }
const parseAccount = (label) => {
  const m = /^(.*?)\s*\[(.*)\]$/.exec(label ?? "");
  return m ? { accountId: m[1], name: m[2] } : { accountId: label ?? "", name: "" };
};
const accountLabel = ({ accountId, name }) => (name ? `${accountId} [${name}]` : accountId);

const COMPANY_OPTIONS = ["95", "AG", "CX", "RS", "VG"].map((c) => ({ value: c, label: c }));
const ID_OPTIONS = Object.keys(MOCK_CAPTURED).map((k) => ({ value: k, label: k }));

const KEYS = [
  ["7", "8", "9", "/"],
  ["4", "5", "6", "*"],
  ["1", "2", "3", "-"],
  ["0", ".", null, "+"],
  ["(", ")", "clr", "="],
];
const keyClass = (k) =>
  cn(
    "h-[38px] cursor-pointer rounded-[10px] border border-white/85 bg-white/70 text-[14px] font-bold text-[#1f2937] shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-[transform,background-color] hover:bg-white active:scale-95 modal-compact:h-8 modal-compact:text-[13px]",
    "/*+-".includes(k) && "bg-[rgba(214,230,250,0.8)] text-brand-navy",
    k === "clr" && "border-[#fecaca] bg-[#fee2e2] text-[#dc2626]",
    k === "=" && "border-none bg-brand-sweep text-white"
  );

const gl = "whitespace-nowrap text-[12.5px] font-bold text-[#374151] max-[700px]:text-[12px] modal-short:text-[12px]";

/**
 * Add Formula / Edit Formula of a Data Capture Summary row: Id Product, Input Method, Account (+ / pen opens the Account
 * modal on top), Currency, Source, Description, the Data pickers, the Formula with a live Result, the captured Row data
 * (a click inserts $n) and a calculator keypad. UI only for now: the captured rows and accounts are mock data
 * (dataCaptureRules.js) and Save just hands the draft back through onSave.
 *
 * mode: "add" | "edit"; row: the summary row; onSave({ f, src, acc, cur, base }).
 */
export default function FormulaDialog({ mode = "add", row, onClose, onSave }) {
  const [id, setId] = useState(row.id);
  const [method, setMethod] = useState("");
  const [account, setAccount] = useState(row.acc);
  const [accounts, setAccounts] = useState(MOCK_SUMMARY_ACCOUNTS);
  const [currency, setCurrency] = useState(row.cur);
  const [source, setSource] = useState(String(row.src));
  const [desc, setDesc] = useState("");
  const [dataId, setDataId] = useState(row.id in MOCK_CAPTURED ? row.id : Object.keys(MOCK_CAPTURED)[0]);
  const [dataRow, setDataRow] = useState("");
  const [fx, setFx] = useState(mode === "edit" ? String(row.f) : "");
  const [accountModal, setAccountModal] = useState(false);
  const [flash, setFlash] = useState(null);
  const fxRef = useRef(null);

  const cells = useMemo(() => capturedCells(dataId), [dataId]);
  const rowOptions = useMemo(() => cells.map((c) => ({ value: String(c.n), label: `[${c.n}] ${c.t}` })), [cells]);
  const result = useMemo(() => {
    if (!fx.trim()) return { text: "-", value: null };
    try {
      const value = evalFormula(fx, cells);
      return { text: value.toLocaleString("en-US", { maximumFractionDigits: 6 }), value };
    } catch {
      return { text: "Invalid formula", value: null, bad: true };
    }
  }, [fx, cells]);
  const used = useMemo(() => {
    const counts = {};
    for (const m of fx.matchAll(/\$(\d+)/g)) counts[m[1]] = (counts[m[1]] ?? 0) + 1;
    return counts;
  }, [fx]);

  // Escape closes the dialog unless the Account modal (or an open dropdown, which prevents its own Escape) is on top.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !e.defaultPrevented && !accountModal) onClose();
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
      if (result.value !== null) setFx(String(+result.value.toFixed(6)));
      return;
    } else setFx((f) => f + k);
    fxRef.current?.focus();
  };
  const pickCell = (c) => {
    insert(`$${c.n}`);
    setFlash(c.n);
    setTimeout(() => setFlash(null), 400);
  };
  const changeDataId = (next) => {
    setDataId(next);
    setDataRow("");
  };

  const save = () => onSave({ f: fx.trim(), src: Number(source) || row.src, acc: account || row.acc, cur: currency || row.cur, value: result.value });

  const hasAccount = Boolean(account);
  const accountDraft = parseAccount(account);

  return (
    <MainOverlay>
      <div className="absolute inset-0 z-30 flex animate-dialog-overlay items-center justify-center p-4 motion-reduce:animate-none">
        <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-[rgba(214,230,252,0.72)] backdrop-blur-[12px]" />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={mode === "edit" ? "Edit Formula" : "Add Formula"}
          className="relative z-10 flex max-h-full w-[min(1180px,100%)] flex-col overflow-hidden rounded-[20px] border border-white/70 bg-[rgba(232,240,251,0.88)] shadow-[0_30px_70px_-30px_rgba(20,51,107,0.55)] backdrop-blur-[22px] backdrop-saturate-[1.15]"
        >
          <header className="flex flex-none items-center gap-3 border-b border-[rgba(130,155,195,0.25)] px-[18px] pt-3.5 pb-3 modal-short:px-4 modal-short:pt-2.5 modal-short:pb-2">
            <div className="flex size-9 flex-none items-center justify-center rounded-[11px] bg-brand-sweep text-white shadow-[0_8px_16px_-8px_rgba(20,90,220,0.55),inset_0_2px_4px_rgba(255,255,255,0.35)] modal-short:size-[30px] modal-short:rounded-[9px]">
              <Calculator className="size-[18px] modal-short:size-4" strokeWidth={2.2} />
            </div>
            <h2 className="m-0 text-[20px] font-extrabold tracking-[-0.2px] text-brand-navy modal-short:text-[17px]">{mode === "edit" ? "Edit Formula" : "Add Formula"}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-[10px] border-none bg-transparent text-[#64748b] hover:bg-white/70 hover:text-[#ef4444]"
            >
              <X className="size-[18px]" strokeWidth={2.4} />
            </button>
          </header>

          <div className="formula-grid min-h-0 overflow-y-auto px-[18px] py-4 [scrollbar-width:thin] modal-short:px-4 modal-short:py-2.5">
            <label className={gl} style={{ gridArea: "lid" }} htmlFor="fx-id">Id Product</label>
            <TextInput id="fx-id" value={id} onChange={(e) => setId(e.target.value)} autoComplete="off" className="min-w-0 uppercase" style={{ gridArea: "cid" }} />
            <span className={gl} style={{ gridArea: "lim" }}>Input Method</span>
            <div className="min-w-0" style={{ gridArea: "cim" }}>
              <SelectField value={method} onChange={setMethod} options={INPUT_METHODS} placeholder="Select Input Method (Optional)" onClear={() => setMethod("")} />
            </div>

            <span className={gl} style={{ gridArea: "lac" }}>Account</span>
            <div className="flex min-w-0 items-center gap-1.5" style={{ gridArea: "cac" }}>
              <DropdownSelect
                options={accounts}
                value={account}
                onChange={(v) => setAccount(v ?? "")}
                placeholder="Select Account"
                searchable
                clearable
                searchPlaceholder="Search"
                ariaLabel="Account"
                className={cn(inputClass, "min-w-0 flex-1 justify-between gap-2 py-0 font-normal shadow-[0_1px_3px_rgba(15,23,42,0.05)]")}
              />
              <AddButton label={hasAccount ? "Edit account" : "Add account"} edit={hasAccount} onClick={() => setAccountModal(true)} />
            </div>
            <span className={gl} style={{ gridArea: "lcu" }}>Currency</span>
            <div className="min-w-0" style={{ gridArea: "ccu" }}>
              <SelectField value={currency} onChange={setCurrency} options={MOCK_CURRENCIES} placeholder="Select Currency" />
            </div>

            <label className={gl} style={{ gridArea: "lsr" }} htmlFor="fx-src">Source</label>
            <TextInput id="fx-src" value={source} onChange={(e) => setSource(e.target.value)} inputMode="numeric" autoComplete="off" className="min-w-0" style={{ gridArea: "csr" }} />
            <label className={gl} style={{ gridArea: "lde" }} htmlFor="fx-desc">Description</label>
            <TextInput id="fx-desc" value={desc} onChange={(e) => setDesc(e.target.value)} autoComplete="off" className="min-w-0 uppercase" style={{ gridArea: "cde" }} />

            <span className={gl} style={{ gridArea: "ldt" }}>Data</span>
            <div className="flex min-w-0 items-center gap-[5px]" style={{ gridArea: "cdt" }}>
              <div className="min-w-[104px] flex-[1.25_1_0]">
                <SelectField value={dataId} onChange={changeDataId} options={ID_OPTIONS} placeholder="Select Id Product" />
              </div>
              <div className="min-w-0 flex-[1_1_0]">
                <SelectField value={dataRow} onChange={setDataRow} options={rowOptions} placeholder="Select Row Data" />
              </div>
              <button
                type="button"
                disabled={!dataRow || cells.find((c) => String(c.n) === dataRow)?.v === null}
                onClick={() => {
                  const c = cells.find((x) => String(x.n) === dataRow);
                  if (c && c.v !== null) insert(`$${c.n}`);
                }}
                className={cn(primaryButtonClass, "h-9 flex-none px-[11px] text-[12.5px] modal-compact:h-[30px] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:grayscale-[0.5]")}
              >
                Add
              </button>
            </div>

            <label className={gl} style={{ gridArea: "lfx" }} htmlFor="fx-formula">Formula</label>
            <TextInput id="fx-formula" ref={fxRef} value={fx} onChange={(e) => setFx(e.target.value)} placeholder="e.g. $5+$10*0.6/7" autoComplete="off" className="min-w-0" style={{ gridArea: "cfx" }} />
            <span style={{ gridArea: "lrs" }} />
            <div
              className={cn(
                "flex h-9 w-full items-center justify-between rounded-[10px] border border-dashed border-modal-input-line bg-white/35 px-3 text-[13px] tabular-nums text-dash-sub modal-compact:h-[30px]",
                result.bad && "[&_b]:text-[#dc2626]"
              )}
              style={{ gridArea: "crs" }}
            >
              <span>Result</span>
              <b className="text-[14px] text-brand-navy">{result.text}</b>
            </div>

            <span className={cn(gl, "self-start pt-1.5")} style={{ gridArea: "lrd" }} title="Click a value to insert it into the formula">
              Row data
            </span>
            <div className="flex max-h-[104px] flex-wrap gap-1.5 self-start overflow-y-auto py-0.5 pr-0.5 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin] modal-short:max-h-[68px]" style={{ gridArea: "crd" }}>
              {cells.length === 0 ? (
                <div className="py-1.5 text-[12px] text-dash-faint">Select an Id Product in Data to list its captured values.</div>
              ) : (
                cells.map((c) => (
                  <button
                    key={c.n}
                    type="button"
                    disabled={c.v === null}
                    onClick={() => pickCell(c)}
                    title={c.v === null ? "Text, not usable in a formula" : `Insert $${c.n}`}
                    className={cn(
                      "inline-flex h-[30px] cursor-pointer items-center gap-[5px] rounded-lg border border-[rgba(130,155,195,0.4)] bg-white/70 px-2.5 text-[12.5px] font-semibold text-[#1f2937] transition-colors enabled:hover:border-[#7fb2ff] enabled:hover:bg-white modal-short:h-[26px] modal-short:px-2 modal-short:text-[12px]",
                      c.v === null && "cursor-not-allowed bg-white/35 text-[#94a3b8]",
                      flash === c.n && "border-[#3b82f6] bg-[#bfdbfe]"
                    )}
                  >
                    <i className={cn("text-[12px] font-bold not-italic", c.v === null ? "text-[#a8b3c4]" : "text-[#64748b]")}>[{c.n}]</i>
                    <span className="max-w-[180px] flex-none truncate tabular-nums">{c.t}</span>
                    {used[c.n] && (
                      <em title={`Used ${used[c.n]} time(s) in the formula`} className="ml-0.5 flex h-[18px] items-center rounded-full bg-[rgba(20,51,107,0.08)] px-1.5 text-[10.5px] font-extrabold not-italic text-dash-sub">
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
                    {k === "clr" ? "Clr" : k}
                  </button>
                )
              )}
            </div>
          </div>

          <footer className="flex flex-none justify-end gap-2 border-t border-white/70 px-[18px] pt-3 pb-4 modal-short:px-4 modal-short:pt-2 modal-short:pb-3">
            <SoftButton onClick={onClose} className="h-[38px] min-w-[112px] px-[22px] text-[13.5px] modal-short:h-[34px] modal-short:min-w-[104px] modal-short:text-[13px]">
              Cancel
            </SoftButton>
            <button
              type="button"
              onClick={save}
              disabled={!fx.trim()}
              className={cn(primaryButtonClass, "h-[38px] min-w-[112px] px-[22px] text-[13.5px] modal-short:h-[34px] modal-short:min-w-[104px] modal-short:text-[13px] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:brightness-100")}
            >
              <Check className="size-[15px]" strokeWidth={2.5} />
              Save
            </button>
          </footer>
        </div>
      </div>

      {/* The Account page's Add / Edit Account modal, on top of this dialog. */}
      {accountModal && (
        <AccountFormModal
          mode={hasAccount ? "edit" : "add"}
          account={hasAccount ? { ...accountDraft, role: "", remark: "", paymentAlert: false } : undefined}
          companyCode="CX"
          companyOptions={COMPANY_OPTIONS}
          onClose={() => setAccountModal(false)}
          onSave={(draft) => {
            const label = accountLabel(draft);
            if (!label) return;
            setAccounts((list) => (list.some((a) => a.value === label) ? list : [...list, { value: label, label }]));
            setAccount(label);
            setAccountModal(false);
          }}
        />
      )}
    </MainOverlay>
  );
}
