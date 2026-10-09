import { BarChart2, CheckCircle2, CreditCard, FileText, Home, Shield, User, Users, Wrench } from "lucide-react";
import { ROLE_LEVEL, roleLabel } from "./userListRules";

// Page permissions a user can be granted. `key` is the backend permission code (lower case), icons
// match the sidebar menu.
export const PERMISSIONS = [
  { key: "home", label: "Home", icon: Home },
  { key: "admin", label: "Admin", icon: Shield },
  { key: "account", label: "Account", icon: User },
  { key: "ownership", label: "Ownership", icon: Users },
  { key: "process", label: "Process", icon: CheckCircle2 },
  { key: "datacapture", label: "Data Capture", icon: BarChart2 },
  { key: "payment", label: "Transaction Payment", icon: CreditCard },
  { key: "report", label: "Report", icon: FileText },
  { key: "maintenance", label: "Maintenance", icon: Wrench },
];

const ALL_PERMISSIONS = PERMISSIONS.map((p) => p.key);

// What each role gets when nothing is customised. Mirrors user_role_permission in schema.sql; replace
// with a backend endpoint if these ever need to stay in sync automatically.
export const ROLE_DEFAULT_PERMISSIONS = {
  partnership: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  manager: ["admin", "account", "process", "datacapture", "payment", "report", "maintenance"],
  supervisor: ["admin", "account", "process", "datacapture", "payment", "report"],
  accountant: ["account", "process", "payment", "report"],
  audit: ["payment", "report", "maintenance"],
  customer_service: ["account", "process", "datacapture", "payment", "report"],
};

// Roles that can be assigned from Add / Edit User. Owner and Company are never assigned here; which of the
// rest a given account is offered depends on its own level (roleOptionsFor): only Owner gets Partnership.
export const ROLE_OPTIONS = Object.keys(ROLE_LEVEL)
  .filter((role) => !["owner", "company"].includes(role))
  .map((role) => ({ value: role, label: roleLabel(role).replace(/\b\w/g, (c) => c.toUpperCase()) }));

// The backend only lets you manage roles below your own level.
export const roleOptionsFor = (viewerRole) =>
  ROLE_OPTIONS.filter((o) => (ROLE_LEVEL[o.value] ?? 999) > (ROLE_LEVEL[viewerRole] ?? 999));
