// Rules for the bell's notification panel (the announcements users see). What is unread is decided by the backend, per login
// account: the unread count is the number of announcements newer than the account's last "mark all as read".

/** Newest first. */
export const newestFirst = (list) => [...list].sort((a, b) => b.id - a.id);

/**
 * The ids of the unread announcements. The list is newest first and the count covers every announcement newer than the last
 * read, so the unread ones are the first `count` of the list (the list itself is capped, hence the min).
 */
export const unreadIdsOf = (items, count) => new Set(items.slice(0, Math.max(0, count)).map((a) => a.id));

/** "11/09/2026 06:31" from "2026-09-11 06:31" (what the announcements carry); anything else is returned as it is. */
export function formatNotificationDate(createdAt) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})/.exec(createdAt ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : (createdAt ?? "");
}

export const unreadLabel = (n) => (n > 99 ? "99+" : String(n));
