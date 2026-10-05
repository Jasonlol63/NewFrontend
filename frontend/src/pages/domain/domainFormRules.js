// Rules and placeholder data of the Add / Edit Domain modal. Nothing here talks to the API yet.

// Radix Select can't use "" as an item value, so "no group" travels as this word.
export const NO_GROUP = "none";
export const SECONDARY_PASSWORD_LENGTH = 6;

export const normalizeCode = (value) => value.trim().toUpperCase();

// Expiry dates of the placeholder rows (dd-mm-yyyy); the real ones come from the API.
const PLACEHOLDER_DATES = ["08-09-2027", "01-01-2027", "20-03-2027", "08-03-2027"];

/**
 * The starting values of the modal. Add: everything empty. Edit: the owner's own fields plus
 * placeholder groups / companies built from the list row (the first two companies sit in the first group).
 * A company's group is "" when it is in no group.
 */
export function buildDraft(domain) {
  const owner = {
    ownerCode: domain?.ownerCode ?? "",
    name: domain?.name ?? "",
    email: domain?.email ?? "",
    password: "",
    secondaryPassword: "",
  };
  if (!domain) return { owner, groups: [], companies: [] };
  const groups = domain.groups.map((code) => ({ code, date: PLACEHOLDER_DATES[0] }));
  const companies = domain.companies.map((code, i) => ({
    code,
    group: i < 2 && groups[0] ? groups[0].code : "",
    date: PLACEHOLDER_DATES[(i + 1) % PLACEHOLDER_DATES.length],
  }));
  return { owner, groups, companies };
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

// Add needs every field and a 6 digit secondary password; Edit only the owner's name fields (password stays as is when empty).
export function canSave(isEdit, owner) {
  const base = owner.ownerCode.trim() && owner.name.trim() && owner.email.trim();
  return Boolean(isEdit ? base : base && owner.password && isSecondaryPasswordValid(owner.secondaryPassword));
}
