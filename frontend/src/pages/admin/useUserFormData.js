import { useEffect, useState } from "react";
import { postJson } from "@/lib/api";
import { normalizeAccountRow } from "@/pages/account/accountRules";
import { PROCESS_LIST_URL, normalizeProcessRow } from "@/pages/process/games/processRules";

// One request, identified by `key`: loading is true until the answer for the current key has
// arrived, and `enabled` false skips the request.
function useLoaded(key, enabled, load) {
  const [state, setState] = useState({ key: null, data: null, error: "" });
  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    load(controller.signal)
      .then((data) => setState({ key, data, error: "" }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ key, data: null, error: err.message });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` is rebuilt every render; `key` identifies the request
  }, [key, enabled]);
  const current = state.key === key;
  return { data: current ? state.data : null, error: current ? state.error : "", loading: enabled && !current };
}

// Accounts of the tenant as checklist items { id, code, name }.
export function useAccountItems(tenantId) {
  const { data, error, loading } = useLoaded(`accounts:${tenantId}`, Boolean(tenantId), (signal) =>
    postJson(`/api/account/list?tenant_id=${encodeURIComponent(tenantId)}`, null, { signal }).then((body) =>
      (body.data || []).map(normalizeAccountRow).map((a) => ({ id: a.id, code: a.accountId, name: a.name }))
    )
  );
  return { items: data ?? EMPTY, error, loading };
}

// Game processes of the tenant as checklist items { id, code, name }.
export function useProcessItems(tenantId) {
  const { data, error, loading } = useLoaded(`processes:${tenantId}`, Boolean(tenantId), (signal) =>
    postJson(PROCESS_LIST_URL, tenantId, { signal }).then((body) =>
      (body.data || [])
        .map(normalizeProcessRow)
        .filter((p) => p && p.category === "GAME")
        .map((p) => ({ id: p.id, code: p.code, name: p.description }))
    )
  );
  return { items: data ?? EMPTY, error, loading };
}

// The full record of the user being edited (permissions and account / process access are not in the list).
export function useUserDetail(userId, tenantId, enabled) {
  const { data, error, loading } = useLoaded(
    `user:${userId}:${tenantId}`,
    enabled && Boolean(userId && tenantId),
    (signal) =>
      postJson(
        `/api/userlist/get?user_id=${encodeURIComponent(userId)}&scope_tenant_id=${encodeURIComponent(tenantId)}`,
        null,
        { signal }
      ).then((body) => body.data)
  );
  return { detail: data, error, loading };
}

const EMPTY = [];
