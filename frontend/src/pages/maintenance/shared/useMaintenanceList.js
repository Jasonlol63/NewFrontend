import { useCallback, useEffect, useState } from "react";
import { postJson } from "@/lib/api";

/**
 * Rows of one Maintenance list: `POST url` with the JSON `body` (null = nothing to ask yet), each
 * row passed through `normalize` (keep it a stable function). While a new request is in flight the
 * previous result stays on screen and `loading` dims it. `reload()` asks again, e.g. after a delete.
 */
export function useMaintenanceList(url, body, normalize) {
  const requestKey = body ? JSON.stringify(body) : "";
  const [reloadCount, setReloadCount] = useState(0);
  const [state, setState] = useState({ key: "", rows: [], error: "" });
  const key = `${requestKey}|${reloadCount}`;

  useEffect(() => {
    if (!requestKey) return undefined;
    const controller = new AbortController();
    postJson(url, JSON.parse(requestKey), { signal: controller.signal })
      .then((reply) => setState({ key, rows: (reply.data || []).map(normalize), error: "" }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ key, rows: [], error: err.message });
      });
    return () => controller.abort();
  }, [url, requestKey, key, normalize]);

  const reload = useCallback(() => setReloadCount((n) => n + 1), []);

  if (!requestKey) return { rows: [], error: "", loading: false, reload };
  const current = state.key === key;
  return { rows: state.rows, error: current ? state.error : "", loading: !current, reload };
}
