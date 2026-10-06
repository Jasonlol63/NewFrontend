import { useState } from "react";
import { Bell, Info, Megaphone, SquarePen } from "lucide-react";
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
  const editing = mode === "edit";
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [listTitle, setListTitle] = useState(announcement?.listTitle ?? "");
  const [content, setContent] = useState(announcement?.content ?? "");

  const problem = !title.trim() ? "Enter a title." : !hasText(content) ? "Enter the announcement content." : "";

  return (
    <FormModal
      icon={editing ? SquarePen : Megaphone}
      title={editing ? "Edit Announcement" : "New Announcement"}
      onClose={onClose}
      onSave={() => onSave({ title: title.trim(), listTitle: listTitle.trim(), content })}
      saveLabel={editing ? "Save" : "Publish"}
      saveDisabled={Boolean(problem)}
      footerStart={
        problem && (
          <p role="status" className="m-0 mr-auto flex min-w-0 items-center gap-2 text-[12.5px] font-bold text-[#8a5a00] @max-[599px]/main:basis-full">
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
      <FormCard title="Announcement" bodyClassName="flex flex-col gap-2.5 modal-compact:gap-2 @max-[899px]/main:overflow-visible">
        <Field label="Title">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter announcement title" autoFocus />
        </Field>
        <Field label="List section title" optional>
          <TextInput value={listTitle} onChange={(e) => setListTitle(e.target.value)} placeholder={`e.g. ${DEFAULT_LIST_TITLE}`} />
          <span className="mt-1 ml-0.5 block text-[11px] leading-snug text-[#6b7fa5] modal-tiny:hidden">
            Shown above the numbered list on the notification card. Leave empty to use the default.
          </span>
        </Field>
        <Field label="Content" as="div" className="flex min-h-0 flex-1 flex-col">
          <RichTextEditor
            value={content}
            onChange={setContent}
            label="Announcement content"
            placeholder="Enter announcement content"
            className="min-h-[170px] flex-1 modal-compact:min-h-[130px] @max-[899px]/main:min-h-[220px]"
          />
        </Field>
      </FormCard>

      <FormCard title="Notification preview" bodyClassName="flex flex-col gap-2.5 @max-[899px]/main:overflow-visible">
        <NotificationPreview title={title} listTitle={listTitle} content={content} />
        <p className="m-0 flex gap-2 rounded-xl border border-modal-line bg-modal-card px-3 py-2 text-[12px] leading-[1.45] text-[#41588a]">
          <Info className="mt-px size-[15px] flex-none text-brand-blue" strokeWidth={2.2} />
          <span>{editing ? "Saving updates this announcement for every user." : "Publishing sends this to every user's notification bell."}</span>
        </p>
        <p className="m-0 flex items-center gap-1.5 text-[11px] text-[#6b7fa5]">
          <Bell className="size-3.5 flex-none" strokeWidth={2.2} />
          This is how the card looks to users.
        </p>
      </FormCard>
    </FormModal>
  );
}
