import { useCallback, useEffect, useState } from "react";
import { postJson } from "@/lib/api";
import { useSavedState } from "@/hooks/useSavedState";
import { normalizeAccountRow } from "@/pages/account/accountRules";
import { BANK_COUNTRY_LIST_URL } from "./bankProcessRules";
import {
  BANK_COUNTRY_ADD_URL,
  BANK_COUNTRY_DELETE_URL,
  BANK_OPTION_ADD_URL,
  BANK_OPTION_DELETE_URL,
  BANK_OPTION_LIST_URL,
} from "./bankFormRules";

const EMPTY = [];

// A list that can be fetched again (reload() bumps a version). While a reload of the same list is running the old rows
// stay; a different list (another country, another company) shows nothing until its own answer arrives.
function useRemoteList(enabled, keyParts, load) {
  const [state, setState] = useState({ key: null, base: null, data: EMPTY, error: "" });
  const [version, setVersion] = useState(0);
  const base = keyParts.join(":");
  const key = `${base}:${version}`;
  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    load(controller.signal)
      .then((data) => setState({ key, base, data, error: "" }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ key, base, data: EMPTY, error: err.message });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` is rebuilt every render; `key` identifies the request
  }, [enabled, key]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const sameList = state.base === base;
  return { data: sameList ? state.data : EMPTY, error: state.key === key ? state.error : "", loading: enabled && state.key !== key, reload };
}

// The company's bank countries [{ id, code }]. add(code) / remove(id) write at once, reload the list and throw the
// backend's message on failure (adding a country also creates a currency of that code).
export function useBankCountryOptions(tenantId) {
  const list = useRemoteList(Boolean(tenantId), ["country", tenantId], (signal) =>
    postJson(BANK_COUNTRY_LIST_URL, tenantId, { signal }).then((body) => (body.data || []).map((c) => ({ id: c.id, code: String(c.code ?? "").toUpperCase() })))
  );
  const add = useCallback(
    async (code) => {
      const body = await postJson(BANK_COUNTRY_ADD_URL, { tenantId, code });
      list.reload();
      return { id: body.data?.id, code };
    },
    [tenantId, list]
  );
  const remove = useCallback(
    async (id) => {
      await postJson(BANK_COUNTRY_DELETE_URL, { id, tenantId });
      list.reload();
    },
    [tenantId, list]
  );
  return { countries: list.data, error: list.error, loading: list.loading, add, remove };
}

// The banks of one country [{ id, name }]; add(name) / remove(id) as above.
export function useBankOptions(tenantId, countryId) {
  const list = useRemoteList(Boolean(tenantId && countryId), ["bank", tenantId, countryId], (signal) =>
    postJson(BANK_OPTION_LIST_URL, { tenantId, countryId: Number(countryId) }, { signal }).then((body) =>
      (body.data || []).map((b) => ({ id: b.id, name: String(b.name ?? "").toUpperCase() }))
    )
  );
  const add = useCallback(
    async (name) => {
      const body = await postJson(BANK_OPTION_ADD_URL, { tenantId, countryId: Number(countryId), name });
      list.reload();
      return { id: body.data?.id, name };
    },
    [tenantId, countryId, list]
  );
  const remove = useCallback(
    async (id) => {
      await postJson(BANK_OPTION_DELETE_URL, { id, tenantId, countryId: Number(countryId) });
      list.reload();
    },
    [tenantId, countryId, list]
  );
  return { banks: countryId ? list.data : EMPTY, error: list.error, add, remove };
}

// The company's accounts (normalised account rows) for the Supplier / Customer / Company / Profit Sharing selects.
// put(row) adds or replaces one row (an account made or edited in the modal) without waiting for a reload.
export function useAccountRows(tenantId) {
  const list = useRemoteList(Boolean(tenantId), ["accounts", tenantId], (signal) =>
    postJson(`/api/account/list?tenant_id=${encodeURIComponent(tenantId)}`, null, { signal }).then((body) => (body.data || []).map(normalizeAccountRow))
  );
  const [extra, setExtra] = useState(EMPTY);
  const put = useCallback((row) => setExtra((rows) => [...rows.filter((r) => r.id !== row.id), row]), []);
  const merged = [...list.data.filter((r) => !extra.some((e) => e.id === r.id)), ...extra];
  return { rows: merged, error: list.error, put, reload: list.reload };
}

// Countries and banks the user switched off in the "+" popover: kept in the browser per user and company, so they stay
// off after logging out and in again. Everything is shown unless it was hidden by hand. Keys: "C:MYR", "B:MYR/CIMB".
export function useHiddenBankOptions(tenantId) {
  const [saved, setSaved] = useSavedState(`bankProcess.hidden.${tenantId}`);
  const hidden = Array.isArray(saved) ? saved : EMPTY;
  const isHidden = (key) => hidden.includes(key);
  const toggle = (key) => setSaved(hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key]);
  const forget = (key) => setSaved(hidden.filter((k) => k !== key));
  return { isHidden, toggle, forget };
}
