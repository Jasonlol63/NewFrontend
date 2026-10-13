import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RichContent } from "./RichText.jsx";
import { DEFAULT_LIST_TITLE, THANKS_LINE, hasText } from "./announcementRules";

/** How an announcement looks on the notification card users see (live while the form is being filled in). */
export default function NotificationPreview({ title, listTitle, content }) {
  const { t } = useTranslation("announcement");
  return (
    <div className="rounded-[14px] border border-[#e3ecfb] bg-white p-[clamp(12px,2dvh,18px)] shadow-notice">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid size-[26px] flex-none place-items-center rounded-lg bg-brand-sweep text-white">
          <Bell className="size-3.5" strokeWidth={2.4} />
        </span>
        <b className={title.trim() ? "min-w-0 flex-1 break-words type-body font-semibold! text-brand-navy" : "min-w-0 flex-1 type-body font-medium! text-[#9aa8c0]"}>
          {title.trim() || t("preview.titlePlaceholder")}
        </b>
        <small className="flex-none type-caption text-dash-faint">{t("preview.justNow")}</small>
      </div>
      <div className="mb-1 type-table-cell font-semibold! text-brand-navy">{listTitle.trim() || DEFAULT_LIST_TITLE}</div>
      {hasText(content) ? (
        <RichContent html={content} className="type-table-cell font-normal! leading-[1.6]! text-[#374151]" />
      ) : (
        <p className="m-0 type-table-cell font-normal! text-[#9aa8c0]">{t("preview.contentPlaceholder")}</p>
      )}
      <div className="mt-2 type-caption text-dash-sub">{THANKS_LINE}</div>
    </div>
  );
}
