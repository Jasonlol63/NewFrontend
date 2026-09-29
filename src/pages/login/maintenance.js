// Pure helpers for the login-page maintenance notice.
// A notice looks like { title, content?, startTime?, endTime? }; times may be
// Date objects, timestamps, ISO strings or "yyyy-MM-dd HH:mm:ss".

const pad = (n) => String(n).padStart(2, "0");

export function parseTime(value) {
  if (value == null || value === "") return null;
  const date =
    value instanceof Date
      ? value
      : new Date(typeof value === "string" ? value.replace(" ", "T") : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const fmtDay = (d) => `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const sameDay = (a, b) => a.toDateString() === b.toDateString();

// "upcoming" | "ongoing" | "ended", or null when the notice has no usable period
export function getMaintenanceStatus(notice, now = new Date()) {
  const start = parseTime(notice?.startTime);
  const end = parseTime(notice?.endTime);
  if (!start || !end) return null;
  if (now >= end) return "ended";
  return now >= start ? "ongoing" : "upcoming";
}

// "23:00 – 01:00"; the start date is only prefixed when it is not today
export function formatShortRange(start, end, now = new Date()) {
  const day = sameDay(start, now) ? "" : `${fmtDay(start)} `;
  return `${day}${fmtTime(start)} – ${fmtTime(end)}`;
}

// "01:00"; the date is only prefixed when it is not today
export function formatTimeOrDay(d, now = new Date()) {
  return sameDay(d, now) ? fmtTime(d) : `${fmtDay(d)} ${fmtTime(d)}`;
}

// "09-30 23:00 – 10-01 01:00"; the end date is dropped when it is the same day
export function formatFullRange(start, end) {
  const endDay = sameDay(start, end) ? "" : `${fmtDay(end)} `;
  return `${fmtDay(start)} ${fmtTime(start)} – ${endDay}${fmtTime(end)}`;
}
