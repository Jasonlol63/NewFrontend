import { addDays } from "./date";

// Shared by the calendar popups (Dashboard date range, single-date fields). Weeks start on Sunday.
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Every day shown for a month: whole weeks, starting with the Sunday on or before the 1st.
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
  const start = addDays(first, -first.getDay());
  return Array.from({ length: cells }, (_, i) => addDays(start, i));
}
