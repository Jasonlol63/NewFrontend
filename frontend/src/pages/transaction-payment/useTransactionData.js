import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/api";
import { touchesLedger, useRealtime } from "@/lib/realtime/realtimeEvents";
import { HISTORY_URL, normalizeHistoryRow } from "./paymentHistoryRules";
import { SEARCH_URL, normalizeSearchRow } from "./transactionPaymentRules";

const enc = encodeURIComponent;

/** The ACTIVE currencies of a company as [{ id, code }]. Keeps the previous list while another company loads. */
export function useTenantCurrencies(tenantId) {
  const [state, setState] = useState({ tenantId: null, list: [], error: "" });
  useEffect(() => {
    if (!tenantId) return undefined;
    const controller = new AbortController();
    postJson(`/api/currency/list?tenant_id=${enc(tenantId)}`, null, { signal: controller.signal })
      .then((body) => {
        const list = (body.data || [])
          .filter((c) => c.status !== "INACTIVE")
          .map((c) => ({ id: c.id, code: String(c.code ?? "").toUpperCase() }))
          .filter((c) => c.code);
        setState({ tenantId, list, error: "" });
      })
      .catch((err) => {
        if (err.name !== "AbortError") setState({ tenantId, list: [], error: err.message });
      });
    return () => controller.abort();
  }, [tenantId]);
  return { currencies: state.list, error: state.tenantId === tenantId ? state.error : "" };
}

/**
 * The Search result of `request` (null = nothing to ask yet), as normalized rows. The previous result stays on screen
 * while a new request is in flight (`loading` dims it). reload() asks again, e.g. after a submit.
 */
// The last results by request, so the same Search (same company, dates, categories) shows its previous rows at once while the fresh
// ones load (the rows are dimmed meanwhile). Short-lived and small: it is only a head start, the server answer always replaces it.
const SEARCH_CACHE = new Map();
const SEARCH_CACHE_MS = 5 * 60 * 1000;
const SEARCH_CACHE_MAX = 20;

function cachedRows(key) {
  const hit = SEARCH_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > SEARCH_CACHE_MS) {
    SEARCH_CACHE.delete(key);
    return null;
  }
  return hit.rows;
}

function rememberRows(key, rows) {
  SEARCH_CACHE.delete(key);
  SEARCH_CACHE.set(key, { rows, at: Date.now() });
  if (SEARCH_CACHE.size > SEARCH_CACHE_MAX) SEARCH_CACHE.delete(SEARCH_CACHE.keys().next().value);
}

export function useTransactionSearch(request) {
  const requestKey = request ? JSON.stringify(request) : "";
  const [version, setVersion] = useState(0);
  // Bumped by the backend's ledger news: loads again without dimming the rows (it is not part of the key below).
  const [pushed, setPushed] = useState(0);
  const [state, setState] = useState({ key: "", rows: [], error: "" });

  useEffect(() => {
    if (!requestKey) return undefined;
    const controller = new AbortController();
    postJson(SEARCH_URL, JSON.parse(requestKey), { signal: controller.signal })
      .then((body) => {
        const rows = (body.data?.rows || []).map(normalizeSearchRow);
        rememberRows(requestKey, rows);
        setState({ key: `${requestKey}#${version}`, rows, error: "" });
      })
      .catch((err) => {
        if (err.name !== "AbortError") setState({ key: `${requestKey}#${version}`, rows: [], error: err.message });
      });
    return () => controller.abort();
  }, [requestKey, version, pushed]);
  useRealtime(touchesLedger, () => requestKey && setPushed((n) => n + 1));

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  if (!requestKey) return { rows: [], loading: false, error: "", reload };
  const current = state.key === `${requestKey}#${version}`;
  // A request that was not loaded yet in this view: its remembered rows (if any) stand in for the previous request's rows.
  return { rows: current ? state.rows : (cachedRows(requestKey) ?? state.rows), loading: !current, error: current ? state.error : "", reload };
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
