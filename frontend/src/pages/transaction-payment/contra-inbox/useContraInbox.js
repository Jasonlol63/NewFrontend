import { useCallback, useEffect, useState } from "react";
import { postJson } from "@/lib/api";
import { APPROVE_URL, normalizePending, PENDING_URL, REJECT_URL, sortPending } from "./contraInboxRules";

const POLL_MS = 45000;

/**
 * The pending manual transactions of the current company (the Contra Inbox). It loads when `enabled` and the company are
 * known, again every 45s while the tab is visible and after every approve / reject; reload() asks right away.
 * approve / reject take rows of `rows`, send them one after another and reload; they throw the backend's message on
 * failure (saying how many went through first when some did).
 */
export function useContraInbox(tenantId, enabled) {
  const [state, setState] = useState({ tenantId: null, rows: [], error: "" });
  const [version, setVersion] = useState(0);
  const active = enabled && Boolean(tenantId);

  useEffect(() => {
    if (!active) return undefined;
    const controller = new AbortController();
    postJson(PENDING_URL, { tenantId }, { signal: controller.signal })
      .then((body) => setState({ tenantId, rows: sortPending((body.data || []).map(normalizePending).filter(Boolean)), error: "" }))
      .catch((err) => {
        if (err.name !== "AbortError") setState((s) => ({ tenantId, rows: s.tenantId === tenantId ? s.rows : [], error: err.message }));
      });
    return () => controller.abort();
  }, [active, tenantId, version]);

  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => {
      if (!document.hidden) setVersion((v) => v + 1);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [active]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const decide = useCallback(
    async (url, rows) => {
      let done = 0;
      try {
        for (const row of rows) {
          await postJson(url, { tenantId, id: row.id });
          done += 1;
        }
      } catch (err) {
        throw new Error(done ? `${done} of ${rows.length} done. ${err.message}` : err.message);
      } finally {
        reload();
      }
    },
    [tenantId, reload]
  );
  const approve = useCallback((rows) => decide(APPROVE_URL, rows), [decide]);
  const reject = useCallback((rows) => decide(REJECT_URL, rows), [decide]);

  const current = state.tenantId === tenantId;
  return {
    rows: current ? state.rows : [],
    loading: active && !current,
    error: current ? state.error : "",
    reload,
    approve,
    reject,
  };
}
