import i18n from "@/i18n";
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

/** { key, values, error }: the sentence under the fields. `key` names the text in the `process:bank.resend` set (its <b> parts are the dates). */
export function resendSummary({ frequency, dayStart, dayEnd }) {
  if (!dayStart) return { key: "pickDayStart", values: {}, error: false };
  if (resendUsesDayEnd(frequency) && dayEnd && dayEnd < dayStart) return { key: "endBefore", values: {}, error: true };
  if (frequency === FIRST_OF_MONTH) {
    return dayEnd ? { key: "everyMonth", values: { start: dayStart, end: dayEnd }, error: false } : { key: "onlyMonth", values: { start: dayStart }, error: false };
  }
  if (frequency === "MONTHLY") return { key: "oneMonth", values: { start: dayStart, end: addOneMonth(dayStart) }, error: false };
  if (frequency === "WEEK") return { key: "oneWeek", values: { start: dayStart, end: toIsoDate(addDays(parseIsoDate(dayStart), 6)) }, error: false };
  return { key: "oneDay", values: { start: dayStart }, error: false };
}

/** The first problem with the form (a message), or "". */
export function validateResend({ frequency, dayStart, dayEnd }) {
  if (!frequency) return i18n.t("process:bank.validation.resendFrequency");
  if (!dayStart) return i18n.t("process:bank.validation.resendDayStart");
  if (resendUsesDayEnd(frequency) && dayEnd && dayEnd < dayStart) return i18n.t("process:bank.validation.dayEndBefore");
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
