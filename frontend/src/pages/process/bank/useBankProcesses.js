import { useCallback, useEffect, useState } from "react";
import { postJson } from "@/lib/api";
import { BANK_RESEND_URL } from "./bankResendRules";
import {
  BANK_COUNTRY_LIST_URL,
  BANK_DELETE_URL,
  BANK_LIST_URL,
  BANK_REMARK_URL,
  BANK_STATUS_URL,
  normalizeBankRow,
} from "./bankProcessRules";

/**
 * Bank processes of one tenant (null tenant: nothing loads). While another tenant is loading the previous rows
 * stay on screen; `loading` dims them. changeStatus / saveRemark / resend / deleteRows call the API and throw on failure.
 */
export function useBankProcesses(tenantId) {
  const [state, setState] = useState({ tenantId: null, rows: [], error: "" });
  // Bumped by reload() to fetch the same tenant again (after an add / edit).
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!tenantId) return undefined;
    const controller = new AbortController();
    postJson(BANK_LIST_URL, tenantId, { signal: controller.signal })
      .then((body) => setState({ tenantId, rows: (body.data || []).map(normalizeBankRow).filter(Boolean), error: "" }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ tenantId, rows: [], error: err.message });
      });
    return () => controller.abort();
  }, [tenantId, version]);

  const patchRow = useCallback((id, patch) => setState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) })), []);

  // WAITING can't be picked; the backend also opens or closes the process's accounting dues for the new status.
  const changeStatus = useCallback(
    async (row, status) => {
      const body = await postJson(BANK_STATUS_URL, { id: row.id, tenantId, status });
      patchRow(row.id, { status: String(body.data?.status ?? status).toUpperCase(), updatedBy: body.data?.updatedBy ?? row.updatedBy });
    },
    [tenantId, patchRow]
  );

  const saveRemark = useCallback(
    async (row, remark) => {
      await postJson(BANK_REMARK_URL, { id: row.id, tenantId, remark });
      patchRow(row.id, { remark });
    },
    [tenantId, patchRow]
  );

  // Resend to Accounting Due: the body is built by buildResendRequest; nothing on the list changes.
  const resend = useCallback(async (request) => {
    await postJson(BANK_RESEND_URL, request);
  }, []);

  // Deletes one by one so a failure part-way still removes the ones that went through.
  const deleteRows = useCallback(
    async (rows) => {
      const deleted = new Set();
      try {
        for (const row of rows) {
          await postJson(BANK_DELETE_URL, { id: row.id, tenantId });
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
    changeStatus,
    saveRemark,
    resend,
    deleteRows,
    reload,
  };
}

// The company's bank countries (= the currencies a Bank Process can be in) as codes, for the Currency chips.
export function useBankCountries(tenantId) {
  const [state, setState] = useState({ tenantId: null, codes: [] });
  useEffect(() => {
    if (!tenantId) return undefined;
    const controller = new AbortController();
    postJson(BANK_COUNTRY_LIST_URL, tenantId, { signal: controller.signal })
      .then((body) => setState({ tenantId, codes: (body.data || []).map((c) => String(c.code ?? "").toUpperCase()).filter(Boolean) }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ tenantId, codes: [] });
      });
    return () => controller.abort();
  }, [tenantId]);
  return state.tenantId === tenantId ? state.codes : EMPTY;
}

const EMPTY = [];
