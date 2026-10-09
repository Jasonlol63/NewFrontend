import { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { fetchAnnouncements } from "@/pages/announcement/announcementApi";
import { loadLastRead, newestFirst, saveLastRead } from "./notificationRules";

/**
 * The announcements behind the bell: { items (newest first), unreadCount, isUnread(item), loading, error, reload, markAllRead }.
 * Loaded once the session is ready, and again whenever the panel opens (reload). An account that has never marked anything as
 * read starts with everything read (the existing announcements are not news to it), so only later ones count as unread.
 */
export function useNotifications() {
  const user = useCurrentUser();
  const [state, setState] = useState({ items: [], error: "", loaded: false });
  const [lastRead, setLastRead] = useState(null);
  const userKey = user ? `${user.isOwner}:${user.id}` : null;

  const reload = useCallback(async () => {
    try {
      const rows = await fetchAnnouncements();
      setState({ items: newestFirst(rows), error: "", loaded: true });
    } catch (err) {
      setState((s) => ({ ...s, error: err.message, loaded: true }));
    }
  }, []);

  useEffect(() => {
    if (userKey) reload();
  }, [userKey, reload]);

  // The stored mark, or (nothing stored yet) the newest announcement, saved right away.
  useEffect(() => {
    if (!user || !state.loaded) return;
    const stored = loadLastRead(user);
    if (stored !== null) {
      setLastRead(stored);
      return;
    }
    const newest = state.items[0]?.id ?? 0;
    saveLastRead(user, newest);
    setLastRead(newest);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the list first arrives for this account
  }, [userKey, state.loaded]);

  const unreadCount = useMemo(() => (lastRead === null ? 0 : state.items.filter((a) => a.id > lastRead).length), [state.items, lastRead]);
  const isUnread = useCallback((item) => lastRead !== null && item.id > lastRead, [lastRead]);

  const markAllRead = useCallback(() => {
    if (!user || state.items.length === 0) return;
    const newest = state.items[0].id;
    saveLastRead(user, newest);
    setLastRead(newest);
  }, [user, state.items]);

  return { items: state.items, unreadCount, isUnread, loading: !state.loaded, error: state.error, reload, markAllRead };
}
