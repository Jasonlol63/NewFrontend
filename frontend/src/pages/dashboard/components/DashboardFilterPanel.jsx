import { cn } from "@/lib/utils";
import SegmentGroup from "@/components/shared/SegmentGroup.jsx";
import DateRangePicker from "@/components/shared/DateRangePicker.jsx";

function FilterRow({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[84px] flex-none text-[13px] font-bold text-[#1f2937]">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export default function DashboardFilterPanel({
  dateRange,
  onDateRangeChange,
  groupOptions,
  group,
  onGroupChange,
  allowNoGroup,
  showCompany,
  companyOptions,
  company,
  onCompanyChange,
  allowNoCompany,
  currencyOptions,
  currency,
  onCurrencyChange,
  onCurrencyReorder,
  loading,
}) {
  return (
    <section
      className={cn(
        "flex-none rounded-xl border border-dash-line bg-white shadow-dash-filter transition-opacity",
        loading && "opacity-60"
      )}
    >
      <div className="flex flex-col gap-2 px-4 py-2.5">
        <FilterRow label="Date Range:">
          <DateRangePicker from={dateRange.from} to={dateRange.to} onChange={onDateRangeChange} />
        </FilterRow>
        {groupOptions.length > 1 && (
          <FilterRow label="Group ID:">
            <SegmentGroup options={groupOptions} value={group} onChange={onGroupChange} allowDeselect={allowNoGroup} />
          </FilterRow>
        )}
        {showCompany && (
          <FilterRow label="Company:">
            <SegmentGroup
              options={companyOptions}
              value={company}
              onChange={onCompanyChange}
              allowDeselect={allowNoCompany}
            />
          </FilterRow>
        )}
        <FilterRow label="Currency:">
          {currencyOptions.length ? (
            <SegmentGroup
              options={currencyOptions}
              value={currency}
              onChange={onCurrencyChange}
              onReorder={onCurrencyReorder}
            />
          ) : (
            <span className="text-xs font-medium text-dash-faint">No currency available</span>
          )}
        </FilterRow>
      </div>
    </section>
  );
}
