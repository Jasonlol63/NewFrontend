import { useEffect, useMemo, useState } from "react";
import { postJson } from "@/lib/api";

// The company's currencies as select options [{ value: "<id>", label: "MYR" }] (the select works with strings;
// the backend wants the numeric id).
export function useProcessCurrencies(tenantId) {
  const [state, setState] = useState({ tenantId: null, currencies: [], error: "" });

  useEffect(() => {
    if (!tenantId) return undefined;
    const controller = new AbortController();
    postJson(`/api/currency/available?tenant_id=${encodeURIComponent(tenantId)}`, null, { signal: controller.signal })
      .then((body) => setState({ tenantId, currencies: body.data || [], error: "" }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ tenantId, currencies: [], error: err.message });
      });
    return () => controller.abort();
  }, [tenantId]);

  const current = state.tenantId === tenantId;
  const options = useMemo(
    () => (current ? state.currencies : []).map((c) => ({ value: String(c.id), label: String(c.code ?? "").toUpperCase() })),
    [current, state.currencies]
  );
  return { options, error: current ? state.error : "", loading: Boolean(tenantId) && !current };
}
