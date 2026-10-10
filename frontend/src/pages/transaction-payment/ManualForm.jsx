import { useMemo, useState } from "react";
import { Repeat2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SelectBox } from "@/components/shared/list/DataTable.jsx";
import { PrimaryButton } from "@/components/shared/list/ListToolbar.jsx";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { postJson } from "@/lib/api";
import { INPUT, LABEL, Select } from "./fields.jsx";
import {
  SUBMIT_URL,
  TYPE_OPTIONS,
  accountOptions,
  buildSubmitRequest,
  layoutOf,
  middleManTotal,
  parseRate,
  positive,
  rateAmount2,
  toNumber,
  todayDisplay,
  trim8,
} from "./transactionPaymentRules";
import { useLinkedAccounts } from "./useTransactionData";

const ACCOUNT_FIELDS = ["to", "from", "rTo1", "rFrom1", "rTo2", "rFrom2", "rMid", "aAcc"];
const INITIAL = {
  to: null, from: null, cur: null, amount: "", remark: "",
  rTo1: null, rFrom1: null, rCur1: null, rAmt1: "", rRate: "", rCur2: null, rAmt2: "", rTo2: null, rFrom2: null, rMid: null, rMul: "", rFee: "", rPT: "",
  aAcc: null, aCur: null, aAmt: "", aRemark: "",
};
// What stays after a submit: the picked currencies (the accounts, amounts and remarks are cleared).
const KEEP = ["cur", "rCur1", "rCur2", "aCur"];

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
 * other type (Contra, Payment, Claim, Profit, Clear) shares the standard one. Submit posts to /api/transaction/submit.
 * `accounts` are the active accounts of the current company, `currencies` its currencies ([{ id, code }]) and `shown`
 * the currency codes shown in the report. An account can only be picked for a currency it holds. onSubmitted(status)
 * runs after a successful submit (status is APPROVED, or PENDING when it waits in the Contra Inbox).
 */
export default function ManualForm({ tenantId, accounts, currencies, shown, onSubmitted }) {
  const readOnly = Boolean(useCurrentUser()?.readOnly);
  const [type, setType] = useState("CONTRA");
  const [f, setF] = useState(INITIAL);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const set = (key, value) => {
    setMessage(null);
    setF((cur) => ({ ...cur, [key]: value }));
  };

  // A different company has different accounts and currencies: clear them (adjusting state while rendering, no effect needed).
  const [seenTenant, setSeenTenant] = useState(tenantId);
  if (seenTenant !== tenantId) {
    setSeenTenant(tenantId);
    setF((cur) => ({ ...cur, ...Object.fromEntries([...ACCOUNT_FIELDS, ...KEEP].map((k) => [k, null])) }));
  }

  const layout = layoutOf(type);
  const allCodes = useMemo(() => currencies.map((c) => c.code), [currencies]);
  const idByCode = useMemo(() => new Map(currencies.map((c) => [c.code, c.id])), [currencies]);
  const curOptions = shown.map((c) => ({ value: c, label: c }));
  const allCurOptions = allCodes.map((c) => ({ value: c, label: c }));
  const curOf = (key, list = shown) => (list.includes(f[key]) ? f[key] : list[0]);

  // The currency of each block of the form. Rate converts between two currencies, so its dropdowns list every currency and
  // the second defaults to a different one than the first.
  const code = { std: curOf("cur"), adj: curOf("aCur"), rate1: allCodes.includes(f.rCur1) ? f.rCur1 : (shown[0] ?? allCodes[0]) };
  code.rate2 = allCodes.includes(f.rCur2) ? f.rCur2 : (allCodes.find((c) => c !== code.rate1) ?? code.rate1);

  const holders = useLinkedAccounts(
    tenantId,
    layout === "rate" ? [idByCode.get(code.rate1), idByCode.get(code.rate2)] : [idByCode.get(layout === "adj" ? code.adj : code.std)]
  );
  const optionsFor = (ccy) => {
    const held = holders(idByCode.get(ccy));
    return accountOptions(held ? accounts.filter((a) => held.has(String(a.id))) : accounts);
  };
  const opts = {
    to: optionsFor(code.std),
    from: optionsFor(code.std),
    aAcc: optionsFor(code.adj),
    rTo1: optionsFor(code.rate1),
    rFrom1: optionsFor(code.rate1),
    rTo2: optionsFor(code.rate2),
    rFrom2: optionsFor(code.rate2),
    rMid: optionsFor(code.rate2),
  };
  // A picked account that the currency no longer allows counts as not picked.
  const picked = Object.fromEntries(Object.entries(opts).map(([k, list]) => [k, list.some((o) => o.value === f[k]) ? f[k] : null]));

  const swap = (a, b) => {
    setMessage(null);
    setF((cur) => ({ ...cur, [a]: cur[b], [b]: cur[a] }));
  };
  // Rate layout: Amount 2 follows Amount 1 x Rate; typing Amount 2 works the Rate out instead.
  const setRateField = (key, value) => {
    setMessage(null);
    setF((cur) => {
      const next = { ...cur, [key]: value };
      if (key === "rAmt2") {
        if (positive(next.rAmt1) && positive(value)) next.rRate = trim8(toNumber(value) / toNumber(next.rAmt1));
      } else if (parseRate(next.rRate)) {
        next.rAmt2 = rateAmount2(next.rAmt1, next.rRate);
      } else if (key === "rAmt1" && positive(value) && positive(next.rAmt2)) {
        next.rRate = trim8(toNumber(next.rAmt2) / toNumber(value));
      }
      return next;
    });
  };

  const acc = (key, placeholder) => <Select searchable options={opts[key]} value={picked[key]} onChange={(v) => set(key, v)} placeholder={placeholder} ariaLabel={placeholder} />;
  const cur = (key, all = false) => (
    <Select
      compact
      options={all ? allCurOptions : curOptions}
      value={all ? code[key === "rCur1" ? "rate1" : "rate2"] : curOf(key)}
      onChange={(v) => set(key, v)}
      ariaLabel="Currency"
    />
  );
  const input = (key, props) => <input className={INPUT} value={f[key]} onChange={(e) => set(key, e.target.value)} autoComplete="off" {...props} />;
  const rateInput = (key, props) => <input className={INPUT} value={f[key]} onChange={(e) => setRateField(key, e.target.value)} autoComplete="off" {...props} />;

  const submit = async () => {
    setMessage(null);
    let body;
    try {
      body = buildSubmitRequest({ tenantId, type, f: { ...f, ...picked }, cur: code });
    } catch (err) {
      setMessage({ error: true, text: err.message });
      return;
    }
    setBusy(true);
    try {
      const reply = await postJson(SUBMIT_URL, body);
      const status = reply.data?.approvalStatus ?? "APPROVED";
      setF((cur) => ({ ...INITIAL, ...Object.fromEntries(KEEP.map((k) => [k, cur[k]])) }));
      setConfirm(false);
      setMessage({ text: status === "PENDING" ? "Submitted, waiting for approval in the Contra Inbox" : "Submitted" });
      onSubmitted?.(status);
    } catch (err) {
      setMessage({ error: true, text: err.message });
    } finally {
      setBusy(false);
    }
  };
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
      ? picked.rTo1 && picked.rFrom1 && picked.rTo2 && picked.rFrom2 && positive(f.rAmt1) && parseRate(f.rRate)
      : layout === "adj"
        ? picked.aAcc && Number.isFinite(toNumber(f.aAmt)) && toNumber(f.aAmt) !== 0
        : picked.to && picked.from && positive(f.amount);

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
              {rateInput("rAmt1", { inputMode: "decimal", placeholder: "Amount" })}
              {rateInput("rRate", { placeholder: "Rate" })}
              {cur("rCur2", true)}
              {rateInput("rAmt2", { inputMode: "decimal", placeholder: "Amount" })}
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
                {input("rMul", { placeholder: "Rate-Mul" })}
                {input("rFee", { inputMode: "decimal", placeholder: "Fee" })}
                {input("rPT", { inputMode: "decimal", placeholder: "PT-Fee" })}
                <input className={INPUT} value={middleManTotal({ amount1: f.rAmt1, rate: f.rRate, mul: f.rMul, fee: f.rFee, pt: f.rPT })} readOnly aria-label="Middle-Man amount" placeholder="Amount" />
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
            {input("aAmt", { inputMode: "decimal", disabled: !picked.aAcc, placeholder: "+ / -" })}
            <span className={LABEL}>Remark</span>
            {input("aRemark", { disabled: !picked.aAcc, placeholder: "Optional" })}
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
        {message && (
          <span role="status" title={message.text} className={cn("min-w-0 truncate text-[12.5px] font-semibold", message.error ? "text-dash-down" : "text-[#0f6d38]")}>
            {message.text}
          </span>
        )}
        <PrimaryButton
          className="h-[30px]! min-w-[104px] justify-center rounded-lg! py-0!"
          disabled={readOnly || !confirm || !valid || busy}
          title={readOnly ? "Read-only login" : undefined}
          onClick={submit}
        >
          Submit
        </PrimaryButton>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="inline-flex h-[30px] min-w-[104px] cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-[rgba(13,96,255,0.45)] bg-white px-[18px] text-[13px] font-bold text-[#0d60ff] shadow-[0_2px_6px_rgba(13,96,255,0.12)] transition-colors hover:border-[#0d60ff] hover:bg-[#eef5ff]"
        >
          <Search className="size-[15px]" strokeWidth={2.4} />
          Search
        </button>
      </div>
    </section>
  );
}
