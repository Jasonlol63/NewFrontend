import { useCallback, useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { REALTIME_DOMAINS, useRealtime } from "@/lib/realtime/realtimeEvents";
import { fetchBellAnnouncements, fetchUnreadCount, markAnnouncementsRead } from "@/pages/announcement/announcementApi";
import { newestFirst, unreadIdsOf } from "./notificationRules";

// The backend pushes announcement changes (useRealtime below); the poll is only the fallback for a dropped connection.
const POLL_MS = 5 * 60_000;

/**
 * The announcements behind the bell: { items (newest first), unreadCount, isUnread(item), loading, error, reload, markAllRead }.
 * The read state is the backend's (per login account, whatever the company): the count comes from /unreadCount and "mark all
 * as read" is /markRead. Loaded once the session is ready, again when the panel opens (reload), when the window gets focus and
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
      const [rows, count] = await Promise.all([fetchBellAnnouncements(), fetchUnreadCount()]);
      if (mine !== seq.current) return;
      const items = newestFirst(rows);
      setState({ items, unreadCount: count, unreadIds: unreadIdsOf(items, count), error: "", loaded: true });
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

  const isUnread = useCallback((item) => state.unreadIds.has(item.id), [state.unreadIds]);

  return { items: state.items, unreadCount: state.unreadCount, isUnread, loading: !state.loaded, error: state.error, reload, markAllRead };
}
