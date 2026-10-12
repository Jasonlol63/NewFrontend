import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/context/session";
import { REALTIME_DOMAINS, useRealtime } from "@/lib/realtime/realtimeEvents";
import { fetchPendingCount } from "@/pages/auto-renew/autoRenewApi";

// The backend pushes Auto Renew changes (useRealtime below); the poll is only the fallback for a dropped connection.
const POLL_MS = 5 * 60_000;

/**
 * How many Auto Renew requests are waiting for a decision (the number on the sidebar's Auto Renew item), 0 when the user has no
 * Auto Renew menu. Loaded once the session is ready, when the window gets focus, every 5 minutes, and straight away when the
 * backend announces a change.
 */
export function useAutoRenewPending() {
  const { user } = useSession();
  const enabled = user?.menu?.autoRenew === true;
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    fetchPendingCount()
      .then(setCount)
      // The number only decorates the menu: when it cannot be read the old one stays.
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const tick = () => document.visibilityState === "visible" && refresh();
    const timer = window.setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, [enabled, refresh]);

  useRealtime([REALTIME_DOMAINS.AUTO_RENEW], () => enabled && refresh());

  return enabled ? count : 0;
}
