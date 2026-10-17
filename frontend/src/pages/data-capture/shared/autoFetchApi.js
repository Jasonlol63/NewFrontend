// Data Capture > Auto Fetch (/api/datacapture/autofetch/report): reads the picked process's Payment Report off its
// report website instead of it being copied in by hand. The website wants a validation code only a person can read, so
// a fetch comes back either with the report or with that code's image; the typed code is sent back with the ticket and
// the website session is then kept on the server for the next fetch.
import { postJson } from "@/lib/api";
import { citibetReportToPasteText } from "./paste/vendors/dataCaptureCitibetReportText.js";

const URL = "/api/datacapture/autofetch/report";

export const AUTO_FETCH_REPORT = "REPORT";
export const AUTO_FETCH_CAPTCHA = "CAPTCHA";

/**
 * Asks for the report of { tenantId, processId, captureDate }. ticket + captcha answer a validation code.
 * Returns either
 *   { status: "REPORT", text, site, weekStart, weekEnd } - text is what a copy of the two tables gives, ready to paste;
 *   { status: "CAPTCHA", ticket, captchaImage, message, site, weekStart, weekEnd }.
 */
export async function fetchAutoReport({ tenantId, processId, captureDate, ticket, captcha }, { signal } = {}) {
  const body = await postJson(URL, { tenantId, processId, captureDate, ticket, captcha }, { signal });
  const data = body.data ?? {};
  const week = { site: data.site ?? "", weekStart: data.weekStart ?? "", weekEnd: data.weekEnd ?? "" };
  if (data.status === AUTO_FETCH_CAPTCHA) {
    return { status: AUTO_FETCH_CAPTCHA, ticket: data.ticket ?? "", captchaImage: data.captchaImage ?? "", message: data.message ?? "", ...week };
  }
  return { status: AUTO_FETCH_REPORT, text: citibetReportToPasteText(data.report), ...week };
}
