import { useCallback, useEffect, useState } from "react";
import { postJson } from "@/lib/api";
import { DUE_INBOX_URL, DUE_POST_URL, DUE_SKIP_URL, normalizeDue, sortBills, todayIso } from "./accountingDueRules";

// The backend accepts an `asOf` from today up to the end of this year; anything earlier counts as today.
const asOfFor = (date) => (date && date > todayIso() ? date : null);

const fetchInbox = (tenantId, asOf, restoreSkipped, signal) =>
  postJson(DUE_INBOX_URL, { tenantId, asOf: asOfFor(asOf), restoreSkipped }, { signal }).then((body) =>
    sortBills((body.data || []).map(normalizeDue).filter(Boolean))
  );

/**
 * The bills of Accounting Due up to `asOf` (the Early transaction date; null = today). A new date or company loads again;
 * reload({ restoreSkipped }) asks the backend to bring back skipped bills first (it only does so while its
 * app.accounting-due.restore-skipped-enabled switch is on). post / skip send bills (the rows of `bills`) and reload; they throw
 * the backend's message on failure. post resolves to the number of transaction lines it created.
 */
export function useAccountingDue(tenantId, asOf) {
  const [state, setState] = useState({ key: null, bills: [], error: "" });
  const [request, setRequest] = useState({ version: 0, restoreSkipped: false });
  const key = `${tenantId}:${asOf}:${request.version}`;

  useEffect(() => {
    if (!tenantId) return undefined;
    const controller = new AbortController();
    fetchInbox(tenantId, asOf, request.restoreSkipped, controller.signal)
      .then((bills) => setState({ key, bills, error: "" }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ key, bills: [], error: err.message });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` identifies the request
  }, [tenantId, asOf, key]);

  const reload = useCallback(({ restoreSkipped = false } = {}) => setRequest((r) => ({ version: r.version + 1, restoreSkipped })), []);

  const post = useCallback(
    async (bills) => {
      const body = await postJson(DUE_POST_URL, bills.map((b) => b.raw));
      reload();
      return body.data?.createdCount ?? 0;
    },
    [reload]
  );
  const skip = useCallback(
    async (bills) => {
      await postJson(DUE_SKIP_URL, bills.map((b) => b.raw));
      reload();
    },
    [reload]
  );

  return { bills: state.bills, loading: Boolean(tenantId) && state.key !== key, error: state.key === key ? state.error : "", reload, post, skip };
}

// How many bills are due now (the number on the Accounting Due button); refresh() asks again, e.g. after the modal closes.
export function useDueCount(tenantId) {
  const [state, setState] = useState({ tenantId: null, bills: [] });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!tenantId) return undefined;
    const controller = new AbortController();
    fetchInbox(tenantId, null, false, controller.signal)
      .then((bills) => setState({ tenantId, bills }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ tenantId, bills: [] });
      });
    return () => controller.abort();
  }, [tenantId, version]);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return { bills: state.tenantId === tenantId ? state.bills : [], refresh };
}
