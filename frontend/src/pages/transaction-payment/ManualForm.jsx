import { useEffect, useMemo, useRef, useState } from "react";
import { Repeat2, RotateCw, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { SelectBox } from "@/components/shared/list/DataTable.jsx";
import { PrimaryButton } from "@/components/shared/list/ListToolbar.jsx";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { postJson } from "@/lib/api";
import { formatDisplayDate, toIsoDate } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import DateField from "@/components/shared/form-modal/DateField.jsx";
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
} from "./transactionPaymentRules";
import { useLinkedAccounts } from "./useTransactionData";

const ACCOUNT_FIELDS = ["to", "from", "rTo1", "rFrom1", "rTo2", "rFrom2", "rMid", "aAcc"];
const INITIAL = {
  to: null, from: null, cur: null, amount: "", remark: "", date: null,
  rTo1: null, rFrom1: null, rCur1: null, rAmt1: "", rRate: "", rCur2: null, rAmt2: "", rTo2: null, rFrom2: null, rMid: null, rMul: "", rFee: "", rPT: "",
  aAcc: null, aCur: null, aAmt: "", aRemark: "",
};
// What stays after a submit: the picked currencies (the accounts, amounts and remarks are cleared).
const KEEP = ["cur", "rCur1", "rCur2", "aCur"];
const fmtTotal = (v) => (v ? formatMoney(v) : "");

// Account | Account | Reverse: the Reverse column is as wide as its button (icon only below 1500px).
const ACCOUNT_ROW = "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_var(--revw)] items-center gap-2";
// Currency row of the Rate layout: always one row. The three boxes are as wide as their figures need ("1334933595", "/1.23258",
// "74,705.85") and no wider; the two currency dropdowns take the room that is left, so they get big on a wide card.
const CURRENCY_ROW =
  "grid grid-cols-[minmax(68px,1fr)_minmax(112px,150px)_minmax(86px,115px)_minmax(68px,1fr)_minmax(94px,130px)] gap-2 " +
  "@max-[560px]:grid-cols-[minmax(64px,1fr)_minmax(96px,112px)_minmax(70px,78px)_minmax(64px,1fr)_minmax(76px,86px)] @max-[560px]:gap-1.5 @max-[560px]:[&>input]:px-[6px] @max-[560px]:[&>button]:px-1.5! " +
  "@max-[500px]:grid-cols-[minmax(62px,1fr)_minmax(93px,106px)_minmax(69px,74px)_minmax(62px,1fr)_minmax(74px,82px)] @max-[500px]:gap-[3px] @max-[500px]:[&>input]:px-[5px] @max-[500px]:[&>button]:px-1! @max-[500px]:[&>button]:gap-0.5! " +
  "@max-[470px]:grid-cols-[minmax(60px,1fr)_minmax(93px,106px)_minmax(69px,74px)_minmax(60px,1fr)_minmax(74px,82px)]";
// Middle-Man on a compact card: the account box and four fields that are each as wide as their word needs ("PT-Fee").
const MIDDLE_COMPACT = "grid grid-cols-[minmax(92px,1fr)_minmax(252px,1.6fr)] items-center gap-1.5";
const MIDDLE_COMPACT_FIELDS = "grid grid-cols-[minmax(72px,1.2fr)_minmax(44px,0.8fr)_minmax(58px,1fr)_minmax(64px,1fr)] gap-1 [&>input]:px-1.5";
// Middle-Man: the account dropdown keeps room for a full name; the four small fields share the rest (two rows of two
// only on the narrowest cards). Above 620px it lines up with the To Account dropdown above.
const MIDDLE_ROW =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_var(--revw)] items-center gap-2 @max-[439px]:grid-cols-[160px_minmax(0,1fr)] @min-[440px]:@max-[520px]:grid-cols-[148px_minmax(0,1fr)] @min-[521px]:@max-[620px]:grid-cols-[160px_minmax(0,1fr)]";
const MIDDLE_FIELDS =
  "col-[2/4] grid min-w-0 grid-cols-[1.5fr_1fr_1fr_1.3fr] gap-2 @max-[620px]:col-[2] @max-[439px]:grid-cols-2 @min-[440px]:@max-[520px]:grid-cols-[1.55fr_1fr_1fr_1.15fr] @min-[440px]:@max-[520px]:gap-[5px] @min-[521px]:@max-[620px]:grid-cols-[1.5fr_1fr_1fr_1.2fr] [&>input]:px-1.5 @min-[440px]:@max-[520px]:[&>input]:px-1";
// Date popup: the same calendar as the Bank Process dayStart field, but capped small — the field here is far
// wider than the popup needs to be.
const DATE_POPUP = "max-w-[260px]";

/**
 * Right top card: the manual transaction form. The Type picks the layout: Rate and Adjustment have their own, every
 * other type (Contra, Payment, Claim, Profit, Clear) shares the standard one. Submit posts to /api/transaction/submit.
 * `accounts` are the active accounts of the current company, `currencies` its currencies ([{ id, code }]) and `shown`
 * the currency codes shown in the report. An account can only be picked for a currency it holds. onSubmitted(status)
 * runs after a successful submit with (status, { date, accounts }): status is APPROVED, or PENDING when it waits in the Contra
 * Inbox, date the transaction date and accounts the ids it touched per currency ({ MYR: [1, 2] }). typeSearch = { active, on, busy,
 * onEnter, onExit } drives the Search button (lit while Type Search lists by manual activity) and the exit button beside it
 * (while Type Search or the focus after a submit is on). notify(message, level, detail):
 * what a submit did, as a toast over the page (push of hooks/useNotice).
 */
export default function ManualForm({ tenantId, accounts, currencies, shown, onSubmitted, notify, typeSearch }) {
  const { t } = useTranslation("transaction");
  const readOnly = Boolean(useCurrentUser()?.readOnly);
  const [type, setType] = useState("CONTRA");
  const [f, setF] = useState(() => ({ ...INITIAL, date: toIsoDate(new Date()) }));
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

  // How much room the card has (its width inside the padding): under 560px the Account placeholders are short words and the
  // label column is narrower; under 440px the Rate layout is stacked, one block per leg.
  const cardRef = useRef(null);
  const [room, setRoom] = useState(1000);
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return undefined;
    const update = () => setRoom(card.clientWidth - 32);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(card);
    return () => observer.disconnect();
  }, []);
  const compact = room < 560;
  const stacked = room < 440;
  const ph = {
    to: compact ? t("form.toShort") : t("form.selectTo"),
    from: compact ? t("form.fromShort") : t("form.selectFrom"),
    account: compact ? t("form.accountShort") : t("form.selectAccount"),
  };
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
      setF((cur) => ({ ...INITIAL, date: toIsoDate(new Date()), ...Object.fromEntries(KEEP.map((k) => [k, cur[k]])) }));
      setConfirm(false);
      notify?.(status === "PENDING" ? t("toast.submittedPending") : t("toast.submitted"));
      // The accounts the submit touched, per currency (Rate: leg 1 in the first currency, leg 2 and the Middle-Man in the second).
      const touched =
        type === "RATE"
          ? { [code.rate1]: [picked.rTo1, picked.rFrom1], [code.rate2]: [picked.rTo2, picked.rFrom2, picked.rMid] }
          : layout === "adj"
            ? { [code.adj]: [picked.aAcc] }
            : { [code.std]: [picked.to, picked.from] };
      const accounts = Object.fromEntries(Object.entries(touched).map(([ccy, ids]) => [ccy, ids.filter(Boolean).map(Number)]));
      onSubmitted?.(status, { date: body.transactionDate, accounts });
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
    <section ref={cardRef} className="@container flex min-h-0 min-w-0 flex-col justify-between gap-[5px] rounded-xl border border-dash-line bg-white px-4 py-2 shadow-dash-filter [--revw:104px] max-[1500px]:[--revw:42px]">
      <div className={cn("grid items-center gap-y-[5px]", compact ? "grid-cols-[60px_minmax(0,1fr)] gap-x-2" : "grid-cols-[76px_minmax(0,1fr)] gap-x-3")}>
        <span className={LABEL}>{t("form.type")}</span>
        <Select options={typeOptions} value={type} onChange={setType} ariaLabel={t("form.type")} />
        <span className={LABEL}>{t("form.date")}</span>
        <DateField value={f.date} display={formatDisplayDate(f.date)} onChange={(v) => set("date", v)} placeholder="DD/MM/YYYY" triggerClassName={INPUT} popupClassName={DATE_POPUP} />

        {layout === "std" && (
          <>
            <span className={LABEL}>{t("form.account")}</span>
            <div className={ACCOUNT_ROW}>
              {acc("to", ph.to)}
              {acc("from", ph.from)}
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
            {stacked && <span className="col-span-2 ml-0.5 type-caption font-semibold! text-dash-faint">{t("form.leg1")}</span>}
            <span className={LABEL}>{t("form.account")}</span>
            <div className={ACCOUNT_ROW}>
              {acc("rTo1", ph.to)}
              {acc("rFrom1", ph.from)}
              {reverse("rTo1", "rFrom1")}
            </div>
            {stacked ? (
              <>
                <span className={LABEL}>{t("form.currency")}</span>
                <div className="grid grid-cols-[66px_minmax(0,1fr)_minmax(0,0.8fr)] gap-1.5">
                  {cur("rCur1", true)}
                  {rateInput("rAmt1", { inputMode: "decimal", placeholder: t("form.amount") })}
                  {rateInput("rRate", { placeholder: t("form.rate") })}
                </div>
                <span className="col-span-2 ml-0.5 type-caption font-semibold! text-dash-faint">{t("form.leg2")}</span>
                <span className={LABEL}>{t("form.currency")}</span>
                <div className="grid grid-cols-[66px_minmax(0,1fr)] gap-1.5">
                  {cur("rCur2", true)}
                  <input className={INPUT} value={f.rAmt2 ? formatMoney(f.rAmt2) : ""} readOnly tabIndex={-1} placeholder={t("form.amount")} aria-label={t("form.amount")} />
                </div>
              </>
            ) : (
              <>
                <span className={LABEL}>{t("form.currency")}</span>
                <div className={CURRENCY_ROW}>
                  {cur("rCur1", true)}
                  {rateInput("rAmt1", { inputMode: "decimal", placeholder: t("form.amount") })}
                  {rateInput("rRate", { placeholder: t("form.rate") })}
                  {cur("rCur2", true)}
                  <input className={INPUT} value={f.rAmt2 ? formatMoney(f.rAmt2) : ""} readOnly tabIndex={-1} placeholder={t("form.amount")} aria-label={t("form.amount")} />
                </div>
              </>
            )}
            <span className={LABEL}>{t("form.account")}</span>
            <div className={ACCOUNT_ROW}>
              {acc("rTo2", ph.to)}
              {acc("rFrom2", ph.from)}
              {reverse("rTo2", "rFrom2")}
            </div>
            <span className={cn(LABEL, "whitespace-normal! break-words leading-[1.1]")}>{t("form.middleMan")}</span>
            <div className={stacked ? "grid gap-1.5" : compact ? MIDDLE_COMPACT : MIDDLE_ROW}>
              {acc("rMid", ph.account)}
              <div className={stacked ? "grid grid-cols-[repeat(4,minmax(0,1fr))] gap-1.5 [&>input]:px-1.5" : compact ? MIDDLE_COMPACT_FIELDS : MIDDLE_FIELDS}>
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
            {acc("aAcc", ph.to)}
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
          aria-pressed={typeSearch.active}
          disabled={typeSearch.busy}
          onClick={typeSearch.onEnter}
          className={cn(
            "inline-flex h-[30px] min-w-[104px] cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-[18px] type-table-cell font-semibold! shadow-[0_2px_6px_rgba(13,96,255,0.12)] transition-colors disabled:cursor-wait disabled:opacity-60",
            typeSearch.active
              ? "border-[#0d60ff] bg-[#eef5ff] text-[#0d60ff]"
              : "border-[rgba(13,96,255,0.45)] bg-white text-[#0d60ff] hover:border-[#0d60ff] hover:bg-[#eef5ff]"
          )}
        >
          <Search className="size-[15px]" strokeWidth={2.4} />
          {t("form.search")}
        </button>
        {typeSearch.on && (
          <button
            type="button"
            title={t("form.exitSearch")}
            aria-label={t("form.exitSearch")}
            disabled={typeSearch.busy}
            onClick={typeSearch.onExit}
            className="inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg border border-white/80 bg-white/65 text-brand-navy hover:bg-white disabled:cursor-wait disabled:opacity-60"
          >
            <RotateCw className="size-[15px]" strokeWidth={2.3} />
          </button>
        )}
      </div>
    </section>
  );
}
