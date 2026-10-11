import { useEffect, useState } from "react";
import { postJson } from "@/lib/api";
import { useRealtime } from "@/lib/realtime/realtimeEvents";

/**
 * Rows of one report from `POST url` with a JSON body. The reply ends with one synthesized
 * row (`totalRow: true`) carrying the Total; it is split off here as `total`.
 * `body` null = nothing to ask yet. While a new request is in flight the previous result stays
 * on screen and `loading` dims it. `refreshOn` (see useRealtime) loads it again, without dimming, when the backend
 * says someone else changed that data.
 */
export function useReport(url, body, refreshOn = []) {
  const requestKey = body ? JSON.stringify(body) : "";
  const [pushed, setPushed] = useState(0);
  const [state, setState] = useState({ key: "", rows: [], total: null, error: "" });

  useEffect(() => {
    if (!requestKey) return undefined;
    const controller = new AbortController();
    postJson(url, JSON.parse(requestKey), { signal: controller.signal })
      .then((reply) => {
        const all = reply.data || [];
        setState({
          key: requestKey,
          rows: all.filter((row) => !row.totalRow),
          total: all.find((row) => row.totalRow) ?? null,
          error: "",
        });
      })
      .catch((err) => {
        if (err.name !== "AbortError") setState({ key: requestKey, rows: [], total: null, error: err.message });
      });
    return () => controller.abort();
  }, [url, requestKey, pushed]);
  useRealtime(refreshOn, () => requestKey && setPushed((n) => n + 1));

  if (!requestKey) return { rows: [], total: null, error: "", loading: false };
  const current = state.key === requestKey;
  return { rows: state.rows, total: state.total, error: current ? state.error : "", loading: !current };
}
