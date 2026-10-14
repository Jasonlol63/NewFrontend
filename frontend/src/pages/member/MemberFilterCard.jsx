import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { moneySign } from "@/lib/money";
import DateRangePicker from "@/components/shared/DateRangePicker.jsx";
import SegmentGroup from "@/components/shared/SegmentGroup.jsx";
import { fmt } from "@/pages/transaction-payment/transactionPaymentRules";

// Colour from the raw amount: 0.002586 shows 0.00 but stays blue; only a real 0 is grey.
const amountTone = (n) => (moneySign(n) > 0 ? "text-[#1d4ed8]" : moneySign(n) < 0 ? "text-[#dc2626]" : "text-dash-faint");

function Row({ label, children }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="w-[100px] flex-none pt-[3px] type-label text-[#1f2937]">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// Balance of every account per currency: the Total row first, then one row per account (all of them, or the one picked in Select).
function BalanceTable({ currencies, rows }) {
  const { t } = useTranslation("member");
  return (
    <div className="max-w-full overflow-x-auto rounded-lg border border-dash-line bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <table className="w-full border-collapse type-table-cell">
        <thead>
          <tr>
            <th className="bg-brand-head px-3 py-[3px] text-left font-semibold text-white">{t("balance.currency")}</th>
            {currencies.map((c) => (
              <th key={c} className="bg-brand-head px-3 py-[3px] text-right font-semibold text-white">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label} className={i % 2 ? "bg-white" : "bg-row-stripe"}>
              <td className="px-3 py-[3px] text-left font-semibold text-brand-navy">{r.label}</td>
              {currencies.map((c) => (
                <td key={c} className={cn("px-3 py-[3px] text-right font-semibold tabular-nums", amountTone(r.values[c]))}>
                  {moneySign(r.values[c]) ? fmt(r.values[c]) : "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Top card of the Member Win/Loss page. Always: Date Range + export, Company, Currency. When the account is connected
 * to others (`linked`): an Account row too, and on the right a Select (ALL / account) with the balance table.
 */
export default function MemberFilterCard({ filters, onChange, company, accounts, linked, currency, summary, onExport }) {
  const { t } = useTranslation("member");
  return (
    <section className="@container flex min-w-0 flex-none gap-3 rounded-xl border border-dash-line bg-white px-4 py-2.5 shadow-dash-filter">
      <div className={cn("flex min-w-0 flex-col gap-1.5", linked ? "w-[clamp(340px,32%,440px)] flex-none" : "flex-1")}>
        <div className="flex items-center gap-2.5">
          <div className="w-[clamp(236px,15.5vw,290px)] flex-none">
            <DateRangePicker small from={filters.range.from} to={filters.range.to} onChange={(range) => onChange({ range })} className="h-[30px]! w-full! rounded-lg! [&>span:nth-child(2)]:px-2! [&>span:nth-child(2)]:whitespace-nowrap" />
          </div>
          <button
            type="button"
            aria-label={t("filter.exportPdf")}
            onClick={onExport}
            title={t("filter.exportPdf")}
            className="flex size-[30px] flex-none cursor-pointer items-center justify-center rounded-lg border border-[#bfd8ff] bg-[#eaf4ff] text-[#1d4ed8] hover:bg-[#dcebff]"
          >
            <FileText className="size-4" strokeWidth={2.2} />
          </button>
        </div>
        <div className="my-0.5 h-px bg-[rgba(130,155,195,0.3)]" />
        <Row label={t("filter.company")}>
          <SegmentGroup options={[{ value: company, label: company }]} value={company} onChange={() => {}} />
        </Row>
        {linked && (
          <Row label={t("filter.account")}>
            <SegmentGroup options={accounts} value={filters.account} onChange={(account) => onChange({ account })} />
          </Row>
        )}
        <Row label={t("filter.currency")}>
          {currency.options.length ? (
            <SegmentGroup
              wrap
              itemClassName="px-[11px] py-1"
              leading={currency.options.length > 1 ? [{ value: "ALL", label: t("filter.all") }] : []}
              options={currency.options}
              value={currency.allOn ? ["ALL", ...currency.selected] : currency.selected}
              onChange={(v) => (v === "ALL" ? currency.onAll() : currency.onToggle(v))}
              onReorder={currency.onReorder}
            />
          ) : (
            <span className="type-caption font-medium! text-dash-faint">{t("filter.noCurrency")}</span>
          )}
        </Row>
      </div>
      {linked && (
        <div className="hidden min-w-0 flex-initial flex-col gap-2 border-l border-[rgba(130,155,195,0.3)] pl-3 min-[1024px]:flex">
          <div className="flex items-center gap-2">
            <span className="type-label text-[#1f2937]">{t("filter.select")}</span>
            <SegmentGroup options={[{ value: "ALL", label: t("filter.all") }, ...accounts]} value={filters.select} onChange={(select) => onChange({ select })} />
          </div>
          <BalanceTable currencies={summary.currencies} rows={summary.rows} />
        </div>
      )}
    </section>
  );
}
