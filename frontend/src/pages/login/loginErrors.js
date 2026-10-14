import i18n from "@/i18n";
import { localizeBackend } from "@/i18n/backendMessages";

// Backend login error -> short dialog title (login:errorTitles.*). Anything unlisted (expired, maintenance, network, reset
// errors...) is shown as the backend sent it, in the page language when backendMessages.js knows it.
const TITLE_KEYS = {
  "Group/Company Not Found!": "companyNotFound",
  "Username or password is incorrect": "wrongCredentials",
  "Account ID, Company ID or password is incorrect": "wrongCredentials",
  "You do not have access to this Company or Group": "noAccess",
};

/** The title of a login-area error dialog, in the current language. */
export function loginErrorTitle(err) {
  const key = TITLE_KEYS[err?.message];
  return key ? i18n.t(`login:errorTitles.${key}`) : localizeBackend(err?.message);
}
