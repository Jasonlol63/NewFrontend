import { useCallback, useEffect, useState } from "react";
import { postJson } from "@/lib/api";

// The tenant's currencies for the Add / Edit Account modal: [{ id, code, linked, deletable }].
// `linked` = the account already holds it (Edit); `deletable` is false for currencies synced from a
// subsidiary. create(code) and remove(id) write to the database right away (they are separate from
// saving the account); both reload the list and throw the backend's message on failure.
export function useAccountCurrencies(tenantId, accountId) {
  const [state, setState] = useState({ key: null, currencies: [], error: "" });
  const [version, setVersion] = useState(0);
  const key = `${tenantId}:${accountId ?? ""}:${version}`;

  useEffect(() => {
    if (!tenantId) return undefined;
    const controller = new AbortController();
    const query = `tenant_id=${encodeURIComponent(tenantId)}${accountId ? `&account_id=${encodeURIComponent(accountId)}` : ""}`;
    postJson(`/api/currency/available?${query}`, null, { signal: controller.signal })
      .then((body) =>
        setState({
          key,
          error: "",
          currencies: (body.data || []).map((c) => ({
            id: c.id,
            code: String(c.code ?? "").toUpperCase(),
            linked: Boolean(c.is_linked),
            deletable: c.deletable !== false,
          })),
        })
      )
      .catch((err) => {
        if (err.name !== "AbortError") setState({ key, currencies: [], error: err.message });
      });
    return () => controller.abort();
  }, [tenantId, accountId, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  // Resolves to the new currency's id.
  const create = useCallback(
    async (code) => {
      const body = await postJson("/api/currency/add", { tenantId, code });
      reload();
      return body.data?.id;
    },
    [tenantId, reload]
  );

  const remove = useCallback(
    async (id) => {
      await postJson(`/api/currency/delete?id=${encodeURIComponent(id)}&tenantId=${encodeURIComponent(tenantId)}`, null);
      reload();
    },
    [tenantId, reload]
  );

  const current = state.key === key;
  return { currencies: state.currencies, error: current ? state.error : "", loading: Boolean(tenantId) && !current, create, remove };
}
