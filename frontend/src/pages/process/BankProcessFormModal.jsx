import { useCallback, useMemo, useState } from "react";
import { FilePen, FilePlus2 } from "lucide-react";
import { cn } from "@/lib/utils";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import FormCard from "@/components/shared/form-modal/FormCard.jsx";
import DateField from "@/components/shared/form-modal/DateField.jsx";
import RecordBar from "@/components/shared/form-modal/RecordBar.jsx";
import { AddButton, Field, SelectField, TextInput, inputClass } from "@/components/shared/form-modal/fields.jsx";
import AccountFormModal from "@/pages/account/AccountFormModal.jsx";
import BankProfitSharing from "./BankProfitSharing.jsx";
import { contractEndDate } from "./bankProcessRules";
import {
  BANK_MODAL_ACCOUNTS,
  BANK_MODAL_BANKS,
  BANK_MODAL_CONTRACTS,
  BANK_MODAL_COUNTRIES,
  BANK_MODAL_FREQUENCIES,
  BANK_MODAL_TYPES,
} from "./processFormOptions";

// Layout, from the content area width (@container/main = screen minus sidebar), like the Games process modal:
//   >= 900px: 2 columns, Bank Information / Schedule / SOP and Remark on the left | Detail / Profit Sharing on the right
//   < 900px (portrait tablets / phones): one column, the whole body scrolls
// Class names are written out in full so Tailwind can see them.

const pair = "grid grid-cols-2 gap-3 modal-compact:gap-2 @max-[599px]/main:grid-cols-1";
const cardFlex = "flex-none @max-[899px]/main:overflow-visible";
const cardBody = "flex flex-col gap-3 modal-compact:gap-2 @max-[899px]/main:overflow-visible";

const money = (v) => v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

const BLANK = {
  country: "",
  bank: "",
  type: "",
  cardOwner: "",
  dayStart: "",
  dayEnd: "",
  frequency: BANK_MODAL_FREQUENCIES[0].value,
  sop: "",
  remark: "",
  supplier: "",
  buyPrice: "",
  customer: "",
  sellPrice: "",
  company: "",
  contract: "",
  insurance: "",
  bankBalance: "",
};

// Edit starts from the list row (sample values for what the row does not carry yet).
function formOf(process) {
  if (!process) return BLANK;
  return {
    ...BLANK,
    country: process.country,
    bank: process.bank,
    type: "BUSINESS",
    cardOwner: process.cardOwner,
    dayStart: process.date,
    dayEnd: contractEndDate(process),
    frequency: "Monthly",
    supplier: process.supplier,
    buyPrice: String(process.cost),
    customer: process.customer,
    sellPrice: String(process.price),
    company: "BANK [BANK]",
    contract: process.contract,
    insurance: String(process.insurance),
  };
}

// The options plus the current value, so a value the list does not know (an old account) still shows.
const withCurrent = (options, value) => (value && !options.some((o) => o.value === value) ? [{ value, label: value }, ...options] : options);

// The accounts are shown as "BA019 [MUAR DASON]" or just "BS005"; Edit Account wants them apart again.
const accountLabel = (f) => (f.name ? f.accountId.toUpperCase() + " [" + f.name + "]" : f.accountId.toUpperCase());
function accountOf(value, role) {
  const m = /^(.*?)\s*\[(.*)\]$/.exec(value);
  return { accountId: m ? m[1] : value, name: m ? m[2] : "", role, remark: "", paymentAlert: false };
}

// A select with the button beside it: "+" (opens Add Account) while nothing is chosen, the edit pen (opens Edit Account
// for the chosen one) once something is. While something is chosen a small x in the box clears it.
function SelectWithAdd({ addLabel, editLabel, onAccount, onClear, ...select }) {
  const chosen = Boolean(select.value);
  return (
    <div className="flex items-center gap-1.5">
      <div className="min-w-0 flex-1">
        <SelectField onClear={onClear} {...select} />
      </div>
      <AddButton edit={chosen} label={chosen ? editLabel : addLabel} disabled={select.disabled} onClick={() => onAccount?.(chosen ? "edit" : "add")} />
    </div>
  );
}

function DisabledBox({ placeholder }) {
  return <div className={cn(inputClass, "flex cursor-not-allowed items-center bg-modal-off text-dash-faint")}>{placeholder}</div>;
}

// Edit: fields that cannot change any more.
function ReadOnlyBox({ children }) {
  return <div className={cn(inputClass, "flex items-center bg-modal-off font-bold text-[#374151]")}><span className="truncate">{children}</span></div>;
}

/**
 * Add / Edit Process for a Bank company: same modal shell as the Games one, with the Bank Information / Schedule / SOP and Remark /
 * Detail / Profit Sharing cards. mode: "add" | "edit"; process: the list row being edited (edit mode: the bank fields are read-only
 * and the footer shows the Record). Options are samples and Save just hands the draft back through onSave (UI only for now).
 */
export default function BankProcessFormModal({ mode = "add", process, onClose, onSave }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState(() => formOf(isEdit ? process : null));
  const [sharing, setSharing] = useState([]);
  // Add / Edit Account opened from a "+" / edit button: { mode, account, role, apply(label) }. Accounts made or renamed there join the lists.
  const [accountForm, setAccountForm] = useState(null);
  const [extraAccounts, setExtraAccounts] = useState([]);
  const closeAccountForm = useCallback(() => setAccountForm(null), []);
  const openAccount = useCallback(({ mode: accountMode, value, role = "", apply }) => {
    setAccountForm({ mode: accountMode, account: accountMode === "edit" ? accountOf(value, role) : undefined, role, apply });
  }, []);
  const saveAccount = (saved) => {
    const label = accountLabel(saved);
    if (label) {
      setExtraAccounts((list) => (list.includes(label) ? list : [...list, label]));
      accountForm?.apply?.(label);
    }
    setAccountForm(null);
  };
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const setText = (key) => (e) => set(key)(e.target.value);
  const setMoney = (key) => (e) => set(key)(money(e.target.value));

  const accounts = useMemo(() => [...extraAccounts, form.supplier, form.customer, form.company].reduce((list, v) => withCurrent(list, v), BANK_MODAL_ACCOUNTS), [extraAccounts, form.supplier, form.customer, form.company]);
  const profit = (parseFloat(form.sellPrice) || 0) - (parseFloat(form.buyPrice) || 0);
  const save = () => onSave?.({ ...form, profit, sharing });

  return (
    <FormModal
      icon={isEdit ? FilePen : FilePlus2}
      title={isEdit ? "Edit Process" : "Add Process"}
      saveLabel={isEdit ? "Update Process" : "Add Process"}
      onClose={onClose}
      onSave={save}
      footerStart={isEdit ? <RecordBar modified={{ at: process?.updatedAt, by: process?.updatedBy }} created={{ at: process?.createdAt, by: process?.createdBy }} /> : undefined}
      bodyClassName={cn(
        "grid grid-cols-2 grid-rows-1",
        "@max-[899px]/main:flex @max-[899px]/main:flex-col @max-[899px]/main:overflow-y-auto @max-[899px]/main:[scrollbar-width:thin]"
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-col gap-(--gap) @max-[899px]/main:contents">
        <FormCard title="Bank Information" className={cardFlex} bodyClassName={cardBody}>
          <div className={pair}>
            <Field label="Country (Currency)" as="div">
              {isEdit ? <ReadOnlyBox>{form.country}</ReadOnlyBox> : <SelectWithAdd addLabel="Add country" editLabel="Edit country" value={form.country} onChange={set("country")} options={BANK_MODAL_COUNTRIES} placeholder="Select Country" />}
            </Field>
            <Field label="Bank" as="div">
              {isEdit ? <ReadOnlyBox>{form.bank}</ReadOnlyBox> : <SelectWithAdd addLabel="Add bank" editLabel="Edit bank" value={form.bank} onChange={set("bank")} options={BANK_MODAL_BANKS} placeholder="Select Bank" disabled={!form.country} />}
            </Field>
          </div>
          <div className={pair}>
            <Field label="Type" as="div">
              {isEdit ? <ReadOnlyBox>{form.type}</ReadOnlyBox> : <SelectField value={form.type} onChange={set("type")} options={BANK_MODAL_TYPES} placeholder="Select Type" />}
            </Field>
            <Field label="Card Owner" as="div">
              {isEdit ? <ReadOnlyBox>{form.cardOwner}</ReadOnlyBox> : <TextInput value={form.cardOwner} onChange={setText("cardOwner")} autoComplete="off" placeholder="ENTER CARD OWNER" className="uppercase" />}
            </Field>
          </div>
        </FormCard>

        <FormCard title="Schedule" className={cardFlex} bodyClassName={cardBody}>
          <div className={pair}>
            <Field label="Day Start" as="div">
              {form.type ? <DateField value={form.dayStart} onChange={set("dayStart")} placeholder="DD/MM/YYYY" /> : <DisabledBox placeholder="DD/MM/YYYY" />}
            </Field>
            <Field label="Day End" optional as="div">
              {form.dayStart ? <DateField value={form.dayEnd} onChange={set("dayEnd")} placeholder="DD/MM/YYYY" /> : <DisabledBox placeholder="DD/MM/YYYY" />}
            </Field>
          </div>
          <Field label="Frequency">
            <SelectField value={form.frequency} onChange={set("frequency")} options={withCurrent(BANK_MODAL_FREQUENCIES, form.frequency)} placeholder="Select Frequency" />
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
                onChange={set("supplier")}
                onClear={() => set("supplier")("")}
                onAccount={(accountMode) => openAccount({ mode: accountMode, value: form.supplier, role: "SUPPLIER", apply: set("supplier") })}
                options={accounts}
                placeholder="Select Account"
              />
            </Field>
            <Field label="Buy Price">
              <TextInput value={form.buyPrice} onChange={setMoney("buyPrice")} inputMode="decimal" autoComplete="off" placeholder="0.00" />
            </Field>
          </div>
          <div className={pair}>
            <Field label="Customer" as="div">
              <SelectWithAdd
                addLabel="Add customer account"
                editLabel="Edit customer account"
                value={form.customer}
                onChange={set("customer")}
                onClear={() => set("customer")("")}
                onAccount={(accountMode) => openAccount({ mode: accountMode, value: form.customer, role: "", apply: set("customer") })}
                options={accounts}
                placeholder="Select Account"
              />
            </Field>
            <Field label="Sell Price">
              <TextInput value={form.sellPrice} onChange={setMoney("sellPrice")} inputMode="decimal" autoComplete="off" placeholder="0.00" />
            </Field>
          </div>
          <div className={pair}>
            <Field label="Company" as="div">
              <SelectWithAdd
                addLabel="Add company account"
                editLabel="Edit company account"
                value={form.company}
                onChange={set("company")}
                onClear={() => set("company")("")}
                onAccount={(accountMode) => openAccount({ mode: accountMode, value: form.company, role: "COMPANY", apply: set("company") })}
                options={accounts}
                placeholder="Select Account"
              />
            </Field>
            <Field label="Profit" plain as="div">
              <div className={cn(inputClass, "flex items-center bg-modal-off tabular-nums", profit ? "font-semibold text-[#374151]" : "text-dash-faint")}>{profit.toFixed(2)}</div>
            </Field>
          </div>
          <div className={pair}>
            <Field label="Contract" as="div">
              <SelectField value={form.contract} onChange={set("contract")} options={withCurrent(BANK_MODAL_CONTRACTS, form.contract)} placeholder="Contract" />
            </Field>
            <div className={pair}>
              <Field label="Insurance" optional>
                <TextInput value={form.insurance} onChange={setMoney("insurance")} inputMode="decimal" autoComplete="off" placeholder="Enter amount" />
              </Field>
              <Field label="Bank Balance" optional>
                <TextInput value={form.bankBalance} onChange={setMoney("bankBalance")} inputMode="decimal" autoComplete="off" placeholder="0.00" />
              </Field>
            </div>
          </div>
        </FormCard>

        <BankProfitSharing entries={sharing} onChange={setSharing} accounts={accounts} profit={profit} currency={form.country || "MYR"} onAccount={(request) => openAccount({ ...request, role: "" })} />
      </div>
      {/* Add / Edit Account open right on top (same modal as the Account page); UI only for now: Save hands the new name back and closes. */}
      {accountForm && <AccountFormModal mode={accountForm.mode} account={accountForm.account} defaultRole={accountForm.role} onClose={closeAccountForm} onSave={saveAccount} />}
    </FormModal>
  );
}
