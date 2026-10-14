import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import SegmentGroup from "@/components/shared/SegmentGroup.jsx";
import DateRangePicker from "@/components/shared/DateRangePicker.jsx";
import FilterRow from "@/components/shared/FilterRow.jsx";

export default function DashboardFilterPanel({
  dateRange,
  onDateRangeChange,
  showGroup,
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
  const { t } = useTranslation("dashboard");
  return (
    <section
      className={cn(
        "flex-none rounded-xl border border-dash-line bg-white shadow-dash-filter transition-opacity",
        loading && "opacity-60"
      )}
    >
      <div className="flex flex-col gap-2 px-4 py-2.5">
        <FilterRow label={t("filter.dateRange")}>
          <DateRangePicker from={dateRange.from} to={dateRange.to} onChange={onDateRangeChange} />
        </FilterRow>
        {showGroup && (
          <FilterRow label={t("filter.group")}>
            <SegmentGroup options={groupOptions} value={group} onChange={onGroupChange} allowDeselect={allowNoGroup} />
          </FilterRow>
        )}
        {showCompany && (
          <FilterRow label={t("filter.company")}>
            <SegmentGroup
              options={companyOptions}
              value={company}
              onChange={onCompanyChange}
              allowDeselect={allowNoCompany}
            />
          </FilterRow>
        )}
        <FilterRow label={t("filter.currency")}>
          {currencyOptions.length ? (
            <SegmentGroup
              options={currencyOptions}
              value={currency}
              onChange={onCurrencyChange}
              wrap onReorder={onCurrencyReorder}
            />
          ) : (
            <span className="text-caption font-medium text-dash-faint">{t("filter.noCurrency")}</span>
          )}
        </FilterRow>
      </div>
    </section>
  );
}
