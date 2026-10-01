import { Tooltip } from "radix-ui";
import { Clock, SquarePen } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_BADGE, formatDateTime } from "./listFormat";

const badge = "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wide whitespace-nowrap uppercase";

export function Badge({ className, children }) {
  return <span className={cn(badge, className)}>{children || "-"}</span>;
}

// Clickable when onToggle is given (flips Active / Inactive), otherwise a plain badge.
export function StatusBadge({ status, onToggle, pending, disabledTitle }) {
  if (!onToggle) {
    return (
      <span className={cn(badge, STATUS_BADGE[status])} title={disabledTitle}>
        {status || "-"}
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onToggle}
      title="Click to change status"
      className={cn(badge, "cursor-pointer transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-50", STATUS_BADGE[status])}
    >
      {status || "-"}
    </button>
  );
}

// Date only; the time shows in a small card on hover.
export function DateText({ value }) {
  const { date, time } = formatDateTime(value);
  const text = <span className="tabular-nums whitespace-nowrap">{date}</span>;
  if (!time) return text;
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{text}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={6}
            className="z-50 flex items-center gap-1.5 rounded-[10px] border border-[#bcd9fb] bg-white px-2.5 py-1.5 text-xs font-semibold tabular-nums text-brand-navy shadow-[0_8px_20px_-6px_rgba(20,70,160,0.35)] animate-in fade-in-0 zoom-in-95"
          >
            <Clock className="size-3.5 text-brand-blue" strokeWidth={2.2} />
            {time}
            {/* Open path: only the two slanted edges get the border colour; nudged up 1px to cover the card border. */}
            <Tooltip.Arrow asChild width={12} height={6}>
              <svg viewBox="0 0 12 6" className="-translate-y-px">
                <path d="M0 0 L6 6 L12 0" fill="#fff" stroke="#bcd9fb" />
              </svg>
            </Tooltip.Arrow>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

// Small icon button for the Action column.
export function IconAction({ icon: Icon = SquarePen, className, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-lg text-[#2563eb] transition-colors enabled:cursor-pointer enabled:hover:bg-[#e8f1ff] disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      {...props}
    >
      <Icon className="size-4" strokeWidth={2.1} />
    </button>
  );
}
