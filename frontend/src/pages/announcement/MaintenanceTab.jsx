import { useState } from "react";
import { Bell, Check, Clock, Info, LogOut, Trash2, User, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconAction } from "@/components/shared/list/cells.jsx";
import { Field, SoftButton, TextInput, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";
import PanelCard, { StatusPill } from "./PanelCard.jsx";
import RichTextEditor, { RichContent } from "./RichText.jsx";
import { DELETE_ACTION_CLASS } from "./AnnouncementList.jsx";
import { hasText } from "./announcementRules";

const SUBTITLE = "Banner shown to all users";
// grows to take the free height, never shrinks below its content (the tab scrolls instead)
const GROW = "flex-[1_0_auto]";

// The yellow notice strip users see (also the preview while writing).
function NoticeBanner({ prefix, content }) {
  return (
    <div className="flex gap-2.5 rounded-[14px] border border-[#f6d98b] bg-[#fff6dc] p-[clamp(12px,2dvh,16px)] text-[13px] leading-[1.55] text-notice-warn">
      <i className="mt-[7px] size-2 flex-none rounded-full bg-notice-warn-dot shadow-[0_0_0_3px_rgba(245,165,36,0.25)]" />
      <div className="min-w-0">
        <b className={prefix.trim() ? "break-words" : "font-medium opacity-60"}>{prefix.trim() || "Prefix"}</b>
        {hasText(content) ? <RichContent html={content} className="mt-0.5" /> : <p className="m-0 mt-0.5 opacity-60">The content you write appears here.</p>}
      </div>
    </div>
  );
}

// Bigger than the shared ToggleSwitch: this one switch is a serious action, so it should be easy to see and hit.
function BigSwitch({ on, onToggle, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className="inline-flex flex-none cursor-pointer flex-row-reverse items-center gap-2 border-none bg-transparent p-0 text-[13px] font-bold text-[#475569] outline-none focus-visible:[&>span:last-child]:ring-2 focus-visible:[&>span:last-child]:ring-brand-blue/40"
    >
      <span className={cn("relative h-[26px] w-[48px] rounded-full transition-colors", on ? "bg-[linear-gradient(100deg,#ef4444,#dc2626)]" : "bg-[#cbd5e1]")}>
        <span className={cn("absolute top-[3px] size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-[left]", on ? "left-[25px]" : "left-[3px]")} />
      </span>
      {on ? "On" : "Off"}
    </button>
  );
}

/**
 * IT only: sign every online user out. `on` / `onToggle` are the switch; `note` explains what happens in the current case.
 * `active` (published notice, switch on) turns the card red so it is obvious users are being kept out.
 */
function KickSwitch({ on, onToggle, title, note, active, className }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors",
        active ? "border-[#f3b4b4] bg-[#fff1f1]" : "border-modal-line bg-modal-card",
        className
      )}
    >
      <span className={cn("mt-0.5 grid size-8 flex-none place-items-center rounded-lg", active ? "bg-[#fde2e2] text-[#dc2626]" : "bg-[#e8f1ff] text-brand-blue")}>
        <LogOut className="size-4" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <b className="text-[14px] font-bold text-brand-navy">{title}</b>
          <BigSwitch on={on} onToggle={onToggle} label={title} />
        </div>
        <p className={cn("m-0 mt-0.5 text-[12px] leading-[1.45]", active ? "font-semibold text-[#b42318]" : "text-[#41588a]")}>{note}</p>
      </div>
    </div>
  );
}

/**
 * The form of the page: create the notice (nothing published yet) or edit it in place.
 * Left: Prefix + editor (the editor takes the rest of the height); right: live preview. Publish / Save sits in the footer.
 * Below 800px of content width the two columns stack and the body scrolls. Mount it keyed by the notice so it starts fresh.
 * `kick` is the current state of the global sign-out switch; `onSave` may return a promise (the form is left to the tab).
 */
function NoticeForm({ notice, isIt, kick, onSave, onCancel }) {
  const editing = Boolean(notice);
  const [prefix, setPrefix] = useState(notice?.prefix ?? "");
  const [content, setContent] = useState(notice?.content ?? "");
  // Create form only: the switch just marks the choice; nobody is signed out until Publish is pressed.
  const [kickChoice, setKickChoice] = useState(null); // null = follow the real switch (it may still be loading)
  const kickUsers = kickChoice ?? kick;
  const problem = !prefix.trim() ? "Enter a prefix." : !hasText(content) ? "Enter the maintenance content." : "";

  return (
    <PanelCard
      icon={Wrench}
      accent="amber" subtitle={SUBTITLE}
      title={editing ? "Edit Maintenance Notice" : "Create Maintenance Notice"}
      right={!editing && <span className="flex-none rounded-full bg-[#eef1f5] px-2.5 py-0.5 text-[11px] font-bold text-[#64748b]">No notice yet</span>}
      className={GROW}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {problem && (
            <p role="status" className="m-0 mr-auto flex min-w-0 items-center gap-2 text-[12.5px] font-bold text-[#8a5a00] @max-[599px]/page:basis-full">
              <i className="size-[7px] flex-none rounded-full bg-[#f59e0b] shadow-[0_0_0_3px_rgba(245,158,11,0.22)]" />
              {problem}
            </p>
          )}
          {editing && (
            <SoftButton onClick={onCancel} className="h-[clamp(38px,5.4dvh,42px)] min-w-[112px] px-[22px] text-[13.5px]">
              Cancel
            </SoftButton>
          )}
          <button
            type="button"
            disabled={Boolean(problem)}
            onClick={() => onSave({ prefix: prefix.trim(), content, ...(editing ? {} : { kickUsers }) })}
            className={cn(primaryButtonClass, "h-[clamp(38px,5.4dvh,42px)] min-w-[112px] px-[22px] text-[13.5px] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:brightness-100")}
          >
            <Check className="size-[15px]" strokeWidth={2.5} />
            {editing ? "Save" : "Publish"}
          </button>
        </div>
      }
    >
      <div className="grid flex-1 grid-cols-[minmax(0,6fr)_minmax(0,5fr)] grid-rows-[minmax(min-content,1fr)] gap-x-[18px] gap-y-3 @max-[799px]/page:grid-cols-1 @max-[799px]/page:grid-rows-none">
        <div className="flex min-w-0 flex-col gap-2.5">
          <Field label="Prefix">
            <TextInput value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g. System Maintenance:" autoFocus={editing} />
          </Field>
          <Field label="Content" as="div" className="flex min-h-0 flex-1 flex-col">
            <RichTextEditor
              value={content}
              onChange={setContent}
              label="Maintenance content"
              placeholder="Enter maintenance content"
              className="min-h-[160px] flex-1 modal-compact:min-h-[130px] @max-[799px]/page:min-h-[220px]"
            />
          </Field>
        </div>

        <div className="flex min-w-0 flex-col gap-2.5 border-l border-modal-divider pl-[18px] @max-[799px]/page:border-l-0 @max-[799px]/page:pl-0">
          <h3 className="m-0 flex items-center gap-[7px] text-[13px] font-bold text-brand-navy">
            <Bell className="size-4 text-brand-blue" strokeWidth={2.2} />
            Notice preview
          </h3>
          <NoticeBanner prefix={prefix} content={content} />
          <p className="m-0 flex gap-2 rounded-xl border border-modal-line bg-modal-card px-3 py-2 text-[12px] leading-[1.45] text-[#41588a]">
            <Info className="mt-px size-[15px] flex-none text-brand-blue" strokeWidth={2.2} />
            <span>Only one maintenance notice can exist at a time. Delete it to publish a different one.</span>
          </p>
          {isIt && !editing && (
            <KickSwitch
              on={kickUsers}
              onToggle={() => setKickChoice(!kickUsers)}
              title="Sign out online users"
              active={kickUsers}
              note={kickUsers ? "Everyone online is signed out the moment you press Publish." : "Off: the notice is shown and users stay signed in."}
            />
          )}
        </div>
      </div>
    </PanelCard>
  );
}

/**
 * Maintenance tab. Nothing published: the create form fills the page. Published: one row with Edit / Delete in a glass panel that fills the page;
 * Edit swaps the row for the same form in place (no modal). Delete is asked about by the page, then the create form returns.
 *  - onSave({ prefix, content, kickUsers? }) creates or updates and resolves true when it worked; onDelete() asks to delete
 *  - isIt / kick: only IT sees the sign-out switch; kick is its real state. onKickChange(on) is the switch of a published
 *    notice: the page confirms, then signs users out
 */
export default function MaintenanceTab({ notice, isIt, kick, onSave, onDelete, onKickChange }) {
  const [editing, setEditing] = useState(false);

  if (!notice || editing) {
    return (
      <NoticeForm
        key={notice?.id ?? "new"}
        notice={notice}
        isIt={isIt}
        kick={kick}
        onCancel={() => setEditing(false)}
        onSave={async (values) => {
          if (await onSave(values)) setEditing(false);
        }}
      />
    );
  }

  return (
    <PanelCard icon={Wrench} accent="amber" subtitle={SUBTITLE} title="Maintenance Notice" right={<StatusPill className="@max-[479px]/page:hidden">Published</StatusPill>} className={GROW}>
      <article className="relative flex-none rounded-[14px] bg-white py-3.5 pl-[22px] pr-3.5 [filter:drop-shadow(0_2px_3px_rgba(15,23,42,0.1))] before:absolute before:inset-y-0 before:left-0 before:w-[5px] before:rounded-l-[14px] before:bg-[linear-gradient(180deg,#ffb347,#f5841f)]">
        <header className="flex items-start gap-2">
          <h3 className="m-0 min-w-0 flex-1 break-words text-[15px] font-extrabold text-brand-navy">{notice.prefix}</h3>
          <div className="flex flex-none items-center gap-0.5">
            <IconAction title="Edit notice" aria-label="Edit notice" onClick={() => setEditing(true)} />
            <IconAction icon={Trash2} className={DELETE_ACTION_CLASS} title="Delete notice" aria-label="Delete notice" onClick={onDelete} />
          </div>
        </header>
        <RichContent html={notice.content} className="mt-1.5 text-[13.5px] leading-[1.6] text-[#374151]" />
        <footer className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-0.5 border-t border-[#eef1f6] pt-2.5 text-[11.5px] text-dash-sub">
          <span className="inline-flex items-center gap-1.5">
            <User className="size-3.5 text-dash-faint" strokeWidth={2.2} />
            Created by {notice.createdBy}
          </span>
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Clock className="size-3.5 text-dash-faint" strokeWidth={2.2} />
            {notice.createdAt}
          </span>
        </footer>
      </article>

      {isIt && (
        <KickSwitch
          on={kick}
          onToggle={() => onKickChange(!kick)}
          title="Sign out online users"
          active={kick}
          note={kick ? "On: online users were signed out and cannot sign in until this is turned off." : "Turning this on signs out everyone who is online right away."}
        />
      )}
    </PanelCard>
  );
}
