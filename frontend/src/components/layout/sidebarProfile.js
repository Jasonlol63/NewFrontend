// Display names for user_role.code (see schema.sql); member accounts and unknown roles fall back
// to a title-cased code.
const ROLE_NAMES = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  supervisor: "Supervisor",
  accountant: "Accountant",
  audit: "Audit",
  customer_service: "Customer Service",
  partnership: "Partnership",
  it: "IT",
};

export function formatRole(role) {
  const code = String(role ?? "").trim().toLowerCase();
  if (!code) return "";
  return ROLE_NAMES[code] ?? code.split(/[\s_]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const PERMANENT_YEAR = 9999;

// "2026-12-31" -> "Exp: 2m 22d left". Permanent (9999-12-31) or missing -> "No expiry".
export function formatExpiry(expirationDate, today = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(expirationDate ?? ""));
  if (!m) return "No expiry";
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (year >= PERMANENT_YEAR) return "No expiry";

  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(year, month - 1, day);
  if (end < start) return "Expired";

  // Whole months first, then the remaining days.
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  let anchor = new Date(start.getFullYear(), start.getMonth() + months, start.getDate());
  if (anchor > end) {
    months -= 1;
    anchor = new Date(start.getFullYear(), start.getMonth() + months, start.getDate());
  }
  const days = Math.round((end - anchor) / 86400000);
  if (months <= 0 && days === 0) return "Expires today";
  return `Exp: ${[months > 0 && `${months}m`, days > 0 && `${days}d`].filter(Boolean).join(" ")} left`;
}
