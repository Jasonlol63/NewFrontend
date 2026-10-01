import { useEffect, useState } from "react";
import { getJson } from "@/lib/api";

// The logged-in session (/auth/current-user), fetched once per login. Resolves to null if it
// can't be fetched.
let sessionRequest = null;
export function loadSessionUser() {
  sessionRequest ??= getJson("/auth/current-user")
    .then((body) => body.data ?? null)
    .catch(() => {
      sessionRequest = null;
      return null;
    });
  return sessionRequest;
}

const LOGIN_STAMP_KEY = "loginStamp";

// Called after a successful login: forgets the previous session and stamps this login, so
// pages can tell a fresh login (start from the login tenant) from a refresh (keep the last pick).
export function markLogin() {
  sessionRequest = null;
  try {
    localStorage.setItem(LOGIN_STAMP_KEY, String(Date.now()));
  } catch {
    // storage blocked: saved filters just carry over between logins
  }
}

export function currentLoginStamp() {
  try {
    return localStorage.getItem(LOGIN_STAMP_KEY);
  } catch {
    return null;
  }
}

// The logged-in user's id, so each account on a shared browser keeps its own saved values.
// Resolves to null if it can't be fetched (nothing gets saved then).
function loadUserKey() {
  return loadSessionUser().then((user) => (user ? `${user.user_type ?? "user"}:${user.user_id ?? "unknown"}` : null));
}

function readValue(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw == null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * A value kept in localStorage per user and restored after a refresh. Returns
 * [value, setValue, ready]:
 *  - value is null when nothing has been saved yet;
 *  - setValue(next) saves immediately;
 *  - ready turns true once the user is known and the saved value has been read, so callers can
 *    hold off using defaults until then instead of flashing the defaults first.
 * If the user can't be identified or storage is blocked it still works, it just isn't remembered.
 */
export function useSavedState(name) {
  const [userKey, setUserKey] = useState(undefined); // undefined = still loading
  // Only the last value set in this visit lives in state; the saved one is read back per key.
  const [local, setLocal] = useState({ storageKey: null, value: null });

  useEffect(() => {
    let cancelled = false;
    loadUserKey().then((key) => {
      if (!cancelled) setUserKey(key);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const storageKey = userKey ? `${name}:${userKey}` : null;
  const value = local.storageKey === storageKey ? local.value : storageKey ? readValue(storageKey) : null;

  const setValue = (next) => {
    setLocal({ storageKey, value: next });
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // storage full or blocked: the value still applies for this visit
    }
  };

  return [value, setValue, userKey !== undefined];
}

// A list of ids in the order the user dragged them into.
export function useSavedOrder(name) {
  const [value, setValue] = useSavedState(name);
  return [Array.isArray(value) ? value : EMPTY_ORDER, setValue];
}
const EMPTY_ORDER = [];
