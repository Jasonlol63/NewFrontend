import { useMemo, useState } from "react";
import { Repeat2, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { SelectBox } from "@/components/shared/list/DataTable.jsx";
import { PrimaryButton } from "@/components/shared/list/ListToolbar.jsx";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { postJson } from "@/lib/api";
import { formatMoney } from "@/lib/money";
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
  isNonZeroAmount,
  toNumber,
  todayDisplay,
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
const fmtTotal = (v) => (v ? formatMoney(v) : "");

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
  "col-[2/4] grid min-w-0 grid-cols-[1.5fr_1fr_1fr_1.3fr] gap-2 @max-[620px]:col-[2] @max-[439px]:grid-cols-2 @min-[440px]:@max-[520px]:grid-cols-[1.55fr_1fr_1fr_1.15fr] @min-[440px]:@max-[520px]:gap-[5px] @min-[521px]:@max-[620px]:grid-cols-[1.5fr_1fr_1fr_1.2fr] [&>input]:px-1.5 @min-[440px]:@max-[520px]:[&>input]:px-1";

/**
 * Right top card: the manual transaction form. The Type picks the layout: Rate and Adjustment have their own, every
 * other type (Contra, Payment, Claim, Profit, Clear) shares the standard one. Submit posts to /api/transaction/submit.
 * `accounts` are the active accounts of the current company, `currencies` its currencies ([{ id, code }]) and `shown`
 * the currency codes shown in the report. An account can only be picked for a currency it holds. onSubmitted(status)
 * runs after a successful submit (status is APPROVED, or PENDING when it waits in the Contra Inbox). notify(message, level, detail):
 * what a submit did, as a toast over the page (push of hooks/useNotice).
 */
export default function ManualForm({ tenantId, accounts, currencies, shown, onSubmitted, notify }) {
  const { t } = useTranslation("transaction");
  const readOnly = Boolean(useCurrentUser()?.readOnly);
  const [type, setType] = useState("CONTRA");
  const [f, setF] = useState(INITIAL);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (key, value) => {
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
  const typeOptions = TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(`types.${o.value}`) }));
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
  const allAccounts = accountOptions(accounts);
  const opts = {
    to: optionsFor(code.std),
    from: optionsFor(code.std),
    aAcc: optionsFor(code.adj),
    // Rate lists every account whatever the currency; Submit checks that each one holds its currency.
    rTo1: allAccounts,
    rFrom1: allAccounts,
    rTo2: allAccounts,
    rFrom2: allAccounts,
    rMid: allAccounts,
  };
  // A picked account that the currency no longer allows counts as not picked.
  const picked = Object.fromEntries(Object.entries(opts).map(([k, list]) => [k, list.some((o) => o.value === f[k]) ? f[k] : null]));

  const swap = (a, b) => {
    setF((cur) => ({ ...cur, [a]: cur[b], [b]: cur[a] }));
  };
  // Rate layout: Amount 2 is read-only, it always follows Amount 1 x Rate.
  const setRateField = (key, value) => {
    setF((cur) => {
      const next = { ...cur, [key]: value };
      next.rAmt2 = rateAmount2(next.rAmt1, next.rRate);
      return next;
    });
  };

  const acc = (key, placeholder) => <Select searchable clearable options={opts[key]} value={picked[key]} onChange={(v) => set(key, v)} placeholder={placeholder} ariaLabel={placeholder} />;
  const cur = (key, all = false) => (
    <Select
      compact
      options={all ? allCurOptions : curOptions}
      value={all ? code[key === "rCur1" ? "rate1" : "rate2"] : curOf(key)}
      onChange={(v) => set(key, v)}
      ariaLabel={t("form.currency")}
    />
  );
  const input = (key, props) => <input className={INPUT} value={f[key]} onChange={(e) => set(key, e.target.value)} autoComplete="off" {...props} />;
  const rateInput = (key, props) => <input className={INPUT} value={f[key]} onChange={(e) => setRateField(key, e.target.value)} autoComplete="off" {...props} />;

  const submit = async () => {
    let body;
    try {
      body = buildSubmitRequest({ tenantId, type, f: { ...f, ...picked }, cur: code, t });
    } catch (err) {
      notify?.(err.message, "error");
      return;
    }
    if (type === "RATE") {
      const legs = [[picked.rTo1, code.rate1], [picked.rFrom1, code.rate1], [picked.rTo2, code.rate2], [picked.rFrom2, code.rate2], [picked.rMid, code.rate2]];
      for (const [id, ccy] of legs) {
        const held = id ? holders(idByCode.get(ccy)) : null;
        if (held && !held.has(String(id))) {
          notify?.(t("errors.noCurrency", { account: opts.rTo1.find((o) => o.value === id)?.label ?? id, currency: ccy }), "error");
          return;
        }
      }
    }
    setBusy(true);
    try {
      const reply = await postJson(SUBMIT_URL, body);
      const status = reply.data?.approvalStatus ?? "APPROVED";
      setF((cur) => ({ ...INITIAL, ...Object.fromEntries(KEEP.map((k) => [k, cur[k]])) }));
      setConfirm(false);
      notify?.(status === "PENDING" ? t("toast.submittedPending") : t("toast.submitted"));
      onSubmitted?.(status);
    } catch (err) {
      notify?.(t("toast.submitFailed"), "error", err.message);
    } finally {
      setBusy(false);
    }
  };
  const reverse = (a, b) => (
    <button
      type="button"
      title={t("form.reverse")}
      onClick={() => swap(a, b)}
      className="inline-flex h-[30px] w-(--revw) cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-white/80 bg-white/65 type-table-cell font-semibold! whitespace-nowrap text-brand-navy hover:bg-white max-[1500px]:gap-0"
    >
      <Repeat2 className="size-[15px] flex-none max-[1500px]:size-4" strokeWidth={2.3} />
      <span className="max-[1500px]:hidden">{t("form.reverse")}</span>
    </button>
  );

  const valid =
    layout === "rate"
      ? picked.rTo1 && picked.rFrom1 && picked.rTo2 && picked.rFrom2 && positive(f.rAmt1) && parseRate(f.rRate)
      : layout === "adj"
        ? picked.aAcc && isNonZeroAmount(f.aAmt)
        : picked.to && picked.from && positive(f.amount);

  return (
    <section className="@container flex min-h-0 min-w-0 flex-col justify-between gap-[5px] rounded-xl border border-dash-line bg-white px-4 py-2 shadow-dash-filter [--revw:104px] max-[1500px]:[--revw:42px]">
      <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-x-3 gap-y-[5px]">
        <span className={LABEL}>{t("form.type")}</span>
        <Select options={typeOptions} value={type} onChange={setType} ariaLabel={t("form.type")} />
        <span className={LABEL}>{t("form.date")}</span>
        <input className={INPUT} value={todayDisplay()} readOnly aria-label={t("form.date")} />

        {layout === "std" && (
          <>
            <span className={LABEL}>{t("form.account")}</span>
            <div className={ACCOUNT_ROW}>
              {acc("to", t("form.selectTo"))}
              {acc("from", t("form.selectFrom"))}
              {reverse("to", "from")}
            </div>
            <span className={LABEL}>{t("form.currency")}</span>
            {cur("cur")}
            <span className={LABEL}>{t("form.amount")}</span>
            {input("amount", { inputMode: "decimal", placeholder: "0.00" })}
            <span className={LABEL}>{t("form.remark")}</span>
            {input("remark", { placeholder: t("form.optional") })}
          </>
        )}

        {layout === "rate" && (
          <>
            <span className={LABEL}>{t("form.account")}</span>
            <div className={ACCOUNT_ROW}>
              {acc("rTo1", t("form.selectTo"))}
              {acc("rFrom1", t("form.selectFrom"))}
              {reverse("rTo1", "rFrom1")}
            </div>
            <span className={LABEL}>{t("form.currency")}</span>
            <div className={CURRENCY_ROW}>
              {cur("rCur1", true)}
              {rateInput("rAmt1", { inputMode: "decimal", placeholder: t("form.amount") })}
              {rateInput("rRate", { placeholder: t("form.rate") })}
              {cur("rCur2", true)}
              <input className={INPUT} value={f.rAmt2 ? formatMoney(f.rAmt2) : ""} readOnly tabIndex={-1} placeholder={t("form.amount")} aria-label={t("form.amount")} />
            </div>
            <span className={LABEL}>{t("form.account")}</span>
            <div className={ACCOUNT_ROW}>
              {acc("rTo2", t("form.selectTo"))}
              {acc("rFrom2", t("form.selectFrom"))}
              {reverse("rTo2", "rFrom2")}
            </div>
            <span className={LABEL}>{t("form.middleMan")}</span>
            <div className={MIDDLE_ROW}>
              {acc("rMid", t("form.selectAccount"))}
              <div className={MIDDLE_FIELDS}>
                {input("rMul", { placeholder: t("form.rateMul") })}
                {input("rFee", { inputMode: "decimal", placeholder: t("form.fee") })}
                {input("rPT", { inputMode: "decimal", placeholder: t("form.ptFee") })}
                <input className={INPUT} value={fmtTotal(middleManTotal({ amount1: f.rAmt1, rate: f.rRate, mul: f.rMul, fee: f.rFee, pt: f.rPT }))} readOnly aria-label={t("form.middleAmount")} placeholder={t("form.amount")} />
              </div>
            </div>
          </>
        )}

        {layout === "adj" && (
          <>
            <span className={LABEL}>{t("form.account")}</span>
            {acc("aAcc", t("form.selectTo"))}
            <span className={LABEL}>{t("form.currency")}</span>
            {cur("aCur")}
            <span className={LABEL}>{t("form.amount")}</span>
            {input("aAmt", { inputMode: "decimal", disabled: !picked.aAcc, placeholder: "+ / -" })}
            <span className={LABEL}>{t("form.remark")}</span>
            {input("aRemark", { disabled: !picked.aAcc, placeholder: t("form.optional") })}
          </>
        )}
      </div>

      <div className="mt-0.5 flex items-center justify-end gap-2.5">
        <div className={cn("mr-auto flex items-center type-table-cell font-semibold! text-[#374151]")}>
          <SelectBox checked={confirm} onChange={setConfirm} label={t("form.confirm")} />
          <button type="button" tabIndex={-1} onClick={() => setConfirm(!confirm)} className="cursor-pointer select-none">
            {t("form.confirm")}
          </button>
        </div>
        <PrimaryButton
          className="h-[30px]! min-w-[104px] justify-center rounded-lg! py-0! type-table-cell font-semibold!"
          disabled={readOnly || !confirm || !valid || busy}
          title={readOnly ? t("readOnly") : undefined}
          onClick={submit}
        >
          {t("form.submit")}
        </PrimaryButton>
        <button
          type="button"
          disabled
          title={t("form.comingSoon")}
          className="inline-flex h-[30px] min-w-[104px] cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-[rgba(13,96,255,0.45)] bg-white px-[18px] type-table-cell font-semibold! text-[#0d60ff] shadow-[0_2px_6px_rgba(13,96,255,0.12)] transition-colors hover:border-[#0d60ff] hover:bg-[#eef5ff]"
        >
          <Search className="size-[15px]" strokeWidth={2.4} />
          {t("form.search")}
        </button>
      </div>
    </section>
  );
}
