import { compareText, matchesSearch, sortRows } from "@/components/shared/list/listFormat";
import { formatDisplayDate } from "@/lib/date";

// Most names a row shows before the rest collapse into one "+N" chip.
export const MAX_GROUPS = 2;
export const MAX_COMPANIES = 3;

// Periods the Price dialog sets an amount for (and the Set dialog picks from), in display order.
// `days` is how far a start date runs on to the expiry date (same lengths as the Auto Renew periods);
// `api` is the period code the back end uses.
export const PRICE_PERIODS = [
  { key: "days7", api: "7days", label: "7 Days", days: 7 },
  { key: "month1", api: "1month", label: "1 Month", days: 30 },
  { key: "months3", api: "3months", label: "3 Months", days: 91 },
  { key: "months6", api: "6months", label: "6 Months", days: 182 },
  { key: "year1", api: "1year", label: "1 Year", days: 365 },
];

// "No Expiry" is not a price period: the back end stores the date 9999-12-31 for it (Owner / Partnership / Admin only).
export const NO_EXPIRY = "noExpiry";
export const PERMANENT_EXPIRY = "9999-12-31";
const PRIVILEGED_ROLES = ["owner", "partnership", "admin"];
export const canSetPermanent = (viewer) => PRIVILEGED_ROLES.includes(viewer?.role);
// Edit Domain only shows the Secondary Password box to these roles (the back end itself does not check the role).
export const canChangeSecondaryPassword = (viewer) => PRIVILEGED_ROLES.includes(viewer?.role);

/** The date part ("2027-09-08") of what the back end sends for a date: a string or [y, m, d]; "" when there is none. */
export function isoOf(value) {
  if (!value) return "";
  if (Array.isArray(value)) {
    const [y, m, d] = value;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return /^(\d{4}-\d{2}-\d{2})/.exec(String(value))?.[1] ?? "";
}

/** "08-09-2027", or "No Expiry" for the permanent date; "" when there is none. */
export const formatExpiry = (iso) => (iso === PERMANENT_EXPIRY ? "No Expiry" : formatDisplayDate(iso, "-"));

// ===== Prices (Price dialog <-> /api/domain/list-fee, /add-fee) =====
const priceSection = (source) => Object.fromEntries(PRICE_PERIODS.map((p) => [p.key, source?.[p.api] == null ? "0" : String(source[p.api])]));
const priceBody = (values) => Object.fromEntries(PRICE_PERIODS.map((p) => [p.api, Number(values?.[p.key]) || 0]));

export const EMPTY_PRICES = { company: priceSection(null), group: priceSection(null) };

/** { company, group } amounts per period (strings, as the dialog edits them) from the back end's fee settings. */
export const toPrices = (data) => ({ company: priceSection(data?.company_period_prices), group: priceSection(data?.group_period_prices) });

export const toPriceBody = (prices) => ({ company_period_prices: priceBody(prices.company), group_period_prices: priceBody(prices.group) });

// Rows created by the system can't be deleted (a front end rule only).
export const SYSTEM_OWNER = "SYSTEM";
export const canDeleteDomain = (row) => row.createdBy !== SYSTEM_OWNER;

/**
 * The back end lists one row per owner x tenant ({ owner, tenant }, tenant null for an owner without any); this folds them
 * into one row per owner. `groups` / `companies` are the codes the table shows; `groupItems` / `companyItems` keep each
 * tenant's id, parent, expiry, share rows and modules for the Edit modal.
 */
export function toDomains(flatRows) {
  const byOwner = new Map();
  for (const { owner, tenant } of flatRows ?? []) {
    if (!owner) continue;
    let domain = byOwner.get(owner.id);
    if (!domain) {
      domain = {
        id: owner.id,
        ownerCode: owner.ownerCode ?? "",
        name: owner.name ?? "",
        email: owner.email ?? "",
        createdBy: owner.createdBy ?? "",
        groupItems: [],
        companyItems: [],
      };
      byOwner.set(owner.id, domain);
    }
    if (!tenant?.id) continue;
    const item = {
      id: tenant.id,
      code: tenant.code ?? "",
      parentId: tenant.parentId ?? null,
      expiry: isoOf(tenant.expirationDate),
      shares: tenant.feeShareAllocations ?? [],
      modules: tenant.featureModules ?? [],
    };
    (tenant.tenantType === "GROUP" ? domain.groupItems : domain.companyItems).push(item);
  }
  return [...byOwner.values()].map((d) => ({ ...d, groups: d.groupItems.map((g) => g.code), companies: d.companyItems.map((c) => c.code) }));
}

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
