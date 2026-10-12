import { useCallback, useEffect, useState } from "react";

/**
 * The news of the last action: notice = { message, detail, level, at, ms } or null, gone after `ms`.
 * push(message, level = "success", detail, action): `message` is the headline, `detail` a second line or an array of lines,
 * `action` an optional { label, onClick } link (e.g. Retry).
 * With `stickyErrors` an error / warning stays until it is closed (the Toast's X); otherwise everything goes after `ms`.
 */
export function useNotice(ms = 6000, { stickyErrors = false } = {}) {
  const [notice, setNotice] = useState(null);
  const push = useCallback(
    (message, level = "success", detail, action) => {
      if (!message) return setNotice(null);
      const stays = stickyErrors && (level === "error" || level === "warning");
      return setNotice({ message, detail, action, level, at: Date.now(), ms: stays ? null : ms });
    },
    [ms, stickyErrors]
  );
  useEffect(() => {
    if (!notice?.ms) return undefined;
    const timer = setTimeout(() => setNotice(null), notice.ms);
    return () => clearTimeout(timer);
  }, [notice]);
  const clear = useCallback(() => setNotice(null), []);
  return { notice, push, clear };
}
