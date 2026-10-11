import { useCallback, useEffect, useState } from "react";
import { fetchSubmittedProcesses } from "./captureApi";

/** The processes submitted for a date (Submitted Processes card), newest first. enabled: false loads nothing (the Bank form). */
export function useSubmittedProcesses(tenantId, captureDate, enabled = true) {
  const [state, setState] = useState({ key: "", items: [], error: "" });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const key = `${tenantId}|${captureDate}`;

  useEffect(() => {
    if (!enabled || !tenantId || !captureDate) return undefined;
    const controller = new AbortController();
    fetchSubmittedProcesses({ tenantId, captureDate }, { signal: controller.signal })
      .then((items) => setState({ key, items, error: "" }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ key, items: [], error: err.message });
      });
    return () => controller.abort();
  }, [enabled, tenantId, captureDate, key, version]);

  const current = enabled && state.key === key;
  return { items: current ? state.items : [], error: current ? state.error : "", reload };
}
