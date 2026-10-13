import { Clock, Trash2, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { IconAction } from "@/components/shared/list/cells.jsx";
import { RichContent } from "./RichText.jsx";
import { DEFAULT_LIST_TITLE, THANKS_LINE, versionOf } from "./announcementRules";

// Same icon button as Edit in Admin / Account, red for Delete.
export const DELETE_ACTION_CLASS = "text-[#dc2626] enabled:hover:bg-[#fee8e8]";

function AnnouncementCard({ announcement: a, latest, onEdit, onDelete }) {
  const { t } = useTranslation("announcement");
  const version = versionOf(a.content);
  return (
    <article
      className={cn(
        "relative flex-none overflow-hidden rounded-[16px] border border-modal-line bg-white/55 py-3 pl-[18px] pr-3.5 shadow-modal-card backdrop-blur-[14px]",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        latest ? "before:bg-[linear-gradient(180deg,#34d399,#059669)]" : "before:bg-seg-active"
      )}
    >
      <header className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="m-0 min-w-0 break-words type-card-title tracking-[-0.2px] text-brand-navy">{a.title}</h3>
          {version && <span className="rounded-full bg-[#e8f1ff] px-2.5 py-px type-caption font-semibold! text-[#0b4fd0]">{t("page.version", { version })}</span>}
          {latest && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#e6f8ee] px-2.5 py-px type-caption font-semibold! text-[#15803d]">
              <i className="size-1.5 rounded-full bg-[#22c55e]" />
              {t("page.latest")}
            </span>
          )}
        </div>
        <div className="flex flex-none items-center gap-0.5">
          <IconAction aria-label={t("page.editAria")} onClick={() => onEdit(a)} />
          <IconAction icon={Trash2} className={DELETE_ACTION_CLASS} aria-label={t("page.deleteAria")} onClick={() => onDelete(a)} />
        </div>
      </header>

      <div className="mt-1.5 rounded-xl border border-modal-line bg-white/60 px-3.5 py-2.5 type-body font-normal! leading-[1.6] text-[#1f2937]">
        <div className="font-semibold text-brand-navy">{a.listTitle || DEFAULT_LIST_TITLE}</div>
        <RichContent html={a.content} />
        <div className="mt-1 text-dash-sub">{THANKS_LINE}</div>
      </div>

      <footer className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-0.5 type-caption text-dash-sub">
        <span className="inline-flex items-center gap-1.5">
          <User className="size-3.5 text-dash-faint" strokeWidth={2.2} />
          {t("page.createdBy", { name: a.createdBy })}
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Clock className="size-3.5 text-dash-faint" strokeWidth={2.2} />
          {a.createdAt}
        </span>
      </footer>
    </article>
  );
}

/** Every announcement in full, newest first; the list scrolls inside itself, the page never does. */
export default function AnnouncementList({ announcements, emptyMessage, onEdit, onDelete }) {
  if (!announcements.length) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center rounded-2xl border border-dashed border-modal-input-line bg-white/40 p-6 text-center type-body text-[#5b74a3]">
        {emptyMessage}
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-0.5 pr-1.5 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
      {announcements.map((a, i) => (
        <AnnouncementCard key={a.id} announcement={a} latest={i === 0} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
