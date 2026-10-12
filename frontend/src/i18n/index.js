import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enCommon from "./locales/en/common.json";
import enSidebar from "./locales/en/sidebar.json";
import enDashboard from "./locales/en/dashboard.json";
import enDomain from "./locales/en/domain.json";
import enAnnouncement from "./locales/en/announcement.json";
import enAdmin from "./locales/en/admin.json";
import enAccount from "./locales/en/account.json";
import enOwnership from "./locales/en/ownership.json";
import enProcess from "./locales/en/process.json";
import enCapture from "./locales/en/capture.json";
import enTransaction from "./locales/en/transaction.json";
import enReport from "./locales/en/report.json";
import enMaintenance from "./locales/en/maintenance.json";
import enAutoRenew from "./locales/en/autorenew.json";
import enMember from "./locales/en/member.json";
import enNotification from "./locales/en/notification.json";
import zhCommon from "./locales/zh/common.json";
import zhSidebar from "./locales/zh/sidebar.json";
import zhDashboard from "./locales/zh/dashboard.json";
import zhDomain from "./locales/zh/domain.json";
import zhAnnouncement from "./locales/zh/announcement.json";
import zhAdmin from "./locales/zh/admin.json";
import zhAccount from "./locales/zh/account.json";
import zhOwnership from "./locales/zh/ownership.json";
import zhProcess from "./locales/zh/process.json";
import zhCapture from "./locales/zh/capture.json";
import zhTransaction from "./locales/zh/transaction.json";
import zhReport from "./locales/zh/report.json";
import zhMaintenance from "./locales/zh/maintenance.json";
import zhAutoRenew from "./locales/zh/autorenew.json";
import zhMember from "./locales/zh/member.json";
import zhNotification from "./locales/zh/notification.json";

export const LANGUAGES = ["en", "zh"];
const STORAGE_KEY = "ec-lang";

// The saved choice, else Chinese for a Chinese browser, else English.
function initialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.includes(saved)) return saved;
  } catch {
    // storage blocked: fall through to the browser language
  }
  return String(navigator.language ?? "").toLowerCase().startsWith("zh") ? "zh" : "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, sidebar: enSidebar, notification: enNotification, dashboard: enDashboard, domain: enDomain, announcement: enAnnouncement, admin: enAdmin, account: enAccount, ownership: enOwnership, process: enProcess, capture: enCapture, transaction: enTransaction, report: enReport, maintenance: enMaintenance, autorenew: enAutoRenew, member: enMember },
    zh: { common: zhCommon, sidebar: zhSidebar, notification: zhNotification, dashboard: zhDashboard, domain: zhDomain, announcement: zhAnnouncement, admin: zhAdmin, account: zhAccount, ownership: zhOwnership, process: zhProcess, capture: zhCapture, transaction: zhTransaction, report: zhReport, maintenance: zhMaintenance, autorenew: zhAutoRenew, member: zhMember },
  },
  lng: initialLanguage(),
  fallbackLng: "en",
  defaultNS: "common",
  ns: ["common", "sidebar", "notification", "dashboard", "domain", "announcement", "admin", "account", "ownership", "process", "capture", "transaction", "report", "maintenance", "autorenew", "member"],
  interpolation: { escapeValue: false },
});

// Keep <html lang> and the saved choice in step with the language.
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng === "zh" ? "zh-CN" : "en";
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // storage blocked: the choice just is not remembered
  }
});
document.documentElement.lang = i18n.language === "zh" ? "zh-CN" : "en";

export default i18n;
