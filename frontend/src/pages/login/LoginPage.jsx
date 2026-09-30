import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, Eye, EyeOff, Lock, User } from "lucide-react";
import { cn } from "@/lib/utils";
import IconInput from "./components/IconInput.jsx";
import RoleTabs from "./components/RoleTabs.jsx";
import MaintenanceNotice from "./components/MaintenanceNotice.jsx";
import PillSwitch from "@/components/shared/PillSwitch.jsx";
import StatusDialog from "@/components/shared/StatusDialog.jsx";
import { postForm } from "@/lib/api";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
];

// Backend login error messages -> dialog title. Anything unlisted (expired,
// maintenance, network) is shown as the backend sent it.
const ERROR_TITLES = {
  "Group/Company Not Found!": "Group/Company Not Found",
  "Username or password is incorrect": "Username/Password Not Found",
  "Account ID, Company ID or password is incorrect": "Username/Password Not Found",
  "You do not have access to this Company or Group": "Invalid access this tenant",
};

// Backend `redirect` values that mean "verify the secondary password next".
const SECONDARY_REDIRECTS = {
  "/owner-secondary-password": "owner",
  "/user-secondary-password": "user",
};

const CONFIRM_TEXT = { en: "Try again", zh: "重新输入" };

const LANG_OPTIONS = [
  { value: "en", label: "EN" },
  { value: "zh", label: "中" },
];

// the gif's final (fully-assembled) frame holds from 2.12s to 2.91s before
// it loops back to frame 1 — swap mid-hold, well clear of either edge, so
// the cut lands on a frame that already looks identical to the static logo
const LOGO_ANIMATION_MS = 2500;

// Announcement banner is hidden for now; flip to true to bring it back.
const SHOW_MAINTENANCE_NOTICE = false;

export default function LoginPage() {
  const [role, setRole] = useState("admin");
  const [lang, setLang] = useState("en");
  const [companyId, setCompanyId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorTitle, setErrorTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [logoSrc, setLogoSrc] = useState(
    "/images/count_logo_puzzle_animation.gif"
  );

  useEffect(() => {
    const preload = new Image();
    preload.src = "/images/count_logo.png";
    const timer = setTimeout(() => {
      setLogoSrc("/images/count_logo.png");
    }, LOGO_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await postForm("/auth/login", {
        tenant_code: companyId.trim(),
        password,
        login_role: role,
        [role === "member" ? "account_id" : "login_id"]: username.trim(),
      });
      const secondaryFor = SECONDARY_REDIRECTS[res.redirect];
      if (secondaryFor) {
        navigate("/secondary-password", { state: { userType: secondaryFor, lang } });
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setErrorTitle(ERROR_TITLES[err.message] ?? err.message);
      setErrorOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center pb-20 bg-[#dbe9fb] bg-[url('/images/count_bg.webp')] bg-cover bg-center bg-no-repeat">
      <div className="w-[400px] py-[30px] text-center">
        <div className="mx-auto mb-[14px] h-[76px] w-[76px] rotate-[-45deg]">
          <img
            src={logoSrc}
            alt="Count logo"
            className="block h-full w-full"
          />
        </div>

        <h1 className="m-0 mb-5 text-[21px] font-bold tracking-[-0.2px] text-[#14336b]">
          Accounting Management System
        </h1>

        {SHOW_MAINTENANCE_NOTICE && <MaintenanceNotice className="mb-[14px]" />}

        <div className="overflow-hidden rounded-[24px] bg-gradient-to-b from-white to-[#f5f9ff] shadow-[0_30px_60px_-20px_rgba(20,70,160,0.35),0_10px_25px_-10px_rgba(20,70,160,0.25),inset_0_1px_0_rgba(255,255,255,0.6)]">
          <RoleTabs options={ROLE_OPTIONS} value={role} onChange={setRole} />

          <form
            onSubmit={onSubmit}
            className="flex flex-col gap-3 px-[26px] pb-[26px] pt-6 text-left"
          >
            <IconInput
              icon={Building2}
              placeholder="Company / Group ID"
              required
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            />

            <IconInput
              icon={User}
              placeholder="Username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />

            <IconInput
              icon={Lock}
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              trailing={
                <button
                  type="button"
                  className="absolute right-[14px] top-1/2 flex h-[15px] w-[15px] -translate-y-1/2 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-[#6fa8ea]"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />

            <div className="mb-3 mt-0.5 flex items-center justify-between text-xs">
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
                Remember me
              </label>
              <Link
                to="/reset-password"
                className="font-semibold text-[#2f6fef] no-underline"
              >
                Forget Password
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 flex disabled:cursor-not-allowed disabled:opacity-70 h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border-none bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] text-sm font-bold text-white shadow-[0_14px_24px_-8px_rgba(20,90,220,0.55),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.35)]"
            >
              Login
              <ArrowRight size={15} />
            </button>

            <div className="mt-3 flex justify-center">
              <PillSwitch options={LANG_OPTIONS} value={lang} onChange={setLang} />
            </div>
          </form>
        </div>
      </div>

      <StatusDialog
        open={errorOpen}
        onOpenChange={setErrorOpen}
        type="error"
        title={errorTitle}
        confirmText={CONFIRM_TEXT[lang] ?? CONFIRM_TEXT.en}
      />
    </div>
  );
}
