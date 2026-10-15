import { getJson } from "@/lib/api";
import { buildQuery } from "./auditLogRules";

// Spring Boot calls of the Audit Log page (IT accounts only).
const AUDIT = "/api/it/audit-log";

/** One page of the log, newest first. Returns { rows, total }. filters: see buildQuery. */
export async function fetchAuditLog(filters, { signal } = {}) {
  const body = await getJson(AUDIT, buildQuery(filters), { signal });
  return { rows: body.data ?? [], total: body.total ?? 0 };
}

/** How many rows each action has under the same filters (the action filter itself is left out, so every tile keeps its number). */
export async function fetchAuditSummary(filters, { signal } = {}) {
  const { data } = await getJson(`${AUDIT}/summary`, buildQuery({ ...filters, action: null, page: null, size: null }), { signal });
  return {
    create: data?.createCount ?? 0,
    update: data?.updateCount ?? 0,
    delete: data?.deleteCount ?? 0,
    restorable: data?.restorableCount ?? 0,
  };
}

/** The company codes and module names that appear in the log, for the two dropdowns. */
export async function fetchAuditOptions({ signal } = {}) {
  const { data } = await getJson(`${AUDIT}/options`, undefined, { signal });
  return { companies: data?.tenantCodes ?? [], modules: data?.modules ?? [] };
}
