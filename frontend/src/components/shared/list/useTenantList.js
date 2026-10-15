import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/context/session";
import { postJson } from "@/lib/api";
import { REALTIME_DOMAINS, useRealtime } from "@/lib/realtime/realtimeEvents";
import { makeCache } from "@/lib/sharedCache";

// One remembered list per API and per (login, company): the backend filters the rows by who is asking, so another login must
// never be shown what was remembered for this one. Coming back to a list (or switching to a company) shows it at once while the
// fresh one loads. The realtime domain of each API tells when somebody else changed the list.
const REALTIME_BY_BASE = { "/api/account": REALTIME_DOMAINS.ACCOUNTS, "/api/userlist": REALTIME_DOMAINS.USERS };
const caches = new Map(); // base -> cache

const cacheKey = (userId, tenantId) => `${userId ?? ""}|${tenantId}`;

function cacheOf(base, normalize) {
  let cache = caches.get(base);
  if (!cache) {
    cache = makeCache((key) => {
      const tenantId = key.slice(key.indexOf("|") + 1);
      return postJson(`${base}/list?tenant_id=${encodeURIComponent(tenantId)}`, null).then((body) => (body.data || []).map(normalize));
    });
    caches.set(base, cache);
  }
  return cache;
}

/** Warms the cache for a company the page may switch to; nothing on screen changes. */
export const prefetchTenantList = (base, normalize, userId, tenantId) =>
  tenantId && cacheOf(base, normalize).prefetch(cacheKey(userId, tenantId));

/** Whether the company's list is remembered already. */
export const hasTenantList = (base, normalize, userId, tenantId) => cacheOf(base, normalize).peek(cacheKey(userId, tenantId)) != null;

/**
 * Rows of one tenant from a Spring list API that follows the `${base}/list?tenant_id=`,
 * `${base}/updateStatus` and `${base}/delete` pattern (/api/userlist, /api/account).
 * While another tenant is loading its remembered list shows (else the previous rows stay on screen).
 *  - normalize(item) maps one API row (keep it a stable function); rowKey(row) identifies a row.
 */
export function useTenantList(base, tenantId, { normalize, rowKey = (row) => row.id }) {
  const { user } = useSession();
  const userId = user?.user_id ?? null;
  const cache = cacheOf(base, normalize);
  const [state, setState] = useState({ tenantId: null, rows: [], error: "" });
  // Bumped by reload() and by the backend's news to fetch the same tenant again (after an add / edit, or someone else's change).
  const [version, setVersion] = useState(0);
  // Set when what is remembered is out of date: the next load asks the server for sure.
  const stale = useRef(false);
  const reload = useCallback(() => {
    cache.clear();
    stale.current = true;
    setVersion((v) => v + 1);
  }, [cache]);
  useRealtime(REALTIME_BY_BASE[base] ? [REALTIME_BY_BASE[base]] : [], () => tenantId && reload());

  useEffect(() => {
    if (!tenantId) return undefined;
    let cancelled = false;
    const fresh = stale.current;
    stale.current = false;
    cache
      .fetchShared(cacheKey(userId, tenantId), fresh)
      .then((rows) => !cancelled && setState({ tenantId, rows, error: "" }))
      .catch((err) => !cancelled && setState({ tenantId, rows: [], error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [cache, userId, tenantId, version]);

  // The response carries the new status; the rest of the row is kept as listed.
  const toggleStatus = useCallback(
    async (row) => {
      const body = await postJson(`${base}/updateStatus`, { id: row.id, scopeTenantId: tenantId });
      const { status } = normalize(body.data);
      const key = rowKey(row);
      cache.clear();
      setState((s) => ({ ...s, rows: s.rows.map((r) => (rowKey(r) === key ? { ...r, status } : r)) }));
    },
    [base, cache, tenantId, normalize, rowKey]
  );

  // Deletes one by one so a failure part-way still removes the ones that went through.
  const deleteRows = useCallback(
    async (rows) => {
      const deleted = new Set();
      try {
        for (const row of rows) {
          await postJson(`${base}/delete`, { id: row.id, scopeTenantId: tenantId });
          deleted.add(rowKey(row));
        }
      } finally {
        cache.clear();
        setState((s) => ({ ...s, rows: s.rows.filter((r) => !deleted.has(rowKey(r))) }));
      }
    },
    [base, cache, tenantId, rowKey]
  );

  const current = state.tenantId === tenantId;
  const remembered = current ? null : cache.peek(cacheKey(userId, tenantId));
  return {
    rows: current ? state.rows : (remembered ?? state.rows),
    error: current ? state.error : "",
    // A remembered list is on screen already: it is replaced when the fresh one arrives, nothing to wait for.
    loading: Boolean(tenantId) && !current && remembered == null,
    toggleStatus,
    deleteRows,
    reload,
  };
}
