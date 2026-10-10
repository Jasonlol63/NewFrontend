import { useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, Check, Inbox, Info, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDisplayDate } from "@/lib/date";
import DeleteDialog from "@/components/shared/DeleteDialog.jsx";
import FormCard, { CardCount } from "@/components/shared/form-modal/FormCard.jsx";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import { SoftButton } from "@/components/shared/form-modal/fields.jsx";
import { SelectBox } from "@/components/shared/list/DataTable.jsx";
import { daysBack, money, OLD_AFTER_DAYS, rowLabel, totalsByCurrency, typeLabel, typeTone } from "./contraInboxRules";

// Contra Inbox: the manual transactions a role below Manager backdated, waiting for an Owner / Admin / Manager.
// Approve posts them to the books, Reject removes them (the backend archives the row). The page owns the data
// (useContraInbox, so the button's number and this list agree); this modal only shows it and sends the decisions.
//
// The table drops columns by its own width (not the screen's), so nothing is cut off at any size:
//   >= 900px: all columns | 640-899px: Submitted folds under From -> To | 520-639px: Type folds under Txn Date |
//   < 520px (phones): Description / Remark goes and the row buttons become icons

const dmy = (iso) => formatDisplayDate(iso, "/");

function useWidth(ref) {
  const [width, setWidth] = useState(1000);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

const th = "sticky top-0 z-[1] whitespace-nowrap border-b border-modal-divider bg-[#e6effb] px-1.5 py-2.5 text-center text-[12px] font-extrabold text-brand-navy modal-compact:py-1.5";
const td = "h-14 overflow-hidden border-b border-[rgba(130,155,195,0.16)] px-1.5 text-center text-[13px] font-semibold leading-tight text-[#1f2937] text-ellipsis whitespace-nowrap modal-compact:h-12 modal-tiny:h-11";
const subText = "truncate text-[11.5px] font-medium text-dash-sub";

// Columns per width: [key, width px, head]. Description / Remark takes whatever is left.
function columnsFor(mode) {
  const pick = ["pick", 44];
  const date = ["date", 112, "Txn Date"];
  const type = ["type", 92, "Type"];
  const amount = ["amount", 120, "Amount"];
  if (mode === "full") return [pick, date, type, ["route", 112, "From → To"], amount, ["submitted", 112, "Submitted"], ["desc", 0, "Description / Remark"], ["action", 170, "Action"]];
  if (mode === "mid") return [pick, date, type, ["route", 150, "From → To"], amount, ["desc", 0, "Description / Remark"], ["action", 170, "Action"]];
  if (mode === "narrow") return [pick, ["date", 132, "Txn Date"], ["route", 140, "From → To"], ["amount", 112, "Amount"], ["desc", 0, "Description / Remark"], ["action", 156, "Action"]];
  return [["pick", 40], ["date", 104, "Txn Date"], ["route", 0, "From → To"], ["amount", 96, "Amount"], ["action", 84, "Action"]];
}

function TypeTag({ type }) {
  const [bg, fg] = typeTone(type);
  return (
    <span className="inline-flex h-[20px] items-center rounded-md px-2 text-[10.5px] font-extrabold tracking-[0.2px]" style={{ background: bg, color: fg }}>
      {type}
    </span>
  );
}

function AgoBadge({ days }) {
  const old = days > OLD_AFTER_DAYS;
  return (
    <span
      className={cn(
        "mt-0.5 inline-flex h-[18px] items-center rounded-md border px-1.5 text-[10.5px] font-extrabold",
        old ? "border-[#fca5a5] bg-[#fee2e2] text-[#991b1b]" : "border-[#f3d27a] bg-[#fef3c7] text-[#92400e]"
      )}
    >
      {days}d back
    </span>
  );
}

function RowButton({ tone, iconOnly, disabled, onClick, label }) {
  const Icon = tone === "approve" ? Check : X;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-[26px] cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-[7px] border bg-white text-[12px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        iconOnly ? "w-[28px]" : "px-2.5",
        tone === "approve" ? "border-[#86d9a5] text-[#15803d] hover:bg-[#f0fdf4]" : "border-[#fca5a5] text-[#dc2626] hover:bg-[#fee2e2]"
      )}
    >
      {iconOnly && <Icon className="size-3.5" strokeWidth={2.6} />}
      {!iconOnly && (tone === "approve" ? "Approve" : "Reject")}
    </button>
  );
}

const presetClass =
  "inline-flex h-8 flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[9px] border px-3 text-[12.5px] font-bold text-[#1d4ed8] transition-colors modal-compact:h-[30px] modal-compact:px-2.5 modal-tiny:h-7";

export default function ContraInboxModal({ inbox, onClose }) {
  const { rows, loading, error: loadError, reload, approve, reject } = inbox;
  const [filter, setFilter] = useState("ALL");
  const [selected, setSelected] = useState(() => new Set()); // nothing is ticked until the approver picks it
  const [rejecting, setRejecting] = useState(null); // the rows waiting for the Reject confirmation
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ text: "", error: false });
  const tableRef = useRef(null);
  const tableWidth = useWidth(tableRef);
  const mode = tableWidth >= 900 ? "full" : tableWidth >= 640 ? "mid" : tableWidth >= 520 ? "narrow" : "tiny";
  const columns = columnsFor(mode);
  const iconOnly = mode === "tiny";

  const types = [...new Set(rows.map((r) => r.type))];
  const activeFilter = filter === "ALL" || types.includes(filter) ? filter : "ALL";
  const visible = activeFilter === "ALL" ? rows : rows.filter((r) => r.type === activeFilter);
  const picked = visible.filter((r) => selected.has(r.id));
  const totals = totalsByCurrency(picked);
  const state = picked.length === 0 ? false : picked.length === visible.length ? true : "mixed";

  const setMany = (list, on) =>
    setSelected((prev) => {
      const next = new Set(prev);
      list.forEach((r) => (on ? next.add(r.id) : next.delete(r.id)));
      return next;
    });

  const run = async (action, list, done) => {
    if (busy || list.length === 0) return;
    setBusy(true);
    setMessage({ text: "", error: false });
    try {
      await action(list);
      setMessage({ text: done(list.length), error: false });
    } catch (err) {
      setMessage({ text: err.message, error: true });
    } finally {
      setSelected((prev) => {
        const next = new Set(prev);
        list.forEach((r) => next.delete(r.id));
        return next;
      });
      setBusy(false);
    }
  };
  const approveRows = (list) => run(approve, list, (n) => `Approved ${n} ${n === 1 ? "transaction" : "transactions"}, posted to the books`);
  const rejectRows = (list) => run(reject, list, (n) => `Rejected ${n} ${n === 1 ? "transaction" : "transactions"}`);
  const refresh = () => {
    setMessage({ text: "", error: false });
    reload();
  };

  const footerError = message.error || Boolean(loadError);
  const footerNote = message.text || loadError || (loading ? "Loading…" : "");
  const idle = busy || loading;
  const actionClass = "h-[38px] min-w-[112px] px-[22px] text-[13.5px] modal-compact:h-8 modal-tiny:h-[30px] @max-[599px]/main:min-w-0 @max-[599px]/main:flex-1 @max-[479px]/main:w-11 @max-[479px]/main:flex-none @max-[479px]/main:px-0";

  const cellFor = (key, r) => {
    switch (key) {
      case "date":
        return (
          <td key={key} className={td}>
            <div className="truncate tabular-nums">{dmy(r.date)}</div>
            <div className="flex items-center justify-center gap-1">
              <AgoBadge days={daysBack(r.date)} />
              {mode === "narrow" && <span className="mt-0.5"><TypeTag type={r.type} /></span>}
            </div>
          </td>
        );
      case "type":
        return (
          <td key={key} className={td}>
            <TypeTag type={r.type} />
          </td>
        );
      case "route":
        return (
          <td key={key} className={td}>
            <div className="flex items-center justify-center gap-1 truncate">
              <span className="text-[#185fa5]">{r.from || "—"}</span>
              <ArrowRight className="size-3 flex-none text-[#94a3b8]" strokeWidth={2.4} />
              <span className="text-[#534ab7]">{r.to || "—"}</span>
            </div>
            {(mode === "mid" || mode === "narrow") && <div className={subText}>{r.submittedBy} · {r.submittedAt}</div>}
            {mode === "tiny" && <div className={subText}>{typeLabel(r.type)} · {r.submittedBy}</div>}
          </td>
        );
      case "amount":
        return (
          <td key={key} className={td}>
            <div className="truncate font-extrabold tabular-nums">{money(r.amount)}</div>
            <div className={subText}>{r.currency}</div>
          </td>
        );
      case "submitted":
        return (
          <td key={key} className={td}>
            <div className="truncate">{r.submittedBy}</div>
            <div className={subText}>{r.submittedAt}</div>
          </td>
        );
      case "desc":
        return (
          <td key={key} className={cn(td, "text-left")}>
            <div className="truncate" title={r.description}>{r.description || "—"}</div>
            <div className={subText} title={r.remark}>{r.remark ? `Remark: ${r.remark}` : "No remark"}</div>
          </td>
        );
      case "action":
        return (
          <td key={key} className={td}>
            <span className="inline-flex items-center gap-1.5">
              <RowButton tone="approve" iconOnly={iconOnly} disabled={idle} label={`Approve ${rowLabel(r)}`} onClick={() => approveRows([r])} />
              <RowButton tone="reject" iconOnly={iconOnly} disabled={idle} label={`Reject ${rowLabel(r)}`} onClick={() => setRejecting([r])} />
            </span>
          </td>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <FormModal
        icon={Inbox}
        title={
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="min-w-0 truncate">Contra Inbox</span>
            <span className="inline-flex min-w-[22px] flex-none items-center justify-center rounded-full bg-[#ef4444] px-1.5 text-[12px] leading-[22px] font-extrabold tracking-normal text-white">{rows.length}</span>
          </span>
        }
        onClose={onClose}
        onSave={() => approveRows(picked)}
        saveLabel={
          <>
            <span className="@max-[479px]/main:hidden">Approve</span>
            <span>({picked.length})</span>
          </>
        }
        saveDisabled={idle || picked.length === 0}
        headerExtra={
          <SoftButton onClick={refresh} disabled={busy} title="Reload the inbox" aria-label="Refresh" className="h-9 px-4 @max-[479px]/main:hidden modal-compact:h-8 modal-tiny:h-[30px] modal-tiny:px-3">
            <RefreshCw className="size-[15px]" strokeWidth={2.4} />
            <span className="@max-[479px]/main:hidden">Refresh</span>
          </SoftButton>
        }
        footerStart={
          <span
            role={footerError ? "alert" : "status"}
            className={cn("mr-auto inline-flex min-w-0 items-center gap-1.5 text-[12.5px] font-semibold @max-[599px]/main:basis-full", footerError ? "text-[#dc2626]" : "text-[#5b7196]")}
          >
            <Info className="size-3.5 flex-none" strokeWidth={2.2} />
            <span className="truncate">
              {footerNote ||
                (totals.length ? (
                  <>
                    Selected total:{" "}
                    {totals.map(([cur, sum], i) => (
                      <span key={cur}>
                        {i > 0 && " · "}
                        <b className="font-extrabold text-brand-navy">{cur} {money(sum)}</b>
                      </span>
                    ))}
                  </>
                ) : (
                  `${rows.length} ${rows.length === 1 ? "item" : "items"} awaiting approval`
                ))}
            </span>
          </span>
        }
        footerExtra={
          <button
            type="button"
            disabled={idle || picked.length === 0}
            onClick={() => setRejecting(picked)}
            className={cn(
              actionClass,
              "inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[#fca5a5] bg-white/70 font-bold text-[#dc2626] transition-colors hover:bg-[#fee2e2]",
              "disabled:cursor-not-allowed disabled:border-[#e5e7eb] disabled:bg-white/40 disabled:text-[#9ca3af] disabled:hover:bg-white/40"
            )}
          >
            <X className="size-[15px]" strokeWidth={2.4} />
            <span className="@max-[479px]/main:sr-only">Reject</span>
            <span className="@max-[479px]/main:hidden">({picked.length})</span>
          </button>
        }
        bodyClassName="flex flex-col"
      >
        <section className="flex flex-none flex-wrap items-center gap-2 rounded-2xl border border-modal-line bg-modal-card px-3.5 py-2.5 shadow-modal-card modal-compact:py-1.5">
          <span className="whitespace-nowrap text-[12.5px] font-bold text-[#374151]">Type</span>
          {["ALL", ...types].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t)}
              className={cn(presetClass, t === activeFilter ? "border-[#7fb2ff] bg-[#dbeafe]" : "border-[#b9d3f5] bg-white/70 hover:bg-white")}
            >
              {t === "ALL" ? "All" : typeLabel(t)}
              <span className="font-semibold text-[#5b7196]">{t === "ALL" ? rows.length : rows.filter((r) => r.type === t).length}</span>
            </button>
          ))}
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-[9px] border border-[#f3e2a3] bg-[rgba(254,243,199,0.7)] px-2.5 py-1.5 text-[12px] font-semibold text-[#92400e] @max-[639px]/main:hidden">
            <Info className="size-3.5 flex-none" strokeWidth={2.2} />
            Nothing posts to the books until it is approved.
          </span>
        </section>

        <FormCard
          title="Pending approval"
          className="min-h-[160px] flex-1"
          body={false}
          right={
            <CardCount>
              {visible.length} {visible.length === 1 ? "item" : "items"} · {picked.length} selected
            </CardCount>
          }
        >
          <div ref={tableRef} className="min-h-0 flex-1 overflow-auto [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
            {visible.length > 0 && (
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  {columns.map(([key, width]) => (
                    <col key={key} style={width ? { width } : undefined} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th className={th}>
                      <SelectBox label="Select all transactions" checked={state} onChange={(on) => setMany(visible, on)} />
                    </th>
                    {columns.slice(1).map(([key, , head]) => (
                      <th key={key} className={cn(th, key === "desc" && "text-left")}>
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id} className={cn("hover:bg-white/60", selected.has(r.id) && "bg-[rgba(219,234,254,0.45)]")}>
                      <td className={td}>
                        <SelectBox label={`Select ${rowLabel(r)}`} checked={selected.has(r.id)} onChange={(on) => setMany([r], on)} />
                      </td>
                      {columns.slice(1).map(([key]) => cellFor(key, r))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {visible.length === 0 && (
              <p className="m-0 px-4 py-10 text-center text-[13px] italic text-[#8a96a8]">{loading ? "Loading…" : "Nothing waiting for approval."}</p>
            )}
          </div>
        </FormCard>
      </FormModal>

      <DeleteDialog
        open={Boolean(rejecting)}
        onOpenChange={(open) => !open && setRejecting(null)}
        names={(rejecting ?? []).map(rowLabel)}
        noun="transaction"
        verb="Reject"
        verbPast="rejected"
        note="Rejected transactions are removed and never post to the books."
        onConfirm={() => {
          const list = rejecting;
          setRejecting(null);
          rejectRows(list);
        }}
      />
    </>
  );
}
