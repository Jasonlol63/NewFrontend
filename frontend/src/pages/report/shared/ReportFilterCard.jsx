import { cn } from "@/lib/utils";
import SegmentGroup from "@/components/shared/SegmentGroup.jsx";
import FilterRow from "@/components/shared/FilterRow.jsx";

// A control with its label in front, for the first row of the card. On a narrow screen the
// control drops under its label instead of squeezing.
export function Field({ label, children }) {
  return (
    <div className="flex max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="flex-none text-[13px] font-bold text-[#1f2937]">{label}</span>
      {children}
    </div>
  );
}

/**
 * Top card of a Report page: the page's own controls on the first row (`children`), then the
 * Group / Company pickers (from useListScope) and any `extraRows` (Currency).
 */
export default function ReportFilterCard({ scope, children, extraRows }) {
  return (
    <section
      className={cn(
        "flex-none rounded-xl border border-dash-line bg-white shadow-dash-filter transition-opacity",
        scope.loading && "opacity-60"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-2.5 short:pt-2">{children}</div>

      <div className="flex flex-col gap-2 px-4 pt-2 pb-2.5 short:gap-1.5 short:pt-1.5 short:pb-2">
        {scope.showGroups && (
          <FilterRow label="Group ID:">
            <SegmentGroup
              options={scope.groupOptions}
              value={scope.group}
              onChange={scope.onGroupChange}
              allowDeselect={scope.allowNoGroup}
            />
          </FilterRow>
        )}
        {/* A Group with no companies has nothing to pick, so the Company row is hidden. */}
        {scope.companyOptions.length > 0 && (
          <FilterRow label="Company:">
            <SegmentGroup
              options={scope.companyOptions}
              value={scope.company}
              onChange={scope.onCompanyChange}
              allowDeselect={scope.allowNoCompany}
            />
          </FilterRow>
        )}
        {extraRows}
      </div>
    </section>
  );
}
