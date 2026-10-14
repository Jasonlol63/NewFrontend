import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Building2, Eye, EyeOff, Lock, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { loginErrorTitle } from "./loginErrors";
import { LANG_OPTIONS } from "./langOptions";
import IconInput from "./components/IconInput.jsx";
import RoleTabs from "./components/RoleTabs.jsx";
import MaintenanceNotice from "./components/MaintenanceNotice.jsx";
import PillSwitch from "@/components/shared/PillSwitch.jsx";
import StatusDialog from "@/components/shared/StatusDialog.jsx";
import TelegramFab from "./components/TelegramFab.jsx";
import { getJson, postForm } from "@/lib/api";
import { noticeLine, toNotice } from "@/pages/announcement/announcementRules";
import { APP_SHELL_IMAGES, preloadImages } from "@/lib/preloadImages";
import { loadSessionUser, markLogin } from "@/hooks/useSavedState";
import { homePath } from "@/components/layout/sidebarConfig";

// Backend `redirect` values that mean "verify the secondary password next".
const SECONDARY_REDIRECTS = {
  "/owner-secondary-password": "owner",
  "/user-secondary-password": "user",
};

// the gif's final (fully-assembled) frame holds from 2.12s to 2.91s before
// it loops back to frame 1 — swap mid-hold, well clear of either edge, so
// the cut lands on a frame that already looks identical to the static logo
const LOGO_ANIMATION_MS = 2500;

// Only a plain https link is trusted for the support button (the value is set by an admin on the Settings tab).
const SAFE_LINK = /^https:\/\/[^\s"<>]+$/i;

export default function LoginPage() {
  const { t, i18n } = useTranslation(["login", "common"]);
  const roleOptions = [
    { value: "admin", label: t("roles.admin") },
    { value: "member", label: t("roles.member") },
  ];
  const [role, setRole] = useState("admin");
  const [companyId, setCompanyId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorTitle, setErrorTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [supportLink, setSupportLink] = useState("");
  const [notice, setNotice] = useState(null); // { prefix, text } of the published maintenance notice, or null
  const navigate = useNavigate();
  const [logoSrc, setLogoSrc] = useState(
    "/images/count_logo_puzzle_animation.webp"
  );

  // Already logged in (and past the secondary password): no need to see the login form again.
  useEffect(() => {
    let cancelled = false;
    loadSessionUser().then((user) => {
      if (!cancelled && user?.menu && !user.needs_owner_secondary && !user.needs_user_secondary) {
        navigate(homePath(user), { replace: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    preloadImages(["/images/count_logo.webp", ...APP_SHELL_IMAGES]);
    const timer = setTimeout(() => {
      setLogoSrc("/images/count_logo.webp");
    }, LOGO_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, []);

  // Public endpoint (no sign-in needed). No link, or any failure: the button just stays hidden.
  useEffect(() => {
    const controller = new AbortController();
    getJson("/api/settings/getTelegramLink", undefined, { signal: controller.signal })
      .then((body) => {
        const link = String(body?.data?.telegramSupportLink ?? "").trim();
        setSupportLink(SAFE_LINK.test(link) ? link : "");
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Public endpoint (no sign-in needed): the newest active notice. None, empty text or any failure: no banner.
  useEffect(() => {
    const controller = new AbortController();
    getJson("/api/announcement/getMaintenanceInLogin", undefined, { signal: controller.signal })
      .then((body) => {
        const row = toNotice(body?.data);
        const text = noticeLine(row?.content ?? "");
        setNotice(text ? { prefix: (row.prefix ?? "").trim(), text } : null);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const missing = !companyId.trim() ? "companyId" : !username.trim() ? "username" : !password ? "password" : "";
    if (missing) {
      setErrorTitle(t(`validation.${missing}`));
      setErrorOpen(true);
      return;
    }
    setSubmitting(true);
    try {
      const res = await postForm("/auth/login", {
        tenant_code: companyId.trim(),
        password,
        login_role: role,
        [role === "member" ? "account_id" : "login_id"]: username.trim(),
      });
      markLogin();
      const secondaryFor = SECONDARY_REDIRECTS[res.redirect];
      if (secondaryFor) {
        navigate("/secondary-password", { state: { userType: secondaryFor } });
      } else {
        navigate(role === "member" ? "/member/win-loss" : "/dashboard");
      }
    } catch (err) {
      setErrorTitle(loginErrorTitle(err));
      setErrorOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 pb-[6dvh] bg-[#dbe9fb] bg-[url('/images/count_bg.webp')] bg-cover bg-center bg-no-repeat">
      <div className="w-full max-w-[clamp(320px,65dvh,400px)] py-fluid-md text-center">
        <div className="mx-auto mb-fluid-sm size-auth-logo rotate-[-45deg]">
          <img
            src={logoSrc}
            alt="Count logo"
            className="block h-full w-full"
          />
        </div>

        <h1 className="m-0 mb-fluid-md type-page-title tracking-[-0.2px] text-[#14336b]">
          {t("title")}
        </h1>

        {notice && <MaintenanceNotice prefix={notice.prefix} text={notice.text} className="mb-fluid-sm" />}

        <div className="overflow-hidden rounded-[24px] bg-gradient-to-b from-white to-[#f5f9ff] shadow-[0_30px_60px_-20px_rgba(20,70,160,0.35),0_10px_25px_-10px_rgba(20,70,160,0.25),inset_0_1px_0_rgba(255,255,255,0.6)]">
          <RoleTabs options={roleOptions} value={role} onChange={setRole} />

          <form
            noValidate
            onSubmit={onSubmit}
            className="flex flex-col gap-[clamp(8px,1.5dvh,12px)] px-[26px] py-fluid-md text-left"
          >
            <IconInput
              icon={Building2}
              placeholder={t("companyId")}
              required
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value.toUpperCase())}
            />

            <IconInput
              icon={User}
              placeholder={t("username")}
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.toUpperCase())}
            />

            <IconInput
              icon={Lock}
              type={showPassword ? "text" : "password"}
              placeholder={t("password")}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              trailing={
                <button
                  type="button"
                  className="absolute right-[14px] top-1/2 flex h-[15px] w-[15px] -translate-y-1/2 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-[#6fa8ea]"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t("common:hidePassword") : t("common:showPassword")}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />

            <div className="mb-fluid-xs mt-0.5 flex items-center justify-between type-caption">
              <label className="flex cursor-pointer items-center gap-[7px] text-[#4a5568]">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span
                  className={cn(
                    "relative inline-block h-[18px] w-8 flex-shrink-0 rounded-full bg-[#dbe4f0] transition-colors",
                    "after:absolute after:left-[2px] after:top-[2px] after:h-[14px] after:w-[14px] after:rounded-full after:bg-white after:shadow-[0_1px_2px_rgba(0,0,0,0.2)] after:transition-transform after:content-['']",
                    "peer-checked:bg-[linear-gradient(100deg,#0a3fc9_0%,#3fc4ff_100%)] peer-checked:after:translate-x-[14px]"
                  )}
                />
                {t("rememberMe")}
              </label>
              <Link
                to="/reset-password"
                className="font-semibold! text-[#2f6fef] no-underline"
              >
                {t("forgotPassword")}
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 flex disabled:cursor-not-allowed disabled:opacity-70 h-[clamp(38px,5.5dvh,42px)] w-full cursor-pointer items-center justify-center gap-2 rounded-full border-none bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] type-body font-semibold! text-white shadow-[0_14px_24px_-8px_rgba(20,90,220,0.55),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.35)]"
            >
              {t("login")}
              <ArrowRight size={15} />
            </button>

            <div className="mt-fluid-xs flex justify-center">
              <PillSwitch options={LANG_OPTIONS} value={i18n.resolvedLanguage} onChange={(lng) => i18n.changeLanguage(lng)} />
            </div>
          </form>
        </div>
      </div>

      {supportLink && <TelegramFab href={supportLink} />}

      <StatusDialog
        open={errorOpen}
        onOpenChange={setErrorOpen}
        type="error"
        title={errorTitle}
        confirmText={t("tryAgain")}
      />
    </div>
  );
}
