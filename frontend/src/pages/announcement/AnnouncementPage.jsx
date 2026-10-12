import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Megaphone, Plus, Search, Settings } from "lucide-react";
import SlideTabs from "@/components/shared/SlideTabs.jsx";
import DeleteDialog from "@/components/shared/DeleteDialog.jsx";
import StatusDialog from "@/components/shared/StatusDialog.jsx";
import Toast from "@/components/shared/Toast.jsx";
import { useNotice } from "@/hooks/useNotice";
import { TRAY } from "@/components/shared/list/DataTable.jsx";
import { PrimaryButton } from "@/components/shared/list/ListToolbar.jsx";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { REALTIME_DOMAINS, useRealtime } from "@/lib/realtime/realtimeEvents";
import AnnouncementList from "./AnnouncementList.jsx";
import AnnouncementFormModal from "./AnnouncementFormModal.jsx";
import MaintenanceTab from "./MaintenanceTab.jsx";
import TelegramCard from "./TelegramCard.jsx";
import {
  createAnnouncement,
  createNotice,
  deleteAnnouncement,
  deleteNotice,
  fetchAnnouncements,
  fetchContact,
  fetchKickMode,
  fetchNotice,
  saveContact,
  setKickMode,
  updateAnnouncement,
  updateNotice,
} from "./announcementApi";
import { filterAnnouncements, versionOf } from "./announcementRules";

const EMPTY_CONTACT = { handle: "", updatedBy: "", updatedAt: "" };

/**
 * Announcement: announcements (every one shown in full, newest first) and Settings: the single maintenance notice and the
 * Telegram support link of the login page. Data comes from the Spring Boot API (announcementApi.js); every list is read
 * again after a change. New / Edit announcement open a full-area form modal; the maintenance notice is edited in place on its tab; Delete asks first.
 * The sign-out switch (IT only) is the global maintenance mode flag, read and written on its own.
 */
export default function AnnouncementPage() {
  const { t } = useTranslation(["announcement", "common"]);
  const viewer = useCurrentUser();
  const isIt = viewer?.role === "it";

  const [tab, setTab] = useState("announcement");
  const [announcements, setAnnouncements] = useState([]);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState(null);
  const [contact, setContact] = useState(EMPTY_CONTACT);
  const [kick, setKick] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const { toasts, push, dismiss } = useNotice(5000);

  // null = closed, { mode: "new" } or { mode: "edit", item } = open
  const [announcementForm, setAnnouncementForm] = useState(null);
  const [toDelete, setToDelete] = useState(null); // { kind: "announcement" | "notice", item }
  const closeAnnouncementForm = useCallback(() => setAnnouncementForm(null), []);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchAnnouncements(), fetchNotice(), fetchContact()])
      .then(([list, current, link]) => {
        if (!alive) return;
        setAnnouncements(list);
        setNotice(current);
        setContact(link);
      })
      .catch((e) => {
        if (!alive) return;
        setLoadError(e.message);
        push(t("toast.loadFail"), "error", e.message, {
          label: t("common:retry"),
          onClick: () => {
            setLoadError("");
            setLoading(true);
            setReloadKey((k) => k + 1);
          },
        });
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // Someone else published, edited or deleted an announcement or the notice: read the lists again.
  useRealtime([REALTIME_DOMAINS.ANNOUNCEMENTS, REALTIME_DOMAINS.MAINTENANCE], () => setReloadKey((k) => k + 1));

  useEffect(() => {
    if (!isIt) return;
    fetchKickMode()
      .then(setKick)
      .catch((e) => push(t("toast.kickRead"), "error", e.message));
  }, [isIt]);

  // Runs one change: blocks double clicks, shows the backend's message when it fails. Returns true on success.
  const run = useCallback(async (title, action) => {
    setBusy(true);
    try {
      await action();
      return true;
    } catch (e) {
      push(title, "error", e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const sorted = useMemo(() => [...announcements].sort((a, b) => b.id - a.id), [announcements]);
  const shown = useMemo(() => filterAnnouncements(sorted, search), [sorted, search]);

  const saveAnnouncement = async (values) => {
    if (busy) return;
    const editing = announcementForm.mode === "edit";
    const ok = await run(editing ? t("toast.saveFail") : t("toast.publishFail"), async () => {
      if (editing) await updateAnnouncement(announcementForm.item.id, values);
      else await createAnnouncement(values);
      setAnnouncements(await fetchAnnouncements());
    });
    if (ok) {
      setAnnouncementForm(null);
      push(editing ? t("toast.saved") : t("toast.published"));
    }
  };

  // Create: publish the notice, then (IT, switch on) turn the sign-out on. Edit: only the text changes.
  const saveNotice = async ({ prefix, content, kickUsers }) => {
    if (busy) return false;
    const editing = Boolean(notice);
    let partial = false;
    const ok = await run(editing ? t("toast.noticeSaveFail") : t("toast.noticePublishFail"), async () => {
      if (notice) {
        await updateNotice(notice.id, { prefix, content });
        setNotice(await fetchNotice());
        return;
      }
      await createNotice({ prefix, content });
      setNotice(await fetchNotice());
      if (isIt && kickUsers !== kick) {
        try {
          await setKickMode(kickUsers);
          setKick(kickUsers);
        } catch (e) {
          partial = true;
          push(t("toast.noticeKickFailed"), "error", e.message);
        }
      }
    });
    if (ok && !partial) push(editing ? t("toast.noticeSaved") : t("toast.noticePublished"));
    return ok;
  };

  // Turning the sign-out switch ON signs everyone out at once, so it is confirmed first; OFF just lets users sign in again.
  const [kickAsk, setKickAsk] = useState(false);
  const changeKick = async (on) => {
    if (busy) return;
    if (on) {
      setKickAsk(true);
      return;
    }
    if (await run(t("toast.kickOffFail"), () => setKickMode(false))) {
      setKick(false);
      push(t("toast.kickOff"));
    }
  };
  const confirmKick = async () => {
    setKickAsk(false);
    if (await run(t("toast.kickOnFail"), () => setKickMode(true))) {
      setKick(true);
      push(t("toast.kickOn"));
    }
  };

  const confirmDelete = async () => {
    if (busy) return;
    const { kind, item } = toDelete;
    setToDelete(null);
    const ok = await run(kind === "announcement" ? t("toast.deleteFail") : t("toast.noticeDeleteFail"), async () => {
      if (kind === "announcement") {
        await deleteAnnouncement(item.id);
        setAnnouncements(await fetchAnnouncements());
        return;
      }
      // Users must not stay locked out with no switch left to turn it off, so the sign-out goes off first.
      if (isIt && kick) {
        await setKickMode(false);
        setKick(false);
      }
      await deleteNotice(item.id);
      setNotice(await fetchNotice());
    });
    if (ok) push(kind === "announcement" ? t("toast.deleted") : t("toast.noticeDeleted"));
  };

  const saveHandle = async (handle) => {
    if (busy) return;
    const ok = await run(t("toast.linkFail"), async () => {
      await saveContact(handle);
      setContact(await fetchContact());
    });
    if (ok) push(t("page.savedTitle"), "success", handle ? t("page.savedShown") : t("page.savedHidden"));
  };

  const deleteLabel = !toDelete
    ? []
    : [toDelete.kind === "announcement" ? [toDelete.item.title, versionOf(toDelete.item.content) && `Version ${versionOf(toDelete.item.content)}`].filter(Boolean).join(" · ") : toDelete.item.prefix];

  return (
    <div className="@container/page relative flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <Toast toasts={toasts} onClose={dismiss} />
      <div className="flex flex-none flex-wrap items-center gap-2.5 px-1">
        <SlideTabs
          value={tab}
          onChange={setTab}
          className="max-w-full"
          tabClassName="@max-[479px]/page:min-w-0 @max-[479px]/page:px-3"
          labelClassName="@max-[479px]/page:hidden"
          options={[
            { value: "announcement", label: t("page.tabAnnouncement"), icon: Megaphone, count: announcements.length },
            { value: "settings", label: t("page.tabSettings"), icon: Settings },
          ]}
        />

        {tab === "announcement" && (
          <>
            <PrimaryButton icon={Plus} className="h-9 py-0" onClick={() => setAnnouncementForm({ mode: "new" })}>
              {t("page.new")}
            </PrimaryButton>
            <label className="flex h-9 w-full max-w-[280px] min-w-[180px] flex-1 items-center gap-2 rounded-[10px] border border-dash-line bg-white px-3 text-[13px] shadow-[0_1px_3px_rgba(15,23,42,0.05)] focus-within:border-[#3b82f6]">
              <Search className="size-4 flex-none text-dash-faint" strokeWidth={2.2} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={t("page.searchLabel")}
                className="w-full bg-transparent outline-none placeholder:text-dash-faint"
                placeholder={t("page.search")}
              />
            </label>
          </>
        )}
      </div>

      {(loading || loadError) && (
        <div className="grid min-h-0 flex-1 place-items-center rounded-2xl border border-dashed border-modal-input-line bg-white/40 p-6 text-center text-[13px] text-[#5b74a3]">
          {loading ? (
            t("common:loading")
          ) : (
            <div className="flex flex-col items-center gap-3">
              <span className="font-semibold text-[#5b74a3]">{t("toast.loadFail")}</span>
              <PrimaryButton
                className="h-9 py-0"
                onClick={() => {
                  setLoadError("");
                  setLoading(true);
                  setReloadKey((k) => k + 1);
                }}
              >
                {t("common:retry")}
              </PrimaryButton>
            </div>
          )}
        </div>
      )}

      {!loading && !loadError && tab === "announcement" && (
        <>
          <AnnouncementList
            announcements={shown}
            emptyMessage={announcements.length ? t("page.noMatch") : t("page.noAnnouncements")}
            onEdit={(item) => setAnnouncementForm({ mode: "edit", item })}
            onDelete={(item) => setToDelete({ kind: "announcement", item })}
          />
          <div className="flex flex-none items-center pt-1">
            <span className={`rounded-[10px] px-2.5 py-1 text-[11px] font-medium text-[#33507f] [@media(min-height:760px)]:rounded-xl [@media(min-height:760px)]:px-3 [@media(min-height:760px)]:py-[7px] [@media(min-height:760px)]:text-[12.5px] ${TRAY}`}>
              {search.trim() ? t("page.showingOf", { shown: shown.length, total: announcements.length }) : t("page.showingAll", { total: announcements.length })}
            </span>
          </div>
        </>
      )}

      {/* Settings: the maintenance notice takes the free height, the Telegram link is a compact card under it.
          When both do not fit (short screens, the notice form open) this area scrolls, never the page. */}
      {!loading && !loadError && tab === "settings" && (
        <div className="flex min-h-0 flex-1 flex-col gap-[clamp(8px,1.5dvh,12px)] overflow-y-auto p-0.5 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
          <MaintenanceTab
            notice={notice}
            isIt={isIt}
            kick={kick}
            onSave={saveNotice}
            onDelete={() => setToDelete({ kind: "notice", item: notice })}
            onKickChange={changeKick}
          />
          <TelegramCard saved={contact} onSave={saveHandle} />
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
        note={toDelete?.kind === "notice" && isIt && kick ? t("page.deleteNoticeNote") : undefined}
        onConfirm={confirmDelete}
      />
      <StatusDialog
        open={kickAsk}
        onOpenChange={setKickAsk}
        type="warning"
        title={t("page.kickAskTitle")}
        description={t("page.kickAskText")}
        confirmText={t("page.kickAskConfirm")}
        cancelText={t("common:cancel")}
        onConfirm={confirmKick}
      />
    </div>
  );
}
