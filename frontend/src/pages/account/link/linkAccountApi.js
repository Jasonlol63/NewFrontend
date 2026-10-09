import { getJson, postJson, sendJson } from "@/lib/api";

// Link types as the modal uses them:
//   "bi"  both accounts see each other
//   "uni" a one-way link from the account being edited to the other one
//   "in"  a one-way link from the other account to the one being edited (shown, but only upgradable)
// The backend stores one row per pair (BIDIRECTIONAL / UNIDIRECTIONAL + the source account).
const TO_BACKEND = { bi: "BIDIRECTIONAL", uni: "UNIDIRECTIONAL" };

/**
 * Every link `accountId` is part of: { links: Map(otherAccountId -> "bi" | "uni" | "in"), labels: Map(otherAccountId -> Account ID text) }.
 */
export async function fetchAccountLinks(accountId, tenantId, { signal } = {}) {
  const body = await getJson("/api/account/link/manage", { account_id: accountId, tenant_id: tenantId }, { signal });
  const types = body.data?.link_types_map ?? {};
  const incoming = new Set(body.data?.incoming_ids ?? []);
  const links = new Map();
  Object.entries(types).forEach(([key, type]) => {
    const id = Number(key);
    links.set(id, incoming.has(id) ? "in" : String(type).toLowerCase() === "unidirectional" ? "uni" : "bi");
  });
  const labels = new Map((body.data?.accounts ?? []).map((a) => [a.id, a.accountId]));
  return { links, labels };
}

/** Sends one change for the account being edited; throws the backend's message on failure. */
export async function applyLinkOp(op, accountId, tenantId) {
  const pair = { accountId1: accountId, accountId2: op.id, tenantId };
  // A unidirectional link points from the account being edited to the other one.
  const link = { ...pair, linkType: TO_BACKEND[op.type], sourceAccountId: op.type === "uni" ? accountId : null };
  if (op.kind === "add") await postJson("/api/account/link", link);
  else if (op.kind === "change") await sendJson("PUT", "/api/account/link", link);
  else {
    const query = new URLSearchParams({ account_id_1: accountId, account_id_2: op.id, tenant_id: tenantId });
    await sendJson("DELETE", `/api/account/link/pair?${query}`);
  }
}
