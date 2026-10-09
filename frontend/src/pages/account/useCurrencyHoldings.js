import { useEffect, useState } from "react";
import { loadCurrencyHoldings } from "./currencySettingApi";

// Loads the Currency Setting modal's data once: { data: { currencies, holdings }, loading, error }.
export function useCurrencyHoldings(tenantId, accounts) {
  const [state, setState] = useState({ key: null, data: null, error: "" });

  useEffect(() => {
    if (!tenantId) return undefined;
    const controller = new AbortController();
    loadCurrencyHoldings(tenantId, accounts, controller.signal)
      .then((data) => setState({ key: tenantId, data, error: "" }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ key: tenantId, data: null, error: err.message });
      });
    return () => controller.abort();
  }, [tenantId, accounts]);

  const current = state.key === tenantId;
  return { data: current ? state.data : null, error: current ? state.error : "", loading: Boolean(tenantId) && !current };
}
