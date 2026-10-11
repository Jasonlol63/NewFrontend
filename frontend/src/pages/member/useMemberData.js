import { useEffect, useMemo, useState } from "react";
import { getJson, postJson } from "@/lib/api";
import { BALANCES_URL, CURRENCIES_URL, HISTORY_URL, PROFILE_URL, balanceMap, currencyUnion, normalizeProfile } from "./memberRules";

/** The member's profile: { profile, error }. profile is null while loading. */
export function useMemberProfile() {
  const [state, setState] = useState({ profile: null, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    getJson(PROFILE_URL, null, { signal: controller.signal })
      .then((body) => setState({ profile: normalizeProfile(body.data), error: "" }))
      .catch((err) => err.name !== "AbortError" && setState({ profile: null, error: err.message }));
    return () => controller.abort();
  }, []);
  return state;
}

// One POST whose result follows `request` (null = nothing to ask). The old result stays while a new one loads.
function usePost(url, request, pick, empty) {
  const key = request ? JSON.stringify(request) : "";
  const [state, setState] = useState({ key: "", value: empty, error: "" });
  useEffect(() => {
    if (!key) return undefined;
    const controller = new AbortController();
    postJson(url, JSON.parse(key), { signal: controller.signal })
      .then((body) => setState({ key, value: pick(body.data), error: "" }))
      .catch((err) => err.name !== "AbortError" && setState({ key, value: empty, error: err.message }));
    return () => controller.abort();
  }, [url, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = state.key === key;
  return { value: state.value, loading: Boolean(key) && !current, error: current ? state.error : "" };
}

const EMPTY_LIST = [];
const EMPTY_MAP = {};

/** Currencies of every listed account (linked case); the profile has them already when nothing is linked. */
export function useLinkedCurrencies(accountIds, enabled) {
  const request = useMemo(() => (enabled && accountIds.length ? { accountIds } : null), [enabled, accountIds]);
  return usePost(CURRENCIES_URL, request, currencyUnion, EMPTY_LIST);
}

/** Closing balance of every account per currency, for the table on the right. */
export function useMiniBalances(request) {
  return usePost(BALANCES_URL, request, balanceMap, EMPTY_MAP);
}

/** The statement rows of one account for the shown currencies. */
export function useMemberHistory(request) {
  return usePost(HISTORY_URL, request, (data) => data?.history ?? [], EMPTY_LIST);
}
