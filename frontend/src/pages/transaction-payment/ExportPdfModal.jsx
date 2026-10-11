import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { ArrowLeft, Download, ExternalLink, Eye, FileText, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { postJson } from "@/lib/api";
import DateRangePicker from "@/components/shared/DateRangePicker.jsx";
import SegmentGroup from "@/components/shared/SegmentGroup.jsx";
import { HISTORY_URL, normalizeHistoryRow } from "./paymentHistoryRules";
import { HISTORY_URL as MEMBER_HISTORY_URL } from "../member/memberRules";
import { buildHistoryPdf, pdfFilename } from "./paymentHistoryPdf";

const LABEL = "mb-1 block text-[12.5px] font-bold text-[#374151]";
const GHOST =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#cbd5e1] bg-white px-3.5 text-[13px] font-semibold text-brand-navy outline-none transition-colors hover:bg-[#f5f8fd] disabled:cursor-not-allowed disabled:opacity-50";
const OUTLINE =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#1d4ed8] bg-[#eef5ff] px-3.5 text-[13px] font-semibold text-[#1d4ed8] outline-none transition-colors hover:bg-[#e0edff] disabled:cursor-not-allowed disabled:opacity-50";
const SOLID =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none bg-[#1d4ed8] px-3.5 text-[13px] font-semibold text-white outline-none transition-colors hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:opacity-60";

/** The accounts' currencies of the company: the ones the account holds (all of them when it holds none). */
function useAccountCurrencies(open, tenantId, accountId, member) {
  const [state, setState] = useState({ key: "", codes: [], error: "" });
  const key = `${tenantId}:${accountId}`;
  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    const ask = member
      ? postJson("/api/member/account-currencies", accountId, { signal: controller.signal })
      : postJson(`/api/currency/available?tenant_id=${encodeURIComponent(tenantId)}&account_id=${encodeURIComponent(accountId)}`, null, { signal: controller.signal });
    ask
      .then((body) => {
        const rows = (body.data || []).map((c) => ({ code: String(c.code ?? "").toUpperCase(), linked: Boolean(c.is_linked) })).filter((c) => c.code);
        const held = rows.filter((c) => c.linked);
        setState({ key, codes: (held.length ? held : rows).map((c) => c.code), error: "" });
      })
      .catch((err) => {
        if (err.name !== "AbortError") setState({ key, codes: [], error: err.message });
      });
    return () => controller.abort();
  }, [open, tenantId, accountId, member, key]);
  const current = state.key === key;
  return { codes: current ? state.codes : [], loading: open && !current, error: current ? state.error : "" };
}

// "2026-01-01" -> "01/01/2026"
const dmy = (iso) => iso.split("-").reverse().join("/");

/**
 * Export PDF dialog of the Payment History: pick the period and currencies, then Preview the report in the dialog or
 * Export it straight away. The preview is the PDF itself, so Download saves exactly what was shown.
 * member: the Member page's own endpoints (/api/member/*, no tenantId, the backend takes the company from the session).
 * request: { tenantId, accountId, dateFrom, dateTo, currencyCodes } of the history page; account: { code, name }.
 */
export default function ExportPdfModal({ open, onClose, request, account, member = false }) {
  const { codes: available, loading: loadingCurrencies, error: currencyError } = useAccountCurrencies(open, request.tenantId, request.accountId, member);
  const [range, setRange] = useState({ from: request.dateFrom, to: request.dateTo });
  // null = the history's own currencies until the user picks; then the list of picked codes.
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const previewRef = useRef(null);

  const selected = useMemo(() => {
    if (picked) return picked.filter((c) => available.includes(c));
    const fromHistory = request.currencyCodes.filter((c) => available.includes(c));
    return fromHistory.length ? fromHistory : available;
  }, [picked, available, request.currencyCodes]);
  const allOn = available.length > 1 && selected.length === available.length;
  const options = useMemo(() => available.map((c) => ({ value: c, label: c })), [available]);

  const dropPreview = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current.url);
    previewRef.current = null;
    setPreview(null);
  };
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current.url);
    },
    []
  );

  const toggle = (code) => {
    setError("");
    const base = selected;
    if (code === "ALL") setPicked(allOn ? [] : [...available]);
    else setPicked(available.filter((c) => (c === code ? !base.includes(c) : base.includes(c))));
  };

  const filename = selected.length
    ? `${pdfFilename({ accountCode: account.code, currencies: selected, dateFrom: range.from, dateTo: range.to })}.pdf`
    : "";

  // One request for every picked currency, then one table per currency that has rows.
  const generate = async () => {
    if (!range.from || !range.to) throw new Error("Select a date range.");
    if (!selected.length) throw new Error("Select at least one currency.");
    const body = await postJson(member ? MEMBER_HISTORY_URL : HISTORY_URL, {
      ...(member ? {} : { tenantId: request.tenantId }),
      accountId: request.accountId,
      dateFrom: range.from,
      dateTo: range.to,
      currencyCodes: selected,
    });
    const rows = (body.data?.history || []).map(normalizeHistoryRow);
    const sections = selected.map((currency) => ({ currency, rows: rows.filter((r) => r.currency === currency) })).filter((s) => s.rows.length);
    if (!sections.length) throw new Error("No records found for the selected period and currencies.");
    return buildHistoryPdf({
      sections,
      accountCode: account.code,
      accountName: account.name,
      dateFrom: range.from,
      dateTo: range.to,
    });
  };

  const run = async (kind) => {
    setBusy(kind);
    setError("");
    try {
      const doc = await generate();
      if (kind === "export") {
        doc.save(filename.replace(/\.pdf$/, ""));
        onClose();
        return;
      }
      dropPreview();
      const url = URL.createObjectURL(doc.output("blob"));
      previewRef.current = { url, doc, pages: doc.getNumberOfPages() };
      setPreview(previewRef.current);
    } catch (err) {
      setError(err.message || "Couldn't make the PDF. Try again.");
    } finally {
      setBusy("");
    }
  };

  const download = () => {
    preview?.doc.save(filename.replace(/\.pdf$/, ""));
    onClose();
  };

  const title = `${account.code} - WIN/LOSE REPORT`;
  const subtitle = `${account.code}${account.name ? ` (${account.name})` : ""}`;
  const previewing = Boolean(preview);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-dialog-overlay bg-[rgba(20,51,107,0.22)] backdrop-blur-[6px] motion-reduce:animate-none" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] -translate-x-1/2 -translate-y-1/2 animate-dialog-in flex-col rounded-[18px] border border-[#d6e0ef] bg-white px-[18px] py-4 shadow-[0_30px_60px_-20px_rgba(20,51,107,0.45),0_8px_20px_-10px_rgba(20,70,160,0.25)] outline-none motion-reduce:animate-none",
            previewing ? "h-[calc(100dvh-32px)] w-[min(960px,calc(100vw-32px))]" : "w-[min(500px,calc(100vw-32px))]"
          )}
        >
          <div className="mb-3.5 flex flex-none items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-[#1d4ed8] text-white">
                {previewing ? <Eye className="size-5" strokeWidth={2.2} /> : <FileText className="size-5" strokeWidth={2.2} />}
              </div>
              <div className="min-w-0">
                <Dialog.Title className="m-0 truncate text-base font-bold text-brand-navy">{previewing ? `Preview - ${title}` : title}</Dialog.Title>
                <div className="truncate text-xs text-[#64748b]">
                  {previewing
                    ? `${selected.join(", ")} · ${dmy(range.from)} – ${dmy(range.to)} · ${preview.pages} ${preview.pages === 1 ? "page" : "pages"}`
                    : subtitle}
                </div>
              </div>
            </div>
            <Dialog.Close aria-label="Close" className="flex size-8 flex-none cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-[#64748b] hover:bg-slate-100">
              <X className="size-[18px]" />
            </Dialog.Close>
          </div>

          {previewing ? (
            <>
              <div className="min-h-0 flex-1 overflow-hidden rounded-[10px] border border-[#e5e7eb] bg-[#e5e7eb]">
                <iframe title="PDF preview" src={preview.url} className="size-full border-0" />
              </div>
              <div className="mt-2.5 flex flex-none items-center justify-between gap-3">
                <a href={preview.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#1d4ed8] hover:underline">
                  <ExternalLink className="size-3.5" />
                  Open in a new tab
                </a>
                <div className="flex gap-2">
                  <button type="button" className={GHOST} onClick={dropPreview}>
                    <ArrowLeft className="size-4" />
                    Back
                  </button>
                  <button type="button" className={SOLID} onClick={download}>
                    <Download className="size-4" />
                    Download PDF
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <span className={LABEL}>Date range</span>
              <DateRangePicker
                from={range.from}
                to={range.to}
                onChange={(r) => {
                  setRange(r);
                  setError("");
                }}
                className="mb-3.5 h-[34px]! w-full! rounded-lg!"
              />

              <span className={LABEL}>Currency</span>
              <div className="mb-1.5 min-h-8">
                {loadingCurrencies ? (
                  <span className="text-xs font-medium text-dash-faint">Loading currencies...</span>
                ) : available.length ? (
                  <SegmentGroup
                    wrap
                    itemClassName="px-3.5 py-1.5"
                    leading={available.length > 1 ? [{ value: "ALL", label: "ALL" }] : []}
                    options={options}
                    value={allOn ? ["ALL", ...selected] : selected}
                    onChange={toggle}
                  />
                ) : (
                  <span className="text-xs font-medium text-dash-faint">No currency available</span>
                )}
              </div>
              <div className="mb-3.5 text-xs text-[#64748b]">
                {selected.length === 1 ? "1 currency selected." : `${selected.length} currencies selected. Each one gets its own table in the PDF.`}
              </div>

              {(error || currencyError) && (
                <div role="alert" className="mb-3.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12.5px] text-dash-down">
                  {error || currencyError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 border-t border-[#e5e7eb] pt-3">
                <div className="flex flex-none gap-2">
                  <Dialog.Close className={GHOST}>Cancel</Dialog.Close>
                  <button type="button" className={OUTLINE} disabled={Boolean(busy) || loadingCurrencies} onClick={() => run("preview")}>
                    {busy === "preview" ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
                    {busy === "preview" ? "Generating..." : "Preview"}
                  </button>
                  <button type="button" className={SOLID} disabled={Boolean(busy) || loadingCurrencies} onClick={() => run("export")}>
                    {busy === "export" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    {busy === "export" ? "Exporting..." : "Export PDF"}
                  </button>
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
