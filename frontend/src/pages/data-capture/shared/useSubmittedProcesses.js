import { useCallback, useEffect, useState } from "react";
import { fetchSubmittedBankCaptures, fetchSubmittedProcesses } from "./captureApi";

/** The processes submitted for a date (Submitted Processes card), newest first. kind: "games" or "bank" (the Bank form). enabled: false loads nothing. */
export function useSubmittedProcesses(tenantId, captureDate, enabled = true, kind = "games") {
  const [state, setState] = useState({ key: "", items: [], error: "" });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const key = `${kind}|${tenantId}|${captureDate}`;

  useEffect(() => {
    if (!enabled || !tenantId || !captureDate) return undefined;
    const controller = new AbortController();
    (kind === "bank" ? fetchSubmittedBankCaptures : fetchSubmittedProcesses)({ tenantId, captureDate }, { signal: controller.signal })
      .then((items) => setState({ key, items, error: "" }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ key, items: [], error: err.message });
      });
    return () => controller.abort();
  }, [enabled, tenantId, captureDate, kind, key, version]);

  const current = enabled && state.key === key;
  // loaded: the list answered for this tenant / date (false while it loads or after it failed).
  return { items: current ? state.items : [], loaded: current && !state.error, error: current ? state.error : "", reload };
}
