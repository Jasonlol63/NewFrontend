import { Search } from "lucide-react";
import DateRangePicker from "@/components/shared/DateRangePicker.jsx";
import DropdownSelect from "@/components/shared/DropdownSelect.jsx";
import ReportFilterCard, { Field } from "@/pages/report/shared/ReportFilterCard.jsx";

/**
 * Top card of a Maintenance page: Process (or the page's own `field`), search and Date Range on the
 * first row (`actions`, e.g. the Delete button, at its right end), then the Group / Company pickers.
 * `filters` is the result of useMaintenanceFilters or useCurrencyFilters (anything with scope, search,
 * setSearch, range and setRange; the Process dropdown shows when it also has processChoices).
 * With no `range` the Date Range is left out; `extraRows` go under Company (Currency).
 */
export default function MaintenanceFilterCard({ filters, searchPlaceholder, actions, field, extraRows }) {
  const { scope, isGroupOwn, processChoices, processId, range } = filters;

  const first =
    field ??
    (processChoices && (
      <Field label="Process:">
        <DropdownSelect
          options={processChoices}
          value={processId}
          onChange={filters.setProcessPick}
          placeholder="Select process"
          searchable={!isGroupOwn}
          searchPlaceholder="Search process"
          ariaLabel="Process"
        />
      </Field>
    ));

  const dates = range && (
    <Field label="Date Range:">
      <DateRangePicker from={range.from} to={range.to} onChange={filters.setRange} />
    </Field>
  );

  const search = (
    <label className="flex h-9 w-full max-w-[260px] min-w-[180px] flex-1 items-center gap-2 rounded-[10px] border border-dash-line bg-white px-3 text-[13px] shadow-[0_1px_3px_rgba(15,23,42,0.05)] focus-within:border-[#3b82f6]">
      <Search className="size-4 flex-none text-dash-faint" strokeWidth={2.2} />
      <input
        value={filters.search}
        onChange={(e) => filters.setSearch(e.target.value)}
        className="w-full bg-transparent outline-none placeholder:text-dash-faint"
        placeholder={searchPlaceholder}
      />
    </label>
  );

  return (
    <ReportFilterCard scope={scope} extraRows={extraRows}>
      {first}
      {/* With no field of its own in front, the Date Range leads and the search follows (as in the old pages). */}
      {first ? search : dates}
      {first ? dates : search}
      {actions && <div className="ml-auto flex-none">{actions}</div>}
    </ReportFilterCard>
  );
}
