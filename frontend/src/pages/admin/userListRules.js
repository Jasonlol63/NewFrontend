// Pure rules for the Admin user list, carried over from the old Count-Frontend
// userListLogic.js (row capabilities, partnership visibility, sorting).

import { compareDate, compareText, matchesSearch, matchesStatusChips, sortRows } from "@/components/shared/list/listFormat";

export const ROLE_LEVEL = {
  owner: 0,
  partnership: 1,
  admin: 2,
  manager: 3,
  supervisor: 4,
  accountant: 5,
  audit: 6,
  customer_service: 7,
  company: 8,
};

// Badge colours 1:1 from the old userlist.css.
export const ROLE_BADGE = {
  owner: "bg-[#f2dfd2] text-[#5f2e0f] border-[#dbb99a]",
  partnership: "bg-[#d0cbfc] text-[#120b9d] border-[#b8b3ff]",
  admin: "bg-[#ffe0e0] text-[#a30b0b] border-[#ffa8a8]",
  manager: "bg-[#ffe5cc] text-[#a24700] border-[#ffc58c]",
  supervisor: "bg-[#dff4e7] text-[#0f6d38] border-[#bbe9cf]",
  accountant: "bg-[#dfe3ff] text-[#14228a] border-[#bfc7ff]",
  audit: "bg-[#f0e1ff] text-[#4f148f] border-[#ddbdfd]",
  customer_service: "bg-[#eceef2] text-[#3e434f] border-[#d6d9e1]",
};

// Roles that may never manage an Admin / Owner row, whatever the hierarchy says.
const LOW_PRIVILEGE = ["manager", "supervisor", "accountant", "audit", "customer_service"];

export function normRole(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "_");
}

export function roleLabel(value) {
  return normRole(value).replace(/_/g, " ");
}

// Spring list row ({ admin, adminTenantAccess, isOwnerShadow }) -> flat row.
export function normalizeUserRow(item) {
  const admin = item?.admin ?? {};
  const role = normRole(admin.role);
  return {
    id: admin.id,
    loginId: admin.loginId ?? "",
    name: admin.name ?? "",
    email: admin.email ?? "",
    role,
    status: normRole(admin.status),
    createdBy: admin.createdBy ?? "",
    lastLogin: admin.lastLogin ?? null,
    lastLogout: admin.lastLogout ?? null,
    // The tenant owner is listed first as a "shadow" row with no tenant access record.
    isOwnerShadow: item?.isOwnerShadow === true || (role === "owner" && !item?.adminTenantAccess),
  };
}

// viewer: { id, role, isOwner } from /auth/current-user. Owner ids come from the owner table and
// staff ids from the user table, so "self" is only matched against rows of the same kind.
export function rowCapabilities(row, viewer) {
  const viewerRole = viewer?.role ?? "";
  const isSelf = Boolean(viewer) && viewer.isOwner === row.isOwnerShadow && Number(row.id) === Number(viewer.id);
  const viewerLevel = ROLE_LEVEL[viewerRole] ?? 999;
  const targetLevel = ROLE_LEVEL[row.role] ?? 999;
  const isSameLevel = viewerLevel === targetLevel && !isSelf;
  const isHigherLevel = targetLevel < viewerLevel;

  let canEdit = true;
  let canDelete = true;
  if (isSelf) {
    canDelete = false;
  } else if (row.isOwnerShadow) {
    canEdit = viewerRole === "owner";
    canDelete = canEdit;
  } else if (LOW_PRIVILEGE.includes(viewerRole) && (row.role === "admin" || row.role === "owner")) {
    canEdit = canDelete = false;
  } else if (isSameLevel || isHigherLevel) {
    // The backend rejects edits on same-level or higher targets, so lock them here too.
    canEdit = canDelete = false;
  }

  let canToggleStatus = canEdit && !isSelf;
  if (!row.isOwnerShadow && (isSameLevel || isHigherLevel)) canToggleStatus = false;

  // Read-only logins can look but not change anything.
  if (viewer?.readOnly) return { canEdit: false, canToggleStatus: false, canDelete: false, isSelf };

  // Only inactive users can be deleted.
  return { canEdit, canToggleStatus, canDelete: canDelete && row.status === "inactive", isSelf };
}

// Partnership rows are only visible to the owner (and to that partner themselves).
export function filterUsers(rows, { search, viewer, ...chips }) {
  return rows.filter(
    (u) =>
      (!viewer || viewer.role === "owner" || u.role !== "partnership" || (!viewer.isOwner && Number(u.id) === Number(viewer.id))) &&
      matchesSearch([u.loginId, u.name, u.email], search) &&
      matchesStatusChips(u.status, chips)
  );
}

const COMPARE = {
  loginId: compareText("loginId"),
  name: compareText("name"),
  email: compareText("email"),
  role: (a, b) => (ROLE_LEVEL[a.role] ?? 999) - (ROLE_LEVEL[b.role] ?? 999),
  status: compareText("status"),
  lastLogin: compareDate("lastLogin"),
  lastLogout: compareDate("lastLogout"),
  createdBy: compareText("createdBy"),
};

// The owner row always stays on top; ties fall back to Login ID.
export function sortUsers(rows, key, dir) {
  return sortRows(rows, COMPARE[key] ?? COMPARE.loginId, COMPARE.loginId, dir, (u) => u.isOwnerShadow);
}
