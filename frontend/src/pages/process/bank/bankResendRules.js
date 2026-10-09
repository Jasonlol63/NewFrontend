// Rules for the Resend dialog (POST /api/bank-process/resend): which window of dates the backend resends for each frequency.
import { addDays, parseIsoDate, toIsoDate } from "@/lib/date";
import { FIRST_OF_MONTH } from "./bankFormRules";

export const BANK_RESEND_URL = "/api/bank-process/resend";

// The backend refuses Resend in the other statuses (WAITING, INACTIVE).
const RESEND_STATUSES = ["ACTIVE", "OFFICIAL", "E_INVOICE", "BLOCK"];
export const canResend = (p) => RESEND_STATUSES.includes(p.status);

// Day End is only read for 1st of Every Month (without it that Resend covers just Day Start's own month); Monthly always runs one
// month from Day Start, Weekly seven days, Once and Daily one day.
export const resendUsesDayEnd = (frequency) => frequency === FIRST_OF_MONTH;

// Day Start plus one month, a day past the end of a short month ends on that month's last day (as the backend does).
function addOneMonth(iso) {
  const d = parseIsoDate(iso);
  const last = new Date(d.getFullYear(), d.getMonth() + 2, 0).getDate();
  return toIsoDate(new Date(d.getFullYear(), d.getMonth() + 1, Math.min(d.getDate(), last)));
}

/** { parts: [string | { b: string }], error: boolean }: the sentence under the fields (the { b } parts are bold). */
export function resendSummary({ frequency, dayStart, dayEnd }) {
  if (!dayStart) return { parts: ["Pick a Day Start to see what will be resent."], error: false };
  if (resendUsesDayEnd(frequency) && dayEnd && dayEnd < dayStart) return { parts: ["Day End can't be before Day Start."], error: true };
  const b = (text) => ({ b: text });
  if (frequency === FIRST_OF_MONTH) {
    return {
      parts: dayEnd
        ? ["Resends every month from ", b(dayStart), " to ", b(dayEnd), ", billed on the 1st."]
        : ["Resends only the month of ", b(dayStart), ", billed on the 1st."],
      error: false,
    };
  }
  if (frequency === "MONTHLY") return { parts: ["Resends one month: ", b(dayStart), " to ", b(addOneMonth(dayStart)), "."], error: false };
  if (frequency === "WEEK") return { parts: ["Resends one week: ", b(dayStart), " to ", b(toIsoDate(addDays(parseIsoDate(dayStart), 6))), "."], error: false };
  return { parts: ["Resends one day only: ", b(dayStart), "."], error: false };
}

/** The first problem with the form (a message), or "". */
export function validateResend({ frequency, dayStart, dayEnd }) {
  if (!frequency) return "Select a frequency";
  if (!dayStart) return "Select a Day Start";
  if (resendUsesDayEnd(frequency) && dayEnd && dayEnd < dayStart) return "Day End can't be before Day Start";
  return "";
}

export function buildResendRequest({ row, tenantId, form }) {
  return {
    tenantId,
    bankProcessId: row.id,
    dayStart: form.dayStart,
    dayEnd: resendUsesDayEnd(form.frequency) && form.dayEnd ? form.dayEnd : null,
    frequency: form.frequency,
  };
}
