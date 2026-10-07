import { useState } from "react";
import { CalendarDays, ChevronDown, LayoutGrid, Layers, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import SlideTabs from "@/components/shared/SlideTabs.jsx";
import OwnershipCard from "./OwnershipCard.jsx";
import { GROUPS, MOCK_COMPANIES, groupCount } from "./ownershipRules";

const NOT_BUILT = "Not available yet";

const TABS = [
  { value: "ownership", label: "Account Ownership", icon: Users },
  { value: "earnings", label: "Group Earnings", icon: Layers },
];

const whitePill =
  "inline-flex h-9 flex-none items-center gap-2 rounded-[10px] border border-dash-line bg-white px-3.5 text-[13px] font-semibold text-brand-navy shadow-[0_1px_3px_rgba(15,23,42,0.05)]";

/**
 * Ownership: who owns each company, per Group.
 * Design preview only: placeholder data, nothing calls the API; Manage opens a row's editor, Confirm just closes it.
 * Group Earnings, the month picker, Select and Ungroup are not built yet.
 */
export default function OwnershipPage() {
  const [tab, setTab] = useState("ownership");
  const [group, setGroup] = useState(GROUPS[0]);
  const [openId, setOpenId] = useState(null);
  const rows = MOCK_COMPANIES.filter((c) => c.group === group);

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <div className="flex flex-none items-center gap-3 px-1">
        <SlideTabs options={TABS} value={tab} onChange={setTab} tabClassName="min-w-[150px]" />
        <button type="button" title={NOT_BUILT} className={cn(whitePill, "ml-auto cursor-not-allowed")}>
          <CalendarDays className="size-4 text-[#0b57e8]" strokeWidth={2.2} />
          Oct 2026
          <ChevronDown className="size-3.5 text-slate-400" strokeWidth={2.6} />
        </button>
      </div>

      {tab === "ownership" ? (
        <>
          <div className="flex flex-none items-center gap-3 px-1">
            <span className="text-[11.5px] font-extrabold tracking-[0.5px] text-brand-navy">GROUP</span>
            <div className="inline-flex overflow-hidden rounded-[10px] border border-dash-line shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
              {GROUPS.map((g) => {
                const active = g === group;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setGroup(g);
                      setOpenId(null);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 border-r border-dash-line px-4 py-1.5 text-[12.5px] font-semibold last:border-r-0",
                      active ? "bg-seg-active text-white" : "bg-white text-[#1f2937] hover:bg-slate-50"
                    )}
                  >
                    {g}
                    <span className={cn("min-w-5 rounded-full px-1.5 text-center text-[11px] font-extrabold tabular-nums", active ? "bg-white/25 text-white" : "bg-[#e8f1ff] text-[#0b4fd0]")}>
                      {groupCount(MOCK_COMPANIES, g)}
                    </span>
                  </button>
                );
              })}
            </div>
            <button type="button" title={NOT_BUILT} className={cn(whitePill, "ml-auto cursor-not-allowed")}>
              <LayoutGrid className="size-4" strokeWidth={2.2} />
              Select
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1 pb-1 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
            {rows.map((c) => (
              <OwnershipCard key={c.id} company={c} open={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} />
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center text-[13px] font-semibold text-dash-sub">Group Earnings is coming soon.</div>
      )}
    </div>
  );
}
