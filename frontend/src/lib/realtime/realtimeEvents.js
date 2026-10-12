import { useEffect, useRef } from "react";

// Wire names of the backend's RealtimeDomain enum (com.eazycount.websocket); keep the two in step.
export const REALTIME_DOMAINS = {
  LEDGER: "ledger",
  ACCOUNTS: "accounts",
  PROCESSES: "processes",
  DATACAPTURE: "datacapture",
  OWNERSHIP: "ownership",
  USERS: "users",
  MAINTENANCE: "maintenance",
  ANNOUNCEMENTS: "announcements",
  DOMAIN: "domain",
  AUTO_RENEW: "auto_renew",
  APP: "app",
  SESSION_KICK: "session_kick",
};

// Maintenance deletes that also change account balances, so the pages showing the ledger refresh on them too.
const LEDGER_TOUCHING_SOURCES = new Set(["payment_delete", "bankprocess_delete"]);

/** For useRealtime: ledger changes, plus the maintenance deletes that move balances. */
export const touchesLedger = (event) =>
  event.domain === REALTIME_DOMAINS.LEDGER ||
  (event.domain === REALTIME_DOMAINS.MAINTENANCE && LEDGER_TOUCHING_SOURCES.has(event.source));

const listeners = new Set();

/** Hands one event ({ domain, source }) to every subscriber. */
export function dispatchRealtime(event) {
  listeners.forEach((fn) => fn(event));
}

/** Subscribes to every event; returns the unsubscribe function. */
export function onRealtime(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Runs `callback` when the backend says one of `match` changed: a list of domain names, or a function (event) => boolean.
 * A burst of events (your own submit echoes back as several) becomes one call after `delay` ms, and while the tab is
 * hidden the call waits until it is visible again. Events carry no data: the callback just loads again.
 */
export function useRealtime(match, callback, { delay = 400 } = {}) {
  const latest = useRef({ match, callback });
  useEffect(() => {
    latest.current = { match, callback };
  });

  useEffect(() => {
    let timer = 0;
    let waiting = false;
    const fire = () => {
      timer = 0;
      if (document.hidden) {
        waiting = true;
        return;
      }
      waiting = false;
      latest.current.callback();
    };
    const off = onRealtime((event) => {
      const { match: m } = latest.current;
      if (!(typeof m === "function" ? m(event) : m.includes(event.domain))) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(fire, delay);
    });
    const onVisible = () => {
      if (!document.hidden && waiting) fire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      off();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [delay]);
}
