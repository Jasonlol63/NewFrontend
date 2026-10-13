import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/api";
import { useRealtime } from "@/lib/realtime/realtimeEvents";

// Rows asked per batch; the backend caps a request at 2000.
export const BATCH_SIZE = 100;
const REFRESH_MAX = 2000;

/**
 * A Maintenance list that loads in batches as the user scrolls: `POST url` with the JSON `body` plus `limit`,
 * and for later batches the `cursor` the previous reply gave (`{ data, nextCursor, total }`, newest first).
 * `body` null = nothing to ask yet. Each row goes through `normalize` (keep it a stable function).
 * While a new request is in flight the previous rows stay on screen and `loading` dims them.
 * `loadMore()` appends the next batch (no-op while one is coming or when there is none); `hasMore` / `loadingMore`
 * drive the table's scroll trigger. `reload()` asks again from the top, e.g. after a delete.
 * `batchSize` is what the server counts in a batch (rows, or whole captures on Transaction Maintenance).
 * `refreshOn` (see useRealtime) re-reads, without dimming, as many batches as are already loaded when someone else
 * changes the data, so the scroll position survives.
 */
export function useInfiniteMaintenanceList(url, body, normalize, refreshOn = [], batchSize = BATCH_SIZE) {
  const requestKey = body ? JSON.stringify(body) : "";
  const [reloadCount, setReloadCount] = useState(0);
  const [pushed, setPushed] = useState(0);
  const [state, setState] = useState({ key: "", rows: [], cursor: null, total: 0, error: "", moreFailed: false, batches: 1 });
  const [loadingMore, setLoadingMore] = useState(false);
  const key = `${requestKey}|${reloadCount}`;

  const latest = useRef({ key, state, busy: false });
  useEffect(() => {
    latest.current.key = key;
    latest.current.state = state;
  });

  useEffect(() => {
    if (!requestKey) return undefined;
    const controller = new AbortController();
    const { key: loadedKey, batches: loaded } = latest.current.state;
    // Same filters as what is on screen (a realtime refresh): re-read everything loaded so far.
    const batches = loadedKey === key ? loaded : 1;
    const limit = Math.min(batches * batchSize, REFRESH_MAX);
    postJson(url, { ...JSON.parse(requestKey), limit }, { signal: controller.signal })
      .then((reply) =>
        setState({ key, rows: (reply.data || []).map(normalize), cursor: reply.nextCursor ?? null, total: reply.total ?? 0, error: "", moreFailed: false, batches })
      )
      .catch((err) => {
        if (err.name !== "AbortError") setState({ key, rows: [], cursor: null, total: 0, error: err.message, moreFailed: false, batches: 1 });
      });
    return () => controller.abort();
  }, [url, requestKey, key, pushed, normalize, batchSize]);
  useRealtime(refreshOn, () => requestKey && setPushed((n) => n + 1));

  const reload = useCallback(() => setReloadCount((n) => n + 1), []);

  const loadMore = useCallback(() => {
    const { key: currentKey, state: current, busy } = latest.current;
    if (!requestKey || busy || current.key !== currentKey || !current.cursor || current.moreFailed) return;
    latest.current.busy = true;
    setLoadingMore(true);
    postJson(url, {
      ...JSON.parse(requestKey),
      limit: batchSize,
      cursorCreatedAt: current.cursor.createdAt,
      cursorId: current.cursor.id,
      // Only Capture Maintenance has archived rows in its list.
      ...(current.cursor.deleted === undefined ? {} : { cursorDeleted: current.cursor.deleted }),
    })
      .then((reply) =>
        setState((prev) => {
          if (prev.key !== currentKey) return prev;
          // A realtime refresh may have already brought some of these rows in.
          const seen = new Set(prev.rows.map((r) => r.id));
          const fresh = (reply.data || []).map(normalize).filter((r) => !seen.has(r.id));
          return { ...prev, rows: [...prev.rows, ...fresh], cursor: reply.nextCursor ?? null, batches: prev.batches + 1 };
        })
      )
      // Stop auto-loading after a failure (the toast offers a retry via reload) instead of hammering the server.
      .catch((err) => setState((prev) => (prev.key === currentKey ? { ...prev, error: err.message, moreFailed: true } : prev)))
      .finally(() => {
        latest.current.busy = false;
        setLoadingMore(false);
      });
  }, [url, requestKey, normalize, batchSize]);

  if (!requestKey) return { rows: [], total: 0, error: "", loading: false, hasMore: false, loadingMore: false, loadMore, reload };
  const current = state.key === key;
  return {
    rows: state.rows,
    total: Math.max(state.total, state.rows.length),
    error: current ? state.error : "",
    loading: !current,
    hasMore: current && Boolean(state.cursor) && !state.moreFailed,
    loadingMore,
    loadMore,
    reload,
  };
}
