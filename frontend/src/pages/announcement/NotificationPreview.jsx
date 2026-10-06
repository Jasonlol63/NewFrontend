import { Bell } from "lucide-react";
import { RichContent } from "./RichText.jsx";
import { DEFAULT_LIST_TITLE, THANKS_LINE, hasText } from "./announcementRules";

/** How an announcement looks on the notification card users see (live while the form is being filled in). */
export default function NotificationPreview({ title, listTitle, content }) {
  return (
    <div className="rounded-[14px] border border-[#e3ecfb] bg-white p-[clamp(12px,2dvh,18px)] shadow-notice">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid size-[26px] flex-none place-items-center rounded-lg bg-brand-sweep text-white">
          <Bell className="size-3.5" strokeWidth={2.4} />
        </span>
        <b className={title.trim() ? "min-w-0 flex-1 break-words text-[14px] text-brand-navy" : "min-w-0 flex-1 text-[14px] font-medium text-[#9aa8c0]"}>
          {title.trim() || "Announcement title"}
        </b>
        <small className="flex-none text-[10.5px] text-dash-faint">just now</small>
      </div>
      <div className="mb-1 text-[13px] font-bold text-brand-navy">{listTitle.trim() || DEFAULT_LIST_TITLE}</div>
      {hasText(content) ? (
        <RichContent html={content} className="text-[12.5px] leading-[1.6] text-[#374151]" />
      ) : (
        <p className="m-0 text-[12.5px] text-[#9aa8c0]">The content you write appears here.</p>
      )}
      <div className="mt-2 text-[11.5px] text-dash-sub">{THANKS_LINE}</div>
    </div>
  );
}
