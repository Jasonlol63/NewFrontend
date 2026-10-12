import { useEffect, useMemo, useState } from "react";
import { REALTIME_DOMAINS, useRealtime } from "@/lib/realtime/realtimeEvents";
import { fetchAllocation, fetchGroupTotals, fetchTenants } from "./ownershipApi";
import { buildDirectory } from "./ownershipRules";

/**
 * What the Ownership lists need from the server: the Groups and companies (once, again after reload()) and, for the month on
 * screen, how much of each is allocated. While a reload of the same list runs the old rows stay; a different month shows
 * no percentages until its own answer arrives. Someone else saving ownership reloads it too.
 *
 * Returns { directory, allocation (Map tenantId -> %, a Group known by code only: code -> %; or null), error, loading, reload }.
 */
export function useOwnershipOverview(month) {
  const [version, setVersion] = useState(0);
  const [tenants, setTenants] = useState(null); // { version, list } | { version, error }
  const [allocated, setAllocated] = useState(null); // { key, map } | { key, error }

  useEffect(() => {
    const controller = new AbortController();
    fetchTenants({ signal: controller.signal })
      .then((list) => setTenants({ version, list }))
      .catch((err) => err.name !== "AbortError" && setTenants({ version, error: err.message }));
    return () => controller.abort();
  }, [version]);

  const directory = useMemo(() => (tenants?.list ? buildDirectory(tenants.list) : null), [tenants]);
  // Every company and every Group with a ledger of its own has a card somewhere.
  const ids = useMemo(() => (directory ? [...directory.companies.map((c) => c.tenantId), ...directory.groups.map((g) => g.tenantId).filter(Boolean)] : []), [directory]);
  const codeOnly = useMemo(() => (directory ? directory.groups.filter((g) => !g.tenantId).map((g) => g.code) : []), [directory]);
  const key = `${month}|${ids.join(",")}|${codeOnly.join(",")}|${version}`;

  useEffect(() => {
    if (!directory) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    Promise.all([fetchAllocation(ids, month, { signal }), fetchGroupTotals(codeOnly, month, { signal }).catch(() => new Map())])
      .then(([map, totals]) => setAllocated({ key, month, map: new Map([...map, ...totals]) }))
      // The percentages only decorate the cards: when they fail, the cards show no percentage instead of breaking the page.
      .catch((err) => err.name !== "AbortError" && setAllocated({ key, month, map: new Map() }));
    return () => controller.abort();
    // `ids` and `codeOnly` are part of `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useRealtime([REALTIME_DOMAINS.OWNERSHIP], () => setVersion((v) => v + 1));

  return {
    directory,
    allocation: allocated?.month === month ? allocated.map : null,
    error: tenants?.error ?? "",
    loading: !tenants,
    reload: () => setVersion((v) => v + 1),
  };
}
