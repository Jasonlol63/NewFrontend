import { List, Plus, Search, SquarePen, Trash2, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import DateRangePicker from "@/components/shared/DateRangePicker.jsx";
import DropdownSelect from "@/components/shared/DropdownSelect.jsx";
import { Field } from "@/pages/report/shared/ReportFilterCard.jsx";

// Type tiles: same anatomy as the Auto Renew status tiles (icon tile, label, count).
const TILES = [
  {
    value: "all",
    icon: List,
    tile: "bg-[#d9f4fa] text-[#0b86a3]",
    tileOn: "bg-[#0aa5c8] text-white",
    hover: "hover:border-[#0aa5c8]",
    on: "border-[#0aa5c8] shadow-[0_5px_12px_-6px_#0aa5c8,inset_0_0_0_1px_#0aa5c8]",
  },
  {
    value: "CREATE",
    icon: Plus,
    tile: "bg-[#dcfce7] text-[#16a34a]",
    tileOn: "bg-[#22c55e] text-white",
    hover: "hover:border-[#22c55e]",
    on: "border-[#22c55e] shadow-[0_5px_12px_-6px_#22c55e,inset_0_0_0_1px_#22c55e]",
  },
  {
    value: "UPDATE",
    icon: SquarePen,
    tile: "bg-[#dfeaff] text-[#0a3fc9]",
    tileOn: "bg-brand-sweep text-white",
    hover: "hover:border-[#1f6fe8]",
    on: "border-[#1f6fe8] shadow-[0_5px_12px_-6px_#1f6fe8,inset_0_0_0_1px_#1f6fe8]",
  },
  {
    value: "DELETE",
    icon: Trash2,
    tile: "bg-[#ffe4ea] text-[#c8304f]",
    tileOn: "bg-[#f0506e] text-white",
    hover: "hover:border-[#f0506e]",
    on: "border-[#f0506e] shadow-[0_5px_12px_-6px_#f0506e,inset_0_0_0_1px_#f0506e]",
  },
];

/**
 * Top card of the Audit Log page. First line: Date, Company, Module and search; second line (under a divider): the
 * action filter with the number of rows behind each action, and the count of rows that can still be restored.
 */
export default function AuditFilterCard({
  range,
  onRangeChange,
  company,
  onCompanyChange,
  companies,
  module,
  onModuleChange,
  modules,
  search,
  onSearchChange,
  action,
  onActionChange,
  counts,
}) {
  const { t } = useTranslation("auditlog");
  const total = counts.create + counts.update + counts.delete;
  const countOf = { all: total, CREATE: counts.create, UPDATE: counts.update, DELETE: counts.delete };
  const companyOptions = [{ value: "", label: t("filter.allCompanies") }, ...companies.map((c) => ({ value: c, label: c }))];
  const moduleOptions = [{ value: "", label: t("filter.allModules") }, ...modules.map((m) => ({ value: m, label: m }))];

  return (
    <section className="flex-none rounded-xl border border-dash-line bg-white shadow-dash-filter">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3 short:pt-2">
        <Field label={t("filter.date")}>
          <DateRangePicker from={range.from} to={range.to} onChange={onRangeChange} />
        </Field>
        <Field label={t("filter.company")}>
          <DropdownSelect ariaLabel={t("filter.company")} options={companyOptions} value={company} onChange={onCompanyChange} searchable className="w-[170px]" />
        </Field>
        <Field label={t("filter.module")}>
          <DropdownSelect ariaLabel={t("filter.module")} options={moduleOptions} value={module} onChange={onModuleChange} searchable className="w-[190px]" />
        </Field>
        <label className="flex h-9 w-[240px] min-w-0 items-center gap-2 rounded-[10px] border border-dash-line bg-white px-3 type-body shadow-[0_1px_3px_rgba(15,23,42,0.05)] focus-within:border-[#3b82f6]">
          <Search className="size-4 flex-none text-dash-faint" strokeWidth={2.2} />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-transparent uppercase outline-none placeholder:text-dash-faint placeholder:normal-case"
            placeholder={t("filter.search")}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-dash-line px-4 py-2.5 short:mt-2 short:py-2">
        <span className="flex-none type-label text-[#1f2937]">{t("filter.type")}</span>
        <div role="radiogroup" aria-label={t("filter.type")} className="flex flex-wrap items-center gap-2">
          {TILES.map((s) => {
            const Icon = s.icon;
            const active = s.value === action;
            return (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onActionChange(s.value)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-[10px] border bg-white py-1 pr-3 pl-1 type-body font-semibold! whitespace-nowrap text-[#1f2937] transition-[border-color,box-shadow]",
                  active ? s.on : cn("border-dash-line shadow-[0_1px_3px_rgba(15,23,42,0.05)]", s.hover)
                )}
              >
                <span className={cn("flex size-[26px] items-center justify-center rounded-lg transition-colors", active ? s.tileOn : s.tile)}>
                  <Icon className="size-3.5" strokeWidth={2.4} />
                </span>
                {s.value === "all" ? t("filter.all") : s.value}
                <span className={cn("min-w-5 rounded-md px-1.5 text-center type-caption font-semibold! tabular-nums", active ? cn(s.tileOn) : s.tile)}>
                  {countOf[s.value].toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Not a filter yet: Restore is not built, so this only reports how many rows could be restored. */}
        <span
          title={t("filter.restorableTip")}
          className="ml-auto flex items-center gap-2 rounded-[10px] border border-dash-line bg-white py-1 pr-3 pl-1 type-body font-semibold! whitespace-nowrap text-[#1f2937] shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
        >
          <span className="flex size-[26px] items-center justify-center rounded-lg bg-[#fef3c7] text-[#d97706]">
            <Undo2 className="size-3.5" strokeWidth={2.4} />
          </span>
          {t("filter.restorable")}
          <span className="min-w-5 rounded-md bg-[#fef3c7] px-1.5 text-center type-caption font-semibold! text-[#d97706] tabular-nums">{counts.restorable.toLocaleString()}</span>
        </span>
      </div>
    </section>
  );
}
