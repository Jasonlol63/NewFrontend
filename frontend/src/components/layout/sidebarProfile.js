// Display names for user_role.code (see schema.sql) come from the `sidebar:role.*` texts; member accounts and
// unknown roles fall back to a title-cased code. `t` is i18next's translate function.
export function formatRole(role, t) {
  const code = String(role ?? "").trim().toLowerCase();
  if (!code) return "";
  const fallback = code.split(/[\s_]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return t(`sidebar:role.${code}`, { defaultValue: fallback });
}

const PERMANENT_YEAR = 9999;

// "2026-12-31" -> "Exp: 2m 22d left" (or the Chinese form). Permanent (9999-12-31) or missing -> "No expiry".
export function formatExpiry(expirationDate, t, today = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(expirationDate ?? ""));
  if (!m) return t("sidebar:expiry.none");
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (year >= PERMANENT_YEAR) return t("sidebar:expiry.none");

  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(year, month - 1, day);
  if (end < start) return t("sidebar:expiry.expired");

  // Whole months first, then the remaining days.
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  let anchor = new Date(start.getFullYear(), start.getMonth() + months, start.getDate());
  if (anchor > end) {
    months -= 1;
    anchor = new Date(start.getFullYear(), start.getMonth() + months, start.getDate());
  }
  const days = Math.round((end - anchor) / 86400000);
  if (months <= 0 && days === 0) return t("sidebar:expiry.today");
  const time = [months > 0 && t("sidebar:expiry.months", { count: months }), days > 0 && t("sidebar:expiry.days", { count: days })]
    .filter(Boolean)
    .join(t("sidebar:expiry.separator"));
  return t("sidebar:expiry.left", { time });
}
