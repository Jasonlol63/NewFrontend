import { useCallback, useEffect, useState } from "react";
import { postJson } from "@/lib/api";
import { CAPTURE_DELETE_URL, CAPTURE_LIST_URL, normalizeCaptureRow } from "./captureMaintenanceRules";

/**
 * Captures of one request body (null = nothing to ask yet), plus `deleteCaptures(ids)` which
 * soft-deletes them and reloads. The previous result stays on screen, dimmed by `loading`, while a
 * new request is in flight.
 */
export function useCaptureRows(body) {
  const requestKey = body ? JSON.stringify(body) : "";
  const [reload, setReload] = useState(0);
  const [state, setState] = useState({ key: "", rows: [], error: "" });

  useEffect(() => {
    if (!requestKey) return undefined;
    const controller = new AbortController();
    const key = `${requestKey}|${reload}`;
    postJson(CAPTURE_LIST_URL, JSON.parse(requestKey), { signal: controller.signal })
      .then((reply) => setState({ key, rows: (reply.data || []).map(normalizeCaptureRow), error: "" }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ key, rows: [], error: err.message });
      });
    return () => controller.abort();
  }, [requestKey, reload]);

  const deleteCaptures = useCallback(
    async (captureIds) => {
      await postJson(CAPTURE_DELETE_URL, { tenantId: JSON.parse(requestKey).tenantId, captureIds });
      setReload((n) => n + 1);
    },
    [requestKey]
  );

  if (!requestKey) return { rows: [], error: "", loading: false, deleteCaptures };
  const current = state.key === `${requestKey}|${reload}`;
  return { rows: state.rows, error: current ? state.error : "", loading: !current, deleteCaptures };
}
