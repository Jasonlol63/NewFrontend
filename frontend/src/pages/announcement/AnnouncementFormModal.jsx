import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Megaphone, SquarePen } from "lucide-react";
import { cn } from "@/lib/utils";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import FormCard from "@/components/shared/form-modal/FormCard.jsx";
import { Field, TextInput } from "@/components/shared/form-modal/fields.jsx";
import RichTextEditor from "./RichText.jsx";
import NotificationPreview from "./NotificationPreview.jsx";
import { DEFAULT_LIST_TITLE, hasText } from "./announcementRules";

/**
 * New / Edit Announcement: fills the content area like the other form modals. Left card: the fields and the editor
 * (the editor takes the rest of the height); right card: live preview of the notification card. Below 900px wide the
 * two cards stack and only the body scrolls.
 *  - announcement: the one being edited (mode "edit")
 *  - onSave({ title, listTitle, content }) / onClose(). Mount it only while open.
 */
export default function AnnouncementFormModal({ mode, announcement, onClose, onSave }) {
  const { t } = useTranslation("announcement");
  const editing = mode === "edit";
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [listTitle, setListTitle] = useState(announcement?.listTitle ?? "");
  const [content, setContent] = useState(announcement?.content ?? "");

  const problem = !title.trim() ? t("form.enterTitle") : !hasText(content) ? t("form.enterContent") : "";

  return (
    <FormModal
      icon={editing ? SquarePen : Megaphone}
      title={editing ? t("form.edit") : t("form.new")}
      onClose={onClose}
      onSave={() => onSave({ title: title.trim(), listTitle: listTitle.trim(), content })}
      saveLabel={editing ? t("common:save") : t("form.publish")}
      saveDisabled={Boolean(problem)}
      footerStart={
        problem && (
          <p role="status" className="m-0 mr-auto flex min-w-0 items-center gap-2 fm-count text-[#8a5a00] @max-[599px]/main:basis-full">
            <i className="size-[7px] flex-none rounded-full bg-[#f59e0b] shadow-[0_0_0_3px_rgba(245,158,11,0.22)]" />
            {problem}
          </p>
        )
      }
      bodyClassName={cn(
        "grid grid-cols-[minmax(0,6fr)_minmax(0,5fr)] grid-rows-[minmax(0,1fr)]",
        "@max-[899px]/main:grid-cols-1 @max-[899px]/main:grid-rows-[max-content_max-content] @max-[899px]/main:content-start @max-[899px]/main:overflow-y-auto"
      )}
    >
      <FormCard title={t("form.card")} bodyClassName="flex flex-col gap-2.5 modal-compact:gap-2 @max-[899px]/main:overflow-visible">
        <Field label={t("form.title")}>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("form.titlePlaceholder")} autoFocus />
        </Field>
        <Field label={t("form.listTitle")} optional>
          <TextInput value={listTitle} onChange={(e) => setListTitle(e.target.value)} placeholder={t("form.listTitlePlaceholder", { title: DEFAULT_LIST_TITLE })} />
        </Field>
        <Field label={t("form.content")} as="div" className="flex min-h-0 flex-1 flex-col">
          <RichTextEditor
            value={content}
            onChange={setContent}
            label={t("form.contentLabel")}
            placeholder={t("form.contentPlaceholder")}
            className="min-h-[170px] flex-1 modal-compact:min-h-[130px] @max-[899px]/main:min-h-[220px]"
          />
        </Field>
      </FormCard>

      <FormCard title={t("form.preview")} bodyClassName="flex flex-col gap-2.5 @max-[899px]/main:overflow-visible">
        <NotificationPreview title={title} listTitle={listTitle} content={content} />
        <p className="m-0 flex items-center gap-1.5 fm-help text-[#6b7fa5]">
          <Bell className="size-3.5 flex-none" strokeWidth={2.2} />
          {t("form.previewNote")}
        </p>
      </FormCard>
    </FormModal>
  );
}
