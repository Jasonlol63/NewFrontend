import { useCallback, useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { REALTIME_DOMAINS, useRealtime } from "@/lib/realtime/realtimeEvents";
import { fetchBellAnnouncements, fetchUnreadCount, fetchUnreadIds, markAnnouncementsRead } from "@/pages/announcement/announcementApi";
import { newestFirst } from "./notificationRules";

// The backend pushes announcement changes (useRealtime below); the poll is only the fallback for a dropped connection.
const POLL_MS = 5 * 60_000;

/**
 * The announcements behind the bell: { items (newest first), unreadCount, isUnread(item), loading, error, reload, markRead(id), markAllRead }.
 * The read state is the backend's (per login account, whatever the company): the count comes from /unreadCount, the unread
 * ids from /unreadIds, and /markRead marks one announcement (with an id) or all of them. Loaded once the session is ready, again when the panel opens (reload), when the window gets focus and
 * every 5 minutes, and straight away when the backend announces a change.
 */
export function useNotifications() {
  const user = useCurrentUser();
  const [state, setState] = useState({ items: [], unreadCount: 0, unreadIds: new Set(), error: "", loaded: false });
  const userKey = user ? `${user.isOwner}:${user.id}` : null;
  // Every request and every mark-as-read bumps this; an answer that is no longer the latest is dropped.
  const seq = useRef(0);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    const mine = ++seq.current;
    try {
      const [rows, count, ids] = await Promise.all([fetchBellAnnouncements(), fetchUnreadCount(), fetchUnreadIds()]);
      if (mine !== seq.current) return;
      setState({ items: newestFirst(rows), unreadCount: count, unreadIds: new Set(ids), error: "", loaded: true });
    } catch (err) {
      if (mine !== seq.current) return;
      setState((s) => (silent ? { ...s, loaded: true } : { ...s, error: err.message, loaded: true }));
    }
  }, []);

  const reload = useCallback(() => refresh(), [refresh]);

  useEffect(() => {
    if (!userKey) return undefined;
    refresh();
    const tick = () => document.visibilityState === "visible" && refresh({ silent: true });
    const timer = window.setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, [userKey, refresh]);

  useRealtime([REALTIME_DOMAINS.ANNOUNCEMENTS, REALTIME_DOMAINS.MAINTENANCE], () => userKey && refresh({ silent: true }));

  const markAllRead = useCallback(async () => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, unreadCount: 0, unreadIds: new Set() }));
    try {
      await markAnnouncementsRead();
    } catch {
      if (mine === seq.current) refresh();
    }
  }, [refresh]);

  // One announcement read (check button, Show more, a click on the card): shown as read at once, then told to the backend.
  const markRead = useCallback(
    async (id) => {
      const mine = ++seq.current;
      setState((s) => {
        if (!s.unreadIds.has(id)) return s;
        const unreadIds = new Set(s.unreadIds);
        unreadIds.delete(id);
        return { ...s, unreadIds, unreadCount: Math.max(0, s.unreadCount - 1) };
      });
      try {
        await markAnnouncementsRead(id);
      } catch {
        if (mine === seq.current) refresh();
      }
    },
    [refresh]
  );

  const isUnread = useCallback((item) => state.unreadIds.has(item.id), [state.unreadIds]);

  return { items: state.items, unreadCount: state.unreadCount, isUnread, loading: !state.loaded, error: state.error, reload, markRead, markAllRead };
}
