// Rules of the Add / Edit Domain modal.
import { formatExpiry } from "./domainRules";

// Radix Select can't use "" as an item value, so "no group" travels as this word.
export const NO_GROUP = "none";
export const SECONDARY_PASSWORD_LENGTH = 6;

export const normalizeCode = (value) => value.trim().toUpperCase();

/**
 * The starting values of the modal. Add: everything empty. Edit: the owner's own fields plus the owner's groups and
 * companies as the list holds them. `saved` is the tenant as it was loaded (its share rows and modules start the Set dialog);
 * a company's group is "" when it is in no group; `date` is the expiry as the row shows it.
 */
export function buildDraft(domain) {
  const owner = {
    ownerCode: domain?.ownerCode ?? "",
    name: (domain?.name ?? "").toUpperCase(),
    email: domain?.email ?? "",
    password: "",
    secondaryPassword: "",
  };
  if (!domain) return { owner, groups: [], companies: [] };
  const groups = domain.groupItems.map((g) => ({ code: g.code, date: formatExpiry(g.expiry), saved: g }));
  const groupCodeById = new Map(domain.groupItems.map((g) => [g.id, g.code]));
  const companies = domain.companyItems.map((c) => ({
    code: c.code,
    group: groupCodeById.get(c.parentId) ?? "",
    date: formatExpiry(c.expiry),
    saved: c,
  }));
  return { owner, groups, companies };
}

/**
 * The body of POST /api/domain/add or PUT /api/domain/update. Owner fields are snake_case, the tenants camelCase.
 * Edit sends the password and the Secondary Password only when one was typed (the back end keeps the old ones otherwise, and the
 * Owner Code never changes). The name is always upper case.
 * A company's group travels as the group's code (parentGroupCode); "" takes it out of its group.
 */
export function domainBody(isEdit, id, { owner, groups, companies }) {
  const body = {
    owner_code: normalizeCode(owner.ownerCode),
    name: owner.name.trim().toUpperCase(),
    email: owner.email.trim(),
    groups: groups.map((g) => ({ code: g.code })),
    companies: companies.map((c) => ({ code: c.code, parentGroupCode: c.group || "" })),
  };
  if (isEdit) body.id = id;
  if (owner.password) body.password = owner.password;
  if (owner.secondaryPassword) body.secondary_password = owner.secondaryPassword;
  return body;
}

// What the modal was opened with, to tell later what is still unsaved.
export const snapshotOf = ({ groups, companies }) => ({
  groups: groups.map((g) => g.code),
  companies: Object.fromEntries(companies.map((c) => [c.code, c.group])),
});

// "new" (not in the snapshot), "moved" (a different group than at the start) or null.
export function companyChange(base, company) {
  if (!base) return null;
  if (!(company.code in base.companies)) return "new";
  return base.companies[company.code] === company.group ? null : "moved";
}

// Every difference to the snapshot: added / removed groups and companies, and companies that changed group.
export function countChanges(base, { groups, companies }) {
  if (!base) return 0;
  const groupCodes = groups.map((g) => g.code);
  const companyCodes = new Set(companies.map((c) => c.code));
  return (
    groupCodes.filter((code) => !base.groups.includes(code)).length +
    base.groups.filter((code) => !groupCodes.includes(code)).length +
    companies.filter((c) => companyChange(base, c)).length +
    Object.keys(base.companies).filter((code) => !companyCodes.has(code)).length
  );
}

export const isSecondaryPasswordValid = (value) => value.length === SECONDARY_PASSWORD_LENGTH;

// Add needs every field and a 6 digit secondary password; Edit only the owner's name fields (both passwords stay as they are when
// empty; a Secondary Password that is typed must still be 6 digits).
export function canSave(isEdit, owner) {
  const base = owner.ownerCode.trim() && owner.name.trim() && owner.email.trim();
  if (isEdit) return Boolean(base && (!owner.secondaryPassword || isSecondaryPasswordValid(owner.secondaryPassword)));
  return Boolean(base && owner.password && isSecondaryPasswordValid(owner.secondaryPassword));
}
