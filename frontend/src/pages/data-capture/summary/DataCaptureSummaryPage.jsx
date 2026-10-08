import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SelectBox } from "@/components/shared/list/DataTable.jsx";
import { IconAction } from "@/components/shared/list/cells.jsx";
import { PrimaryButton } from "@/components/shared/list/ListToolbar.jsx";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import FormulaDialog from "./FormulaDialog.jsx";
import { MOCK_SUMMARY, parseRate, rowAmount } from "./summaryRules";

const fmt = (n) => (n < 0 ? "-" : "") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Column widths in %. Formula has none and takes what is left: it is the column that gets long.
const COLS = [
  ["Id Product", 13],
  ["Account", 15],
  ["Currency", 7],
  ["Formula", null],
  ["Source", 5.5],
  ["Rate", 4],
  ["Rate Value", 6],
  ["Processed Amount", 9],
  ["Skip", 4],
  ["Delete", 5.5],
];

// No horizontal scroll: headers wrap below 1700px wide instead of widening the table.
const th =
  "sticky top-0 z-[2] h-7 overflow-hidden border-r border-white/25 bg-[linear-gradient(180deg,#60c1fe,#1a6bff)] px-1 text-center text-[11.5px] font-bold text-white last:border-r-0 min-[1701px]:whitespace-nowrap max-[1700px]:py-0.5 max-[1700px]:leading-[1.15] max-[1250px]:px-0.5 max-[1250px]:text-[10.5px] short:h-[26px]";
const td =
  "h-7 overflow-hidden text-ellipsis whitespace-nowrap border-r border-b border-[#e8eef7] px-1.5 text-[12px] text-[#1f2937] last:border-r-0 group-even:bg-[#f7faff] group-hover:bg-[#e9f3ff] max-[1400px]:px-1 short:h-[25px]";
const smallButton = "h-7 whitespace-nowrap rounded-lg py-0 text-[12.5px]";

// Dashed "+" like the AddButton beside a select, at row size.
function AddMini(props) {
  return (
    <button
      type="button"
      className="flex size-[22px] flex-none cursor-pointer items-center justify-center rounded-[7px] border-[1.5px] border-dashed border-[#7fb2ff] bg-[rgba(232,242,255,0.7)] text-[#2563eb] transition-colors hover:border-solid hover:bg-[#d6e8ff] disabled:pointer-events-none disabled:opacity-50"
      {...props}
    >
      <Plus className="size-[13px]" strokeWidth={2.4} />
    </button>
  );
}

// "Date 2026-10-08 ·": what was captured, one chip per value, a dot between them.
function InfoChip({ label, value }) {
  return (
    <span className="whitespace-nowrap text-[12px] text-dash-sub max-[1400px]:text-[11.5px] not-last:after:ml-2.5 not-last:after:text-[#b6c2d6] not-last:after:content-['·']">
      {label}
      <b className={cn("ml-[5px]", value ? "font-extrabold text-brand-navy" : "font-semibold text-dash-faint")}>{value || "-"}</b>
    </span>
  );
}

/**
 * Data Capture Summary: opened by Submit on Data Capture. Title + what was captured on one row, the Rate bar, then one
 * card holding the grid, all inside the frosted frame the form modals use. UI only for now: the rows are mock data, and
 * Submit, Refresh and the + / pen in Account and Formula (Add / Edit Formula dialog) are not wired up yet.
 */
export default function DataCaptureSummaryPage() {
  const navigate = useNavigate();
  // What Data Capture was submitted with; opened directly (no state) it shows an example.
  const info = useLocation().state ?? { date: "2026-10-08", process: "SALARY", description: "", currency: "MYR", remark: "" };
  const readOnly = Boolean(useCurrentUser()?.readOnly);
  const [rows, setRows] = useState(MOCK_SUMMARY);
  const [rate, setRate] = useState("");
  const [formula, setFormula] = useState(null); // { key, mode } of the row whose Add / Edit Formula is open

  const patch = (key, changes) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...changes } : r)));
  const total = useMemo(() => rows.filter((r) => !r.skip).reduce((sum, r) => sum + rowAmount(r), 0), [rows]);
  const delCount = rows.filter((r) => r.del).length;
  const allRate = rows.length > 0 && rows.every((r) => r.rate);
  const rateOk = parseRate(rate) !== null;

  return (
    <div className="h-full min-h-[520px] p-[clamp(8px,1.6dvh,16px)]">
      <div className="flex h-full min-h-[480px] flex-col gap-[clamp(6px,1.3dvh,10px)] overflow-hidden rounded-[22px] border border-white/55 bg-modal-bg px-[clamp(12px,1.8vw,24px)] py-[clamp(10px,2dvh,18px)] shadow-[0_20px_50px_-30px_rgba(20,51,107,0.45)] backdrop-blur-[22px] backdrop-saturate-[1.15]">
        <div className="flex flex-none flex-wrap items-center gap-x-2.5 gap-y-1">
          <h1 className="m-0 mr-2 flex items-center gap-2 whitespace-nowrap text-[clamp(16px,2.2dvh,18px)] font-extrabold text-brand-navy">
            <span className="h-4 w-1 rounded-sm bg-[linear-gradient(180deg,#3fc4ff,#0a3fc9)]" />
            Data Capture Summary
          </h1>
          <InfoChip label="Date" value={info.date} />
          <InfoChip label="Process" value={info.process} />
          <InfoChip label="Description" value={info.description} />
          <InfoChip label="Currency" value={info.currency} />
          <InfoChip label="Remark" value={info.remark} />
        </div>

        <div className="flex flex-none items-center gap-2 rounded-[10px] border border-white/80 bg-white/55 px-2.5 py-1.5 short:py-1">
          <span className="text-[13px] font-extrabold text-brand-navy">Rate</span>
          <input
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="e.g. *3 or /3"
            autoComplete="off"
            className="h-7 w-[150px] rounded-lg border border-modal-input-line bg-modal-input px-2.5 text-[12.5px] text-[#111827] outline-none focus:border-[#3b82f6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
          />
          <PrimaryButton className={smallButton} disabled={readOnly || rows.length === 0} onClick={() => setRows((rs) => rs.map((r) => ({ ...r, rate: !allRate })))}>
            Select All
          </PrimaryButton>
          <PrimaryButton className={smallButton} disabled={readOnly || !rateOk} onClick={() => setRows((rs) => rs.map((r) => (r.rate ? { ...r, rateValue: rate.trim() } : r)))}>
            Submit
          </PrimaryButton>
          <div className="ml-auto flex flex-none items-center gap-2">
            <button
              type="button"
              aria-label="Refresh"
              title="Refresh"
              onClick={() => setRows(MOCK_SUMMARY)}
              className="flex size-7 cursor-pointer items-center justify-center rounded-lg border border-white/80 bg-white/55 text-brand-navy hover:bg-white/75"
            >
              <RefreshCw className="size-[13px]" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              disabled={readOnly || delCount === 0}
              onClick={() => setRows((rs) => rs.filter((r) => !r.del))}
              className="inline-flex h-7 flex-none items-center gap-1.5 whitespace-nowrap rounded-lg px-4 text-[12.5px] font-bold text-white transition-colors enabled:cursor-pointer enabled:bg-[linear-gradient(180deg,#ff8a8a_0%,#ef4444_100%)] enabled:shadow-[0_6px_14px_-6px_rgba(239,68,68,0.6)] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Trash2 className="size-[13px]" strokeWidth={2.2} />
              Delete ({delCount})
            </button>
          </div>
        </div>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/85 bg-white/80 shadow-[0_8px_22px_-16px_rgba(20,51,107,0.5)]">
          <div className="min-h-0 flex-initial overflow-x-hidden overflow-y-auto [scrollbar-color:#c3cedf_transparent] [scrollbar-width:thin]">
            <table className="w-full table-fixed border-separate border-spacing-0 text-[12px]">
              <colgroup>
                {COLS.map(([name, w]) => (
                  <col key={name} style={w ? { width: `${w}%` } : undefined} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {COLS.map(([name]) => (
                    <th key={name} className={th}>
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const amt = rowAmount(r);
                  return (
                    <tr key={r.key} className={cn("group", r.skip && "opacity-45")}>
                      <td className={cn(td, "font-extrabold")}>{r.id}</td>
                      <td className={td}>
                        <div className="flex items-center gap-1.5">
                          <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-[#475569] max-[1400px]:text-[11px]">{r.acc}</span>
                          <AddMini aria-label="Add formula" title="Add formula" disabled={readOnly} onClick={() => setFormula({ key: r.key, mode: "add" })} />
                        </div>
                      </td>
                      <td className={cn(td, "text-center")}>
                        <span className="inline-block rounded-full border border-[#bfd8ff] bg-[#eaf4ff] px-[7px] text-[10.5px] font-extrabold text-[#1d4ed8]">{r.cur}</span>
                      </td>
                      <td className={td}>
                        <div className="flex items-center gap-1.5">
                          <code className="min-w-0 flex-1 truncate font-[inherit] font-bold text-[#334155]">{r.f}</code>
                          <IconAction className="flex-none" aria-label="Edit formula" title="Edit formula" disabled={readOnly} onClick={() => setFormula({ key: r.key, mode: "edit" })} />
                        </div>
                      </td>
                      <td className={cn(td, "text-center")}>{r.src}</td>
                      <td className={cn(td, "text-center")}>
                        <SelectBox checked={r.rate} onChange={(on) => patch(r.key, { rate: on, rateValue: on ? r.rateValue : "" })} label="Apply rate" disabled={readOnly} />
                      </td>
                      <td className={cn(td, "text-right tabular-nums")}>{r.rateValue}</td>
                      <td className={cn(td, "text-right font-extrabold tabular-nums", amt < 0 ? "text-[#dc2626]" : "text-[#1d4ed8]")}>{fmt(amt)}</td>
                      <td className={cn(td, "text-center")}>
                        <SelectBox checked={r.skip} onChange={(skip) => patch(r.key, { skip })} label="Skip" disabled={readOnly} />
                      </td>
                      <td className={cn(td, "text-center")}>
                        <SelectBox checked={r.del} onChange={(del) => patch(r.key, { del })} label="Delete" disabled={readOnly} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="text-[12px] font-extrabold text-brand-navy">
                  <td colSpan={7} className="sticky bottom-0 z-[2] h-[30px] border-t border-[#bcd0ec] bg-[#dfeafb] px-1.5 text-right short:h-[27px]">
                    Total
                  </td>
                  <td className="sticky bottom-0 z-[2] h-[30px] border-t border-[#bcd0ec] bg-[#dfeafb] px-1.5 text-right tabular-nums short:h-[27px]">{fmt(total)}</td>
                  <td colSpan={2} className="sticky bottom-0 z-[2] h-[30px] border-t border-[#bcd0ec] bg-[#dfeafb] short:h-[27px]" />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <div className="flex flex-none items-center gap-2">
          <PrimaryButton className={smallButton} disabled={readOnly} title={readOnly ? "Read-only login" : undefined}>
            Submit
          </PrimaryButton>
          <button
            type="button"
            onClick={() => navigate("/data-capture")}
            className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-white/80 bg-white/55 px-4 text-[12.5px] font-bold text-brand-navy hover:bg-white/75"
          >
            Back
          </button>
        </div>
      </div>

      {formula && (
        <FormulaDialog
          mode={formula.mode}
          row={rows.find((r) => r.key === formula.key)}
          onClose={() => setFormula(null)}
          onSave={({ value, ...draft }) => {
            // The row keeps its sign (a debit stays a debit); the formula gives its size.
            patch(formula.key, { ...draft, ...(value === null ? {} : { base: (rows.find((r) => r.key === formula.key).base < 0 ? -1 : 1) * Math.abs(value) }) });
            setFormula(null);
          }}
        />
      )}
    </div>
  );
}
