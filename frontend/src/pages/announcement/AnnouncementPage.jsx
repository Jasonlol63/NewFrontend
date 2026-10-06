import { useCallback, useMemo, useState } from "react";
import { Megaphone, Plus, Search, Settings } from "lucide-react";
import SlideTabs from "@/components/shared/SlideTabs.jsx";
import DeleteDialog from "@/components/shared/DeleteDialog.jsx";
import StatusDialog from "@/components/shared/StatusDialog.jsx";
import { TRAY } from "@/components/shared/list/DataTable.jsx";
import { PrimaryButton } from "@/components/shared/list/ListToolbar.jsx";
import AnnouncementList from "./AnnouncementList.jsx";
import AnnouncementFormModal from "./AnnouncementFormModal.jsx";
import MaintenanceTab from "./MaintenanceTab.jsx";
import TelegramCard from "./TelegramCard.jsx";
import {
  CURRENT_USER,
  MOCK_ANNOUNCEMENTS,
  MOCK_CONTACT,
  MOCK_NOTICE,
  filterAnnouncements,
  formatNow,
  versionOf,
} from "./announcementRules";

/**
 * Announcement: announcements (every one shown in full, newest first) and Settings: the single maintenance notice and the
 * Telegram support link of the login page. Design preview: the data lives in page state only and nothing here
 * calls the API yet. New / Edit announcement open a full-area form modal; the maintenance notice is edited in place on its tab; Delete asks first.
 */
export default function AnnouncementPage() {
  const [tab, setTab] = useState("announcement");
  const [announcements, setAnnouncements] = useState(MOCK_ANNOUNCEMENTS);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState(MOCK_NOTICE);
  const [contact, setContact] = useState(MOCK_CONTACT);

  // null = closed, { mode: "new" } or { mode: "edit", item } = open
  const [announcementForm, setAnnouncementForm] = useState(null);
  const [toDelete, setToDelete] = useState(null); // { kind: "announcement" | "notice", item }
  const [contactSaved, setContactSaved] = useState(false);
  const closeAnnouncementForm = useCallback(() => setAnnouncementForm(null), []);

  const sorted = useMemo(() => [...announcements].sort((a, b) => b.id - a.id), [announcements]);
  const shown = useMemo(() => filterAnnouncements(sorted, search), [sorted, search]);

  const saveAnnouncement = (values) => {
    if (announcementForm.mode === "edit") {
      setAnnouncements((list) => list.map((a) => (a.id === announcementForm.item.id ? { ...a, ...values } : a)));
    } else {
      setAnnouncements((list) => [{ ...values, id: Math.max(0, ...list.map((a) => a.id)) + 1, createdBy: CURRENT_USER, createdAt: formatNow() }, ...list]);
    }
    setAnnouncementForm(null);
  };

  const saveNotice = (values) => {
    setNotice((cur) => (cur ? { ...cur, ...values } : { id: 1, ...values, createdBy: CURRENT_USER, createdAt: formatNow() }));
  };

  // Turning the sign-out switch ON signs everyone out at once, so it is confirmed first; OFF just lets users sign in again.
  const [kickAsk, setKickAsk] = useState(false);
  const changeKick = (on) => (on ? setKickAsk(true) : setNotice((cur) => ({ ...cur, kickUsers: false })));
  const confirmKick = () => {
    setNotice((cur) => ({ ...cur, kickUsers: true }));
    setKickAsk(false);
  };

  const confirmDelete = () => {
    if (toDelete.kind === "announcement") setAnnouncements((list) => list.filter((a) => a.id !== toDelete.item.id));
    else setNotice(null);
    setToDelete(null);
  };

  const deleteLabel = !toDelete
    ? []
    : [toDelete.kind === "announcement" ? [toDelete.item.title, versionOf(toDelete.item.content) && `Version ${versionOf(toDelete.item.content)}`].filter(Boolean).join(" · ") : toDelete.item.prefix];

  return (
    <div className="@container/page flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <div className="flex flex-none flex-wrap items-center gap-2.5 px-1">
        <SlideTabs
          value={tab}
          onChange={setTab}
          className="max-w-full"
          tabClassName="@max-[479px]/page:min-w-0 @max-[479px]/page:px-3"
          labelClassName="@max-[479px]/page:hidden"
          options={[
            { value: "announcement", label: "Announcement", icon: Megaphone, count: announcements.length },
            { value: "settings", label: "Settings", icon: Settings },
          ]}
        />

        {tab === "announcement" && (
          <>
            <PrimaryButton icon={Plus} className="h-9 py-0" onClick={() => setAnnouncementForm({ mode: "new" })}>
              New Announcement
            </PrimaryButton>
            <label className="flex h-9 w-full max-w-[280px] min-w-[180px] flex-1 items-center gap-2 rounded-[10px] border border-dash-line bg-white px-3 text-[13px] shadow-[0_1px_3px_rgba(15,23,42,0.05)] focus-within:border-[#3b82f6]">
              <Search className="size-4 flex-none text-dash-faint" strokeWidth={2.2} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search announcements"
                className="w-full bg-transparent outline-none placeholder:text-dash-faint"
                placeholder="Search title / content"
              />
            </label>
          </>
        )}
      </div>

      {tab === "announcement" && (
        <>
          <AnnouncementList
            announcements={shown}
            emptyMessage={announcements.length ? "No announcements match your search" : "No announcements yet"}
            onEdit={(item) => setAnnouncementForm({ mode: "edit", item })}
            onDelete={(item) => setToDelete({ kind: "announcement", item })}
          />
          <div className="flex flex-none items-center pt-1">
            <span className={`rounded-[10px] px-2.5 py-1 text-[11px] font-medium text-[#33507f] [@media(min-height:760px)]:rounded-xl [@media(min-height:760px)]:px-3 [@media(min-height:760px)]:py-[7px] [@media(min-height:760px)]:text-[12.5px] ${TRAY}`}>
              {search.trim() ? `Showing ${shown.length} of ${announcements.length} announcements` : `Showing all ${announcements.length} announcements`}
            </span>
          </div>
        </>
      )}

      {/* Settings: the maintenance notice takes the free height, the Telegram link is a compact card under it.
          When both do not fit (short screens, the notice form open) this area scrolls, never the page. */}
      {tab === "settings" && (
        <div className="flex min-h-0 flex-1 flex-col gap-[clamp(8px,1.5dvh,12px)] overflow-y-auto p-0.5 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
          <MaintenanceTab notice={notice} onSave={saveNotice} onDelete={() => setToDelete({ kind: "notice", item: notice })} onKickChange={changeKick} />
          <TelegramCard
            saved={contact}
            onSave={(handle) => {
              setContact({ handle, updatedBy: CURRENT_USER, updatedAt: formatNow() });
              setContactSaved(true);
            }}
          />
        </div>
      )}

      {announcementForm && (
        <AnnouncementFormModal mode={announcementForm.mode} announcement={announcementForm.item} onClose={closeAnnouncementForm} onSave={saveAnnouncement} />
      )}

      <DeleteDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        names={deleteLabel}
        noun={toDelete?.kind === "notice" ? "maintenance notice" : "announcement"}
        onConfirm={confirmDelete}
      />
      <StatusDialog
        open={kickAsk}
        onOpenChange={setKickAsk}
        type="warning"
        title="Sign out all online users?"
        description="Everyone who is online will be signed out right away and cannot sign in until you turn this off."
        confirmText="Sign out users"
        cancelText="Cancel"
        onConfirm={confirmKick}
      />
      <StatusDialog
        open={contactSaved}
        onOpenChange={setContactSaved}
        type="success"
        title="Support link saved"
        description={contact.handle ? "The Telegram button on the login page now uses the new link." : "The Telegram button is hidden from the login page."}
        confirmText="OK"
      />
    </div>
  );
}
