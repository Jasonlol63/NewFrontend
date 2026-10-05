import { compareText, matchesSearch, sortRows } from "@/components/shared/list/listFormat";

// Most names a row shows before the rest collapse into one "+N" chip.
export const MAX_GROUPS = 2;
export const MAX_COMPANIES = 3;

// Rows created by the system can't be deleted.
export const SYSTEM_OWNER = "SYSTEM";
export const canDeleteDomain = (row) => row.createdBy !== SYSTEM_OWNER;

// Placeholder rows for the design preview; the real list comes with the API.
// Groups / Companies hold the codes of the owner's tenants of that type.
const row = (ownerCode, name, email, groups, companies, createdBy) => ({
  id: ownerCode,
  ownerCode,
  name,
  email,
  groups,
  companies,
  createdBy,
});

export const MOCK_DOMAINS = [
  row("5899", "GU LAI XIONG", "happylele6688@gmail.com", [], ["58"], "K"),
  row("BT", "BOTAK", "terryjaixun@yahoo.com", [], ["72"], "K"),
  row("DEMO", "MODE", "modeid@gmail.com", ["MG", "MX"], ["M1", "M2"], "K"),
  row("JX17", "JX", "dasmond089@gmail.com", [], ["X17"], "K"),
  row("K", "BOSS", "nakazz999@gmail.com", ["AP", "IG", "G3", "G4"], ["95", "AG", "C168", "AB1", "AB2", "AB3"], SYSTEM_OWNER),
  row("K23", "GODZILLA", "zoeypipu88@gmail.com", [], ["23"], "K"),
  row("MA", "UNIPAY HAO", "ug123@gmail.com", [], ["UG"], "K"),
  row("MAC", "MUAR MACHI", "machi1@gmail.com", [], ["MAC999"], "JACKSEE"),
  row("MHMG", "HE QI", "myself4253@gmail.com", [], ["SABAH"], "K"),
  row("SUPER66", "QI YE", "qygan@gmail.com", [], ["G66"], "K"),
  row("TEST001", "IT01 KUNZZIT", "kunzzit01111@gmail.com", ["LOL", "G1", "G2"], ["1039", "BK1"], "JK"),
  row("WCC", "WCC", "wcc123@gmail.com", [], ["WCC"], "K"),
  row("WS", "WEI SONG", "weisong_tan@hotmail.com", [], ["WSMT"], "K"),
  row("WUMING001", "WUMING", "msi977gaming@gmail.com", [], ["977"], "JK"),
  row("ZX", "PAGOH XIAN", "xian1@gmail.com", [], ["TZX"], "JACKSEE"),
];

// ===== Search / sort =====
export function filterDomains(rows, { search }) {
  return rows.filter((r) => matchesSearch([r.ownerCode, r.name, r.email, ...r.groups, ...r.companies], search));
}

const COMPARE = {
  ownerCode: compareText("ownerCode"),
  name: compareText("name"),
  email: compareText("email"),
  createdBy: compareText("createdBy"),
};

// Ties (and the default order) fall back to the owner code.
export function sortDomains(rows, key, dir) {
  return sortRows(rows, COMPARE[key] ?? COMPARE.ownerCode, COMPARE.ownerCode, dir);
}
