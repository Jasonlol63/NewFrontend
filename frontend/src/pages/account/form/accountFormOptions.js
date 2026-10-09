import { addDays, parseIsoDate } from "@/lib/date";
import { ROLE_PRIORITY } from "../accountRules";

// Options and Payment Alert helpers of the Add / Edit Account modal.

export const ROLE_OPTIONS = ROLE_PRIORITY.map((role) => ({ value: role, label: role }));

/**
 * Alert Type quick picks. The value is what the backend stores in alert_day:
 * a day count ("1".."31", counted in plain days from the start date) or "monthly"
 * (same date every month). Weekly is just 7 days.
 */
export const ALERT_PICKS = [
  { value: 7, label: "Weekly" },
  { value: 15, label: "15 Days" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
];
export const PRESET_DAYS = [7, 15];

export function alertLabel(type, startIso) {
  if (type === "monthly") return `Monthly, on the ${ordinal(parseIsoDate(startIso).getDate())}`;
  if (type === 1) return "Every day";
  if (type === 7) return "Every week";
  if (type % 7 === 0) return `Every ${type / 7} weeks`;
  return `Every ${type} days`;
}

/**
 * The next reminder dates from the start date. N days: plain day count (30 days after 31 Jan is 02 Mar).
 * Monthly: the start date's day each month; a shorter month uses its last day (`adjusted`).
 */
export function nextReminders(type, startIso, count = 5) {
  const start = parseIsoDate(startIso);
  return Array.from({ length: count }, (_, i) => {
    if (type !== "monthly") return { date: addDays(start, type * i), adjusted: false };
    const lastDay = new Date(start.getFullYear(), start.getMonth() + i + 1, 0).getDate();
    const day = Math.min(start.getDate(), lastDay);
    return { date: new Date(start.getFullYear(), start.getMonth() + i, day), adjusted: day !== start.getDate() };
  });
}

export const shortDate = (date) => date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

function ordinal(n) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return n + ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th");
}

// The alert amount is a negative threshold: "5000" / "-5,000" both become -5000 (empty stays empty).
export function normalizeAlertAmount(text) {
  const n = Number(String(text).replace(/[,\s]/g, ""));
  if (!String(text).trim() || Number.isNaN(n)) return "";
  return (-Math.abs(n)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
