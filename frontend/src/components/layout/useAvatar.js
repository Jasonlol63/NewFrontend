import { useCallback, useSyncExternalStore } from "react";
import { useSession } from "@/context/session";
import { resolveAvatar } from "./avatarCatalog";

// The picked avatar is only kept in the browser (localStorage), per login, like the other saved filters. Every place that shows it
// (the sidebar, its drawer copy, the icon rail) reads it through here, so they all change together.
const listeners = new Set();
const subscribe = (notify) => {
  listeners.add(notify);
  window.addEventListener("storage", notify); // another tab picked one
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
};

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** [avatar src, setAvatar(src)] for the logged-in user; the default avatar until one is picked. */
export function useAvatar() {
  const { user } = useSession();
  const key = user ? `avatar:${user.user_type ?? "user"}:${user.user_id ?? "unknown"}` : null;
  const saved = useSyncExternalStore(
    subscribe,
    () => (key ? read(key) : null),
    () => null
  );
  const setAvatar = useCallback(
    (src) => {
      if (!key) return;
      try {
        localStorage.setItem(key, src);
      } catch {
        // storage blocked: the pick is lost on reload
      }
      listeners.forEach((notify) => notify());
    },
    [key]
  );
  return [resolveAvatar(saved), setAvatar];
}
