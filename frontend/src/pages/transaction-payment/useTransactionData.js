import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/api";
import { touchesLedger, useRealtime } from "@/lib/realtime/realtimeEvents";
import { normalizeAccountRow } from "@/pages/account/accountRules";
import { HISTORY_URL, normalizeHistoryRow } from "./paymentHistoryRules";
import { SEARCH_URL, normalizeSearchRow } from "./transactionPaymentRules";

const enc = encodeURIComponent;

// What each company's page needs, remembered per company so switching back to one shows it at once while the fresh answer loads
// (the server answer always replaces it). A request already on its way is shared, so a head-start prefetch and the page's own
// load are one request. Short-lived: it is only a head start.
const CACHE_MS = 5 * 60 * 1000;
const CACHE_MAX = 20;

function makeCache(load) {
  const store = new Map(); // key -> { value, at }
  const inflight = new Map(); // key -> promise
  const peek = (key) => {
    const hit = store.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > CACHE_MS) {
      store.delete(key);
      return null;
    }
    return hit.value;
  };
  // fresh: ask the server again even if a request is on its way (after a change it could not have seen).
  const fetchShared = (key, fresh = false) => {
    if (!fresh && inflight.has(key)) return inflight.get(key);
    const request = load(key)
      .then((value) => {
        store.delete(key);
        store.set(key, { value, at: Date.now() });
        if (store.size > CACHE_MAX) store.delete(store.keys().next().value);
        return value;
      })
      .finally(() => {
        if (inflight.get(key) === request) inflight.delete(key);
      });
    inflight.set(key, request);
    return request;
  };
  // Warms the cache for a key not remembered yet; errors are ignored (the page asks again when it needs it).
  const prefetch = (key) => {
    if (peek(key) == null && !inflight.has(key)) fetchShared(key).catch(() => {});
  };
  return { peek, fetchShared, prefetch, clear: () => store.clear() };
}

const currencyCache = makeCache((tenantId) =>
  postJson(`/api/currency/list?tenant_id=${enc(tenantId)}`, null).then((body) =>
    (body.data || [])
      .filter((c) => c.status !== "INACTIVE")
      .map((c) => ({ id: c.id, code: String(c.code ?? "").toUpperCase() }))
      .filter((c) => c.code)
  )
);

const accountCache = makeCache((tenantId) =>
  postJson(`/api/account/list?tenant_id=${enc(tenantId)}`, null).then((body) => (body.data || []).map(normalizeAccountRow))
);

/**
 * One company's list kept in state: its remembered copy shows at once (else the previous company's list stays until the new one
 * arrives), the fresh one replaces it. `cache` is a makeCache cache keyed by tenant id.
 */
function useCachedTenantList(cache, tenantId) {
  const [state, setState] = useState({ tenantId: null, list: [], error: "" });
  useEffect(() => {
    if (!tenantId) return undefined;
    let cancelled = false;
    cache
      .fetchShared(tenantId)
      .then((list) => !cancelled && setState({ tenantId, list, error: "" }))
      .catch((err) => !cancelled && setState({ tenantId, list: [], error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [cache, tenantId]);
  const current = state.tenantId === tenantId;
  return { list: current ? state.list : (cache.peek(tenantId) ?? state.list), error: current ? state.error : "" };
}

/** The ACTIVE currencies of a company as [{ id, code }]. Keeps the previous list while another company loads. */
export function useTenantCurrencies(tenantId) {
  const { list, error } = useCachedTenantList(currencyCache, tenantId);
  return { currencies: list, error };
}

/** The accounts of a company (normalized rows). Keeps the previous list while another company loads. */
export function useTenantAccounts(tenantId) {
  const { list, error } = useCachedTenantList(accountCache, tenantId);
  return { rows: list, error };
}

/**
 * The Search result of `request` (null = nothing to ask yet), as normalized rows. The previous result stays on screen
 * while a new request is in flight (`loading` dims it). reload() asks again, e.g. after a submit.
 */
// The last results by request, so the same Search (same company, dates, categories) shows its previous rows at once while the fresh
// ones load. Cleared whenever the ledger changes (the backend's news, our own submit): a remembered result is then out of date.
const searchCache = makeCache((requestKey) =>
  postJson(SEARCH_URL, JSON.parse(requestKey)).then((body) => (body.data?.rows || []).map(normalizeSearchRow))
);

/**
 * Warms the caches of another company before the page switches to it: its Search (same dates and categories as `request`, only the
 * company differs), accounts and currencies. Nothing on screen changes; the page's own load then finds it ready or already on its way.
 */
export function prefetchTenant(request, tenantId) {
  if (!request || !tenantId) return;
  searchCache.prefetch(JSON.stringify({ ...request, tenantId }));
  accountCache.prefetch(tenantId);
  currencyCache.prefetch(tenantId);
}

/** Whether the company's Search for `request` is remembered already. */
export const hasSearchFor = (request, tenantId) => searchCache.peek(JSON.stringify({ ...request, tenantId })) != null;

export function useTransactionSearch(request) {
  const requestKey = request ? JSON.stringify(request) : "";
  const [version, setVersion] = useState(0);
  // Bumped by the backend's ledger news: loads again without dimming the rows (it is not part of the key below).
  const [pushed, setPushed] = useState(0);
  const [state, setState] = useState({ key: "", rows: [], error: "" });

  // Loads again after a change the server could not have been asked about (our own submit, the ledger news): asks for sure.
  const stale = useRef(false);
  useEffect(() => {
    if (!requestKey) return undefined;
    let cancelled = false;
    const fresh = stale.current;
    stale.current = false;
    searchCache
      .fetchShared(requestKey, fresh)
      .then((rows) => !cancelled && setState({ key: `${requestKey}#${version}`, rows, error: "" }))
      .catch((err) => !cancelled && setState({ key: `${requestKey}#${version}`, rows: [], error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [requestKey, version, pushed]);
  useRealtime(touchesLedger, () => {
    searchCache.clear();
    stale.current = true;
    if (requestKey) setPushed((n) => n + 1);
  });

  const reload = useCallback(() => {
    searchCache.clear();
    stale.current = true;
    setVersion((v) => v + 1);
  }, []);
  if (!requestKey) return { rows: [], loading: false, error: "", reload };
  const current = state.key === `${requestKey}#${version}`;
  // A request that was not loaded yet in this view: its remembered rows (if any) stand in for the previous request's rows.
  return { rows: current ? state.rows : (searchCache.peek(requestKey) ?? state.rows), loading: !current, error: current ? state.error : "", reload };
}

const linkedCache = new Map();

function fetchLinkedIds(tenantId, currencyId) {
  const key = `${tenantId}:${currencyId}`;
  if (!linkedCache.has(key)) {
    const request = postJson(`/api/currency/account/linked-accounts?currency_id=${enc(currencyId)}&tenant_id=${enc(tenantId)}`, null)
      .then((body) => new Set((body.data?.linked_account_ids ?? []).map(String)))
      .catch((err) => {
        linkedCache.delete(key);
        throw err;
      });
    linkedCache.set(key, request);
  }
  return linkedCache.get(key);
}

/** Forget what was loaded, e.g. after the company's currency settings changed. */
export const clearLinkedAccounts = () => linkedCache.clear();

/**
 * The accounts that hold each given currency: returns holders(currencyId) -> Set of account ids (as strings), or null
 * while that currency is still loading (callers then show every account).
 */
export function useLinkedAccounts(tenantId, currencyIds) {
  const wantedKey = [...new Set(currencyIds.filter(Boolean))].sort().join(",");
  const [loaded, setLoaded] = useState({});
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!tenantId || !wantedKey) return;
    wantedKey.split(",").forEach((id) => {
      fetchLinkedIds(tenantId, id)
        .then((set) => alive.current && setLoaded((cur) => (cur[`${tenantId}:${id}`] ? cur : { ...cur, [`${tenantId}:${id}`]: set })))
        .catch(() => {});
    });
  }, [wantedKey, tenantId]);

  return useCallback((currencyId) => loaded[`${tenantId}:${currencyId}`] ?? null, [loaded, tenantId]);
}

/**
 * The Payment History of `request` (null = nothing to ask): { account, rows, loading, error }. Rows keep the backend's
 * order (a B/F row per currency first, then the period).
 */
export function useHistory(request) {
  const requestKey = request ? JSON.stringify(request) : "";
  const [pushed, setPushed] = useState(0); // bumped by the backend's ledger news: loads again without dimming the rows
  const [state, setState] = useState({ key: "", account: null, rows: [], error: "" });

  useEffect(() => {
    if (!requestKey) return undefined;
    const controller = new AbortController();
    postJson(HISTORY_URL, JSON.parse(requestKey), { signal: controller.signal })
      .then((body) =>
        setState({ key: requestKey, account: body.data?.account ?? null, rows: (body.data?.history || []).map(normalizeHistoryRow), error: "" })
      )
      .catch((err) => {
        if (err.name !== "AbortError") setState({ key: requestKey, account: null, rows: [], error: err.message });
      });
    return () => controller.abort();
  }, [requestKey, pushed]);
  useRealtime(touchesLedger, () => requestKey && setPushed((n) => n + 1));

  const current = state.key === requestKey;
  return { account: current ? state.account : null, rows: current ? state.rows : [], loading: Boolean(requestKey) && !current, error: current ? state.error : "" };
}
