// Spring Boot calls of the Ownership page (/api/ownership/*, TenantOwnershipController). getJson / postJson (lib/api.js)
// throw the server's message when a call is not a success; Link Partner uses postJsonRaw because its "conflict" answer
// carries data.
import { getJson, postJson, postJsonRaw } from "@/lib/api";
import { normalizeCandidate, normalizeOwner, normalizeTenant, toPayload, totalAllocation } from "./ownershipRules";

const BASE = "/api/ownership";

/** Every Group and company this login can reach (with their expiry), as normalizeTenant rows. */
export async function fetchTenants({ signal } = {}) {
  const body = await getJson("/auth/tenant-accessible", { all: 1 }, { signal });
  return (body.data ?? []).map(normalizeTenant).filter(Boolean);
}

/** tenantId -> the percentage already given away (0 when nothing is allocated), for the month's cards. */
export async function fetchAllocation(tenantIds, month, { signal } = {}) {
  if (tenantIds.length === 0) return new Map();
  const body = await postJson(`${BASE}/allocation-summary`, { tenant_ids: tenantIds, month }, { signal });
  return new Map((body.data ?? []).map((r) => [Number(r.tenant_id), Number(r.allocated_percentage) || 0]));
}

/**
 * code -> the percentage given away, for Groups this login has no tenant id for. A partnership or admin login is only granted
 * companies, so the Groups above them are known by code alone; the list call takes a code in place of the id, the summary
 * call does not, so the total is added up from each Group's own list.
 */
export async function fetchGroupTotals(codes, month, { signal } = {}) {
  const lists = await Promise.all(codes.map((code) => fetchOwners(code, month, { signal }).then((rows) => [code, totalAllocation(rows)])));
  return new Map(lists);
}

/** The shareholders of a company or Group (its tenant id, or the Group's code) in a month: the live list for the current month, that month's saved copy otherwise. */
export async function fetchOwners(tenantId, month, { signal } = {}) {
  const body = await getJson(`${BASE}/list`, { tenant_id: tenantId, month }, { signal });
  return (body.data ?? []).map(normalizeOwner);
}

/** The accounts that can be given a share (the Account select), already without those the month's list holds. */
export async function fetchCandidates(tenantId, month, { signal } = {}) {
  const body = await getJson(`${BASE}/available-accounts`, { tenant_id: tenantId, month }, { signal });
  return (body.data ?? []).map(normalizeCandidate);
}

/** Replaces the list of a company / Group. month: only for a past month (that month's copy is saved), none = the live list. */
export async function saveOwners(tenantId, rows, month) {
  await postJson(`${BASE}/batch-save-ownership`, toPayload(tenantId, rows, month));
}

/**
 * Links an external partner by Login ID or Group ID. Answers { status: "success" | "conflict", message, data }; a conflict means
 * the id matches a login and a Group, and the call has to be made again with forceType "login" or "group".
 * Anything else that goes wrong throws the server's message.
 */
export async function linkPartner(tenantId, loginId, forceType = "") {
  const body = await postJsonRaw(`${BASE}/link-partner`, { tenant_id: tenantId, login_id: loginId, force_type: forceType });
  if (body.status === "success" || body.success === true) return { status: "success", message: body.message || "Partner linked successfully" };
  if (body.status === "conflict") return { status: "conflict", message: body.message, data: body.data ?? {} };
  throw new Error(body.message || "Link partner failed");
}

/** Puts a company in a Group (parentCode), or takes it out of its Group (null). */
export async function setParent(tenantId, parentCode) {
  await postJson(`${BASE}/update-parent-tenant`, { tenant_id: tenantId, parent_code: parentCode });
}
