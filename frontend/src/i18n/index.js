import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enCommon from "./locales/en/common.json";
import enSidebar from "./locales/en/sidebar.json";
import enDashboard from "./locales/en/dashboard.json";
import enNotification from "./locales/en/notification.json";
import zhCommon from "./locales/zh/common.json";
import zhSidebar from "./locales/zh/sidebar.json";
import zhDashboard from "./locales/zh/dashboard.json";
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
    en: { common: enCommon, sidebar: enSidebar, notification: enNotification, dashboard: enDashboard },
    zh: { common: zhCommon, sidebar: zhSidebar, notification: zhNotification, dashboard: zhDashboard },
  },
  lng: initialLanguage(),
  fallbackLng: "en",
  defaultNS: "common",
  ns: ["common", "sidebar", "notification", "dashboard"],
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
