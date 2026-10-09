// Rules of the Currency Setting modal: which accounts hold which currency, and what has changed
// between the saved holdings (`orig`) and the working copy (`draft`).
// Holdings are { [currencyCode]: Set<accountId code> }; they are loaded by currencySettingApi.

export const cloneHoldings = (holdings) => Object.fromEntries(Object.entries(holdings).map(([c, set]) => [c, new Set(set)]));

// "on": holds it now (draft). "new": holds it only in the draft. "rm": held when saved, dropped in the draft.
export function holdState(orig, draft, currency, accountId) {
  const now = draft[currency]?.has(accountId);
  const was = orig[currency]?.has(accountId);
  if (now) return was ? "on" : "new";
  return was ? "rm" : "off";
}

// Every currency with unsaved changes: [{ currency, removed: [accountId], added: [accountId] }], in account order.
export function buildChanges(accounts, orig, draft, currencies) {
  return currencies
    .map((currency) => ({
      currency,
      removed: accounts.filter((a) => holdState(orig, draft, currency, a.accountId) === "rm").map((a) => a.accountId),
      added: accounts.filter((a) => holdState(orig, draft, currency, a.accountId) === "new").map((a) => a.accountId),
    }))
    .filter((c) => c.removed.length || c.added.length);
}

export const countChanges = (changes) => changes.reduce((n, c) => n + c.removed.length + c.added.length, 0);

// Accounts that the changes would leave without any currency (the backend refuses to remove a last one).
export function strandedAccounts(changes, holdings, currencies) {
  const removed = new Set(changes.flatMap((c) => c.removed));
  return [...removed].filter((id) => currencies.every((c) => !holdings[c]?.has(id)));
}

export const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "on", label: "Selected" },
  { value: "chg", label: "Changed" },
  { value: "off", label: "Unselected" },
];

export function visibleAccounts(accounts, { query, filter, orig, draft, currency }) {
  const q = query.trim().toLowerCase();
  return accounts.filter((a) => {
    if (q && !`${a.accountId} ${a.name}`.toLowerCase().includes(q)) return false;
    const state = holdState(orig, draft, currency, a.accountId);
    if (filter === "on") return state === "on" || state === "new";
    if (filter === "off") return state === "off" || state === "rm";
    if (filter === "chg") return state === "rm" || state === "new";
    return true;
  });
}
