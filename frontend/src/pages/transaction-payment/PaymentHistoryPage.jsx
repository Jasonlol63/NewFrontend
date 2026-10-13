import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { Download, History, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { SoftButton } from "@/components/shared/form-modal/fields.jsx";
import { localizeBackend } from "@/i18n/backendMessages";
import ExportPdfModal from "./ExportPdfModal.jsx";
import { closingBalances, flowAmount, formatRate, parseHistoryParams } from "./paymentHistoryRules";
import { fmt } from "./transactionPaymentRules";
import { useHistory } from "./useTransactionData";

const amountTone = (n) => (n > 0 ? "font-semibold text-[#1d4ed8]" : n < 0 ? "font-semibold text-[#dc2626]" : "");

// Column widths in %; Description takes what is left. Remark gets more room on narrower screens so it is never cut.
const COLS = [
  ["date", "text-left", "w-[8%] max-[1250px]:w-[10.5%]"],
  ["idProduct", "text-left", "w-[8.5%]"],
  ["currency", "text-center", "w-[6.5%]"],
  ["rate", "text-center", "w-[5%]"],
  ["winLoss", "text-right", "w-[7%]"],
  ["crDr", "text-right", "w-[8.5%]"],
  ["balance", "text-right", "w-[8.5%]"],
  ["description", "text-left", ""],
  ["remark", "text-center", "w-[12%] max-[1250px]:w-[16%]"],
  ["creator", "text-center", "w-[7.5%]"],
];

const TH =
  "sticky top-0 z-[2] h-7 border-r border-white/25 bg-brand-head px-[clamp(6px,0.55vw,10px)] type-caption font-semibold! tracking-[0.2px] whitespace-nowrap text-white last:border-r-0";
const TD =
  "h-[26px] overflow-hidden border-b border-[rgba(130,155,195,0.16)] px-[clamp(6px,0.55vw,10px)] text-ellipsis whitespace-nowrap tabular-nums";

/**
 * Payment History: opened in its own popup window from an account name in Transaction Payment. Same frosted frame as
 * the form modals, the rows of the Admin / Account list. The company, account, period and currencies come from the
 * address (see openPaymentHistory); the rows from /api/transaction/history. The PDF button opens the export dialog.
 */
export default function PaymentHistoryPage() {
  const { t } = useTranslation("transaction");
  const routeAccount = decodeURIComponent(useParams().account ?? "");
  const [search] = useSearchParams();
  const request = useMemo(() => parseHistoryParams(search), [search]);
  const history = useHistory(request);
  const [exportOpen, setExportOpen] = useState(false);

  const code = history.account?.accountId || routeAccount;
  const name = history.account?.name || code;
  const title = t("history.title", { name, code });
  useEffect(() => {
    document.title = title;
  }, [title]);

  // Without the company, account and period there is nothing to load: back to the list.
  if (!request) return <Navigate to="/transaction-payment" replace />;

  const { rows } = history;
  const closing = closingBalances(rows);

  return (
    <div className="fixed inset-0 bg-[#eaf3fd] bg-[url('/images/Count-Inside-Bg.webp')] bg-cover bg-center bg-no-repeat">
      <div
        role="dialog"
        aria-label={title}
        className="absolute inset-[clamp(8px,1.6dvh,16px)] flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-white/55 bg-modal-bg shadow-[0_20px_50px_-30px_rgba(20,51,107,0.45)] backdrop-blur-[22px] backdrop-saturate-[1.15] [--gap:clamp(8px,1.5dvh,14px)] [--pad:clamp(10px,2dvh,18px)]"
      >
        <header className="flex flex-none items-center justify-between gap-3 px-[calc(var(--pad)+6px)] pt-(--pad)">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 flex-none items-center justify-center rounded-xl bg-brand-sweep text-white shadow-[0_10px_20px_-8px_rgba(20,90,220,0.55),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.35)]">
              <History className="size-5" strokeWidth={2.2} />
            </div>
            <h1 className="m-0 truncate type-page-title whitespace-nowrap text-brand-navy">{title}</h1>
          </div>
          <div className="flex flex-none items-center gap-2">
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border border-[#bfd8ff] bg-[#eaf4ff] px-4 type-body font-semibold! text-[#1d4ed8] hover:bg-[#dcebff] max-[900px]:px-3"
            >
              <Download className="size-[15px]" strokeWidth={2.3} />
              PDF
            </button>
            <SoftButton onClick={() => window.close()} aria-label={t("history.close")} className="h-9 px-4 max-[900px]:px-3">
              <X className="size-[15px]" strokeWidth={2.5} />
              <span className="max-[900px]:hidden">{t("history.close")}</span>
            </SoftButton>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col px-(--pad) pt-(--gap) pb-(--pad)">
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/85 bg-white/80 shadow-[0_8px_22px_-16px_rgba(20,51,107,0.5)]">
            {history.error && (
              <div role="alert" className="flex-none border-b border-red-200 bg-red-50 px-3.5 py-2 type-body font-medium! text-dash-down">
                {localizeBackend(history.error)}
              </div>
            )}
            <div className={cn("min-h-0 flex-1 overflow-auto transition-opacity [scrollbar-color:#c3cedf_transparent] [scrollbar-width:thin]", history.loading && "opacity-60")}>
              <table className="w-full table-fixed border-separate border-spacing-0 type-table-cell">
                <colgroup>
                  {COLS.map(([name, , width]) => (
                    <col key={name} className={width} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {COLS.map(([name, align]) => (
                      <th key={name} className={cn(TH, align)}>
                        {t(`history.cols.${name}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* the same two-tone rows as the Admin / Account list: blue stripe, white, deeper blue on hover */}
                  {rows.map((r, i) =>
                    r.bf ? (
                      <tr key={r.key} className="bg-[rgba(214,230,250,0.92)] font-semibold text-brand-navy">
                        <td className={cn(TD, "text-left")}>{t("history.bf")}</td>
                        <td className={cn(TD, "text-left")}>-</td>
                        <td className={cn(TD, "text-center")}>{r.currency}</td>
                        <td className={cn(TD, "text-center")}>-</td>
                        <td className={cn(TD, "text-right")}>-</td>
                        <td className={cn(TD, "text-right")}>-</td>
                        <td className={cn(TD, "text-right")}>{fmt(r.balance)}</td>
                        <td className={cn(TD, "text-left")}>{r.description}</td>
                        <td className={cn(TD, "text-center")}>-</td>
                        <td className={cn(TD, "text-center")}>-</td>
                      </tr>
                    ) : (
                      <tr key={r.key} className={cn(i % 2 ? "bg-white/90" : "bg-row-stripe", "hover:bg-row-hover")}>
                        <td className={cn(TD, "text-left text-[#1f2937]")}>{r.date || "-"}</td>
                        <td className={cn(TD, "text-left text-[#1f2937]")} title={r.product}>{r.product || "-"}</td>
                        <td className={cn(TD, "text-center text-[#1f2937]")}>{r.currency || "-"}</td>
                        <td className={cn(TD, "text-center text-[#1f2937]")}>{formatRate(r.rate)}</td>
                        <td className={cn(TD, "text-right", amountTone(r.winLoss))}>{flowAmount(r.winLoss)}</td>
                        <td className={cn(TD, "text-right", amountTone(r.crDr))}>{flowAmount(r.crDr)}</td>
                        <td className={cn(TD, "text-right", amountTone(r.balance))}>{fmt(r.balance)}</td>
                        <td className={cn(TD, "text-left text-[#1f2937] uppercase")} title={r.description}>{r.description || "-"}</td>
                        <td className={cn(TD, "text-center text-[#1f2937] uppercase")} title={r.remark}>{r.remark || "-"}</td>
                        <td className={cn(TD, "text-center text-[#1f2937]")}>{r.createdBy || "-"}</td>
                      </tr>
                    )
                  )}
                  {!history.loading && !history.error && !rows.length && (
                    <tr>
                      <td colSpan={COLS.length} className={cn(TD, "text-center text-dash-sub")}>{t("history.none")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-none items-center justify-between gap-3 border-t border-[rgba(130,155,195,0.3)] bg-white/60 px-3.5 py-[7px] type-caption text-dash-sub">
              <span>
                {history.loading ? (
                  t("history.loading")
                ) : (
                  <>
                    {t("history.showingBefore")}<b className="text-brand-navy">{rows.length}</b>{t("history.showingAfter")}
                  </>
                )}
              </span>
              <span>
                {t("history.closing")}
                {closing.map(([currency, balance]) => (
                  <b key={currency} className={cn("ml-2", balance < 0 ? "text-[#dc2626]" : "text-brand-navy")}>
                    {closing.length > 1 && `${currency} `}
                    {fmt(balance)}
                  </b>
                ))}
              </span>
            </div>
          </section>
        </div>
      </div>
      {exportOpen && <ExportPdfModal open onClose={() => setExportOpen(false)} request={request} account={{ code, name: history.account?.name ?? "" }} />}
    </div>
  );
}
