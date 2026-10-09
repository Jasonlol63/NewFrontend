import { useCallback, useEffect, useState } from "react";
import { postJson } from "@/lib/api";

/**
 * Rows of one tenant from a Spring list API that follows the `${base}/list?tenant_id=`,
 * `${base}/updateStatus` and `${base}/delete` pattern (/api/userlist, /api/account).
 * While another tenant is loading the previous rows stay on screen; `loading` dims them.
 *  - normalize(item) maps one API row; rowKey(row) identifies a row.
 */
export function useTenantList(base, tenantId, { normalize, rowKey = (row) => row.id }) {
  const [state, setState] = useState({ tenantId: null, rows: [], error: "" });
  // Bumped by reload() to fetch the same tenant again (after an add / edit elsewhere).
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!tenantId) return;
    const controller = new AbortController();
    postJson(`${base}/list?tenant_id=${encodeURIComponent(tenantId)}`, null, { signal: controller.signal })
      .then((body) => setState({ tenantId, rows: (body.data || []).map(normalize), error: "" }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ tenantId, rows: [], error: err.message });
      });
    return () => controller.abort();
  }, [base, tenantId, normalize, version]);

  // The response carries the new status; the rest of the row is kept as listed.
  const toggleStatus = useCallback(
    async (row) => {
      const body = await postJson(`${base}/updateStatus`, { id: row.id, scopeTenantId: tenantId });
      const { status } = normalize(body.data);
      const key = rowKey(row);
      setState((s) => ({ ...s, rows: s.rows.map((r) => (rowKey(r) === key ? { ...r, status } : r)) }));
    },
    [base, tenantId, normalize, rowKey]
  );

  // Deletes one by one so a failure part-way still removes the ones that went through.
  const deleteRows = useCallback(
    async (rows) => {
      const deleted = new Set();
      try {
        for (const row of rows) {
          await postJson(`${base}/delete`, { id: row.id, scopeTenantId: tenantId });
          deleted.add(rowKey(row));
        }
      } finally {
        setState((s) => ({ ...s, rows: s.rows.filter((r) => !deleted.has(rowKey(r))) }));
      }
    },
    [base, tenantId, rowKey]
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
