import { useTranslation } from "react-i18next";
import FilterRow from "@/components/shared/FilterRow.jsx";
import SegmentGroup from "@/components/shared/SegmentGroup.jsx";

/** Currency row of a Maintenance filter card: "All" first, the currencies after it can be dragged. `filters` is useCurrencyFilters. */
export default function CurrencyFilterRow({ filters }) {
  const { t } = useTranslation("maintenance");
  return (
    <FilterRow label={t("filter.currency")}>
      {filters.currencyCodes.length ? (
        <SegmentGroup
          leading={[{ value: "ALL", label: t("filter.all") }]}
          options={filters.currencyOptions}
          value={filters.currency}
          onChange={filters.setCurrency}
          wrap onReorder={filters.setCurrencyOrder}
        />
      ) : (
        <span className="text-xs font-medium text-dash-faint">{t("filter.noCurrency")}</span>
      )}
    </FilterRow>
  );
}
