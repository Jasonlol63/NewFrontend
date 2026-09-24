import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, Eye, EyeOff, Lock, User } from "lucide-react";
import { cn } from "@/lib/utils";
import IconInput from "./components/IconInput.jsx";
import RoleTabs from "./components/RoleTabs.jsx";
import PillSwitch from "@/components/shared/PillSwitch.jsx";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
];

const LANG_OPTIONS = [
  { value: "en", label: "EN" },
  { value: "zh", label: "中" },
];

export default function LoginPage() {
  const [role, setRole] = useState("admin");
  const [lang, setLang] = useState("en");
  const [companyId, setCompanyId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = (e) => {
    e.preventDefault();
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#dbe9fb] bg-[url('/images/count_bg.png')] bg-cover bg-center bg-no-repeat"
    >
      <div className="mb-[8vh] w-[400px] py-[30px] text-center">
        <div className="mx-auto mb-[14px] h-[76px] w-[76px] rotate-[-45deg] drop-shadow-[0_10px_14px_rgba(20,90,200,0.35)]">
          <img
            src="/images/count_logo.png"
            alt="Count logo"
            className="block h-full w-full"
          />
        </div>

        <h1 className="m-0 mb-1 text-[21px] font-bold tracking-[-0.2px] text-[#14336b]">
          Accounting Management System
        </h1>
        <p className="mx-0 mb-5 text-[10px] font-semibold tracking-[3px] text-[#7fa8d6]">
          SIMPLER ACCOUNTING BRIGHTER BUSINESS
        </p>

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
                Forget Password?
              </Link>
            </div>

            <button
              type="submit"
              className="mt-1 flex h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border-none bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] text-sm font-bold text-white shadow-[0_14px_24px_-8px_rgba(20,90,220,0.55),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.35)]"
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
    </div>
  );
}
