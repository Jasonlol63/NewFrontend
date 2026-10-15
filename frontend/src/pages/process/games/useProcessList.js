import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/api";
import { REALTIME_DOMAINS, useRealtime } from "@/lib/realtime/realtimeEvents";
import { makeCache } from "@/lib/sharedCache";
import { PROCESS_DELETE_URL, PROCESS_LIST_URL, PROCESS_STATUS_URL, normalizeProcessRow } from "./processRules";

// The list of each company, remembered so coming back to it (or switching to it) shows it at once while the fresh one loads.
// Emptied whenever a process changes (our own add / edit / status / delete, or the backend's news).
const processCache = makeCache((tenantId) =>
  postJson(PROCESS_LIST_URL, tenantId).then((body) => (body.data || []).map(normalizeProcessRow).filter(Boolean))
);

/** Warms the cache for a company the page may switch to; nothing on screen changes. */
export const prefetchProcesses = (tenantId) => tenantId && processCache.prefetch(tenantId);

/** Whether the company's list is remembered already. */
export const hasProcesses = (tenantId) => processCache.peek(tenantId) != null;

/**
 * Processes of one tenant. The list request body is just the tenant id; status and delete take
 * { id, tenantId }. While another tenant is loading its remembered list shows (else the previous rows stay on screen).
 */
export function useProcessList(tenantId) {
  const [state, setState] = useState({ tenantId: null, rows: [], error: "" });
  // Bumped by reload() and by the backend's news to fetch the same tenant again (after an add / edit, or someone else's change).
  const [version, setVersion] = useState(0);
  // Set when what is remembered is out of date: the next load asks the server for sure.
  const stale = useRef(false);
  const refresh = useCallback(() => {
    processCache.clear();
    stale.current = true;
    setVersion((v) => v + 1);
  }, []);
  const reload = refresh;
  useRealtime([REALTIME_DOMAINS.PROCESSES], () => tenantId && refresh());

  useEffect(() => {
    if (!tenantId) return undefined;
    let cancelled = false;
    const fresh = stale.current;
    stale.current = false;
    processCache
      .fetchShared(tenantId, fresh)
      .then((rows) => !cancelled && setState({ tenantId, rows, error: "" }))
      .catch((err) => !cancelled && setState({ tenantId, rows: [], error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [tenantId, version]);

  const toggleStatus = useCallback(
    async (row) => {
      const body = await postJson(PROCESS_STATUS_URL, { id: row.id, tenantId });
      const status = String(body.data?.status || row.status).toLowerCase();
      processCache.clear();
      setState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === row.id ? { ...r, status } : r)) }));
    },
    [tenantId]
  );

  // Deletes one by one so a failure part-way still removes the ones that went through.
  const deleteRows = useCallback(
    async (rows) => {
      const deleted = new Set();
      try {
        for (const row of rows) {
          await postJson(PROCESS_DELETE_URL, { id: row.id, tenantId });
          deleted.add(row.id);
        }
      } finally {
        processCache.clear();
        setState((s) => ({ ...s, rows: s.rows.filter((r) => !deleted.has(r.id)) }));
      }
    },
    [tenantId]
  );

  const current = state.tenantId === tenantId;
  return {
    rows: current ? state.rows : (processCache.peek(tenantId) ?? state.rows),
    error: current ? state.error : "",
    loading: Boolean(tenantId) && !current,
    toggleStatus,
    deleteRows,
    reload,
  };
}
