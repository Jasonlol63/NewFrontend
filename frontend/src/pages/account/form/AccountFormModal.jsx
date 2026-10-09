import { useEffect, useRef, useState } from "react";
import { Check, Plus, Trash2, UserPen, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toIsoDate } from "@/lib/date";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import FormCard, { CardCount } from "@/components/shared/form-modal/FormCard.jsx";
import { CheckListTools, CheckRows } from "@/components/shared/form-modal/CheckList.jsx";
import { filterItems, toggleIn } from "@/components/shared/form-modal/listSelection";
import DeleteDialog from "@/components/shared/DeleteDialog.jsx";
import DateField from "@/components/shared/form-modal/DateField.jsx";
import {
  Field,
  PasswordInput,
  SelectField,
  TextInput,
  ToggleSwitch,
  primaryButtonClass,
} from "@/components/shared/form-modal/fields.jsx";
import { ALERT_PICKS, PRESET_DAYS, ROLE_OPTIONS, normalizeAlertAmount } from "./accountFormOptions";
import { ADD_URL, UPDATE_URL, alertFromRow, buildAccountPayload, validateAccountForm } from "./accountFormRules";
import { useAccountCurrencies } from "./useAccountCurrencies";

// Layout, from the content area width (@container/main = screen minus sidebar):
//   >= 1210px (1440+ screens): 3 columns, Account Information + Payment Alert | Currency | Company box
//   900-1209px: 2 columns (the left one, holding two cards, is wider), Company is a small box under Currency
//   < 900px (portrait tablets): one column (Account Information, Payment Alert, Currency, Company), scrolling
// Height tiers: modal-compact <= 760, modal-short <= 700, modal-snug <= 640, modal-tiny <= 600 (see index.css).
// Class names are written out in full so Tailwind can see them.

/**
 * Add Account / Edit Account: the same modal, only the title, header icon and defaults change.
 * mode: "add" | "edit"; account: the list row being edited (edit mode).
 * tenantId: the company picked on the Account page. companyOptions: the companies the card offers
 * ([{ value, label, tenantId }], the picked Group's companies, or just the Group itself when its own
 * view is picked).
 * Currencies come from /api/currency/available; Create and Delete in the Currency card write to the
 * database right away (Delete only after its confirmation). Save hands { url, body } to onSave, which
 * posts it and closes the modal; if it throws, the message is shown in the footer.
 */
export default function AccountFormModal({ mode = "add", account, tenantId, companyOptions = [], onClose, onSave }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState(() => ({
    accountId: isEdit ? (account?.accountId ?? "") : "",
    name: isEdit ? (account?.name ?? "") : "",
    role: isEdit ? (account?.role ?? "") : "",
    password: "",
    remark: isEdit ? (account?.remark ?? "") : "",
  }));
  const [alert, setAlert] = useState(() => alertFromRow(isEdit ? account : null));
  const [message, setMessage] = useState(""); // validation problem or the backend's error
  const [saving, setSaving] = useState(false);

  const { currencies, error: currencyError, loading: currenciesLoading, create, remove } = useAccountCurrencies(
    tenantId,
    isEdit ? account?.id : null
  );
  const [pickedCurrencies, setPickedCurrencies] = useState(() => new Set());
  // Tick once the list has arrived: what the account already holds (Edit), else MYR when the company has it.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || currenciesLoading || currencyError) return;
    seeded.current = true;
    const start = isEdit ? currencies.filter((c) => c.linked) : currencies.filter((c) => c.code === "MYR");
    setPickedCurrencies(new Set(start.map((c) => c.id)));
  }, [currenciesLoading, currencyError, currencies, isEdit]);

  const companyItems = companyOptions.map((c) => ({ ...c, tag: c.tenantId === tenantId ? "CURRENT" : undefined }));
  // The account's own companies; an account the list doesn't say anything about starts from the current one.
  const ownTenantIds = isEdit && account?.tenantIds?.length ? account.tenantIds : [tenantId];
  const [companies, setCompanies] = useState(
    () => new Set(companyOptions.filter((c) => ownTenantIds.includes(c.tenantId)).map((c) => c.value))
  );
  // Companies the account is in that the card doesn't list (another Group's): the backend replaces the
  // whole list, so they are sent back untouched instead of being unbound.
  const hiddenTenantIds = isEdit ? ownTenantIds.filter((id) => !companyOptions.some((c) => c.tenantId === id)) : [];

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  // Account IDs are always upper case: converted as they are typed, keeping the cursor where it was.
  const setAccountId = (e) => {
    const input = e.target;
    const { selectionStart, selectionEnd } = input;
    setForm((f) => ({ ...f, accountId: input.value.toUpperCase() }));
    requestAnimationFrame(() => input.setSelectionRange(selectionStart, selectionEnd));
  };

  // Currency Create / Delete take effect immediately; a failure (duplicate code, currency in use...) shows in the footer.
  const createCurrency = async (code) => {
    setMessage("");
    try {
      const id = await create(code);
      if (id != null) setPickedCurrencies((s) => new Set(s).add(id));
    } catch (err) {
      setMessage(err.message);
    }
  };
  const deleteCurrency = async (currency) => {
    setMessage("");
    try {
      await remove(currency.id);
      setPickedCurrencies((s) => {
        const next = new Set(s);
        next.delete(currency.id);
        return next;
      });
    } catch (err) {
      setMessage(err.message);
    }
  };

  const save = async () => {
    if (saving || currenciesLoading) return;
    const tenantIds = [...companyItems.filter((c) => companies.has(c.value)).map((c) => c.tenantId), ...hiddenTenantIds];
    const problem = validateAccountForm({ mode, form, pickedCount: pickedCurrencies.size, tenantIds, scopeTenantId: tenantId });
    if (problem) {
      setMessage(problem);
      return;
    }
    setMessage("");
    setSaving(true);
    const body = buildAccountPayload({
      mode,
      accountId: account?.id,
      scopeTenantId: tenantId,
      form,
      alert,
      currencyIds: [...pickedCurrencies],
      tenantIds,
      keepAlertConfig: isEdit && account?.alertDay != null,
    });
    try {
      await onSave({ url: isEdit ? UPDATE_URL : ADD_URL, body }); // closes the modal on success
    } catch (err) {
      setMessage(err.message);
      setSaving(false);
    }
  };

  const footerNote = message || currencyError || (currenciesLoading ? "Loading…" : "");
  const footerIsError = Boolean(message || currencyError);

  return (
    <FormModal
      icon={isEdit ? UserPen : UserPlus}
      title={isEdit ? "Edit Account" : "Add Account"}
      onClose={onClose}
      onSave={save}
      saveDisabled={currenciesLoading || saving}
      footerStart={
        footerNote && (
          <p
            role={footerIsError ? "alert" : "status"}
            className={cn(
              "m-0 mr-auto min-w-0 text-[12.5px] font-semibold leading-tight @max-[599px]/main:basis-full @max-[599px]/main:text-[12px]",
              footerIsError ? "text-[#dc2626]" : "text-dash-sub"
            )}
          >
            {footerNote}
          </p>
        )
      }
      bodyClassName={cn(
        "grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]",
        "@min-[1210px]/main:grid-cols-3",
        "@max-[899px]/main:flex @max-[899px]/main:flex-col @max-[899px]/main:overflow-y-auto @max-[899px]/main:[scrollbar-width:thin]"
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-col gap-(--gap) @max-[899px]/main:contents">
        <AccountInfoCard form={form} setField={setField} setAccountId={setAccountId} setForm={setForm} isEdit={isEdit} />
        <PaymentAlertCard alert={alert} setAlert={setAlert} />
      </div>
      <div className="flex min-h-0 min-w-0 flex-col gap-(--gap) @max-[899px]/main:contents">
        <CurrencyCard currencies={currencies} picked={pickedCurrencies} setPicked={setPickedCurrencies} onCreate={createCurrency} onDelete={deleteCurrency} />
        <CompanyChipsBox items={companyItems} selected={companies} onChange={setCompanies} />
      </div>
      <div className="hidden min-h-0 min-w-0 flex-col @min-[1210px]/main:flex">
        <CompanyCard items={companyItems} selected={companies} onChange={setCompanies} />
      </div>
    </FormModal>
  );
}

// Cards keep their own scroll on desktop; in the one-column tablet layout the whole body scrolls instead.
const stackCard = "@max-[899px]/main:flex-none @max-[899px]/main:overflow-visible";
const stackBody = "@max-[899px]/main:overflow-visible";

// Never shrinks, so no field hides behind a scroll; Payment Alert under it takes what is left.
function AccountInfoCard({ form, setField, setAccountId, setForm, isEdit }) {
  return (
    <FormCard title="Account Information" className={cn("flex-none @max-[899px]/main:order-1", stackCard)} bodyClassName={stackBody}>
      {/* 3 per row (ID | Name | Role, Password | Remark); 2 per row on 1440+ screens. */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-2.5 modal-compact:gap-x-2.5 modal-compact:gap-y-1.5 modal-tiny:gap-x-2 modal-tiny:gap-y-1 @min-[1210px]/main:grid-cols-2">
        <Field label="Account ID">
          {/* The backend never changes an Account ID once it is created. */}
          <TextInput
            value={form.accountId}
            onChange={setAccountId}
            autoComplete="off"
            autoCapitalize="characters"
            disabled={isEdit}
            className="uppercase disabled:cursor-not-allowed disabled:bg-modal-off disabled:text-dash-faint"
          />
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

function CurrencyCard({ currencies, picked, setPicked, onCreate, onDelete }) {
  const [code, setCode] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [toDelete, setToDelete] = useState(null); // currency awaiting confirmation

  // An existing code is just ticked; a new one is created in the database, then ticked.
  const create = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    const existing = currencies.find((x) => x.code === c);
    if (existing) setPicked((s) => new Set(s).add(existing.id));
    else await onCreate(c);
    setCode("");
  };
  // Delete mode: clicking an unticked currency asks to confirm (same dialog as the list pages); ticked ones are locked.
  // Nothing is deleted before the confirmation.
  const clickTile = (c) => {
    if (!deleting) setPicked((s) => toggleIn(s, c.id));
    else if (!picked.has(c.id) && c.deletable) setToDelete(c);
  };
  const confirmDelete = async () => {
    const currency = toDelete;
    setToDelete(null);
    if (currency) await onDelete(currency);
  };

  return (
    <FormCard
      title="Currency"
      right={<CardCount>{picked.size} selected</CardCount>}
      className={cn("flex-1 @max-[899px]/main:order-3", stackCard)}
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

      <div className="mt-2.5 grid max-w-[700px] grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2 @max-[1209px]/main:grid-cols-[repeat(auto-fill,minmax(72px,1fr))] @max-[1209px]/main:gap-1.5 modal-compact:mt-2 modal-compact:gap-1.5">
        {currencies.map((c) => {
          const on = picked.has(c.id);
          const removable = deleting && !on && c.deletable;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => clickTile(c)}
              disabled={deleting && (on || !c.deletable)}
              aria-pressed={on}
              title={removable ? `Delete ${c.code}` : undefined}
              className={cn(
                "relative flex h-10 cursor-pointer items-center rounded-[11px] border pl-3.5 pr-8 text-[13px] font-extrabold transition-colors modal-compact:h-9 modal-tiny:h-8",
                // Below 1440 the tiles are plain (no tick circle): selected = blue, about 5 per row.
                "@max-[1209px]/main:h-[34px] @max-[1209px]/main:justify-center @max-[1209px]/main:px-1 @max-[1209px]/main:modal-compact:h-8 @max-[1209px]/main:modal-tiny:h-[30px]",
                "disabled:cursor-not-allowed disabled:opacity-45",
                on
                  ? "border-[#7fb2ff] bg-row-stripe text-brand-navy @max-[1209px]/main:shadow-[inset_0_0_0_1px_#7fb2ff]"
                  : removable
                    ? "border-[#fecaca] bg-white text-[#b91c1c]"
                    : "border-modal-off-line bg-white/60 text-[#374151] hover:border-[#93c5fd]"
              )}
            >
              {c.code}
              {removable ? (
                <X className="absolute right-3 top-1/2 size-3 -translate-y-1/2 text-[#ef4444]" strokeWidth={3.2} />
              ) : (
                <span
                  className={cn(
                    "absolute right-[11px] top-1/2 flex size-4 @max-[1209px]/main:hidden -translate-y-1/2 items-center justify-center rounded-full",
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
      {deleting && <p className="m-0 mt-2 text-[11.5px] text-[#b91c1c]">Click × to delete an unticked currency. Ticked currencies, and ones synced from a subsidiary, can&apos;t be deleted.</p>}

      <DeleteDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        names={toDelete ? [toDelete.code] : []}
        noun="currency"
        onConfirm={confirmDelete}
      />
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
      bodyClassName={cn("pb-2.5 modal-compact:pb-2 modal-tiny:pb-1.5 @min-[900px]/main:modal-cozy:flex @min-[900px]/main:modal-cozy:flex-col", stackBody)}
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
          {/* Order: Start Date + Amount, then Alert Type, then (for Custom) the 1-31 grid under it, on every screen size.
              Short laptops in the 2-column layout (<= 700px high): the three share one row, so all 31 days still fit. */}
          <div className="@max-[1209px]/main:modal-short:grid @max-[1209px]/main:modal-short:grid-cols-[146px_144px_minmax(0,1fr)] @max-[1209px]/main:modal-short:items-start @max-[1209px]/main:modal-short:gap-x-3">
            <div className="grid grid-cols-2 gap-x-3.5 @max-[1209px]/main:modal-short:contents">
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

            <div className="mt-2.5 flex items-center gap-2.5 modal-compact:mt-2 modal-snug:mt-[5px] @max-[1209px]/main:modal-short:mt-0! @max-[1209px]/main:modal-short:block @max-[1209px]/main:modal-short:min-w-0">
              <span className="flex-none whitespace-nowrap text-[12.5px] font-semibold text-[#374151] modal-compact:text-[12px] modal-tiny:text-[11.5px] @max-[1209px]/main:modal-short:mb-0.5 @max-[1209px]/main:modal-short:ml-0.5 @max-[1209px]/main:modal-short:block @max-[1209px]/main:modal-tiny:mb-px">
                Alert Type <i className="not-italic text-[#ef4444]">*</i>
              </span>
              <AlertTypeBar custom={custom} type={alert.type} onPick={pick} />
            </div>
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
    <div className="grid min-w-0 flex-1 grid-cols-4 gap-0.5 rounded-[10px] border border-modal-off-line bg-white/45 p-0.5 @max-[1209px]/main:modal-short:h-[30px] @max-[1209px]/main:modal-tiny:h-7">
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
              "@max-[1209px]/main:modal-short:h-6 @max-[1209px]/main:modal-tiny:h-[22px]",
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
    <div className="mt-1.5 flex flex-col @min-[900px]/main:modal-cozy:min-h-0 @min-[900px]/main:modal-cozy:flex-1 rounded-xl border border-dashed border-modal-off-line bg-white/30 px-2 pb-2 pt-1.5 modal-snug:mt-[3px] modal-snug:pb-[5px] modal-snug:pt-1 modal-roomy:mt-2 modal-roomy:px-3 modal-roomy:pb-3 modal-roomy:pt-2.5">
      <div className="mb-1 ml-px text-[12px] font-bold leading-[15px] text-[#475569] modal-snug:mb-[3px] modal-roomy:mb-2 modal-roomy:text-[13px]">Remind every … days</div>
      <div
        className={cn(
          "grid grid-cols-[repeat(auto-fill,30px)] justify-between gap-1 modal-short:gap-[3px] modal-roomy:grid-cols-[repeat(auto-fill,48px)] modal-roomy:gap-1.5",
          // Below 880px high the grid fills the room left in the card: 11 per row (8 on narrow cards), cells stretch.
          "@min-[900px]/main:modal-cozy:my-auto @min-[900px]/main:modal-cozy:max-h-[164px] @min-[900px]/main:modal-cozy:min-h-[98px] @min-[900px]/main:modal-cozy:flex-1 @min-[900px]/main:modal-cozy:grid-cols-[repeat(11,minmax(0,1fr))] @min-[900px]/main:modal-cozy:auto-rows-fr @min-[900px]/main:modal-cozy:gap-1!",
          "@min-[1210px]/main:@max-[1330px]/main:modal-cozy:max-h-[220px] @min-[1210px]/main:@max-[1330px]/main:modal-cozy:min-h-[132px] @min-[1210px]/main:@max-[1330px]/main:modal-cozy:grid-cols-[repeat(8,minmax(0,1fr))]"
        )}
      >
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
                "size-[30px] cursor-pointer @min-[900px]/main:modal-cozy:size-auto rounded-[7px] border text-[12.5px] transition-colors modal-roomy:h-11 modal-roomy:w-12 modal-roomy:rounded-[9px] modal-roomy:text-[14.5px]",
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

// Wide screens only: Company as its own card, the list always visible.
function CompanyCard({ items, selected, onChange }) {
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
      className="flex-1"
      body={false}
    >
      <CheckListTools
        query={query}
        onQuery={setQuery}
        placeholder="Search company"
        onSelectAll={() => onChange(new Set([...selected, ...shown.map((it) => it.value)]))}
        onClear={() => onChange(new Set())}
        className="border-b border-modal-divider px-3.5 py-2.5 modal-compact:px-3 modal-compact:py-2"
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
        <CheckRows items={shown} selected={selected} onToggle={(v) => onChange(toggleIn(selected, v))} boxed className="gap-1" />
      </div>
    </FormCard>
  );
}

// Below 1440: a small Company box under Currency, every company a toggle chip (all visible, wraps; scrolls if there are very many).
function CompanyChipsBox({ items, selected, onChange }) {
  return (
    <section className="flex flex-none items-start gap-2.5 rounded-2xl border border-modal-line bg-modal-card px-3.5 py-2.5 shadow-modal-card @min-[1210px]/main:hidden @max-[899px]/main:order-4 modal-compact:px-3 modal-compact:py-[9px]">
      <span className="flex-none whitespace-nowrap pt-[5px] text-[12.5px] font-semibold text-[#374151] modal-compact:text-[12px]">
        Company <i className="not-italic text-[#ef4444]">*</i>
      </span>
      <div className="flex max-h-[94px] @max-[899px]/main:max-h-none min-w-0 flex-1 flex-wrap gap-[5px] overflow-y-auto [scrollbar-width:thin]">
        {items.map((it) => {
          const on = selected.has(it.value);
          return (
            <button
              key={it.value}
              type="button"
              onClick={() => onChange(toggleIn(selected, it.value))}
              aria-pressed={on}
              title={it.label}
              className={cn(
                "inline-flex h-7 cursor-pointer items-center rounded-lg border px-2.5 text-[12px] font-extrabold transition-colors",
                on
                  ? "border-[#7fb2ff] bg-row-stripe text-brand-navy shadow-[inset_0_0_0_1px_#7fb2ff]"
                  : "border-modal-off-line bg-modal-off text-[#374151] hover:border-[#93c5fd] hover:bg-white/85"
              )}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
