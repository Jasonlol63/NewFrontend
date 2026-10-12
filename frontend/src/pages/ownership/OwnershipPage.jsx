import { useState } from "react";
import { Clock, LayoutGrid, Layers, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import DeleteDialog from "@/components/shared/DeleteDialog.jsx";
import DropdownSelect from "@/components/shared/DropdownSelect.jsx";
import { SoftButton, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";
import SlideTabs from "@/components/shared/SlideTabs.jsx";
import Toast from "@/components/shared/Toast.jsx";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNotice } from "@/hooks/useNotice";
import MonthPicker from "./MonthPicker.jsx";
import OwnershipCard from "./OwnershipCard.jsx";
import { setParent } from "./ownershipApi";
import { NO_GROUP, canSetReadOnly, companiesOfGroup, currentMonth, monthLabel } from "./ownershipRules";
import { useOwnershipOverview } from "./useOwnershipOverview";

const TABS = [
  { value: "ownership", label: "Account Ownership", icon: Users },
  { value: "earnings", label: "Group Earnings", icon: Layers },
];

// Sizes shared by the white pills and the Current button; they follow the screen height like the rest of the page.
const pillSize =
  "h-[clamp(28.08px,calc(5.72dvh_-_5.8px),36px)] px-[clamp(10.92px,calc(2.23dvh_-_2.25px),14px)] rounded-[clamp(7.8px,calc(1.59dvh_-_1.61px),10px)] text-[length:max(12px,clamp(10.14px,calc(2.07dvh_-_2.09px),13px))] text-brand-navy";

const whitePill = `${pillSize} inline-flex flex-none items-center gap-2 border border-dash-line bg-white font-semibold shadow-[0_1px_3px_rgba(15,23,42,0.05)]`;

const infoBar = "mx-1 flex flex-none items-center gap-2 rounded-xl border border-white/85 bg-white/55 px-3.5 py-2 text-[12.5px] font-semibold text-brand-navy shadow-[0_8px_24px_-18px_rgba(20,51,107,0.4)]";

// Waits for several changes and tells how many went through.
async function runAll(ids, action) {
  const results = await Promise.allSettled(ids.map(action));
  const failed = results.filter((r) => r.status === "rejected");
  return { done: ids.length - failed.length, failed: failed.length, message: failed[0]?.reason?.message };
}

/**
 * Ownership: who owns each company, per Group (/api/ownership/*).
 *  - Account Ownership: the companies of the picked Group (or of no Group); Manage opens a company's shareholders, Confirm
 *    saves them. Select picks several companies to put into a Group (No Group view) or to take out of one (Group view).
 *  - Group Earnings: the Groups' own shareholders, the same card with the Group's own ledger.
 *  - The month picker switches between the current month and past ones; a past month is marked HISTORICAL and what is
 *    confirmed there only applies to that month (Link Partner, Select and Ungroup are for the current month only).
 */
export default function OwnershipPage() {
  const viewer = useCurrentUser();
  const readOnly = Boolean(viewer?.readOnly);
  const mayChangeReadOnly = canSetReadOnly(viewer?.role);
  const { toasts, push, dismiss } = useNotice(5500);
  const [tab, setTab] = useState("ownership");
  const [picked, setPicked] = useState(null); // the Group chip, null = the first one
  const [openId, setOpenId] = useState(null); // tenantId of the card being managed
  const current = currentMonth();
  const [month, setMonth] = useState(current);
  const historical = month !== current;
  const { directory, allocation, error, loading, reload } = useOwnershipOverview(month);

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set()); // tenantIds
  const [joinGroup, setJoinGroup] = useState("");
  const [ungroup, setUngroup] = useState(null); // { ids, names } waiting for the confirmation
  const [working, setWorking] = useState(false);

  const groups = directory?.groups ?? [];
  const hasUngrouped = Boolean(directory?.companies.some((c) => !c.group));
  const chips = [...groups.map((g) => g.code), ...(hasUngrouped ? [NO_GROUP] : [])];
  const group = chips.includes(picked) ? picked : (chips[0] ?? null);
  const companies = directory && group ? companiesOfGroup(directory, group) : [];
  const countOf = (code) => (directory ? companiesOfGroup(directory, code).length : 0);
  const percentOf = (ref) => (allocation ? (allocation.get(ref) ?? 0) : null);
  const locked = readOnly || historical;

  const leaveSelection = () => {
    setSelecting(false);
    setSelected(new Set());
    setJoinGroup("");
  };
  const pickGroup = (code) => {
    setPicked(code);
    setOpenId(null);
    leaveSelection();
  };
  const toggleSelected = (tenantId) =>
    setSelected((set) => {
      const next = new Set(set);
      if (next.has(tenantId)) next.delete(tenantId);
      else next.add(tenantId);
      return next;
    });

  const doUngroup = async () => {
    setWorking(true);
    const { done, failed, message } = await runAll(ungroup.ids, (id) => setParent(id, null));
    setWorking(false);
    setUngroup(null);
    leaveSelection();
    reload();
    if (failed === 0) push(done === 1 ? `"${ungroup.names[0]}" removed from group` : `Removed ${done} companies from group`);
    else push(`${failed} failed, ${done} succeeded`, "error", message);
  };

  const doJoin = async () => {
    if (!joinGroup) return push("Select a group", "error", "Choose the group to add the companies to.");
    setWorking(true);
    const ids = [...selected];
    const { done, failed, message } = await runAll(ids, (id) => setParent(id, joinGroup));
    setWorking(false);
    reload();
    if (failed === 0) {
      push(`Added ${done} ${done === 1 ? "company" : "companies"} to ${joinGroup}`);
      leaveSelection();
      pickGroup(joinGroup);
    } else push(`${failed} failed, ${done} succeeded`, "error", message);
  };

  const ask = (ids) => setUngroup({ ids, names: ids.map((id) => directory.companies.find((c) => c.tenantId === id)?.code ?? String(id)) });

  const entities =
    tab === "ownership"
      ? companies.map((c) => ({ tenantId: c.tenantId, ref: c.tenantId, code: c.code, chip: c.group ?? "NO GROUP", expiration: c.expiration, canUngroup: Boolean(c.group), kind: "company" }))
      : groups.map((g) => ({ tenantId: g.tenantId, ref: g.tenantId ?? g.code, code: g.code, chip: "GROUP", expiration: g.expiration, canUngroup: false, kind: "group" }));
  const inGroupView = group !== NO_GROUP;

  return (
    <div className="relative py-[clamp(10.92px,calc(2.23dvh_-_2.25px),14px)] px-[clamp(12.48px,calc(2.54dvh_-_2.58px),16px)] gap-[clamp(7.8px,calc(1.59dvh_-_1.61px),10px)] text-[length:max(12px,clamp(10.14px,calc(2.07dvh_-_2.09px),13px))] xl-screen:px-7 xl-screen:py-[22px] xl-screen:gap-[18px] flex h-full min-h-[520px] flex-col">
      <Toast toasts={toasts} onClose={dismiss} />
      <div className="flex flex-none items-center gap-3 px-1">
        <SlideTabs
          options={TABS}
          value={tab}
          onChange={(next) => {
            setTab(next);
            setOpenId(null);
            leaveSelection();
          }}
          tabClassName="min-w-[150px]"
        />
        <div className="ml-auto flex items-center gap-2.5">
          <MonthPicker
            value={month}
            current={current}
            saved={new Set()}
            onChange={(next) => {
              setMonth(next);
              setOpenId(null);
              leaveSelection();
            }}
            triggerClassName={cn(whitePill, "border border-dash-line bg-white font-semibold")}
          />
          {historical && (
            <button
              type="button"
              onClick={() => {
                setMonth(current);
                setOpenId(null);
                leaveSelection();
              }}
              className={cn(primaryButtonClass, pillSize, "min-w-[88px] text-white shadow-[0_6px_14px_-6px_rgba(20,90,220,0.6),inset_0_1px_2px_rgba(255,255,255,0.35)]")}
            >
              Current
            </button>
          )}
        </div>
      </div>

      {historical && (
        <div className={infoBar}>
          <Clock className="size-4 flex-none" strokeWidth={2.2} />
          <span>
            Viewing <b className="text-[#a45a04]">{monthLabel(month)}</b> (history). Changes you confirm here apply to this month only.
          </span>
        </div>
      )}

      {tab === "ownership" && directory && (
        <div className="flex flex-none items-center gap-3 px-1">
          <span className="text-[length:max(11px,clamp(8.97px,calc(1.83dvh_-_1.85px),11.5px))] font-extrabold tracking-[0.5px] text-brand-navy">GROUP</span>
          <div className="rounded-[clamp(7.8px,calc(1.59dvh_-_1.61px),10px)] inline-flex overflow-hidden border border-dash-line shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
            {chips.map((g) => {
              const active = g === group;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => pickGroup(g)}
                  className={cn(
                    "py-[clamp(5.46px,calc(1.11dvh_-_1.13px),7px)] px-[clamp(12.48px,calc(2.54dvh_-_2.58px),16px)] text-[length:max(12px,clamp(9.75px,calc(1.99dvh_-_2.01px),12.5px))] flex cursor-pointer items-center gap-1.5 border-r border-dash-line font-semibold last:border-r-0",
                    active ? "bg-seg-active text-white" : "bg-white text-[#1f2937] hover:bg-slate-50"
                  )}
                >
                  {g === NO_GROUP ? "No Group" : g}
                  <span className={cn("text-[length:max(10.5px,clamp(8.58px,calc(1.75dvh_-_1.77px),11px))] min-w-5 rounded-full px-1.5 text-center font-extrabold tabular-nums", active ? "bg-white/25 text-white" : "bg-[#e8f1ff] text-[#0b4fd0]")}>{countOf(g)}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={locked || companies.length === 0}
            onClick={() => (selecting ? leaveSelection() : (setOpenId(null), setSelecting(true)))}
            title={readOnly ? "Read-only login" : historical ? "Not available for a past month" : undefined}
            className={cn(whitePill, "ml-auto cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", selecting && "border-brand-blue bg-[#e8f1ff]")}
          >
            <LayoutGrid className="size-4" strokeWidth={2.2} />
            Select
          </button>
        </div>
      )}

      {selecting && (
        <div className={cn(infoBar, "gap-3")}>
          <b className="min-w-5 rounded-full bg-[#e8f1ff] px-2 py-0.5 text-center tabular-nums text-[#0b4fd0]">{selected.size}</b>
          <span>selected</span>
          <div className="ml-auto flex items-center gap-2">
            {inGroupView ? (
              <button type="button" disabled={selected.size === 0 || working} onClick={() => ask([...selected])} className={cn(pillSize, "inline-flex cursor-pointer items-center border border-[#fbc4cf] bg-white font-bold text-[#e11d48] disabled:cursor-not-allowed disabled:opacity-50")}>
                Ungroup
              </button>
            ) : (
              <>
                <DropdownSelect
                  options={groups.map((g) => ({ value: g.code, label: g.code }))}
                  value={joinGroup}
                  onChange={(v) => setJoinGroup(v ?? "")}
                  placeholder="Select group"
                  ariaLabel="Group to join"
                  className="h-[clamp(28.08px,calc(5.72dvh_-_5.8px),36px)] w-[160px] rounded-[10px]"
                />
                <button type="button" disabled={selected.size === 0 || !joinGroup || working} onClick={doJoin} className={cn(primaryButtonClass, pillSize, "text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none")}>
                  Join Group
                </button>
              </>
            )}
            <SoftButton onClick={leaveSelection} className={cn(pillSize, "px-4")}>
              Cancel
            </SoftButton>
          </div>
        </div>
      )}

      <div className="gap-[clamp(6.24px,calc(1.27dvh_-_1.29px),8px)] xl-screen:gap-3 flex min-h-0 flex-1 flex-col overflow-y-auto px-1 pb-1 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-[13px] font-semibold text-dash-sub">Loading…</div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[13px] font-semibold text-dash-sub">
            {error}
            <button type="button" onClick={reload} className={cn(primaryButtonClass, pillSize, "text-white")}>
              Retry
            </button>
          </div>
        ) : entities.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-[13px] font-semibold text-dash-sub">{tab === "ownership" ? "No companies in this group." : "No Group to show."}</div>
        ) : (
          entities.map((e) => (
            <OwnershipCard
              key={`${tab}-${month}-${e.ref}`}
              entity={e}
              month={month}
              historicalLabel={historical ? monthLabel(month) : null}
              allocated={percentOf(e.ref)}
              open={openId === e.ref}
              onToggle={() => setOpenId(openId === e.ref ? null : e.ref)}
              readOnly={readOnly}
              canSetReadOnly={mayChangeReadOnly}
              onUngroup={() => ask([e.tenantId])}
              selection={selecting && e.kind === "company" ? { active: true, checked: selected.has(e.tenantId), selectable: true, onToggle: () => toggleSelected(e.tenantId) } : undefined}
              notify={push}
              onSaved={reload}
            />
          ))
        )}
      </div>

      <DeleteDialog
        open={Boolean(ungroup)}
        onOpenChange={(open) => !open && !working && setUngroup(null)}
        names={ungroup?.names ?? []}
        noun="company"
        verb="Ungroup"
        verbPast="removed from their group"
        irreversible={false}
        note="Their ownership lists stay as they are."
        onConfirm={doUngroup}
      />
    </div>
  );
}
