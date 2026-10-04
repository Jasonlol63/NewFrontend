import { useEffect, useState } from "react";
import { postJson } from "@/lib/api";
import { PROCESS_LIST_URL, normalizeProcess } from "./domainReportRules";

// Every process of one tenant (the body of the request is just the tenant id). The previous
// tenant's list stays until the new one arrives.
export function useProcesses(tenantId) {
  const [state, setState] = useState({ tenantId: null, processes: [], error: "" });

  useEffect(() => {
    if (!tenantId) return undefined;
    const controller = new AbortController();
    postJson(PROCESS_LIST_URL, tenantId, { signal: controller.signal })
      .then((reply) =>
        setState({ tenantId, processes: (reply.data || []).map(normalizeProcess).filter(Boolean), error: "" })
      )
      .catch((err) => {
        if (err.name !== "AbortError") setState({ tenantId, processes: [], error: err.message });
      });
    return () => controller.abort();
  }, [tenantId]);

  return { processes: state.processes, error: state.tenantId === tenantId ? state.error : "" };
}
