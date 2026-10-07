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
  "h-[clamp(28.08px,calc(5.72dvh_-_5.8px),36px)] px-[clamp(10.92px,calc(2.23dvh_-_2.25px),14px)] rounded-[clamp(7.8px,calc(1.59dvh_-_1.61px),10px)] text-[length:max(12px,clamp(10.14px,calc(2.07dvh_-_2.09px),13px))] inline-flex flex-none items-center gap-2 border border-dash-line bg-white font-semibold text-brand-navy shadow-[0_1px_3px_rgba(15,23,42,0.05)]";


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
    <div className="py-[clamp(10.92px,calc(2.23dvh_-_2.25px),14px)] px-[clamp(12.48px,calc(2.54dvh_-_2.58px),16px)] gap-[clamp(7.8px,calc(1.59dvh_-_1.61px),10px)] text-[length:max(12px,clamp(10.14px,calc(2.07dvh_-_2.09px),13px))] xl-screen:px-7 xl-screen:py-[22px] xl-screen:gap-[18px] flex h-full min-h-[520px] flex-col">
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
            <span className="text-[length:max(11px,clamp(8.97px,calc(1.83dvh_-_1.85px),11.5px))] font-extrabold tracking-[0.5px] text-brand-navy">GROUP</span>
            <div className="rounded-[clamp(7.8px,calc(1.59dvh_-_1.61px),10px)] inline-flex overflow-hidden border border-dash-line shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
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
                      "py-[clamp(5.46px,calc(1.11dvh_-_1.13px),7px)] px-[clamp(12.48px,calc(2.54dvh_-_2.58px),16px)] text-[length:max(12px,clamp(9.75px,calc(1.99dvh_-_2.01px),12.5px))] flex cursor-pointer items-center gap-1.5 border-r border-dash-line font-semibold last:border-r-0",
                      active ? "bg-seg-active text-white" : "bg-white text-[#1f2937] hover:bg-slate-50"
                    )}
                  >
                    {g}
                    <span className={cn("text-[length:max(10.5px,clamp(8.58px,calc(1.75dvh_-_1.77px),11px))] min-w-5 rounded-full px-1.5 text-center font-extrabold tabular-nums", active ? "bg-white/25 text-white" : "bg-[#e8f1ff] text-[#0b4fd0]")}>
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

          <div className="gap-[clamp(6.24px,calc(1.27dvh_-_1.29px),8px)] xl-screen:gap-3 flex min-h-0 flex-1 flex-col overflow-y-auto px-1 pb-1 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
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
