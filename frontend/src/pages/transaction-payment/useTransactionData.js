import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/api";
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
export function useTransactionSearch(request) {
  const requestKey = request ? JSON.stringify(request) : "";
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ key: "", rows: [], error: "" });

  useEffect(() => {
    if (!requestKey) return undefined;
    const controller = new AbortController();
    postJson(SEARCH_URL, JSON.parse(requestKey), { signal: controller.signal })
      .then((body) => setState({ key: `${requestKey}#${version}`, rows: (body.data?.rows || []).map(normalizeSearchRow), error: "" }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ key: `${requestKey}#${version}`, rows: [], error: err.message });
      });
    return () => controller.abort();
  }, [requestKey, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  if (!requestKey) return { rows: [], loading: false, error: "", reload };
  const current = state.key === `${requestKey}#${version}`;
  return { rows: state.rows, loading: !current, error: current ? state.error : "", reload };
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
