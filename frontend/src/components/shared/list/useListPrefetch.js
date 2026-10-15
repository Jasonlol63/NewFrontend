import { useCallback, useEffect } from "react";
import { useSession } from "@/context/session";
import { hasTenantList, prefetchTenantList } from "./useTenantList";

// The big companies: once the page has settled they are loaded in the background, one by one, so the first switch to them is quick too.
const PREFETCH_COMPANIES = ["95", "AG"];

/**
 * Warming of a useTenantList page's company lists. Returns the handler for ListToolbar's onCompanyPressStart (a company chip
 * pressed down starts loading that company before the click is finished); the big companies also load in the background once
 * `loading` is over (not while the tab is hidden, not what is remembered already).
 */
export function useListPrefetch(base, normalize, scope, loading) {
  const { user } = useSession();
  const userId = user?.user_id ?? null;
  const { companyOptions, tenantId } = scope;

  const onCompanyPressStart = useCallback(
    (code) => prefetchTenantList(base, normalize, userId, companyOptions.find((c) => c.value === code)?.tenantId),
    [base, normalize, userId, companyOptions]
  );

  useEffect(() => {
    if (loading) return undefined;
    const ids = PREFETCH_COMPANIES.map((code) => companyOptions.find((c) => c.value === code)?.tenantId).filter(
      (id) => id && id !== tenantId && !hasTenantList(base, normalize, userId, id)
    );
    if (!ids.length) return undefined;
    let cancelled = false;
    let timer = setTimeout(async () => {
      for (const id of ids) {
        if (cancelled || document.hidden) return;
        prefetchTenantList(base, normalize, userId, id);
        await new Promise((resolve) => {
          timer = setTimeout(resolve, 1500);
        });
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [base, normalize, userId, loading, companyOptions, tenantId]);

  return onCompanyPressStart;
}
