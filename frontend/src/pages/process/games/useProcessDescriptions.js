import { useCallback, useEffect, useState } from "react";
import { postJson } from "@/lib/api";

const LIST_URL = "/api/process/list-description";
const ADD_URL = "/api/process/add-description";
const DELETE_URL = "/api/process/delete-description";

const toItem = (d) => ({ value: d.id, label: String(d.name ?? "").trim() });

/**
 * Description dictionary of one tenant, as picker items [{ value: id, label: name }].
 * add / remove throw on failure (the picker shows the message); the list follows on success.
 */
export function useProcessDescriptions(tenantId) {
  const [state, setState] = useState({ items: [], error: "" });

  useEffect(() => {
    if (!tenantId) return undefined;
    const controller = new AbortController();
    postJson(LIST_URL, tenantId, { signal: controller.signal })
      .then((body) => setState({ items: (body.data || []).map(toItem), error: "" }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ items: [], error: err.message });
      });
    return () => controller.abort();
  }, [tenantId]);

  // Returns the new item so the picker can tick it.
  const add = useCallback(
    async (name) => {
      const body = await postJson(ADD_URL, { tenantId, name });
      const item = toItem(body.data);
      setState((s) => ({ ...s, items: [item, ...s.items] }));
      return item;
    },
    [tenantId]
  );

  const remove = useCallback(
    async (id) => {
      await postJson(DELETE_URL, { id, tenantId });
      setState((s) => ({ ...s, items: s.items.filter((it) => it.value !== id) }));
    },
    [tenantId]
  );

  return { items: state.items, error: state.error, add, remove };
}
