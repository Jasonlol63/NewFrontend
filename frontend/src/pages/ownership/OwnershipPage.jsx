import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, LayoutGrid, Layers, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import SlideTabs from "@/components/shared/SlideTabs.jsx";
import OwnershipCard from "./OwnershipCard.jsx";
import "./ownership.css";
import { GROUPS, MOCK_COMPANIES, groupCount } from "./ownershipRules";

const NOT_BUILT = "Not available yet";

const TABS = [
  { value: "ownership", label: "Account Ownership", icon: Users },
  { value: "earnings", label: "Group Earnings", icon: Layers },
];

const whitePill =
  "own-pill inline-flex flex-none items-center gap-2 border border-dash-line bg-white font-semibold text-brand-navy shadow-[0_1px_3px_rgba(15,23,42,0.05)]";

const clamp = (min, max, v) => Math.min(max, Math.max(min, v));

// Size factor of the page (see ownership.css): follows the window height and width, never above 1.
function useSizeFactor(ref) {
  useEffect(() => {
    const apply = () => {
      const k = Math.min(clamp(0.78, 1, innerHeight * 0.00159 - 0.161), clamp(0.78, 1, innerWidth / 1500));
      ref.current?.style.setProperty("--k", k.toFixed(3));
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [ref]);
}

/**
 * Ownership: who owns each company, per Group.
 * Design preview only: placeholder data, nothing calls the API; Manage opens a row's editor, Confirm just closes it.
 * Group Earnings, the month picker, Select and Ungroup are not built yet.
 */
export default function OwnershipPage() {
  const [tab, setTab] = useState("ownership");
  const [group, setGroup] = useState(GROUPS[0]);
  const [openId, setOpenId] = useState(null);
  const pageRef = useRef(null);
  useSizeFactor(pageRef);
  const rows = MOCK_COMPANIES.filter((c) => c.group === group);

  return (
    <div ref={pageRef} className="own-page flex h-full min-h-[520px] flex-col">
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
            <span className="own-label font-extrabold tracking-[0.5px] text-brand-navy">GROUP</span>
            <div className="own-seg inline-flex overflow-hidden border border-dash-line shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
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
                      "flex cursor-pointer items-center gap-1.5 border-r border-dash-line font-semibold last:border-r-0",
                      active ? "bg-seg-active text-white" : "bg-white text-[#1f2937] hover:bg-slate-50"
                    )}
                  >
                    {g}
                    <span className={cn("min-w-5 rounded-full px-1.5 text-center font-extrabold tabular-nums", active ? "bg-white/25 text-white" : "bg-[#e8f1ff] text-[#0b4fd0]")}>
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

          <div className="own-list flex min-h-0 flex-1 flex-col overflow-y-auto px-1 pb-1 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
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
