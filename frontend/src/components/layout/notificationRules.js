// Rules for the bell's notification panel (the announcements users see). What is unread is decided by the backend, per login
// account and announcement (announcement_read): the backend returns the unread ids and count. An announcement becomes read
// by the check button, Show more, a click on its card, or "mark all as read". Opening the bell reads nothing.

/** Newest first. */
export const newestFirst = (list) => [...list].sort((a, b) => b.id - a.id);

/** "11/09/2026 06:31" from "2026-09-11 06:31" (what the announcements carry); anything else is returned as it is. */
export function formatNotificationDate(createdAt) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})/.exec(createdAt ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : (createdAt ?? "");
}

export const unreadLabel = (n) => (n > 99 ? "99+" : String(n));
