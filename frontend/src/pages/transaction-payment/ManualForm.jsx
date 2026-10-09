import { useState } from "react";
import { Repeat2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SelectBox } from "@/components/shared/list/DataTable.jsx";
import { PrimaryButton } from "@/components/shared/list/ListToolbar.jsx";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { INPUT, LABEL, Select } from "./fields.jsx";
import { ALL_CUR, TYPE_OPTIONS, layoutOf, positive, todayDisplay } from "./transactionPaymentRules";

const ACCOUNT_FIELDS = ["to", "from", "rTo1", "rFrom1", "rTo2", "rFrom2", "rMid", "aAcc"];
const INITIAL = {
  to: null, from: null, cur: null, amount: "", remark: "",
  rTo1: null, rFrom1: null, rCur1: null, rAmt1: "", rRate: "", rCur2: null, rAmt2: "", rTo2: null, rFrom2: null, rMid: null, rMul: "", rFee: "", rPT: "", rMAmt: "",
  aAcc: null, aCur: null, aAmt: "", aRemark: "",
};

// Account | Account | Reverse: the Reverse column is as wide as its button (icon only below 1500px).
const ACCOUNT_ROW = "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_var(--revw)] items-center gap-2";
// Currency row of the Rate layout: always one row, the currency dropdowns stay small.
const CURRENCY_ROW =
  "grid grid-cols-[76px_repeat(2,minmax(0,1fr))_76px_minmax(0,1fr)] gap-2 @max-[560px]:grid-cols-[66px_repeat(2,minmax(0,1fr))_66px_minmax(0,1fr)] @max-[560px]:gap-1.5 @max-[560px]:[&>input]:px-[7px] @max-[560px]:[&>button]:px-1.5!";
// Middle-Man: the account dropdown keeps room for a full name; the four small fields share the rest (two rows of two
// only on the narrowest cards). Above 620px it lines up with the To Account dropdown above.
const MIDDLE_ROW =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_var(--revw)] items-center gap-2 @max-[439px]:grid-cols-[160px_minmax(0,1fr)] @min-[440px]:@max-[520px]:grid-cols-[148px_minmax(0,1fr)] @min-[521px]:@max-[620px]:grid-cols-[160px_minmax(0,1fr)]";
const MIDDLE_FIELDS =
  "col-[2/4] grid min-w-0 grid-cols-[1.5fr_1fr_1fr_1.3fr] gap-2 @max-[620px]:col-[2] @max-[439px]:grid-cols-2 @min-[440px]:@max-[520px]:grid-cols-[1.55fr_1fr_1fr_1.15fr] @min-[440px]:@max-[520px]:gap-[5px] @min-[521px]:@max-[620px]:grid-cols-[1.5fr_1fr_1fr_1.2fr] [&>input]:px-1.5 @min-[440px]:@max-[520px]:[&>input]:px-1 @min-[440px]:@max-[520px]:[&>input]:text-[12px]";

/**
 * Right top card: the manual transaction form. The Type picks the layout: Rate and Adjustment have their own, every
 * other type (Contra, Payment, Claim, Profit, Clear) shares the standard one. UI only: Submit and Search do nothing yet.
 * `accounts` are the account options of the current company; `currencies` are the currencies shown in the report.
 */
export default function ManualForm({ accounts, currencies, accountsKey }) {
  const readOnly = Boolean(useCurrentUser()?.readOnly);
  const [type, setType] = useState("CONTRA");
  const [f, setF] = useState(INITIAL);
  const [confirm, setConfirm] = useState(false);
  const set = (key, value) => setF((cur) => ({ ...cur, [key]: value }));

  // A different company has different accounts: clear the picked ones (adjusting state while rendering, no effect needed).
  const [seenKey, setSeenKey] = useState(accountsKey);
  if (seenKey !== accountsKey) {
    setSeenKey(accountsKey);
    setF((cur) => ({ ...cur, ...Object.fromEntries(ACCOUNT_FIELDS.map((k) => [k, null])) }));
  }

  const layout = layoutOf(type);
  const curOptions = currencies.map((c) => ({ value: c, label: c }));
  const allCurOptions = ALL_CUR.map((c) => ({ value: c, label: c }));
  const curOf = (key, list = currencies) => (list.includes(f[key]) ? f[key] : list[0]);
  const swap = (a, b) => setF((cur) => ({ ...cur, [a]: cur[b], [b]: cur[a] }));

  const acc = (key, placeholder) => <Select searchable options={accounts} value={f[key]} onChange={(v) => set(key, v)} placeholder={placeholder} ariaLabel={placeholder} />;
  // Rate converts between two currencies, so both dropdowns list every currency; the other types only the shown ones.
  const cur = (key, all = false) => (
    <Select compact options={all ? allCurOptions : curOptions} value={curOf(key, all ? ALL_CUR : currencies)} onChange={(v) => set(key, v)} ariaLabel="Currency" />
  );
  const input = (key, props) => <input className={INPUT} value={f[key]} onChange={(e) => set(key, e.target.value)} autoComplete="off" {...props} />;
  const reverse = (a, b) => (
    <button
      type="button"
      title="Reverse"
      onClick={() => swap(a, b)}
      className="inline-flex h-[30px] w-(--revw) cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-white/80 bg-white/65 text-[12.5px] font-bold whitespace-nowrap text-brand-navy hover:bg-white max-[1500px]:gap-0"
    >
      <Repeat2 className="size-[15px] flex-none max-[1500px]:size-4" strokeWidth={2.3} />
      <span className="max-[1500px]:hidden">Reverse</span>
    </button>
  );

  const valid =
    layout === "rate"
      ? f.rTo1 && f.rFrom1 && positive(f.rAmt1) && positive(f.rAmt2)
      : layout === "adj"
        ? f.aAcc && positive(f.aAmt)
        : f.to && f.from && positive(f.amount);

  return (
    <section className="@container flex min-h-0 min-w-0 flex-col justify-between gap-[5px] rounded-xl border border-dash-line bg-white px-4 py-2 shadow-dash-filter [--revw:104px] max-[1500px]:[--revw:42px]">
      <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-x-3 gap-y-[5px]">
        <span className={LABEL}>Type</span>
        <Select options={TYPE_OPTIONS} value={type} onChange={setType} ariaLabel="Type" />
        <span className={LABEL}>Date</span>
        <input className={INPUT} value={todayDisplay()} readOnly aria-label="Date" />

        {layout === "std" && (
          <>
            <span className={LABEL}>Account</span>
            <div className={ACCOUNT_ROW}>
              {acc("to", "--Select To Account--")}
              {acc("from", "--Select From Account--")}
              {reverse("to", "from")}
            </div>
            <span className={LABEL}>Currency</span>
            {cur("cur")}
            <span className={LABEL}>Amount</span>
            {input("amount", { inputMode: "decimal", placeholder: "0.00" })}
            <span className={LABEL}>Remark</span>
            {input("remark", { placeholder: "Optional" })}
          </>
        )}

        {layout === "rate" && (
          <>
            <span className={LABEL}>Account</span>
            <div className={ACCOUNT_ROW}>
              {acc("rTo1", "--Select To Account--")}
              {acc("rFrom1", "--Select From Account--")}
              {reverse("rTo1", "rFrom1")}
            </div>
            <span className={LABEL}>Currency</span>
            <div className={CURRENCY_ROW}>
              {cur("rCur1", true)}
              {input("rAmt1", { inputMode: "decimal", placeholder: "Amount" })}
              {input("rRate", { inputMode: "decimal", placeholder: "Rate" })}
              {cur("rCur2", true)}
              {input("rAmt2", { inputMode: "decimal", placeholder: "Amount" })}
            </div>
            <span className={LABEL}>Account</span>
            <div className={ACCOUNT_ROW}>
              {acc("rTo2", "--Select To Account--")}
              {acc("rFrom2", "--Select From Account--")}
              {reverse("rTo2", "rFrom2")}
            </div>
            <span className={LABEL}>Middle-Man</span>
            <div className={MIDDLE_ROW}>
              {acc("rMid", "--Select Account--")}
              <div className={MIDDLE_FIELDS}>
                {input("rMul", { inputMode: "decimal", placeholder: "Rate-Mul" })}
                {input("rFee", { inputMode: "decimal", placeholder: "Fee" })}
                {input("rPT", { inputMode: "decimal", placeholder: "PT-Fee" })}
                {input("rMAmt", { inputMode: "decimal", placeholder: "Amount" })}
              </div>
            </div>
          </>
        )}

        {layout === "adj" && (
          <>
            <span className={LABEL}>Account</span>
            {acc("aAcc", "--Select To Account--")}
            <span className={LABEL}>Currency</span>
            {cur("aCur")}
            <span className={LABEL}>Amount</span>
            {input("aAmt", { inputMode: "decimal", disabled: !f.aAcc })}
            <span className={LABEL}>Remark</span>
            {input("aRemark", { disabled: !f.aAcc })}
          </>
        )}
      </div>

      <div className="mt-0.5 flex items-center justify-end gap-2.5">
        <div className={cn("mr-auto flex items-center text-[12.5px] font-semibold text-[#374151]")}>
          <SelectBox checked={confirm} onChange={setConfirm} label="Confirm Submit" />
          <button type="button" tabIndex={-1} onClick={() => setConfirm(!confirm)} className="cursor-pointer select-none">
            Confirm Submit
          </button>
        </div>
        <PrimaryButton
          className="h-[30px]! min-w-[104px] justify-center rounded-lg! py-0!"
          disabled={readOnly || !confirm || !valid}
          title={readOnly ? "Read-only login" : undefined}
        >
          Submit
        </PrimaryButton>
        <button
          type="button"
          className="inline-flex h-[30px] min-w-[104px] cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[rgba(13,96,255,0.45)] bg-white px-[18px] text-[13px] font-bold text-[#0d60ff] shadow-[0_2px_6px_rgba(13,96,255,0.12)] transition-colors hover:border-[#0d60ff] hover:bg-[#eef5ff]"
        >
          <Search className="size-[15px]" strokeWidth={2.4} />
          Search
        </button>
      </div>
    </section>
  );
}
