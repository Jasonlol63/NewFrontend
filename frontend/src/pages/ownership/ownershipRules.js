// Placeholder data and small rules for the Ownership page (design preview only, no API yet).

export const GROUPS = ["AP", "IG"];

export const MOCK_COMPANIES = [
  { id: "c168", code: "C168", group: "AP", date: "08-09-2027", accounts: [{ id: "a1", account: "group:AP", pct: 100 }] },
  { id: "95", code: "95", group: "IG", date: "01-01-2027", accounts: [{ id: "a1", account: "group:IG", pct: 30 }] },
  {
    id: "ag",
    code: "AG",
    group: "IG",
    date: "01-01-2027",
    accounts: [
      { id: "a1", account: "group:IG", pct: 60 },
      { id: "a2", account: "group:AP", pct: 40 },
    ],
  },
  { id: "cx", code: "CX", group: "IG", date: "20-03-2027", accounts: [{ id: "a1", account: "group:AP", pct: 100 }] },
  { id: "rs", code: "RS", group: "IG", date: "01-01-2027", accounts: [{ id: "a1", account: "group:IG", pct: 30 }] },
  { id: "vg", code: "VG", group: "IG", date: "08-03-2027", accounts: [] },
];

export const ACCOUNT_OPTIONS = [
  { value: "group:AP", label: "Group: AP" },
  { value: "group:IG", label: "Group: IG" },
  { value: "acc:JK", label: "Account: JK" },
  { value: "acc:BOSS", label: "Account: BOSS" },
];

export const totalAllocation = (accounts) => accounts.reduce((sum, a) => sum + (Number(a.pct) || 0), 0);

export const clampPct = (n) => Math.min(100, Math.max(0, Math.round(Number(n) || 0)));

export const formatPct = (n) => `${n.toFixed(2)}%`;

export const groupCount = (companies, group) => companies.filter((c) => c.group === group).length;

// ---- Months ("YYYY-MM") ----

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const monthKey = (year, monthIndex) => `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

export const currentMonth = () => {
  const now = new Date();
  return monthKey(now.getFullYear(), now.getMonth());
};

export const monthLabel = (key) => {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
};

// Placeholder: the four months before the current one count as "has saved changes".
export const savedMonths = (current) => {
  const [y, m] = current.split("-").map(Number);
  return new Set([1, 2, 3, 4].map((back) => monthKey(m - 1 - back < 0 ? y - 1 : y, (m - 1 - back + 12) % 12)));
};
