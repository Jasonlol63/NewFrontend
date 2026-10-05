import { Building2, Search, Users } from "lucide-react";
import DateRangePicker from "@/components/shared/DateRangePicker.jsx";
import SlideTabs from "@/components/shared/SlideTabs.jsx";
import { Field } from "@/pages/report/shared/ReportFilterCard.jsx";
import StatusFilter from "./StatusFilter.jsx";

/**
 * Top card of the Auto Renew page. First line: Company / Group tabs, Date Range and search;
 * second line (under a divider): the Status filter with the number of rows behind each status.
 */
export default function AutoRenewFilterCard({
  tab,
  onTabChange,
  tabCounts,
  range,
  onRangeChange,
  search,
  onSearchChange,
  status,
  onStatusChange,
  statusCounts,
}) {
  return (
    <section className="flex-none rounded-xl border border-dash-line bg-white shadow-dash-filter">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3 short:pt-2">
        <SlideTabs
          value={tab}
          onChange={onTabChange}
          options={[
            { value: "company", label: "Company", icon: Building2, count: tabCounts.company },
            { value: "group", label: "Group", icon: Users, count: tabCounts.group },
          ]}
        />

        <Field label="Date Range:">
          <DateRangePicker from={range.from} to={range.to} onChange={onRangeChange} />
        </Field>

        <label className="flex h-9 w-[200px] min-w-0 items-center gap-2 rounded-[10px] border border-dash-line bg-white px-3 text-[13px] shadow-[0_1px_3px_rgba(15,23,42,0.05)] focus-within:border-[#3b82f6]">
          <Search className="size-4 flex-none text-dash-faint" strokeWidth={2.2} />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            // Typed letters show in capitals (the match ignores case anyway); the hint stays as written.
            className="w-full bg-transparent uppercase outline-none placeholder:text-dash-faint placeholder:normal-case"
            placeholder="Search Company, Name"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-dash-line px-4 py-2.5 short:mt-2 short:py-2">
        <span className="flex-none text-[13px] font-bold text-[#1f2937]">Status:</span>
        <StatusFilter value={status} onChange={onStatusChange} counts={statusCounts} />
      </div>
    </section>
  );
}
