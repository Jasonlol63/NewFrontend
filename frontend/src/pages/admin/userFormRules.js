// Pure rules for the Add / Edit User form: validation and the request bodies of /api/userlist.

export const SECOND_PASSWORD_LENGTH = 6;

export const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

// Account / Process access as the backend reads it: null = everything (new items included),
// [] = nothing, a list = just those. `toItem` maps one item to the request shape.
export function accessPayload(items, selected, toItem) {
  if (items.every((it) => selected.has(it.id))) return null;
  return items.filter((it) => selected.has(it.id)).map(toItem);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The first problem with the form, or "" when it can be saved.
export function validateUserForm({ mode, form, perms, isOwnerRow }) {
  const isAdd = mode === "add";
  if (isAdd && !form.loginId.trim()) return "Login ID is required";
  if (!form.name.trim()) return "Name is required";
  if (!form.email.trim()) return "Email is required";
  if (!EMAIL.test(form.email.trim())) return "Email is not valid";
  if (isAdd && !form.password) return "Password is required";
  if (isOwnerRow) return "";
  if (!form.role) return "Role is required";
  // An empty permission list would be stored as a custom list with nothing in it, which the menu
  // reads as "no restriction": never send it.
  if (perms.size === 0) return "Select at least one permission";
  return "";
}

// Request body of /add (Add User) and /update (Edit User).
export function buildUserPayload({
  mode, userId, tenantId, form, showSecondPassword, readOnly, perms, accounts, processes, accountItems, processItems,
}) {
  const common = {
    scopeTenantId: tenantId,
    name: form.name.trim().toUpperCase(),
    email: form.email.trim(),
    role: form.role,
    readOnly,
    permissions: [...perms],
    accountPermissions: accessPayload(accountItems, accounts, (a) => ({ id: a.id, account_id: a.code })),
    processPermissions: accessPayload(processItems, processes, (p) => ({
      id: p.id,
      process_id: p.code,
      description: p.name,
    })),
    // Left blank in Edit User = keep the current one.
    ...(form.password ? { password: form.password } : {}),
    ...(showSecondPassword && form.secondaryPassword ? { secondaryPassword: form.secondaryPassword } : {}),
  };
  if (mode === "edit") return { ...common, id: userId };
  return { ...common, loginId: form.loginId.trim().toUpperCase(), homeTenantId: tenantId, tenantIds: [tenantId] };
}

// Request body of /update-owner-profile: the Owner row only has these fields.
export function buildOwnerPayload({ userId, form, showSecondPassword }) {
  return {
    id: userId,
    name: form.name.trim().toUpperCase(),
    email: form.email.trim(),
    ...(form.password ? { password: form.password } : {}),
    ...(showSecondPassword && form.secondaryPassword ? { secondaryPassword: form.secondaryPassword } : {}),
  };
}
