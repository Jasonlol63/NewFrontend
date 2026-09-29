import { useEffect, useState } from "react";
import { ChevronRight, Clock, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatFullRange,
  formatShortRange,
  formatTimeOrDay,
  getMaintenanceStatus,
  parseTime,
} from "../maintenance";

const TEXT = {
  en: {
    prefix: "Maintenance",
    ongoingLine: (until) => `Maintenance · back by ${until}`,
    upcoming: "Upcoming",
    ongoing: "In progress",
    period: "Period",
  },
  zh: {
    prefix: "系统维护",
    ongoingLine: (until) => `系统维护 · 预计 ${until} 恢复`,
    upcoming: "即将开始",
    ongoing: "维护中",
    period: "维护时间",
  },
};

const STATUS_STYLE = {
  upcoming: { text: "text-notice-warn", dot: "bg-notice-warn-dot" },
  ongoing: { text: "text-notice-live", dot: "bg-notice-live-dot animate-notice-pulse motion-reduce:animate-none" },
};

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

// One-line maintenance banner above the login card. Renders nothing when there
// is no notice or the maintenance window is over.
export default function MaintenanceNotice({ notice, lang = "en", className }) {
  const now = useNow();
  if (!notice) return null;

  const t = TEXT[lang] ?? TEXT.en;
  const status = getMaintenanceStatus(notice, now);
  if (status === "ended") return null;

  const start = parseTime(notice.startTime);
  const end = parseTime(notice.endTime);

  let line = notice.title;
  if (status === "upcoming") line = `${t.prefix} · ${formatShortRange(start, end, now)}`;
  if (status === "ongoing") line = t.ongoingLine(formatTimeOrDay(end, now));

  const hasDetail = Boolean(notice.content || status);

  const body = (
    <>
      <span className="flex size-7 flex-none items-center justify-center rounded-full bg-white text-brand-blue shadow-[0_2px_6px_-2px_rgba(20,70,160,0.3)]">
        <Wrench size={15} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 truncate text-left text-[12.5px] font-medium tabular-nums text-brand-navy">
        {line}
      </span>
      {status && (
        <span
          className={cn(
            "flex flex-none items-center gap-[5px] rounded-full bg-white px-2 py-1 text-[10.5px] font-bold leading-none shadow-[0_1px_3px_rgba(20,70,160,0.12)]",
            STATUS_STYLE[status].text
          )}
        >
          <i className={cn("size-1.5 rounded-full", STATUS_STYLE[status].dot)} />
          {t[status]}
        </span>
      )}
      {hasDetail && (
        <ChevronRight
          size={14}
          aria-hidden="true"
          className="flex-none text-[#5b7fc0] transition-transform group-data-[state=open]:rotate-90"
        />
      )}
    </>
  );

  const barClass = cn(
    "flex h-10 w-full items-center gap-[9px] rounded-full border border-transparent bg-notice-gradient py-0 pl-[6px] pr-3 shadow-notice",
    className
  );

  if (!hasDetail) return <div className={barClass}>{body}</div>;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(barClass, "group cursor-pointer text-inherit outline-none transition-[filter] hover:brightness-[1.02] focus-visible:ring-2 focus-visible:ring-brand-blue/50")}
        >
          {body}
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex w-(--radix-popover-trigger-width) flex-col gap-1.5 shadow-[0_28px_50px_-18px_rgba(20,70,160,0.45)]">
        <h4 className="m-0 text-[13px] font-semibold text-brand-navy">{notice.title}</h4>
        {start && end && (
          <span className={cn("flex items-center gap-1.5 text-xs font-semibold tabular-nums", STATUS_STYLE[status]?.text)}>
            <Clock size={13} aria-hidden="true" />
            {t.period} · {formatFullRange(start, end)}
          </span>
        )}
        {notice.content && (
          <p className="m-0 whitespace-pre-line text-xs text-[#5b74a3]">{notice.content}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
