import { MOCK_CURRENCIES } from "./accountFormOptions";

// Rules of the Currency Setting modal: which accounts hold which currency, and what has changed
// between the saved holdings (`orig`) and the working copy (`draft`).
// Holdings are { [currencyCode]: Set<accountId> }. UI only for now: there is no currency API yet.

export const INITIAL_CURRENCIES = MOCK_CURRENCIES;

// Shown only while the account list API has nothing to give (design preview).
export const MOCK_ACCOUNTS = `1039 IT01 KUNZZ|23 GODZILLA|58 GU LAI XIONG|72 BOTAK|95 BOSS|977 WUMING|AG APEX GAMING|AJ AH JI|AP BOSS|APPLE LI PING|ASIA APG|BANG BANG|BEE BEE|BK1 IT01 KUNZZ|C168 EZAY COUNT|CAPITAL CAPITAL|CX BOSS|DARREN DARREN|EXPENSES EXPENSES|G66 QI YE|GP BOSS|GT APG|IG BOSS|JK JACK|K BOSS|LOL IT01 KUNZZ|M1 MODE|M2 MODE|MAC999 MUAR MACHI|MG MG|RS BOSS|SABAH HE QI|TEST TEST|TZX PAGOH XIAN|UG UNIPAY HAO|VG BOSS|WCC WCC|WINE KC|WSMT WEI SONG|X17 JX|ZERO ZERO`
  .split("|")
  .map((s) => {
    const i = s.indexOf(" ");
    return { id: s.slice(0, i), accountId: s.slice(0, i), name: s.slice(i + 1) };
  });

// Placeholder holdings: MYR holds the first twelve accounts, every other currency a spread of them.
export function mockHoldings(accounts, currencies) {
  return Object.fromEntries(
    currencies.map((code, ci) => [
      code,
      new Set(accounts.filter((a, i) => (code === "MYR" ? i < 12 : (i * 7 + ci * 3) % 5 === 0)).map((a) => a.accountId)),
    ])
  );
}

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
