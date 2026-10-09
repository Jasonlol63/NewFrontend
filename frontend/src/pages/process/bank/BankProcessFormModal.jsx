import { useCallback, useMemo, useState } from "react";
import { CalendarDays, FilePen, FilePlus2, Lock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { postJson } from "@/lib/api";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import FormCard from "@/components/shared/form-modal/FormCard.jsx";
import DateField from "@/components/shared/form-modal/DateField.jsx";
import RecordBar from "@/components/shared/form-modal/RecordBar.jsx";
import DeleteDialog from "@/components/shared/DeleteDialog.jsx";
import { AddButton, Field, SelectField, TextInput, ToggleSwitch, inputClass } from "@/components/shared/form-modal/fields.jsx";
import AccountFormModal from "@/pages/account/form/AccountFormModal.jsx";
import { normalizeAccountRow } from "@/pages/account/accountRules";
import BankProfitSharing from "./BankProfitSharing.jsx";
import CountryBankAdder from "./CountryBankAdder.jsx";
import { LOCKED_EDIT_TITLE, formatMoney, isBankLocked } from "./bankProcessRules";
import {
  BANK_BALANCE_DELETE_URL,
  CARD_OWNER_TYPES,
  CONTRACTS,
  FIRST_OF_MONTH,
  FREQUENCIES,
  accountLabel,
  buildBankRequest,
  isBankPickAccount,
  money,
  profitOf,
  usesDayEnd,
  validateBankForm,
} from "./bankFormRules";
import { useAccountRows, useBankCountryOptions, useBankOptions, useHiddenBankOptions } from "./useBankFormData";

// Layout, from the content area width (@container/main = screen minus sidebar), like the Games process modal:
//   >= 900px: 2 columns, Bank Information / Schedule / SOP and Remark on the left | Detail / Profit Sharing on the right
//   < 900px (portrait tablets / phones): one column, the whole body scrolls
// Class names are written out in full so Tailwind can see them.

const pair = "grid grid-cols-2 gap-3 modal-compact:gap-2 @max-[599px]/main:grid-cols-1";
const cardFlex = "flex-none @max-[899px]/main:overflow-visible";
const cardBody = "flex flex-col gap-3 modal-compact:gap-2 @max-[899px]/main:overflow-visible";

// Everything in this modal is shown in upper case: titles, labels, values and placeholders. Buttons keep their normal case
// (Cancel, Add Process, Back...); the selects are upper case through their own `uppercase` prop. Inputs and text areas don't
// inherit text-transform (the browser resets it), so they are named; the select and date popups are outside the modal and
// carry the class themselves.
const UPPERCASE = "uppercase [&_input]:uppercase [&_textarea]:uppercase";

// On big screens the date picker popup is a little narrower than the (wide) field; below that it follows the field as before.
const DATE_POPUP = "uppercase min-[1536px]:max-w-[300px]";

const BLANK = {
  countryId: "",
  bankId: "",
  country: "", // Edit only: the saved country / bank / type / card owner, shown read-only
  bank: "",
  type: "",
  cardOwner: "",
  dayStart: "",
  dayEnd: "",
  frequency: FIRST_OF_MONTH,
  sop: "",
  remark: "",
  supplier: "", // account ids as text (what the selects hold)
  buyPrice: "",
  customer: "",
  sellPrice: "",
  company: "",
  contract: "",
  insurance: "",
  bankBalance: "",
};

// A billing field that can't be changed: same grey as the other read-only boxes.
const LOCKED_INPUT = "disabled:cursor-not-allowed disabled:bg-modal-off disabled:text-dash-faint";

const idText = (id) => (id == null ? "" : String(id));
const amountText = (n) => (n == null ? "" : String(n));

// Edit starts from the list row.
function formOf(process) {
  if (!process) return BLANK;
  return {
    ...BLANK,
    country: process.country,
    bank: process.bank,
    type: process.cardOwnerType,
    cardOwner: process.cardOwner,
    dayStart: process.date,
    dayEnd: process.dayEnd ?? "",
    frequency: process.frequency || FIRST_OF_MONTH,
    sop: process.sop,
    remark: process.remark,
    supplier: idText(process.supplierAccountId),
    buyPrice: amountText(process.cost),
    customer: idText(process.customerAccountId),
    sellPrice: amountText(process.price),
    company: idText(process.companyAccountId),
    contract: process.contract,
    insurance: amountText(process.insurance),
  };
}

const sharingOf = (process) =>
  [...(process?.shares ?? [])]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((s) => ({ account: idText(s.accountId), amount: (Number(s.amount) || 0).toFixed(2) }));

// The options plus the current value, so a value the list does not know (an old contract text) still shows.
const withCurrent = (options, value) => (value && !options.some((o) => o.value === value) ? [{ value, label: value }, ...options] : options);

// A select with the button beside it (`button`, or a function of the row element, replaces the default one): "+" (opens Add Account) while nothing is chosen, the edit pen (opens Edit Account
// for the chosen one) once something is. While something is chosen a small x in the box clears it.
// addOnly: the button stays "+" whatever is chosen (Country, Bank).
function SelectWithAdd({ addLabel, editLabel, onAccount, onClear, addOnly = false, button, ...select }) {
  const chosen = Boolean(select.value) && !addOnly;
  const [row, setRow] = useState(null);
  return (
    <div ref={setRow} className="flex items-center gap-1.5">
      <div className="min-w-0 flex-1">
        <SelectField uppercase onClear={onClear} {...select} />
      </div>
      {(typeof button === "function" ? button(row) : button) ?? <AddButton edit={chosen} label={chosen ? editLabel : addLabel} disabled={select.disabled} onClick={() => onAccount?.(chosen ? "edit" : "add")} />}
    </div>
  );
}

// Edit: fields that cannot change any more.
function ReadOnlyBox({ children }) {
  return <div className={cn(inputClass, "flex items-center bg-modal-off font-bold text-[#374151]")}><span className="truncate">{children}</span></div>;
}

/**
 * Add / Edit Process for a Bank company: same modal shell as the Games one, with the Bank Information / Schedule / SOP and Remark /
 * Detail / Profit Sharing cards. mode: "add" | "edit"; process: the list row being edited (edit mode: the bank fields are read-only
 * and the footer shows the Record).
 * tenantId: the company; accountCompanyOptions: the company options Add Account offers ([{ value, label, tenantId }]).
 * Country / Bank, the accounts and the profit sharing come from the API. Save hands { url, body } to onSave, which posts it
 * and closes the modal; if it throws the message shows in the footer. onBalanceDeleted: the list should reload after the
 * Bank Balance was deleted here.
 */
export default function BankProcessFormModal({ mode = "add", process, tenantId, accountCompanyOptions = [], onClose, onSave, onBalanceDeleted }) {
  const isEdit = mode === "edit";
  // Official, E-Invoice and Block: only SOP, Remark and Insurance can change; the billing fields below are read-only.
  const billingLocked = isEdit && isBankLocked(process);
  const [form, setForm] = useState(() => formOf(isEdit ? process : null));
  const [sharing, setSharing] = useState(() => sharingOf(isEdit ? process : null));
  const [message, setMessage] = useState(""); // validation problem or the backend's error
  const [saving, setSaving] = useState(false);
  // Edit, frequency 1st of Every Month: the Day End switch. On = Day End is locked (the last month bills up to it), Off (the default) = editable.
  const [dayEndLocked, setDayEndLocked] = useState(() => Boolean(isEdit && process?.dayEndMonthlyCapEnabled));
  // Bank Balance already settled by a Contra: the field is read-only until that Contra is deleted.
  const [balanceLocked, setBalanceLocked] = useState(() => Boolean(isEdit && process?.bankBalanceTransactionId != null));
  const [deleteBalanceOpen, setDeleteBalanceOpen] = useState(false);

  // Countries and banks only matter in Add (Edit shows the saved ones read-only).
  const countryData = useBankCountryOptions(isEdit ? null : tenantId);
  const bankData = useBankOptions(isEdit ? null : tenantId, form.countryId);
  const accountData = useAccountRows(tenantId);
  const hidden = useHiddenBankOptions(tenantId);

  const countries = countryData.countries;
  const countryCode = countries.find((c) => String(c.id) === form.countryId)?.code ?? "";
  const countryKey = (code) => "C:" + code;
  const bankKey = (name) => "B:" + countryCode + "/" + name;

  const countryOptions = useMemo(
    () => countries.filter((c) => !hidden.isHidden(countryKey(c.code))).map((c) => ({ value: String(c.id), label: c.code })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hidden.isHidden reads the saved list
    [countries, hidden]
  );
  const bankOptions = useMemo(
    () => bankData.banks.filter((b) => !hidden.isHidden(bankKey(b.name))).map((b) => ({ value: String(b.id), label: b.name })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hidden.isHidden reads the saved list
    [bankData.banks, hidden, countryCode]
  );

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const setText = (key) => (e) => set(key)(e.target.value);
  const setMoney = (key) => (e) => set(key)(money(e.target.value));
  const pickCountry = (countryId) => setForm((f) => ({ ...f, countryId, bankId: "" }));
  // Day End only exists for the frequencies that run to one; the others drop whatever was in it.
  const setFrequency = (frequency) => setForm((f) => ({ ...f, frequency, dayEnd: usesDayEnd(frequency) ? f.dayEnd : "" }));

  // The "+" popovers: Add / Remove write at once (adding a country also creates a currency of that code); Show / hide is only
  // kept in this browser. A failure is thrown to the popover, which shows it.
  const addCountry = async (code) => {
    const created = await countryData.add(code);
    if (created.id != null) pickCountry(String(created.id));
  };
  const removeCountry = async (code) => {
    const country = countries.find((c) => c.code === code);
    if (!country) return;
    await countryData.remove(country.id);
    hidden.forget(countryKey(code));
    if (form.countryId === String(country.id)) pickCountry("");
  };
  const toggleCountry = (code) => {
    const country = countries.find((c) => c.code === code);
    hidden.toggle(countryKey(code));
    if (country && !hidden.isHidden(countryKey(code)) && form.countryId === String(country.id)) pickCountry("");
  };
  const addBank = async (name) => {
    const created = await bankData.add(name);
    if (created.id != null) set("bankId")(String(created.id));
  };
  const removeBank = async (name) => {
    const bank = bankData.banks.find((b) => b.name === name);
    if (!bank) return;
    await bankData.remove(bank.id);
    hidden.forget(bankKey(name));
    if (form.bankId === String(bank.id)) set("bankId")("");
  };
  const toggleBank = (name) => {
    const bank = bankData.banks.find((b) => b.name === name);
    hidden.toggle(bankKey(name));
    if (bank && !hidden.isHidden(bankKey(name)) && form.bankId === String(bank.id)) set("bankId")("");
  };

  // Accounts for every select: the active ones with a role this page offers (isBankPickAccount), plus the ones this process
  // already uses and any account made or edited here, so they never vanish from the list they were picked in.
  const [pinned, setPinned] = useState(() => new Set());
  const accountOptions = useMemo(() => {
    const keep = new Set([
      ...pinned,
      ...(isEdit
        ? [process?.supplierAccountId, process?.customerAccountId, process?.companyAccountId, ...(process?.shares ?? []).map((s) => s.accountId)]
            .filter((id) => id != null)
            .map(String)
        : []),
    ]);
    const options = accountData.rows
      .filter((r) => isBankPickAccount(r) || keep.has(String(r.id)))
      .map((r) => ({ value: String(r.id), label: accountLabel(r.accountId, r.name) }));
    const used = isEdit
      ? [
          [process?.supplierAccountId, process?.supplier, process?.supplierName],
          [process?.customerAccountId, process?.customer, process?.customerName],
          [process?.companyAccountId, process?.company, process?.companyName],
        ]
      : [];
    used.forEach(([id, code, name]) => {
      if (id != null && code && !options.some((o) => o.value === String(id))) options.push({ value: String(id), label: accountLabel(code, name) });
    });
    return options;
  }, [accountData.rows, isEdit, process, pinned]);

  // Add / Edit Account opened from a "+" / edit button: { mode, account, role, apply(id) }. A new account is picked straight away.
  const [accountForm, setAccountForm] = useState(null);
  const closeAccountForm = useCallback(() => setAccountForm(null), []);
  const openAccount = useCallback(
    ({ mode: accountMode, value, role = "", apply }) => {
      const account = accountMode === "edit" ? accountData.rows.find((r) => String(r.id) === value) : undefined;
      if (accountMode === "edit" && !account) return; // an account the list doesn't hold can't be edited here
      setAccountForm({ mode: accountMode, account, role, apply });
    },
    [accountData.rows]
  );
  const submitAccount = async ({ url, body }) => {
    const response = await postJson(url, body);
    const row = normalizeAccountRow({ ...body, ...response.data });
    accountData.put(row);
    setPinned((ids) => new Set(ids).add(String(row.id)));
    accountForm?.apply?.(String(row.id));
    setAccountForm(null);
  };

  const deleteBalance = async () => {
    setDeleteBalanceOpen(false);
    setMessage("");
    try {
      await postJson(BANK_BALANCE_DELETE_URL, { id: process.id, tenantId });
      setBalanceLocked(false);
      set("bankBalance")("");
      onBalanceDeleted?.();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const showDayEndSwitch = isEdit && !billingLocked && form.frequency === FIRST_OF_MONTH;
  const dayEndOff = !usesDayEnd(form.frequency); // this frequency has no Day End
  const dayEndIsLocked = showDayEndSwitch && dayEndLocked;
  const profit = profitOf(form);

  const save = async () => {
    if (saving) return;
    const problem = validateBankForm({ isEdit, form, sharing, billingLocked });
    if (problem) {
      setMessage(problem);
      return;
    }
    setMessage("");
    setSaving(true);
    try {
      await onSave(buildBankRequest({ isEdit, id: process?.id, tenantId, form, sharing, dayEndLocked, balanceLocked, billingLocked }));
    } catch (err) {
      setMessage(err.message);
      setSaving(false);
    }
  };

  const footerNote = message || countryData.error || bankData.error || accountData.error;

  return (
    <FormModal
      icon={isEdit ? FilePen : FilePlus2}
      title={isEdit ? "Edit Process" : "Add Process"}
      saveLabel={isEdit ? "Update Process" : "Add Process"}
      onClose={onClose}
      onSave={save}
      saveDisabled={saving}
      className={UPPERCASE}
      // The lock notice lives in the header (a chip with the full sentence as its tooltip) so it takes no room from the cards.
      headerExtra={
        billingLocked && (
          <span
            role="note"
            title={LOCKED_EDIT_TITLE}
            aria-label={LOCKED_EDIT_TITLE}
            className="inline-flex h-9 min-w-0 items-center gap-1.5 rounded-[10px] border border-[#fde68a] bg-[#fffbeb] px-3 text-[12px] font-bold text-[#92400e] modal-compact:h-8 modal-tiny:h-[30px] @max-[599px]/main:px-2"
          >
            <Lock className="size-3.5 flex-none" strokeWidth={2.4} />
            <span className="truncate @max-[1099px]/main:hidden">Billing locked · only SOP, Remark and Insurance can be changed</span>
            <span className="hidden truncate @max-[1099px]/main:inline @max-[599px]/main:hidden">Billing locked</span>
          </span>
        )
      }
      footerStart={
        <>
          {footerNote && (
            <p role="alert" className="m-0 basis-full text-[12.5px] font-semibold leading-tight text-[#dc2626] @max-[599px]/main:text-[12px]">
              {footerNote}
            </p>
          )}
          {isEdit && <RecordBar modified={{ at: process?.updatedAt, by: process?.updatedBy }} created={{ at: process?.createdAt, by: process?.createdBy }} />}
        </>
      }
      bodyClassName={cn(
        "grid grid-cols-2 grid-rows-1",
        "@max-[899px]/main:flex @max-[899px]/main:flex-col @max-[899px]/main:overflow-y-auto @max-[899px]/main:[scrollbar-width:thin]"
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-col gap-(--gap) @max-[899px]/main:contents">
        <FormCard title="Bank Information" className={cardFlex} bodyClassName={cardBody}>
          <div className={pair}>
            <Field label="Country (Currency)" as="div">
              {isEdit ? <ReadOnlyBox>{form.country}</ReadOnlyBox> : <SelectWithAdd
                  addOnly
                  value={form.countryId}
                  onChange={pickCountry}
                  options={countryOptions}
                  placeholder="Select Country"
                  button={(anchorEl) => (
                    <CountryBankAdder
                      anchorEl={anchorEl}
                      noun="country"
                      title="Add country"
                      hint="Also creates a currency of that name"
                      items={countries.map((c) => c.code)}
                      onAdd={addCountry}
                      onRemove={removeCountry}
                      isOn={(code) => !hidden.isHidden(countryKey(code))}
                      onToggle={toggleCountry}
                    />
                  )}
                />}
            </Field>
            <Field label="Bank" as="div">
              {isEdit ? <ReadOnlyBox>{form.bank}</ReadOnlyBox> : <SelectWithAdd
                  addOnly
                  value={form.bankId}
                  onChange={set("bankId")}
                  options={bankOptions}
                  placeholder="Select Bank"
                  disabled={!form.countryId}
                  button={(anchorEl) => (
                    <CountryBankAdder
                      anchorEl={anchorEl}
                      key={form.countryId}
                      noun="bank"
                      title="Add bank"
                      hint={"Added under " + countryCode}
                      items={bankData.banks.map((b) => b.name)}
                      onAdd={addBank}
                      onRemove={removeBank}
                      isOn={(name) => !hidden.isHidden(bankKey(name))}
                      onToggle={toggleBank}
                      disabledReason={form.countryId ? "" : "Pick a country first"}
                    />
                  )}
                />}
            </Field>
          </div>
          <div className={pair}>
            <Field label="Type" as="div">
              {isEdit ? <ReadOnlyBox>{form.type}</ReadOnlyBox> : <SelectField uppercase value={form.type} onChange={set("type")} options={CARD_OWNER_TYPES} placeholder="Select Type" />}
            </Field>
            <Field label="Card Owner" as="div">
              {isEdit ? <ReadOnlyBox>{form.cardOwner}</ReadOnlyBox> : <TextInput value={form.cardOwner} onChange={setText("cardOwner")} autoComplete="off" placeholder="ENTER CARD OWNER" className="uppercase" />}
            </Field>
          </div>
        </FormCard>

        <FormCard title="Schedule" className={cardFlex} bodyClassName={cardBody}>
          <div className={pair}>
            <Field label="Day Start" as="div">
              <DateField value={form.dayStart} onChange={set("dayStart")} placeholder="DD/MM/YYYY" popupClassName={DATE_POPUP} disabled={billingLocked} />
            </Field>
            <div className="block min-w-0">
              <div className="mb-1 ml-0.5 flex min-h-[19px] items-center justify-between gap-2 modal-compact:mb-0.5 modal-tiny:mb-px">
                <span className="truncate text-[12.5px] font-semibold text-[#374151] modal-compact:text-[12px] modal-tiny:text-[11.5px]">
                  Day End <span className="text-[10px] font-medium text-[#8a96a8]">(opt.)</span>
                </span>
                {showDayEndSwitch && (
                  <ToggleSwitch on={dayEndLocked} onToggle={() => setDayEndLocked((v) => !v)} label={dayEndLocked ? "ON" : "OFF"} className="font-bold" />
                )}
              </div>
              {billingLocked || dayEndOff || dayEndIsLocked ? (
                <div
                  title={billingLocked ? LOCKED_EDIT_TITLE : dayEndOff ? "This frequency has no Day End" : "Locked while the switch is on"}
                  className={cn(inputClass, "flex cursor-not-allowed items-center gap-2 bg-modal-off text-[#6b7280] tabular-nums")}
                >
                  <span className="min-w-0 flex-1 truncate">{dayEndOff ? "Not used" : form.dayEnd || "DD/MM/YYYY"}</span>
                  <CalendarDays className="size-[15px] flex-none text-dash-faint" strokeWidth={2} />
                </div>
              ) : (
                <DateField value={form.dayEnd} onChange={set("dayEnd")} placeholder="DD/MM/YYYY" popupClassName={DATE_POPUP} />
              )}
            </div>
          </div>
          <Field label="Frequency">
            <SelectField uppercase value={form.frequency} onChange={setFrequency} options={FREQUENCIES} placeholder="Select Frequency" disabled={billingLocked} />
          </Field>
        </FormCard>

        <FormCard title="SOP and Remark" className="flex-1 @max-[899px]/main:flex-none @max-[899px]/main:overflow-visible" bodyClassName="flex flex-col @max-[899px]/main:overflow-visible">
          <div className={cn(pair, "min-h-0 flex-1")}>
            <Field label="SOP" optional className="flex min-h-[64px] flex-col">
              <textarea value={form.sop} onChange={setText("sop")} placeholder="ENTER SOP..." className={cn(inputClass, "min-h-[40px] flex-1 resize-none py-2 uppercase leading-snug modal-compact:h-auto modal-tiny:h-auto @min-[900px]/main:@max-[1099px]/main:h-auto")} />
            </Field>
            <Field label="Remark" optional className="flex min-h-[64px] flex-col">
              <textarea value={form.remark} onChange={setText("remark")} placeholder="ENTER REMARKS..." className={cn(inputClass, "min-h-[40px] flex-1 resize-none py-2 uppercase leading-snug modal-compact:h-auto modal-tiny:h-auto @min-[900px]/main:@max-[1099px]/main:h-auto")} />
            </Field>
          </div>
        </FormCard>
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-(--gap) @max-[899px]/main:contents">
        <FormCard title="Detail" className={cardFlex} bodyClassName={cardBody}>
          <div className={pair}>
            <Field label="Supplier" as="div">
              <SelectWithAdd
                addLabel="Add supplier account"
                editLabel="Edit supplier account"
                value={form.supplier}
                disabled={billingLocked}
                onChange={set("supplier")}
                onClear={() => set("supplier")("")}
                onAccount={(accountMode) => openAccount({ mode: accountMode, value: form.supplier, role: "SUPPLIER", apply: set("supplier") })}
                options={accountOptions}
                placeholder="Select Account"
              />
            </Field>
            <Field label="Buy Price">
              <TextInput value={form.buyPrice} onChange={setMoney("buyPrice")} inputMode="decimal" autoComplete="off" placeholder="0.00" disabled={billingLocked} className={LOCKED_INPUT} />
            </Field>
          </div>
          <div className={pair}>
            <Field label="Customer" as="div">
              <SelectWithAdd
                addLabel="Add customer account"
                editLabel="Edit customer account"
                value={form.customer}
                disabled={billingLocked}
                onChange={set("customer")}
                onClear={() => set("customer")("")}
                onAccount={(accountMode) => openAccount({ mode: accountMode, value: form.customer, role: "", apply: set("customer") })}
                options={accountOptions}
                placeholder="Select Account"
              />
            </Field>
            <Field label="Sell Price">
              <TextInput value={form.sellPrice} onChange={setMoney("sellPrice")} inputMode="decimal" autoComplete="off" placeholder="0.00" disabled={billingLocked} className={LOCKED_INPUT} />
            </Field>
          </div>
          <div className={pair}>
            <Field label="Company" as="div" optional>
              <SelectWithAdd
                addLabel="Add company account"
                editLabel="Edit company account"
                value={form.company}
                disabled={billingLocked}
                onChange={set("company")}
                onClear={() => set("company")("")}
                onAccount={(accountMode) => openAccount({ mode: accountMode, value: form.company, role: "", apply: set("company") })}
                options={accountOptions}
                placeholder="Select Account"
              />
            </Field>
            <Field label="Profit" plain as="div">
              <div className={cn(inputClass, "flex items-center bg-modal-off tabular-nums", profit ? "font-semibold text-[#374151]" : "text-dash-faint")}>{profit.toFixed(2)}</div>
            </Field>
          </div>
          <div className={pair}>
            <Field label="Contract" as="div">
              <SelectField uppercase value={form.contract} onChange={set("contract")} options={withCurrent(CONTRACTS, form.contract)} placeholder="Contract" disabled={billingLocked} />
            </Field>
            <div className={pair}>
              <Field label="Insurance" optional>
                <TextInput value={form.insurance} onChange={setMoney("insurance")} inputMode="decimal" autoComplete="off" placeholder="Enter amount" />
              </Field>
              {balanceLocked ? (
                <Field label="Bank Balance" as="div" plain>
                  <div className={cn(inputClass, "flex items-center gap-1.5 bg-modal-off pr-1 text-[#6b7280]")}>
                    <Lock className="size-3.5 flex-none" strokeWidth={2.2} />
                    <span className="min-w-0 flex-1 truncate font-semibold tabular-nums text-[#374151]">{formatMoney(process?.bankBalance)}</span>
                    {!billingLocked && (
                      <button
                        type="button"
                        onClick={() => setDeleteBalanceOpen(true)}
                        aria-label="Delete Bank Balance"
                        title="Delete Bank Balance"
                        className="flex size-6 flex-none cursor-pointer items-center justify-center rounded-md border border-[#fca5a5] bg-[#fef2f2] text-[#dc2626] hover:bg-[#fee2e2]"
                      >
                        <Trash2 className="size-3.5" strokeWidth={2.2} />
                      </button>
                    )}
                  </div>
                  <span className="mt-1 ml-0.5 block text-[11px] italic leading-snug text-[#8a96a8]">
                    {billingLocked ? "Change the status first to delete it." : "Settled by a Contra. Delete it to enter a new amount."}
                  </span>
                </Field>
              ) : (
                <Field label="Bank Balance" optional>
                  <TextInput value={form.bankBalance} onChange={setMoney("bankBalance")} inputMode="decimal" autoComplete="off" placeholder="0.00" disabled={billingLocked} className={LOCKED_INPUT} />
                </Field>
              )}
            </div>
          </div>
        </FormCard>

        <BankProfitSharing entries={sharing} onChange={setSharing} accounts={accountOptions} profit={profit} currency={form.country || countryCode || "MYR"} onAccount={(request) => openAccount({ ...request, role: "" })} inert={billingLocked} />
      </div>

      {/* Add / Edit Account open right on top (same modal as the Account page); a new account is picked in the select it was opened from. */}
      {accountForm && (
        <AccountFormModal
          mode={accountForm.mode}
          account={accountForm.account}
          defaultRole={accountForm.role}
          tenantId={tenantId}
          companyOptions={accountCompanyOptions}
          onClose={closeAccountForm}
          onSave={submitAccount}
        />
      )}
      <DeleteDialog
        open={deleteBalanceOpen}
        onOpenChange={setDeleteBalanceOpen}
        names={[formatMoney(process?.bankBalance)]}
        noun="bank balance"
        note="This also removes its Contra between the Supplier and the Customer."
        onConfirm={deleteBalance}
      />
    </FormModal>
  );
}
