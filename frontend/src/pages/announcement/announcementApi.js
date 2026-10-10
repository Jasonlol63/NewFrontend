import { getJson, postForm, postJson } from "@/lib/api";
import { joinContent, telegramUrl, toAnnouncement, toContact, toNotice } from "./announcementRules";

// Spring Boot calls of the Announcement page. Every list is read again after a change (the backend fills in
// id / created time itself), so these only return what the page needs.

const ANNOUNCEMENT = "/api/announcement";

export async function fetchAnnouncements() {
  const { data } = await getJson(`${ANNOUNCEMENT}/listAnnouncement`);
  return (data ?? []).map(toAnnouncement);
}

// The bell's calls: open to every signed-in user of every company (the list above is C168-only). The read state lives on the
// backend per login account: a count of the announcements newer than the account's last "mark all read".
export async function fetchBellAnnouncements() {
  const { data } = await getJson(`${ANNOUNCEMENT}/getDashboardAnnouncements`);
  return (data ?? []).map(toAnnouncement);
}

export async function fetchUnreadCount() {
  const { data } = await getJson(`${ANNOUNCEMENT}/unreadCount`);
  return Number(data?.unreadCount) || 0;
}

export const markAnnouncementsRead = () => postJson(`${ANNOUNCEMENT}/markRead`, {});

export const createAnnouncement =({ title, listTitle, content }) =>
  postJson(`${ANNOUNCEMENT}/addAnnouncementContent`, { title, content: joinContent(listTitle, content) });

export const updateAnnouncement = (id, { title, listTitle, content }) =>
  postJson(`${ANNOUNCEMENT}/updateAnnouncement`, { id, title, content: joinContent(listTitle, content) });

export const deleteAnnouncement = (id) => postJson(`${ANNOUNCEMENT}/deleteAnnouncement`, { id });

export async function fetchNotice() {
  const { data } = await getJson(`${ANNOUNCEMENT}/listMaintenance`);
  return toNotice(data);
}

export const createNotice = ({ prefix, content }) => postJson(`${ANNOUNCEMENT}/addMaintenanceContent`, { prefix, content });
export const updateNotice = (id, { prefix, content }) => postJson(`${ANNOUNCEMENT}/updateMaintenance`, { id, prefix, content });
export const deleteNotice = (id) => postJson(`${ANNOUNCEMENT}/deleteMaintenance`, { id });

// IT only: the global "sign out online users" switch (a flag of its own, not a column of the notice).
export async function fetchKickMode() {
  const { data } = await getJson("/api/it/maintenance-mode");
  return Boolean(data?.enabled);
}

export const setKickMode = (enabled) => postForm("/api/it/maintenance-mode", { enabled: String(enabled) });

export async function fetchContact() {
  const { data } = await getJson("/api/settings/getTelegramLink");
  return toContact(data);
}

/** An empty handle saves an empty link, which hides the button on the login page. */
export const saveContact = (handle) => postJson("/api/settings/updateTelegramLink", { telegramSupportLink: telegramUrl(handle) });
