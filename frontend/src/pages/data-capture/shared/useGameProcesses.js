import { useCallback, useEffect, useState } from "react";
import { fetchGameProcesses } from "./captureApi";

/**
 * The Game processes of one tenant that can be captured on a date (the active ones of that weekday not submitted for it yet):
 * [{ id, code, display, enableSaveDraft }]. A new tenant / date loads again; reload() asks again (after a submit).
 * While the next list loads the previous one stays on screen; `loading` says so.
 */
export function useGameProcesses(tenantId, captureDate) {
  const [state, setState] = useState({ key: "", processes: [], error: "" });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const key = `${tenantId}|${captureDate}`;

  useEffect(() => {
    if (!tenantId || !captureDate) return undefined;
    const controller = new AbortController();
    fetchGameProcesses({ tenantId, captureDate }, { signal: controller.signal })
      .then((processes) => setState({ key, processes, error: "" }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ key, processes: [], error: err.message });
      });
    return () => controller.abort();
  }, [tenantId, captureDate, key, version]);

  const current = state.key === key;
  return { processes: state.processes, error: current ? state.error : "", loading: Boolean(tenantId) && !current, reload };
}
