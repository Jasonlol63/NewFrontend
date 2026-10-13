import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/api";
import { useRealtime } from "@/lib/realtime/realtimeEvents";

// Rows asked per batch.
export const BATCH_SIZE = 100;
// A realtime refresh re-reads this many batches from the top and merges them into what is loaded.
const REFRESH_BATCHES = 3;

// A row id is the React key, so a row the data holds twice (e.g. a transaction archived twice) shows once.
function unique(rows) {
  const seen = new Set();
  return rows.filter((r) => !seen.has(r.id) && seen.add(r.id));
}

// The freshly read head of the list replaces the same stretch of the loaded rows; rows loaded further down stay as
// they are (and so does the cursor to continue from), so a refresh never throws away how far the user has scrolled.
function mergeHead(prev, fresh, reply) {
  const cursor = reply.nextCursor ?? null;
  const total = reply.total ?? prev.total;
  const whole = { ...prev, rows: fresh, cursor, total, error: "", moreFailed: false };
  // The refresh reached the end, or covers everything loaded: it is the whole list.
  if (!cursor || prev.rows.length <= fresh.length) return whole;
  // Where the fresh head ends inside the loaded rows; if that row is gone the stretches cannot be joined.
  const at = prev.rows.findIndex((r) => r.id === fresh[fresh.length - 1]?.id);
  if (at < 0) return whole;
  const seen = new Set(fresh.map((r) => r.id));
  return { ...whole, rows: [...fresh, ...prev.rows.slice(at + 1).filter((r) => !seen.has(r.id))], cursor: prev.cursor };
}

/**
 * A Maintenance list that loads in batches as the user scrolls: `POST url` with the JSON `body` plus `limit`,
 * and for later batches the `cursor` the previous reply gave (`{ data, nextCursor, total }`, newest first).
 * `body` null = nothing to ask yet. Each row goes through `normalize` (keep it a stable function).
 * While a new request is in flight the previous rows stay on screen and `loading` dims them.
 * `loadMore()` appends the next batch (no-op while one is coming or when there is none); `hasMore` / `loadingMore`
 * drive the table's scroll trigger. `reload()` asks again from the top, e.g. after a delete.
 * `batchSize` is what the server counts in a batch (rows, or whole captures on Transaction Maintenance).
 * `refreshOn` (see useRealtime) re-reads, without dimming, the top of the list when someone else changes the data;
 * what the user has scrolled past further down is kept.
 */
export function useInfiniteMaintenanceList(url, body, normalize, refreshOn = [], batchSize = BATCH_SIZE) {
  const requestKey = body ? JSON.stringify(body) : "";
  const [reloadCount, setReloadCount] = useState(0);
  const [pushed, setPushed] = useState(0);
  const [state, setState] = useState({ key: "", rows: [], cursor: null, total: 0, error: "", moreFailed: false });
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
    // Same filters as what is on screen: a realtime refresh of the top; otherwise a fresh first batch.
    const refresh = latest.current.state.key === key;
    const limit = refresh ? REFRESH_BATCHES * batchSize : batchSize;
    postJson(url, { ...JSON.parse(requestKey), limit }, { signal: controller.signal })
      .then((reply) => {
        const fresh = unique((reply.data || []).map(normalize));
        setState((prev) =>
          refresh && prev.key === key
            ? mergeHead(prev, fresh, reply)
            : { key, rows: fresh, cursor: reply.nextCursor ?? null, total: reply.total ?? 0, error: "", moreFailed: false }
        );
      })
      .catch((err) => {
        if (err.name !== "AbortError") setState({ key, rows: [], cursor: null, total: 0, error: err.message, moreFailed: false });
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
      // Only Capture and Payment Maintenance have archived rows in their lists.
      ...(current.cursor.deleted === undefined ? {} : { cursorDeleted: current.cursor.deleted }),
    })
      .then((reply) =>
        setState((prev) => {
          if (prev.key !== currentKey) return prev;
          // A realtime refresh may have already brought some of these rows in.
          const seen = new Set(prev.rows.map((r) => r.id));
          const fresh = (reply.data || []).map(normalize).filter((r) => !seen.has(r.id));
          return { ...prev, rows: [...prev.rows, ...fresh], cursor: reply.nextCursor ?? null };
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
