import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import DateRangePicker from "@/components/shared/DateRangePicker.jsx";
import MultiSelectField from "@/components/shared/form-modal/MultiSelectField.jsx";
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
            "flex-none cursor-pointer border-r border-dash-line px-2.5 py-1 type-table-cell @min-[770px]:px-3.5 @min-[770px]:py-1.5 @min-[770px]:type-body font-semibold! whitespace-nowrap transition-colors last:border-r-0",
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
    // The label is as high as one line of chips and sits at the top, so a Currency list that wraps keeps its label beside the
    // first line instead of floating in the middle of two.
    <div className="flex min-w-0 items-start gap-2">
      <span className="flex h-7 w-[60px] flex-none items-center whitespace-nowrap type-table-cell font-semibold! text-[#1f2937] @min-[770px]:h-[34px] @min-[770px]:w-[80px] @min-[770px]:type-label">{label}</span>
      <div className={cn("min-w-0", grow && "flex-1")}>{children}</div>
    </div>
  );
}

// Flat grey pill like FilterChip (Admin / Account): the round dot fills with a blue tick and sits at the left edge, the label
// is centred in the rest. The four pills are always one row (26px high; 32px beside the date box on a wide card): each is as wide as its label needs plus an equal share of the
// spare room, so they fill the row and never wrap, overlap or cut a label.
function Pill({ label, checked, onChange }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[26px] flex-auto @min-[770px]:h-8 cursor-pointer items-center justify-center rounded-full border bg-[#f8fafc] pr-2.5 pl-[26px] @max-[510px]:pr-1.5 @max-[510px]:pl-6 type-table-cell whitespace-nowrap transition-[border-color,box-shadow,color]",
        checked
          ? "border-[rgba(13,96,255,0.45)] font-semibold! text-[#0d60ff] shadow-[0_2px_6px_rgba(13,96,255,0.12)]"
          : "border-dash-line font-semibold text-[#475569] shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:border-[#cbd5e1] hover:shadow-[0_2px_4px_rgba(15,23,42,0.08)]"
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 left-1 flex size-[18px] -translate-y-1/2 items-center justify-center rounded-full text-white transition-colors",
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
export default function FilterCard({ filters, onChange, scope, currency }) {
  const { t } = useTranslation(["transaction", "common", "account"]);
  const { categories, range, pills } = filters;
  // Wide card (the 770px layout of the top block): the picked categories are chips on as many lines as they need; on a narrow
  // card they stay on one line and the ones that do not fit collapse into "+N".
  const cardRef = useRef(null);
  const [wideCard, setWideCard] = useState(false);
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return undefined;
    const update = () => setWideCard(card.clientWidth >= 770);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(card);
    return () => observer.disconnect();
  }, []);
  const categoryItems = useMemo(() => CATEGORY_ITEMS.map((c) => ({ value: c.value, label: t(`account:role.${c.value}`, { defaultValue: c.label }) })), [t]);
  return (
    <section ref={cardRef} className={cn("@container flex min-h-0 min-w-0 flex-col gap-2.5 rounded-xl border border-dash-line bg-white px-4 py-2 shadow-dash-filter transition-opacity", scope.loading && "opacity-60")}>
      {/* Top block. Narrow card: Category and Capture Date side by side, the four chips as one full row under them. Wide card
          (770px+): Category takes the whole row, then the Capture Date box (at most 290px) and the four chips share a row.
          The chips are always one row, 32px high like the date box. */}
      <div className="grid grid-cols-[minmax(0,1fr)_clamp(236px,15.5vw,290px)] items-end gap-x-2.5 gap-y-2.5 @min-[770px]:grid-cols-[minmax(0,290px)_minmax(0,1fr)]">
        <div className="min-w-0 @min-[770px]:col-span-2">
          <span className={cn(LABEL, "mb-0.5 ml-0.5 block")}>{t("filter.category")}</span>
          <MultiSelectField
            items={categoryItems}
            selected={categories}
            onChange={(v) => onChange({ categories: v })}
            placeholder={t("filter.categoryAll")}
            searchPlaceholder={t("filter.categorySearch")}
            wrap={wideCard}
            className="min-h-8! rounded-lg! py-[3px]! type-table-cell! font-semibold!"
          />
        </div>
        <div className="min-w-0 @min-[770px]:row-start-2">
          <span className={cn(LABEL, "mb-0.5 ml-0.5 block")}>{t("filter.captureDate")}</span>
          <DateRangePicker
            small
            align="start"
            from={range.from}
            to={range.to}
            onChange={(r) => onChange({ range: r })}
            className="h-8! w-full! rounded-lg! type-table-cell! font-semibold! [&>span:nth-child(2)]:px-1.5! [&>span:nth-child(2)]:whitespace-nowrap [&>span:nth-child(3)]:pr-2!"
          />
        </div>
        <div className="col-span-2 flex min-w-0 gap-1.5 @min-[770px]:col-span-1 @min-[770px]:row-start-2">
          {PILLS.map(({ key }) => (
            <Pill key={key} label={t(`pills.${key}`)} checked={Boolean(pills[key])} onChange={(v) => onChange({ pills: { ...pills, [key]: v } })} />
          ))}
        </div>
      </div>

      {/* The divider sits right under the top block. A Group row (when there is one) goes under it; the spare height of the
          card is the gap below, so Company and Currency stay at the bottom. No Group: that gap is just empty. */}
      <div className="h-px bg-[rgba(130,155,195,0.3)]" />
      {scope.showGroups && (
        <Row label={t("common:list.group")}>
          <Seg options={scope.groupOptions} value={scope.group} onChange={scope.onGroupChange} allowDeselect={scope.allowNoGroup} />
        </Row>
      )}

      <div className="mt-auto flex flex-col gap-3 @min-[770px]:gap-2">
      {scope.companyOptions.length > 0 && (
        <Row label={t("common:list.company")}>
          <Seg options={scope.companyOptions} value={scope.company} onChange={scope.onCompanyChange} allowDeselect={scope.allowNoCompany} />
        </Row>
      )}
      <Row label={t("filter.currency")} grow>
        {currency.options.length ? (
          <SegmentGroup
            wrap
            className="gap-y-1.5"
            itemClassName="px-[9px] py-1 type-table-cell @min-[770px]:px-3.5 @min-[770px]:py-1.5 @min-[770px]:type-body"
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
    </section>
  );
}
