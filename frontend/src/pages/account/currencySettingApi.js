import { postJson } from "@/lib/api";

// Requests of the Currency Setting modal (/api/currency). Holdings are { [currencyCode]: Set<accountId code> };
// the backend works with account primary keys, so they are converted here (account codes are unique per company).

const enc = encodeURIComponent;
const UPDATE_URL = "/api/currency/account/linked-accounts-update";

// The company's currencies ([{ id, code, deletable }], deletable is false for ones synced from a subsidiary) and
// which of the given accounts hold each of them. Accounts the list doesn't contain (no permission) are ignored.
// One request for the list, then one per currency, in parallel.
export async function loadCurrencyHoldings(tenantId, accounts, signal) {
  const body = await postJson(`/api/currency/available?tenant_id=${enc(tenantId)}`, null, { signal });
  const currencies = (body.data || []).map((c) => ({
    id: c.id,
    code: String(c.code ?? "").toUpperCase(),
    deletable: c.deletable !== false,
  }));
  const codeByPk = new Map(accounts.map((a) => [a.id, a.accountId]));
  const linked = await Promise.all(
    currencies.map((c) =>
      postJson(`/api/currency/account/linked-accounts?currency_id=${enc(c.id)}&tenant_id=${enc(tenantId)}`, null, { signal })
    )
  );
  const holdings = Object.fromEntries(
    currencies.map((c, i) => [c.code, new Set((linked[i].data?.linked_account_ids ?? []).map((id) => codeByPk.get(id)).filter(Boolean))])
  );
  return { currencies, holdings };
}

// Writes right away, like Add Currency / Delete in the Add Account modal; resolves to the new currency ({ id, ... }).
export const createCurrency = (tenantId, code) => postJson("/api/currency/add", { tenantId, code }).then((body) => body.data);

export const deleteCurrency = (tenantId, id) => postJson(`/api/currency/delete?id=${enc(id)}&tenantId=${enc(tenantId)}`, null);

/**
 * Saves the confirmed changes ([{ currency, added: [accountCode], removed: [accountCode] }]). The backend takes one
 * currency per request and refuses to remove an account's last currency, so everything is added first and only
 * then removed: an account moved from one currency to another always holds at least one.
 */
export async function saveHoldings(tenantId, changes, currencyIdByCode, accountPkByCode) {
  const post = (currencyId, linked, unlinked) =>
    postJson(UPDATE_URL, { tenantId, currencyId, linked_account_ids: linked, unlinked_account_ids: unlinked });
  const pks = (codes) => codes.map((c) => accountPkByCode.get(c));
  for (const c of changes) {
    if (c.added.length) await post(currencyIdByCode[c.currency], pks(c.added), []);
  }
  for (const c of changes) {
    if (c.removed.length) await post(currencyIdByCode[c.currency], [], pks(c.removed));
  }
}
