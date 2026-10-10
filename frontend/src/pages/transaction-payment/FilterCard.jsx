import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import DateRangePicker from "@/components/shared/DateRangePicker.jsx";
import MultiSelectField from "@/components/shared/form-modal/MultiSelectField.jsx";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import SegmentGroup from "@/components/shared/SegmentGroup.jsx";
import { LABEL } from "./fields.jsx";
import { CATEGORY_ITEMS, PILLS } from "./transactionPaymentRules";

// Joined row of text chips (Group ID / Company), single choice. With allowDeselect, clicking the active chip again
// sends null (the Group's own data / the independent companies), like the other pages.
function Seg({ options, value, onChange, allowDeselect }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-[10px] border border-dash-line bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      {options.map(({ value: v, label }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(allowDeselect && v === value ? null : v)}
          className={cn(
            "flex-none cursor-pointer border-r border-dash-line px-3 py-1 text-[12.5px] font-semibold whitespace-nowrap transition-colors last:border-r-0",
            v === value ? "bg-seg-active text-white" : "bg-white text-[#1f2937] hover:bg-slate-50"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, grow, children }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-[76px] flex-none text-[13px] font-extrabold text-[#1f2937]">{label}</span>
      <div className={cn("min-w-0", grow && "flex-1")}>{children}</div>
    </div>
  );
}

// Same look as FilterChip (Admin / Account): grey pill, round dot that fills with a blue tick. The four chips share
// the row and shrink with the card: below 560px the dot gets smaller, below 430px it goes.
function Pill({ label, checked, onChange }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex h-[30px] min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border bg-[#f8fafc] pr-3 pl-[5px] text-[12.5px] whitespace-nowrap transition-[border-color,box-shadow,color] @max-[560px]:gap-1.5 @max-[560px]:pr-[9px] @max-[560px]:pl-1 @max-[560px]:text-[12px] @max-[430px]:px-2 @max-[430px]:text-[11.5px]",
        checked
          ? "border-[rgba(13,96,255,0.45)] font-semibold text-[#0d60ff] shadow-[0_2px_6px_rgba(13,96,255,0.12)]"
          : "border-dash-line font-medium text-[#475569] shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:border-[#cbd5e1] hover:shadow-[0_2px_4px_rgba(15,23,42,0.08)]"
      )}
    >
      <span
        className={cn(
          "flex size-5 flex-none items-center justify-center rounded-full text-white transition-colors @max-[560px]:size-[18px] @max-[430px]:hidden",
          checked ? "bg-seg-active" : "bg-[#e2e8f0]"
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3.5} />}
      </span>
      {label}
    </button>
  );
}

/** Left top card: Category + Capture Date, the Show toggles, then Group ID / Company / Currency. */
export default function FilterCard({ filters, onChange, currency }) {
  const { categories, range, pills, group, company } = filters;
  const wide = useMediaQuery("(min-width: 1700px)");
  return (
    <section className={cn("@container flex min-h-0 min-w-0 flex-col justify-between gap-[5px] rounded-xl border border-dash-line bg-white px-4 py-2 shadow-dash-filter transition-opacity", scope.loading && "opacity-60")}>
      {/* Category and Capture Date always share one row. Big screens: the 330px date box with the preset column; below
          1700px the date box and its popup shrink (same layout, smaller). */}
      <div className="flex items-end gap-2.5">
        <div className="min-w-0 flex-1">
          <span className={cn(LABEL, "mb-0.5 ml-0.5 block")}>Category</span>
          <MultiSelectField
            items={CATEGORY_ITEMS}
            selected={categories}
            onChange={(v) => onChange({ categories: v })}
            placeholder="--Select All--"
            searchPlaceholder="Search role"
            className="min-h-[30px]! rounded-lg! py-0.5!"
          />
        </div>
        <div className={cn("flex-none", wide ? "w-[330px]" : "w-[clamp(236px,15.5vw,290px)]")}>
          <span className={cn(LABEL, "mb-0.5 ml-0.5 block")}>Capture Date</span>
          <DateRangePicker
            small={!wide}
            align="end"
            from={range.from}
            to={range.to}
            onChange={(r) => onChange({ range: r })}
            className={cn("h-[30px]! w-full! rounded-lg! [&>span:nth-child(2)]:whitespace-nowrap", !wide && "[&>span:nth-child(2)]:px-2! [&>span:nth-child(2)]:text-[12px]")}
          />
        </div>
      </div>

      <div className="flex gap-2">
        {PILLS.map(({ key, label }) => (
          <Pill key={key} label={label} checked={Boolean(pills[key])} onChange={(v) => onChange({ pills: { ...pills, [key]: v } })} />
        ))}
      </div>
      <div className="my-0.5 h-px bg-[rgba(130,155,195,0.3)]" />

      {scope.showGroups && (
        <Row label="Group ID:">
          <Seg options={scope.groupOptions} value={scope.group} onChange={scope.onGroupChange} allowDeselect={scope.allowNoGroup} />
        </Row>
      )}
      {scope.companyOptions.length > 0 && (
        <Row label="Company:">
          <Seg options={scope.companyOptions} value={scope.company} onChange={scope.onCompanyChange} allowDeselect={scope.allowNoCompany} />
        </Row>
      )}
      <Row label="Currency:" grow>
        {currency.options.length ? (
          <SegmentGroup
            wrap
            itemClassName="px-[11px] py-1"
            leading={currency.options.length > 1 ? [{ value: "ALL", label: "ALL" }] : []}
            options={currency.options}
            value={currency.allOn ? ["ALL", ...currency.selected] : currency.selected}
            onChange={(v) => (v === "ALL" ? currency.onAll() : currency.onToggle(v))}
            onReorder={currency.onReorder}
          />
        ) : (
          <span className="text-xs font-medium text-dash-faint">No currency available</span>
        )}
      </Row>
    </section>
  );
}
