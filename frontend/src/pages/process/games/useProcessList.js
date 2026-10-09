import { useCallback, useEffect, useState } from "react";
import { postJson } from "@/lib/api";
import { PROCESS_DELETE_URL, PROCESS_LIST_URL, PROCESS_STATUS_URL, normalizeProcessRow } from "./processRules";

/**
 * Processes of one tenant. The list request body is just the tenant id; status and delete take
 * { id, tenantId }. While another tenant is loading the previous rows stay on screen; `loading` dims them.
 */
export function useProcessList(tenantId) {
  const [state, setState] = useState({ tenantId: null, rows: [], error: "" });
  // Bumped by reload() to fetch the same tenant again (after an add / edit).
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!tenantId) return undefined;
    const controller = new AbortController();
    postJson(PROCESS_LIST_URL, tenantId, { signal: controller.signal })
      .then((body) => setState({ tenantId, rows: (body.data || []).map(normalizeProcessRow).filter(Boolean), error: "" }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ tenantId, rows: [], error: err.message });
      });
    return () => controller.abort();
  }, [tenantId, version]);

  const toggleStatus = useCallback(
    async (row) => {
      const body = await postJson(PROCESS_STATUS_URL, { id: row.id, tenantId });
      const status = String(body.data?.status || row.status).toLowerCase();
      setState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === row.id ? { ...r, status } : r)) }));
    },
    [tenantId]
  );

  // Deletes one by one so a failure part-way still removes the ones that went through.
  const deleteRows = useCallback(
    async (rows) => {
      const deleted = new Set();
      try {
        for (const row of rows) {
          await postJson(PROCESS_DELETE_URL, { id: row.id, tenantId });
          deleted.add(row.id);
        }
      } finally {
        setState((s) => ({ ...s, rows: s.rows.filter((r) => !deleted.has(r.id)) }));
      }
    },
    [tenantId]
  );

  const current = state.tenantId === tenantId;
  return {
    rows: state.rows,
    error: current ? state.error : "",
    loading: Boolean(tenantId) && !current,
    toggleStatus,
    deleteRows,
    reload,
  };
}
