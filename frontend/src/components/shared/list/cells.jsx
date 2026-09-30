import { SquarePen } from "lucide-react";
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

// Date only; the time shows on hover.
export function DateText({ value }) {
  const { date, time } = formatDateTime(value);
  return (
    <span className="tabular-nums whitespace-nowrap" title={time || undefined}>
      {date}
    </span>
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
