import { Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import SegmentGroup from "@/components/shared/SegmentGroup.jsx";
import FilterRow from "@/components/shared/FilterRow.jsx";
import FilterChip from "./FilterChip.jsx";

const buttonBase =
  "inline-flex flex-none items-center gap-1.5 rounded-[10px] px-4 py-2 text-[13px] font-bold text-white transition-colors";

// Blue gradient: the page's main action (Add User, Add Account).
export function PrimaryButton({ icon: Icon, children, className, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        buttonBase,
        "bg-seg-active shadow-[0_6px_14px_-6px_rgba(13,96,255,0.6)] enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    >
      {Icon && <Icon className="size-4" strokeWidth={2.4} />}
      {children}
    </button>
  );
}

// Slate: secondary settings actions (Currency Setting).
export function SecondaryButton({ icon: Icon, children, className, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        buttonBase,
        "bg-[linear-gradient(180deg,#94a3b8_0%,#64748b_100%)] shadow-[0_6px_14px_-6px_rgba(71,85,105,0.6)] enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    >
      {Icon && <Icon className="size-4" strokeWidth={2.2} />}
      {children}
    </button>
  );
}

export function DeleteButton({ count, ...props }) {
  return (
    <button
      type="button"
      disabled={count === 0}
      className={cn(
        buttonBase,
        "enabled:cursor-pointer enabled:bg-[linear-gradient(180deg,#ff8a8a_0%,#ef4444_100%)] enabled:shadow-[0_6px_14px_-6px_rgba(239,68,68,0.6)] disabled:bg-slate-300"
      )}
      {...props}
    >
      <Trash2 className="size-4" strokeWidth={2.2} />
      Delete ({count})
    </button>
  );
}

/**
 * Top card of a list page: main action, search, Show All / Active / Inactive chips and
 * right-hand actions on the first row; Group / Company pickers (from useListScope) below.
 */
export default function ListToolbar({
  primaryAction,
  actions,
  searchPlaceholder,
  search,
  onSearchChange,
  chips,
  onChipChange,
  scope,
}) {
  return (
    <section
      className={cn(
        "flex-none rounded-xl border border-dash-line bg-white shadow-dash-filter transition-opacity",
        scope.loading && "opacity-60"
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5 px-4 pt-2.5 short:pt-2">
        {primaryAction}

        <label className="flex h-9 w-full max-w-[260px] min-w-[180px] flex-1 items-center gap-2 rounded-[10px] border border-dash-line bg-white px-3 text-[13px] shadow-[0_1px_3px_rgba(15,23,42,0.05)] focus-within:border-[#3b82f6]">
          <Search className="size-4 flex-none text-dash-faint" strokeWidth={2.2} />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-transparent outline-none placeholder:text-dash-faint"
            placeholder={searchPlaceholder}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip label="Show All" checked={chips.showAll} onChange={(v) => onChipChange("showAll", v)} />
          <FilterChip label="Show Active" checked={chips.showActive} onChange={(v) => onChipChange("showActive", v)} />
          <FilterChip label="Show Inactive" checked={chips.showInactive} onChange={(v) => onChipChange("showInactive", v)} />
        </div>

        <div className="ml-auto flex flex-none items-center gap-2.5">{actions}</div>
      </div>

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
      </div>
    </section>
  );
}
