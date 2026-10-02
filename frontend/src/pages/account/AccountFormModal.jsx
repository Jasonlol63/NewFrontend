import { useState } from "react";
import { Check, Plus, Trash2, UserPen, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toIsoDate } from "@/lib/date";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import FormCard, { CardCount } from "@/components/shared/form-modal/FormCard.jsx";
import { CheckListTools, CheckRows } from "@/components/shared/form-modal/CheckList.jsx";
import { filterItems, toggleIn } from "@/components/shared/form-modal/listSelection";
import DateField from "@/components/shared/form-modal/DateField.jsx";
import {
  Field,
  PasswordInput,
  SelectField,
  TextInput,
  ToggleSwitch,
  primaryButtonClass,
} from "@/components/shared/form-modal/fields.jsx";
import {
  ALERT_PICKS,
  MOCK_CURRENCIES,
  PRESET_DAYS,
  ROLE_OPTIONS,
  normalizeAlertAmount,
} from "./accountFormOptions";

// Layout, from the content area width (@container/main = screen minus sidebar). Four boxes at every size:
//   >= 1210px (1440+ screens): 3 columns, Account Information + Payment Alert | Currency | Company
//   900-1209px: 2 equal columns, Account Information + Payment Alert | Currency + Company (compact tiles)
//   < 900px (portrait tablets): one column (Account Information, Payment Alert, Currency, Company), scrolling
// Height tiers: modal-compact <= 760, modal-short <= 700, modal-snug <= 640, modal-tiny <= 600 (see index.css).
// Class names are written out in full so Tailwind can see them.

/**
 * Add Account / Edit Account: the same modal, only the title, header icon and defaults change.
 * mode: "add" | "edit"; account: the list row being edited (edit mode).
 * companyCode: the company picked on the Account page; companyOptions: the companies of the
 * picked Group ([{ value, label }]).
 * UI only for now: currencies are placeholders and Save just hands the draft back through onSave.
 */
export default function AccountFormModal({ mode = "add", account, companyCode, companyOptions = [], onClose, onSave }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState(() => ({
    accountId: isEdit ? (account?.accountId ?? "") : "",
    name: isEdit ? (account?.name ?? "") : "",
    role: isEdit ? (account?.role ?? "") : "",
    password: "",
    remark: isEdit ? (account?.remark ?? "") : "",
  }));
  const [alert, setAlert] = useState(() => ({
    on: isEdit ? Boolean(account?.paymentAlert) : false,
    type: 7, // a day count (1-31) or "monthly"
    custom: false, // the Custom day grid is open
    startDate: toIsoDate(new Date()),
    amount: "",
  }));
  const [currencies, setCurrencies] = useState(MOCK_CURRENCIES);
  const [pickedCurrencies, setPickedCurrencies] = useState(() => new Set(["MYR"]));
  const [companies, setCompanies] = useState(() => new Set(companyCode ? [companyCode] : []));

  const companyItems = (companyOptions.length ? companyOptions : companyCode ? [{ value: companyCode, label: companyCode }] : []).map((c) => ({
    value: c.value,
    label: c.label,
    tag: c.value === companyCode ? "CURRENT" : undefined,
  }));

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = () =>
    onSave?.({
      ...form,
      paymentAlert: alert.on,
      alertDay: alert.on ? String(alert.type) : null,
      alertStartDate: alert.on ? alert.startDate : null,
      alertAmount: alert.on ? alert.amount : null,
      currencies: [...pickedCurrencies],
      companies: [...companies],
    });

  return (
    <FormModal
      icon={isEdit ? UserPen : UserPlus}
      title={isEdit ? "Edit Account" : "Add Account"}
      onClose={onClose}
      onSave={save}
      bodyClassName={cn(
        "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
        "@min-[1210px]/main:grid-cols-3",
        "@max-[899px]/main:flex @max-[899px]/main:flex-col @max-[899px]/main:overflow-y-auto @max-[899px]/main:[scrollbar-width:thin]"
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-col gap-(--gap) @max-[899px]/main:contents">
        <AccountInfoCard form={form} setField={setField} setForm={setForm} isEdit={isEdit} />
        <PaymentAlertCard alert={alert} setAlert={setAlert} />
      </div>
      <div className="flex min-h-0 min-w-0 flex-col gap-(--gap) @max-[899px]/main:contents">
        <CurrencyCard currencies={currencies} setCurrencies={setCurrencies} picked={pickedCurrencies} setPicked={setPickedCurrencies} />
        {/* 900-1209px: Company is the second box of this column, as compact tiles. */}
        <CompanyCard tiles items={companyItems} selected={companies} onChange={setCompanies} className="min-h-[150px] @max-[899px]/main:hidden @min-[1210px]/main:hidden" />
      </div>
      {/* 1210px and up: Company has the third column (code + name rows); on portrait tablets it joins the one-column stack the same way. */}
      <div className="hidden min-h-0 min-w-0 flex-col @min-[1210px]/main:flex @max-[899px]/main:contents">
        <CompanyCard items={companyItems} selected={companies} onChange={setCompanies} className="@max-[899px]/main:order-4 @max-[899px]/main:flex-none" bodyClassName="@max-[899px]/main:overflow-visible" />
      </div>
    </FormModal>
  );
}

// Cards keep their own scroll on desktop; in the one-column tablet layout the whole body scrolls instead.
const stackCard = "@max-[899px]/main:flex-none @max-[899px]/main:overflow-visible";
const stackBody = "@max-[899px]/main:overflow-visible";

// Never shrinks, so no field hides behind a scroll; Payment Alert under it takes what is left.
function AccountInfoCard({ form, setField, setForm, isEdit }) {
  return (
    <FormCard title="Account Information" className={cn("flex-none @max-[899px]/main:order-1", stackCard)} bodyClassName={stackBody}>
      {/* 3 per row (ID | Name | Role, Password | Remark); 2 per row in the narrower 3-column layout. */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-2.5 modal-compact:gap-x-2.5 modal-compact:gap-y-1.5 modal-tiny:gap-x-2 modal-tiny:gap-y-1 @min-[1210px]/main:grid-cols-2">
        <Field label="Account ID">
          <TextInput value={form.accountId} onChange={setField("accountId")} autoComplete="off" className="uppercase" />
        </Field>
        <Field label="Name">
          <TextInput value={form.name} onChange={setField("name")} className="uppercase" />
        </Field>
        <Field label="Role">
          <SelectField value={form.role} onChange={(role) => setForm((f) => ({ ...f, role }))} options={ROLE_OPTIONS} placeholder="Select Role" />
        </Field>
        {/* Edit: left blank = keep the current password. */}
        <Field label="Password" optional={isEdit}>
          <PasswordInput value={form.password} onChange={setField("password")} placeholder={isEdit ? "Keep current" : undefined} />
        </Field>
        <Field label="Remark" optional className="col-span-2 @min-[1210px]/main:col-span-full">
          <TextInput value={form.remark} onChange={setField("remark")} />
        </Field>
      </div>
    </FormCard>
  );
}

function CurrencyCard({ currencies, setCurrencies, picked, setPicked }) {
  const [code, setCode] = useState("");
  const [deleting, setDeleting] = useState(false);

  const create = () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    if (!currencies.includes(c)) setCurrencies((list) => [...list, c]);
    setPicked((s) => new Set(s).add(c));
    setCode("");
  };
  // Delete mode: an unticked currency is removed; ticked ones are locked.
  const clickTile = (c) => {
    if (!deleting) setPicked((s) => toggleIn(s, c));
    else if (!picked.has(c)) setCurrencies((list) => list.filter((x) => x !== c));
  };

  return (
    <FormCard
      title="Currency"
      right={<CardCount>{picked.size} selected</CardCount>}
      // Fills its own column in the 3-column layout; in the 2-column one it takes its content height and Company takes the rest.
      className={cn("flex-1 @min-[900px]/main:@max-[1209px]/main:flex-none @max-[899px]/main:order-3", stackCard)}
      bodyClassName={stackBody}
    >
      {/* Code box + Create + Delete always on one row that fills the card: the box takes what the buttons leave. */}
      <div className="flex items-center gap-2">
        <TextInput
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^a-z]/gi, "").slice(0, 5))}
          onKeyDown={(e) => e.key === "Enter" && create()}
          aria-label="New currency code"
          className="min-w-[72px] flex-1 uppercase"
        />
        <button type="button" onClick={create} className={cn(primaryButtonClass, "h-9 flex-none px-3.5 text-[12.5px] modal-compact:h-[30px] modal-tiny:h-7")}>
          <Plus className="size-3.5" strokeWidth={2.6} />
          Create
        </button>
        <button
          type="button"
          onClick={() => setDeleting((v) => !v)}
          aria-pressed={deleting}
          className={cn(
            "inline-flex h-9 flex-none cursor-pointer items-center gap-1.5 rounded-[10px] border px-3.5 text-[12.5px] font-bold modal-compact:h-[30px] modal-tiny:h-7",
            deleting ? "border-[#dc2626] bg-[#dc2626] text-white" : "border-[#fecaca] bg-white/70 text-[#dc2626] hover:bg-white"
          )}
        >
          <Trash2 className="size-3.5" strokeWidth={2.2} />
          {deleting ? "Done" : "Delete"}
        </button>
      </div>

      <div
        className={cn(
          "mt-2.5 grid max-w-[700px] grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2 modal-compact:mt-2 modal-compact:gap-1.5",
          // 2-column layout on short laptops: Currency and Company share the column, so the tiles are smaller (4 per row)
          "@max-[1209px]/main:modal-short:mt-2 @max-[1209px]/main:modal-short:grid-cols-[repeat(auto-fill,minmax(84px,1fr))] @max-[1209px]/main:modal-short:gap-1.5 @max-[1209px]/main:modal-tiny:mt-1.5"
        )}
      >
        {currencies.map((c) => {
          const on = picked.has(c);
          const removable = deleting && !on;
          return (
            <button
              key={c}
              type="button"
              onClick={() => clickTile(c)}
              disabled={deleting && on}
              aria-pressed={on}
              title={removable ? `Delete ${c}` : undefined}
              className={cn(
                "relative flex h-10 cursor-pointer items-center rounded-[11px] border pl-3.5 pr-8 text-[13px] font-extrabold transition-colors modal-compact:h-9 modal-tiny:h-8",
                "@max-[1209px]/main:modal-short:h-8 @max-[1209px]/main:modal-short:pl-2.5 @max-[1209px]/main:modal-short:pr-7 @max-[1209px]/main:modal-short:text-[12.5px] @max-[1209px]/main:modal-tiny:h-[30px]",
                "disabled:cursor-not-allowed disabled:opacity-45",
                on
                  ? "border-[#7fb2ff] bg-row-stripe text-brand-navy"
                  : removable
                    ? "border-[#fecaca] bg-white text-[#b91c1c]"
                    : "border-modal-off-line bg-white/60 text-[#374151] hover:border-[#93c5fd]"
              )}
            >
              {c}
              {removable ? (
                <X className="absolute right-3 top-1/2 size-3 -translate-y-1/2 text-[#ef4444] @max-[1209px]/main:modal-short:right-2" strokeWidth={3.2} />
              ) : (
                <span
                  className={cn(
                    "absolute right-[11px] top-1/2 flex size-4 -translate-y-1/2 items-center justify-center rounded-full @max-[1209px]/main:modal-short:right-2",
                    on ? "bg-brand-sweep text-white" : "border-[1.5px] border-[#cbd5e1]"
                  )}
                >
                  {on && <Check className="size-2.5" strokeWidth={4} />}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {deleting && <p className="m-0 mt-2 text-[11.5px] text-[#b91c1c]">Click × to delete an unticked currency. Ticked currencies can&apos;t be deleted.</p>}
    </FormCard>
  );
}

function PaymentAlertCard({ alert, setAlert }) {
  const set = (patch) => setAlert((a) => ({ ...a, ...patch }));
  const custom = alert.custom || (alert.type !== "monthly" && !PRESET_DAYS.includes(alert.type));

  const pick = (value) => {
    if (value === "custom") set({ custom: true, type: alert.type === "monthly" ? 30 : alert.type });
    else set({ custom: false, type: value });
  };

  return (
    <FormCard
      title="Payment Alert"
      right={<ToggleSwitch on={alert.on} onToggle={() => set({ on: !alert.on })} label={alert.on ? "On" : "Off"} className="font-bold" />}
      className={cn("min-h-[140px] flex-1 @max-[899px]/main:order-2", stackCard)}
      bodyClassName={cn("pb-2.5 modal-compact:pb-2 modal-tiny:pb-1.5", stackBody)}
    >
      {!alert.on ? (
        <div className="grid h-full min-h-20 place-items-center rounded-xl border border-dashed border-modal-off-line p-2.5 text-center text-[12.5px] text-[#8a96a8]">
          <span>
            Payment alert is off.
            <br />
            Switch it on to set how often to remind, from when, and the amount.
          </span>
        </div>
      ) : (
        <>
          {/* Order: Start Date + Amount, then Alert Type, then (for Custom) the 1-31 grid under it, on every screen size. */}
          <div className="grid grid-cols-2 gap-x-3.5">
            <Field label="Start Date">
              <DateField value={alert.startDate} onChange={(startDate) => set({ startDate })} />
            </Field>
            <Field label="Alert (Amount)" optional>
              <TextInput
                value={alert.amount}
                onChange={(e) => set({ amount: e.target.value })}
                onBlur={() => set({ amount: normalizeAlertAmount(alert.amount) })}
                inputMode="decimal"
                placeholder="e.g. -5,000.00"
              />
            </Field>
          </div>

          <div className="mt-2.5 flex items-center gap-2.5 modal-compact:mt-2 modal-snug:mt-[5px]">
            <span className="flex-none whitespace-nowrap text-[12.5px] font-semibold text-[#374151] modal-compact:text-[12px] modal-tiny:text-[11.5px]">
              Alert Type <i className="not-italic text-[#ef4444]">*</i>
            </span>
            <AlertTypeBar custom={custom} type={alert.type} onPick={pick} />
          </div>

          {custom && <DayGrid value={alert.type} onPick={(n) => set({ type: n, custom: true })} />}
        </>
      )}
    </FormCard>
  );
}

// Weekly | 15 Days | Monthly | Custom as one thin segmented bar.
function AlertTypeBar({ custom, type, onPick }) {
  return (
    <div className="grid min-w-0 flex-1 grid-cols-4 gap-0.5 rounded-[10px] border border-modal-off-line bg-white/45 p-0.5">
      {ALERT_PICKS.map((p) => {
        const on = p.value === "custom" ? custom : !custom && type === p.value;
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => onPick(p.value)}
            aria-pressed={on}
            className={cn(
              "h-[26px] min-w-0 cursor-pointer truncate rounded-[7px] border-none px-1 text-[12px] font-bold transition-colors",
              "@min-[900px]/main:@max-[1099px]/main:h-6 modal-compact:h-[22px] modal-tiny:h-5 modal-tiny:text-[11.5px]",
              on ? "bg-brand-sweep text-white shadow-[0_4px_10px_-4px_rgba(20,90,220,0.6)]" : "bg-transparent text-[#64748b] hover:bg-white/60 hover:text-brand-navy"
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// 1-31 in a dashed box. Cells are 30 x 30; on tall screens (>= 880px high, modal-roomy) 48 x 44. As many fit per
// row as the card is wide (the spare width is spread between them), so a narrow card has more rows, never smaller cells.
function DayGrid({ value, onPick }) {
  return (
    <div className="mt-1.5 rounded-xl border border-dashed border-modal-off-line bg-white/30 px-2 pb-2 pt-1.5 modal-snug:mt-[3px] modal-snug:pb-[5px] modal-snug:pt-1 modal-roomy:mt-2 modal-roomy:px-3 modal-roomy:pb-3 modal-roomy:pt-2.5">
      <div className="mb-1 ml-px text-[12px] font-bold leading-[15px] text-[#475569] modal-snug:mb-[3px] modal-roomy:mb-2 modal-roomy:text-[13px]">Remind every … days</div>
      <div className="grid grid-cols-[repeat(auto-fill,30px)] justify-between gap-1 modal-roomy:grid-cols-[repeat(auto-fill,48px)] modal-roomy:gap-1.5">
        {Array.from({ length: 31 }, (_, i) => {
          const n = i + 1;
          const on = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onPick(n)}
              aria-pressed={on}
              className={cn(
                "size-[30px] cursor-pointer rounded-[7px] border text-[12.5px] transition-colors modal-roomy:h-11 modal-roomy:w-12 modal-roomy:rounded-[9px] modal-roomy:text-[14.5px]",
                on
                  ? "border-[#3b82f6] bg-row-stripe font-extrabold text-[#0d4fd6] shadow-[inset_0_0_0_1px_#3b82f6]"
                  : "border-modal-off-line bg-modal-off font-semibold text-[#475569] hover:border-[#93c5fd] hover:bg-white/85"
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Company as its own card. Default: code + name rows (3-column layout, portrait tablets). tiles: a grid of code
// tiles for the half-width card of the 2-column layout (the full name is the tooltip).
function CompanyCard({ items, selected, onChange, tiles, className, bodyClassName }) {
  const [query, setQuery] = useState("");
  const shown = filterItems(items, query);
  return (
    <FormCard
      title={
        <>
          Company <i className="not-italic text-[#ef4444]">*</i>
        </>
      }
      right={
        <CardCount>
          {selected.size}/{items.length} selected
        </CardCount>
      }
      className={cn("flex-1", className)}
      body={false}
    >
      <CheckListTools
        query={query}
        onQuery={setQuery}
        placeholder="Search company"
        onSelectAll={() => onChange(new Set([...selected, ...shown.map((it) => it.value)]))}
        onClear={() => onChange(new Set())}
        className="border-b border-modal-divider px-3.5 py-2.5 modal-compact:px-3 modal-compact:py-2 modal-tiny:py-1.5"
      />
      <div className={cn("min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin] modal-tiny:p-1.5", bodyClassName)}>
        <CheckRows items={shown} selected={selected} onToggle={(v) => onChange(toggleIn(selected, v))} boxed tiles={tiles} className={tiles ? undefined : "gap-1"} />
      </div>
    </FormCard>
  );
}
