import i18n from "@/i18n";
// Rules of the Ownership page (no React here): the Group / Company directory, the rows of a company's ownership list,
// the checks before a save and the request body. The wire format is Spring's TenantOwnershipDTO (snake_case).
//
// An ownership row (what the editor works on): { id, accountId, label, role, pct, readOnly, linked, external, ownershipId }
//   - accountId is the backend's key: "O_12" an Owner, "U_3" a user, "G_5" a Group's equity
//   - readOnly: a partnership user's Read Only is the login's own switch, the same one the Admin page shows; a change saved
//     here changes that login everywhere
//   - pct is text ("30", "33.5"), so a half typed "12." survives; Number(pct) is the share
//   - linked = a partner linked through Link Partner. It is a shareholder row like any other (it can be given a share, and the
//     Read only switch stays on it); `external` is always false, so the back end does not hold it at 0%

// ---- Groups and companies ----

/** Companies that belong to no Group have this key in the Group switch. */
export const NO_GROUP = "__none__";

/** One row of /auth/tenant-accessible -> { tenantId, code, type: "GROUP" | "COMPANY", parentCode, expiration }. */
export function normalizeTenant(row) {
  const code = String(row?.tenant_code ?? "").trim();
  const tenantId = Number(row?.tenant_id);
  if (!code || !Number.isFinite(tenantId) || tenantId <= 0) return null;
  return {
    tenantId,
    code,
    type: String(row.tenant_type ?? "").toUpperCase() === "GROUP" ? "GROUP" : "COMPANY",
    parentCode: String(row.parent_tenant_code ?? "").trim() || null,
    expiration: row.expiration_date ?? null,
  };
}

const byCode = (a, b) => a.code.localeCompare(b.code, undefined, { numeric: true });

/**
 * The Groups (each with the tenantId of its own ledger when this login can open it) and the companies, from the tenants
 * this login can reach. A company can point at a Group whose own ledger is not reachable: that Group is still listed (it
 * can be joined and shown), just without a tenantId.
 */
export function buildDirectory(tenants) {
  const groups = new Map();
  const companies = [];
  for (const t of tenants) {
    if (t.type === "GROUP") groups.set(t.code, { code: t.code, tenantId: t.tenantId, expiration: t.expiration });
    else companies.push({ ...t, group: t.parentCode });
  }
  for (const c of companies) if (c.group && !groups.has(c.group)) groups.set(c.group, { code: c.group, tenantId: null, expiration: null });
  return { groups: [...groups.values()].sort(byCode), companies: companies.sort(byCode) };
}

export const companiesOfGroup = (directory, group) => directory.companies.filter((c) => (group === NO_GROUP ? !c.group : c.group === group));

// ---- Dates ----

/** "2027-09-08 00:00:00" -> { text: "08-09-2027", tone: "expired" | "soon" | "ok" } (soon = within 30 days); null when empty. */
export function expiryInfo(value, today = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
  if (!m) return null;
  const end = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const days = Math.floor((end - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  return { text: `${m[3]}-${m[2]}-${m[1]}`, tone: days < 0 ? "expired" : days <= 30 ? "soon" : "ok" };
}

// ---- Months ("YYYY-MM") ----

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const monthKey = (year, monthIndex) => `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

export const currentMonth = () => {
  const now = new Date();
  return monthKey(now.getFullYear(), now.getMonth());
};

export const monthLabel = (key) => {
  const [y, m] = key.split("-");
  const months = i18n.t("calendar.months", { returnObjects: true });
  return i18n.t("ownership:month", { year: y, month: months[Number(m) - 1] ?? MONTHS[Number(m) - 1] });
};

// ---- Ownership rows ----

export const formatPct = (n) => `${n.toFixed(2)}%`;

export const totalAllocation = (rows) => rows.reduce((sum, r) => sum + (Number(r.pct) || 0), 0);

let seq = 0;
export const newRowId = () => `new-${(seq += 1)}`;

/** "ownerCode (Name)" for an Owner, "Group: AP" for a Group, the login id for a user. */
function labelOf(o) {
  const role = String(o.role ?? "").toUpperCase();
  const accountName = o.account_name || "";
  const name = o.name || "";
  if (role === "GROUP" && accountName) return accountName;
  if (role === "OWNER" && accountName && name && accountName !== name) return `${accountName} (${name})`;
  return accountName || name || String(o.account_id ?? "");
}

/** A row of /api/ownership/list. */
export function normalizeOwner(o, index = 0) {
  const ownershipId = o.ownership_id ?? null;
  return {
    id: ownershipId ? `own-${ownershipId}` : `api-${o.account_id}-${index}`,
    accountId: String(o.account_id ?? ""),
    label: labelOf(o),
    role: String(o.role ?? "").toUpperCase(),
    pct: String(Number(o.percentage) || 0),
    readOnly: o.read_only == null ? 1 : Number(o.read_only),
    linked: Number(o.is_external_partner) === 1 || o.is_external_partner === true,
    external: false,
    ownershipId,
  };
}

/**
 * A row of /api/ownership/available-accounts -> a choice of the Account select. readOnly is the partnership user's Read Only
 * as it is now (the login's own flag, shared with the Admin page), so a user added as a shareholder keeps it; null for the rest.
 */
export function normalizeCandidate(a) {
  return { accountId: String(a.account_id ?? ""), label: labelOf(a), role: String(a.role ?? "").toUpperCase(), readOnly: a.read_only == null ? null : Number(a.read_only) };
}

/**
 * Link Partner's reason in words that name the id the user typed. The back end answers in English; the cases it can say
 * (not found, already the main owner, itself, already linked) are rewritten in the current language, anything else is shown as it is.
 */
export function linkErrorText(message, id) {
  const text = String(message ?? "");
  if (/not found/i.test(text)) return i18n.t("ownership:errors.linkNotFound", { id });
  if (/already the main owner/i.test(text)) return i18n.t("ownership:errors.linkMainOwner", { id });
  if (/link a tenant to itself/i.test(text)) return i18n.t("ownership:errors.linkSelf");
  if (/already linked/i.test(text)) return i18n.t("ownership:errors.linkDuplicate", { id });
  return text;
}

/** Only the Owner and an Admin may switch a Read Only on or off (the backend checks it again). */
export const canSetReadOnly = (role) => role === "owner" || role === "admin";

/**
 * The choices of one row's Account select: the candidates, plus the accounts the saved rows already hold (so a linked
 * partner or a row of another month still shows its name), minus what the other rows use and the external partners.
 */
export function accountChoices(candidates, rows, ownRowId) {
  const used = new Set(rows.filter((r) => r.id !== ownRowId).map((r) => r.accountId));
  const seen = new Map();
  for (const c of candidates) seen.set(c.accountId, c);
  for (const r of rows) if (!r.external && !seen.has(r.accountId)) seen.set(r.accountId, { accountId: r.accountId, label: r.label, role: r.role });
  return [...seen.values()].filter((c) => c.accountId && !used.has(c.accountId));
}

/**
 * The choices for a past month: the back end only offers the Owner, the partnership logins of the company and its Group, so
 * what the live list already holds (an Admin, a partner added later...) is added, and the choices of the current month too,
 * so filling in a past month offers the same people as the current one. `candidates` come first; nobody appears twice.
 */
export function withLiveChoices(candidates, liveRows, liveCandidates) {
  const extra = [
    ...liveCandidates,
    ...liveRows.filter((r) => !r.external).map((r) => ({ accountId: r.accountId, label: r.label, role: r.role, readOnly: r.readOnly })),
  ];
  const seen = new Set(candidates.map((c) => c.accountId));
  const added = extra.filter((c) => c.accountId && !seen.has(c.accountId) && seen.add(c.accountId));
  return [...candidates, ...added];
}

/** The most one row can take: what the other rows leave of 100%. */
export const maxPct = (rows, id) => Math.max(0, 100 - rows.reduce((sum, r) => (r.id === id ? sum : sum + (Number(r.pct) || 0)), 0));

/** What stops a Save, or "" when it can go. */
export function checkRows(rows) {
  if (rows.some((r) => !r.accountId)) return i18n.t("ownership:validation.selectAccount");
  const ids = rows.map((r) => r.accountId);
  if (new Set(ids).size !== ids.length) return i18n.t("ownership:validation.duplicate");
  if (totalAllocation(rows) > 100.0000001) return i18n.t("ownership:validation.over100");
  return "";
}

/** The body of /api/ownership/batch-save-ownership. The backend replaces the whole list, so every row goes, partners too. */
export function toPayload(tenantId, rows, month) {
  return {
    tenant_id: tenantId,
    owners: rows.map((r, sort_order) => ({
      account_id: r.accountId,
      percentage: Number(r.pct) || 0,
      read_only: r.readOnly,
      is_external_partner: r.external,
      sort_order,
    })),
    ...(month ? { month } : {}),
  };
}

/**
 * After Link Partner the list is read again: the shareholder rows as they are on screen (edited or not yet saved) stay, and
 * the partners come from the server, last.
 */
export function mergeServerRows(local, server) {
  const have = new Set(local.filter((r) => !r.external).map((r) => r.accountId));
  return [...local.filter((r) => !r.external), ...server.filter((r) => !r.external && !have.has(r.accountId)), ...server.filter((r) => r.external)];
}
