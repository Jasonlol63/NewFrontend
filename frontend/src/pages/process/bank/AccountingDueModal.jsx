import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Info, ReceiptText, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDisplayDate } from "@/lib/date";
import DeleteDialog from "@/components/shared/DeleteDialog.jsx";
import DateField from "@/components/shared/form-modal/DateField.jsx";
import FormCard, { CardCount } from "@/components/shared/form-modal/FormCard.jsx";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import { SoftButton } from "@/components/shared/form-modal/fields.jsx";
import { SelectBox } from "@/components/shared/list/DataTable.jsx";
import { earlyDatePresets, isEarlyBill, sampleAccountingDue, visibleBills, yearEndIso } from "./accountingDueRules";

// Accounting Due: the bills the backend has generated (by each process's schedule), plus the early ones the user can
// post or delete ahead of time. One table, grouped "Due now" / "Early"; the checked bills are what Transaction posts
// and Delete removes. UI only for now: posting or deleting just takes the bills out of this list.
//
// The table drops columns by its own width (not the screen's), so nothing is cut off at any size:
//   >= 900px: all columns | 560-899px: No / Start Date / Frequency fold under Billing Date and Card Owner | 430-559px: Contract folds under Bank | < 430px (phones): Bank and Contract fold under Card Owner

const dmy = (iso) => formatDisplayDate(iso, "-");
const shortFrequency = (f) => (f === "1st of Every Month" ? "1st of Month" : f);

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
const td = "h-[42px] overflow-hidden border-b border-[rgba(130,155,195,0.16)] px-1.5 text-center text-[13px] font-semibold text-[#1f2937] text-ellipsis whitespace-nowrap modal-compact:h-9 modal-tiny:h-8";

function Cell({ main, sub, className }) {
  return (
    <td className={cn(td, sub && "leading-tight", className)}>
      <div className="truncate">{main}</div>
      {sub && <div className="truncate text-[11.5px] font-medium text-dash-sub">{sub}</div>}
    </td>
  );
}

// Columns per width: [key, width px, head]. The Card Owner column takes whatever is left.
function columnsFor(mode) {
  if (mode === "full") {
    return [["pick", 48], ["no", 52, "No"], ["start", 116, "Start Date"], ["billing", 130, "Billing Date"], ["frequency", 140, "Frequency"], ["owner", 0, "Card Owner"], ["bank", 110, "Bank"], ["contract", 120, "Contract"]];
  }
  if (mode === "mid") return [["pick", 44], ["billing", 124, "Billing Date"], ["owner", 0, "Card Owner"], ["bank", 92, "Bank"], ["contract", 112, "Contract"]];
  if (mode === "narrow") return [["pick", 44], ["billing", 116, "Billing Date"], ["owner", 0, "Card Owner"], ["bank", 96, "Bank"]];
  return [["pick", 40], ["billing", 104, "Billing Date"], ["owner", 0, "Card Owner"]];
}

function cellFor(key, bill, mode) {
  const stackStart = mode !== "full";
  switch (key) {
    case "no":
      return null; // set by the caller (row number)
    case "start":
      return <Cell key={key} main={dmy(bill.startDate)} className="tabular-nums" />;
    case "billing":
      return <Cell key={key} main={dmy(bill.billingDate)} sub={stackStart ? `Start ${dmy(bill.startDate)}` : undefined} className="tabular-nums" />;
    case "frequency":
      return <Cell key={key} main={shortFrequency(bill.frequency)} />;
    case "owner":
      return <Cell key={key} main={<span title={bill.cardOwner}>{bill.cardOwner}</span>} sub={mode === "tiny" ? `${bill.bank} · ${bill.contract}` : stackStart ? shortFrequency(bill.frequency) : undefined} />;
    case "bank":
      return <Cell key={key} main={bill.bank} sub={mode === "narrow" ? bill.contract : undefined} />;
    case "contract":
      return <Cell key={key} main={bill.contract} />;
    default:
      return null;
  }
}

const presetClass =
  "h-8 flex-none cursor-pointer whitespace-nowrap rounded-[9px] border px-3 text-[12.5px] font-bold text-[#1d4ed8] transition-colors modal-compact:h-[30px] modal-compact:px-2.5 modal-tiny:h-7";

export default function AccountingDueModal({ readOnly, onClose }) {
  const [bills, setBills] = useState(sampleAccountingDue);
  const [earlyDate, setEarlyDate] = useState(yearEndIso);
  // Bills the user unticked; everything shown is ticked until then (new ones appearing with a later date start ticked).
  const [unticked, setUnticked] = useState(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tableRef = useRef(null);
  const tableWidth = useWidth(tableRef);
  const mode = tableWidth >= 900 ? "full" : tableWidth >= 560 ? "mid" : tableWidth >= 430 ? "narrow" : "tiny";

  const presets = useMemo(() => earlyDatePresets(), []);
  const visible = useMemo(() => visibleBills(bills, earlyDate), [bills, earlyDate]);
  const dueNow = visible.filter((b) => !isEarlyBill(b));
  const early = visible.filter(isEarlyBill);
  const picked = visible.filter((b) => !unticked.has(b.id));
  const columns = columnsFor(mode);

  const setMany = (list, on) =>
    setUnticked((prev) => {
      const next = new Set(prev);
      list.forEach((b) => (on ? next.delete(b.id) : next.add(b.id)));
      return next;
    });
  const stateOf = (list) => {
    const n = list.filter((b) => !unticked.has(b.id)).length;
    return n === 0 ? false : n === list.length ? true : "mixed";
  };
  const removePicked = () => {
    const ids = new Set(picked.map((b) => b.id));
    setBills((list) => list.filter((b) => !ids.has(b.id)));
  };
  const refresh = () => {
    setBills(sampleAccountingDue());
    setUnticked(new Set());
    setEarlyDate(yearEndIso());
  };

  const rowNumbers = new Map([...dueNow, ...early].map((b, i) => [b.id, i + 1]));
  const groupRow = (label, list, tag) =>
    list.length > 0 && (
      <tr key={`g-${label}`} className="bg-[rgba(230,239,251,0.7)]">
        <td className="h-[34px] border-b border-[rgba(130,155,195,0.16)] text-center modal-compact:h-8">
          <SelectBox label={`Select all ${label.toLowerCase()} bills`} checked={stateOf(list)} onChange={(on) => setMany(list, on)} />
        </td>
        <td colSpan={columns.length - 1} className="h-[34px] border-b border-[rgba(130,155,195,0.16)] px-1.5 text-left text-[12px] font-extrabold text-brand-navy modal-compact:h-8">
          <span className="inline-flex items-center gap-2">
            {label}
            {tag && <span className="inline-flex h-[18px] items-center rounded-md border border-[#f3d27a] bg-[#fef3c7] px-1.5 text-[10px] font-extrabold tracking-[0.3px] text-[#92400e]">{tag}</span>}
            <span className="font-bold text-dash-sub">{list.length}</span>
          </span>
        </td>
      </tr>
    );
  const billRow = (bill) => {
    const isEarly = isEarlyBill(bill);
    return (
      <tr key={bill.id} className="hover:bg-white/60">
        <td className={cn(td, "text-center", isEarly && "shadow-[inset_3px_0_0_#f59e0b]")}>
          <SelectBox label={`Select ${bill.cardOwner} ${dmy(bill.billingDate)}`} checked={!unticked.has(bill.id)} onChange={(on) => setMany([bill], on)} />
        </td>
        {columns.slice(1).map(([key]) => (key === "no" ? <Cell key={key} main={rowNumbers.get(bill.id)} className="tabular-nums text-dash-sub" /> : cellFor(key, bill, mode)))}
      </tr>
    );
  };

  const actionClass = "h-[38px] min-w-[112px] px-[22px] text-[13.5px] modal-compact:h-8 modal-tiny:h-[30px] @max-[599px]/main:min-w-0 @max-[599px]/main:flex-1 @max-[479px]/main:w-11 @max-[479px]/main:flex-none @max-[479px]/main:px-0";

  return (
    <>
      <FormModal
        icon={ReceiptText}
        title={
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="min-w-0 truncate">Accounting Due</span>
            <span className="inline-flex min-w-[22px] flex-none items-center justify-center rounded-full bg-[#ef4444] px-1.5 text-[12px] leading-[22px] font-extrabold tracking-normal text-white">{visible.length}</span>
            <span className="flex-none text-[12px] font-semibold tracking-normal text-[#b45309] @max-[599px]/main:hidden">as of {dmy(earlyDate)}</span>
          </span>
        }
        onClose={onClose}
        onSave={() => {
          removePicked();
        }}
        saveLabel={
          <>
            <span className="@max-[479px]/main:hidden">Transaction</span>
            <span className="hidden @max-[479px]/main:inline">Post</span>
            <span>({picked.length})</span>
          </>
        }
        saveDisabled={readOnly || picked.length === 0}
        headerExtra={
          <SoftButton onClick={refresh} aria-label="Refresh" className="h-9 px-4 @max-[479px]/main:hidden modal-compact:h-8 modal-tiny:h-[30px] modal-tiny:px-3">
            <RefreshCw className="size-[15px]" strokeWidth={2.4} />
            <span className="@max-[479px]/main:hidden">Refresh</span>
          </SoftButton>
        }
        footerStart={
          <span className="mr-auto inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#5b7196] @max-[599px]/main:hidden">
            <Info className="size-3.5 flex-none" strokeWidth={2.2} />
            {visible.length} {visible.length === 1 ? "process" : "processes"} awaiting accounting
          </span>
        }
        footerExtra={
          <button
            type="button"
            disabled={readOnly || picked.length === 0}
            onClick={() => setConfirmDelete(true)}
            className={cn(
              actionClass,
              "inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[#fca5a5] bg-white/70 font-bold text-[#dc2626] transition-colors hover:bg-[#fee2e2]",
              "disabled:cursor-not-allowed disabled:border-[#e5e7eb] disabled:bg-white/40 disabled:text-[#9ca3af] disabled:hover:bg-white/40"
            )}
          >
            <Trash2 className="size-[15px]" strokeWidth={2.3} />
            <span className="@max-[479px]/main:sr-only">Delete</span>
            <span className="@max-[479px]/main:hidden">({picked.length})</span>
          </button>
        }
        bodyClassName="flex flex-col"
      >
        <section className="flex flex-none flex-wrap items-center gap-2 rounded-2xl border border-modal-line bg-modal-card px-3.5 py-2.5 shadow-modal-card modal-compact:py-1.5">
          <span className="whitespace-nowrap text-[12.5px] font-bold text-[#374151]">Early transaction date</span>
          <div className="w-[150px] flex-none">
            <DateField value={earlyDate} onChange={setEarlyDate} placeholder="DD/MM/YYYY" />
          </div>
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setEarlyDate(p.value)}
              className={cn(presetClass, p.value === earlyDate ? "border-[#7fb2ff] bg-[#dbeafe]" : "border-[#b9d3f5] bg-white/70 hover:bg-white")}
            >
              {p.label}
            </button>
          ))}
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-[9px] border border-[#f3e2a3] bg-[rgba(254,243,199,0.7)] px-2.5 py-1.5 text-[12px] font-semibold text-[#92400e]">
            <Info className="size-3.5 flex-none" strokeWidth={2.2} />
            Bills posted or deleted early won&apos;t be generated again.
          </span>
        </section>

        <FormCard
          title="Bills"
          className="min-h-[160px] flex-1"
          body={false}
          right={
            <CardCount>
              {visible.length} {visible.length === 1 ? "bill" : "bills"} · {picked.length} selected
            </CardCount>
          }
        >
          <div ref={tableRef} className="min-h-0 flex-1 overflow-auto [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                {columns.map(([key, width]) => (
                  <col key={key} style={width ? { width } : undefined} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th className={th}>
                    <SelectBox label="Select all bills" checked={stateOf(visible)} onChange={(on) => setMany(visible, on)} />
                  </th>
                  {columns.slice(1).map(([key, , head]) => (
                    <th key={key} className={th}>
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupRow("Due now", dueNow)}
                {dueNow.map(billRow)}
                {groupRow("Early", early, "NOT DUE YET")}
                {early.map(billRow)}
              </tbody>
            </table>
            {visible.length === 0 && <p className="m-0 px-4 py-10 text-center text-[13px] italic text-[#8a96a8]">Nothing left to post.</p>}
          </div>
        </FormCard>
      </FormModal>

      <DeleteDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        names={picked.map((b) => `${b.cardOwner} (${dmy(b.billingDate)})`)}
        noun="bill"
        note="Deleted bills won't be generated again."
        onConfirm={() => {
          removePicked();
          setConfirmDelete(false);
        }}
      />
    </>
  );
}
