import { postJson } from "@/lib/api";
import { fetchAccounts, fetchDomains, saveTenantSetting } from "@/pages/domain/domainApi";
import { DEPARTMENTS, isShareAccount, profitAccountOf, round2, settingsFromTenant } from "@/pages/domain/domainSettingsRules";
import { toRow } from "./autoRenewRules";

// Spring Boot calls of the Auto Renew page (C168 only).
const AUTO_RENEW = "/api/auto-renew";

/**
 * One tab of the list: the pending requests inside the 30-day window plus the approved / rejected ones processed inside the date range,
 * each with the Share saved for its company / group (the same one the Domain page edits).
 * kind: "company" | "group"; range: { from, to } as yyyy-mm-dd; ledgerTenantId: C168's tenant id (its accounts take the shares).
 * Returns { rows, counts: { all, pending, approved, rejected }, tabCounts: { company, group }, accounts, shareAccounts }:
 * accounts = the C168 accounts, shareAccounts = the codes that may take a share.
 */
export async function fetchAutoRenew(kind, range, ledgerTenantId, { signal } = {}) {
  const [{ data }, domains, accounts] = await Promise.all([
    postJson(`${AUTO_RENEW}/list`, { status: "all", entity_type: kind, date_from: range?.from || null, date_to: range?.to || null }, { signal }),
    fetchDomains(),
    fetchAccounts(ledgerTenantId),
  ]);
  const sharesOf = new Map();
  for (const { tenant } of domains) if (tenant?.id) sharesOf.set(tenant.id, tenant.feeShareAllocations ?? []);

  const feeSettings = data?.fee_settings ?? {};
  return {
    rows: (data?.rows ?? []).map((r) => {
      const row = toRow(r, feeSettings);
      return { ...row, departments: settingsFromTenant(row.kind, { shares: sharesOf.get(row.tenantId) ?? [], expiry: "", modules: [] }, accounts).departments };
    }),
    counts: {
      pending: data?.counts?.pending ?? 0,
      approved: data?.counts?.approved ?? 0,
      rejected: data?.counts?.rejected ?? 0,
      all: data?.counts?.total ?? 0,
    },
    tabCounts: { company: data?.tab_pending_counts?.company ?? 0, group: data?.tab_pending_counts?.group ?? 0 },
    accounts,
    shareAccounts: accounts.filter(isShareAccount).map((a) => a.code),
  };
}

/** Approves one request: extends the expiry date by the period and, when `charge` is on, posts the domain fee and commissions to the C168 ledger. */
export async function approveRequest(requestId, periodCode, charge) {
  const { data } = await postJson(`${AUTO_RENEW}/approve`, { request_id: requestId, period: periodCode, charge_on_approve: charge });
  return data;
}

export const rejectRequest = (requestId) => postJson(`${AUTO_RENEW}/reject`, { request_id: requestId });

/** Puts an approved / rejected request back to pending; an approved one also gives back its old expiry date and deletes its ledger entries. */
export const undoRequest = (requestId) => postJson(`${AUTO_RENEW}/delete`, { request_id: requestId });

/**
 * Saves the Share of one company / group (the same table the Domain page uses): the Sales / CS / IT rows replace the saved ones and
 * Profit takes what is left. Only the share rows and the unchanged expiry date are sent, so nothing is charged and nothing else changes.
 */
export async function saveShare(row, accounts) {
  const idByCode = new Map(accounts.map((a) => [a.code, a.id]));
  const profit = profitAccountOf(accounts);
  if (!profit) throw new Error("No active Profit account (role PROFIT) was found, so the share cannot be saved");

  const rows = [];
  let taken = 0;
  for (const { key } of DEPARTMENTS) {
    for (const r of row.departments[key]) {
      if (!(r.pct > 0) || !idByCode.has(r.account)) continue;
      rows.push({ shareType: key.toUpperCase(), accountId: idByCode.get(r.account), ownerType: "user", percentage: round2(r.pct) });
      taken += r.pct;
    }
  }
  const profitRow = { shareType: "PROFIT", accountId: profit.id, ownerType: "owner", percentage: Math.max(0, round2(100 - taken)) };
  await saveTenantSetting({
    id: row.tenantId,
    ownerId: row.ownerId,
    code: row.company,
    expirationDate: row.expiry,
    feeShareAllocations: [profitRow, ...rows].map((r, sortOrder) => ({ ...r, sortOrder })),
  });
}
