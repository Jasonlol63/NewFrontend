// Rules for the bell's notification panel (the announcements users see). An announcement is unread when its id is higher than
// the last one the user marked as read; that id is kept in this browser, per account (the backend has no read state).

const storageKey = (user) => `count.notifications.lastRead.${user.isOwner ? "owner" : "user"}.${user.id}`;

/** The newest announcement id this account has read, or null when nothing was stored yet. */
export function loadLastRead(user) {
  try {
    const raw = window.localStorage.getItem(storageKey(user));
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

export function saveLastRead(user, id) {
  try {
    window.localStorage.setItem(storageKey(user), String(id));
  } catch {
    // storage blocked: everything just shows as unread again next time
  }
}

/** Newest first. */
export const newestFirst = (list) => [...list].sort((a, b) => b.id - a.id);

/**
 * "Today 14:51", "Yesterday 09:30" or "11/09/2026 14:31" from "2026-09-11 14:31" (what the announcements carry); anything
 * else is returned as it is.
 */
export function formatNotificationTime(createdAt, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})/.exec(createdAt ?? "");
  if (!m) return createdAt ?? "";
  const [, y, mo, d, time] = m;
  const day = new Date(Number(y), Number(mo) - 1, Number(d));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today - day) / 86400000);
  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Yesterday ${time}`;
  return `${d}/${mo}/${y} ${time}`;
}

export const unreadLabel = (n) => (n > 99 ? "99+" : String(n));
