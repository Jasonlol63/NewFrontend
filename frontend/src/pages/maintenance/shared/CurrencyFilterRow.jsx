import FilterRow from "@/components/shared/FilterRow.jsx";
import SegmentGroup from "@/components/shared/SegmentGroup.jsx";

const ALL_CURRENCIES = [{ value: "ALL", label: "All" }];

/** Currency row of a Maintenance filter card: "All" first, the currencies after it can be dragged. `filters` is useCurrencyFilters. */
export default function CurrencyFilterRow({ filters }) {
  return (
    <FilterRow label="Currency:">
      {filters.currencyCodes.length ? (
        <SegmentGroup
          leading={ALL_CURRENCIES}
          options={filters.currencyOptions}
          value={filters.currency}
          onChange={filters.setCurrency}
          wrap onReorder={filters.setCurrencyOrder}
        />
      ) : (
        <span className="text-xs font-medium text-dash-faint">No currency available</span>
      )}
    </FilterRow>
  );
}
