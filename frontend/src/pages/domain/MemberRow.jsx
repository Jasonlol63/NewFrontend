import { Check, ChevronDown, X } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { cn } from "@/lib/utils";
import { NO_GROUP } from "./domainFormRules";

const NOT_BUILT = "Not available yet";

/**
 * One Group or Company in the Add / Edit Domain modal:  [code (+ group chip)]  |  expiry date  |  [Set] [x].
 * The date sits in the middle of the row; Set is the big, obvious button and the remove x is small and quiet,
 * with a wider gap between them, so Remove is hard to hit by mistake.
 * Companies pass `groups` + `onMove`: their group chip opens a menu to join / leave a group in one click.
 * In Multiple Choice (`selectable`) the row shows a tick box and a click anywhere on it ticks it.
 */
export default function MemberRow({
  code,
  date,
  group,
  groups,
  onMove,
  change,
  selectable,
  picked,
  onPick,
  onSet,
  onRemove,
}) {
  const hasGroupChip = Boolean(groups);
  return (
    <div
      onClick={(e) => {
        if (selectable && !e.target.closest("button")) onPick();
      }}
      className={cn(
        "grid min-h-10 flex-none grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 rounded-[9px] border border-transparent bg-white/50 py-1 pr-2 pl-3 hover:border-[#93c5fd] hover:bg-white/75",
        "modal-compact:min-h-9 modal-compact:py-0.5 modal-tiny:min-h-8",
        selectable && "cursor-pointer",
        picked && "border-[#7fb2ff] bg-row-stripe hover:border-[#7fb2ff] hover:bg-row-stripe"
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {selectable && (
          <button
            type="button"
            role="checkbox"
            aria-checked={picked}
            aria-label={`Select ${code}`}
            onClick={onPick}
            className={cn(
              "flex size-[18px] flex-none cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] p-0 text-white",
              picked ? "border-transparent bg-brand-sweep" : "border-[#c3d3ea] bg-white hover:border-[#7fb2ff]"
            )}
          >
            {picked && <Check className="size-[11px]" strokeWidth={4} />}
          </button>
        )}
        <b className="text-[13px] font-bold text-brand-navy">{code}</b>
        {change && (
          <i
            title={change === "new" ? "New: saved with Save" : "Changed: saved with Save"}
            className="size-[7px] flex-none rounded-full bg-[#f59e0b] shadow-[0_0_0_3px_rgba(245,158,11,0.22)]"
          />
        )}
        {hasGroupChip && (
          <GroupChip group={group} groups={groups} onMove={onMove} disabled={selectable} moved={change === "moved"} />
        )}
      </div>

      {date ? (
        <span className="justify-self-center text-[12.5px] font-semibold tabular-nums whitespace-nowrap text-[#475569]">{date}</span>
      ) : (
        <span className="justify-self-center text-[12.5px] font-medium whitespace-nowrap text-[#9aa7ba] italic">Not set</span>
      )}

      <div className="flex items-center gap-3.5 justify-self-end modal-compact:gap-3 modal-tiny:gap-2.5">
        <button
          type="button"
          onClick={onSet}
          title={NOT_BUILT}
          className="h-[30px] min-w-[62px] cursor-pointer rounded-[9px] border-none bg-brand-sweep px-[18px] text-[12.5px] font-bold text-white shadow-[0_6px_12px_-6px_rgba(20,90,220,0.65),inset_0_1px_0_rgba(255,255,255,0.35)] hover:brightness-105 modal-compact:h-7 modal-compact:min-w-14 modal-compact:px-3.5 modal-tiny:h-[26px] modal-tiny:min-w-[52px] modal-tiny:px-3 modal-tiny:text-[12px]"
        >
          Set
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${code}`}
          title={`Remove ${code}`}
          className="flex size-[26px] flex-none cursor-pointer items-center justify-center rounded-lg border border-[rgba(130,155,195,0.35)] bg-white/65 text-[#8a98b0] transition-colors hover:border-[#f5b9c2] hover:bg-[linear-gradient(180deg,#fff6f7_0%,#ffe4e8_100%)] hover:text-[#d4566a] modal-tiny:size-6"
        >
          <X className="size-3.5" strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}

const chipBase =
  "inline-flex h-5 flex-none items-center gap-0.5 rounded-md border-none py-0 pr-1.5 pl-2 text-[10.5px] font-bold whitespace-nowrap transition-shadow";

// The group of a company as a small chip; click it to move the company (or take it out of its group).
function GroupChip({ group, groups, onMove, disabled, moved }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          title="Change group"
          className={cn(
            chipBase,
            group ? "bg-[#dbeafe] text-[#1d4ed8]" : "bg-white/70 font-semibold text-[#8a96a8]",
            moved && "ring-2 ring-[rgba(245,158,11,0.4)]",
            disabled ? "cursor-default" : "cursor-pointer hover:ring-2 hover:ring-[rgba(59,130,246,0.25)]"
          )}
        >
          {group ? `Group ${group}` : "No group"}
          <ChevronDown className="size-[11px] opacity-70" strokeWidth={2.8} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="z-50 flex min-w-[150px] flex-col gap-0.5 rounded-xl border border-modal-line bg-modal-float p-[5px] shadow-[0_14px_32px_-10px_rgba(20,51,107,0.32)] backdrop-blur-xl"
        >
          {groups.length ? (
            [{ value: NO_GROUP, label: "No group" }, ...groups.map((g) => ({ value: g.code, label: g.code }))].map((o) => {
              const on = (o.value === NO_GROUP ? "" : o.value) === group;
              return (
                <DropdownMenu.Item
                  key={o.value}
                  onSelect={() => onMove(o.value === NO_GROUP ? "" : o.value)}
                  className={cn(
                    "flex min-h-[34px] cursor-pointer items-center gap-2 rounded-[9px] border border-transparent py-1.5 pr-2 pl-2.5 text-[13px] font-semibold text-[#374151] outline-none select-none",
                    "modal-compact:min-h-[30px] modal-compact:py-1 modal-tiny:min-h-7 modal-tiny:text-[12.5px]",
                    "data-highlighted:bg-[#eef4ff]",
                    o.value === NO_GROUP && !on && "text-[#8a96a8]",
                    on && "border-[#7fb2ff] bg-row-stripe font-bold text-brand-navy"
                  )}
                >
                  {o.label}
                  {on && (
                    <span className="ml-auto flex size-4 flex-none items-center justify-center rounded-full bg-brand-sweep text-white shadow-[0_3px_8px_-3px_rgba(20,90,220,0.6)]">
                      <Check className="size-2.5" strokeWidth={4} />
                    </span>
                  )}
                </DropdownMenu.Item>
              );
            })
          ) : (
            <DropdownMenu.Item disabled className="flex min-h-[34px] items-center rounded-[9px] px-2.5 text-[13px] font-semibold text-[#8a96a8]">
              No groups created
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
