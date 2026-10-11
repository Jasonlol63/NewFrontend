import { useEffect } from "react";
import { Client } from "@stomp/stompjs";
import { useSession } from "@/context/session";
import { clearSession } from "@/hooks/useSavedState";
import { REALTIME_DOMAINS, dispatchRealtime, onRealtime } from "./realtimeEvents";

// The browser sends the httpOnly login cookie with the handshake, so there is no token to pass.
const brokerURL = () => `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

/**
 * Keeps one STOMP connection to /ws for the logged-in company (reconnects on its own, and again when the company is
 * switched). Every domain is listened to on both the global and the company topic; messages become dispatchRealtime events.
 * After a reconnect every domain is announced once, since changes may have been missed while offline. Renders nothing.
 */
export default function RealtimeConnection() {
  const { user } = useSession();
  const tenantId = user?.tenant_id ?? null;
  const isIt = String(user?.role ?? "").toLowerCase() === "it";

  useEffect(() => {
    if (tenantId == null) return undefined;
    let connectedBefore = false;
    const client = new Client({
      brokerURL: brokerURL(),
      reconnectDelay: 5000,
      onConnect: () => {
        Object.values(REALTIME_DOMAINS).forEach((domain) => {
          const onMessage = (frame) => {
            try {
              const { source } = JSON.parse(frame.body);
              dispatchRealtime({ domain, source });
            } catch {
              dispatchRealtime({ domain });
            }
          };
          client.subscribe(`/topic/global/${domain}`, onMessage);
          client.subscribe(`/topic/company/${tenantId}/${domain}`, onMessage);
        });
        if (connectedBefore) {
          Object.values(REALTIME_DOMAINS)
            .filter((domain) => domain !== REALTIME_DOMAINS.SESSION_KICK)
            .forEach((domain) => dispatchRealtime({ domain, source: "reconnect" }));
        }
        connectedBefore = true;
      },
    });
    client.activate();
    return () => {
      client.deactivate();
    };
  }, [tenantId]);

  // IT turned the sign-out switch on: everyone but IT goes back to the login page.
  useEffect(() => {
    if (isIt) return undefined;
    return onRealtime((event) => {
      if (event.domain !== REALTIME_DOMAINS.SESSION_KICK) return;
      clearSession();
      window.location.replace("/login");
    });
  }, [isIt]);

  return null;
}
