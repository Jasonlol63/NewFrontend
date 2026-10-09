import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bell, CheckCheck, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { RichContent } from "@/pages/announcement/RichText.jsx";
import { DEFAULT_LIST_TITLE, THANKS_LINE, versionOf } from "@/pages/announcement/announcementRules";
import { formatNotificationTime } from "./notificationRules";

const iconButton =
  "flex size-8 flex-none cursor-pointer items-center justify-center rounded-[10px] border border-white/90 bg-white/60 text-brand-navy transition-colors hover:bg-white/85";

/**
 * The bell's panel: the announcements, newest first, sliding in from the right over the content area (the sidebar stays
 * visible and sharp). Mount it inside the content area's relative wrapper (AuthenticatedLayout), after #main-overlay so it
 * sits above the modals there; below 520px wide it fills the whole content area.
 * items / isUnread(item): the list and which ones are new; onMarkAllRead marks them all; Esc, the backdrop and X close it.
 */
export default function NotificationPanel({ open, onClose, items, isUnread, unreadCount, loading, error, onMarkAllRead, onRetry }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => e.key === "Escape" && !e.defaultPrevented && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <div className={cn("@container/main absolute inset-0 z-40", !open && "pointer-events-none")} inert={!open}>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn("absolute inset-0 bg-[rgba(20,51,107,0.18)] transition-opacity duration-200 motion-reduce:transition-none", open ? "opacity-100" : "opacity-0")}
      />
      <section
        role="dialog"
        aria-label="Announcements"
        className={cn(
          "absolute inset-y-2 right-2 flex w-[min(440px,calc(100%-16px))] flex-col overflow-hidden rounded-[22px] bg-[rgba(238,244,253,0.92)] backdrop-blur-[22px] backdrop-saturate-[1.15]",
          "shadow-[0_30px_60px_-20px_rgba(20,51,107,0.45),0_8px_20px_-10px_rgba(20,70,160,0.25)]",
          "transition-transform duration-[260ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none",
          "@max-[519px]/main:inset-y-0 @max-[519px]/main:right-0 @max-[519px]/main:w-full @max-[519px]/main:rounded-none",
          open ? "translate-x-0" : "translate-x-[calc(100%+24px)]"
        )}
      >
        <header className="flex flex-none items-center gap-2.5 pb-3 pl-[18px] pr-4 pt-4">
          <span className="flex size-9 flex-none items-center justify-center rounded-xl bg-brand-sweep text-white shadow-[0_10px_20px_-8px_rgba(20,90,220,0.55),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.35)]">
            <Bell className="size-[18px]" strokeWidth={2.3} />
          </span>
          <h2 className="m-0 whitespace-nowrap text-[20px] font-extrabold tracking-[-0.3px] text-brand-navy">Announcements</h2>
          {unreadCount > 0 && (
            <span className="inline-flex h-5 flex-none items-center whitespace-nowrap rounded-full bg-[#fee2e2] px-2 text-[11px] font-extrabold text-[#dc2626]">{unreadCount} new</span>
          )}
          <button type="button" onClick={onClose} aria-label="Close" title="Close" className={cn(iconButton, "ml-auto")}>
            <X className="size-[15px]" strokeWidth={2.6} />
          </button>
        </header>
        <div className="flex flex-none items-center justify-between gap-2 pb-2.5 pl-[18px] pr-3.5 text-[12px] text-[#5b74a3]">
          <span className="min-w-0 truncate">System updates from the EAZY COUNT team</span>
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
            className="inline-flex flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[7px] border-none bg-transparent px-1.5 py-1 text-[12px] font-bold text-[#1d7bff] hover:bg-[#e8f1ff] disabled:cursor-default disabled:text-dash-faint disabled:hover:bg-transparent"
          >
            <CheckCheck className="size-3.5" strokeWidth={2.4} />
            Mark all as read
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto border-t border-modal-divider px-3 pb-3.5 pt-3 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
          {error && (
            <div role="alert" className="flex flex-none items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] font-medium text-dash-down">
              <span className="min-w-0">{error}</span>
              <button type="button" onClick={onRetry} className="flex-none cursor-pointer border-none bg-transparent text-[12px] font-bold text-[#1d7bff]">
                Retry
              </button>
            </div>
          )}
          {loading && items.length === 0 && !error && <p className="m-0 py-6 text-center text-[12.5px] text-dash-faint">Loading…</p>}
          {!loading && items.length === 0 && !error && (
            <div className="rounded-xl border border-dashed border-modal-off-line px-3 py-8 text-center text-[12.5px] text-[#8a96a8]">No announcements yet.</div>
          )}
          {items.map((a) => (
            <NotificationCard key={a.id} item={a} unread={isUnread(a)} />
          ))}
        </div>
      </section>
    </div>
  );
}

// One announcement in the format of the Notification preview on the Announcement page.
function NotificationCard({ item, unread }) {
  const version = versionOf(item.content);
  return (
    <article
      className={cn(
        "relative flex-none overflow-hidden rounded-2xl border border-modal-line bg-white py-3 pl-4 pr-3.5 shadow-modal-card",
        "before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-r-[3px]",
        unread ? "before:bg-[linear-gradient(180deg,#3fc4ff,#0a3fc9)]" : "before:bg-[#cbd8ee]"
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="grid size-[26px] flex-none place-items-center rounded-lg bg-brand-sweep text-white">
          <Bell className="size-3.5" strokeWidth={2.4} />
        </span>
        <b className="min-w-0 break-words text-[14px] font-extrabold text-brand-navy">{item.title}</b>
        {version && <span className="inline-flex h-[18px] flex-none items-center rounded-full bg-[#e8f1ff] px-[7px] text-[10.5px] font-extrabold text-[#1d4ed8]">Version {version}</span>}
        {unread && <i aria-label="Unread" className="size-2 flex-none rounded-full bg-[#3b82f6] shadow-[0_0_0_3px_rgba(59,130,246,0.2)]" />}
        <time title={item.createdAt} className="ml-auto flex-none whitespace-nowrap text-[10.5px] text-dash-faint">
          {formatNotificationTime(item.createdAt)}
        </time>
      </div>
      <div className="mb-1 text-[13px] font-extrabold text-brand-navy">{item.listTitle || DEFAULT_LIST_TITLE}</div>
      <ClampedContent html={item.content} />
      <p className="m-0 mt-1.5 text-[11.5px] text-[#5b74a3]">{THANKS_LINE}</p>
      <div className="mt-2 flex justify-between gap-2 border-t border-dashed border-[#e3ebf8] pt-[7px] text-[10.5px] text-dash-faint">
        <b className="font-extrabold tracking-[0.3px] text-[#64748b]">EAZY COUNT TEAM</b>
        <span>{item.createdAt}</span>
      </div>
    </article>
  );
}

// The content, cut at about 6 lines with a fade and a Show more button when it is longer than that.
const CLAMP_PX = 118;
function ClampedContent({ html }) {
  const box = useRef(null);
  const [long, setLong] = useState(false);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const measure = () => setLong(el.scrollHeight > CLAMP_PX + 4);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [html]);

  const clamped = long && !open;
  return (
    <>
      <div className="relative">
        <div ref={box} style={clamped ? { maxHeight: CLAMP_PX } : undefined} className={cn(clamped && "overflow-hidden")}>
          <RichContent html={html} className="text-[12.5px] leading-[1.6] text-[#374151]" />
        </div>
        {clamped && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-11 bg-[linear-gradient(transparent,#fff)]" />}
      </div>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-1 inline-flex cursor-pointer items-center gap-[3px] border-none bg-transparent p-0 py-0.5 text-[12px] font-bold text-[#1d7bff]"
        >
          {open ? "Show less" : "Show more"}
          <ChevronDown className={cn("size-3", open && "rotate-180")} strokeWidth={2.8} />
        </button>
      )}
    </>
  );
}
