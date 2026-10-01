import { BarChart2, CheckCircle2, CreditCard, FileText, Home, Shield, User, Wrench } from "lucide-react";
import { ROLE_LEVEL, roleLabel } from "./userListRules";

// Page permissions a user can be granted. Icons match the sidebar menu.
export const PERMISSIONS = [
  { key: "home", label: "Home", icon: Home },
  { key: "admin", label: "Admin", icon: Shield },
  { key: "account", label: "Account", icon: User },
  { key: "process", label: "Process", icon: CheckCircle2 },
  { key: "data_capture", label: "Data Capture", icon: BarChart2 },
  { key: "transaction_payment", label: "Transaction Payment", icon: CreditCard },
  { key: "report", label: "Report", icon: FileText },
  { key: "maintenance", label: "Maintenance", icon: Wrench },
];

// Roles that can be created from Add User (Owner / Partnership / Company are not assignable here).
export const ROLE_OPTIONS = Object.keys(ROLE_LEVEL)
  .filter((role) => !["owner", "partnership", "company"].includes(role))
  .map((role) => ({ value: role, label: roleLabel(role).replace(/\b\w/g, (c) => c.toUpperCase()) }));
