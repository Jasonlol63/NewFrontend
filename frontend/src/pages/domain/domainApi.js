import { getJson, postJson, sendJson } from "@/lib/api";
import { normalizeAccountRow } from "@/pages/account/accountRules";

// Spring Boot calls of the Domain page (C168 only). Every list is read again after a change.

const DOMAIN = "/api/domain";

/** The flat owner x tenant rows; domainRules.toDomains folds them into one row per owner. */
export async function fetchDomains() {
  const { data } = await postJson(`${DOMAIN}/list`, null);
  return data ?? [];
}

/** Returns the saved domain: the back end fills in the ids of the groups and companies it created. */
export async function createDomain(body) {
  const { data } = await postJson(`${DOMAIN}/add`, body);
  return data;
}

export async function updateDomain(body) {
  const { data } = await sendJson("PUT", `${DOMAIN}/update`, body);
  return data;
}

/** One group or company: expiry date, company type, share rows and (optionally) the domain fee charge. */
export const saveTenantSetting = (body) => sendJson("PUT", `${DOMAIN}/update-setting`, body);

/** Deletes one owner with all its groups and companies (and their C168 accounts); refused when one has transactions. */
export const deleteDomain = (id) => postJson(`${DOMAIN}/delete`, { id });

export async function fetchPrices() {
  const { data } = await postJson(`${DOMAIN}/list-fee`, null);
  return data?.[0] ?? null;
}

export async function savePrices(body) {
  const { data } = await postJson(`${DOMAIN}/add-fee`, body);
  return data;
}

/** The accounts of the C168 ledger as { id, code, role, status }; domainSettingsRules picks who may take a share. */
export async function fetchAccounts(tenantId) {
  const { data } = await postJson(`/api/account/list?tenant_id=${encodeURIComponent(tenantId)}`, null);
  return (data ?? []).map(normalizeAccountRow).map((a) => ({ id: a.id, code: a.accountId, role: a.role, status: a.status }));
}
