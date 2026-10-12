import { useCallback, useEffect, useRef, useState } from "react";
import { localizeBackend } from "@/i18n/backendMessages";

let nextId = 1;

/**
 * The news of the actions: every push is its own toast with its own countdown (`ms`, or `errorMs` for an error / warning)
 * and goes away only when that countdown is over (or its X is pressed); a new one never replaces one still on screen.
 * push(message, level = "success", detail, action): `message` is the headline, `detail` a second line or an array of lines,
 * `action` an optional { label, onClick } link (e.g. Retry). push(null) clears them all.
 * Returns { toasts, push, dismiss(id), clear, notice }; `notice` is the newest toast (or null), for the pages that show
 * the last piece of news as one line (Data Capture's sheet card).
 */
export function useNotice(ms = 6000, { errorMs = 5000 } = {}) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((n) => n.id !== id));
  }, []);

  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    setToasts([]);
  }, []);

  const push = useCallback(
    (message, level = "success", detail, action) => {
      if (!message) return clear();
      const id = nextId++;
      const duration = level === "error" || level === "warning" ? errorMs : ms;
      // The back end's English reasons are shown in the page language when they are known (see i18n/backendMessages.js).
      const shown = Array.isArray(detail) ? detail.map(localizeBackend) : localizeBackend(detail);
      setToasts((list) => [...list, { id, message, detail: shown, action, level, at: Date.now(), ms: duration }]);
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [ms, errorMs, dismiss, clear]
  );

  useEffect(() => {
    const live = timers.current;
    return () => live.forEach(clearTimeout);
  }, []);

  return { toasts, notice: toasts.at(-1) ?? null, push, dismiss, clear };
}
