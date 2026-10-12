import { useCallback, useEffect, useState } from "react";

/** One line of news for the Data Capture Table card (what a paste did): notice = { message, level } or null, gone after `ms`. */
export function useNotice(ms = 6000) {
  const [notice, setNotice] = useState(null);
  const push = useCallback((message, level = "success") => setNotice(message ? { message, level, at: Date.now() } : null), []);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), ms);
    return () => clearTimeout(timer);
  }, [notice, ms]);
  return { notice, push, clear: () => setNotice(null) };
}
